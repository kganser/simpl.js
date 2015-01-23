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
      if (!verify(token)) return response.generic(403);
      db.get('sessions/'+token).then(function(session) {
        if (!session || !session.owner || !session.accessToken == !authCode) return response.generic(403);
        callback(session);
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
        if (request.method == 'POST' && (request.headers['Content-Type'] || '').split(';')[0] == 'application/x-www-form-urlencoded')
          return request.slurp(function(body) {
            if (!authenticate(request.cookie.sid, function(account) {
              // TODO: add client, scopes to account's authorized list; bypass authorization form if scopes already authorized for client
              db.put('sessions/'+(sid = token()), {
                client: body.client_id, // TODO: check client_id
                owner: account.username
                // TODO: timestamp, expiration
              }).then(function() {
                // TODO: default to client's default redirect_uri
                // TODO: redirect on deny
                response.generic(303, {Location: body.redirect_uri+'?authorization_code='+sid+'&state='+encodeURIComponent(body.state)});
              });
            })) response.error();
          }, 'url');
        return authenticate(request.cookie.sid, function(account) {
          render([
            {p: request.query.client_id+' would like access to your account information.'},
            {form: {method: 'post', action: '/authorize', children: [
              {input: {type: 'hidden', name: 'client_id', value: request.query.client_id}},
              {input: {type: 'hidden', name: 'redirect_uri', value: request.query.redirect_uri}},
              {input: {type: 'hidden', name: 'scope', value: request.query.scope}}, // TODO: implement
              {input: {type: 'hidden', name: 'state', value: request.query.state}},
              {input: {type: 'submit', value: 'Authorize'}} // TODO: deny button
            ]}}
          ]);
        }) || response.generic(302, {Location: '/login?redirect='+encodeURIComponent(request.uri)});
      case '/token':
        // exchange authorization_code for access_token
        // TODO: need app secret?
        return authenticateAPI(request.query.authorization_code, function(session) {
          var accessToken = token();
          session.accessToken = true;
          db.delete('sessions/'+sid).put('sessions/'+accessToken, session).then(function() {
            response.end(accessToken);
          });
        }, true);
      case '/login':
        if (request.method == 'POST' && (request.headers['Content-Type'] || '').split(';')[0] == 'application/x-www-form-urlencoded')
          return request.slurp(function(body) {
            db.get('accounts/'+encodeURIComponent(body.username), true).then(function(account) {
              if (!account || account.password !== pbkdf2(body.password, account.salt).key)
                return render(['Invalid login. ', {a: {href: '/login', children: 'Try again'}}], 401);
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
              var hash = pbkdf2(body.password);
              // TODO: populate default apps, modules
              this.put(path, {name: body.name, email: body.email, password: hash.key, salt: hash.salt, workspace: {apps: {}, modules: {}}})
                  .put('sessions/'+(sid = token()), body.username)
                  .then(function() { response.generic(303, {'Set-Cookie': 'sid='+sid, Location: '/'}); });
            });
          }, 'url');
        return render([{form: {method: 'post', action: '/register', children: [
          {label: 'Name: '}, {input: {type: 'text', name: 'name'}}, {br: null},
          {label: 'Email: '}, {input: {type: 'text', name: 'email'}}, {br: null},
          {label: 'Username: '}, {input: {type: 'text', name: 'username'}}, {br: null},
          {label: 'Password: '}, {input: {type: 'password', name: 'password'}}, {br: null},
          {input: {type: 'submit', value: 'Register'}}
        ]}}]);
      case '/api/user':
        return authenticateAPI(request.query.access_token, function(session) {
          db.get('accounts/'+encodeURIComponent(session.owner), false, function(path) {
            return !path.length && function(key) {
              if (key != 'name' && key != 'email') return 'skip';
            };
          }).then(function(data) {
            //data.username = session.owner;
            response.end(JSON.stringify(data), 'json');
          });
        });
      case '/api/workspace':
        return authenticateAPI(request.query.access_token, function(session) {
          db.get('accounts/'+encodeURIComponent(session.owner)+'/workspace').then(function(data) {
            response.end(JSON.stringify(data), 'json');
          });
        });
    }
    response.generic(404);
  }, function(error) {
    if (error) console.error('Error listening on 0.0.0.0:'+config.port+'\n'+error);
    else console.log('Listening at http://localhost:'+config.port);
  });
}