function(modules) {
  
  var db = modules.database.open('simpljs-server', {sessions: {}, accounts: {}}),
      key = modules.crypto.codec.utf8String.toBits(config.sessionKey),
      fromBits = modules.crypto.codec.base64.fromBits,
      toBits = modules.crypto.codec.base64.toBits;
  
  var token = function() {
    var rand = modules.crypto.random.randomWords(6, 0);
    return fromBits(rand, true, true)+'.'+fromBits(new modules.crypto.misc.hmac(key).mac(rand), true, true);
  };
  var verify = function(signed) {
    try {
      var parts = signed.split('.');
      return fromBits(new modules.crypto.misc.hmac(key).mac(toBits(parts[0], true)), true, true) == parts[1] && signed;
    } catch (e) {}
  };
  var pbkdf2 = function(password, salt) {
    var value = modules.crypto.misc.cachedPbkdf2(password, salt && {salt: toBits(salt, true)});
    return {key: fromBits(value.key, true, true), salt: fromBits(value.salt, true, true)};
  };
  
  modules.http.serve({port: config.port}, function(request, response) {
    var render = function(body, status) {
      response.end(modules.html.markup([
        {'!doctype': {html: null}},
        {html: [
          {head: [
            {title: 'Simpl.js'},
            {meta: {charset: 'utf-8'}},
            {meta: {name: 'viewport', content: 'width=device-width, initial-scale=1.0, user-scalable=no'}},
            {link: {rel: 'stylesheet', href: '/apps/assets/simpljs-server.css'}}
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
      return verify(sid) && !db.get('sessions/'+sid).then(function(username) {
        if (!username) return logout();
        this.get('accounts/'+encodeURIComponent(username)).then(function(account) {
          if (!account) return logout(sid);
          account.username = username;
          callback(account);
        });
      });
    };
    var authenticateAPI = function(token, callback, authCode) {
      if (!verify(token)) return response.generic(401);
      db.get('sessions/'+token).then(function(session) {
        if (!session || !session.owner || !session.accessToken == !authCode) return response.generic(401);
        callback(authCode ? session : 'accounts/'+encodeURIComponent(session.owner));
      });
    };
    var sid;
    switch (request.path) {
      case '/':
        return authenticate(request.cookie.sid, function(account) {
          render(['Welcome, '+account.name+'! ', {a: {href: '/logout', children: 'Log out'}}]);
        }) || render(['Please ', {a: {href: '/register', children: 'Register'}}, ' or ', {a: {href: '/login', children: 'Log in'}}, '.']);
      case '/authorize':
        // prompt owner for access; redirect to client with authorization_code if granted
        // TODO: CSRF token
        // TODO: client registration
        // TODO: implement scopes
        // TODO: session timestamp/expiration
        // TODO: default to client's default redirect_uri
        // TODO: redirect on deny
        if (request.method == 'POST' && (request.headers['Content-Type'] || '').split(';')[0] == 'application/x-www-form-urlencoded')
          return request.slurp(function(body) {
            if (!authenticate(request.cookie.sid, function(account) {
              var username = account.username,
                  client = body.client_id;
              db.put('accounts/'+encodeURIComponent(username)+'/clients/'+encodeURIComponent(client), true)
                .put('sessions/'+(sid = token()), {client: client, owner: username})
                .then(function() { response.generic(303, {Location: body.redirect_uri+'?authorization_code='+sid+'&state='+encodeURIComponent(body.state)}); });
            })) response.error();
          }, 'url');
        return authenticate(request.cookie.sid, function(account) {
          var client = request.query.client_id,
              redirect = request.query.redirect_uri,
              scope = request.query.scope,
              state = request.query.state;
          if (client in account.clients)
            return db.put('sessions/'+(sid = token()), {client: client, owner: account.username})
              .then(function() { response.generic(303, {Location: redirect+'?authorization_code='+sid+'&state='+encodeURIComponent(state)}); });
          render([
            {p: client+' would like access to your account information.'},
            {form: {method: 'post', action: '/authorize', children: [
              {input: {type: 'hidden', name: 'client_id', value: client}},
              {input: {type: 'hidden', name: 'redirect_uri', value: redirect}},
              {input: {type: 'hidden', name: 'scope', value: scope}},
              {input: {type: 'hidden', name: 'state', value: state}},
              {input: {type: 'submit', value: 'Authorize'}} // TODO: deny button
            ]}}
          ]);
        }) || response.generic(302, {Location: '/login?redirect='+encodeURIComponent(request.uri)});
      case '/token':
        // exchange authorization_code for access_token
        // TODO: require client secret
        return authenticateAPI(sid = request.query.authorization_code, function(session) {
          session.accessToken = true;
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
              // TODO: reuse unexpired session id for user account
              // TODO: garbage collect expired sessions
              this.put('sessions/'+(sid = token()), body.username).then(function() {
                var redirect = body.redirect || '/';
                response.generic(303, {'Set-Cookie': 'sid='+sid, Location: redirect[0] == '/' ? redirect : '/'});
              });
            });
          }, 'url');
        // TODO: add registration form to same page?
        return render([{form: {method: 'post', action: '/login', children: [
          {label: 'Username: '}, {input: {type: 'text', name: 'username'}}, {br: null},
          {label: 'Password: '}, {input: {type: 'password', name: 'password'}}, {br: null},
          {input: {type: 'hidden', name: 'redirect', value: request.query.redirect || '/'}},
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
          {label: 'Username: '}, {input: {type: 'text', name: 'username'}}, {br: null},
          {label: 'Password: '}, {input: {type: 'password', name: 'password'}}, {br: null},
          {input: {type: 'submit', value: 'Register'}}
        ]}}]);
      case '/v1/user':
        return authenticateAPI(request.query.access_token, function(namespace) {
          db.get(namespace, false, function(path) {
            return !path.length && function(key) {
              if (key != 'name' && key != 'email') return 'skip';
            };
          }).then(function(data) {
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
        if (upgrade && !request.query.version) return response.error();
        return authenticateAPI(request.query.access_token, function(namespace) {
          db.get(namespace+'/workspace/'+path+(upgrade ? '/'+request.query.version : ''), true).then(function(version) {
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
    if (error) console.error('Error listening on 0.0.0.0:'+config.port+'\n'+error);
    else console.log('Listening at http://localhost:'+config.port);
  });
}