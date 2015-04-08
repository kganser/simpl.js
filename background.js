simpl.use({http: 0, html: 0, database: 0, xhr: 0, string: 0, system: 0, crypto: 0}, function(o, proxy) {

  var server, ping, loader, lines, icons, workspace,
      db = o.database.open('simpl', {sessions: {}}),
      key = new Uint8Array(24),
      encode = o.string.base64FromBuffer;
  
  crypto.getRandomValues(key); // TODO: store in database
  
  var signature = function(value) {
    value = value || '';
    if (typeof value == 'string') value = o.string.base64ToBuffer(value.split('.')[0], true);
    return encode(o.crypto.hmac(key, value), true);
  };
  var token = function() {
    var rand = new Uint8Array(24);
    crypto.getRandomValues(rand);
    return encode(rand, true)+'.'+signature(rand);
  };
  var verify = function(signed) {
    if (typeof signed != 'string') return;
    var parts = signed.split('.');
    return signature(parts[0]) == parts[1] && signed;
  };
  var api = function(path, token, callback, method, data, text) {
    o.xhr('http://api.simpljs.com/'+path, {
      method: method,
      responseType: 'json',
      headers: {Authorization: token ? 'Bearer '+token : null},
      json: text ? undefined : data,
      data: text ? data : undefined
    }, function(e) {
      var t = e.target;
      callback(t.status, t.response);
    });
  };
  var authenticate = function(sid, callback, token) {
    if (token) return api('user', token, function(status, data) {
      callback(status == 200 && {username: data.username, accessToken: token});
    });
    if (!verify(sid)) return callback(null, true);
    db.get('sessions/'+sid).then(callback);
  };
  var gcSessions = function(db) {
    if (Math.random() < .1) {
      db.get('sessions').then(function(sessions) {
        var now = Date.now();
        Object.keys(sessions).forEach(function(sid) {
          if (sessions[sid].expires <= now)
            db.delete('sessions/'+sid);
        });
      });
    }
    return db;
  };
  var restore = function(callback, scope, sparse) {
    if (!scope) {
      var immediate = function(path) { return !path.length; };
      return db.get('apps', false, immediate).get('modules', immediate).then(function(apps, mods) {
        if (apps && mods) return callback();
        restore(callback, apps ? 'modules' : mods ? 'apps' : 'both');
      });
    }
    var apps = {}, mods = {}, pending = 0;
    workspace.forEach(function(item) {
      if (scope != 'both' && scope == 'apps' == !item.file) return;
      pending++;
      o.xhr((item.file ? '/apps/'+item.file : '/modules/'+item.name)+'.js', function(e) {
        var code = e.target.responseText;
        if (item.file) {
          apps[item.name] = {versions: [{
            code: code,
            config: item.config || {},
            dependencies: item.dependencies || {},
            published: []
          }]};
        } else {
          mods[item.name] = {versions: [{
            code: 'function(modules'+(item.proxy ? ', proxy' : '')+') {\n'+code.split(/\n/).slice(1, -1).join('\n')+'\n}',
            dependencies: item.dependencies || {},
            published: []
          }]};
        }
        if (!--pending) {
          var trans = db;
          if (scope != 'modules')
            trans = sparse
              ? Object.keys(apps).reduce(function(t, name) { return t.put('apps/'+encodeURIComponent(name), apps[name]); }, trans)
              : trans.put('apps', apps);
          if (scope != 'apps')
            trans = sparse
              ? Object.keys(mods).reduce(function(t, name) { return t.put('modules/'+encodeURIComponent(name), mods[name]); }, trans)
              : trans.put('modules', mods);
          trans.then(callback);
        }
      });
    });
  };
  
  o.xhr('/simpl.js', function(e) {
    loader = e.target.responseText;
    lines = loader.match(/\n/g).length+1;
  });
  o.xhr('/icons.json', {responseType: 'json'}, function(e) {
    var o = e.target.response;
    icons = Object.keys(o).map(function(name) {
      return {symbol: {id: 'icon-'+name, viewBox: '0 0 20 20', children: {path: {d: o[name]}}}};
    });
  });
  o.xhr('/workspace.json', {responseType: 'json'}, function(e) {
    workspace = e.target.response;
    restore(function() {});
  });
  
  chrome.runtime.onConnect.addListener(function(launcher) {
    launcher.onMessage.addListener(function(command) {
      if (command.action == 'stop') {
        if (server) {
          clearInterval(ping);
          server.disconnect();
          server = port = null;
        }
        return launcher.postMessage({action: 'stop'});
      }
      
      var apps = {}, logs = {}, clients = {};
      var wrap = function(name, code, version, dependencies) {
        return 'simpl.add('+[JSON.stringify(name), code, version, JSON.stringify(dependencies)]+');';
      };
      var broadcast = function(event, data, user) {
        Object.keys(clients).forEach(function(socketId) {
          var client = clients[socketId];
          if (data && client.user != user) return;
          client.socket.send(o.string.toUTF8Buffer((event ? 'data: '+JSON.stringify({event: event, data: data}) : ':ping')+'\n\n').buffer, function(info) {
            if (info.resultCode) delete clients[socketId];
          });
        });
      };
      
      ping = setInterval(broadcast, 15000);
      
      o.http.serve({port: command.port}, function(request, response, socket) {
        
        var match, sid;
        var logout = function(sid) {
          if (sid) return db.delete('sessions/'+sid).then(function() { logout(); });
          response.generic(303, {'Set-Cookie': 'sid=; Expires='+new Date().toUTCString(), Location: '/'});
        };
        var forward = function(path, fallback, callback, method, data, text) {
          authenticate(request.cookie.sid, function(session, local) {
            if (local) return fallback(callback);
            if (!session) return logout(sid);
            api(path, session.accessToken, function(status, data) {
              if (status != 200) return logout(sid); // TODO: handle certain error statuses
              callback(data, {username: session.username, name: session.name, email: session.email});
            }, method, data, text);
          });
        };
        
        if (match = request.path.match(/^\/([^\/]*)\.(\d+)\.js$/))
          return db.get('modules/'+match[1]+'/versions/'+match[2]).then(function(module) {
            if (!module) return response.generic(404);
            response.end(wrap(decodeURIComponent(match[1]), module.code, match[2], module.dependencies), 'js');
          });
        if (/^\/(apps|modules)\/[^\/]*(\/\d+(\/|$)|$)/.test(request.path)) {
          var uri = request.path.substr(1),
              parts = uri.split('/'),
              app = parts[0] == 'apps',
              method = request.method;
          
          parts.splice(2, 0, 'versions');
          var path = parts.join('/');
          
          var create = function(trans, code, config, dependency) {
            var record = {
              code: code || 'function(modules) {\n  \n}',
              dependencies: dependency || {},
              published: []
            };
            if (app) record.config = config;
            return trans.put(parts[0]+'/'+parts[1], {versions: [record]});
          };
          
          if (parts.length < 5 && method == 'POST') {
            var upgrade = parts.length == 3;
            if (upgrade && !/\d+/.test(request.query.source)) return response.error();
            return forward(request.uri.substr(1), function(callback) {
              db.get(upgrade ? path+'/'+request.query.source : path, true).then(function(version) {
                if (!version) return response.error();
                if (Object.keys(version.dependencies).some(function(name) { return version.dependencies[name] < 0; }))
                  return response.error();
                var published = version.published.pop();
                if (published && version.code == published.code &&
                    JSON.stringify(version.config) == JSON.stringify(published.config) &&
                    JSON.stringify(version.dependencies) == JSON.stringify(published.dependencies))
                  return response.error();
                var record = {
                  code: version.code,
                  config: version.config,
                  dependencies: version.dependencies,
                  published: [{
                    code: version.code,
                    config: version.config,
                    dependencies: version.dependencies
                  }]
                };
                if (!app) {
                  delete record.config;
                  delete record.published[0].config;
                }
                return (upgrade
                  ? this.append(path, record)
                  : this.append(path+'/published', record.published[0])
                ).then(callback);
              });
            }, response.ok, method);
          } else if (parts.length == 4) {
            if (method == 'GET')
              return forward(uri, function(callback) {
                db.get(path).then(callback);
              }, function(data) {
                if (!data) return response.generic(404);
                response.end(JSON.stringify(data), 'json');
              });
            if (method == 'PUT')
              return request.slurp(function(code) {
                forward(uri, function(callback) {
                  db.put(path+'/code', code).then(function(error) { // TODO: check If-Match header
                    if (!error) return callback();
                    if (parts[3] != '0') return response.error();
                    create(this, code).then(callback);
                  });
                }, response.ok, method, code, true);
              }, 'utf8', 262144);
            if (method == 'DELETE')
              return forward(uri, function(callback) {
                db.delete(path).then(function() {
                  parts[3] = '0';
                  var empty = true;
                  this.get(parts.join('/'), function() { return empty = false; }).then(function() {
                    if (!empty) return callback();
                    this.delete(parts[0]+'/'+parts[1]).then(callback);
                  });
                });
              }, response.ok, method);
          } else if (parts.length == 5 && parts[4] == 'config') {
            if (method == 'PUT')
              return request.slurp(function(body) {
                if (body === undefined) return response.generic(415);
                forward(uri, function(callback) {
                  if (!app) return response.error();
                  db.put(path, body).then(function(error) {
                    if (!error) return callback();
                    if (parts[3] != '0') return response.error();
                    create(this, null, body).then(callback);
                  });
                }, response.ok, method, body);
              }, 'json');
            if (method == 'DELETE')
              return forward(uri, function(callback) {
                db.delete(path).then(callback);
              }, response.ok, method);
          } else if (parts[4] == 'dependencies') {
            if (method == 'POST' && parts.length == 5)
              return request.slurp(function(body) {
                if (body === undefined) return response.generic(415);
                if (body.name == null || typeof body.version != 'number') return response.error();
                forward(uri, function(callback) {
                  db.put(path+'/'+encodeURIComponent(body.name), body.version).then(function(error) {
                    if (!error) return callback();
                    if (parts[3] != '0') return response.error();
                    var dependency = {};
                    dependency[body.name] = body.version;
                    create(this, null, null, dependency).then(callback);
                  });
                }, response.ok, method, body);
              }, 'json');
            if (method == 'DELETE' && parts.length == 6)
              return forward(uri, function(callback) {
                db.delete(path).then(callback);
              }, response.ok, method);
          }
        }
        if (match = request.path.match(/^(\/servers\/([^\/]+))?\/activity$/)) {
          return authenticate(request.cookie.sid, function(session) {
            if (match = match[2]) {
              if (!session) return response.error();
              var feed = new EventSource('http://api.simpljs.com/servers/'+match+'/activity?access_token='+session.accessToken);
              feed.onmessage = function(e) {
                socket.send(o.string.toUTF8Buffer('data: '+e.data+'\n\n').buffer, function(info) {
                  if (info.resultCode) feed.close();
                });
              };
              feed.onerror = function() {
                feed.close();
                socket.disconnect();
              };
              var data = '';
            } else {
              var user = session ? session.username : '',
                  state = {}, log = [];
              Object.keys(apps).forEach(function(id) {
                var parts = id.split('/').map(decodeURIComponent);
                if (parts[0] == user) {
                  var version = parseInt(parts[2], 10);
                  if (!state[parts[1]]) state[parts[1]] = [version];
                  else state[parts[1]].push(version);
                  log = log.concat(logs[id]);
                }
              });
              var data = 'data: '+JSON.stringify({state: state})+'\n\n'+log.map(function(message) {
                return 'data: '+JSON.stringify({event: 'log', data: message})+'\n\n';
              }).join('');
              clients[socket.socketId] = {user: session && session.username, socket: socket};
            }
            socket.setNoDelay(true);
            response.end(data, {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Content-Length': null
            });
          }, request.query.access_token);
        }
        if (request.path == '/servers')
          return authenticate(request.cookie.sid, function(session) {
            if (!session) return response.generic(404);
            api('servers', session.accessToken, function(status, data) {
              if (!Array.isArray(data)) return response.generic(500);
              response.end(JSON.stringify(data), 'json');
            });
          });
        if (request.path == '/auth')
          return authenticate(sid = request.cookie.sid, function(session) {
            var code = request.query.authorization_code;
            if (!session || !code || signature(sid) != request.query.state) return response.error();
            api('token?authorization_code='+code+'&client_secret='+session.secret, null, function(status, data) {
              if (status != 200) return response.error();
              api('user', code = data.accessToken, function(status, data) {
                if (status != 200) return response.error();
                db.put('sessions/'+sid, {
                  accessToken: code,
                  username: data.username,
                  name: data.name,
                  email: data.email,
                  expires: Date.now()+86400000
                }).then(function() {
                  response.generic(303, {Location: '/'});
                });
              });
            });
          });
        if (request.path == '/login') {
          var secret = request.query.token;
          if (!secret) return response.generic(303, {Location: 'http://simpljs.com/launch'});
          return authenticate(sid = request.cookie.sid, function(session) {
            if (!session) sid = token();
            gcSessions(db).put('sessions/'+sid, {secret: secret, expires: Date.now()+86400000}).then(function() {
              response.generic(303, {
                'Set-Cookie': 'sid='+sid,
                Location: 'http://simpljs.com/authorize?client_id=simpljs&redirect_uri='+encodeURIComponent('http://'+request.headers.Host+'/auth')+'&state='+signature(sid)
              });
            });
          });
        }
        if (request.path == '/logout')
          return logout(verify(request.cookie.sid));
        if (request.path == '/restore' && request.method == 'POST')
          return request.slurp(function(body) {
            var full = body.scope == 'full';
            restore(function() {
              return response.generic(303, {Location: '/'});
            }, full ? 'both' : 'modules', !full);
          }, 'url');
        if (request.path == '/') {
          if (request.method == 'POST')
            return request.slurp(function(body) {
              if (body === undefined) return response.generic(415);
              if (body.app == null || typeof body.version != 'number') return response.error();
              authenticate(request.cookie.sid, function(session, local) {
                if (!local && !session) return response.error();
                var name = body.app,
                    version = body.version,
                    action = body.action;
                if (session && body.server) return api('servers/'+encodeURIComponent(body.server), session.accessToken, function(status) {
                  response.generic(status);
                }, 'POST', {app: name, version: version, action: action});
                var user = session && session.username,
                    id = [user || '', name, version].map(encodeURIComponent).join('/');
                if ((action == 'stop' || action == 'restart') && apps[id]) {
                  apps[id].terminate();
                  broadcast('stop', {app: name, version: version}, user);
                  delete apps[id];
                  if (action == 'stop') return response.ok();
                }
                if ((action == 'run' || action == 'restart') && !apps[id])
                  return function(callback) {
                    if (local) return db.get('apps/'+encodeURIComponent(name)+'/versions/'+version).then(callback);
                    api('apps/'+encodeURIComponent(name)+'/'+version, session.accessToken, function(status, data) {
                      if (status != 200) return response.error();
                      callback(data);
                    });
                  }(function(app) {
                    if (!app) return response.error();
                    logs[id] = [];
                    apps[id] = proxy(null, loader+'var config = '+JSON.stringify(app.config)+';\nsimpl.use('+JSON.stringify(app.dependencies)+','+app.code+');', function(module, callback) {
                      var v = module.version,
                          current = v < 0;
                      if (current) v = -v-1;
                      (function(callback) {
                        if (local) return db.get('modules/'+encodeURIComponent(module.name)+'/versions/'+v).then(callback);
                        api('modules/'+encodeURIComponent(module.name)+'/'+v, session.accessToken, function(status, data) {
                          callback(data);
                        });
                      }(function(record) {
                        if (record && !current) record = record.published.pop();
                        if (record) return callback(wrap(module.name, record.code, module.version, record.dependencies));
                        apps[id].terminate();
                        delete logs[id];
                        delete apps[id];
                        broadcast('error', {app: name, version: version, message: 'Required module not found: '+module.name}, user);
                      }));
                    }, function(level, args, module, line, column) {
                      var data = {app: name, version: version, level: level, message: args, module: module, line: line, column: column};
                      if (logs[id].push(data) > 100) logs[id].unshift();
                      broadcast('log', data, user);
                    }, function(message, module, line) {
                      delete logs[id];
                      delete apps[id];
                      broadcast('error', {app: name, version: version, message: message, module: module, line: line}, user);
                    });
                    broadcast('run', {app: name, version: version}, user);
                    response.ok();
                  });
                response.error();
              }, request.query.access_token);
            }, 'json');
          return forward('workspace', function(callback) {
            db.get('', false, function(path) {
              // apps,modules,sessions/<name>/versions/<#>/code,config,dependencies,published/<#>
              return [
                function(key) { if (key != 'apps' && key != 'modules') return 'skip'; },
                true, true, true,
                function(key) { if (key != 'published') return 'skip'; },
                true
              ][path.length] || false;
            }).then(function(data) {
              Object.keys(data || {}).forEach(function(group) {
                Object.keys(data[group]).forEach(function(name) {
                  (name = data[group][name]).versions = name.versions.map(function(version) {
                    return version.published.length;
                  });
                });
              });
              callback(data, null);
            });
          }, function(data, session) {
            if (!data) return response.generic(500);
            Object.keys(data.apps).forEach(function(name) { data.apps[name] = data.apps[name].versions; });
            Object.keys(data.modules).forEach(function(name) { data.modules[name] = data.modules[name].versions; });
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
                  {svg: {id: 'icons', children: icons}},
                  {script: {src: '/simpl.js'}},
                  {script: {src: '/modules/html.js'}},
                  {script: {src: '/modules/xhr.js'}},
                  {script: {src: '/modules/parser.js'}},
                  {script: {src: '/modules/docs.js'}},
                  {script: {src: '/codemirror.js'}},
                  {script: {src: '/diff_match_patch.js'}},
                  {script: {src: '/jsonv.js'}},
                  {script: {src: '/md5.js'}},
                  {script: {src: '/app.js'}},
                  {script: function(apps, modules, offset, user) {
                    if (!apps) return [data.apps, data.modules, lines, session];
                    simpl.use({app: 0}, function(o) {
                      o.app(apps, modules, offset, user, document.body);
                    });
                  }}
                ]}
              ]}
            ]), 'html');
          });
        }
        o.xhr(request.path, {responseType: 'arraybuffer'}, function(e) {
          if (e.target.status != 200)
            return response.generic(404);
          response.end(e.target.response, (request.path.match(/\.([^.]*)$/) || [])[1]);
        });
      }, function(error, s) {
        if (!error) {
          server = s;
          port = command.port;
        }
        launcher.postMessage({error: error, action: 'start', port: port, path: path});
      });
    });
    
    if (server) launcher.postMessage({action: 'start', port: port, path: path});
  });
  
  chrome.runtime.onSuspend.addListener(function() {
    if (server) {
      clearInterval(ping);
      server.disconnect();
    }
  });
});

var port, path = '', launcher = false;

chrome.app.runtime.onLaunched.addListener(function(source) {
  var token = source && source.url && source.url.substr(26),
      headless = token == 'headless';
  path = token && !headless ? '/login?token='+token : '';
  if (launcher.focus) {
    // TODO: use chrome.browser.openTab() to navigate in existing tab
    if (port) {
      var link = launcher.contentWindow.document.getElementById('link');
      link.setAttribute('href', 'http://localhost:'+port+path);
      return link.click();
    }
    return launcher.focus();
  }
  launcher = true;
  chrome.app.window.create('simpl.html', {
    id: 'simpl',
    resizable: false,
    innerBounds: {width: 300, height: 100}
  }, function(window) {
    (launcher = window).onClosed.addListener(function() {
      launcher = false;
    });
    if (headless) launcher.contentWindow.onload = function(e) {
      e.target.getElementById('action').click();
    };
  });
});
