function(modules) {

  if (!config.sessionKey)
    console.log('Set config.sessionKey to preserve logins on server restart');
  
  var database = modules.database || modules['database@simpljs'],
      html = modules.html || modules['html@simpljs'],
      http = modules.http || modules['http@simpljs'],
      string = modules.string || modules['string@simpljs'],
      db = database.open('simple-login', {sessions: {}, users: {}}),
      encode = string.base64FromBuffer,
      decode = string.base64ToBuffer,
      utf8 = string.toUTF8Buffer,
      sessionKey = config.sessionKey ? utf8(config.sessionKey) : crypto.getRandomValues(new Uint8Array(24)),
      key = crypto.subtle.importKey('raw', sessionKey, {name: 'hmac', hash: 'sha-256'}, false, ['sign']),
      port = config.port || 8003;

  var mac = function(data) {
    return key.then(function(key) {
      return crypto.subtle.sign({name: 'hmac', hash: 'sha-256'}, key, data);
    });
  };
  var token = function() {
    var rand = crypto.getRandomValues(new Uint8Array(24));
    return mac(rand).then(function(mac) {
      return encode(rand, true)+'.'+encode(mac, true);
    });
  };
  var verify = function(token) {
    if (!token) return Promise.resolve();
    var parts = token.split('.');
    return mac(decode(parts[0], true)).then(function(mac) {
      return encode(mac, true) == parts[1] && token;
    });
  };
  var pbkdf2 = function(password, salt) {
    return crypto.subtle.importKey('raw', utf8(password), 'pbkdf2', false, ['deriveKey']).then(function(key) {
      return crypto.subtle.deriveKey({name: 'pbkdf2', salt: salt, iterations: 20000, hash: 'sha-256'}, key, {name: 'aes-cbc', length: 256}, true, ['encrypt']);
    }).then(function(key) {
      return crypto.subtle.exportKey('raw', key);
    }).then(function(hash) {
      return encode(hash, true);
    });
  };
  http.serve({port: port}, function(request, response) {
    var render = function(body, status) {
      response.end(html.markup([
        {'!doctype': {html: null}},
        {html: [
          {head: [{title: 'Simple Login'}]},
          {body: body}
        ]}
      ]), 'html', status);
    };
    var logout = function(sid) {
      if (sid) db.delete('sessions/'+sid).then(function() { logout(); });
      else response.generic(303, {'Set-Cookie': 'sid=; Expires='+new Date().toUTCString(), Location: '/'});
    };
    var post = request.method == 'POST' && (request.headers['Content-Type'] || '').split(';')[0] == 'application/x-www-form-urlencoded';
    switch (request.path) {
      case '/':
        return verify(request.cookie.sid).then(function(sid) {
          if (!sid) return render(['Please ', {a: {href: '/register', children: 'Register'}}, ' or ', {a: {href: '/login', children: 'Log in'}}, '.']);
          db.get('sessions/'+sid).then(function(username) {
            if (!username) return logout();
            this.get('users/'+encodeURIComponent(username)+'/name').then(function(name) {
              if (!name) return logout(sid);
              render(['Welcome, '+name+'! ', {a: {href: '/logout', children: 'Log out'}}]);
            });
          });
        });
      case '/login':
        if (post) return request.slurp(function(body) {
          db.get('users/'+encodeURIComponent(body.username)+'/password').then(function(auth) {
            if (!auth) return render(['Invalid login. ', {a: {href: '/login', children: 'Try again'}}], 401);
            auth = auth.split('.');
            pbkdf2(body.password, decode(auth[1], true)).then(function(hash) {
              if (hash != auth[2]) return render(['Invalid login. ', {a: {href: '/login', children: 'Try again'}}], 401);
              token().then(function(sid) {
                db.put('sessions/'+sid, body.username).then(function() {
                  response.generic(303, {'Set-Cookie': 'sid='+sid, Location: '/'});
                });
              });
            });
          });
        }, 'url');
        return render([{form: {method: 'post', action: '/login', children: [
          {label: 'Username: '}, {input: {type: 'text', name: 'username'}}, {br: null},
          {label: 'Password: '}, {input: {type: 'password', name: 'password'}}, {br: null},
          {input: {type: 'submit', value: 'Log In'}}
        ]}}]);
      case '/logout':
        return verify(request.cookie.sid).then(logout);
      case '/register':
        if (post) return request.slurp(function(body) {
          var salt = crypto.getRandomValues(new Uint8Array(8));
          Promise.all([token(), pbkdf2(body.password, salt)]).then(function(values) {
            var path = 'users/'+encodeURIComponent(body.username);
            db.get(path, true).then(function(user) {
              if (user) return render(['Username '+body.username+' is already taken. ', {a: {href: '/register', children: 'Try again'}}], 401);
              this.put(path, {name: body.name, password: 'pbkdf2_sha256_20000.'+encode(salt, true)+'.'+values[1]})
                  .put('sessions/'+values[0], body.username)
                  .then(function() { response.generic(303, {'Set-Cookie': 'sid='+values[0], Location: '/'}); });
            });
          });
        }, 'url');
        return render([{form: {method: 'post', action: '/register', children: [
          {label: 'Name: '}, {input: {type: 'text', name: 'name'}}, {br: null},
          {label: 'Username: '}, {input: {type: 'text', name: 'username'}}, {br: null},
          {label: 'Password: '}, {input: {type: 'password', name: 'password'}}, {br: null},
          {input: {type: 'submit', value: 'Register'}}
        ]}}]);
    }
    response.generic(404);
  }, function(error) {
    if (error) console.error('Error listening on port '+port+'\n'+error);
    else console.log('Listening at http://localhost:'+port);
  });
}