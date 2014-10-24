kernel.add('loader', function(o) {
  var load = function(module) {
    o.database.get('modules/'+encodeURIComponent(module), function(code) {
      if (code) eval(code);
    });
  };
  return {
    add: function(name, module, dependencies) {
      kernel.add(name, module, dependencies).forEach(load);
    },
    use: function(modules, callback, name) {
      kernel.use(modules, callback, name).forEach(load);
    }
  }
}, {database: 0});
