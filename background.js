simpl.use({http: 0, html: 0, database: 0, xhr: 0, string: 0, net: 0, crypto: 0}, function(o, proxy) {

  var server, ping, loader, lines,
      db = o.database.open('simpl', {sessions: {}}),
      api = 'http://127.0.0.1:8005/',
      key = o.crypto.codec.utf8String.toBits(o.crypto.random.randomWords(6, 0)),
      fromBits = o.crypto.codec.base64.fromBits,
      toBits = o.crypto.codec.base64.toBits;
  
  var token = function() {
    var rand = o.crypto.random.randomWords(6, 0);
    return fromBits(rand, true, true)+'.'+fromBits(new o.crypto.misc.hmac(key).mac(rand), true, true);
  };
  var verify = function(signed) {
    try {
      var parts = signed.split('.');
      return fromBits(new o.crypto.misc.hmac(key).mac(toBits(parts[0], true)), true, true) == parts[1] && signed;
    } catch (e) {}
  };
  var authenticate = function(sid, callback) {
    if (!verify(sid)) return callback(null, true);
    db.get('sessions/'+sid).then(callback);
  };
  
  db.get('apps').then(function(data) {
    if (data) return;
    data = {};
    [ {name: '1 Hello World', file: 'hello-world'},
      {name: '2 Web Server', file: 'web-server', config: {port: 8001}, dependencies: {http: 0}},
      {name: '3 Database Editor', file: 'database-editor', config: {port: 8002, database: 'simpl'}, dependencies: {database: 0, html: 0, http: 0, xhr: 0}},
      {name: '4 Simple Login', file: 'simple-login', config: {port: 8003, sessionKey: 'yabadabadoo'}, dependencies: {crypto: 0, database: 0, html: 0, http: 0}},
      {name: '5 Unit Tests', file: 'unit-tests', dependencies: {async: 0, database: 0, docs: 0, html: 0, http: 0, parser: 0, string: 0, xhr: 0}},
      {name: 'Time Tracker', file: 'time-tracker', config: {port: 8004, redmineHost: 'redmine.slytrunk.com'}, dependencies: {http: 0, database: 0, html: 0, xhr: 0}},
      {name: 'Simpl.js Server', file: 'simpljs-server', config: {port: 8005, sessionKey: 'abracadabra'}, dependencies: {crypto: 0, database: 0, html: 0, http: 0, xhr: 0}}
    ].forEach(function(app, i, apps) {
      o.xhr('/apps/'+app.file+'.js', function(e) {
        data[app.name] = {versions: [{
          code: e.target.responseText,
          config: app.config || {},
          dependencies: app.dependencies || {},
          published: []
        }]};
        if (Object.keys(data).length == apps.length)
          db.put('apps', data);
      });
    });
  });
  db.get('modules').then(function(data) {
    if (data) return;
    data = {};
    [ {name: 'async'},
      {name: 'crypto'},
      {name: 'database'},
      {name: 'docs', dependencies: {parser: 0}},
      {name: 'html'},
      {name: 'http', dependencies: {socket: 0, string: 0}},
      {name: 'net', proxy: true},
      {name: 'parser'},
      {name: 'socket', proxy: true},
      {name: 'string'},
      {name: 'xhr'}
    ].forEach(function(module, i, modules) {
      o.xhr('/modules/'+module.name+'.js', function(e) {
        data[module.name] = {versions: [{
          code: 'function(modules'+(module.proxy ? ', proxy' : '')+') {\n'+e.target.responseText.split(/\n/).slice(1, -1).join('\n')+'\n}',
          dependencies: module.dependencies || {},
          published: []
        }]};
        if (Object.keys(data).length == modules.length)
          db.put('modules', data);
      });
    });
  });
  o.xhr('/simpl.js', function(e) {
    loader = e.target.responseText;
    lines = loader.match(/\n/g).length+1;
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
      
      var apps = {}, clients = {};
      var wrap = function(name, code, version, dependencies) {
        return 'simpl.add('+[JSON.stringify(name), code, version, JSON.stringify(dependencies)]+');';
      };
      var broadcast = function(event, data, user) {
        Object.keys(clients).forEach(function(socketId) {
          var client = clients[socketId];
          if (client.user != user && client != null) return;
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
        var forward = function(path, fallback, callback, method, body, text) {
          authenticate(request.cookie.sid, function(session, inactive) {
            if (inactive) return fallback(callback);
            if (!session) return logout(sid);
            o.xhr(api+'v1/'+path+(~path.indexOf('?') ? '&' : '?')+'access_token='+session.accessToken, {
              method: method,
              responseType: 'json',
              json: text ? undefined : body,
              data: text ? body : undefined
            }, function(e) {
              if (e.target.status != 200) return logout(sid); // TODO: handle certain error statuses
              callback(e.target.response, {username: session.username, name: session.name, email: session.email});
            });
          });
        };
        
        if (match = request.path.match(/^\/([^.\/]*)\.(\d+)\.js$/))
          return db.get('modules/'+match[1]+'/versions/'+match[2]).then(function(module) {
            response.end(wrap(decodeURIComponent(match[1]), module.code, match[2], module.dependencies), 'js');
          });
        if (/^\/(apps|modules)\/[^\/]*(\/\d+(\/|$)|$)/.test(request.path)) {
          var uri = request.path.substr(1),
              parts = uri.split('/'),
              app = parts[0] == 'apps',
              method = request.method;
          
          parts.splice(2, 0, 'versions');
          path = parts.join('/');
          
          if (parts.length < 5 && method == 'POST') {
            var upgrade = parts.length == 3;
            if (upgrade && !request.query.version) return response.error();
            return forward(request.uri.substr(1), function(callback) {
              db.get(upgrade ? path+'/'+request.query.version : path, true).then(function(version) {
                if (!version) return response.error();
                var published = version.published.pop();
                if (published && version.code == published.code &&
                    JSON.stringify(version.config) == JSON.stringify(published.config) &&
                    JSON.stringify(version.dependencies) == JSON.stringify(published.dependencies))
                  return response.generic(412);
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
                    this.get(path).then(function(existing) {
                      if (existing) return response.error();
                      this.put(parts[0]+'/'+parts[1], {versions: [app
                        ? {code: code, config: {}, dependencies: {}, published: []}
                        : {code: code, dependencies: {}, published: []}
                      ]}).then(callback);
                    });
                  });
                }, response.ok, method, code, true);
              }, 'utf8', 65536);
            if (method == 'DELETE')
              return forward(uri, function(callback) {
                db.delete(path).then(callback);
              }, response.ok, method);
          } else if (parts.length == 5 && parts[4] == 'config') {
            if (method == 'PUT')
              return request.slurp(function(body) {
                if (body === undefined) return response.generic(415);
                forward(uri, function(callback) {
                  db.put(path, body).then(callback); // TODO: create app/module record if not exists
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
                  db.put(path+'/'+encodeURIComponent(body.name), body.version).then(callback);
                }, response.ok, method, body);
              }, 'json');
            if (method == 'DELETE' && parts.length == 6)
              return forward(uri, function(callback) {
                db.delete(path).then(callback);
              }, response.ok, method);
          }
        }
        if (request.path == '/activity') {
          socket.setNoDelay(true);
          return authenticate(request.cookie.sid, function(session) {
            clients[socket.socketId] = {user: session && session.username, socket: socket};
            response.end('', {
              'Content-Type': 'text/event-stream',
              'Content-Length': null
            });
          });
        }
        if (request.path == '/auth') {
          var code = request.query.authorization_code;
          // TODO: check request.query.state
          if (!code) return response.error();
          return o.xhr(api+'token?authorization_code='+code, function(e) {
            if (e.target.status != 200) return response.error();
            code = e.target.responseText;
            o.xhr(api+'v1/user?access_token='+code, {responseType: 'json'}, function(e) {
              if (e.target.status != 200) return response.error();
              db.put('sessions/'+(sid = token()), {
                accessToken: code,
                username: e.target.response.username,
                name: e.target.response.name,
                email: e.target.response.email
              }).then(function() {
                response.generic(303, {'Set-Cookie': 'sid='+sid, Location: '/'});
              });
            });
          });
        }
        if (request.path == '/logout')
          return logout(verify(request.cookie.sid));
        if (request.path == '/') {
          if (request.method == 'POST')
            return request.slurp(function(body) {
              if (body === undefined) return response.generic(415);
              if (body.app == null || typeof body.version != 'number') return response.error();
              authenticate(request.cookie.sid, function(session, inactive) {
                if (!inactive && !session) return response.error();
                var name = body.app,
                    version = body.version,
                    id = (session ? session.username+'/' : '')+name+version,
                    action = body.action,
                    user = session && session.username;
                if ((action == 'stop' || action == 'restart') && apps[id]) {
                  apps[id].terminate();
                  broadcast('stop', {app: name, version: version}, user);
                  delete apps[id];
                  if (action == 'stop') return response.ok();
                }
                if ((action == 'run' || action == 'restart') && !apps[id])
                  return function(callback) {
                    if (inactive) return db.get('apps/'+encodeURIComponent(name)+'/versions/'+version).then(callback);
                    o.xhr(api+'v1/apps/'+encodeURIComponent(name)+'/'+version+'?access_token='+session.accessToken, {responseType: 'json'}, function(e) {
                      if (e.target.status != 200) return response.error();
                      callback(e.target.response);
                    });
                  }(function(app) {
                    if (!app) return response.error();
                    apps[id] = proxy(null, loader+'var config = '+JSON.stringify(app.config)+';\nsimpl.use('+JSON.stringify(app.dependencies)+','+app.code+');', function(module, callback) {
                      (function(callback) {
                        if (inactive) return db.get('modules/'+encodeURIComponent(module.name)+'/versions/'+module.version).then(callback);
                        o.xhr(api+'v1/modules/'+encodeURIComponent(module.name)+'/'+module.version+'?access_token='+session.accessToken, {responseType: 'json'}, function(e) {
                          callback(e.target.response);
                        });
                      }(function(record) {
                        callback(wrap(module.name, record.code, module.version, record.dependencies));
                      }));
                    }, function(level, args, module, line, column) {
                      broadcast('log', {app: name, version: version, level: level, message: args, module: module, line: line, column: column}, user);
                    }, function(message, module, line) {
                      broadcast('error', {app: name, version: version, message: message, module: module, line: line}, user);
                      delete apps[id];
                    });
                    broadcast('run', {app: name, version: version}, user);
                    response.ok();
                  });
                response.error();
              });
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
            Object.keys(data).forEach(function(group) {
              Object.keys(data[group]).forEach(function(name) {
                data[group][name] = data[group][name].versions.map(function(version) {
                  return group == 'apps' ? [version, !!apps[(session ? session.username+'/' : '')+name+version]] : version;
                });
              });
            });
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
        o.xhr(location.origin+request.path, {responseType: 'arraybuffer'}, function(e) {
          if (e.target.status != 200)
            return response.generic(404);
          response.end(e.target.response, (request.path.match(/\.([^.]*)$/) || [])[1]);
        });
      }, function(error, s) {
        if (!error) {
          server = s;
          port = command.port;
        }
        launcher.postMessage({error: error, action: 'start', port: port});
      });
    });
    
    if (server) launcher.postMessage({action: 'start', port: port});
  });
  
  chrome.runtime.onSuspend.addListener(function() {
    if (server) {
      clearInterval(ping);
      server.disconnect();
    }
  });
});

var port, launcher = false;

chrome.app.runtime.onLaunched.addListener(function() {
  if (launcher.focus) {
    if (port) return window.open('http://localhost:'+port);
    return launcher.focus();
  }
  chrome.app.window.create('simpl.html', {
    id: 'simpl',
    resizable: false,
    innerBounds: {width: 300, height: 100}
  }, function(window) {
    (launcher = window).onClosed.addListener(function() {
      launcher = false;
    });
  });
  launcher = true;
});
