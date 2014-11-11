simpl.use({http: 0, database: 0, html: 0, string: 0, async: 0, crypto: 0}, function(o) {

  ['sessions', 'users'].forEach(function(path) {
    o.database.get(path, function(data) {
      if (!data) o.database.put(path, {});
    });
  });
  
  var key = o.crypto.codec.utf8String.toBits(config.sessionKey),
      fromBits = o.crypto.codec.base64.fromBits,
      toBits = o.crypto.codec.base64.toBits;
  
  var sid = function() {
    var data = o.crypto.random.randomWords(6, 0),
        base64 = fromBits(data, true, true);
    return {
      signed: base64+'.'+fromBits(new o.crypto.misc.hmac(key).mac(data), true, true),
      unsigned: base64
    };
  };
  var verify = function(signed) {
    try {
      signed = signed.split('.', 2);
      return fromBits(new o.crypto.misc.hmac(key).mac(toBits(signed[0], true)), true, true) == signed[1];
    } catch (e) {}
  };
  var pbkdf2 = function(password, salt) {
    var value = o.crypto.misc.cachedPbkdf2(password, salt && {salt: toBits(salt, true)});
    return {key: fromBits(value.key, true, true), salt: fromBits(value.salt, true, true)};
  };
  
  o.http.serve({port: config.port}, function(request, response) {
    var render = function(body, status) {
      response.end(o.html.markup({html: [{body: body}]}), {'Content-Type': o.http.mimeType('html')}, status);
    };
    var logoff = function(cookie, message) {
      if (cookie) return o.database.delete('sessions/'+encodeURIComponent(cookie), function() { logoff(null, message); });
      response.end(message, {'Set-Cookie': 'sid=; Expires='+new Date().toUTCString(), Location: '/'}, 303);
    };
    switch (request.path) {
      case '/':
        if (verify(request.cookie.sid)) {
          var session = request.cookie.sid.split('.')[0];
          return o.database.get('sessions/'+encodeURIComponent(session), function(username) {
            if (!username) return logoff(null, 'Invalid session');
            o.database.get('users/'+encodeURIComponent(username), function(user) {
              if (!user) return logoff(session, 'Unknown user');
              render(['Welcome, '+user.name+'! ', {a: {href: '/logoff', children: 'Log off'}}]);
            });
          });
        }
        return render(['Please ', {a: {href: '/register', children: 'Register'}}, ' or ', {a: {href: '/login', children: 'Log in'}}, '.']);
      case '/login':
        if (request.method == 'POST' && (request.headers['Content-Type'] || '').split(';')[0] == 'application/x-www-form-urlencoded')
          return request.slurp(function(body) {
            body = o.http.parseQuery(o.string.fromUTF8Buffer(body));
            o.database.get('users/'+encodeURIComponent(body.username), function(user) {
              if (!user || user.password !== pbkdf2(body.password, user.salt).key)
                return render(['Invalid login. ', {a: {href: '/login', children: 'Try again'}}], 401);
              var session = sid();
              o.database.put('sessions/'+session.unsigned, body.username, function() {
                response.end('Login successful', {'Set-Cookie': 'sid='+session.signed, Location: '/'}, 303);
              });
            });
          });
        return render([{form: {method: 'post', action: '/login', children: [
          {label: 'Username: '},
          {input: {type: 'text', name: 'username'}},
          {br: null},
          {label: 'Password: '},
          {input: {type: 'password', name: 'password'}},
          {br: null},
          {input: {type: 'submit', value: 'Log In'}}
        ]}}]);
      case '/logoff':
        return logoff(request.cookie.sid.split('.')[0], 'Logged off');
      case '/register':
        if (request.method == 'POST' && (request.headers['Content-Type'] || '').split(';')[0] == 'application/x-www-form-urlencoded')
          return request.slurp(function(body) {
            body = o.http.parseQuery(o.string.fromUTF8Buffer(body));
            var path = 'users/'+encodeURIComponent(body.username);
            // TODO: make this transactional with a transaction api in database.js
            o.database.get(path, function(user) {
              if (!user) {
                var session = sid(),
                    hash = pbkdf2(body.password);
                return o.async.join(
                  function(callback) { o.database.put(path, {name: body.name, password: hash.key, salt: hash.salt}, callback); },
                  function(callback) { o.database.put('sessions/'+session.unsigned, body.username, callback); },
                  function() { response.end('User created', {'Set-Cookie': 'sid='+session.signed, Location: '/'}, 303); }
                );
              }
              render(['Username '+body.username+' is already taken. ', {a: {href: '/register', children: 'Try again'}}], 401);
            });
          });
        return render([{form: {method: 'post', action: '/register', children: [
          {label: 'Name: '},
          {input: {type: 'text', name: 'name'}}, {br: null},
          {label: 'Username: '},
          {input: {type: 'text', name: 'username'}}, {br: null},
          {label: 'Password: '},
          {input: {type: 'password', name: 'password'}}, {br: null},
          {input: {type: 'submit', value: 'Register'}}
        ]}}]);
    }
    response.generic(404);
  }, function(error) {
    if (error) console.error('Error listening on 0.0.0.0:'+config.port+'\n'+error);
    else console.log('Listening at http://localhost:'+config.port);
  });
});
