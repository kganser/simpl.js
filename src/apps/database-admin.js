function(modules) {
  
  // uri    := path? branch?
  // branch := '[' path branch? ( ',' path branch? )+ ']'
  // path   := segment ( '/' segment )*
  var stringify = function stringify(map, prefix) { //-
    var keys = Object.keys(map);
    return !keys.length ? ''
      : keys.length == 1 ? (prefix || '')+encodeURIComponent(keys[0])+stringify(map[keys[0]], '/')
      : '['+keys.map(function(key) {
          return encodeURIComponent(key)+stringify(map[key], '/');
        }).join(',')+']';
  };
  var parse = function(path) { //-
    var i, map = {}, stack = [], node = map;
    while (path) {
      if (i = path.search(/[[\],]/)) {
        stack.push(node);
        (i > 0 ? path.substr(0, i) : path).split('/').forEach(function(segment) {
          node = node[decodeURIComponent(segment)] = {};
        });
      }
      if (i < 0) break;
      if (path[i] != '[') node = stack.pop();
      path = path.substr(i+1);
    }
    return map;
  };
  var template = function(body, db) { //-
    return html.markup([
      {'!doctype': {html: null}},
      {head: [
        {title: (db ? db+' - ' : '')+'Database Admin'},
        {meta: {charset: 'utf-8'}},
        {style: html.css({
          body: {
            font: '13px sans-serif',
            webkitTextSizeAdjust: 'none'
          },
          svg: {
            width: '1.2em',
            height: '1.2em',
            margin: '0 .5em',
            verticalAlign: 'bottom',
            fill: '#aaa'
          },
          'form input': {
            outline: 'none',
            border: 'solid 1px #ececec',
            height: '23px',
            padding: '0 5px'
          },
          'form button': {
            outline: 'none',
            border: 'none',
            background: '#3c3',
            color: 'white',
            cursor: 'pointer',
            padding: '0 8px',
            height: '25px'
          },
          'button.delete': {
            background: 'transparent',
            color: '#aaa',
            padding: '0 5px',
            height: '17px'
          },
          'button.delete:hover': {
            background: '#c5201c',
            color: 'white'
          },
          '#icons': {
            display: 'none'
          },
          '.databases': {
            listStyle: 'none',
            padding: 0,
            lineHeight: 1.5
          },
          '.databases a, a.home': {
            textDecoration: 'none',
            color: '#1c00cf'
          },
          'a.home:before': {
            content: '""',
            display: 'inline-block',
            border: '0 solid transparent',
            borderWidth: '.35em .6em .35em 0',
            borderRightColor: '#aaa'
          },
          'a:hover svg, a:focus svg, a:active svg': {
            fill: '#5a5a5a'
          },
          'a.home:hover:before, a.home:focus:before, a.home:active:before': {
            borderRightColor: '#5a5a5a'
          }
        })},
        db && {link: {rel: 'stylesheet', href: '/static/jsonv.css'}}
      ]},
      {body: [
        {svg: {id: 'icons', children: [
          {symbol: {id: 'icon-database', viewBox: '0 0 20 20', children: {path: {d: 'M16.726,12.641c-0.843,1.363-3.535'+
            ',2.361-6.726,2.361c-3.191,0-5.883-0.998-6.727-2.361C3.095,12.351,3,12.506,3,12.648c0,0.144,0,2.002,0,2.00'+
            '2C3,16.59,6.134,18.6,10,18.6s7-2.01,7-3.949c0,0,0-1.858,0-2.002C17,12.506,16.904,12.351,16.726,12.641zM16'+
            '.737,7.525c-0.83,1.205-3.532,2.09-6.737,2.09c-3.205,0-5.908-0.885-6.738-2.09C3.091,7.277,3,7.412,3,7.523c'+
            '0,0.113,0,2.357,0,2.357c0,1.762,3.134,3.189,7,3.189s7-1.428,7-3.189c0,0,0-2.244,0-2.357C17,7.412,16.908,7'+
            '.277,16.737,7.525zM10,1C6.134,1,3,2.18,3,3.633v1.26c0,1.541,3.134,2.791,7,2.791s7-1.25,7-2.791v-1.26C17,2'+
            '.18,13.866,1,10,1z'}}}}]}},
        body
      ]}
    ]);
  };
  
  var database = modules.database || modules['database@simpljs'],
      html = modules.html || modules['html@simpljs'],
      http = modules.http || modules['http@simpljs'],
      string = modules.string || modules['string@simpljs'],
      csrf = string.base64FromBuffer(crypto.getRandomValues(new Uint8Array(24)), true),
      port = config.port || 8002;
  
  http.serve({port: port}, function(request, response) {
    var db;
    if (request.path == '/') {
      if (request.method == 'POST')
        return request.slurp(function(body) {
          var dbs, done = function() {
            if (db) db.close();
            if (dbs) dbs.close();
            response.generic(303, {Location: '/'});
          };
          if (body.token != csrf)
            return response.generic(403);
          if (body.action == 'delete' && body.name)
            return database.delete(body.name, function(error) {
              if (error) return done();
              (dbs = database.open('_dbs')).delete(encodeURIComponent(body.name)).then(done);
            });
          if (body.action == 'add' && body.name)
            return (db = database.open(body.name)).get('', true, 'shallow').then(function create(exists) {
              if (!exists) return this.put('', {}).then(function() { create(true); });
              (dbs = database.open('_dbs')).put(encodeURIComponent(body.name), 1).then(done);
            });
          done();
        }, 'url');
      return (db = database.open('_dbs')).get('', true).then(function(dbs) {
        if (dbs) db.close();
        else this.put('', {}).then(db.close);
        response.end(template([
          {ul: {class: 'databases', children: Object.keys(dbs || {}).map(function(name) {
            return {li: [
              {form: {method: 'post', onsubmit: 'return confirm("Permanently delete database '+name+'?");', children: [
                {input: {type: 'hidden', name: 'token', value: csrf}},
                {input: {type: 'hidden', name: 'action', value: 'delete'}},
                {button: {type: 'submit', class: 'delete', name: 'name', value: name, children: '×'}},
                {a: {href: '/'+encodeURIComponent(name), children: [
                  {svg: [{use: {'xlink:href': '#icon-database'}}]},
                  name
                ]}}
              ]}}
            ]};
          })}},
          {form: {
            method: 'post',
            onsubmit: 'if (!this.name.value) { alert("Database name required"); this.name.focus(); return false; }',
            children: [
              {input: {placeholder: 'New Database', name: 'name'}},
              {input: {type: 'hidden', name: 'token', value: csrf}},
              {button: {type: 'submit', name: 'action', value: 'add', children: 'Add'}}
            ]
          }}
        ]), {
          'Content-Type': 'text/html',
          'X-CSRF-Token': csrf
        });
      });
    }
    var name = decodeURIComponent(request.path.match(/^\/([^/]*)/)[1]),
        path = request.path.substr(name.length+2),
        json = request.headers.Accept == 'application/json' || request.query.format == 'json';
    if (!json && (path || name == 'favicon.ico'))
      return fetch(location.origin+'/'+path).then(function(r) {
        if (!r.ok) return response.generic(404);
        r.arrayBuffer().then(function(body) {
          response.end(body, (path.match(/\.([^.]*)$/) || [])[1]);
        });
      }).catch(function() {
        response.generic(404);
      });
    var open = function() {
      var upgrade;
      return db = database.open(name, function() { upgrade = true; }, undefined, function(e) {
        db.close();
        if (!upgrade) return response.end(e.message, null, 500);
        database.delete(name);
        response.generic(404);
      });
    };
    if (json) {
      switch (request.method) {
        case 'GET':
          if ('download' in request.query) {
            var root = path;
            return function get(tx, path, callback, start) {
              var next, brackets;
              tx.get(path, function(keys, array) {
                if (keys.length) return false;
                if (path == root && start == null) response.send('', 'json');
                brackets = array ? '[]' : '{}';
                if (start == null) response.send(brackets[0]);
                return {
                  lowerBound: start,
                  lowerExclusive: start != null,
                  action: function(key) {
                    if (next != null) return 'stop';
                  },
                  value: function(key, value) {
                    if (key == null || value === undefined) return;
                    if (value && typeof value == 'object') next = key;
                    var chunk = (start == null ? '' : ',')+
                      (array ? '' : JSON.stringify(key)+':')+
                      (next == null ? JSON.stringify(value) : '');
                    if (chunk) response.send(chunk);
                    start = true;
                  }
                };
              }).then(function() {
                if (next == null) {
                  response.send(brackets[1]);
                  if (callback) return callback.call(this);
                  response.end();
                  db.close();
                } else {
                  get(this, (path ? path+'/' : '')+encodeURIComponent(next), function() {
                    get(this, path, callback, next);
                  });
                }
              });
            }(open().transaction(), path);
          }
          var after = request.query.after,
              i = 0;
          return open().get(path, false, function(path, array) {
            if (path.length) return false;
            if (array) {
              after = Math.max(parseInt(after, 10), -1);
              if (isNaN(after) || after < 0) after = null;
            }
            var action = function() {
              if (i++ == 100) return 'stop';
            };
            return after == null ? action : {
              lowerBound: after,
              lowerExclusive: true,
              action: action
            };
          }).then(function(object) {
            db.close();
            if (object === undefined) response.generic(404);
            response.end(JSON.stringify({data: object, remaining: i > 100}), 'json');
          });
        case 'PUT':
        case 'POST':
        case 'INSERT':
          if (request.headers.Authorization != csrf)
            return response.generic(403);
          return request.slurp(function(body) {
            if (body === undefined) return response.generic(415);
            open()[{PUT: 'put', POST: 'append', INSERT: 'insert'}[request.method]](path, body).then(function(error) {
              db.close();
              response.end(error ? '403 '+error : '200 Success', null, error ? 403 : 200);
            });
          }, request.headers['Content-Type'] == 'application/json' ? 'json' : 'utf8', 1048576);
        case 'DELETE':
          if (request.headers.Authorization != csrf)
            return request.generic(403);
          return open().delete(path).then(function(error) {
            db.close();
            response.end(error ? '403 '+error : '200 Success', null, error ? 403 : 200);
          });
      }
      return response.generic(501);
    }
    try {
      var state = request.uri.split('?', 2)[1] || '',
          expanded = parse(state),
          actual = {};
    } catch (e) {
      return response.generic(301, {Location: request.path});
    }
    open().get('', false, function(path) {
      var e = expanded, a = actual, i = 0;
      return !path.some(function(segment) {
        if (!(e = e[segment += ''])) return true;
        a = a[segment] = a[segment] || {};
      }) && {
        action: function() {
          if (i++ == 100) return 'stop';
        },
        value: function(key, value) {
          return key == null ? {data: value, remaining: i > 100} : value;
        }
      };
    }).then(function(data) {
      db.close();
      actual = stringify(actual);
      if (state != actual)
        return response.generic(303, {Location: request.path+(actual && '?'+actual)});
      response.end(template([
        {a: {href: '/', class: 'home', children: [{svg: [{use: {'xlink:href': '#icon-database'}}]}, name]}},
        {pre: {id: 'value'}},
        {script: {src: '/static/jsonv.js'}},
        {script: function(d, s, p, token) {
          if (!s) return [data, stringify, parse, csrf];
          var pad = function(o) {
            return o && typeof o == 'object' ? o.data ? {
              data: Array.isArray(o.data) ? o.data.map(pad)
                : Object.keys(o.data).reduce(function(a, b) { a[b] = pad(o.data[b]); return a; }, {}),
              remaining: o.remaining
            } : {data: o, remaining: true, collapsed: true} : o;
          };
          var entry = function(path) {
            for (var entry = d, i = 0; entry.data && i < path.length; i++)
              entry = entry.data[path[i]];
            return entry;
          };
          var editor = jsonv(document.getElementById('value'), d = pad(d), {
            editor: true,
            metadata: true,
            listener: function(method, path, value, callback) {
              var parent = entry(path.slice(0, -1)).data,
                  key = path[path.length-1];
              if (method == 'toggle') {
                if (key == null) return;
                var item = parent[key];
                method = !item.loaded;
                item.collapsed = !value;
                item.loaded = true;
              } else if (method == 'delete') {
                if (typeof key == 'number') parent.splice(key, 1);
                else delete parent[key];
              } else if (method == 'insert' || method == 'put') {
                var padded = function inflate(v) {
                  return !v || typeof v != 'object' ? v : {data: Array.isArray(v) ? v.map(inflate)
                    : Object.keys(v).reduce(function(a, b) { a[b] = inflate(v[b]); return a; }, {})};
                }(value);
                if (method == 'insert') parent.splice(key, 0, padded);
                else parent[key] = padded;
              }
              var state = s(function prune(data) {
                return Object.keys(data).reduce(function(o, key) {
                  var v = data[key];
                  if (v && typeof v == 'object' && !v.collapsed) o[key] = prune(v.data);
                  return o;
                }, {});
              }(d.data)).replace(/.+/, '?$&');
              // TODO: replaceState for delete, insert on arrays
              if (state != location.search) history.pushState(null, '', location.pathname+state);
              if (typeof method == 'boolean') return method;
              var request = new XMLHttpRequest();
              if (method == 'get') request.responseType = 'json';
              request.onload = request.onerror = function() {
                var error = request.status != 200;
                if (!error && method == 'get') {
                  // TODO: check that item has not been deleted (in jsonv also?)
                  var value = pad(request.response),
                      data = value && value.data || {},
                      item = key == null ? parent : parent[key].data;
                  if (Array.isArray(data)) [].push.apply(item, data);
                  else Object.keys(data).forEach(function(key) { item[key] = data[key]; });
                }
                if (callback) callback(error, value);
              };
              request.open(method, location.pathname+'/'+path.map(encodeURIComponent).join('/')+
                (method == 'get' && value != null ? '?after='+encodeURIComponent(value) : ''));
              request.setRequestHeader('Accept', 'application/json');
              request.setRequestHeader('Content-Type', 'application/json');
              request.setRequestHeader('Authorization', token);
              request.send(method == 'get' ? undefined : JSON.stringify(value));
            }
          });
          window.onpopstate = function() {
            // assumes state changes using data currently in memory
            editor.toggle([], true);
            (function compare(path, a, b) {
              Object.keys(a).forEach(function(key) {
                var state = a[key], next = b[key];
                if (!state || typeof state != 'object') return;
                if (state.collapsed != !next) {
                  editor.toggle(path.concat([key]));
                  state.collapsed = !next;
                }
                if (next) compare(path.concat([key]), state.data, next);
              });
            }([], d.data, p(location.search.substr(1))));
          };
        }}
      ], name), 'html');
    });
  }, function(error) {
    if (error) console.error('Error listening on port '+port+'\n'+error);
    else console.log('Listening at http://localhost:'+port);
  });
}
