simpl.use({http: 0, html: 0, database: 0, xhr: 0, string: 0, async: 0}, function(o, proxy) {

  var apps = {}, clients = [], simpl;
  
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
  
  var broadcast = function(event, data) {
    clients.forEach(function(client) {
      client.send((event ? 'data: '+JSON.stringify({event: event, data: data}) : ': ping')+'\r\n\r\n', null, null, function(info) {
        if (info.resultCode) clients.splice(clients.indexOf(client), 1);
      });
    });
  };
  
  setInterval(function() { broadcast(); }, 60000);
  
  o.http.serve({port: 8000}, function(request, response) {
    
    if (/^\/(apps|modules)\//.test(request.path)) {
      var path = request.path.substr(1),
          parts = path.split('/'),
          method = request.method;
      
      if (parts.length == 2) {
        if (method == 'GET')
          return o.database.get(path, function(code) {
            if (code === undefined) return response.generic(404);
            response.end(code, {'Content-Type': o.http.mimeType('js')});
          });
        if (method == 'DELETE')
          return o.database.delete(path, function() {
            broadcast('delete', {app: parts[0] == 'apps', name: decodeURIComponent(parts[1])});
            response.generic();
          });
        if (method == 'POST')
          return request.slurp(function(body) {
            var code = o.string.fromUTF8Buffer(body);
            return o.database.put(parts[0] == 'apps' ? path+'/code' : path, code, function(error) {
              if (!error) return response.generic();
              o.database.put(path, {code: code, config: {}}, function() { response.generic(); });
            });
          });
      } else if (parts[2] == 'config') {
        var handler = function() {
          o.database.get(parts.slice(0, 3).join('/'), function(config) {
            response.end(JSON.stringify(config), {'Content-Type': o.http.mimeType('json')});
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
    }
    if (request.path == '/activity') {
      clients.push(response);
      return response.send(': ping', {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache'
      });
    }
    if (request.path == '/') {
      if (request.method == 'POST')
        return request.slurp(function(body) {
          try {
            body = JSON.parse(o.string.fromUTF8Buffer(body));
            var name = body.app,
                action = body.action;
            if ((action == 'stop' || action == 'restart') && apps[name]) {
              apps[name].terminate();
              broadcast('stop', {app: name});
              delete apps[name];
              if (action == 'stop') return response.generic();
            }
            if ((action == 'run' || action == 'restart') && !apps[name])
              return o.async.join(
                function(callback) {
                  if (simpl) callback(simpl);
                  else o.xhr('/kernel.js', function(e) { callback(simpl = e.target.responseText); });
                },
                function(callback) {
                  o.database.get('apps/'+encodeURIComponent(name), callback);
                },
                function(simpl, app) {
                  if (!app) return response.generic(400);
                  apps[name] = proxy(null, simpl+'var config = '+JSON.stringify(app.config)+';\n'+app.code, function(name, callback) {
                    o.database.get('modules/'+encodeURIComponent(name), callback);
                  }, function(level, args) {
                    broadcast('log', {app: name, level: level, message: args});
                  }, function(e) {
                    broadcast('error', {app: name, message: e.message});
                    delete apps[name];
                  });
                  broadcast('run', {app: name});
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
                {title: 'Simpl.js'},
                {meta: {charset: 'utf-8'}},
                {meta: {name: 'viewport', content: 'width=device-width, initial-scale=1.0, user-scalable=no'}},
                {link: {rel: 'stylesheet', href: '/codemirror.css'}},
                {link: {rel: 'stylesheet', href: '/jsonv.css'}},
                {link: {rel: 'stylesheet', href: '/browserver.css'}}
              ]},
              {body: [
                {script: {src: '/kernel.js'}},
                {script: {src: '/html.js'}},
                {script: {src: '/xhr.js'}},
                {script: {src: '/jsonv.js'}},
                {script: {src: '/codemirror.js'}},
                {script: function(apps, modules) {
                  if (!apps) return [a, m];
                  Object.keys(apps).forEach(function(name) { apps[name].log = []; });
                  Object.keys(modules).forEach(function(name) { modules[name] = {code: modules[name]}; });
                  simpl.use({html: 0, xhr: 0, jsonv: 0}, function(o) {
                    var appList, moduleList, selected, code, config, log, docs;
                    if (window.EventSource) new EventSource('/activity').onmessage = function(e) {
                      var message = JSON.parse(e.data),
                          event = message.event,
                          data = message.data;
                      switch (event) {
                        case 'log':
                          var app = apps[data.app],
                              line = data.message,
                              body = document.body;
                          if (!app) return;
                          if (app.log.push(line) > 1000)
                            app.log.shift();
                          if (selected && selected.entry == app) {
                            var scroll = body.classList.contains('show-log') && body.scrollHeight - body.scrollTop == document.documentElement.clientHeight;
                            log.innerHTML += line.map(html).join(', ')+'\n';
                            if (scroll) body.scrollTop = body.scrollHeight;
                          }
                          break;
                        case 'run':
                        case 'stop':
                        case 'error':
                          var app = apps[data.app];
                          if (!app) return;
                          app.tab.classList[event == 'run' ? 'add' : 'remove']('running');
                          if (event == 'run') {
                            if (selected && selected.entry == app) log.innerHTML = '';
                            app.log = [];
                          }
                          break;
                        case 'delete':
                          var entries = data.app ? apps : modules;
                              entry = entries[data.name];
                          if (!entry) return;
                          if (selected && selected.entry == entry) selected = null;
                          delete entries[data.name];
                          entry.tab.parentNode.removeChild(entry.tab);
                          break;
                      }
                    };
                    var html = function(str) {
                      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\b(https?:\/\/[^\s]+)\b/, '<a href="$1" target="_blank">$1</a>');
                    };
                    var handler = function(action, name, app, entry) {
                      return function(e) {
                        e.stopPropagation();
                        var command = action != 'delete' && {action: action, app: name};
                        if (!command && !confirm('Are you sure you want to delete?')) return;
                        this.disabled = true;
                        o.xhr(command ? '/' : (app ? '/apps/' : '/modules/')+encodeURIComponent(name), {
                          method: command ? 'POST' : 'DELETE',
                          json: command
                        }, function() {
                          e.target.disabled = false;
                          var entry = (app ? apps : modules)[name];
                          if (!entry || action != 'run' && action != 'stop') return;
                          entry.running = action == 'run';
                          entry.tab.classList[action == 'run' ? 'add' : 'remove']('running');
                          if (action == 'run') {
                            entry.log = [];
                            if (selected && selected.entry == entry) {
                              log.innerHTML = '';
                              toggle(name, true, 'log');
                            }
                          }
                        });
                      };
                    };
                    var toggle = function(name, app, panel) {
                      if (!selected || selected.name != name || selected.app != app) {
                        if (selected) selected.entry.tab.classList.remove('selected');
                        selected = {name: name, app: app, entry: (app ? apps : modules)[name]};
                        code.setValue(selected.entry.code);
                        config.update(selected.entry.config);
                        if (app) log.innerHTML = selected.entry.log.map(function(line) { return line.map(html).join(', ')+'\n'; }).join('');
                        else o.html.dom([{h1: name}, {p: 'documentation goes here'}], docs, true);
                        selected.entry.tab.classList.add('selected');
                      }
                      if (!panel) panel = app ? selected.entry.running ? 'log' : 'code' : 'docs';
                      var next = {config: selected.entry.running ? 'log' : 'code', code: app ? 'config' : 'docs', log: 'code', docs: 'code'}[panel];
                      document.body.className = document.body.classList.contains('collapsed') ? 'collapsed show-'+panel : 'show-'+panel;
                      selected.entry.view.className = 'view '+next;
                      selected.entry.view.title = 'Show '+next[0].toUpperCase()+next.slice(1);
                      if (panel == 'log') document.body.scrollTop = document.body.scrollHeight;
                      code.refresh();
                    };
                    var li = function(name, app) {
                      var path = (app ? 'apps/' : 'modules/')+encodeURIComponent(name),
                          entry = (app ? apps : modules)[name];
                      return {li: function(elem) {
                        entry.tab = elem;
                        elem.onclick = function(e) {
                          toggle(name, app, (e.target == entry.view) && e.target.className.replace(/\s*view\s*/, ''));
                        };
                        if (entry.running)
                          elem.classList.add('running');
                        return [
                          {div: {className: 'controls', children: [
                            {button: {className: 'view', children: function(e) { entry.view = e; }}},
                            app && [
                              {button: {className: 'run', title: 'Run', onclick: handler('run', name, app)}},
                              {button: {className: 'restart', title: 'Restart', onclick: handler('restart', name, app)}},
                              {button: {className: 'stop', title: 'Stop', onclick: handler('stop', name, app)}}
                            ],
                            {button: {className: 'delete', title: 'Delete', onclick: handler('delete', name, app)}}
                          ]}},
                          {span: name}
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
                              apps[name] = {code: '', config: {}, log: []};
                              o.html.dom(li(name, true), appList);
                              toggle(name, true);
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
                              modules[name] = {code: "simpl.add('"+name.replace(/\\/g, '\\').replace(/'/g, "\\'")+"', function() {\n  \n});\n"};
                              o.html.dom(li(name, false), moduleList);
                              toggle(name, false);
                            }
                          }}}
                        ]}},
                        {ul: function(e) {
                          moduleList = e;
                          return Object.keys(modules).map(function(name) {
                            return li(name, false);
                          });
                        }},
                        {button: {className: 'toggle', onclick: function() {
                          document.body.classList.toggle('collapsed');
                          code.refresh();
                        }}}
                      ]},
                      {div: {id: 'main', children: function(e) {
                        code = CodeMirror(e, {
                          value: selected ? selected.entry.code : '',
                          lineNumbers: true,
                          matchBrackets: true,
                          highlightSelectionMatches: true
                        });
                        CodeMirror.commands.save = function() {
                          if (!selected) return;
                          o.xhr((selected.app ? '/apps/' : '/modules/')+encodeURIComponent(selected.name), {
                            method: 'POST',
                            data: selected.entry.code = code.getValue()
                          });
                        };
                        return [
                          {pre: {id: 'config', className: 'json', children: function(e) {
                            config = o.jsonv(selected && selected.entry.config, e, function(method, path, data) {
                              var app = selected.entry;
                              o.xhr('/apps/'+encodeURIComponent(selected.name)+'/config/'+path, {
                                method: method,
                                json: data,
                                responseType: 'json'
                              }, function(e) {
                                if (e.target.status == 200)
                                  app.config = e.target.response;
                              });
                            });
                          }}},
                          {pre: {id: 'log', children: function(e) { log = e; }}},
                          {div: {id: 'docs', children: function(e) { docs = e; }}}
                        ];
                      }}}
                    ], document.body);
                  });
                }}
              ]}
            ]}
          ]), {'Content-Type': o.http.mimeType('html')});
        }
      );
    }
    if (request.path == '/html.js') request.path = '/modules/html.js';
    if (request.path == '/xhr.js') request.path = '/modules/xhr.js';
    o.xhr(location.origin+request.path, {responseType: 'arraybuffer'}, function(e) {
      if (e.target.status != 200)
        return response.generic(404);
      response.end(e.target.response, {'Content-Type': o.http.mimeType((request.path.match(/\.([^.]*)$/) || [])[1])});
    });
  });
});
