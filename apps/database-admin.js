function(modules) {

  var db = modules.database.open(config.database);
  
  modules.http.serve({port: config.port}, function(request, response) {
    if (request.headers.Accept == 'application/json' || request.query.format == 'json') {
      var path = request.path.substr(1),
          respond = function(error) {
            response.end(error ? '403 '+error : '200 Success', null, error ? 403 : 200);
          };
      switch (request.method) {
        case 'GET':
          return db.get(path, false, 'immediates').then(function(object) {
            if (object === undefined) response.generic(404);
            response.end(JSON.stringify(object), 'json');
          });
        case 'PUT':
        case 'POST':
        case 'INSERT':
          return request.slurp(function(body) {
            if (body === undefined) return response.generic(415);
            db[{PUT: 'put', POST: 'append', INSERT: 'insert'}[request.method]](path, body).then(respond);
          }, 'json');
        case 'DELETE':
          return db.delete(path).then(respond);
      }
      return response.generic(501);
    }
    if (request.path.length > 1)
      return modules.xhr(location.origin+request.path, {responseType: 'arraybuffer'}, function(e) {
        if (e.target.status != 200)
          return response.generic(404);
        response.end(e.target.response, (request.path.match(/\.([^.]*)$/) || [])[1]);
      });
    db.get('', false, 'immediates').then(function(data) {
      response.end(modules.html.markup([
        {'!doctype': {html: null}},
        {head: [
          {title: 'Database Editor'},
          {meta: {charset: 'utf-8'}},
          {link: {rel: 'stylesheet', href: '/jsonv.css'}}
        ]},
        {body: [
          {pre: {id: 'value', 'class': 'json', children: JSON.stringify(data, null, 2)}},
          {script: {src: '/simpl.js'}},
          {script: {src: '/modules/html.js'}},
          {script: {src: '/jsonv.js'}},
          {script: function() {
            simpl.use({jsonv: 0}, function(modules) {
              var open = {}, loaded = {};
              var entry = function(map, path) {
                for (var entry = map, i = 0; entry && i < path.length; i++)
                  entry = entry[path[i]];
                return entry;
              };
              var stringify = function(map) {
                var keys = Object.keys(map);
                return keys.length
                  ? keys.length == 1
                    ? '/'+encodeURIComponent(keys[0])+stringify(map[keys[0]])
                    : '['+keys.map(function(key) {
                        return encodeURIComponent(key)+stringify(map[key]);
                      }).join(',')+']'
                  : '';
              };
              modules.jsonv(document.getElementById('value'), undefined, {
                listener: function(method, path, data) {
                  //console.log(method, path);
                  var request = new XMLHttpRequest();
                  if (method == 'expand' || method == 'collapse') {
                    var parentPath = path.slice(0, -1),
                        parent = entry(open, parentPath),
                        key = path[path.length-1];
                    if (key == null) return;
                    if (method == 'expand') parent[key] = {};
                    else delete parent[key]; // collapsing parent node collapses child nodes as well
                    //history.pushState(null, '', location.pathname+stringify(open).replace(/^\/?/, '?'));
                    if (method == 'expand') {
                      var parent = entry(loaded, parentPath);
                      if (!parent || parent[key]) return;
                      parent[key] = {};
                      method = 'get';
                      path = path.map(encodeURIComponent).join('/');
                      request.responseType = 'json';
                      request.onload = function() {
                        data(false, request.response); // TODO: err
                      };
                    } else return;
                  }
                  request.open(method, '/'+path);
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
        ]}
      ]), 'html');
    });
  }, function(error) {
    if (error) console.error('Error listening on 0.0.0.0:'+config.port+'\n'+error);
    else console.log('Listening at http://localhost:'+config.port);
  });
}