kernel.add('http', function(o) {
  var self;
  return self = {
    serve: function(options, callback) {
      o.socket.listen(options, function(socket) {
        var request = {headers: {}, query: {}, cookie: {}, peerAddress: socket.peerAddress},
            headers = '',
            split = -1,
            complete;
        // TODO: support keep-alive, chunked encoding, and (ultimately) pipelined requests
        return function(buffer) {
          if (complete) return;
          if (split < 0) {
            // headers are ascii
            var offset = headers.length;
            headers += o.string.fromAsciiBuffer(buffer);
            if ((split = headers.indexOf('\r\n\r\n')) > -1) {
              request.body = buffer.slice(split+4-offset);
              headers = headers.substr(0, split).split('\r\n');
              var line = headers.shift().split(' '),
                  uri = line[1] ? line[1].split('?', 2) : [];
              request.method = line[0].toUpperCase();
              request.uri = line[1];
              request.path = uri[0];
              request.query = self.parseQuery(uri[1]);
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
            }
          } else {
            var tmp = new ArrayBuffer(request.body.byteLength+buffer.byteLength);
            tmp.set(request.body, 0);
            tmp.set(buffer, request.body.byteLength);
            request.body = tmp;
          }
          if (split > -1 && (!request.headers['Content-Length'] || request.body.byteLength >= request.headers['Content-Length'])) {
            complete = true;
            switch ((request.headers['Content-Type'] || '').split(';')[0]) {
              case 'application/x-www-form-urlencoded':
                request.post = self.parseQuery(o.string.fromAsciiBuffer(request.body));
                break;
              case 'application/json': // TODO: verify utf8
                try { request.json = JSON.parse(o.string.fromUTF8Buffer(request.body)); } catch (e) {}
                break;
            }
            callback(request, {
              end: function(body, headers, status) {
                headers = headers || {};
                if (!(body instanceof ArrayBuffer))
                  body = o.string.toUTF8Buffer(String(body)).buffer;
                headers['Content-Length'] = body.byteLength;
                if (!headers['Content-Type']) headers['Content-Type'] = 'text/plain';
                if (!headers.Connection) headers.Connection = 'close';
                socket.write(o.string.toUTF8Buffer(['HTTP/1.1 '+self.getStatus(status)].concat(Object.keys(headers).map(function(header) {
                  return header+': '+headers[header];
                })).join('\r\n')+'\r\n\r\n').buffer);
                socket.write(body, socket.disconnect);
              }
            });
          }
        };
      });
    },
    getStatus: function(code) {
      if (!code) return '200 OK';
      if (typeof code != 'number') return code;
      // from https://developer.mozilla.org/en-US/docs/Web/HTTP/Response_codes
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
    getMimeType: function(ext) {
      // partial list from nginx mime_types file
      return {
        html: 'text/html',
        css:  'text/css',
        xml:  'text/xml',
        rss:  'text/xml',
        gif:  'text/gif',
        jpg:  'image/jpeg',
        jpeg: 'image/jpeg',
        js:   'application/x-javascript',
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
        wmv:  'video/x-ms-wmv'
      }[ext];
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
}, {socket: 0, string: 0});
