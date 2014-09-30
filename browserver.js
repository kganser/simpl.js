chrome.app.runtime.onLaunched.addListener(function() {
  kernel.use({http: 0, html: 0, database: 0, string: 0}, function(o) {
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
