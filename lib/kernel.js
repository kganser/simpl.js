var kernel = function(modules, clients) {
  var dispatch = function(client) {
    //console.log(client ? 'resolving new client' : 'resolving existing clients');
    for (var i = client ? clients.push(client)-1 : 0; i < clients.length; i++) {
      client = clients[i];
      var needed = Object.keys(client.dependencies),
          available = 0;
      needed.forEach(function(name) {
        var module = modules[name];
        if (!module)
          return modules[name] = true;
        if (module.export)
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
    // TODO: load via database call?
    var pending = Object.keys(modules)
      .filter(function(module) { return modules[module] === true; })
      .map(function(module) { modules[module] = 1; return 'http://localhost:7088/'+encodeURIComponent(module)+'?raw'; });
    if (pending.length && typeof importScripts == 'function') {
      console.log('loading modules', pending);
      importScripts.apply(null, pending);
    }
  };
  return {
    add: function(name, module, dependencies) {
      //console.log('adding module '+name, dependencies);
      if (dependencies) return kernel.use(dependencies, function(o) {
        kernel.add(name, function() { return module(o); });
      }, name);
      if (typeof modules[name] != 'object') {
        modules[name] = {export: module};
        dispatch();
      }
    },
    use: function(modules, callback, name) {
      dispatch({dependencies: modules, callback: callback, name: name});
    },
  };
}({}, []);
