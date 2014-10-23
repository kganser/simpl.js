kernel.add('socket', function(o) {
  if (typeof WorkerGlobalScope != 'undefined') {
    var proxy = o.proxy();
    return {
      listen: function(options, callback) {
        proxy.send('socket_listen', [options], function(o) {
          callback({
            read: function(callback) { proxy.send('socket_read', [o.socketId], callback, true); },
            write: function(data, callback) { proxy.send('socket_write', [o.socketId, data], callback); },
            disconnect: function() { proxy.send('socket_disconnect', [o.socketId]); },
            peerAddress: o.peerAddress,
            socketId: o.socketId
          });
        }, true);
      }
    };
  }
  var socket = chrome.socket;
  return {
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
                      socket.read(connectionSocket.socketId, null, read = function(readInfo) {
                        //console.log('socket.read on socket id', connectionSocket.socketId, 'readInfo resultCode', readInfo && readInfo.resultCode);
                        if (chrome.runtime.lastError || readInfo && readInfo.resultCode < 0)
                          return this.disconnect();
                        callback(readInfo.data);
                        socket.read(connectionSocket.socketId, null, read);
                      }.bind(this));
                    },
                    write: function(data, callback) {
                      if (disconnected) return console.error('Already disconnected');
                      socket.write(connectionSocket.socketId, data, callback || function() {});
                    },
                    disconnect: function() {
                      if (disconnected) return;
                      socket.disconnect(connectionSocket.socketId);
                      socket.destroy(connectionSocket.socketId);
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
    // TODO: clean up API
    read: function(socketId, callback) {
      var read;
      socket.read(socketId, null, read = function(readInfo) {
        if (chrome.runtime.lastError || readInfo && readInfo.resultCode < 0)
          return this.disconnect(socketId);
        callback(readInfo.data);
        socket.read(socketId, null, read);
      }).bind(this);
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
