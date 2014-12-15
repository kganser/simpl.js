simpl.use({http: 0, html: 0, database: 0, xhr: 0, string: 0, net: 0}, function(o, proxy) {

  var server, port, ping, loader, lines,
      db = o.database.open('simpl', {});
  
  db.get('apps').then(function(apps) {
    if (apps) return;
    var data = {};
    [ {name: '1 Hello World', file: 'hello-world'},
      {name: '2 Web Server', file: 'web-server', config: {port: 8001}, dependencies: {http: 0}},
      {name: '3 Database Editor', file: 'database-editor', config: {port: 8002, database: 'simpl'}, dependencies: {database: 0, html: 0, http: 0, xhr: 0}},
      {name: '4 Simple Login', file: 'simple-login', config: {port: 8003, sessionKey: 'yabadabadoo'}, dependencies: {crypto: 0, database: 0, html: 0, http: 0}},
      {name: '5 Unit Tests', file: 'unit-tests', dependencies: {async: 0, database: 0, docs: 0, html: 0, http: 0, parser: 0, string: 0, xhr: 0}},
      {name: '6 Time Tracker', file: 'time-tracker', config: {port: 8004, redmineHost: 'redmine.slytrunk.com'}, dependencies: {http: 0, database: 0, html: 0, xhr: 0}}
    ].forEach(function(app, i, apps) {
      o.xhr('/apps/'+app.file+'.js', function(e) {
        data[app.name] = {versions: [{code: e.target.responseText, config: app.config || {}, dependencies: app.dependencies || {}}]};
        if (Object.keys(data).length == apps.length)
          db.put('apps', data);
      });
    });
  });
  db.get('modules').then(function(modules) {
    if (modules) return;
    var data = {};
    [ {name: 'async'},
      {name: 'crypto'},
      {name: 'database'},
      {name: 'docs', dependencies: {parser: 0}},
      {name: 'html'},
      {name: 'http', dependencies: {socket: 0, string: 0}},
      {name: 'net'},
      {name: 'parser'},
      {name: 'socket'},
      {name: 'string'},
      {name: 'xhr'}
    ].forEach(function(module, i, modules) {
      o.xhr('/modules/'+module.name+'.js', function(e) {
        data[module.name] = {versions: [{code: e.target.responseText, dependencies: module.dependencies || {}}]};
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
      
      var apps = {}, clients = {}, broadcast = function(event, data) {
        Object.keys(clients).forEach(function(socketId) {
          clients[socketId].send(o.string.toUTF8Buffer((event ? 'data: '+JSON.stringify({event: event, data: data}) : ':ping')+'\n\n').buffer, function(info) {
            if (info.resultCode) delete clients[socketId];
          });
        });
      };
      
      ping = setInterval(broadcast, 15000);
      
      o.http.serve({port: command.port}, function(request, response, socket) {
        
        if (/^\/(apps|modules)\/[^\/]*\/\d+(\/|$)/.test(request.path)) {
          var path = request.path.substr(1),
              parts = path.split('/'),
              entry = {app: parts[0] == 'apps', name: decodeURIComponent(parts[1]), version: parseInt(parts[2], 10)},
              method = request.method,
              echo = function() {
                this.get(parts.slice(0, 5).join('/')).then(function(object) {
                  entry.object = object;
                  broadcast(parts[4], entry);
                  response.ok();
                });
              };
          
          parts.splice(2, 0, 'versions');
          path = parts.join('/');
          
          if (parts.length == 4) {
            if (method == 'GET')
              return db.get(path).then(function(resource) {
                if (resource === undefined) return response.generic(404);
                response.end(JSON.stringify(resource), 'json');
              });
            if (method == 'DELETE')
              return db.delete(path).then(function() {
                broadcast('delete', entry);
                response.ok();
              });
            if (method == 'POST')
              return request.slurp(function(code) {
                db.put(path+'/code', code).then(function(error) { // TODO: check If-Match header
                  if (!error) return response.ok();
                  if (parts[3] != '0') return response.error();
                  this.get(path).then(function(existing) {
                    if (existing) return response.error();
                    this.put(parts[0]+'/'+parts[1], {versions: [entry.app
                      ? {code: code, config: {}, dependencies: {}}
                      : {code: code, dependencies: {}}
                    ]}).then(response.ok);
                  });
                });
              }, 'utf8', 65536);
          } else if (parts.length == 5 && method == 'POST' && (parts[4] == 'publish' || parts[4] == 'upgrade')) {
            path = parts.slice(0, 4).join('/');
            return db.get(path, true).then(function(version) {
              if (!version) return response.error();
              var published = version.published;
              if (published && version.code == published.code &&
                  JSON.stringify(version.config) == JSON.stringify(published.config) &&
                  JSON.stringify(version.dependencies) == JSON.stringify(published.dependencies))
                return response.generic(412);
              var record = {
                minor: 0,
                code: version.code,
                config: version.config,
                dependencies: version.dependencies,
                published: {
                  code: version.code,
                  config: version.config,
                  dependencies: version.dependencies
                }
              };
              if (!entry.app) {
                delete record.config;
                delete record.published.config;
              }
              return (parts[4] == 'upgrade'
                ? this.append(parts.slice(0, 3).join('/'), record)
                : this.put(path+'/minor', version.minor == null ? 0 : version.minor+1).put(path+'/published', record.published)
              ).then(function() {
                broadcast(parts[4], entry);
                response.ok();
              });
            });
          } else if (parts[4] == 'config') {
            if (method == 'PUT' || method == 'INSERT')
              return request.slurp(function(body) {
                if (body === undefined) return response.generic(415);
                db[method.toLowerCase()](path, body).then(echo);
              }, 'json');
            if (method == 'DELETE')
              return db.delete(path).then(echo);
          } else if (parts[4] == 'dependencies') {
            if (method == 'DELETE')
              return parts.length == 6
                ? db.delete(path).then(echo)
                : response.error();
            if (method == 'POST' && parts.length == 5)
              return request.slurp(function(body) {
                if (body === undefined) return response.generic(415);
                if (body.name == null || typeof body.version != 'number') return response.error();
                db.put(path+'/'+encodeURIComponent(body.name), body.version).then(echo);
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
        if (request.path == '/') {
          if (request.method == 'POST')
            return request.slurp(function(body) {
              if (body === undefined) return response.generic(415);
              if (body.app == null || typeof body.version != 'number') return response.error();
              var name = body.app,
                  version = body.version,
                  id = encodeURIComponent(name)+'/versions/'+version,
                  action = body.action;
              if ((action == 'stop' || action == 'restart') && apps[id]) {
                apps[id].terminate();
                broadcast('stop', {app: name, version: version});
                delete apps[id];
                if (action == 'stop') return response.ok();
              }
              if ((action == 'run' || action == 'restart') && !apps[id])
                return db.get('apps/'+id).then(function(app) {
                  if (!app) return response.error();
                  apps[id] = proxy(null, loader+'var config = '+JSON.stringify(app.config)+';\n'+app.code, function(module, callback) {
                    db.get('modules/'+encodeURIComponent(module.name)+'/versions/'+module.version+'/code').then(callback);
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
          return db.get('', false, function(path) {
            return path.length < 4 ? null : function(key) {
              if (key != 'minor') return 'skip';
            };
          }).then(function(data) {
            Object.keys(data.apps).forEach(function(name) {
              data.apps[name] = data.apps[name].versions.map(function(v, i) {
                return [v.minor == null ? null : v.minor, !!apps[name+'-'+i]];
              });
            });
            Object.keys(data.modules).forEach(function(name) {
              data.modules[name] = data.modules[name].versions.map(function(v) {
                return v.minor == null ? null : v.minor;
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
                  {script: {src: '/html.js'}},
                  {script: {src: '/xhr.js'}},
                  {script: {src: '/jsonv.js'}},
                  {script: {src: '/parser.js'}},
                  {script: {src: '/docs.js'}},
                  {script: {src: '/codemirror.js'}},
                  {script: {src: '/app.js'}},
                  {script: function(apps, modules, offset) {
                    if (!apps) return [data.apps, data.modules, lines];
                    simpl.use({app: 0}, function(o) {
                      o.app(apps, modules, offset, document.body);
                    });
                  }}
                ]}
              ]}
            ]), 'html');
          });
        }
        if (/^\/(html|xhr|parser|docs)\.js$/.test(request.path))
          request.path = '/modules'+request.path;
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
