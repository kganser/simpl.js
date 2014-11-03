kernel.use({http: 0, database: 0, html: 0, xhr: 0}, function(o) {
  o.http.serve({port: config.port}, function(request, response) {
    if (request.headers.Accept == 'application/json' || request.query.format == 'json') {
      var path = request.path.substr(1),
          handler = function(error) {
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
          return request.method == 'POST'
            ? o.database.append(path, request.json, handler)
            : o.database.put(path, request.json, request.method == 'INSERT', handler);
        case 'DELETE':
          return o.database.delete(path, handler);
        default:
          return response.end('501 Method not implemented', null, 501);
      }
    }
    if (request.path.length > 1)
      return o.xhr(location.origin+request.path, {responseType: 'arraybuffer'}, function(e) {
        if (e.target.status != 200)
          return response.end('404 Resource not found', null, 404);
        response.end(e.target.response, {'Content-Type': o.http.getMimeType((request.path.match(/\.([^.]*)$/) || [])[1])});
      });
    o.database.get('', function(data) {
      response.end(o.html.markup([
        {'!doctype': {html: null}},
        {head: [
          {title: 'DB Admin'},
          {meta: {charset: 'utf-8'}},
          {link: {rel: 'stylesheet', href: '/jsonv.css'}}
        ]},
        {body: [
          {pre: {id: 'value', 'class': 'json', children: JSON.stringify(data, null, 2)}},
          {script: {src: '/kernel.js'}},
          {script: {src: '/modules/html.js'}},
          {script: {src: '/jsonv.js'}},
          {script: function() {
            kernel.use({jsonv: 0}, function(o) {
              var elem = document.getElementById('value');
              o.jsonv(JSON.parse(elem.textContent), elem, function(method, path, data) {
                console.log(method, path, data);
                var request = new XMLHttpRequest();
                request.open(method, '/'+path);
                request.setRequestHeader('Accept', 'application/json');
                request.setRequestHeader('Content-Type', 'application/json');
                request.send(JSON.stringify(data));
              });
            });
          }}
        ]}
      ]), {'Content-Type': 'text/html'});
    });
  });
});
