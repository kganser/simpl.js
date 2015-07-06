simpl.use({crypto: 0, database: 0, html: 0, http: 0, string: 0, system: 0, websocket: 0, xhr: 0}, function(o, proxy) {

  var server, loader, lines, icons, workspace,
      db = o.database.open('simpl', {sessions: {}}),
      mac = o.crypto.hmac(crypto.getRandomValues(new Uint8Array(24))), // TODO: store in database
      encode = o.string.base64FromBuffer,
      decode = o.string.base64ToBuffer,
      utf8 = o.string.fromUTF8Buffer,
      apps = {}, logs = {}, clients = {};
  
  var signature = function(value) {
    try {
      if (typeof value == 'string') value = decode(value.split('.')[0], true);
      return encode(mac(value), true);
    } catch (e) {}
  };
  var token = function() {
    var rand = crypto.getRandomValues(new Uint8Array(24));
    return encode(rand, true)+'.'+signature(rand);
  };
  var verify = function(signed) {
    if (typeof signed != 'string') return;
    var parts = signed.split('.');
    return signature(parts[0]) == parts[1] && signed;
  };
  var api = function(path, token, callback, instance, method, data, text) {
    o.xhr('http://api.simpljs.com/'+path, {
      method: method,
      responseType: 'json',
      headers: {Authorization: token ? (instance ? 'Instance ' : 'Bearer ')+token : null},
      json: text ? undefined : data,
      data: text ? data : undefined
    }, function(e) {
      var t = e.target;
      callback(t.status, t.response);
    });
  };
  var authenticate = function(sid, callback) {
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
      var exists = function() { return false; };
      return db.get('apps', false, exists).get('modules', exists).then(function(apps, mods) {
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
  var wrap = function(name, code, version, dependencies) {
    return 'simpl.add('+[JSON.stringify(name), code, version, JSON.stringify(dependencies)]+');';
  };
  var broadcast = function(event, data, user) {
    Object.keys(clients).forEach(function(socketId) {
      var client = clients[socketId];
      if (client.user != user) return;
      client.connection.send(JSON.stringify({event: event, data: data}), function(info) {
        if (info.error) delete clients[socketId];
      });
    });
  };
  var state = function(user, client) {
    var state = {}, log = [];
    Object.keys(apps).forEach(function(id) {
      var parts = id.split('/').map(decodeURIComponent);
      if (parts[0] == user) {
        var app = parts[1],
            version = parseInt(parts[2], 10);
        if (!state[app]) state[app] = [version];
        else state[app].push(version);
        log = log.concat(logs[id]);
      }
    });
    client.send(JSON.stringify({event: 'state', data: state}));
    log.forEach(function(log) {
      client.send(JSON.stringify({event: 'log', data: log}));
    });
  };
  var run = function(user, name, version, token, instance) { // TODO: use instance token
    var id = [user, name, version].map(encodeURIComponent).join('/');
    if (apps[id]) return;
    (function(callback) {
      var path = 'apps/'+encodeURIComponent(name);
      if (!token) return db.get(path+'/versions/'+(version-1)).then(callback);
      api(path+'/'+version, token, function(status, data) {
        callback(status == 200 && data);
      }, instance);
    }(function(app) {
      if (!app) return broadcast('error', {app: name, version: version, message: 'App not found'}, user);
      logs[id] = [];
      apps[id] = proxy(null, loader+'var config = '+JSON.stringify(app.config)+';\nsimpl.use('+JSON.stringify(app.dependencies)+','+app.code+');', function(module, callback) {
        var path = 'modules/'+encodeURIComponent(module.name),
            v = module.version,
            current = v < 1;
        if (current) v = 1-v;
        (function(callback) {
          if (!token) return db.get(path+'/versions/'+(v-1)).then(callback);
          api(path+'/'+v, token, function(status, data) {
            callback(status == 200 && data);
          }, instance);
        }(function(record) {
          if (record && !current) record = record.published.pop();
          if (record) return callback(wrap(module.name, record.code, module.version, record.dependencies));
          apps[id].terminate();
          delete logs[id];
          delete apps[id];
          broadcast('error', {app: name, version: version, message: 'Required module not found: '+module.name}, user);
        }));
      }, function(level, args, module, line, column) {
        var data = {app: name, version: version, level: level, message: args, module: module, line: module ? line : line > lines ? line-lines : undefined, column: column};
        if (logs[id].push(data) > 100) logs[id].unshift();
        broadcast('log', data, user);
      }, function(message, module, line) {
        delete logs[id];
        delete apps[id];
        broadcast('error', {app: name, version: version, message: message, module: module, line: module ? line : line > lines ? line-lines : undefined}, user);
      });
      broadcast('run', {app: name, version: version}, user);
    }));
  };
  var stop = function(user, name, version) {
    var id = [user, name, version].map(encodeURIComponent).join('/');
    if (!apps[id]) return;
    apps[id].terminate();
    broadcast('stop', {app: name, version: version}, user);
    delete apps[id];
  };
  var shutdown = function() {
    if (!server) return;
    server.disconnect();
    server = port = null;
    if (typeof ws == 'object') ws.close();
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
  
  chrome.runtime.onSuspend.addListener(shutdown);
  
  chrome.runtime.onConnect.addListener(function(launcher) {
    launcher.onMessage.addListener(function(command) {
      if (command.action == 'stop') {
        shutdown();
        return launcher.postMessage({action: 'stop'});
      }
      
      o.http.serve({port: command.port}, function(request, response) {
        
        var match, sid;
        var logout = function() {
          response.generic(303, {'Set-Cookie': 'sid=; Expires='+new Date().toUTCString(), Location: '/'});
        };
        var forward = function(path, fallback, callback, method, data, text) {
          sid = path == 'workspace' ? request.cookie.sid : request.query.sid;
          authenticate(sid, function(session, local) {
            if (local) return fallback(callback);
            if (!session) return logout();
            api(path, session.access_token, function(status, data) {
              if (status != 200) return logout(); // TODO: handle certain error statuses
              callback(data, {username: session.username, name: session.name, email: session.email});
            }, false, method, data, text);
          });
        };
        
        if (match = request.path.match(/^\/([^\/]+)\.(\d+)(\.current)?\.js$/))
          return db.get('modules/'+match[1]+'/versions/'+(match[2]-1)).then(function(module) {
            if (module && !match[3]) module = module.published.pop();
            if (module) return response.end(wrap(decodeURIComponent(match[1]), module.code, match[2], module.dependencies), 'js');
            response.generic(404);
          });
        if (/^\/(apps|modules)\/[^\/]+(\/\d+(\/|$)|$)/.test(request.path)) {
          var uri = request.path.substr(1),
              parts = uri.split('/'),
              app = parts[0] == 'apps',
              method = request.method;
          
          if (parts.length > 2) parts[2]--;
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
            if (upgrade && !/^\d+$/.test(request.query.source)) return response.error();
            return forward(request.uri.substr(1), function(callback) {
              db.get(upgrade ? path+'/'+(request.query.source-1) : path, true).then(function(version) {
                if (!version) return response.error();
                if (Object.keys(version.dependencies).some(function(name) { return version.dependencies[name] < 1; }))
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
                    if (parts[3]) return response.error();
                    create(this, code).then(callback);
                  });
                }, response.ok, method, code, true);
              }, 'utf8', 262144);
            if (method == 'DELETE') // TODO: use unversioned path
              return forward(uri, function(callback) {
                db.delete(path).then(function() {
                  parts[3] = 0;
                  this.get(parts.join('/'), function() { return false; }).then(function(exists) {
                    if (exists) return callback();
                    this.delete(parts[0]+'/'+parts[1]).then(callback);
                  });
                });
              }, response.ok, method);
          } else if (parts[4] == 'config' && method == 'PUT') {
            return request.slurp(function(body) {
              if (body === undefined) return response.generic(415);
              forward(uri, function(callback) {
                if (!app) return response.error();
                db.put(path, body).then(function(error) {
                  if (!error) return callback();
                  if (parts[3]) return response.error();
                  create(this, null, body).then(callback);
                });
              }, response.ok, method, body);
            }, 'json');
          } else if (parts[4] == 'dependencies') {
            if (method == 'POST' && parts.length == 5)
              return request.slurp(function(body) {
                if (body === undefined) return response.generic(415);
                if (body.name == null || typeof body.version != 'number') return response.error();
                forward(uri, function(callback) {
                  db.put(path+'/'+encodeURIComponent(body.name), body.version).then(function(error) {
                    if (!error) return callback();
                    if (parts[3]) return response.error();
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
        if (request.path == '/auth')
          return authenticate(sid = request.cookie.sid, function(session) {
            var code = request.query.authorization_code;
            if (!session || !code || signature(sid) != request.query.state) return response.end(code ? session ? 'Bad state in request' : 'No session' : 'No authorization code', null, 400);
            api('token?authorization_code='+code+'&client_secret='+session.secret, null, function(status, data) {
              if (status != 200) return response.end('Could not get access token', null, 502);
              api('user', code = data.access_token, function(status, data) {
                if (status != 200) return response.end('Could not get user info', null, 502);
                db.put('sessions/'+sid, {
                  secret: session.secret,
                  access_token: code,
                  username: data.username,
                  name: data.name,
                  email: data.email,
                  expires: Date.now()+86400000
                }).then(function() {
                  response.generic(303, {Location: session.redirect});
                });
              });
            });
          });
        if (request.path == '/login') {
          var secret = request.query.token,
              redirect = request.query.redirect || '/';
          if (!secret) return response.generic(303, {Location: 'http://simpljs.com/launch'});
          return authenticate(sid = request.cookie.sid, function(session) {
            if (!session) sid = token();
            else if (session.secret == secret) return response.generic(303, {Location: redirect});
            gcSessions(db).put('sessions/'+sid, {
              secret: secret,
              redirect: redirect,
              expires: Date.now()+86400000
            }).then(function() {
              response.generic(303, {
                'Set-Cookie': 'sid='+sid,
                Location: 'http://simpljs.com/authorize?client_id=simpljs&redirect_uri='+encodeURIComponent('http://'+request.headers.Host+'/auth')+'&state='+signature(sid)
              });
            });
          });
        }
        if (request.path == '/logout')
          return logout();
        if (request.path == '/restore' && request.method == 'POST')
          return request.slurp(function(body) {
            var full = body.scope == 'full';
            restore(function() {
              return response.generic(303, {Location: '/'});
            }, full ? 'both' : 'modules', !full);
          }, 'url');
        if (request.path == '/connect')
          return authenticate(request.query.sid, function(session, local) {
            if (!session && !local) return response.generic(401);
            var socketId = response.socket.socketId,
                user = session ? session.username : '',
                token = session && session.access_token;
            o.websocket.accept(request, response, function(client) {
              clients[socketId] = {user: user, connection: client};
              if (session) {
                var ws = new WebSocket('ws://api.simpljs.com/connect?access_token='+token);
                ws.onmessage = function(e) {
                  if (typeof e.data == 'string')
                    client.send(e.data);
                };
                ws.onclose = function() {
                  client.close(1001);
                  delete clients[socketId];
                };
              }
              return function(data) {
                try { var message = JSON.parse(data); } catch (e) { return; }
                var instance = message.instance,
                    command = message.command;
                if (instance) return session && ws.send(data);
                if (command == 'connect')
                  return state(user, client);
                if (command == 'stop' || command == 'restart')
                  stop(user, message.app, message.version);
                if (command == 'run' || command == 'restart')
                  run(user, message.app, message.version, token);
              };
            });
          });
        if (/^\/((apps|modules)\/[^\/]+\/\d+\/(code|settings|log|docs))?$/.test(request.path))
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
            if (session) session.image = 'http://www.gravatar.com/avatar/'+o.string.hexFromBuffer(o.crypto.md5(o.string.toUTF8Buffer(session.email.toLowerCase())));
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
                  {script: {src: '/app.js'}},
                  {script: function(apps, modules, user, token) {
                    if (!apps) return [data.apps, data.modules, session, sid || null];
                    simpl.use({app: 0}, function(o) {
                      o.app(apps, modules, user, token, document.body);
                    });
                  }}
                ]}
              ]}
            ]), 'html');
          });
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
        path = '';
      });
    });
    
    if (server) {
      launcher.postMessage({action: 'start', port: port, path: path});
      path = '';
    }
  });
  
  var ws, port, path = '', launcher = false;

  chrome.app.runtime.onLaunched.addListener(function(source) {
    var args = ((source || {}).url || '').match(/^http:\/\/simpljs.com\/launch-([^\/]+)(.*)/),
        headless = args && args[1] == 'headless';
    path = args && !headless ? '/login?token='+args[1]+'&redirect='+args[2] : '';
    if (launcher.focus) {
      // TODO: use chrome.browser.openTab() to navigate in existing tab
      if (!port) return launcher.focus();
      var link = launcher.contentWindow.document.getElementById('link');
      link.setAttribute('href', 'http://localhost:'+port+path);
      link.click();
      link.setAttribute('href', 'http://localhost:'+port);
      return path = '';
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
        if (ws) return;
        ws = true;
        o.xhr('http://169.254.169.254/latest/user-data', function(e) {
          try {
            var key = JSON.parse(utf8(decode(e.target.responseText.trim()))).key,
                user = decodeURIComponent(utf8(decode(key.split('.')[0], true)).split('/')[0]);
          } catch (e) { return; }
          var connections, client, retries = 0;
          var connect = function() {
            ws = new WebSocket('ws://api.simpljs.com/connect?key='+key);
            ws.onopen = function() {
              connections = 0;
              client = {user: user, connection: ws};
            };
            ws.onmessage = function(e) {
              try { var message = JSON.parse(e.data); } catch (e) { return; }
              var command = message.command;
              if (command == 'connect') {
                if (!connections++)
                  clients[-1] = client;
                return state(user, ws);
              }
              if (command == 'disconnect') {
                if (!--connections)
                  delete clients[-1];
                return;
              }
              if (command == 'stop' || command == 'restart')
                stop(user, message.app, message.version);
              if (command == 'run' || command == 'restart')
                run(user, message.app, message.version, key, true);
            };
            ws.onclose = function() {
              delete clients[-1];
              if (!server) return ws = null;
              if (retries < 6) retries++;
              setTimeout(connect, (1 << retries) * 1000);
            };
          };
          connect();
        });
      };
    });
  });
});
