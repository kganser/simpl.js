kernel.use({http: 0, html: 0, database: 0, xhr: 0, string: 0, async: 0}, function(o, proxy) {

  var apps = {}, kernel;
  
  o.database.get('apps', function(apps) {
    if (apps) return;
    var data = {};
    [ {name: 'My First App', dir: 'my-first-app', config: {port: 8001}},
      {name: 'DB Admin', dir: 'db-admin', config: {port: 8002}},
      {name: 'Simple Login', dir: 'simple-login', config: {port: 8003, sessionKey: 'yabadabadoo'}},
      {name: 'Time Tracker', dir: 'time-tracker', config: {port: 8004, redmineHost: 'redmine.slytrunk.com'}}
    ].forEach(function(app, i, apps) {
      o.xhr('/apps/'+app.dir+'/'+app.dir+'.js', function(e) {
        data[app.name] = {code: e.target.responseText, config: app.config};
        if (Object.keys(data).length == apps.length)
          o.database.put('apps', data, function() {});
      });
    });
  });
  o.database.get('modules', function(modules) {
    if (modules) return;
    var data = {};
    'async crypto database html http socket string xhr'.split(' ').forEach(function(module, i, modules) {
      o.xhr('/modules/'+module+'.js', function(e) {
        data[module] = e.target.responseText;
        if (Object.keys(data).length == modules.length)
          o.database.put('modules', data, function() {});
      });
    });
  });
  
  o.http.serve({port: 8000}, function(request, response) {
    
    if (/^\/(apps|modules)\//.test(request.path)) {
      var path = request.path.substr(1),
          parts = path.split('/'),
          method = request.method,
          handler = function() { response.generic(); };
      
      if (parts.length == 2) {
        if (method == 'DELETE')
          return o.database.delete(path, handler);
        if (method == 'POST')
          return request.slurp(function(body) {
            var code = o.string.fromUTF8Buffer(body);
            return o.database.put(parts[0] == 'apps' ? path+'/code' : path, code, function(error) {
              if (!error) return handler();
              o.database.put(path, {code: code, config: {}}, handler);
            });
          });
      } else if (parts[2] == 'config') {
        handler = function() {
          o.database.get(parts.slice(0, 3).join('/'), function(config) {
            response.end(JSON.stringify(config), {'Content-Type': 'application/json'});
          });
        };
        if (method == 'PUT' || method == 'INSERT')
          return request.slurp(function(body) {
            try {
              o.database.put(path, JSON.parse(o.string.fromUTF8Buffer(body)), method == 'INSERT', handler);
            } catch (e) {
              response.generic(415);
            }
          });
        if (method == 'DELETE')
          return o.database.delete(path, handler);
      }
      
    } else if (request.path == '/') {
    
      if (request.method == 'POST')
        return request.slurp(function(body) {
          try {
            body = JSON.parse(o.string.fromUTF8Buffer(body));
            var name = body.app;
            if (body.action == 'stop' && apps[name]) {
              apps[name].terminate();
              delete apps[name];
              return response.generic();
            }
            if (body.action == 'run' && !apps[name])
              return o.async.join(
                function(callback) {
                  if (kernel) callback(kernel);
                  else o.xhr('/kernel.js', function(e) { callback(kernel = e.target.responseText); });
                },
                function(callback) {
                  o.database.get('apps/'+encodeURIComponent(name), callback);
                },
                function(kernel, app) {
                  if (!app) return response.generic(400);
                  apps[name] = proxy(null, kernel+'var config = '+JSON.stringify(app.config)+';\n'+app.code, function(name, callback) {
                    o.database.get('modules/'+encodeURIComponent(name), callback);
                  }, function(e) {
                    // TODO: communicate module error in UI
                    console.error(e);
                    delete apps[name];
                  });
                  response.generic();
                }
              );
          } catch (e) {
            response.generic(415);
          }
          response.generic(400);
        });
      return o.async.join(
        function(callback) { o.database.get('apps', callback); },
        function(callback) { o.database.get('modules', callback); },
        function(a, m) {
          Object.keys(a).forEach(function(name) { a[name].running = !!apps[name]; });
          response.end(o.html.markup([
            {'!doctype': {html: null}},
            {html: [
              {head: [
                {title: 'Browserver'},
                {meta: {charset: 'utf-8'}},
                {link: {rel: 'shortcut icon', href: '/icon.png'}},
                {link: {rel: 'stylesheet', href: '/codemirror.css'}},
                {link: {rel: 'stylesheet', href: '/jsonv.css'}},
                {link: {rel: 'stylesheet', href: '/browserver.css'}}
              ]},
              {body: [
                {script: {src: '/kernel.js'}},
                {script: {src: '/modules/html.js'}},
                {script: {src: '/modules/xhr.js'}},
                {script: {src: '/jsonv.js'}},
                {script: {src: '/codemirror.js'}},
                {script: function(apps, modules) {
                  if (!apps) return [a, m];
                  Object.keys(modules).forEach(function(name) { modules[name] = {code: modules[name]}; });
                  kernel.use({html: 0, xhr: 0, jsonv: 0}, function(o) {
                    var appList, moduleList, tab, selected, code, config;
                    var entry = function() {
                      if (selected.indexOf('apps'))
                        return modules[decodeURIComponent(selected.substr(8))];
                      return apps[decodeURIComponent(selected.substr(5))];
                    };
                    var handler = function(action, target, item) {
                      return function(e) {
                        e.stopPropagation();
                        var command = action != 'delete' && {action: action, app: target};
                        if (!command && !confirm('Are you sure you want to delete?')) return;
                        this.disabled = true;
                        o.xhr(command ? '/' : '/'+target, {
                          method: command ? 'POST' : 'DELETE',
                          json: command
                        }, function() {
                          if (command) {
                            e.target.disabled = false;
                            item.classList[action == 'run' ? 'add' : 'remove']('running');
                          } else {
                            if (target.indexOf('apps')) delete modules[decodeURIComponent(target.substr(8))];
                            else delete apps[decodeURIComponent(target.substr(5))];
                            item.parentNode.removeChild(item);
                          }
                        });
                      };
                    };
                    var toggle = function(name, elem, app) {
                      if (tab) tab.classList.remove('selected');
                      (tab = elem).classList.add('selected');
                      selected = (app ? 'apps/' : 'modules/')+encodeURIComponent(name);
                      var entry = (app ? apps : modules)[name];
                      code.setValue(entry.code);
                      config.update(entry.config);
                      document.body.className = '';
                      code.refresh();
                    };
                    var li = function(name, app) {
                      var path = (app ? 'apps/' : 'modules/')+encodeURIComponent(name),
                          data = (app ? apps : modules)[name];
                      return {li: function(item) {
                        item.onclick = function(e) {
                          toggle(name, this, app);
                          if (e.target.className == 'config')
                            document.body.className = 'edit-config';
                        };
                        if (data.running)
                          item.classList.add('running');
                        if (!selected || selected == path) {
                          selected = path;
                          (tab = item).classList.add('selected');
                        }
                        // TODO: implement log and docs
                        return [
                          {div: {className: 'controls', children: app ? [
                            {button: {className: 'run', title: 'Run', onclick: handler('run', name, item)}},
                            {button: {className: 'config', title: 'Config'}},
                            {button: {className: 'delete', title: 'Delete', onclick: handler('delete', path, item)}},
                            //{button: {className: 'log', title: 'Log'}},
                            {button: {className: 'stop', title: 'Stop', onclick: handler('stop', name, item)}}
                          ] : [
                            //{button: {className: 'docs', title: 'Docs'}},
                            {button: {className: 'delete', title: 'Delete', onclick: handler('delete', path, item)}}
                          ]}},
                          name
                        ];
                      }};
                    };
                    o.html.dom([
                      {nav: [
                        {h2: 'Apps'},
                        {div: {className: 'form', children: [
                          {input: {type: 'text', placeholder: 'New App'}},
                          {button: {title: 'Add', onclick: function() {
                            var field = this.previousSibling,
                                name = field.value;
                            field.value = '';
                            if (!name || apps[name]) {
                              field.focus();
                              alert(name ? 'App name taken' : 'Please enter app name');
                            } else {
                              apps[name] = {code: '', config: {}};
                              toggle(name, o.html.dom(li(name, true), appList), true);
                            }
                          }}}
                        ]}},
                        {ul: function(e) {
                          appList = e;
                          return Object.keys(apps).map(function(name) {
                            return li(name, true);
                          });
                        }},
                        {h2: 'Modules'},
                        {div: {className: 'form', children: [
                          {input: {type: 'text', placeholder: 'New Module'}},
                          {button: {title: 'Add', onclick: function() {
                            var field = this.previousSibling,
                                name = field.value;
                            field.value = '';
                            if (!name || modules[name]) {
                              field.focus();
                              alert(name ? 'Module name taken' : 'Please enter module name');
                            } else {
                              modules[name] = {code: "kernel.add('"+name.replace(/\\/g, '\\').replace(/'/g, "\\'")+"', function() {\n  \n});\n"};
                              toggle(name, o.html.dom(li(name, false), moduleList), false);
                            }
                          }}}
                        ]}},
                        {ul: function(e) {
                          moduleList = e;
                          return Object.keys(modules).map(function(name) {
                            return li(name, false);
                          });
                        }}
                      ]},
                      {div: {id: 'main', children: function(e) {
                        code = CodeMirror(e, {
                          value: selected ? entry().code : '',
                          lineNumbers: true,
                          matchBrackets: true,
                          highlightSelectionMatches: true
                        });
                        CodeMirror.commands.save = function() {
                          if (!selected) return;
                          o.xhr('/'+selected, {method: 'POST', data: entry().code = code.getValue()});
                        };
                        return {pre: {id: 'config', className: 'json', children: function(e) {
                          config = o.jsonv(selected && entry().config, e, function(method, path, data) {
                            var app = entry();
                            o.xhr('/'+selected+'/config/'+path, {
                              method: method,
                              json: data,
                              responseType: 'json',
                              onload: function(e) {
                                if (e.target.status == 200)
                                  app.config = e.target.response;
                              }
                            });
                          });
                        }}};
                      }}}
                    ], document.body);
                  });
                }}
              ]}
            ]}
          ]), {'Content-Type': 'text/html'});
        }
      );
    }
    
    o.xhr(location.origin+request.path, {responseType: 'arraybuffer'}, function(e) {
      if (e.target.status != 200)
        return response.generic(404);
      response.end(e.target.response, {'Content-Type': o.http.mimeType((request.path.match(/\.([^.]*)$/) || [])[1])});
    });
  });
});
