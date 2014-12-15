simpl.use({http: 0}, function(o) {

  var hits = 0;
  
  o.http.serve({port: config.port}, function(request, response) {
  
    if (request.path == '/')
      return response.end('<h1>My First Web App</h1>'+(++hits)+' hits', 'html');
    response.generic(404);
    
  }, function(error) {
  
    if (error) console.error('Error listening on 0.0.0.0:'+config.port+'\n'+error);
    else console.log('Listening at http://localhost:'+config.port);
    
  });
});
