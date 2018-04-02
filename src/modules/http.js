simpl.add('http', function(modules) {
  
  var utf8 = modules.string.toUTF8Buffer,
      utf8decode = modules.string.fromUTF8Buffer,
      latin1decode = modules.string.fromLatin1Buffer,
      self;
      
  var message = function(status, headers, body, headersSent, chunk, end) {
    if (headersSent && (headers || status)) throw new Error('HTTP headers already sent');
    headers = headersSent ? false : (headers || {});
    
    if (body instanceof ArrayBuffer)
      body = new Uint8Array(body);
    else if (!(body instanceof Uint8Array))
      body = utf8(body ? String(body) : '');
    
    var head = '';
    if (headers) {
      if (typeof headers == 'string')
        headers = {'Content-Type': self.mimeType(headers)};
      if (headers['Content-Type'] === undefined)
        headers['Content-Type'] = 'text/plain';
      if (!chunk && headers['Content-Length'] === undefined)
        headers['Content-Length'] = body.length;
      if (chunk && headers['Transfer-Encoding'] === undefined)
        headers['Transfer-Encoding'] = 'chunked';
      if (chunk && !body.length)
        chunk = false;
      head += 'HTTP/1.1 '+self.statusMessage(status)+'\r\n'+Object.keys(headers).map(function(name) {
        var value = headers[name];
        return value == null ? ''
          : Array.isArray(value) ? value.map(function(value) { return name+': '+value+'\r\n'; }).join('')
          : name+': '+value+'\r\n';
      }).join('')+'\r\n';
    }
    
    if (chunk) head += body.length.toString(16)+'\r\n';
    head = utf8(head);
    var data = new Uint8Array(head.length + body.length + (chunk ? end ? 7 : 2 : 0));
    data.set(head, 0);
    data.set(body, head.length);
    if (chunk) data.set(end ? [13,10,48,13,10,13,10] : [13,10], data.length - (end ? 7 : 2));
    
    return data.buffer;
  };
  
  var slurp = function(callback, format, maxSize, error) {
    var done, body;
    return function(data, remaining) {
      if (done) return;
      var length = data.byteLength + (body ? body.length : 0);
      if (length + remaining > maxSize) {
        done = true;
        return error();
      }
      if (body) {
        var b = new Uint8Array(length);
        b.set(body);
        b.set(new Uint8Array(data), body.length);
        body = b;
      } else {
        body = new Uint8Array(data);
      }
      if (!remaining) {
        done = true;
        body = body.buffer;
        if (format == 'utf8' || format == 'url' || format == 'json')
          body = utf8decode(body);
        if (format == 'url')
          return callback(self.parseQuery(body));
        if (format == 'json')
          try { body = JSON.parse(body); }
          catch (e) { body = undefined; }
        return callback(body);
      }
    };
  };
  
  /** http: {
        serve: function(options:ListenOptions, onRequest:RequestCallback, callback:function(error:string|null, socket:ServerSocket|false)),
        statusMessage: function(code:number) -> string,
        mimeType: function(extension:string) -> string,
        parseQuery: function(query:string) -> object
      }
      
      HTTP/1.1 server and utilities. `ServerSocket` and `ClientSocket` are defined in the `socket` module. `parseQuery`
      object values are strings or arrays of strings if more than one string value is specified for a key. */
  
  /** ListenOptions: {
        address='0.0.0.0': string,
        port: number,
        backlog=50: number,
        name=undefined: string,
        maxHeaderSize=8192: number
      }

      If a request's header exceeds `maxHeaderSize` bytes, the server responds with a generic `431 Request Header Fields
      Too Large` and disconnects the client socket. */
  
  /** RequestCallback: function(request:Request, response:Response) -> function(data:ArrayBuffer, remaining:number)|null
      
      If a function is returned, it is called with `data` received in the body of the request and the `remaining`
      number of bytes based on the request's `Content-Length` header. To buffer the request body, call `request.slurp`
      to generate this function. */
  
  /** Request: {
        slurp: function(callback:function(body:ArrayBuffer|string|object|json), format=null:string, maxSize=8192:number) -> function(data:ArrayBuffer, remaining:number),
        protocol: string,
        method: string,
        uri: string,
        path: string,
        query=`{}`: object,
        headers=`{}`: object,
        cookie=`{}`: object
      }
      
      `query` is the result of `parseQuery` run on `uri`'s query string, if any. `headers` and `cookie` store only the
      last string value for a given key.
      
      `slurp` returns a function for buffering the request body (up to `maxSize` bytes) that issues `callback` when
      complete. If `format` is `'utf8'`, `'url'`, or `'json'`, the body is converted to a string, `parseQuery` object,
      or json structure, respectively. Otherwise, `body` is an `ArrayBuffer`. If the max size is exceeded, `callback`
      is not issued and the server responds with a generic `413 Request Entity Too Large`. */
  
  /** Response: {
        send: function(body='':ArrayBuffer|string, headers=`{}`:object|string, status=200:number, callback:function(error:string|undefined)),
        end: function(body='':ArrayBuffer|string, headers=`{}`:object|string, status=200:number, callback:function(error:string|undefined)),
        generic: function(status=200:number, headers=`{}`:object|string),
        ok: function,
        error: function,
        socket: ClientSocket
      }
      
      The first call to `send` will send headers and initiate a chunked HTTP response (adding a `Transfer-Encoding:
      chunked` header unless overridden in the `headers` object, after which `headers` and `status` default to (and
      must be) null in calls to `send` and `end`. If `headers` is a string, it is interpreted as an extension and
      substituted with the corresponding `Content-Type` header. A response initiated with `send` must be completed with
      a call to `end`. `generic` is a convenience method that uses `statusMessage(status)` as the response body. `ok`
      and `error` are nullary convenience methods that call `generic()` and `generic(400)`, respectively. */
  return self = {
    serve: function(options, onRequest, callback) {
      var maxHeaderSize = options && options.maxHeaderSize || 8192;
      modules.socket.listen(options, function(socket) {
        var dispatch = function(headers) {
          var headersSent, sent,
              line = headers.shift().split(' '),
              uri = line[1] ? line[1].split('?', 2) : [];
          var response = {
            send: function(body, headers, status, callback) {
              if (sent) return callback && callback({resultCode: -1, error: 'Already issued response'});
              socket.send(message(status, headers, body, headersSent, headersSent = true), callback);
            },
            end: function(body, headers, status, callback) {
              if (sent) return callback && callback({resultCode: -1, error: 'Already issued response'});
              socket.send(message(status, headers, body, headersSent, headersSent, sent = true), callback);
            },
            generic: function(status, headers) {
              response.end(self.statusMessage(status), headers, status || 200);
            },
            ok: function() { response.generic(); },
            error: function() { response.generic(400); },
            socket: socket
          };
          // TODO: sanity check headers
          // TODO: decode chunks if chunk-encoded (or emit 411 Length Required)
          var request = {
            protocol: line[2],
            method: line[0].toUpperCase(),
            uri: line[1],
            path: uri[0],
            query: self.parseQuery(uri[1]),
            headers: {},
            cookie: {},
            slurp: function(callback, format, maxSize) {
              return slurp(callback, format, maxSize || 8192, function() { response.generic(413); });
            }
          };
          headers.forEach(function(line) {
            line = line.split(': ', 2);
            request.headers[line[0]] = line[1];
          });
          if (request.headers.Cookie) request.headers.Cookie.split(/; */).forEach(function(pair) {
            pair = pair.split('=', 2);
            if (pair.length < 2) return;
            var value = pair[1];
            try {
              request.cookie[pair[0]] = decodeURIComponent(value[0] == '"' ? value.slice(1, -1) : value);
            } catch (e) {}
          });
          var o = {length: parseInt(request.headers['Content-Length'], 10) || 0},
              r = onRequest(request, response);
          if (typeof r == 'function') o.receive = r;
          return o;
        };
        var request, remaining, headers = '';
        socket.setKeepAlive(true, 5); // TODO: check that this is required to trigger onReceiveError
        return function(buffer) {
          do {
            var start = 0, end = buffer.byteLength;
            if (remaining) {
              if (end > remaining) end = remaining;
              remaining -= end;
            } else {
              var offset = headers.length;
              headers += latin1decode(buffer);
              var split = headers.indexOf('\r\n\r\n', offset-3);
              if (split == -1 && headers.length-3 > maxHeaderSize || split > maxHeaderSize)
                return socket.send(message(431, null, self.statusMessage(431), false, false, true), socket.disconnect);
              if (split > -1) {
                request = dispatch(headers.substr(0, split).split('\r\n'));
                remaining = request.length;
                start = split + 4 - offset;
                end = Math.min(start + remaining, end);
                remaining -= end - start;
                headers = '';
              } 
            }
            if (request && request.receive)
              request.receive(buffer.slice(start, end), remaining);
            buffer = buffer.slice(end);
          } while (buffer.byteLength);
        };
      }, callback);
    },
    statusMessage: function(code) {
      if (!code) return '200 OK';
      if (typeof code != 'number') return code;
      return code+' '+{
        100: 'Continue',
        101: 'Switching Protocol',
        200: 'OK',
        201: 'Created',
        202: 'Accepted',
        203: 'Non-Authoritative Information',
        204: 'No Content',
        205: 'Reset Content',
        206: 'Partial Content',
        300: 'Multiple Choice',
        301: 'Moved Permanently',
        302: 'Found',
        303: 'See Other',
        304: 'Not Modified',
        305: 'Use Proxy',
        307: 'Temporary Redirect',
        308: 'Permanent Redirect',
        400: 'Bad Request',
        401: 'Unauthorized',
        402: 'Payment Required',
        403: 'Forbidden',
        404: 'Not Found',
        405: 'Method Not Allowed',
        406: 'Not Acceptable',
        407: 'Proxy Authentication Required',
        408: 'Request Timeout',
        409: 'Conflict',
        410: 'Gone',
        411: 'Length Required',
        412: 'Precondition Failed',
        413: 'Request Entity Too Large',
        414: 'Request-URI Too Long',
        415: 'Unsupported Media Type',
        416: 'Requested Range Not Satisfiable',
        417: 'Expectation Failed',
        431: 'Request Header Fields Too Large',
        500: 'Internal Server Error',
        501: 'Not Implemented',
        502: 'Bad Gateway',
        503: 'Service Unavailable',
        504: 'Gateway Timeout',
        505: 'HTTP Version Not Supported'
      }[code];
    },
    mimeType: function(extension) {
      return {
        html: 'text/html',
        css:  'text/css',
        xml:  'text/xml',
        rss:  'text/xml',
        gif:  'text/gif',
        jpg:  'image/jpeg',
        jpeg: 'image/jpeg',
        js:   'application/javascript',
        json: 'application/json',
        txt:  'text/plain',
        png:  'image/png',
        svg:  'image/svg+xml',
        ico:  'image/x-icon',
        pdf:  'application/pdf',
        zip:  'application/zip',
        exe:  'application/octet-stream',
        mp3:  'audio/mpeg',
        mpg:  'video/mpeg',
        mpeg: 'video/mpeg',
        mov:  'video/quicktime',
        flv:  'video/x-flv',
        avi:  'video/x-msvideo',
        wmv:  'video/x-ms-wmv',
        woff: 'application/font-woff'
      }[extension];
    },
    parseQuery: function(query) {
      var o = {};
      if (query) query.split('&').forEach(function(field) {
        field = field.split('=');
        try {
          var key = decodeURIComponent(field[0].replace(/\+/g, '%20')),
              value = field[1] && decodeURIComponent(field[1].replace(/\+/g, '%20'));
          if (!o.hasOwnProperty(key))
            o[key] = value;
          else if (Array.isArray(o[key]))
            o[key].push(value);
          else
            o[key] = [o[key], value];
        } catch (e) {}
      });
      return o;
    }
  };
}, 0, {socket: 0, string: 0});