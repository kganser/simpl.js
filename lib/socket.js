kernel.add('socket', function() {
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
    }
  };
});
