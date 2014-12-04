simpl.use({http: 0, html: 0, database: 0, xhr: 0, string: 0}, function(o, proxy) {

  var server, port, ping, loader, lines,
      db = o.database.open('simpl', {}),
      immediates = function(path) { return !path.length; };
  
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
        data[app.name] = {versions: [{code: e.target.responseText, config: app.config}]};
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
        data[module] = {versions: [{code: e.target.responseText}]};
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
              return db.get(path).then(function(resource) {
                if (resource === undefined) return response.generic(404);
                response.end(JSON.stringify(resource), {'Content-Type': o.http.mimeType('json')});
              });
            if (method == 'DELETE')
              return db.delete(path).then(function() {
                broadcast('delete', {app: parts[0] == 'apps', name: decodeURIComponent(parts[1])});
                response.ok();
              });
            if (method == 'POST')
              return request.slurp(function(code) {
                db.put(path+'/versions/0/code', code).then(function(error) {
                  if (!error) return response.ok();
                  this.put(path, {versions: [{code: code, config: {}}]}).then(response.ok);
                });
              }, 'utf8', 65536);
          } else if (parts[2] == 'config') {
            parts.splice(2, 0, 'versions', '0');
            path = parts.join('/');
            var handler = function() {
              this.get(parts.slice(0, 5).join('/')).then(function(config) {
                response.end(JSON.stringify(config), {'Content-Type': o.http.mimeType('json')});
              });
            };
            if (method == 'PUT' || method == 'INSERT')
              return request.slurp(function(body) {
                if (body === undefined) return response.generic(415);
                db[method.toLowerCase()](path, body).then(handler);
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
                return db.get('apps/'+encodeURIComponent(name)+'/versions/0').then(function(app) {
                  if (!app) return response.error();
                  apps[name] = proxy(null, loader+'var config = '+JSON.stringify(app.config)+';\n'+app.code, function(name, callback) {
                    db.get('modules/'+encodeURIComponent(name)+'/versions/0/code').then(callback);
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
          return db.get('apps', false, immediates).get('modules', false, immediates).then(function(a, m) {
            Object.keys(a).forEach(function(name) { a[name] = !!apps[name]; });
            Object.keys(m).forEach(function(name) { m[name] = 1; });
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
                    if (!apps) return [a, m, lines];
                    simpl.use({app: 0}, function(o) {
                      o.app(apps, modules, offset, document.body);
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
