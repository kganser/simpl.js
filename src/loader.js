simpl = function(s) {
  var id = 0, log = {}, workers = [], blobs = {}, moduleListeners = {}, globalListeners,
      inWorker = typeof WorkerGlobalScope != 'undefined';
  
  if (inWorker) {
    var console = function(level) {
      return function() {
        var loc = (new Error().stack.split('\n')[2] || '').match(/(blob:chrome-extension.+):(\d+):(\d+)\)?$/);
        proxy('log', {
          level: level,
          args: Array.prototype.slice.call(arguments),
          module: loc && blobs[loc[1]],
          line: loc && +loc[2],
          column: loc && +loc[3]
        });
      };
    };
    self.console = {};
    'log warn error info'.split(' ').forEach(function(level) {
      self.console[level] = console(level);
    });
    self.addEventListener('unhandledrejection', function(e) {
      var loc = (String(e.reason && e.reason.stack).split('\n')[1] || '').match(/(blob:chrome-extension.+):(\d+):(\d+)\)?$/);
      proxy('log', {
        level: 'error',
        args: ['Uncaught (in promise) '+e.reason],
        module: loc && blobs[loc[1]],
        line: loc && +loc[2],
        column: loc && +loc[3]
      });
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
      if (typeof log[id] == 'function') log[id].apply(null, e.data.result);
      delete log[id];
    } else {
      var worker = !inWorker && workers.filter(function(o) { return o.worker === e.target; })[0],
          command = e.data.command,
          args = e.data.args;
      if (e.data.simpl) {
        if (!worker) return;
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
      return simpl.use(dependencies || {}, function(o) {
        s.add(name, function() {
          // TODO: multiple clients for host module (e.g., socket@simpljs, socket v2, etc)
          return module(o, channel(false, name.replace(/@simpljs$/, '')));
        }, version);
      }, name.split('@')[1]);
    },
    use: function(modules, callback, namespace) {
      return load(s.use(modules, function(o) {
        Object.keys(o).forEach(function(id) {
          var name = id.split('@'),
              user = name[1];
          if (namespace && (!user || namespace == user)) {
            o[user ? name[0] : name[0]+'@'+simpl.user] = o[id];
            delete o[id];
          }
        });
        try {
          callback(o, channel(false));
        } catch (e) {
          throw e.stack || e;
        }
      }));
    },
    worker: inWorker
  };
}(simpl);
