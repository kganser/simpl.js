var kernel = function(modules, clients) {
  var dispatch = function(client) {
    //console.log(client ? 'resolving new client' : 'resolving existing clients');
    var requested = [];
    for (var i = client ? clients.push(client)-1 : 0; i < clients.length; i++) {
      client = clients[i];
      var needed = Object.keys(client.dependencies),
          available = 0;
      needed.forEach(function(name) {
        if (!modules.hasOwnProperty(name)) {
          requested.push(name);
          return modules[name] = false;
        }
        if (modules[name].export)
          available++;
      });
      if (available == needed.length) {
        //console.log('dependencies resolved for client '+(client.name || 'in '+location.pathname));
        needed.forEach(function(name) {
          var module = modules[name];
          if (!module.init) {
            module.init = true;
            module.export = module.export();
          }
          client.dependencies[name] = module.export;
        });
        clients.splice(i--, 1)[0].callback(client.dependencies);
      }
    }
    return requested;
  };
  return {
    add: function(name, module, dependencies) {
      //console.log('adding module '+name, dependencies);
      if (dependencies) return kernel.use(dependencies, function(o) {
        kernel.add(name, function() { return module(o); });
      }, name);
      if (!modules[name]) {
        modules[name] = {export: module};
        return dispatch();
      }
      return [];
    },
    use: function(modules, callback, name) {
      return dispatch({dependencies: modules, callback: callback, name: name});
    }
  };
}({}, []);

// Kernel extension for worker creation, messaging, and dependency loading
kernel = function(k) {
  var id = 0, log = {}, workers = [], moduleListeners = {}, globalListeners, 
      inWorker = typeof WorkerGlobalScope != 'undefined';
  
  if (inWorker) self.console = {
    log: function() { proxy('log', Array.prototype.slice.call(arguments)); },
    warn: function() { proxy('warn', Array.prototype.slice.call(arguments)); },
    error: function() { proxy('error', Array.prototype.slice.call(arguments)); },
    info: function() { proxy('info', Array.prototype.slice.call(arguments)); }
  };
  
  var load = inWorker ? function(modules) {
    var remaining = modules.length;
    modules.forEach(function(module, i) {
      proxy('load', [module], function(code) {
        modules[i] = URL.createObjectURL(new Blob([code || ''], {type: 'text/javascript'}));
        if (!--remaining) importScripts.apply(null, modules);
      });
    });
    return modules;
  } : function(modules) { return modules; };
  var send = function(kernel, peer, module, command, args, callback, transferable) {
    // TODO: use a guid?
    var start = id;
    do { id = id == Number.MAX_SAFE_INTEGER ? 0 : id + 1; } while (id in log && id != start);
    if (id == start) throw 'message queue full';
    if (callback) log[id] = callback;
    peer.postMessage({kernel: kernel, module: module, id: id, command: command, args: args}, transferable);
  };
  var receive = function(e) {
    var id = e.data.id;
    if ('result' in e.data) {
      if (log[id]) log[id].apply(null, e.data.result);
      delete log[id];
    } else {
      var worker = !inWorker && workers.filter(function(o) { return o.worker === e.target; })[0],
          command = e.data.command;
      if (e.data.kernel) {
        if (command == 'load') {
          if (worker.load) worker.load(e.data.args[0], function(code) {
            e.target.postMessage({id: id, result: [code]});
          });
        } else if (worker.log) {
          worker.log(command, e.data.args);
        }
      } else {
        var module = e.data.module,
            listener = module == null ? worker ? worker.listeners[command] : globalListeners[command] : (moduleListeners[module] || {})[command];
        if (!listener) return console.error('no listener for command '+command+(module ? ' (module '+module+')' : ''));
        var destruct = listener(e.data.args, function() {
          e.target.postMessage({id: id, result: Array.prototype.slice.call(arguments)});
        }, function(command, args, callback, transferable) {
          send(false, e.target, e.data.module, command, args, callback, transferable);
        });
        if (worker && typeof destruct == 'function')
          worker.destructors.push(destruct);
      }
    }
  };
  
  var channel = function(kernel, module) {
    return function(listeners, code, load, log, error) {
      var worker, peer = code ? new Worker(URL.createObjectURL(new Blob([code], {type: 'text/javascript'}))) : self;
      if (kernel || code) peer.onmessage = receive;
      
      if (code != null) {
        peer.onerror = error;
        workers.push(worker = {worker: peer, listeners: listeners || {}, load: load, log: log, destructors: []});
      } else if (module != null) {
        moduleListeners[module] = listeners;
      } else {
        globalListeners = listeners;
      }
      
      var sender = function(command, args, callback, transferable) {
        send(kernel, peer, module, command, args, callback, transferable);
      };
      
      return code == null ? sender : {send: sender, terminate: function(i) {
        if (~(i = workers.indexOf(worker))) {
          worker.destructors.forEach(function(d) { d(); });
          worker.worker.terminate();
          workers.splice(i, 1);
        }
      }};
    };
  };
  
  var proxy = channel(true)();
  
  return {
    add: function(name, module, dependencies) {
      if (dependencies) return kernel.use(dependencies, function(o) {
        kernel.add(name, function() {
          return module(o, channel(false, name));
        });
      }, name);
      return load(k.add(name, function() {
        return module(channel(false, name));
      }, dependencies));
    },
    use: function(modules, callback, name) {
      return load(k.use(modules, function(o) {
        callback(o, channel(false));
      }, name));
    },
    worker: inWorker
  };
}(kernel);
