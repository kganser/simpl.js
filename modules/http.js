simpl.add('http', function(modules) {
  
  var self, entity = function(status, headers, body, headersSent, chunk, end) {
    if (headersSent && (headers || status)) throw 'HTTP headers already sent';
    headers = headersSent ? false : (headers || {});
    
    if (body instanceof ArrayBuffer)
      body = new Uint8Array(body);
    else if (!(body instanceof Uint8Array))
      body = modules.string.toUTF8Buffer(body ? String(body) : '');
    
    var pre = '';
    if (headers) {
      if (typeof headers == 'string')
        headers = {'Content-Type': self.mimeType(headers)};
      if (!('Content-Type' in headers))
        headers['Content-Type'] = 'text/plain';
      if (!chunk && !('Content-Length' in headers))
        headers['Content-Length'] = body.length;
      if (chunk && !('Transfer-Encoding' in headers))
        headers['Transfer-Encoding'] = 'chunked';
      pre += 'HTTP/1.1 '+self.statusMessage(status)+'\r\n'+Object.keys(headers).map(function(header) {
        return headers[header] == null ? '' : header+': '+headers[header]+'\r\n';
      }).join('')+'\r\n';
    }
    
    if (chunk) pre += body.length.toString(16)+'\r\n';
    pre = modules.string.toUTF8Buffer(pre);
    var data = new Uint8Array(pre.length + body.length + (chunk ? end ? 7 : 2 : 0));
    data.set(pre, 0);
    data.set(body, pre.length);
    if (chunk) data.set(end ? [13,10,48,13,10,13,10] : [13,10], data.length - (end ? 7 : 2));
    
    return data.buffer;
  };
  /** http: {
        serve: function(options:ListenOptions, onRequest:RequestCallback, callback:ListenCallback),
        statusMessage: function(code:number) -> string,
        mimeType: function(extension:string) -> string,
        parseQuery: function(query:string) -> object
      }
      
      HTTP/1.1 server and utilities. `serve` uses `ListenOptions`, `ListenCallback`, and `ClientSocket` from the
      `socket` module. `parseQuery` object values are strings or arrays of strings if more than one string value is
      specified for a key. */
      
  /** RequestCallback: function(request:Request, response:Response, socket:ClientSocket) -> function(data:ArrayBuffer)|null
      
      If a function is returned, it is called with data received in the body of the request. To buffer the request
      body, use `request.slurp` instead. */
  
  /** Request: {
        slurp: function(callback:function(body:ArrayBuffer|string|object|json), format=null:string, maxSize=4096:number),
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
      
      `slurp` buffers the request body (up to `maxSize` bytes) and issues `callback` when complete. If format is
      `'utf8'`, `'url'`, or `'json'`, the body is converted to a string, `parseQuery` object, or json structure,
      respectively. Otherwise, `body` is an `ArrayBuffer`. If the max size is exceeded, `callback` is not issued and
      the server responds with a generic `413 Request Entity Too Large`. */
      
  /** Response: {
        send: function(body='':ArrayBuffer|string, headers=`{}`:object|string, status=200:number, callback:function(error:string|undefined)),
        end: function(body='':ArrayBuffer|string, headers=`{}`:object|string, status=200:number, callback:function(error:string|undefined)),
        generic: function(status=200:number, headers=`{}`:object|string),
        ok: function,
        error: function
      }
      
      The first call to `send` will send headers and initiate a chunked HTTP response (adding a `Transfer-Encoding:
      chunked` header unless overridden in the `headers` object, after which `headers` and `status` default to (and
      must be) null in calls to `send` and `end`. If `headers` is a string, it is interpreted as an extension and
      substituted with the corresponding `Content-Type` header. A response initiated with `send` must be completed with
      a call to `end`. `generic` is a convenience method that uses `statusMessage(status)` as the response body. `ok`
      and `error` are nullary convenience methods that call `generic()` and `generic(400)`, respectively. */
  return self = {
    serve: function(options, onRequest, callback) {
      modules.socket.listen(options, function(socket) {
        var slurp = function(callback, format, maxSize) {
          var body = new Uint8Array(0);
          read = function(data) {
            if (!data) {
              if (format == 'utf8' || format == 'url' || format == 'json')
                body = modules.string.fromUTF8Buffer(body);
              if (format == 'url')
                return callback(self.parseQuery(body));
              if (format == 'json')
                try { body = JSON.parse(body); }
                catch (e) { body = undefined; }
              return callback(body);
            }
            var length = body.byteLength + data.byteLength;
            if (length > (maxSize || 4096)) {
              read = null;
              return response.generic(413);
            }
            var b = new Uint8Array(length);
            b.set(new Uint8Array(body), 0);
            b.set(new Uint8Array(data), body.byteLength);
            body = b.buffer;
          };
        };
        var request = {cookie: {}, slurp: slurp}, response,
            headers = '', remaining, read, headersSent;
        return function(buffer) {
          do {
            var start = 0, end = buffer.byteLength;
            // TODO: 414 Request-URI Too Long and 413 Request Entity Too Large while buffering headers
            if (!request.headers) {
              var split, offset = headers.length;
              headers += modules.string.fromUTF8Buffer(buffer);
              if ((split = headers.indexOf('\r\n\r\n')) > -1) {
                headers = headers.substr(0, split).split('\r\n');
                var line = headers.shift().split(' '),
                    uri = line[1] ? line[1].split('?', 2) : [];
                request.protocol = line[2];
                request.method = line[0].toUpperCase();
                request.uri = line[1];
                request.path = uri[0];
                request.query = self.parseQuery(uri[1]);
                request.headers = {};
                headers.forEach(function(line) {
                  line = line.split(': ', 2);
                  request.headers[line[0]] = line[1];
                });
                if (request.headers.Cookie) request.headers.Cookie.split(/; */).forEach(function(pair) {
                  pair = pair.split('=', 2);
                  if (pair.length < 2) return;
                  var value = pair[1];
                  request.cookie[pair[0]] = decodeURIComponent(value[0] == '"' ? value.slice(1, -1) : value);
                });
                remaining = request.headers['Content-Length'] || 0;
                start = split + 4 - offset;
                end = Math.min(start + remaining, end);
                remaining -= end - start;
                headers = headersSent = '';
                var r = onRequest(request, response = {
                  send: function(body, headers, status, callback) {
                    socket.send(entity(status, headers, body, headersSent, headersSent = true), callback);
                  },
                  end: function(body, headers, status, callback) {
                    socket.send(entity(status, headers, body, headersSent, headersSent, true), callback);
                  },
                  generic: function(status, headers) {
                    response.end(self.statusMessage(status), headers, status || 200);
                  },
                  ok: function() {
                    response.generic();
                  },
                  error: function() {
                    response.generic(400);
                  }
                }, socket);
                if (!read && typeof r == 'function') read = r;
              }
            } else {
              if (end > remaining) end = remaining;
              remaining -= end;
            }
            // TODO: decode chunks if chunk-encoded (or emit 411 Length Required)
            if (read) read(buffer.slice(start, end));
            if (!remaining) {
              if (read) read();
              read = null;
              request = {cookie: {}, slurp: slurp};
            }
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
        var key = decodeURIComponent(field[0].replace(/\+/g, '%20')),
            value = field[1] && decodeURIComponent(field[1].replace(/\+/g, '%20'));
        if (!o.hasOwnProperty(key))
          o[key] = value;
        else if (Array.isArray(o[key]))
          o[key].push(value);
        else
          o[key] = [o[key], value];
      });
      return o;
    }
  };
}, 0, {socket: 0, string: 0});