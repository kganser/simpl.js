kernel.add('http', function(o) {
  var self;
  return self = {
    serve: function(options, callback) {
      o.socket.listen(options, function(socket) {
        //console.log('connection established', socket.socketId);
        var request = {cookie: {}},
            headers = '', remaining, read;
        // TODO: support keep-alive, chunked encoding, http2
        return function(buffer) {
          do {
            var end = buffer.byteLength;
            if (!request.headers) {
              // headers are ascii
              var split, offset = headers.length;
              headers += o.string.fromAsciiBuffer(buffer);
              //console.log(headers.split('\r')[0]+'...', socket.socketId);
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
                var start = split + 4 - offset;
                // TODO: parse chunked encoding
                end = Math.min(start + remaining, end);
                remaining -= end - start;
                read = callback(request, {
                  end: function(body, headers, status) {
                    if (!(body instanceof ArrayBuffer))
                      body = o.string.toUTF8Buffer(String(body)).buffer;
                    headers = headers || {};
                    headers['Content-Length'] = body.byteLength;
                    if (!headers['Content-Type']) headers['Content-Type'] = 'text/plain';
                    // TODO: wait for buffer flush
                    socket.write(o.string.toUTF8Buffer(['HTTP/1.1 '+self.statusMessage(status)].concat(Object.keys(headers).map(function(header) {
                      return header+': '+headers[header];
                    })).join('\r\n')+'\r\n\r\n').buffer);
                    socket.write(body);
                  }
                });
                if (typeof read != 'function') read = null;
                else read(buffer.slice(start, end));
                headers = '';
              }
            } else {
              if (read) read(end <= remaining ? buffer : buffer.slice(0, remaining));
              if (end >= remaining) {
                end = remaining;
                request = {cookie: {}};
              }
              remaining -= end;
            }
            buffer = buffer.slice(end);
          } while (buffer.byteLength);
        };
      });
    },
    statusMessage: function(code) {
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
    mimeType: function(ext) {
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
        wmv:  'video/x-ms-wmv',
        woff: 'application/font-woff'
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
