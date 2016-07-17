function(modules) {
  
  // uri    := path? branch?
  // branch := '[' path branch? ( ',' path branch? )+ ']'
  // path   := segment ( '/' segment )*
  var parse = function(path) {
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
  var template = function(body, db) {
    return modules.html.markup([
      {'!doctype': {html: null}},
      {head: [
        {title: (db ? db+' - ' : '')+'Database Admin'},
        {meta: {charset: 'utf-8'}},
        {link: {rel: 'stylesheet', href: '/static/database-admin.css'}},
        db && {link: {rel: 'stylesheet', href: '/static/jsonv.css'}}
      ]},
      {body: [
        {svg: {id: 'icons', children: [
          {symbol: {id: 'icon-database', viewBox: '0 0 20 20', children: {path: {d: 'M16.726,12.641c-0.843,1.363-3.535,2.361-6.726,2.361c-3.191,0-5.883-0.998-6.727-2.361C3.095,12.351,3,12.506,3,12.648c0,0.144,0,2.002,0,2.002C3,16.59,6.134,18.6,10,18.6s7-2.01,7-3.949c0,0,0-1.858,0-2.002C17,12.506,16.904,12.351,16.726,12.641zM16.737,7.525c-0.83,1.205-3.532,2.09-6.737,2.09c-3.205,0-5.908-0.885-6.738-2.09C3.091,7.277,3,7.412,3,7.523c0,0.113,0,2.357,0,2.357c0,1.762,3.134,3.189,7,3.189s7-1.428,7-3.189c0,0,0-2.244,0-2.357C17,7.412,16.908,7.277,16.737,7.525zM10,1C6.134,1,3,2.18,3,3.633v1.26c0,1.541,3.134,2.791,7,2.791s7-1.25,7-2.791v-1.26C17,2.18,13.866,1,10,1z'}}}}
        ]}},
        body
      ]}
    ]);
  };
  var dbs = function(callback, name) {
    modules.database.list(function(names) {
      if (!name) return callback(Array.prototype.slice.call(names));
      callback(names.contains(name) ? modules.database.open(name) : null);
    });
  };
  
  modules.http.serve({port: config.port}, function(request, response) {
    if (request.path == '/')
      return dbs(function(dbs) {
        response.end(template([{ul: {class: 'databases', children: dbs.map(function(name) {
          return {li: [{a: {href: '/'+encodeURIComponent(name), children: [{svg: [{use: {'xlink:href': '#icon-database'}}]}, name]}}]};
        })}}]), 'html');
      });
    var name = request.path.match(/^\/([^/]*)/)[1],
        path = request.path.substr(name.length+2),
        json = request.headers.Accept == 'application/json' || request.query.format == 'json';
    if (!json && (path || name == 'favicon.ico'))
      return modules.xhr(location.origin+'/'+path, {responseType: 'arraybuffer'}, function(e) {
        if (e.target.status != 200) return response.generic(404);
        response.end(e.target.response, (path.match(/\.([^.]*)$/) || [])[1]);
      });
    var open = function(callback) {
      dbs(function(db) {
        if (!db) return response.generic(404);
        callback(db);
      }, name = decodeURIComponent(name));
    };
    if (json) {
      var respond = function(error) {
        response.end(error ? '403 '+error : '200 Success', null, error ? 403 : 200);
      };
      switch (request.method) {
        case 'GET':
          return open(function(db) {
            db.get(path, false, 'immediates').then(function(object) {
              if (object === undefined) response.generic(404);
              response.end(JSON.stringify(object), 'json');
            });
          });
        case 'PUT':
        case 'POST':
        case 'INSERT':
          return request.slurp(function(body) {
            if (body === undefined) return response.generic(415);
            open(function(db) {
              db[{PUT: 'put', POST: 'append', INSERT: 'insert'}[request.method]](path, body).then(respond);
            });
          }, 'json');
        case 'DELETE':
          return open(function(db) {
            db.delete(path).then(respond);
          });
      }
      return response.generic(501);
    }
    try {
      var map = parse(request.uri.split('?', 2)[1] || '');
    } catch (e) {
      return response.generic(301, {Location: request.path});
    }
    open(function(db) {
      // TODO: redirect if all expanded keys are not traversed
      db.get('', false, function(path) {
        var node = map;
        return !path.some(function(segment) {
          return !(node = node[segment+'']);
        });
      }).then(function(data) {
        response.end(template([
          {pre: {id: 'value', children: JSON.stringify(data, null, 2)}},
          {script: {src: '/static/simpl.js'}},
          {script: {src: '/static/modules/html.js'}},
          {script: {src: '/static/jsonv.js'}},
          {script: function() {
            var entry = function(map, path) {
              for (var entry = map, i = 0; entry && i < path.length; i++)
                entry = entry[path[i]];
              return entry;
            };
            var stringify = function(map) {
              var keys = Object.keys(map);
              return !keys.length ? ''
                : keys.length == 1 ? '/'+encodeURIComponent(keys[0])+stringify(map[keys[0]])
                : '['+keys.map(function(key) {
                    return encodeURIComponent(key)+stringify(map[key]);
                  }).join(',')+']';
            };
            var parse = function() {
              var i, map = {}, stack = [], node = map,
                  path = location.search.substr(1);
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
            var ui, open = parse(), loaded = parse();
            window.onpopstate = function() {
              open = parse();
              if (ui) ui.update();
            };
            simpl.use({jsonv: 0}, function(modules) {
              ui = modules.jsonv(document.getElementById('value'), undefined, {
                listener: function(method, path, data, callback) {
                  var parent = path.slice(0, -1),
                      key = path[path.length-1],
                      openParent = entry(open, parent),
                      loadedParent = entry(loaded, parent);
                  if (method == 'expand' || method == 'collapse') {
                    if (key == null) return;
                    if (method == 'expand') {
                      openParent[key] = {};
                      if (method = loadedParent && !loadedParent[key] && 'get')
                        loadedParent[key] = {};
                    } else {
                      delete openParent[key];
                      method = null;
                    }
                  } else {
                    [openParent, loadedParent].forEach(function(parent) {
                      var keys = typeof key == 'number' && Object.keys(parent).map(function(k) { return +k; }).sort();
                      if (method == 'delete') {
                        if (keys) {
                          keys.forEach(function(k) {
                            if (k < key) return;
                            if (k > key) parent[k-1] = parent[k];
                            delete parent[k];
                          });
                        } else {
                          delete parent[key];
                        }
                      } else {
                        if (method == 'insert') keys.reverse().some(function(k) {
                          if (k < key) return true;
                          parent[k+1] = parent[k];
                          delete parent[k];
                        });
                        delete parent[key];
                        (function expand(o, parent, key) {
                          if (!o || typeof o != 'object') return;
                          var p = parent[key] = {};
                          if (Array.isArray(o)) o.forEach(function(data, i) { expand(data, p, i); });
                          else Object.keys(o).forEach(function(k) { expand(o[k], p, k); });
                        }(data, parent, key));
                      }
                    });
                  }
                  var state = stringify(open).replace(/^\/?/, '?');
                  if (state != location.search) history.pushState(null, '', location.pathname+state);
                  if (!method) return;
                  var request = new XMLHttpRequest();
                  if (method == 'get') request.responseType = 'json';
                  request.onload = request.onerror = function() {
                    var error = request.status != 200;
                    if (callback) callback(error, request.response); // TODO: callback will exist
                    if (error) {
                      alert('An error occurred'); // TODO: improved UI
                      delete loadedParent[key];
                    }
                  };
                  request.open(method, location.pathname+'/'+path.map(encodeURIComponent).join('/'));
                  request.setRequestHeader('Accept', 'application/json');
                  request.setRequestHeader('Content-Type', 'application/json');
                  request.send(method == 'get' ? undefined : JSON.stringify(data));
                  return true;
                },
                collapsed: function(path) {
                  return !entry(open, path);
                }
              });
            });
          }}
        ], name), 'html');
      });
    });
  }, function(error) {
    if (error) console.error('Error listening on 0.0.0.0:'+config.port+'\n'+error);
    else console.log('Listening at http://localhost:'+config.port);
  });
}