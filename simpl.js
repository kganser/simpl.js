var simpl = function(modules, clients, self) {
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
        needed.forEach(function(name) {
          var module = available[name];
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
  return self = {
    add: function(name, module, version, dependencies) {
      return self.use(dependencies || {}, function(o) {
        if (!modules[name]) modules[name] = {};
        if (!modules[name][version = parseInt(version, 10) || 0]) {
          modules[name][version] = {export: function() { return module(o); }};
          return dispatch();
        }
      });
    },
    use: function(modules, callback) {
      return dispatch({dependencies: modules, callback: callback});
    }
  };
}({}, []);
