simpl.use({http: 0, html: 0}, function(o) {

  var count = 0;
  
  o.http.serve({port: config.port}, function(request, response) {
  
    if (request.path == '/')
      return response.end(o.html.markup([
        {h1: 'My First Web App'},
        (++count)+' hits'
      ]), {'Content-Type': o.http.mimeType('html')});
      
    response.generic(404);
    
  }, function(error) {
    if (error) return console.error('Error listening on 0.0.0.0:'+config.port+'\n'+error);
    console.log('Listening at http://localhost:'+config.port);
  });
});
