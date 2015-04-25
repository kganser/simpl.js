function(modules) {
  
  var db = modules.database.open('simple-login', {sessions: {}, users: {}}),
      encode = modules.string.base64FromBuffer,
      decode = modules.string.base64ToBuffer,
      utf8 = modules.string.toUTF8Buffer,
      mac = modules.crypto.hmac(utf8(config.sessionKey));
  
  var token = function() {
    var rand = crypto.getRandomValues(new Uint8Array(24));
    return encode(rand, true)+'.'+encode(mac(rand), true);
  };
  var verify = function(signed) {
    if (typeof signed != 'string') return;
    var parts = signed.split('.');
    return encode(mac(decode(parts[0], true)), true) == parts[1] && signed;
  };
  var pbkdf2 = function(password, salt) {
    return encode(modules.crypto.pbkdf2(utf8(password), salt));
  };
  
  modules.http.serve({port: config.port}, function(request, response) {
    var render = function(body, status) {
      response.end(modules.html.markup([
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
    var sid;
    switch (request.path) {
      case '/':
        if (sid = verify(request.cookie.sid))
          return db.get('sessions/'+sid).then(function(username) {
            if (!username) return logout();
            this.get('users/'+encodeURIComponent(username)).then(function(user) {
              if (!user) return logout(sid);
              render(['Welcome, '+user.name+'! ', {a: {href: '/logout', children: 'Log out'}}]);
            });
          });
        return render(['Please ', {a: {href: '/register', children: 'Register'}}, ' or ', {a: {href: '/login', children: 'Log in'}}, '.']);
      case '/login':
        if (request.method == 'POST' && (request.headers['Content-Type'] || '').split(';')[0] == 'application/x-www-form-urlencoded')
          return request.slurp(function(body) {
            db.get('users/'+encodeURIComponent(body.username), true).then(function(user) {
              if (!user || user.password !== pbkdf2(body.password, decode(user.salt)))
                return render(['Invalid login. ', {a: {href: '/login', children: 'Try again'}}], 401);
              this.put('sessions/'+(sid = token()), body.username).then(function() {
                response.generic(303, {'Set-Cookie': 'sid='+sid, Location: '/'});
              });
            });
          }, 'url');
        return render([{form: {method: 'post', action: '/login', children: [
          {label: 'Username: '}, {input: {type: 'text', name: 'username'}}, {br: null},
          {label: 'Password: '}, {input: {type: 'password', name: 'password'}}, {br: null},
          {input: {type: 'submit', value: 'Log In'}}
        ]}}]);
      case '/logout':
        return logout(verify(request.cookie.sid));
      case '/register':
        if (request.method == 'POST' && (request.headers['Content-Type'] || '').split(';')[0] == 'application/x-www-form-urlencoded')
          return request.slurp(function(body) {
            var path = 'users/'+encodeURIComponent(body.username);
            db.get(path, true).then(function(user) {
              if (user) return render(['Username '+body.username+' is already taken. ', {a: {href: '/register', children: 'Try again'}}], 401);
              var salt = crypto.getRandomValues(new Uint8Array(8));
              this.put(path, {name: body.name, password: pbkdf2(body.password, salt), salt: encode(salt)})
                  .put('sessions/'+(sid = token()), body.username)
                  .then(function() { response.generic(303, {'Set-Cookie': 'sid='+sid, Location: '/'}); });
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
    if (error) console.error('Error listening on 0.0.0.0:'+config.port+'\n'+error);
    else console.log('Listening at http://localhost:'+config.port);
  });
}