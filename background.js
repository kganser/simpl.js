simpl.use({http: 0, html: 0, database: 0, xhr: 0, string: 0, net: 0, crypto: 0}, function(o, proxy) {

  var server, port, ping, loader, lines,
      db = o.database.open('simpl', {sessions: {}}),
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
          server = null;
        }
        return launcher.postMessage({action: 'stop'});
      }
      
      var apps = {}, clients = {};
      var wrap = function(name, code, version, dependencies) {
        return 'simpl.add('+[JSON.stringify(name), code, version, JSON.stringify(dependencies)]+');';
      };
      var broadcast = function(event, data) {
        Object.keys(clients).forEach(function(socketId) {
          clients[socketId].send(o.string.toUTF8Buffer((event ? 'data: '+JSON.stringify({event: event, data: data}) : ':ping')+'\n\n').buffer, function(info) {
            if (info.resultCode) delete clients[socketId];
          });
        });
      };
      
      ping = setInterval(broadcast, 15000);
      
      o.http.serve({port: command.port}, function(request, response, socket) {
        
        var match, sid;
        var logout = function(sid) {
          if (sid) db.delete('sessions/'+sid).then(function() { logout(); });
          else response.generic(303, {'Set-Cookie': 'sid=; Expires='+new Date().toUTCString(), Location: '/'});
        };
        var forward = function(sid, path, fallback, callback, method, body, text) {
          if (sid = verify(request.cookie.sid))
            return db.get('sessions/'+sid).then(function(session) {
              if (!session) return logout(sid);
              o.xhr('http://127.0.0.1:8005/v1/'+path+'?access_token='+session.accessToken, {
                method: method,
                responseType: 'json',
                json: text ? undefined : body,
                data: text ? body : undefined
              }, function(e) {
                if (e.target.status != 200) return logout(sid);
                callback(e.target.response, {email: session.email, name: session.name});
              });
            });
          fallback(callback);
        };
        
        if (match = request.path.match(/^\/([^.\/]*)\.(\d+)\.js$/))
          return db.get('modules/'+match[1]+'/versions/'+match[2]).then(function(module) {
            response.end(wrap(decodeURIComponent(match[1]), module.code, match[2], module.dependencies), 'js');
          });
        if (/^\/(apps|modules)\/[^\/]*\/\d+(\/|$)/.test(request.path)) {
          var path = request.path.substr(1),
              parts = path.split('/'),
              app = parts[0] == 'apps',
              method = request.method;
          
          parts.splice(2, 0, 'versions');
          var entry = parts.join('/');
          
          if (parts.length == 4) {
            if (method == 'GET')
              return forward(request.cookie.sid, path, function(callback) {
                db.get(entry).then(callback);
              }, function(data) {
                if (!data) return response.generic(404);
                response.end(JSON.stringify(data), 'json');
              });
            if (method == 'DELETE')
              return forward(request.cookie.sid, path, function(callback) {
                db.delete(entry).then(callback);
              }, response.ok, method);
            if (method == 'POST')
              return request.slurp(function(code) {
                forward(request.cookie.sid, path, function(callback) {
                  db.put(entry+'/code', code).then(function(error) { // TODO: check If-Match header
                    if (!error) return callback();
                    if (parts[3] != '0') return response.error();
                    this.get(entry).then(function(existing) {
                      if (existing) return response.error();
                      this.put(parts[0]+'/'+parts[1], {versions: [app
                        ? {code: code, config: {}, dependencies: {}, published: []}
                        : {code: code, dependencies: {}, published: []}
                      ]}).then(callback);
                    });
                  });
                }, response.ok, method, code, true);
              }, 'utf8', 65536);
          } else if (parts.length == 5 && method == 'POST' && (parts[4] == 'publish' || parts[4] == 'upgrade')) {
            return forward(request.cookie.sid, path, function(callback) {
              path = parts.slice(0, 4).join('/');
              db.get(path, true).then(function(version) {
                if (!version) return response.error();
                var published = version.published[version.published.length-1];
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
                return (parts[4] == 'upgrade'
                  ? this.append(parts.slice(0, 3).join('/'), record)
                  : this.append(path+'/published', record.published[0])
                ).then(callback);
              });
            }, response.ok, method);
          } else if (parts[4] == 'config') {
            if (method == 'PUT' || method == 'INSERT')
              return request.slurp(function(body) {
                forward(request.cookie.sid, path, function(callback) {
                  if (body === undefined) return response.generic(415);
                  db[method.toLowerCase()](entry, body).then(callback); // TODO: create app/module record if not exists
                }, response.ok, method, body);
              }, 'json');
            if (method == 'DELETE')
              return forward(request.cookie.sid, path, function(callback) {
                db.delete(entry).then(callback);
              }, response.ok, method);
          } else if (parts[4] == 'dependencies') {
            if (method == 'DELETE')
              return forward(request.cookie.sid, path, function(callback) {
                if (parts.length != 6) return response.error();
                db.delete(entry).then(callback);
              }, response.ok, method);
            if (method == 'POST' && parts.length == 5)
              return request.slurp(function(body) {
                forward(request.cookie.sid, path, function(callback) {
                  if (body === undefined) return response.generic(415);
                  if (body.name == null || typeof body.version != 'number') return response.error();
                  db.put(entry+'/'+encodeURIComponent(body.name), body.version).then(response.ok);
                }, response.ok, method, body);
              }, 'json');
          }
        }
        if (request.path == '/activity') {
          clients[socket.socketId] = socket;
          socket.setNoDelay(true);
          return response.end('', {
            'Content-Type': 'text/event-stream',
            'Content-Length': null
          });
        }
        if (request.path == '/auth') {
          var code = request.query.authorization_code;
          // TODO: check request.query.state
          if (!code) return response.error();
          return o.xhr('http://127.0.0.1:8005/token?authorization_code='+code, function(e) {
            if (e.target.status != 200) return response.error();
            code = e.target.responseText;
            o.xhr('http://127.0.0.1:8005/v1/user?access_token='+code, {responseType: 'json'}, function(e) {
              if (e.target.status != 200) return response.error();
              db.put('sessions/'+(sid = token()), {accessToken: code, name: e.target.response.name, email: e.target.response.email}).then(function() {
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
              var name = body.app,
                  version = body.version,
                  id = name+version,
                  action = body.action;
              if ((action == 'stop' || action == 'restart') && apps[id]) {
                apps[id].terminate();
                broadcast('stop', {app: name, version: version});
                delete apps[id];
                if (action == 'stop') return response.ok();
              }
              if ((action == 'run' || action == 'restart') && !apps[id])
                return db.get('apps/'+encodeURIComponent(name)+'/versions/'+version).then(function(app) {
                  if (!app) return response.error();
                  apps[id] = proxy(null, loader+'var config = '+JSON.stringify(app.config)+';\nsimpl.use('+JSON.stringify(app.dependencies)+','+app.code+');', function(module, callback) {
                    db.get('modules/'+encodeURIComponent(module.name)+'/versions/'+module.version).then(function(record) {
                      callback(wrap(module.name, record.code, module.version, record.dependencies));
                    });
                  }, function(level, args, module, line, column) {
                    broadcast('log', {app: name, version: version, level: level, message: args, module: module, line: line, column: column});
                  }, function(message, module, line) {
                    broadcast('error', {app: name, version: version, message: message, module: module, line: line});
                    delete apps[id];
                  });
                  broadcast('run', {app: name, version: version});
                  response.ok();
                });
              response.error();
            }, 'json');
          return forward(request.cookie.sid, 'workspace', function(callback) {
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
                  return group == 'apps' ? [version, !!apps[name+version]] : version;
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
        server = s;
        port = command.port;
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

chrome.app.runtime.onLaunched.addListener(function() {
  chrome.app.window.create('simpl.html', {
    id: 'simpl',
    resizable: false,
    innerBounds: {width: 300, height: 100}
  });
});
