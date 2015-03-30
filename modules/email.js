simpl.add('email', function(modules) {
  
  /** email: {
        send: function(message:Message, config:Config, callback:function(error:false|SendError, undelivered:EmailAddresses))
      }
      
      SMTP client. Rejected recipients are specified in `undelivered` as an array of objects if the message was
      otherwise accepted by the SMTP server.*/
  /** Message: {
        from: EmailAddress,
        to: EmailAddresses,
        cc: EmailAddresses,
        bcc: EmailAddresses,
        subject: string,
        body: string
      } */
  /** EmailAddresses: undefined|EmailAddress|[EmailAddress, ...] */
  /** EmailAddress: string|{
        email: string,
        name: string
      } */
  /** Config: {
        smtpHost='127.0.0.1': string,
        smtpClient='localhost': string,
        port=25: number
      }
      
      If specified, `dkim.key` is a base-64 encoded RSA private key. */
  /** SendError: {
        code: null|number,
        text: string
      } */
  var normalize = function(addrs) {
    return (addrs ? Array.isArray(addrs) ? addrs : [addrs] : []).map(function(addr) {
      return typeof addr == 'object' && addr ? {email: addr.email, name: addr.name} : {email: addr};
    });
  };
  var format = function(addr) {
    return (addr.name ? addr.name+' ' : '')+'<'+addr.email+'>';
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
          all = to.concat(cc).concat(bcc),
          total = all.length,
          undelivered = [];
      
      if (!total) return callback(false, undelivered);
      modules.socket.connect({address: config.smtpHost, port: config.port}, function(error, socket) {
        if (error) return callback({text: 'Unable to connect to SMTP host '+config.smtpHost+':'+config.port});
        var reader, read = function(callback) {
          var buffer = '';
          reader = function(data) {
            if (/^... [^\r\n]*$/m.test(buffer += data)) {
              //console.log('>>> '+buffer);
              reader = null;
              var parts = buffer.match(/^(\d{3})[ -](?:\d\.\d\.\d )?([^\r\n]*)/) || [null, '0', buffer.split(/\r\n?|\n/)[0]];
              callback(parseInt(parts[1], 10) || null, parts[2]);
            }
          };
        };
        var send = function(command, expect, success) {
          socket.send(modules.string.toUTF8Buffer(command+'\r\n').buffer, function(result) {
            if (result.error) return callback({text: 'TCP send error: '+result.error});
            //console.log('<<< '+command);
            read(function(code, text) {
              if (expect && expect !== code) return callback({code: code, text: text});
              success(code);
            });
          });
        };
        read(function(result) {
          if (result.code == 421) return callback(result);
          send('EHLO '+config.smtpClient, 250, function() { // TODO: attempt HELO if this fails
            send('MAIL FROM:<'+from.email+'>', 250, function rcpt() {
              var addr = all.shift();
              if (addr) {
                send('RCPT TO:<'+addr.email+'>', false, function(code) {
                  if (code != 250 && code != 251) undelivered.push(addr);
                  rcpt();
                });
              } else if (undelivered.length < total) {
                send('DATA', 354, function() {
                  send([
                    'Date: '+new Date().toUTCString(),
                    (to.length ? 'To: '+to.map(format).join(', ')+'\r\n' : cc.length ? '' : 'To: undisclosed-recipients:;\r\n')+
                    (cc.length ? 'Cc: '+cc.map(format).join(', ')+'\r\n' : '')+
                    'From: '+format(from),
                    'Subject: '+message.subject, '',
                    message.body, '.', '' // TODO: line breaks
                  ].join('\r\n'), 250, function() {
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