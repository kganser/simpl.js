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
  };
}({}, []);

if (typeof WorkerGlobalScope != 'undefined') kernel = function(k) {
  var load = function(modules) {
    k.use({proxy: 0}, function(o) {
      var proxy = o.proxy(),
          remaining = modules.length;
      modules.forEach(function(module, i) {
        proxy.send('module', [module], function(code) {
          modules[i] = URL.createObjectURL(new Blob([code || ''], {type: 'text/javascript'}));
          if (!--remaining) importScripts.apply(null, modules);
        });
      });
    });
  };
  return {
    add: function(name, module, dependencies) {
      if (dependencies) return kernel.use(dependencies, function(o) {
        kernel.add(name, function() { return module(o); });
      }, name);
      load(k.add(name, module, dependencies));
    },
    use: function(modules, callback, name) {
      load(k.use(modules, callback, name));
    }
  };
}(kernel);

kernel.add('proxy', function() {
  var host;
  return function(listeners, code) {
    if (!code && host) return host;
    
    listeners = listeners || {};
    var id = 0, log = {},
        peer = code ? new Worker(URL.createObjectURL(new Blob([code], {type: 'text/javascript'}))) : self;
    
    peer.onmessage = function(e) {
      if ('result' in e.data) {
        var message = log[e.data.id];
        if (message.callback)
          message.callback.apply(null, e.data.result);
        if (!message.persist)
          delete log[e.data.id];
        // TODO: clean up persistent callbacks
      } else if (listeners[e.data.command]) {
        listeners[e.data.command](e.data.args, function() {
          peer.postMessage({id: e.data.id, result: Array.prototype.slice.call(arguments)});
        });
      }
    };
    
    // TODO: support transferable objects
    var channel = {
      peer: peer,
      send: function(command, args, callback, persist) {
        // TODO: use a guid?
        var start = id;
        do { id = id == Number.MAX_SAFE_INTEGER ? 0 : id + 1 } while (log[id] && id != start);
        if (id == start) throw 'message queue full';
        log[id] = {command: command, args: args, callback: callback, persist: persist};
        peer.postMessage({id: id, command: command, args: args});
      }
    };
    
    return code ? channel : host = channel;
  };
});
