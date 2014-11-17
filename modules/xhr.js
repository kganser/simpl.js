simpl.add('xhr', function() {
  /** xhr: function(url:string, options=`{}`:Options|function(ProgressEvent), callback=undefined:function(ProgressEvent)) -> XMLHttpRequest
      
      A convenience method for issuing an `XMLHttpRequest` in the browser. `callback` is set as the `onload`,
      `onerror`, and `ontimeout` handler unless overridden in `options`. Setting `options.json` will also set
      a `Content-Type: application/json` header unless one is specified already in `options.headers`.
  */
  /** Options: {
        method='GET':string,
        user=undefined:string,
        password=undefined:string,
        timeout=undefined:number,
        responseType='':string,
        onload=undefined:function(ProgressEvent),
        onerror=undefined:function(ProgressEvent),
        ontimeout=undefined:function(ProgressEvent),
        onreadystatechange=undefined:function(Event),
        headers=`{}`:object,
        json=undefined:json,
        data=undefined:string|ArrayBufferView|Blob|Document|FormData
      } */
  return function(url, options, callback) {
    options = options || {};
    if (typeof options == 'function')
      callback = options;
      
    var xhr = new XMLHttpRequest();
    xhr.open(options.method || 'GET', url, true, options.user, options.password);
    
    xhr.timeout = options.timeout;
    xhr.responseType = options.responseType || '';
    
    xhr.onload = options.onload || callback;
    xhr.onerror = options.onerror || callback;
    xhr.ontimeout = options.ontimeout || callback;
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
