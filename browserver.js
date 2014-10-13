chrome.app.runtime.onLaunched.addListener(function() {
  kernel.use({http: 0, html: 0, database: 0, xhr: 0, string: 0, async: 0}, function(o) {
  
    var key = sjcl.codec.utf8String.toBits('yabadabadoo'),
        fromBits = sjcl.codec.base64.fromBits,
        toBits = sjcl.codec.base64.toBits;
    
    var sid = function() {
      // session id can be predictable, so no 'paranoia' necessary
      var data = sjcl.random.randomWords(6, 0),
          base64 = fromBits(data, true, true);
      return {
        signed: base64+'.'+fromBits(new sjcl.misc.hmac(key).mac(data), true, true),
        unsigned: base64
      };
    };
    var verify = function(signed) {
      try {
        signed = signed.split('.', 2);
        return fromBits(new sjcl.misc.hmac(key).mac(toBits(signed[0], true)), true, true) == signed[1];
      } catch (e) {}
    };
    var pbkdf2 = function(password, salt) {
      var value = sjcl.misc.cachedPbkdf2(password, salt && {salt: toBits(salt, true)});
      return {key: fromBits(value.key, true, true), salt: fromBits(value.salt, true, true)};
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
          if (request.method == 'POST' && request.post.username) {
            return o.database.get('users/'+encodeURIComponent(request.post.username), function(user) {
              if (!user || user.password !== pbkdf2(request.post.password, user.salt).key)
                return render(['Invalid login. ', {a: {href: '/login', children: 'Try again'}}], 401);
              var session = sid();
              o.database.put('sessions/'+session.unsigned, request.post.username, function() {
                response.end('Login successful', {'Set-Cookie': 'sid='+session.signed, Location: '/'}, 303);
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
          return logoff(request.cookie.sid.split('.')[0], 'Logged off');
        case '/register':
          if (request.method == 'POST' && request.post.username) {
            // TODO: make this transactional with a transaction api in database.js
            var path = 'users/'+encodeURIComponent(request.post.username);
            return o.database.get(path, function(user) {
              if (!user) {
                // TODO: create empty sessions and users objects if necessary
                var session = sid(),
                    hash = pbkdf2(request.post.password);
                return o.async.join(
                  function(callback) { o.database.put(path, {name: request.post.name, password: hash.key, salt: hash.salt}, callback); },
                  function(callback) { o.database.put('sessions/'+session.unsigned, request.post.username, callback); },
                  function() { response.end('User created', {'Set-Cookie': 'sid='+session.signed, Location: '/'}, 303); }
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
      response.end('404 Resource not found', null, 404);
    });
    
    // time tracker
    o.http.serve({port: 3088}, function(request, response) {
      var match;
      if (request.method == 'DELETE' && (match = /^\/(entries\/\d{4}-\d{2}-\d{2})\/([^\/]*)$/.exec(request.path)))
        return o.database.get(match[1], function(date) {
          var issues = date && Object.keys(date);
          if (issues && issues.length > 1)
            return o.database.delete(request.path.substr(1), function() {
              response.end('Success');
            });
          if (!issues || issues[0] != decodeURIComponent(match[2]))
            return response.end('Success');
          o.database.delete(match[1], function() {
            response.end('Success');
          });
        });
      switch (request.path) {
        case '/issues':
          if (!request.headers.Authorization)
            return response.end(o.http.getStatus(401), {'WWW-Authenticate': 'Basic realm="redmine.slytrunk.com credentials"'}, 401);
          var credentials = atob(request.headers.Authorization.split(' ')[1] || '').split(':', 2);
          return o.xhr('http://redmine.slytrunk.com/issues.json?assigned_to_id=me&status_id=*&limit=100', {
            user: credentials[0],
            password: credentials[1],
            responseType: 'json'
          }, function(e) {
            if (!e.target.response)
              return response.end(o.http.getStatus(500), null, 500);
            var issues = {};
            e.target.response.issues.forEach(function(issue) {
              issues[issue.id] = {id: issue.id, name: issue.project.name+' - '+issue.subject, url: 'http://redmine.slytrunk.com/issues/'+issue.id};
            });
            response.end(JSON.stringify(issues), {'Content-Type': 'application/json'});
          });
        case '/entries':
          switch (request.method) {
            case 'POST':
              try {
                var entry = JSON.parse(o.string.fromUTF8Buffer(request.body));
                if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date) || typeof entry.time != 'number')
                  throw 'invalid input';
                return o.database.get('entries/'+entry.date, function(entries) {
                  if (entries) return o.database.put('entries/'+entry.date+'/'+encodeURIComponent(entry.issue), entry.time, function() {
                    response.end('Success');
                  });
                  var e = {}; e[entry.issue] = entry.time;
                  o.database.put('entries/'+entry.date, e, function() {
                    response.end('Success');
                  });
                });
              } catch (e) {
                return response.end(o.http.getStatus(400), null, 400);
              }
            case 'GET':
              return o.database.get('entries', function(entries) {
                response.end(JSON.stringify(entries), {'Content-Type': 'application/json'});
              });
          }
          return response.end(o.http.getStatus(501), null, 501);
        case '/':
          return response.end(o.html.markup({html: [
            {head: [
              {title: 'Time Tracker'},
              {meta: {charset: 'utf-8'}},
              {meta: {name: 'viewport', content: 'width=device-width, initial-scale=1.0, user-scalable=no'}},
              {link: {rel: 'stylesheet', href: 'http://localhost:8088/time-tracker.css'}}
            ]},
            {body: [
              {script: {src: 'http://localhost:8088/lib/kernel.js'}},
              {script: {src: 'http://localhost:8088/lib/html.js'}},
              {script: {src: 'http://localhost:8088/lib/xhr.js'}},
              {script: {src: 'http://localhost:8088/lib/async.js'}},
              {script: function() {
                kernel.use({html: 0, xhr: 0, async: 0}, function(o) {
                  var issues = {}, issue, hours, entries, add, form, suggest, previous,
                      days = 'Sun Mon Tues Wed Thurs Fri Sat'.split(' '),
                      months = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' '),
                      today = new Date();
                  var dateString = function(d) {
                    var y = d.getFullYear(),
                        m = d.getMonth()+1,
                        d = d.getDate();
                    return y+'-'+(m < 10 ? '0'+m : m)+'-'+(d < 10 ? '0'+d : d);
                  };
                  var dateIcon = function(date, click) {
                    return {div: {className: 'date'+(date.getDay() in {0:1,6:1} ? ' weekend' : ''), onclick: click, children: [
                      {div: days[date.getDay()]},
                      months[date.getMonth()]+' '+date.getDate()
                    ]}};
                  };
                  o.async.join(
                    function(callback) {
                      o.xhr('/entries', {responseType: 'json'}, function(e) {
                        callback(e.target.response);
                      });
                    },
                    function(callback) {
                      o.xhr('/issues', {responseType: 'json'}, function(e) {
                        callback(issues = e.target.response);
                      });
                    },
                    function(dates) {
                      var page = 0, now = Date.now();
                      previous.textContent = 'Previous';
                      previous.disabled = add.disabled = false;
                      (previous.onclick = function() {
                        new Array(15).join(' ').split('').forEach(function(x, i) {
                          var date = dateString(new Date(now-(page*14+i)*24*60*60*1000));
                          entries.insert(o.html.model(dates[date] || {}, function(hours, issue, index, items) {
                            return {li: [
                              {button: {className: 'remove', children: '✕', onclick: function(e) {
                                this.disabled = true;
                                o.xhr('/entries/'+date+'/'+encodeURIComponent(issue), {method: 'DELETE'}, function() {
                                  items.remove(issue);
                                });
                              }}},
                              {div: {className: 'time', children: hours+' hr'}},
                              {div: {className: 'name', children: issues[issue] ? issues[issue].name : issue}}
                            ]};
                          }), date);
                        });
                        page++;
                      })();
                    }
                  );
                  o.html.dom([
                    {div: {className: 'form', children: function(e) {
                      form = e;
                      return [
                        dateIcon(today),
                        {div: {className: 'issue', children: [
                          {input: {type: 'text', placeholder: 'issue', onkeyup: function(e) {
                            issue = this.value;
                            var items = issue.length < 2 ? [] : Object.keys(issues).map(function(id) {
                              return [id, issues[id]];
                            }).filter(function(item) {
                              return (item[1].id+item[1].name.toLowerCase()).indexOf(issue.toLowerCase()) > -1;
                            });
                            o.html.dom(items.map(function(item) {
                              return {li: {children: item[1].name, onclick: function() {
                                issue = item[0];
                                e.target.value = item[1].name;
                                o.html.dom(null, suggest, true);
                                hours.focus();
                              }}};
                            }), suggest, true);
                          }, onfocus: function() {
                            suggest.style.display = 'block';
                          }, onblur: function() {
                            setTimeout(function() {
                              suggest.style.display = 'none'; // TODO: more elegant solution?
                            }, 500);
                          }}},
                          {ul: function(e) { suggest = e; }}
                        ]}},
                        {input: {type: 'text', className: 'hours', placeholder: 'hours', children: function(e) { hours = e; }}},
                        {button: {children: function(e) { add = e; return 'Add'; }, disabled: true, onclick: function(e) {
                          this.disabled = true;
                          var entry,
                              date = dateString(today),
                              time = parseFloat(hours.value);
                          if (!time || time < 0) {
                            alert('Invalid number of hours');
                          } else {
                            o.xhr('/entries', {
                              method: 'POST',
                              data: JSON.stringify({date: date, time: time, issue: issue})
                            }, function() {
                              e.target.disabled = false;
                              entries.get(date).insert(time, issue);
                            });
                          }
                        }}}
                      ];
                    }}},
                    {ul: {className: 'list', children: (entries = o.html.model({}, function(value, date) {
                      date = date.split('-');
                      date = new Date(date[0], parseInt(date[1], 10)-1, parseInt(date[2], 10));
                      return {li: [
                        dateIcon(date, function() {
                          form.replaceChild(o.html.dom(dateIcon(today = date)), form.firstChild);
                        }),
                        {ul: value.view}
                      ]};
                    })).view}},
                    {button: {className: 'previous', children: function(e) { previous = e; return 'Loading...'; }, disabled: true}}
                  ], document.body);
                });
              }}
            ]}
          ]}), {'Content-Type': 'text/html'});
      }
      response.end('404 Resource not found', null, 404);
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
        return o.xhr(request.path, {responseType: 'arraybuffer'}, function(e) {
          if (e.target.status != 200)
            return response.end('404 Resource not found', null, 404);
          response.end(e.target.response, {'Content-Type': o.http.getMimeType((request.path.match(/\.([^.]*)$/) || [])[1])});
        });
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
            {script: {src: '/lib/kernel.js'}},
            {script: {src: '/lib/html.js'}},
            {script: {src: '/lib/jsonv.js'}},
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
