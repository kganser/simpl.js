simpl.use({crypto: 0, database: 0, html: 0, http: 0, string: 0, system: 0, websocket: 0}, function(o, proxy) {

  var server, loader, lines, icons, workspace,
      db = o.database.open('simpl'),
      encode = o.string.base64FromBuffer,
      decode = o.string.base64ToBuffer,
      utf8 = o.string.fromUTF8Buffer,
      apiHost = 'api.simpljs.com',
      apps = {}, logs = {}, clients = {}, sessions = {},
      csrf, ping, localApiPort, debug;

  var api = function(path, token, callback, method, data, text) {
    // serve session from cache
    if (path == 'user' && sessions[token]) return callback(sessions[token]);
    fetch(localApiPort ? 'http://localhost:'+localApiPort+'/'+path : 'https://'+apiHost+'/'+path, {
      method: method,
      headers: token ? {Authorization: 'Bearer '+token} : undefined,
      body: text ? data : JSON.stringify(data)
    }).then(function(response) {
      var status = response.status,
          error = response.ok ? false : (status ? o.http.statusMessage(status) : 'Connection failed');
      response.json().then(function(body) {
        if (!body) body = {};
        if (!body.error && error) body.error = error;
        // refresh session cache
        if (path == 'user' && !body.error) {
          var now = Date.now();
          Object.keys(sessions).forEach(function(token) {
            if (sessions[token].expires < now) delete sessions[token];
          });
          body.expires = now + 86400000; // TODO: use expires_in from runtime.onMessageExternal?
          body.image = '//www.gravatar.com/avatar/'+o.string.hexFromBuffer(
            o.crypto.md5(o.string.toUTF8Buffer((body.email || '').toLowerCase())))+'?d=retro';
          sessions[token] = body;
        }
        callback(body, status);
      }, function() {
        callback({error: error || 'Server error'}, status);
      });
    }).catch(function(e) {
      callback({error: e.toString()}, 0);
    });
  };
  var authenticate = function(token, callback) {
    if (token == csrf) return callback(null, true);
    if (!token) return callback();
    api('user', token, function(body) {
      callback(body);
    });
  };
  var restore = function(callback, scope, sparse) {
    if (!scope)
      return db.get('apps', false, 'shallow').get('modules', 'shallow').then(function(apps, mods) {
        if (apps && mods) return callback();
        restore(callback, apps ? 'modules' : mods ? 'apps' : 'both');
      });
    var data = {apps: {}, mods: {}}, pending = 0;
    workspace.forEach(function(item) {
      if (scope != 'both' && scope == 'apps' == !item.file) return;
      pending++;
      fetch((item.file ? '/apps/'+item.file : '/modules/'+item.name)+'.js').then(function(r) { return r.text(); }).then(function(code) {
        if (item.file) {
          data.apps[item.name] = {versions: [{
            code: code,
            config: item.config || {},
            dependencies: item.dependencies || {},
            published: []
          }]};
        } else {
          data.mods[item.name] = {versions: [{
            code: 'function(modules'+(item.proxy ? ', proxy' : '')+') {\n'+code.trim().split(/\n/).slice(1, -1).join('\n')+'\n}',
            dependencies: item.dependencies || {},
            published: []
          }]};
        }
        if (!--pending) {
          var trans = db;
          if (scope != 'modules') {
            Object.keys(apps).forEach(function(id) { stop.apply(null, id.split('@')); });
            trans = sparse
              ? Object.keys(data.apps).reduce(function(t, name) { return t.put('apps/'+encodeURIComponent(name), data.apps[name]); }, trans)
              : trans.put('apps', data.apps);
          }
          if (scope != 'apps')
            trans = sparse
              ? Object.keys(data.mods).reduce(function(t, name) { return t.put('modules/'+encodeURIComponent(name), data.mods[name]); }, trans)
              : trans.put('modules', data.mods);
          trans.then(callback);
        }
      });
    });
  };
  var wrap = function(name, code, version, dependencies) {
    return 'simpl.add('+[JSON.stringify(name), code, version, JSON.stringify(dependencies)]+');';
  };
  var send = function(client, event, data) {
    client.send(JSON.stringify({event: event, data: data}), function(info) {
      if (info.error) delete clients[client.socket.socketId];
    });
  };
  var broadcast = function(event, data, user) {
    if (debug) console.log(event+' '+JSON.stringify(data));
    Object.keys(clients).forEach(function(socketId) {
      var client = clients[socketId];
      if (client.user == user) send(client.connection, event, data);
    });
  };
  var state = function(user, client) {
    send(client, 'state', Object.keys(apps).reduce(function(apps, id) {
      var i = id.indexOf('@');
      if (id.substr(0, i) == user) apps.push(id.substr(i+1));
      return apps;
    }, []));
    Object.keys(logs).forEach(function(id) {
      if (id.split('@', 1)[0] == user) logs[id].forEach(function(e) {
        send(client, e.fatal ? 'error' : 'log', e.fatal ? e.fatal : e);
      });
    });
  };
  var run = function(user, name, version, token) {
    var id = [user, name, version].join('@');
    if (apps[id]) return;
    (function(callback) {
      var path = 'apps/'+encodeURIComponent(name);
      if (!token) return db.get(path+'/versions/'+(version-1)).then(callback);
      api(path+'/'+version, token, callback);
    }(function(app) {
      if (!app || app.error) return broadcast('error', {app: name, version: version, message: app.error || 'App not found'}, user);
      logs[id] = [];
      apps[id] = proxy(null, [
        loader+'var config = '+JSON.stringify(app.config),
        'simpl.user='+JSON.stringify(user),
        'simpl.use('+JSON.stringify(app.dependencies)+','+app.code+','+JSON.stringify(name.split('@')[1])+');'
      ].join(';'), function(module, callback) {
        var path = 'modules/'+encodeURIComponent(module.name),
            v = module.version,
            current = v < 1;
        if (current) v = 1-v;
        (function(callback) {
          if (!token) return db.get(path+'/versions/'+(v-1)).then(callback);
          api(path+'/'+v, token, callback);
        }(function(record) {
          var error = !record ? 'Module '+module.name+' not found'
            : record.error && 'Module '+module.name+': '+record.error;
          if (!error) {
            if (!current) record = record.published.pop();
            if (record) return callback(wrap(module.name, record.code, module.version, record.dependencies));
          }
          if (!apps[id]) return;
          apps[id].terminate();
          delete apps[id];
          var data = {app: name, version: version, message: 'Required module not found: '+module.name};
          logs[id].push({fatal: data});
          broadcast('error', data, user);
        }));
      }, function(level, args, module, line, column) {
        var data = {app: name, version: version, level: level, message: args, module: module, line: module ? line : line > lines ? line-lines : undefined, column: column};
        if (logs[id].push(data) > 100) logs[id].shift();
        broadcast('log', data, user);
      }, function(message, module, line) {
        delete apps[id];
        var data = {app: name, version: version, message: message, module: module, line: module ? line : line > lines ? line-lines : undefined};
        logs[id].push({fatal: data});
        broadcast('error', data, user);
      });
      broadcast('run', {app: name, version: version}, user);
    }));
  };
  var stop = function(user, name, version) {
    var id = [user, name, version].join('@');
    if (!apps[id]) return id;
    apps[id].terminate();
    broadcast('stop', {app: name, version: version}, user);
    delete apps[id];
    return id;
  };
  var shutdown = function() {
    if (!server) return;
    server.disconnect();
    clients = {};
    server = port = null;
    clearInterval(ping);
  };
  
  Promise.all(['/simpl.js', '/loader.js'].map(function(file) {
    return fetch(file).then(function(r) { return r.text(); });
  })).then(function(values) {
    loader = values.join('');
    lines = loader.match(/\n/g).length;
  });
  fetch('/icons.json').then(function(r) { return r.json(); }).then(function(r) {
    icons = Object.keys(r).map(function(name) {
      return {symbol: {id: 'icon-'+name, viewBox: '0 0 20 20', children: {path: {d: r[name]}}}};
    });
  });
  fetch('/workspace.json').then(function(r) { return r.json(); }).then(function(r) {
    workspace = r;
    restore(function() {});
  });
  
  chrome.runtime.onMessageExternal.addListener(function(message, sender, reply) {
    message = message || {};
    var token = message.token,
        socket = ((message.redirect_uri || '').match(/^wss?:\/\/(\d+)$/) || [])[1],
        client = socket && clients[socket];
    var callback = function(data) {
      // TODO: background.js must be running on same browser as app.js (check state?)
      if (client) send(client.connection, 'login', data);
      reply(data.error ? data : {status: 'success'});
    };
    if (!token) return callback({error: 'Unable to authenticate'});
    return !api('user', token, function(response) {
      if (socket) client = clients[socket];
      if (response.error) return callback({error: response.error});
      callback({username: response.username, token: token});
      if (client) client.connect(response.plan, token);
    });
  });
  
  chrome.runtime.onSuspend.addListener(shutdown);
  
  chrome.runtime.onConnect.addListener(function(launcher) {
    launcher.onMessage.addListener(function(command) {
      if (command.action == 'stop') {
        shutdown();
        return launcher.postMessage({action: 'stop'});
      }
      
      csrf = encode(crypto.getRandomValues(new Uint8Array(24)), true);
      o.http.serve({port: command.port}, function(request, response) {
        
        var match;
        var forward = function(path, fallback, callback, method, data, text) {
          var token = request.query.token || request.cookie.token;
          authenticate(token, function(session, local) {
            if (local || !session && !method) return fallback(callback);
            if (!session) return response.generic(401);
            api(path, token, function(body, status) {
              if (body.error) return path == 'workspace'
                ? response.generic(302, {'Set-Cookie': 'token=; Expires='+new Date().toUTCString(), Location: '/'})
                : response.end(JSON.stringify(body), 'json', status);
              callback(body, session);
            }, method, data, text);
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
              name = decodeURIComponent(parts[1]),
              method = request.method;
          
          if (parts.length > 2) parts[2]--;
          parts.splice(2, 0, 'versions');
          if (parts.length == 5 && parts[4] >= 0) parts.splice(4, 0, 'published');
          var path = parts.join('/');
          
          // publish app/module
          if (parts.length < 5 && method == 'POST') {
            var upgrade = parts.length == 3,
                source = request.query.source;
            if (upgrade && !/^\d+$/.test(source)) return response.error();
            return forward(request.uri.substr(1), function(callback) {
              db.get(upgrade ? path+'/'+(source-1) : path, true).then(function(version) {
                if (!version) return response.error();
                if (Object.keys(version.dependencies).some(function(name) { return version.dependencies[name] < 1; }))
                  return response.error();
                var published = version.published.pop();
                if (!published && upgrade ||
                    published && version.code == published.code &&
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
                  }],
                  source: {
                    major: +source,
                    minor: version.published.length-1
                  }
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
            }, function(data, session) {
              if (app) delete logs[stop(session && session.username || '', name, parts[3]+1)];
              response.ok();
            }, method);
          }
          // get app/module
          if ((parts.length == 4 || parts.length == 6 && parts[5] >= 0) && method == 'GET')
            return forward(uri, function(callback) {
              db.get(path).then(function(data) {
                // TODO: change to {code, dependencies, config?, published: {minor, code, dependencies, config?}}
                if (data && data.published) data.published.slice(0, -1).forEach(function(version) {
                  version.code = version.dependencies = version.config = undefined;
                });
                callback(data);
              });
            }, function(data) {
              if (!data) return response.generic(404);
              response.end(JSON.stringify(data), 'json');
            });
          // save code
          if (parts.length == 4 && method == 'PUT')
            return request.slurp(function(code) {
              forward(uri, function(callback) {
                db.put(path+'/code', code).then(function(error) { // TODO: check If-Match header
                  if (!error) return callback();
                  if (parts[3]) return response.error();
                  var record = {code: code, dependencies: {}, published: []};
                  if (app) record.config = {};
                  this.put(parts[0]+'/'+parts[1], {versions: [record]}).then(callback);
                });
              }, response.ok, method, code, true);
            }, 'utf8', 1048576);
          // delete app/module
          if (parts.length == 3 && method == 'DELETE')
            return forward(uri, function(callback) {
              db.delete(uri).then(callback);
            }, function(data, session) {
              if (app) delete logs[stop(session && session.username || '', name, 1)];
              response.ok();
            }, method);
          // update config
          if (parts[4] == 'config' && method == 'PUT')
            return request.slurp(function(body) {
              if (body === undefined) return response.error();
              forward(uri, function(callback) {
                if (!app) return response.error();
                db.put(path, body).then(callback);
              }, response.ok, method, body);
            }, 'json');
          // update dependencies
          if (parts[4] == 'dependencies') {
            if (method == 'POST' && parts.length == 5)
              return request.slurp(function(body) {
                if (!body || !body.name || typeof body.version != 'number') return response.error();
                forward(uri, function(callback) {
                  db.put(path+'/'+encodeURIComponent(body.name), body.version).then(callback);
                }, response.ok, method, body);
              }, 'json');
            if (method == 'DELETE' && parts.length == 6)
              return forward(uri, function(callback) {
                db.delete(path).then(callback);
              }, response.ok, method);
          }
        }
        if (request.path == '/login') {
          var secret = request.query.state,
              socket = request.query.socket;
          if (secret) {
            if (secret != request.cookie.state) return response.end('Invalid state parameter', null, 403);
            var error = request.query.error_description || request.query.error,
                token = request.query.access_token;
            if (error || !token) return response.end(error || 'Missing access_token parameter', null, 400);
            return response.generic(303, {
              'Set-Cookie': 'token='+token+'; Path=/',
              Location: request.cookie.redirect || '/'
            });
          }
          secret = encode(crypto.getRandomValues(new Uint8Array(24)), true);
          // TODO: store secret in client object
          // TODO: if client is not on same browser as BE, use http redirect
          return response.generic(303, {
            'Set-Cookie': [
              'state='+secret+'; Path=/',
              'redirect='+encodeURIComponent(request.query.redirect || '/')+'; Path=/'
            ],
            Location: 'https://simpljs.com/authorize?client_id=simpljs&redirect_uri='+encodeURIComponent(
              clients[socket] ? 'ws://'+socket : 'http://'+request.headers.Host+'/login')+'&state='+secret
          });
        }
        if (request.path == '/logout') {
          delete sessions[request.cookie.token];
          return response.generic(302, {
            'Set-Cookie': 'token=; Expires='+new Date().toUTCString(),
            Location: '/'
          });
        }
        if (request.path == '/token')
          return response.end(csrf);
        if (request.path == '/restore' && request.method == 'POST')
          return request.slurp(function(body) {
            if (body.token != csrf) return response.generic(401);
            var full = body.scope == 'full';
            restore(function() {
              return response.generic(303, {Location: '/'});
            }, full ? 'both' : 'modules', !full);
          }, 'url');
        if (request.path == '/action' && request.method == 'POST')
          return request.slurp(function(body) {
            var token = body && body.token;
            authenticate(token, function(session, local) {
              var command = body.command,
                  user = session ? session.username : '';
              if (!token || session && session.error) return response.generic(401);
              if (command == 'stop' || command == 'restart')
                stop(user, body.app, body.version);
              if (command == 'run' || command == 'restart')
                run(user, body.app, body.version, !local && token);
              response.generic(200);
            });
          }, 'json');
        if (request.path == '/online')
          return fetch('https://'+apiHost, {method: 'head'}).then(function(r) {
            response.generic(r.ok ? 200 : 502);
          });
        if (request.path == '/connect')
          return authenticate(request.query.token, function(session) {
            var socketId = response.socket.socketId,
                user = session ? session.username : '';
            if (session && session.error) return response.generic(401);
            o.websocket.accept(request, response, function(client) {
              var self = clients[socketId] = {
                user: user,
                connection: client,
                connect: function(plan, token) {
                  self.token = token;
                  if (self.remote || plan != 'pro') return;
                  self.remote = new WebSocket('wss://'+apiHost+'/connect?access_token='+token);
                  self.remote.onmessage = function(e) {
                    if (typeof e.data == 'string' && e.data != 'ping')
                      client.send(e.data);
                  };
                  self.remote.onclose = function(e) {
                    send(client, 'expire', {refresh: e.code != 4001});
                    self.remote = null;
                  };
                }
              };
              send(client, 'connect', {token: request.query.token, id: socketId});
              if (session) self.connect(session.plan, request.query.token);
              client.socket.onDisconnect = function() {
                if (self.remote) self.remote.close();
                delete clients[socketId];
              };
              return function(data) {
                try { var message = JSON.parse(data); } catch (e) { return; }
                var instance = message.instance,
                    command = message.command;
                if (instance) return self.remote && self.remote.send(data);
                if (command == 'connect')
                  return state(user, client);
                if (command == 'stop' || command == 'restart')
                  stop(user, message.app, message.version);
                if (command == 'run' || command == 'restart')
                  run(user, message.app, message.version, self.token);
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
                  {script: {src: '/modules/parser.js'}},
                  {script: {src: '/modules/docs.js'}},
                  {script: {src: '/modules/diff.js'}},
                  {script: {src: '/codemirror.js'}},
                  {script: {src: '/jsonv.js'}},
                  {script: {src: '/app.js'}},
                  {script: function(apps, modules, user, token) {
                    if (!apps) return [data.apps, data.modules, session, request.cookie.token || csrf];
                    simpl.use({app: 0}, function(o) {
                      o.app(apps, modules, user, token, document.body);
                    });
                  }}
                ]}
              ]}
            ]), 'html');
          });
        fetch(request.path).then(function(r) {
          if (!r.ok) return response.generic(404);
          r.arrayBuffer().then(function(body) {
            response.end(body, (request.path.match(/\.([^.]*)$/) || [])[1]);
          });
        }).catch(function() {
          response.generic(404);
        });
      }, function(error, s) {
        if (!error) {
          server = s;
          port = command.port;
          ping = setInterval(function() {
            Object.keys(clients).forEach(function(id) {
              clients[id].connection.send('ping');
            });
          }, 30000);
        }
        console.log('Simpl.js server - port '+command.port+' - '+(error ? error : 'running'));
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
    console.log('Simpl.js launched', source);
    var url = (source.url || '').match(/^https:\/\/simpljs\.com\/launch(\/.*)?/);
    var onLauncher = function(callback, loaded) {
      return function(x, fn) {
        if (fn && loaded) fn();
        else if (fn) callback = fn;
        else if (callback) callback();
        else loaded = true;
      };
    }();
    var launch = function(args) {
      if (!args) args = {};
      var token = args.token,
          user = args.user,
          port = Math.max(+args.port, 0),
          app = args.app && args.app.split('@'), // name@version
          connections, client, retries = 0;
      console.log('Simpl.js: launch '+JSON.stringify(args));
      debug = 'debug' in args;
      if (port && !server) onLauncher(null, function() {
        var doc = launcher.contentWindow.document;
        doc.getElementById('port').value = port;
        doc.launcher.onsubmit();
      });
      if (app) run('', app[0], +app[1] || 1);
      if (token && user) {
        localApiPort = +args.localApiPort;
        (function connect() {
          console.log('Simpl.js: attempting headless connection '+retries);
          ws = new WebSocket((localApiPort ? 'ws://localhost:'+localApiPort : 'wss://'+apiHost)+'/connect?access_token='+token);
          ws.onopen = function() {
            console.log('Simpl.js: headless connection opened');
            connections = retries = 0;
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
              run(user, message.app, message.version, token);
          };
          ws.onclose = function() {
            console.log('Simpl.js: headless connection closed');
            delete clients[-1];
            if (retries < 6) setTimeout(connect, (1 << retries++) * 1000);
            else if (localApiPort) setTimeout(connect, 64000);
            else console.log('Simpl.js: headless connection failed');
          };
        }());
      }
    };
    if (source.source != 'file_handler' && source.source != 'load_and_launch') {
      path = url ? '/login?redirect='+encodeURIComponent(url[1] || '') : '';
      if (launcher.focus) {
        if (!server) return launcher.focus();
        chrome.browser.openTab({url: 'http://localhost:'+port+path});
        return path = '';
      }
    } else if (!ws && typeof require == 'function') {
      ws = true;
      launch(require('nw.gui').App.argv.reduce(function(args, flag) {
        flag = flag.split('=');
        args[flag[0].replace(/^--?/, '')] = flag[1] || flag[1] == null;
        return args;
      }, {}));
    }
    launcher = true;
    chrome.app.window.create('simpl.html', {
      id: 'simpl',
      resizable: false,
      innerBounds: {width: 300, height: 100}
    }, function(window) {
      launcher = window;
      launcher.contentWindow.onload = onLauncher;
      launcher.onClosed.addListener(function() {
        launcher = false;
      });
    });
  });
});
