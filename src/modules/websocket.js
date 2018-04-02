simpl.add('websocket', function(modules) {
  
  var utf8 = modules.string.toUTF8Buffer,
      utf8decode = modules.string.fromUTF8Buffer,
      encode = modules.string.base64FromBuffer,
      self;
  
  var frame = function(opcode, message, code) {
    var length = message.byteLength+(opcode == 8 ? 2 : 0),
        offset = length < 65536 ? length < 126 ? 2 : 4 : 10,
        frame = new DataView(new ArrayBuffer(offset+length));
    frame.setUint8(0, 128 | opcode);
    frame.setUint8(1, offset < 10 ? offset < 4 ? length : 126 : 127);
    if (offset == 4) {
      frame.setUint16(2, length & 65535);
    } else if (offset == 10) {
      frame.setUint32(2, length / 0x100000000 | 0);
      frame.setUint32(6, length | 0);
    }
    if (opcode == 8) {
      frame.setUint16(offset, code);
      offset += 2;
    }
    new Uint8Array(frame.buffer).set(new Uint8Array(message), offset);
    return frame.buffer;
  };
  
  /** websocket: {
        accept: function(request:Request, response:Response, callback:ConnectCallback, options=undefined:AcceptOptions),
        statusMessage: function(code:number) -> string
      }
      
      WebSocket connections are accepted using a `request`-`response` pair from an existing HTTP connection. */
      
  /** ConnectCallback: function(connection:Connection, protocol:string, extensions:[string, ...]) -> undefined|function(message:string|ArrayBuffer)
      
      If a function is returned, it is called with each message received from the client on the connection. */
      
  /** AcceptOptions: {
        maxLength=65535: number,
        origin=undefined: string|RegExp,
        protocols=undefined: [string, ...],
        extensions=undefined: [string, ...]
      }
      
      `maxLength` is measured in bytes per message frame, and must be less than `2^48`. If defined, `origin`,
      `protocols`, and `extensions` are compared against the request headers to determine if a request is acceptable.
      `protocols` and `extensions` are specified in decreasing priority order. */
      
  /** Connection: {
        send: function(message:string|ArrayBuffer, callback=undefined:function(info:SendInfo)) -> Connection,
        close: function(code=1000:number, reason='Normal Closure':string),
        onMessage: function(message:string|ArrayBuffer),
        onError: function(code:number),
        socket: ClientSocket
      }
      
      Messages are received from the client by setting the connection's `onMessage` listener or returning the listener
      from `ConnectCallback`. When terminated by the client, or on any protocol error, the connection is automatically
      closed and `onError` is called with the WebSocket error code. `ClientSocket` and `SendInfo` are defined in the
      `socket` module. */
  return self = {
    accept: function(request, response, callback, options) {
      if (!options) options = {};
      var connection, closed, buffer, fin, opcode, mask, length, o,
          l = 0, pos = 0,
          socket = response.socket,
          origin = request.headers.Origin,
          key = request.headers['Sec-WebSocket-Key'],
          protocol = request.headers['Sec-WebSocket-Protocol'],
          extensions = request.headers['Sec-WebSocket-Extension'],
          error = function(code) {
            if (!connection) return response.generic(code, {
              'Sec-WebSocket-Version': 13,
              'Sec-WebSocket-Protocol': options.protocols ? options.protocols.join(', ') : null
            });
            connection.close(code);
            if (connection.onError) connection.onError(code);
          };
      if (!key || !/websocket/i.test(request.headers.Upgrade) || request.headers['Sec-WebSocket-Version'] != '13')
        return error(400);
      if (origin && options.origin && origin !== options.origin && !(options.origin instanceof RegExp && origin.match(options.origin)))
        return error(403);
      if (protocol) {
        o = {};
        protocol.split(/, */).forEach(function(p) { o[p.split(';', 1)[0]] = 1; });
        if (!(options.protocols || []).some(function(p) {
          if (p in o) return protocol = p;
        })) return error(400);
      }
      if (extensions) {
        o = {};
        extensions.split(/, */).forEach(function(e) { o[e.split(';', 1)[0]] = 1; });
        extensions = [];
        (options.extensions || []).forEach(function(e) {
          if (e in o) extensions.push(e);
        });
      }
      crypto.subtle.digest('sha-1', utf8(key+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11')).then(function(hash) {
        response.end('', {
          Upgrade: 'websocket',
          Connection: 'upgrade',
          'Sec-WebSocket-Accept': encode(hash),
          'Sec-WebSocket-Version': 13,
          'Sec-WebSocket-Protocol': protocol,
          'Sec-WebSocket-Extension': (extensions || []).join(', ') || null
        }, 101, function(info) {
          if (info.error) return error(1006);
          var receive = callback(connection = {
            send: function(message, callback) {
              if (!closed) socket.send(typeof message == 'string' ? frame(1, utf8(message).buffer) : frame(2, message), function(info) {
                if (info.error) error(1006);
                if (callback) callback(info);
              });
              return connection;
            },
            ping: function() {
              if (!closed) socket.send(frame(9, utf8('ping').buffer), function(info) {
                if (info.error) error(1006);
              });
            },
            close: function(code, message) {
              if (!code) code = 1000;
              if (message == null) message = self.statusMessage(code);
              if (!closed) socket.send(frame(8, utf8(message).buffer, code), socket.disconnect);
              closed = true;
            },
            socket: socket
          }, protocol, extensions || []);
          if (typeof connection.onMessage != 'function')
            connection.onMessage = receive;
          socket.onReceive = function(data) {
            //console.log('received: '+data.byteLength+' '+modules.string.hexFromBuffer(data));
            if (closed) return;
            var start, i = 0;
            data = new Uint8Array(data);
            while (i < data.length) {
              start = l < 127 ? l < 126 ? 6 : 8 : 14;
              if (pos < start) {
                switch (pos) {
                  case 0:
                    fin = data[i] & 128;
                    opcode = data[i] & 15 || opcode;
                    break;
                  case 1:
                    if (data[i] & 128 ^ 128) return error(1002); // message not masked
                    l = data[i] & 127;
                    length = l < 126 ? l : 0;
                    mask = 0;
                    break;
                  case 2:
                    if (l > 126) return error(1009);
                    if (l < 126) mask |= data[i] << 24;
                    else length += data[i] << 8;
                    break;
                  case 3:
                    if (l > 126) return error(1009);
                    if (l < 126) mask |= data[i] << 16;
                    else length += data[i];
                    break;
                  case 4:
                    if (l > 126) length += data[i] * 1099511627776; // << 40
                    else mask |= data[i] << (l < 126 ? 8 : 24);
                    break;
                  case 5:
                    if (l > 126) length += data[i] * 4294967296; // << 32
                    else mask |= l < 126 ? data[i] : data[i] << 16;
                    break;
                  case 6:
                    if (l > 126) length += data[i] * 16777216; // << 24
                    else mask |= data[i] << 8;
                    break;
                  case 7:
                    if (l > 126) length += data[i] << 16;
                    else mask |= data[i];
                    break;
                  case 8:
                    length += data[i] << 8;
                    break;
                  case 9:
                    length += data[i];
                    break;
                  case 10:
                    mask |= data[i] << 24;
                    break;
                  case 11:
                    mask |= data[i] << 16;
                    break;
                  case 12:
                    mask |= data[i] << 8;
                    break;
                  case 13:
                    mask |= data[i];
                }
                i++;
                pos++;
              } else {
                if (length > (options.maxLength || 65535))
                  return error(1009);
                if (!buffer) {
                  buffer = new Uint8Array(length);
                } else if (pos == start) {
                  var b = new Uint8Array(buffer.length+length);
                  b.set(buffer);
                  buffer = b;
                }
                var offset = pos-start,
                    bufferOffset = buffer.length-length+offset,
                    size = Math.min(length-offset, data.length-i);
                for (var j = 0; j < size; j++)
                  buffer[bufferOffset+j] = data[i+j] ^ mask >> (3-(offset+j) % 4 << 3) & 255;
                pos += size;
                i += size;
                if (offset+size == length) {
                  //console.log('fin: '+fin+' opcode: '+opcode+' length: '+length+' mask: '+mask.toString(16)+' unmasked: '+modules.string.hexFromBuffer(buffer));
                  l = pos = 0;
                  if (fin) {
                    buffer = buffer.buffer;
                    if (opcode == 8) error(1006); // close
                    else if (opcode == 9) socket.send(frame(10, buffer)); // pong
                    else if (connection.onMessage) connection.onMessage(opcode == 1 ? utf8decode(buffer) : buffer);
                    buffer = null;
                  }
                }
              }
            }
          };
        });
      });
    },
    statusMessage: function(code) {
      if (!code) return '1000 Normal Closure';
      if (typeof code != 'number') return code;
      return code+' '+{
        1000: 'Normal Closure',
        1001: 'Going Away',
        1002: 'Protocol Error',
        1003: 'Unsupported Data',
        1005: 'No Status Received',
        1006: 'Abnormal Closure',
        1007: 'Invalid Frame Payload Data',
        1008: 'Policy Violation',
        1009: 'Message Too Big',
        1010: 'Mandatory Extension',
        1011: 'Internal Server Error',
        1015: 'TLS Handshake'
      }[code];
    }
  };
}, 0, {string: 0});
