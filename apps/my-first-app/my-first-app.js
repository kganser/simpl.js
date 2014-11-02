kernel.use({http: 0, html: 0}, function(o) {
  var count = 0;
  o.http.serve({port: 8001}, function(request, response) {
    if (request.path == '/')
      return response.end(o.html.markup([
        {h1: 'My First App'},
        (++count)+' hits'
      ]), {'Content-Type': 'text/html'});
    response.end('404 Not Found', null, 404);
  });
});
