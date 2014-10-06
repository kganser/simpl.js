kernel.add('xhr', function() {
  return function(url, options, callback) {
    options = options || {};
    if (typeof options == 'function')
      callback = options;
      
    var xhr = new XMLHttpRequest();
    xhr.timeout = options.timeout || 0;
    xhr.responseType = options.responseType || '';
    
    xhr.onload = callback || options.onload;
    xhr.onerror = options.onerror;
    xhr.ontimeout = options.ontimeout;
    xhr.onreadystatechange = options.onreadystatechange;
    
    Object.keys(options.headers || {}).forEach(function(name) {
      xhr.setRequestHeader(name, options.headers[name]);
    });
    xhr.open(options.method || 'GET', url, true, options.user, options.password);
    xhr.send(options.data);
    return xhr;
  };
});
