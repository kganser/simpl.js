kernel.use({http: 0, database: 0, html: 0, xhr: 0}, function(o) {
  o.http.serve({port: 8002}, function(request, response) {
    if (request.headers.View == 'data' || request.query.view == 'data') {
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
    o.database.get('', function(data) {
      response.end(o.html.markup([
        {'!doctype': {html: null}},
        {head: [
          {title: 'Browserver'},
          {meta: {charset: 'utf-8'}},
          {link: {rel: 'stylesheet', href: 'http://localhost:8001/apps/db-admin/db-admin.css'}}
        ]},
        {body: [
          {pre: {id: 'value', 'class': 'json', children: JSON.stringify(data, null, 2)}},
          {script: {src: 'http://localhost:8001/kernel.js'}},
          {script: {src: 'http://localhost:8001/modules/html.js'}},
          {script: {src: 'http://localhost:8001/apps/db-admin/jsonv.js'}},
          {script: function() {
            kernel.use({jsonv: 0}, function(o) {
              var elem = document.getElementById('value');
              o.jsonv(JSON.parse(elem.textContent), elem);
            });
          }}
        ]}
      ]), {'Content-Type': 'text/html'});
    });
  });
});
