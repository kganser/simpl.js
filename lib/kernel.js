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
    },
    modules: modules // TODO: hide if possible
  };
}({}, []);

// Kernel extension for worker creation, messaging, and dependency loading
kernel = function(k) {
  var load = function(modules) {
    var x = modules.slice(0);
    if (typeof WorkerGlobalScope != 'undefined') {
      var remaining = modules.length;
      modules.forEach(function(module, i) {
        proxy('load', [module], function(code) {
          modules[i] = URL.createObjectURL(new Blob([code || ''], {type: 'text/javascript'}));
          if (!--remaining) importScripts.apply(null, modules);
        });
      });
    }
    return modules;
  };
  
  var id = 0, log = {}, workers = [], handlers;
  var send = function(kernel, peer, module, command, args, callback, transferable) {
    // TODO: use a guid?
    var start = id;
    do { id = id == Number.MAX_SAFE_INTEGER ? 0 : id + 1; } while (id in log && id != start);
    if (id == start) throw 'message queue full';
    log[id] = callback;
    peer.postMessage({kernel: kernel, module: module, id: id, command: command, args: args}, transferable);
  };
  var receive = function(e) {
    var id = e.data.id;
    if ('result' in e.data) {
      if (log[id]) log[id].apply(null, e.data.result);
      delete log[id];
    } else {
      var module = e.data.module;
      if (module && !(module = k.modules[module]))
        return console.error('module '+module+' not available in host');
      if (e.data.kernel) {
        workers.filter(function(o) { return o.worker === e.target; })[0].load(e.data.args[0], function(code) {
          console.log(code.split('\n')[0]);
          e.target.postMessage({id: id, result: [code]});
          console.log('after');
        });
      } else {
        var command = e.data.command,
            listener = module ? module.handlers[command] : handlers[command];
        if (!listener) return console.error('no listener for command '+command);
        listener(e.data.args, function() {
          e.target.postMessage({id: id, result: Array.prototype.slice.call(arguments)});
        });
      }
    }
  };
  
  var channel = function(kernel, module) {
    return function(listeners, code, loader) {
      var peer = code ? new Worker(URL.createObjectURL(new Blob([code], {type: 'text/javascript'}))) : self;
      if (kernel || code) peer.onmessage = receive;
      
      if (module) {
        if (!k.modules[module].workers) k.modules[module].workers = [];
        if (code) k.modules[module].workers.push({handlers: listeners, load: loader, worker: peer});
        else k.modules[module].handlers = listeners;
      } else if (code) {
        workers.push({handlers: listeners, load: loader, worker: peer});
      } else {
        handlers = listeners;
      }
      
      var sender = function(command, args, callback, transferable) {
        send(kernel, peer, module, command, args, callback, transferable);
      };
      
      return code ? {send: sender, peer: peer} : sender;
    };
  };
  
  var proxy = channel(true)();
  
  return {
    add: function(name, module, dependencies) {
      if (dependencies) return kernel.use(dependencies, function(o) { kernel.add(name, function() { return module(o, channel(false, name)); }); }, name);
      return load(k.add(name, function() { return module(channel(false, name)); }, dependencies));
    },
    use: function(modules, callback, name) {
      return load(k.use(modules, function(o) { callback(o, channel(false)); }, name));
    }
  };
}(kernel);
