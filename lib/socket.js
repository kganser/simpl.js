kernel.add('socket', function(o) {
  var self;
  if (typeof WorkerGlobalScope != 'undefined') {
    var proxy = o.proxy();
    return self = {
      listen: function(options, callback) {
        proxy.send('socket_listen', [options], function(o) {
          var read, disconnected;
          callback({
            read: function(callback) {
              if (read) return console.error('Already reading');
              proxy.send('socket_read', [o.socketId], read = function(readInfo) {
                if (readInfo && readInfo.resultCode < 0)
                  return disconnected = true;
                callback(readInfo.data);
                proxy.send('socket_read', [o.socketId], read);
              });
            },
            write: function(data, callback) {
              if (disconnected) return console.error('Already disconnected');
              proxy.send('socket_write', [o.socketId, data], callback);
            },
            disconnect: function() {
              if (disconnected) return;
              proxy.send('socket_disconnect', [o.socketId]);
              disconnected = true;
            },
            peerAddress: o.peerAddress,
            socketId: o.socketId
          });
        }, true);
      }
    };
  }
  var socket = chrome.socket;
  return self = {
    listen: function(options, callback) {
      options = options || {};
      socket.create('tcp', {}, function(listenSocket) {
        socket.listen(listenSocket.socketId, options.ip || '0.0.0.0', options.port, options.backlog || 50, function(resultCode) {
          if (resultCode === 0) {
            socket.accept(listenSocket.socketId, function accept(connectionSocket) {
              // accept another connection
              socket.accept(listenSocket.socketId, accept);
              if (connectionSocket.resultCode === 0) {
                socket.getInfo(connectionSocket.socketId, function(socketInfo) {
                  var read, disconnected;
                  callback({
                    read: function(callback) {
                      if (read) return console.error('Already reading');
                      self.read(connectionSocket.socketId, read = function(readInfo) {
                        //console.log('socket.read on socket id', connectionSocket.socketId, 'readInfo resultCode', readInfo && readInfo.resultCode);
                        if (chrome.runtime.lastError || readInfo && readInfo.resultCode < 0)
                          return disconnected = true;
                        callback(readInfo.data);
                        self.read(connectionSocket.socketId, read);
                      });
                    },
                    write: function(data, callback) {
                      if (disconnected) return console.error('Already disconnected');
                      self.write(connectionSocket.socketId, data, callback || function() {});
                    },
                    disconnect: function() {
                      if (disconnected) return;
                      self.disconnect(connectionSocket.socketId);
                      disconnected = true;
                    },
                    peerAddress: socketInfo.peerAddress,
                    socketId: connectionSocket.socketId
                  });
                });
              } else {
                console.error('Unable to accept connection');
              }
            });
          } else {
            console.error('Unable to listen to socket', chrome.runtime.lastError);
          }
        });
      });
    },
    // Flat API
    read: function(socketId, callback) {
      socket.read(socketId, null, callback);
    },
    write: function(socketId, data, callback) {
      socket.write(socketId, data, callback);
    },
    disconnect: function(socketId) {
      socket.disconnect(socketId);
      socket.destroy(socketId);
    }
  };
}, {proxy: 0});
