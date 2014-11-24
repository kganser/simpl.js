simpl.use({http: 0, html: 0, database: 0, xhr: 0, string: 0}, function(o, proxy) {

  var server, ping, loader, lines,
      db = o.database.open('simpl', {});
  
  db.get('apps').then(function(apps) {
    if (apps) return;
    var data = {};
    [ {name: '1 Hello World', file: 'hello-world', config: {}},
      {name: '2 Web Server', file: 'web-server', config: {port: 8001}},
      {name: '3 Database Editor', file: 'database-editor', config: {port: 8002, database: 'simpl'}},
      {name: '4 Simple Login', file: 'simple-login', config: {port: 8003, sessionKey: 'yabadabadoo'}},
      {name: '5 Unit Tests', file: 'unit-tests', config: {}},
      {name: '6 Time Tracker', file: 'time-tracker', config: {port: 8004, redmineHost: 'redmine.slytrunk.com'}}
    ].forEach(function(app, i, apps) {
      o.xhr('/apps/'+app.file+'.js', function(e) {
        data[app.name] = {code: e.target.responseText, config: app.config};
        if (Object.keys(data).length == apps.length)
          db.put('apps', data);
      });
    });
  });
  db.get('modules').then(function(modules) {
    if (modules) return;
    var data = {};
    'async crypto database docs html http parser socket string xhr'.split(' ').forEach(function(module, i, modules) {
      o.xhr('/modules/'+module+'.js', function(e) {
        data[module] = e.target.responseText;
        if (Object.keys(data).length == modules.length)
          db.put('modules', data);
      });
    });
  });
  o.xhr('/simpl.js', function(e) {
    loader = e.target.responseText;
    lines = loader.match(/\n/g).length+1;
  });
  
  chrome.runtime.onConnect.addListener(function(port) {
    port.onMessage.addListener(function(command) {
      if (command.action == 'stop') {
        if (server) {
          clearInterval(ping);
          server.disconnect();
          server = null;
        }
        return port.postMessage({action: 'stop'});
      }
      
      var apps = {}, clients = [], broadcast = function(event, data) {
        clients.forEach(function(client) {
          client.send((event ? 'data: '+JSON.stringify({event: event, data: data}) : ': ping')+'\r\n\r\n', null, null, function(info) {
            if (info.resultCode) clients.splice(clients.indexOf(client), 1);
          });
        });
      };
      
      ping = setInterval(broadcast, 15000); // TODO: use TCP keep-alive
      
      o.http.serve({port: command.port}, function(request, response) {
        
        if (/^\/(apps|modules)\//.test(request.path)) {
          var path = request.path.substr(1),
              parts = path.split('/'),
              method = request.method;
          
          if (parts.length == 2) {
            if (method == 'GET')
              return db.get(path).then(function(code) {
                if (code === undefined) return response.generic(404);
                response.end(code, {'Content-Type': o.http.mimeType('js')});
              });
            if (method == 'DELETE')
              return db.delete(path).then(function() {
                broadcast('delete', {app: parts[0] == 'apps', name: decodeURIComponent(parts[1])});
                response.ok();
              });
            if (method == 'POST')
              return request.slurp(function(code) {
                db.put(parts[0] == 'apps' ? path+'/code' : path, code).then(function(error) {
                  if (!error) return response.ok();
                  this.put(path, {code: code, config: {}}).then(response.ok);
                });
              }, 'utf8', 65536);
          } else if (parts[2] == 'config') {
            var handler = function() {
              this.get(parts.slice(0, 3).join('/')).then(function(config) {
                response.end(JSON.stringify(config), {'Content-Type': o.http.mimeType('json')});
              });
            };
            if (method == 'PUT' || method == 'INSERT')
              return request.slurp(function(body) {
                if (body === undefined) return response.generic(415);
                db.put(path, body, method == 'INSERT').then(handler);
              }, 'json');
            if (method == 'DELETE')
              return db.delete(path).then(handler);
          }
        }
        if (request.path == '/activity') {
          clients.push(response);
          return response.send(': ping', {
            'Content-Type': 'text/event-stream',
            'Transfer-Encoding': null
          });
        }
        if (request.path == '/') {
          if (request.method == 'POST')
            return request.slurp(function(body) {
              if (body === undefined) return response.generic(415);
              var name = body.app,
                  action = body.action;
              if ((action == 'stop' || action == 'restart') && apps[name]) {
                apps[name].terminate();
                broadcast('stop', {app: name});
                delete apps[name];
                if (action == 'stop') return response.ok();
              }
              if ((action == 'run' || action == 'restart') && !apps[name])
                return db.get('apps/'+encodeURIComponent(name)).then(function(app) {
                  if (!app) return response.error();
                  apps[name] = proxy(null, loader+'var config = '+JSON.stringify(app.config)+';\n'+app.code, function(name, callback) {
                    db.get('modules/'+encodeURIComponent(name)).then(callback);
                  }, function(level, args, module, line, column) {
                    broadcast('log', {app: name, level: level, message: args, module: module, line: line, column: column});
                  }, function(message, module, line) {
                    broadcast('error', {app: name, message: message, module: module, line: line});
                    delete apps[name];
                  });
                  broadcast('run', {app: name});
                  response.ok();
                });
              response.error();
            }, 'json');
          return db.get('apps').get('modules').then(function(a, m) {
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
                  {link: {rel: 'stylesheet', href: '/simpl.css'}}
                ]},
                {body: [
                  {script: {src: '/simpl.js'}},
                  {script: {src: '/html.js'}},
                  {script: {src: '/xhr.js'}},
                  {script: {src: '/jsonv.js'}},
                  {script: {src: '/parser.js'}},
                  {script: {src: '/docs.js'}},
                  {script: {src: '/codemirror.js'}},
                  {script: function(apps, modules, offset) {
                    if (!apps) return [a, m, lines];
                    Object.keys(apps).forEach(function(name) { apps[name].log = []; });
                    Object.keys(modules).forEach(function(name) { modules[name] = {code: modules[name]}; });
                    simpl.use({html: 0, xhr: 0, jsonv: 0, docs: 0}, function(o) {
                      var appList, moduleList, selected, code, config, log, docs, line, status;
                      if (window.EventSource) new EventSource('/activity').onmessage = function(e) {
                        var message = JSON.parse(e.data),
                            event = message.event,
                            data = message.data;
                        switch (event) {
                          case 'log':
                            var app = apps[data.app];
                            if (!app) return;
                            if (app.log.push(message = {
                              level: data.level == 'log' ? 'debug' : data.level,
                              message: data.message,
                              module: data.module || '',
                              line: data.line && data.line > offset ? data.module ? data.line : data.line-offset : null
                            }) > 1000) app.log.shift();
                            if (selected && selected.entry == app) {
                              var body = document.body,
                                  scroll = body.classList.contains('show-log') && body.scrollHeight - body.scrollTop == document.documentElement.clientHeight;
                              o.html.dom(logLine(message), log);
                              if (scroll) body.scrollTop = body.scrollHeight;
                            }
                            break;
                          case 'run':
                          case 'stop':
                          case 'error':
                            var app = apps[data.app];
                            if (!app) return;
                            app.running = event == 'run';
                            app.tab.classList[event == 'run' ? 'add' : 'remove']('running');
                            app.tab.classList[event == 'error' ? 'add' : 'remove']('error');
                            if (event == 'run') {
                              app.log = [];
                              if (selected && selected.entry == app)
                                log.textContent = '';
                            } else if (event == 'error') {
                              app.log.push(message = {
                                level: 'error',
                                message: [data.message],
                                module: data.module || '',
                                line: data.line && data.line > offset ? data.module ? data.line : data.line-offset : null
                              });
                              if (selected && selected.entry == app)
                                o.html.dom(logLine(message), log);
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
                      var logLine = function(entry) {
                        var string = entry.message.join(', '),
                            message = [], link;
                        while (link = /\b(https?|ftp):\/\/\S+\b/.exec(string)) {
                          var url = link[0];
                          if (link.index) message.push(string.substr(0, link.index));
                          message.push({a: {href: url, target: '_blank', children: url}});
                          string = string.substr(link.index+url.length);
                        }
                        if (string) message.push(string);
                        return {div: {className: 'entry '+entry.level, children: [
                          {div: {className: 'location', children: entry.line && entry.module+':'+entry.line}},
                          {div: {className: 'message', children: message}}
                        ]}};
                      };
                      var doc = function(name, code) {
                        o.html.dom([{h1: name}, o.docs.generate(code).map(function(block) {
                          return [
                            {pre: block.spec
                              ? {className: 'spec', children: o.docs.stringifySpec(block.spec)}
                              : {className: 'spec error', children: block.error.toString()}},
                            block.text.map(function(text) {
                              return text.pre ? text : {p: text};
                            })
                          ];
                        })], docs, true);
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
                            if (!command || !entry) return;
                            entry.running = action != 'stop';
                            entry.tab.classList[entry.running ? 'add' : 'remove']('running');
                            if (entry.running) {
                              entry.log = [];
                              if (selected && selected.entry == entry) {
                                log.textContent = '';
                                toggle(name, true, 'log');
                              }
                            }
                          });
                        };
                      };
                      var toggle = function(name, app, panel, ln, ch) {
                        if (!selected || selected.name != name || selected.app != app) {
                          if (selected) {
                            selected.entry.tab.classList.remove('selected');
                            selected.entry.code = code.getValue();
                          }
                          selected = line = null;
                          var entry = (app ? apps : modules)[name];
                          code.setValue(entry.code);
                          config.update(entry.config);
                          if (app) o.html.dom(entry.log.map(logLine), log, true);
                          else doc(name, entry.code);
                          entry.tab.classList.add('selected');
                          selected = {name: name, app: app, entry: entry};
                        }
                        if (!panel) panel = app ? selected.entry.running ? 'log' : 'code' : 'docs';
                        var next = {config: selected.entry.running ? 'log' : 'code', code: app ? 'config' : 'docs', log: 'code', docs: 'code'}[panel],
                            body = document.body;
                        body.className = body.classList.contains('collapsed') ? 'collapsed show-'+panel : 'show-'+panel;
                        body.scrollTop = panel == 'log' ? body.scrollHeight : 0;
                        selected.entry.view.className = 'view '+next;
                        selected.entry.view.title = 'Show '+next[0].toUpperCase()+next.slice(1);
                        if (line) code.removeLineClass(line, 'background', 'current');
                        if (panel == 'code') {
                          code.refresh();
                          if (ln != null) {
                            line = code.addLineClass(ln-1, 'background', 'current');
                            code.scrollIntoView({line: ln, ch: ch});
                          }
                        }
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
                                toggle(name, false, 'code');
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
                          code.on('changes', function() {
                            if (!selected) return;
                            selected.entry.dirty = true;
                            selected.entry.tab.classList.add('changed');
                          });
                          CodeMirror.commands.save = function() {
                            if (!selected || !selected.entry.dirty) return;
                            var current = selected;
                            status('info', 'Saving...');
                            o.xhr((selected.app ? '/apps/' : '/modules/')+encodeURIComponent(selected.name), {
                              method: 'POST',
                              data: selected.entry.code = code.getValue()
                            }, function(e, ok) {
                              var ok = e.target.status == 200;
                              if (ok && selected == current) {
                                selected.entry.tab.classList.remove('changed');
                                doc(selected.name, selected.entry.code);
                              }
                              status(ok ? 'success' : 'failure', ok ? 'Saved' : 'Error');
                            });
                          };
                          return [
                            {pre: {id: 'config', className: 'json', children: function(e) {
                              config = o.jsonv(selected && selected.entry.config, e, function(method, path, data) {
                                var app = selected.entry;
                                status('info', 'Saving...');
                                o.xhr('/apps/'+encodeURIComponent(selected.name)+'/config/'+path, {
                                  method: method,
                                  json: data,
                                  responseType: 'json'
                                }, function(e, ok) {
                                  if (ok = e.target.status == 200)
                                    app.config = e.target.response;
                                  status(ok ? 'success' : 'failure', ok ? 'Saved' : 'Error');
                                });
                              });
                            }}},
                            {pre: {id: 'log', children: function(e) { log = e; }, onclick: function(e) {
                              if (e.target.className == 'location') {
                                var ref = e.target.textContent.split(':');
                                toggle(ref[0] || selected.name, !ref[0], 'code', ref[1], 0);
                              }
                            }}},
                            {div: {id: 'docs', children: function(e) { docs = e; }}},
                            {div: {id: 'status', children: function(e) {
                              var i = 0; clear = function() {
                                if (!--i) e.style.display = 'none';
                              };
                              status = function(type, text) {
                                e.style.display = 'block';
                                e.className = type;
                                e.textContent = text;
                                setTimeout(clear, 2000);
                                i++;
                              };
                            }}}
                          ];
                        }}}
                      ], document.body);
                    });
                  }}
                ]}
              ]}
            ]), {'Content-Type': o.http.mimeType('html')});
          });
        }
        if (/^\/(html|xhr|parser|docs)\.js$/.test(request.path))
          request.path = '/modules'+request.path;
        o.xhr(location.origin+request.path, {responseType: 'arraybuffer'}, function(e) {
          if (e.target.status != 200)
            return response.generic(404);
          response.end(e.target.response, {'Content-Type': o.http.mimeType((request.path.match(/\.([^.]*)$/) || [])[1])});
        });
      }, function(error, s) {
        port.postMessage({error: error, action: 'start', port: command.port});
      });
    });
  });
  
  chrome.runtime.onSuspend.addListener(function() {
    if (server) {
      clearInterval(ping);
      server.disconnect();
    }
  });
});

chrome.app.runtime.onLaunched.addListener(function() {
  chrome.app.window.create('simpl.html', {id: 'simpl', innerBounds: {height: 100, width: 300}, resizable: false});
});
