var simpl = function(modules, clients) {
  var dispatch = function(client) {
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
      if (dependencies) return simpl.use(dependencies, function(o) {
        simpl.add(name, function() { return module(o); });
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

// Loader extension for worker creation, messaging, and dependency loading
simpl = function(s) {
  var id = 0, log = {}, workers = [], blobs = {}, moduleListeners = {}, globalListeners,
      inWorker = typeof WorkerGlobalScope != 'undefined';
  
  if (inWorker) {
    var console = function(level) {
      return function() {
        var loc = new Error().stack.split('\n')[2].match(/at [^\(]*\(?(.+):(\d+):(\d+)\)?$/);
        proxy('log', {
          level: level,
          args: Array.prototype.slice.call(arguments),
          module: loc && blobs[loc[1]],
          line: loc && parseInt(loc[2], 10),
          column: loc && parseInt(loc[3], 10)
        });
      };
    };
    self.console = {};
    'log warn error info'.split(' ').forEach(function(level) {
      self.console[level] = console(level);
    });
  }
  
  var load = !inWorker ? function(m) { return m; } : function(modules) {
    var remaining = modules.length;
    modules.forEach(function(module, i) {
      proxy('load', [module], function(code) {
        modules[i] = URL.createObjectURL(new Blob([code || ''], {type: 'text/javascript'}));
        // TODO: URL.revokeObjectURL
        blobs[modules[i]] = module;
        if (!--remaining) importScripts.apply(null, modules);
      });
    });
    return modules;
  };
  var send = function(simpl, peer, module, command, args, callback, transferable) {
    // TODO: use a guid?
    var start = id;
    do { id = id == Number.MAX_SAFE_INTEGER ? 0 : id + 1; } while (id in log && id != start);
    if (id == start) throw 'message queue full';
    if (callback) log[id] = callback;
    peer.postMessage({simpl: simpl, module: module, id: id, command: command, args: args}, transferable);
  };
  var receive = function(e) {
    var id = e.data.id;
    if ('result' in e.data) {
      if (log[id]) log[id].apply(null, e.data.result);
      delete log[id];
    } else {
      var worker = !inWorker && workers.filter(function(o) { return o.worker === e.target; })[0],
          command = e.data.command,
          args = e.data.args;
      if (e.data.simpl) {
        if (command == 'load') {
          if (worker.load) worker.load(args[0], function(code) {
            e.target.postMessage({id: id, result: [code]});
          });
        } else if (worker.log) {
          worker.log(args.level, args.args, args.module, args.line, args.column);
        }
      } else {
        var module = e.data.module,
            listener = module == null ? worker ? worker.listeners[command] : globalListeners[command] : (moduleListeners[module] || {})[command];
        if (!listener) return console.error('no listener for command '+command+(module ? ' (module '+module+')' : ''));
        var destruct = listener(args, function() {
          e.target.postMessage({id: id, result: Array.prototype.slice.call(arguments)});
        }, function(command, args, callback, transferable) {
          send(false, e.target, e.data.module, command, args, callback, transferable);
        });
        if (worker && typeof destruct == 'function')
          worker.destructors.push(destruct);
      }
    }
  };
  
  var channel = function(simpl, module) {
    return function(listeners, code, load, log, error) {
      var url = code != null && URL.createObjectURL(new Blob([code], {type: 'application/javascript'})),
          peer = url ? new Worker(url) : self;
      if (simpl || code) peer.onmessage = receive;
      
      if (code != null) {
        peer.onerror = error;
        workers.push(peer = {worker: peer, listeners: listeners || {}, load: load, log: log, destructors: []});
      } else if (module != null) {
        moduleListeners[module] = listeners;
      } else {
        globalListeners = listeners;
      }
      
      var sender = function(command, args, callback, transferable) {
        send(simpl, peer, module, command, args, callback, transferable);
      };
      
      return url ? {send: sender, terminate: function(i) {
        if (~(i = workers.indexOf(peer))) {
          peer.destructors.forEach(function(d) { d(); });
          peer.worker.terminate();
          URL.revokeObjectURL(url);
          workers.splice(i, 1);
        }
      }} : sender;
    };
  };
  
  var proxy = channel(true)();
  
  return {
    add: function(name, module, dependencies) {
      if (dependencies) return simpl.use(dependencies, function(o) {
        simpl.add(name, function() {
          return module(o, channel(false, name));
        });
      }, name);
      return s.add(name, function() {
        return module(channel(false, name));
      });
    },
    use: function(modules, callback, name) {
      return load(s.use(modules, function(o) {
        callback(o, channel(false));
      }, name));
    },
    worker: inWorker
  };
}(simpl);
