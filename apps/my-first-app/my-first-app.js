simpl.use({http: 0, html: 0}, function(o) {
  var count = 0;
  o.http.serve({port: config.port}, function(request, response) {
    if (request.path == '/')
      return response.end(o.html.markup([
        {h1: 'My First App'},
        (++count)+' hits'
      ]), {'Content-Type': o.http.mimeType('html')});
    response.generic(404);
  });
});
