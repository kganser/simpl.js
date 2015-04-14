var simpl = function(modules, clients) {
  var dispatch = function(client) {
    var requested = [];
    for (var i = client ? clients.push(client)-1 : 0; i < clients.length; i++) {
      client = clients[i];
      var needed = Object.keys(client.dependencies),
          available = {};
      needed.forEach(function(name) {
        var version = parseInt(client.dependencies[name], 10) || 0;
        if (!modules[name]) modules[name] = {};
        if (!(version in modules[name])) {
          requested.push({name: name, version: version});
          return modules[name][version] = false;
        }
        if (modules[name][version].export)
          available[name] = modules[name][version];
      });
      if (Object.keys(available).length == needed.length) {
        try {
          needed.forEach(function(name) {
            var module = available[name];
            if (!module.init) {
              module.init = true;
              module.export = module.export();
            }
            client.dependencies[name] = module.export;
          });
          clients.splice(i--, 1)[0].callback(client.dependencies);
        } catch (e) {
          throw e.stack || e;
        }
      }
    }
    return requested;
  };
  return {
    add: function(name, module, version, dependencies) {
      if (dependencies) return simpl.use(dependencies, function(o) {
        simpl.add(name, function() { return module(o); }, version);
      });
      if (!modules[name]) modules[name] = {};
      if (!modules[name][version = parseInt(version, 10) || 0]) {
        modules[name][version] = {export: module};
        return dispatch();
      }
      return [];
    },
    use: function(modules, callback) {
      return dispatch({dependencies: modules, callback: callback});
    }
  };
}({}, []);

// Loader extension for worker creation, messaging, and dependency loading
if (location.protocol != 'http:') simpl = function(s) {
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
    modules.forEach(function(module) {
      proxy('load', module, function(url) {
        if (url) {
          blobs[url] = module;
          try {
            importScripts(url);
          } catch (e) {
            throw e.message+'\n    at '+url;
          }
        }
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
    var message = {simpl: simpl, module: module, id: id, command: command, args: args};
    try {
      peer.postMessage(message, transferable);
    } catch(e) {
      if (command == 'log') {
        message.args.args = ['[unserializable]'];
        peer.postMessage(message);
      }
    }
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
          if (worker.load) worker.load(args, function(code) {
            var url = code && URL.createObjectURL(new Blob([code], {type: 'text/javascript'}));
            if (url) worker.urls[url] = args;
            e.target.postMessage({id: id, result: [url]});
          });
        } else if (worker.log) {
          worker.log(args.level, args.args, args.module, args.line, args.column);
        }
      } else {
        var destruct, module = e.data.module;
        (module == null
          ? [worker ? worker.listeners[command] : globalListeners[command]]
          : (moduleListeners[module] || {})[command]).forEach(function(listener) {
          destruct = listener(args, function() {
            e.target.postMessage({id: id, result: Array.prototype.slice.call(arguments)});
          }, function(command, args, callback, transferable) {
            send(false, e.target, module, command, args, callback, transferable);
          });
        });
        if (worker && typeof destruct == 'function')
          worker.destructors.push(destruct);
      }
    }
  };
  var cleanup = function(i) {
    var worker = workers[i];
    worker.destructors.forEach(function(d) { d(); });
    URL.revokeObjectURL(worker.url);
    Object.keys(worker.urls).forEach(function(url) { URL.revokeObjectURL(url); });
    workers.splice(i, 1);
  };
  
  var channel = function(simpl, module) {
    return function(listeners, code, load, log, error) {
      var url = code != null && URL.createObjectURL(new Blob([code], {type: 'application/javascript'})),
          peer = url ? new Worker(url) : self, worker;
      if (simpl || code) peer.onmessage = receive;
      
      if (code != null) {
        peer.onerror = function(e) {
          var index = workers.indexOf(worker);
          if (index < 0) return;
          var message = (e.message.replace(/^Uncaught Uncaught/, 'Uncaught')+'\n').split('\n'),
              source = message[1].match(/^    at (?:[^ ]+ \()?(blob:[^:]+)(?::(\d+):\d+\)?)?$/),
              file = source ? source[1] : e.filename,
              line = source ? source[2] : e.lineno,
              module = worker.urls[file];
          message = message[0];
          if (module && !line && /^Uncaught SyntaxError:/.test(message))
            return new Worker(file).onerror = function(e) {
              error(message, module, e.lineno);
              cleanup(index);
            };
          error(message, module, line);
          cleanup(index);
        };
        workers.push(worker = {
          worker: peer,
          listeners: listeners || {},
          load: load,
          log: log,
          url: url,
          urls: {},
          destructors: []
        });
      } else if (module != null) {
        var ml = moduleListeners[module];
        if (!ml) moduleListeners[module] = ml = {};
        Object.keys(listeners).forEach(function(name) {
          if (!ml[name]) ml[name] = [];
          ml[name].push(listeners[name]);
        })
      } else {
        globalListeners = listeners;
      }
      
      var sender = function(command, args, callback, transferable) {
        send(simpl, peer, module, command, args, callback, transferable);
      };
      
      return url ? {send: sender, terminate: function() {
        var index = workers.indexOf(worker);
        if (~index) {
          peer.terminate();
          cleanup(index);
        }
      }} : sender;
    };
  };
  
  var proxy = channel(true)();
  
  return {
    add: function(name, module, version, dependencies) {
      if (dependencies) return simpl.use(dependencies, function(o) {
        simpl.add(name, function() {
          return module(o, channel(false, name));
        }, version);
      });
      return s.add(name, function() {
        return module({}, channel(false, name));
      }, version);
    },
    use: function(modules, callback) {
      return load(s.use(modules, function(o) {
        callback(o, channel(false));
      }));
    },
    worker: inWorker
  };
}(simpl);
