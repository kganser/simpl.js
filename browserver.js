chrome.app.runtime.onLaunched.addListener(function() {
  kernel.use({http: 0, html: 0, database: 0, string: 0, async: 0}, function(o) {
  
    var key = 'yabadabadoo';
    var sid = function() {
      // session id can be predictable, so no 'paranoia' necessary
      return sjcl.codec.base64.fromBits(sjcl.random.randomWords(6, 0), true, true);
    };
    
    // login site
    o.http.serve({port: 4088}, function(request, response) {
      var render = function(body, status) {
        response.end(o.html.markup({html: [{body: body}]}), {'Content-Type': 'text/html'}, status);
      };
      var logoff = function(cookie, message) {
        if (cookie) return o.database.delete('sessions/'+encodeURIComponent(cookie), function() { logoff(null, message); });
        response.end(message, {'Set-Cookie': 'sid=; Expires='+new Date().toUTCString(), Location: '/'}, 303);
      };
      switch (request.path) {
        case '/':
          // TODO: add and verify cookie signature
          if (request.cookie.sid) {
            return o.database.get('sessions/'+encodeURIComponent(request.cookie.sid), function(username) {
              if (!username) return logoff(null, 'Invalid session');
              o.database.get('users/'+encodeURIComponent(username), function(user) {
                if (!user) return logoff(request.cookie.sid, 'Unknown user');
                render(['Welcome, '+user.name+'! ', {a: {href: '/logoff', children: 'Log off'}}]);
              });
            });
          }
          return render(['Please ', {a: {href: '/register', children: 'Register'}}, ' or ', {a: {href: '/login', children: 'Log in'}}, '.']);
        case '/login':
          if (request.method == 'POST' && request.post.username) {
            return o.database.get('users/'+encodeURIComponent(request.post.username), function(user) {
              if (!user || user.password !== request.post.password)
                return render(['Invalid login. ', {a: {href: '/login', children: 'Try again'}}], 401);
              var session = sid();
              o.database.put('sessions/'+session, request.post.username, function() {
                response.end('Login successful', {'Set-Cookie': 'sid='+session, Location: '/'}, 303);
              });
            });
          }
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
          return logoff(request.cookie.sid, 'Logged off');
        case '/register':
          if (request.method == 'POST' && request.post.username) {
            // TODO: make this transactional with a transaction api in database.js
            var path = 'users/'+encodeURIComponent(request.post.username);
            return o.database.get(path, function(user) {
              if (!user) {
                // TODO: create empty sessions and users objects if necessary
                // TODO: use password hash and salt
                var session = sid();
                return o.async.join(
                  function(callback) { o.database.put(path, {name: request.post.name, password: request.post.password}, callback); },
                  function(callback) { o.database.put('sessions/'+session, request.post.username, callback); },
                  function() { response.end('User created', {'Set-Cookie': 'sid='+session, Location: '/'}, 303); }
                );
              }
              render(['Username '+request.post.username+' is already taken. ', {a: {href: '/register', children: 'Try again'}}], 401);
            });
          }
          return render([{form: {method: 'post', action: '/register', children: [
            {label: 'Name: '},
            {input: {type: 'text', name: 'name'}},
            {br: null},
            {label: 'Username: '},
            {input: {type: 'text', name: 'username'}},
            {br: null},
            {label: 'Password: '},
            {input: {type: 'password', name: 'password'}},
            {br: null},
            {input: {type: 'submit', value: 'Register'}}
          ]}}]);
      }
    });
    
    // database site
    o.http.serve({port: 8088}, function(request, response) {
      if (request.headers.View == 'data' || request.query.view == 'data') {
        var path = request.path.substr(1),
            errorHandler = function(error) {
              response.end(error ? '403 '+error : '200 Success', null, error ? 403 : 200);
            };
        switch (request.method) {
          case 'GET':
            return o.database.get(path, function(object) {
              if (object === undefined) response.end('404 Resource not found', null, 404);
              response.end(JSON.stringify(object), {'Content-Type': 'application/json'});
            });
          case 'PUT':
          case 'POST':
          case 'INSERT':
            var data = o.string.fromUTF8Buffer(request.body);
            try { data = JSON.parse(data); } catch (e) {}
            return request.method == 'POST'
              ? o.database.append(path, data, errorHandler)
              : o.database.put(path, data, request.method == 'INSERT', errorHandler);
          case 'DELETE':
            return o.database.delete(path, errorHandler);
          default:
            return response.end('501 Method not implemented', null, 501);
        }
      }
      if (request.path.length > 1) { // proxy request
        var xhr = new XMLHttpRequest();
        xhr.responseType = 'arraybuffer';
        xhr.onload = function() {
          response.end(xhr.response, {'Content-Type': o.http.getMimeType((request.path.match(/\.([^.]*)$/) || [])[1])});
        };
        xhr.onerror = function() {
          response.end('404 Resource not found', null, 404);
        };
        xhr.open('GET', request.path);
        return xhr.send();
      }
      o.database.get('', function(data) {
        response.end(o.html.markup([
          {'!doctype': {html: null}},
          {head: [
            {title: 'Browserver'},
            {meta: {charset: 'utf-8'}},
            {link: {rel: 'stylesheet', href: '/browserver.css'}},
            {link: {rel: 'shortcut icon', href: '/icon.png'}}
          ]},
          {body: [
            {pre: {id: 'value', 'class': 'json', children: JSON.stringify(data, null, 2)}},
            {script: {src: '/kernel.js'}},
            {script: {src: '/html.js'}},
            {script: {src: '/jsonv.js'}},
            {script: function(json) {
              if (!json) return JSON.stringify(data);
              kernel.use({jsonv: 0}, function(o) {
                o.jsonv(json, document.getElementById('value'));
              });
            }}
          ]}
        ]), {'Content-Type': 'text/html'});
      });
    });
  });
});
