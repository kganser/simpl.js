simpl.add('xhr', function() {
  return function(url, options, callback) {
    options = options || {};
    if (typeof options == 'function')
      callback = options;
      
    var xhr = new XMLHttpRequest();
    xhr.open(options.method || 'GET', url, true, options.user, options.password);
    
    xhr.timeout = options.timeout || 0;
    xhr.responseType = options.responseType || '';
    
    xhr.onload = callback || options.onload;
    xhr.onerror = options.onerror;
    xhr.ontimeout = options.ontimeout;
    xhr.onreadystatechange = options.onreadystatechange;
    
    var headers = options.headers || {};
    if (options.json && headers['Content-Type'] === undefined)
      headers['Content-Type'] = 'application/json';
    Object.keys(headers).forEach(function(name) {
      var value = headers[name];
      if (value != null) xhr.setRequestHeader(name, value);
    });
    
    xhr.send(options.json ? JSON.stringify(options.json) : options.data);
    return xhr;
  };
});
