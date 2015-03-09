simpl.use({http: 0, html: 0, database: 0, xhr: 0, string: 0, net: 0, crypto: 0}, function(o, proxy) {

  var server, ping, loader, lines,
      db = o.database.open('simpl', {sessions: {}}),
      api = 'http://simpljs.com/',
      key = o.crypto.random.randomWords(6, 0), // TODO: store in database
      fromBits = o.crypto.codec.base64.fromBits;
  
  var signature = function(value) {
    if (!Array.isArray(value)) value = o.crypto.codec.base64.toBits(value.split('.')[0], true);
    return fromBits(new o.crypto.misc.hmac(key).mac(value), true, true);
  };
  var token = function() {
    var rand = o.crypto.random.randomWords(6, 0);
    return fromBits(rand, true, true)+'.'+signature(rand);
  };
  var verify = function(signed) {
    if (typeof signed != 'string') return;
    var parts = signed.split('.');
    return signature(parts[0]) == parts[1] && signed;
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
  
  db.get('apps').then(function(data) {
    if (data) return;
    data = {};
    [ {name: '1 Hello World', file: 'hello-world'},
      {name: '2 Web Server', file: 'web-server', config: {port: 8001}, dependencies: {http: 0}},
      {name: '3 Database Editor', file: 'database-editor', config: {port: 8002, database: 'simpl'}, dependencies: {database: 0, html: 0, http: 0, xhr: 0}},
      {name: '4 Simple Login', file: 'simple-login', config: {port: 8003, sessionKey: 'yabadabadoo'}, dependencies: {crypto: 0, database: 0, html: 0, http: 0}},
      {name: '5 Unit Tests', file: 'unit-tests', dependencies: {async: 0, database: 0, docs: 0, html: 0, http: 0, parser: 0, string: 0, socket: 0, xhr: 0}}
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
          var path = parts.join('/');
          
          if (parts.length < 5 && method == 'POST') {
            var upgrade = parts.length == 3;
            if (upgrade && !/\d+/.test(request.query.source)) return response.error();
            return forward(request.uri.substr(1), function(callback) {
              db.get(upgrade ? path+'/'+request.query.source : path, true).then(function(version) {
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
        if (request.path == '/auth')
          return authenticate(sid = request.cookie.sid, function(session) {
            var code = request.query.authorization_code;
            if (!session || !code || signature(sid) != request.query.state) return response.error();
            o.xhr(api+'token?authorization_code='+code+'&client_secret='+session.secret, function(e) {
              if (e.target.status != 200) return response.error();
              code = e.target.responseText;
              o.xhr(api+'v1/user?access_token='+code, {responseType: 'json'}, function(e) {
                if (e.target.status != 200) return response.error();
                db.put('sessions/'+sid, {
                  accessToken: code,
                  username: e.target.response.username,
                  name: e.target.response.name,
                  email: e.target.response.email,
                  expires: Date.now()+86400000
                }).then(function() {
                  response.generic(303, {Location: '/'});
                });
              });
            });
          });
        if (request.path == '/login') {
          var secret = request.query.token;
          if (!secret) return response.generic(303, {Location: api+'launch'});
          return authenticate(sid = request.cookie.sid, function(session) {
            var uri = api+'authorize?client_id=simpljs&redirect_uri=http%3A%2F%2Flocalhost%3A'+port+'%2Fauth&state=';
            if (!session) sid = token();
            gcSessions(db).put('sessions/'+sid, {secret: secret, expires: Date.now()+86400000}).then(function() {
              response.generic(303, {'Set-Cookie': 'sid='+sid, Location: uri+signature(sid)});
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
                  {svg: {id: 'icons', children: [
                    {symbol: {id: 'icon-left', viewBox: '0 0 20 20', children: {path: {d: 'M14,5v10l-9-5L14,5z'}}}},
                    {symbol: {id: 'icon-right', viewBox: '0 0 20 20', children: {path: {d: 'M15,10l-9,5V5L15,10z'}}}},
                    {symbol: {id: 'icon-user', viewBox: '0 0 20 20', children: {path: {d: 'M7.725,2.146c-1.016,0.756-1.289,1.953-1.239,2.59C6.55,5.515,6.708,6.529,6.708,6.529s-0.313,0.17-0.313,0.854C6.504,9.1,7.078,8.359,7.196,9.112c0.284,1.814,0.933,1.491,0.933,2.481c0,1.649-0.68,2.42-2.803,3.334C3.196,15.845,1,17,1,19v1h18v-1c0-2-2.197-3.155-4.328-4.072c-2.123-0.914-2.801-1.684-2.801-3.334c0-0.99,0.647-0.667,0.932-2.481c0.119-0.753,0.692-0.012,0.803-1.729c0-0.684-0.314-0.854-0.314-0.854s0.158-1.014,0.221-1.793c0.065-0.817-0.398-2.561-2.3-3.096c-0.333-0.34-0.558-0.881,0.466-1.424C9.439,0.112,8.918,1.284,7.725,2.146z'}}}},
                    {symbol: {id: 'icon-logout', viewBox: '0 0 20 20', children: {path: {d: 'M19,10l-6-5v3H6v4h7v3L19,10z M3,3h8V1H3C1.9,1,1,1.9,1,3v14c0,1.1,0.9,2,2,2h8v-2H3V3z'}}}},
                    {symbol: {id: 'icon-add', viewBox: '0 0 20 20', children: {path: {d: 'M16,10c0,0.553-0.048,1-0.601,1H11v4.399C11,15.951,10.553,16,10,16c-0.553,0-1-0.049-1-0.601V11H4.601C4.049,11,4,10.553,4,10c0-0.553,0.049-1,0.601-1H9V4.601C9,4.048,9.447,4,10,4c0.553,0,1,0.048,1,0.601V9h4.399C15.952,9,16,9.447,16,10z'}}}},
                    {symbol: {id: 'icon-run', viewBox: '0 0 20 20', children: {path: {d: 'M15,10.001c0,0.299-0.305,0.514-0.305,0.514l-8.561,5.303C5.51,16.227,5,15.924,5,15.149V4.852c0-0.777,0.51-1.078,1.135-0.67l8.561,5.305C14.695,9.487,15,9.702,15,10.001z'}}}},
                    {symbol: {id: 'icon-restart', viewBox: '0 0 20 20', children: {path: {d: 'M19.315,10h-2.372V9.795c-0.108-4.434-3.724-7.996-8.169-7.996C4.259,1.799,0.6,5.471,0.6,10s3.659,8.199,8.174,8.199c1.898,0,3.645-0.65,5.033-1.738l-1.406-1.504c-1.016,0.748-2.27,1.193-3.627,1.193c-3.386,0-6.131-2.754-6.131-6.15s2.745-6.15,6.131-6.15c3.317,0,6.018,2.643,6.125,5.945V10h-2.672l3.494,3.894L19.315,10z'}}}},
                    {symbol: {id: 'icon-stop', viewBox: '0 0 20 20', children: {path: {d: 'M16,4.995v9.808C16,15.464,15.464,16,14.804,16H4.997C4.446,16,4,15.554,4,15.003V5.196C4,4.536,4.536,4,5.196,4h9.808C15.554,4,16,4.446,16,4.995z'}}}},
                    {symbol: {id: 'icon-code', viewBox: '0 0 20 20', children: {path: {d: 'M5.719,14.75c-0.236,0-0.474-0.083-0.664-0.252L-0.005,10l5.341-4.748c0.412-0.365,1.044-0.33,1.411,0.083s0.33,1.045-0.083,1.412L3.005,10l3.378,3.002c0.413,0.367,0.45,0.999,0.083,1.412C6.269,14.637,5.994,14.75,5.719,14.75zM14.664,14.748L20.005,10l-5.06-4.498c-0.413-0.367-1.045-0.33-1.411,0.083c-0.367,0.413-0.33,1.045,0.083,1.412L16.995,10l-3.659,3.252c-0.413,0.367-0.45,0.999-0.083,1.412C13.45,14.887,13.725,15,14,15C14.236,15,14.474,14.917,14.664,14.748zM9.986,16.165l2-12c0.091-0.545-0.277-1.06-0.822-1.151c-0.547-0.092-1.061,0.277-1.15,0.822l-2,12c-0.091,0.545,0.277,1.06,0.822,1.151C8.892,16.996,8.946,17,9.001,17C9.481,17,9.905,16.653,9.986,16.165z'}}}},
                    {symbol: {id: 'icon-settings', viewBox: '0 0 20 20', children: {path: {d: 'M16.783,10c0-1.049,0.646-1.875,1.617-2.443c-0.176-0.584-0.407-1.145-0.692-1.672c-1.089,0.285-1.97-0.141-2.711-0.883c-0.741-0.74-0.968-1.621-0.683-2.711c-0.527-0.285-1.088-0.518-1.672-0.691C12.074,2.57,11.047,3.215,10,3.215c-1.048,0-2.074-0.645-2.643-1.615C6.772,1.773,6.213,2.006,5.686,2.291c0.285,1.09,0.059,1.971-0.684,2.711C4.262,5.744,3.381,6.17,2.291,5.885C2.006,6.412,1.774,6.973,1.6,7.557C2.57,8.125,3.215,8.951,3.215,10c0,1.047-0.645,2.074-1.615,2.643c0.175,0.584,0.406,1.144,0.691,1.672c1.09-0.285,1.971-0.059,2.711,0.682c0.741,0.742,0.969,1.623,0.684,2.711c0.527,0.285,1.087,0.518,1.672,0.693c0.568-0.973,1.595-1.617,2.643-1.617c1.047,0,2.074,0.645,2.643,1.617c0.584-0.176,1.144-0.408,1.672-0.693c-0.285-1.088-0.059-1.969,0.683-2.711c0.741-0.74,1.622-1.166,2.711-0.883c0.285-0.527,0.517-1.086,0.692-1.672C17.429,11.873,16.783,11.047,16.783,10z M10,13.652c-2.018,0-3.653-1.635-3.653-3.652c0-2.018,1.636-3.654,3.653-3.654c2.018,0,3.652,1.637,3.652,3.654C13.652,12.018,12.018,13.652,10,13.652z'}}}},
                    {symbol: {id: 'icon-log', viewBox: '0 0 20 20', children: {path: {d: 'M16.4,9H3.6C3.048,9,3,9.447,3,10c0,0.553,0.048,1,0.6,1h12.8c0.552,0,0.6-0.447,0.6-1S16.952,9,16.4,9zM16.4,13H3.6C3.048,13,3,13.447,3,14c0,0.553,0.048,1,0.6,1h12.8c0.552,0,0.6-0.447,0.6-1S16.952,13,16.4,13z M3.6,7h12.8C16.952,7,17,6.553,17,6s-0.048-1-0.6-1H3.6C3.048,5,3,5.447,3,6S3.048,7,3.6,7z'}}}},
                    {symbol: {id: 'icon-info', viewBox: '0 0 20 20', children: {path: {d: 'M12.432,0c1.34,0,2.01,0.912,2.01,1.957c0,1.305-1.164,2.512-2.679,2.512c-1.269,0-2.009-0.75-1.974-1.99C9.789,1.436,10.67,0,12.432,0z M8.309,20c-1.058,0-1.833-0.652-1.093-3.524l1.214-5.092c0.211-0.814,0.246-1.141,0-1.141c-0.317,0-1.689,0.562-2.502,1.117L5.4,10.48c2.572-2.186,5.531-3.467,6.801-3.467c1.057,0,1.233,1.273,0.705,3.23l-1.391,5.352c-0.246,0.945-0.141,1.271,0.106,1.271c0.317,0,1.357-0.392,2.379-1.207l0.6,0.814C12.098,19.02,9.365,20,8.309,20z'}}}},
                    {symbol: {id: 'icon-delete', viewBox: '0 0 20 20', children: {path: {d: 'M3.389,7.113L4.49,18.021C4.551,18.482,6.777,19.998,10,20c3.225-0.002,5.451-1.518,5.511-1.979l1.102-10.908C14.929,8.055,12.412,8.5,10,8.5C7.59,8.5,5.072,8.055,3.389,7.113z M13.168,1.51l-0.859-0.951C11.977,0.086,11.617,0,10.916,0H9.085c-0.7,0-1.061,0.086-1.392,0.559L6.834,1.51C4.264,1.959,2.4,3.15,2.4,4.029v0.17C2.4,5.746,5.803,7,10,7c4.198,0,7.601-1.254,7.601-2.801v-0.17C17.601,3.15,15.738,1.959,13.168,1.51z M12.07,4.34L11,3H9L7.932,4.34h-1.7c0,0,1.862-2.221,2.111-2.522C8.533,1.588,8.727,1.5,8.979,1.5h2.043c0.253,0,0.447,0.088,0.637,0.318C11.907,2.119,13.77,4.34,13.77,4.34H12.07z'}}}},
                    {symbol: {id: 'icon-publish', viewBox: '0 0 20 20', children: {path: {d: 'M15.213,6.639c-0.276,0-0.546,0.025-0.809,0.068C13.748,4.562,11.716,3,9.309,3c-2.939,0-5.32,2.328-5.32,5.199c0,0.256,0.02,0.508,0.057,0.756C3.905,8.938,3.763,8.928,3.617,8.928C1.619,8.928,0,10.51,0,12.463S1.619,16,3.617,16H8v-4H5.5L10,7l4.5,5H12v4h3.213C17.856,16,20,13.904,20,11.32C20,8.734,17.856,6.639,15.213,6.639z'}}}},
                    {symbol: {id: 'icon-search', viewBox: '0 0 20 20', children: {path: {d: 'M17.545,15.467l-3.779-3.779c0.57-0.935,0.898-2.035,0.898-3.21c0-3.417-2.961-6.377-6.378-6.377C4.869,2.1,2.1,4.87,2.1,8.287c0,3.416,2.961,6.377,6.377,6.377c1.137,0,2.2-0.309,3.115-0.844l3.799,3.801c0.372,0.371,0.975,0.371,1.346,0l0.943-0.943C18.051,16.307,17.916,15.838,17.545,15.467z M4.004,8.287c0-2.366,1.917-4.283,4.282-4.283c2.366,0,4.474,2.107,4.474,4.474c0,2.365-1.918,4.283-4.283,4.283C6.111,12.76,4.004,10.652,4.004,8.287z'}}}},
                    {symbol: {id: 'icon-error', viewBox: '0 0 20 20', children: {path: {d: 'M19.511,17.98L10.604,1.348C10.48,1.133,10.25,1,10,1C9.749,1,9.519,1.133,9.396,1.348L0.49,17.98c-0.121,0.211-0.119,0.471,0.005,0.68C0.62,18.871,0.847,19,1.093,19h17.814c0.245,0,0.474-0.129,0.598-0.34C19.629,18.451,19.631,18.191,19.511,17.98z M11,17H9v-2h2V17z M11,13.5H9V7h2V13.5z'}}}},
                    {symbol: {id: 'icon-loading', viewBox: '0 0 20 20', children: {path: {d: 'M15.6,4.576c0-2.139,0-2.348,0-2.348C15.6,1.439,13.092,0,10,0C6.907,0,4.4,1.439,4.4,2.228c0,0,0,0.209,0,2.348C4.4,6.717,8.277,8.484,8.277,10c0,1.514-3.877,3.281-3.877,5.422s0,2.35,0,2.35C4.4,18.56,6.907,20,10,20c3.092,0,5.6-1.44,5.6-2.229c0,0,0-0.209,0-2.35s-3.877-3.908-3.877-5.422C11.723,8.484,15.6,6.717,15.6,4.576z M5.941,2.328c0.696-0.439,2-1.082,4.114-1.082c2.113,0,4.006,1.082,4.006,1.082c0.142,0.086,0.698,0.383,0.317,0.609C13.54,3.434,11.9,3.957,10,3.957S6.516,3.381,5.676,2.883C5.295,2.658,5.941,2.328,5.941,2.328z M10.501,10c0,1.193,0.996,1.961,2.051,2.986c0.771,0.748,1.826,1.773,1.826,2.435v1.328c-0.97-0.483-3.872-0.955-3.872-2.504c0-0.783-1.013-0.783-1.013,0c0,1.549-2.902,2.021-3.872,2.504v-1.328c0-0.662,1.056-1.688,1.826-2.435C8.502,11.961,9.498,11.193,9.498,10S8.502,8.039,7.447,7.014c-0.771-0.75-1.826-1.775-1.826-2.438L5.575,3.578C6.601,4.131,8.227,4.656,10,4.656c1.772,0,3.406-0.525,4.433-1.078l-0.055,0.998c0,0.662-1.056,1.688-1.826,2.438C11.498,8.039,10.501,8.807,10.501,10z'}}}},
                  ]}},
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
