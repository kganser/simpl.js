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
          handler = function() { response.end('Success'); };
      
      if (parts.length == 2) {
        if (method == 'DELETE')
          return o.database.delete(path, handler);
        if (method == 'POST') {
          // TODO: validate encoding
          var code = o.string.fromUTF8Buffer(request.body);
          return o.database.put(parts[0] == 'apps' ? path+'/code' : path, code, function(error) {
            if (!error) return handler();
            o.database.put(path, {code: code, config: {}}, handler);
          });
        }
      } else if (parts[2] == 'config') {
        handler = function() {
          o.database.get(parts.slice(0, 3).join('/'), function(config) {
            response.end(JSON.stringify(config), {'Content-Type': 'application/json'});
          });
        }
        if (method == 'POST')
          return o.database.append(path, request.json, handler);
        if (method == 'PUT' || method == 'INSERT')
          return o.database.put(path, request.json, method == 'INSERT', handler);
        if (method == 'DELETE')
          return o.database.delete(path, handler);
      }
      
    } else if (request.path == '/') {
    
      if (request.method == 'POST' && request.post && request.post.app) {
        var name = request.post.app;
        if (request.post.action == 'stop' && apps[name]) {
          apps[name].terminate();
          delete apps[name];
          return response.end('Stopped');
        }
        if (request.post.action == 'run' && !apps[name])
          return o.async.join(
            function(callback) {
              if (kernel) return callback(kernel);
              o.xhr('/kernel.js', function(e) { callback(kernel = e.target.responseText); });
            },
            function(callback) {
              o.database.get('apps/'+encodeURIComponent(name), callback);
            },
            function(kernel, app) {
              apps[name] = proxy(null, kernel+'var config = '+JSON.stringify(app.config)+';\n'+app.code, function(name, callback) {
                o.database.get('modules/'+encodeURIComponent(name), callback);
              }, function(e) {
                // TODO: communicate module error in UI
                console.error(e);
                delete apps[name];
              });
              response.end('Started');
            }
          );
        return response.end('Invalid Request', null, 400);
      }
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
                    var handler = function(action, app, item) {
                      return function(e) {
                        e.stopPropagation();
                        var del = action == 'delete';
                        if (del && !confirm('Are you sure you want to delete?')) return;
                        this.disabled = true;
                        o.xhr(del ? '/'+app : '/', {
                          method: del ? 'DELETE' : 'POST',
                          headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                          data: 'action='+action+'&app='+app
                        }, function() {
                          if (del) {
                            if (app.indexOf('apps')) delete modules[decodeURIComponent(app.substr(8))];
                            else delete apps[decodeURIComponent(app.substr(5))];
                            return item.parentNode.removeChild(item);
                          }
                          e.target.disabled = false;
                          item.classList[action == 'run' ? 'add' : 'remove']('running');
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
                      var encoded = encodeURIComponent(name),
                          path = (app ? 'apps/' : 'modules/')+encoded,
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
                            {button: {className: 'run', title: 'Run', onclick: handler('run', encoded, item)}},
                            {button: {className: 'config', title: 'Config'}},
                            {button: {className: 'delete', title: 'Delete', onclick: handler('delete', path, item)}},
                            //{button: {className: 'log', title: 'Log'}},
                            {button: {className: 'stop', title: 'Stop', onclick: handler('stop', encoded, item)}}
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
                              headers: {'Content-Type': 'application/json'},
                              data: JSON.stringify(data),
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
        return response.end('404 Resource not found', null, 404);
      response.end(e.target.response, {'Content-Type': o.http.mimeType((request.path.match(/\.([^.]*)$/) || [])[1])});
    });
  });
});
