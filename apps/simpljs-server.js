function(modules) {
  
  var db = modules.database.open('simpljs-server', {sessions: {}, accounts: {}}),
      key = modules.crypto.codec.utf8String.toBits(config.sessionKey),
      fromBits = modules.crypto.codec.base64.fromBits,
      toBits = modules.crypto.codec.base64.toBits;
  
  var signature = function(value) {
    if (!Array.isArray(value)) value = toBits(value.split('.')[0], true);
    return fromBits(new modules.crypto.misc.hmac(key).mac(value), true, true);
  };
  var token = function() {
    var rand = modules.crypto.random.randomWords(6, 0);
    return fromBits(rand, true, true)+'.'+signature(rand);
  };
  var verify = function(signed) {
    if (typeof signed != 'string') return;
    var parts = signed.split('.');
    return signature(parts[0]) == parts[1] && signed;
  };
  var pbkdf2 = function(password, salt) {
    var value = modules.crypto.misc.cachedPbkdf2(password, salt && {salt: toBits(salt, true)});
    return {key: fromBits(value.key, true, true), salt: fromBits(value.salt, true, true)};
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
  
  modules.http.serve({port: 80}, function(request, response) {
    var render = function(body, status) {
      response.end(modules.html.markup([
        {'!doctype': {html: null}},
        {html: [
          {head: [
            {title: 'Simpl.js'},
            {meta: {charset: 'utf-8'}},
            {meta: {name: 'viewport', content: 'width=device-width, initial-scale=1.0, user-scalable=no'}},
            {link: {rel: 'stylesheet', href: '/apps/assets/simpljs-server.css'}},
            {link: {rel: 'chrome-webstore-item', href: 'https://chrome.google.com/webstore/detail/'+config.appId}}
          ]},
          {body: body}
        ]}
      ]), 'html', status);
    };
    var logout = function(sid) {
      if (sid) db.delete('sessions/'+sid).then(function() { logout(); });
      else response.generic(303, {'Set-Cookie': 'sid=; Expires='+new Date().toUTCString(), Location: '/'});
    };
    var authenticate = function(sid, callback, token) {
      return verify(sid) && !db.get('sessions/'+sid).then(function(session) {
        if (!session || !session.user) return logout();
        this.get('accounts/'+encodeURIComponent(session.user)).then(function(account) {
          if (!account) return logout(sid);
          account.username = session.user;
          callback(account);
        });
      });
    };
    var authenticateAPI = function(token, callback, authCode) {
      if (!verify(token)) return response.generic(401);
      db.get('sessions/'+token).then(function(session) {
        if (!session || !session.owner || !session.accessToken == !authCode) return response.generic(401);
        if (authCode) return callback(session);
        callback('accounts/'+encodeURIComponent(session.owner), session);
      });
    };
    var sid;
    switch (request.path) {
      case '/':
        return authenticate(request.cookie.sid, function(account) {
          render(['Welcome, '+account.name+'! ', {a: {href: '/launch', children: 'Launch'}}, ' ', {a: {href: '/logout', children: 'Log out'}}]);
        }) || render(['Please ', {a: {href: '/register', children: 'Register'}}, ' or ', {a: {href: '/login', children: 'Log in'}}, '.']);
      case '/launch':
        return authenticate(sid = request.cookie.sid, function(account) {
          render([
            {p: {id: 'message', children: ['Please install ', {a: {id: 'link', href: 'https://chrome.google.com/webstore/detail/simpljs/'+config.appId, children: 'Simpl.js for Chrome'}}, '.']}},
            {script: function(token) {
              if (!token) return signature(sid);
              var message = document.getElementById('message'),
                  launch = function() { location.href = '/launch-'+token; };
              if (!window.chrome || !chrome.app)
                return message.innerHTML = 'You must be running Google Chrome to launch your Simpl.js Console. If you already have Chrome, open it and navigate to <code>http://simpljs.com/launch</code>. Otherwise, <a href="http://www.google.com/chrome/">download Chrome</a>.';
              if (chrome.app.isInstalled) return launch();
              document.getElementById('link').onclick = function(e) {
                e.preventDefault();
                chrome.webstore.install(undefined, launch);
              };
            }}
          ]);
        }) || response.generic(303, {Location: '/login?redirect=%2Flaunch'});
      case '/authorize':
        // prompt owner for access; redirect to client with authorization_code if granted
        // TODO: client registration
        // TODO: default to client's default redirect_uri
        // TODO: implement scopes
        if (request.method == 'POST' && (request.headers['Content-Type'] || '').split(';')[0] == 'application/x-www-form-urlencoded')
          return request.slurp(function(body) {
            if (!authenticate(sid = request.cookie.sid, function(account) {
              var state = '&state='+encodeURIComponent(body.state),
                  owner = account.username,
                  client = body.client_id;
              if (body.token != signature(sid)) return response.error();
              if (body.action != 'Authorize') return response.generic(303, {Location: body.redirect_uri+'?error=access_denied'+state});
              gcSessions(db).put('accounts/'+encodeURIComponent(owner)+'/clients/'+encodeURIComponent(client), true)
                .put('sessions/'+(sid = token()), {client: client, owner: owner, expires: Date.now()+86400000})
                .then(function() { response.generic(303, {Location: body.redirect_uri+'?authorization_code='+sid+state}); });
            })) response.error();
          }, 'url');
        return authenticate(sid = request.cookie.sid, function(account) {
          var client = request.query.client_id,
              redirect = request.query.redirect_uri,
              state = request.query.state;
          if (client in account.clients || client == 'simpljs') {
            var session = {client: client, owner: account.username, expires: Date.now()+86400000};
            if (client == 'simpljs') session.secret = signature(sid);
            return gcSessions(db).put('sessions/'+(sid = token()), session).then(function() {
              response.generic(303, {Location: redirect+'?authorization_code='+sid+'&state='+encodeURIComponent(state)});
            });
          }
          // TODO: look up client name, redirect_uri from client_id
          render([
            {p: client+' would like access to your account information.'},
            {form: {method: 'post', action: '/authorize', children: [
              {input: {type: 'hidden', name: 'client_id', value: client}},
              {input: {type: 'hidden', name: 'redirect_uri', value: redirect}},
              {input: {type: 'hidden', name: 'state', value: state}},
              {input: {type: 'hidden', name: 'token', value: signature(sid)}},
              {input: {type: 'submit', name: 'action', value: 'Authorize'}},
              {input: {type: 'submit', name: 'action', value: 'Deny'}}
            ]}}
          ]);
        }) || response.generic(302, {Location: '/login?redirect='+encodeURIComponent(request.uri)});
      case '/token':
        // exchange authorization_code for access_token
        return authenticateAPI(sid = request.query.authorization_code, function(session) {
          // TODO: check client secret for registered clients
          if (session.secret != request.query.client_secret) return response.error();
          session.accessToken = true;
          delete session.secret;
          db.delete('sessions/'+sid).put('sessions/'+(sid = token()), session).then(function() {
            response.end(sid);
          });
        }, true);
      case '/login':
        if (request.method == 'POST' && (request.headers['Content-Type'] || '').split(';')[0] == 'application/x-www-form-urlencoded')
          return request.slurp(function(body) {
            db.get('accounts/'+encodeURIComponent(body.username), true).then(function(account) {
              if (!account || account.password !== pbkdf2(body.password, account.salt).key)
                return render(['Invalid login. ', {a: {href: '/login', children: 'Try again'}}], 401);
              gcSessions(this).put('sessions/'+(sid = token()), {user: body.username, expires: Date.now()+86400000}).then(function() {
                var redirect = body.redirect || '/';
                response.generic(303, {'Set-Cookie': 'sid='+sid, Location: redirect[0] == '/' ? redirect : '/'});
              });
            });
          }, 'url');
        // TODO: add registration form to same page?
        return render([{form: {method: 'post', action: '/login', children: [
          {label: 'Username: '}, {input: {type: 'text', name: 'username'}}, {br: null},
          {label: 'Password: '}, {input: {type: 'password', name: 'password'}}, {br: null},
          {input: {type: 'hidden', name: 'redirect', value: request.query.redirect || ''}},
          {input: {type: 'submit', value: 'Log In'}}
        ]}}]);
      case '/logout':
        return logout(verify(request.cookie.sid));
      case '/register':
        if (request.method == 'POST' && (request.headers['Content-Type'] || '').split(';')[0] == 'application/x-www-form-urlencoded')
          return request.slurp(function(body) {
            var path = 'accounts/'+encodeURIComponent(body.username);
            db.get(path, true).then(function(account) {
              if (account) return render(['Username '+body.username+' is already taken. ', {a: {href: '/register', children: 'Try again'}}], 401);
              var apps = {}, mods = {}, count = 0;
              [ {name: '1 Hello World', file: 'hello-world'},
                {name: '2 Web Server', file: 'web-server', config: {port: 8001}, dependencies: {http: 0}},
                {name: '3 Database Editor', file: 'database-editor', config: {port: 8002, database: 'simpl'}, dependencies: {database: 0, html: 0, http: 0, xhr: 0}},
                {name: '4 Simple Login', file: 'simple-login', config: {port: 8003, sessionKey: 'yabadabadoo'}, dependencies: {crypto: 0, database: 0, html: 0, http: 0}},
                {name: '5 Unit Tests', file: 'unit-tests', dependencies: {async: 0, database: 0, docs: 0, html: 0, http: 0, parser: 0, string: 0, xhr: 0}},
                {name: 'async'},
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
              ].forEach(function(item, i, items) {
                modules.xhr(location.origin+(item.file ? '/apps/'+item.file : '/modules/'+item.name)+'.js', function(e) {
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
                  if (++count < items.length) return;
                  var hash = pbkdf2(body.password);
                  db.put('sessions/'+(sid = token()), body.username).put(path, {
                    name: body.name,
                    email: body.email,
                    password: hash.key,
                    salt: hash.salt,
                    workspace: {apps: apps, modules: mods},
                    clients: {}
                  }).then(function() {
                    response.generic(303, {'Set-Cookie': 'sid='+sid, Location: '/'});
                  });
                });
              });
            });
          }, 'url');
        return render([{form: {method: 'post', action: '/register', children: [
          {label: 'Name: '}, {input: {type: 'text', name: 'name'}}, {br: null},
          {label: 'Email: '}, {input: {type: 'text', name: 'email'}}, {br: null},
          {label: 'Username: '}, {input: {type: 'text', name: 'username'}}, {br: null}, // javascript identifier token
          {label: 'Password: '}, {input: {type: 'password', name: 'password'}}, {br: null}, // uppercase, lowercase, digit, special char, min 10 chars
          {input: {type: 'submit', value: 'Register'}}
        ]}}]);
      case '/v1/user':
        return authenticateAPI(request.query.access_token, function(namespace, session) {
          db.get(namespace, false, function(path) {
            return !path.length && function(key) {
              if (key != 'name' && key != 'email') return 'skip';
            };
          }).then(function(data) {
            data.username = session.owner;
            response.end(JSON.stringify(data), 'json');
          });
        });
      case '/v1/workspace':
        return authenticateAPI(request.query.access_token, function(namespace) {
          db.get(namespace+'/workspace', false, function(path) {
            // apps,modules/<name>/versions/<#>/code,config,dependencies,published/<#>
            return [
              true, true, true, true,
              function(key) { if (key != 'published') return 'skip'; },
              true
            ][path.length] || false;
          }).then(function(data) {
            Object.keys(data).forEach(function(group) {
              Object.keys(data[group]).forEach(function(name) {
                (name = data[group][name]).versions = name.versions.map(function(version) {
                  return version.published.length;
                });
              });
            });
            response.end(JSON.stringify(data), 'json');
          });
        });
    }
    if (/^\/v1\/(apps|modules)\/[^\/]*(\/\d+(\/|$)|$)/.test(request.path)) {
      var path = request.path.substr(4),
          parts = path.split('/'),
          app = parts[0] == 'apps',
          method = request.method;
      
      parts.splice(2, 0, 'versions');
      path = parts.join('/');
      
      if (parts.length < 5 && method == 'POST') {
        var upgrade = parts.length == 3;
        if (upgrade && !/\d+/.test(request.query.source)) return response.error();
        return authenticateAPI(request.query.access_token, function(namespace) {
          db.get(namespace+'/workspace/'+path+(upgrade ? '/'+request.query.source : ''), true).then(function(version) {
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
              ? this.append(namespace+'/workspace/'+path, record)
              : this.append(namespace+'/workspace/'+path+'/published', record.published[0])
            ).then(response.ok);
          });
        });
      } else if (parts.length == 4) {
        if (method == 'GET')
          return authenticateAPI(request.query.access_token, function(namespace) {
            db.get(namespace+'/workspace/'+path).then(function(data) {
              if (!data) return response.generic(404);
              response.end(JSON.stringify(data), 'json');
            });
          });
        if (method == 'PUT')
          return request.slurp(function(code) {
            authenticateAPI(request.query.access_token, function(namespace) {
              db.put(namespace+'/workspace/'+path+'/code', code).then(function(error) { // TODO: check If-Match header
                if (!error) return response.ok();
                if (parts[3] != '0') return response.error();
                this.get(namespace+'/workspace/'+path).then(function(existing) {
                  if (existing) return response.error();
                  this.put(parts[0]+'/'+parts[1], {versions: [app
                    ? {code: code, config: {}, dependencies: {}, published: []}
                    : {code: code, dependencies: {}, published: []}
                  ]}).then(response.ok);
                });
              });
            });
          }, 'utf8', 65536);
        if (method == 'DELETE')
          return authenticateAPI(request.query.access_token, function(namespace) {
            db.delete(namespace+'/workspace/'+path).then(response.ok);
          });
      } else if (parts.length == 5 && parts[4] == 'config') {
        if (method == 'PUT')
          return request.slurp(function(body) {
            if (body === undefined) return response.generic(415);
            authenticateAPI(request.query.access_token, function(namespace) {
              db.put(namespace+'/workspace/'+path, body).then(response.ok); // TODO: create app/module record if not exists
            });
          }, 'json');
        if (method == 'DELETE')
          return authenticateAPI(request.query.access_token, function(namespace) {
            db.delete(namespace+'/workspace/'+path).then(response.ok);
          });
      } else if (parts[4] == 'dependencies') {
        if (method == 'POST' && parts.length == 5)
          return request.slurp(function(body) {
            if (body === undefined) return response.generic(415);
            if (body.name == null || typeof body.version != 'number') return response.error();
            authenticateAPI(request.query.access_token, function(namespace) {
              db.put(namespace+'/workspace/'+path+'/'+encodeURIComponent(body.name), body.version).then(response.ok);
            });
          }, 'json');
        if (method == 'DELETE' && parts.length == 6)
          return authenticateAPI(request.query.access_token, function(namespace) {
            db.delete(namespace+'/workspace/'+path).then(response.ok);
          });
      }
    }
    modules.xhr(location.origin+request.path, {responseType: 'arraybuffer'}, function(e) {
      if (e.target.status != 200)
        return response.generic(404);
      response.end(e.target.response, (request.path.match(/\.([^.]*)$/) || [])[1]);
    });
  }, function(error) {
    if (error) console.error(error);
    else console.log('Listening at http://simpljs.com');
  });
}