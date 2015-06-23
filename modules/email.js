simpl.add('email', function(modules) {
  
  /** email: {
        send: function(message:Message, config:Config, callback:function(error:false|SendError, undelivered:EmailAddresses))
      }
      
      SMTP client. Rejected recipients are specified in `undelivered` as an array of `EmailAddress` objects if the
      message was otherwise accepted by the SMTP server. */
      
  /** Message: {
        from: EmailAddress,
        to: EmailAddresses,
        cc: EmailAddresses,
        bcc: EmailAddresses,
        subject: string,
        body: string,
        headers: object
      }
      
      `Content-Type`, `Date`, and `Message-ID` headers are added by default, and can be overridden in the `headers`
      object, whose values can be null, strings, or string arrays. New lines in `body` are normalized to `\r\n`. */
      
  /** EmailAddresses: undefined|EmailAddress|[EmailAddress, ...] */
  /** EmailAddress: string|{
        email: string,
        name: string
      } */
  /** Config: {
        smtpHost='127.0.0.1': string,
        smtpClient='localhost': string,
        port=25: number
      } */
  /** SendError: {
        code: null|number,
        message: string
      } */
  var normalize = function(addrs) {
    return (addrs ? Array.isArray(addrs) ? addrs : [addrs] : []).map(function(addr) {
      return typeof addr == 'object' && addr ? {email: addr.email, name: addr.name} : {email: addr};
    });
  };
  var format = function(addr) {
    return (addr.name ? addr.name+' ' : '')+'<'+addr.email+'>';
  };
  var base64 = function(string) {
    return modules.string.base64FromBuffer(modules.string.toUTF8Buffer(string));
  };
  return {
    send: function(message, config, callback) {
      if (!message) message = {};
      if (!config.smtpHost) config.smtpHost = '127.0.0.1';
      if (!config.smtpClient) config.smtpClient = 'localhost';
      if (!config.port) config.port = 25;
      
      var from = normalize(message.from)[0],
          to = normalize(message.to),
          cc = normalize(message.cc),
          bcc = normalize(message.bcc),
          subject = (message.subject || '(no subject)').replace(/\r|\n/g, '').trim(),
          body = (message.body || '').replace(/\r\n?/g, '\n').replace(/\n(\n+$)?/g, '\r\n').replace(/^\./gm, '..'),
          headers = message.headers || {},
          recipients = to.concat(cc).concat(bcc),
          total = recipients.length,
          undelivered = [];
      
      if (!total) return callback(false, undelivered);
      modules.socket.connect({address: config.smtpHost, port: config.port}, function(error, socket) {
        if (error) return callback({message: 'Unable to connect to SMTP host '+config.smtpHost+':'+config.port});
        var reader, read = function(callback) {
          var buffer = '';
          reader = function(data) {
            if (/^... [^\r\n]*$/m.test(buffer += data)) {
              //console.log('>>> '+buffer);
              reader = null;
              var parts = buffer.match(/^(\d{3})[ -](?:\d\.\d\.\d )?([^\r\n]*)/) || [null, '0', buffer.split(/\r\n?|\n/)[0]];
              callback({code: parseInt(parts[1], 10) || null, message: parts[2]});
            }
          };
        };
        var send = function(command, expect, success) {
          socket.send(modules.string.toUTF8Buffer(command+'\r\n').buffer, function(result) {
            if (result.error) return callback({message: 'TCP send error: '+result.error});
            //console.log('<<< '+command);
            read(function(result) {
              if (expect && expect !== result.code) return callback(result);
              success(result.code);
            });
          });
        };
        read(function hello(result, secure) {
          if (result && result.code == 421) return callback(result);
          send('EHLO '+config.smtpClient, 250, function start(code, authenticated) { // TODO: attempt HELO if this fails
            // TODO: Enable when socket.setPaused issue is resolved: https://code.google.com/p/chromium/issues/detail?id=467677
            //if (!authenticated && config.auth && config.auth.user && config.auth.password) {
            //  if (secure) return send('AUTH LOGIN', 334, function() {
            //    send(base64(config.auth.user), 334, function() {
            //      send(base64(config.auth.password), 235, function() {
            //        start(null, true);
            //      });
            //    });
            //  });
            //  return send('STARTTLS', 220, function() {
            //    socket.secure(null, function(error) {
            //      if (error) return callback({message: 'TLS error: '+error});
            //      hello(null, true);
            //    });
            //  });
            //}
            send('MAIL FROM:<'+from.email+'>', 250, function rcpt() {
              var addr = recipients.shift();
              if (addr) {
                send('RCPT TO:<'+addr.email+'>', false, function(code) {
                  if (code != 250 && code != 251) undelivered.push(addr);
                  rcpt();
                });
              } else if (undelivered.length < total) {
                send('DATA', 354, function() {
                  if (headers.Date === undefined) headers.Date = new Date().toUTCString();
                  if (headers['Content-Type'] === undefined) headers['Content-Type'] = 'text/plain; charset=utf-8';
                  if (headers['Message-ID'] === undefined)
                    headers['Message-ID'] = '<'+modules.string.hexFromBuffer(crypto.getRandomValues(new Uint8Array(16)))+'@'+config.smtpClient+'>';
                  headers.From = format(from);
                  if (to.length || !cc.length) headers.To = to.length ? to.map(format).join(', ') : 'undisclosed-recipients:;';
                  if (cc.length) headers.Cc = cc.map(format).join(', ');
                  headers.Subject = subject;
                  
                  send(Object.keys(headers).map(function flatten(name) {
                    var value = headers[name];
                    return value ? Array.isArray(value) ? value.map(flatten).join('') : name+': '+value+'\r\n' : '';
                  }).join('')+'\r\n'+body+'\r\n.\r\n', 250, function() {
                    send('QUIT', 221, function() {
                      socket.disconnect();
                      callback(false, undelivered);
                    });
                  });
                });
              } else {
                callback(false, undelivered);
              }
            });
          });
        });
        return function(data) {
          if (reader) reader(modules.string.fromUTF8Buffer(data));
        };
      });
    }
  };
}, 0, {socket: 0, string: 0});