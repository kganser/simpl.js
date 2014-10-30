kernel.add('socket', function(proxy) {
  var self, clients = {}, servers = {};
  
  proxy = proxy({
    listen: function(args, callback) {
      listen(args[0], callback);
      // TODO: keep reference to peer for accept/read messages
    },
    accept: function(args) {
      var clientSocketId = args[0].clientSocketId;
      clients[clientSocketId] = servers[args[0].socketId]({
        write: function(data, callback) {
          if (!clients[clientSocketId]) return console.error('Already disconnected');
          proxy('write', [clientSocketId, data], callback);
        },
        disconnect: function() {
          if (!clients[clientSocketId]) return;
          proxy('disconnect', [clientSocketId]);
          delete clients[clientSocketId];
        },
        socketId: clientSocketId
      });
    },
    read: function(args) {
      var callback = clients[args[0].socketId];
      if (typeof callback == 'function')
        callback(args[0].data);
    },
    write: function(args, callback) {
      write(args[0], args[1], callback);
    },
    disconnect: function(args) {
      disconnect(args[0]);
    },
    disconnectServer: function(args) {
      disconnectServer(args[0]);
    }
  });
  
  if (typeof WorkerGlobalScope != 'undefined') return self = {
    listen: function(options, callback) {
      proxy('listen', [options], function(error, socketId) {
        if (error) return console.error(error);
        servers[socketId] = callback;
      });
    }
  };
  
  var sockets = chrome.sockets, accept, read;
  
  var listen = function(options, callback) {
    sockets.tcpServer.create({name: options.name}, function(info) {
      var socketId = info.socketId;
      sockets.tcpServer.listen(socketId, options.ip || '0.0.0.0', options.port, options.backlog || 50, function(resultCode) {
        callback(resultCode && chrome.runtime.lastError.message, socketId);
      });
    });
  };
  var write = function(socketId, data, callback) {
    sockets.tcp.send(socketId, data, callback || function() {});
  };
  var disconnect = function(socketId) {
    sockets.tcp.disconnect(socketId);
    sockets.tcp.close(socketId);
  };
  var disconnectServer = function(socketId) {
    sockets.tcpServer.disconnect(socketId);
    sockets.tcpServer.close(socketId);
  };
  
  return self = {
    listen: function(options, callback) {
      listen(options, function(error, socketId) {
        if (error) return console.error(error);
        servers[socketId] = callback;
        if (!accept) {
          sockets.tcpServer.onAccept.addListener(accept = function(info) {
            var clientSocketId = info.clientSocketId;
            sockets.tcp.setPaused(clientSocketId, false);
            if (!servers[info.socketId]) return; // TODO: remove this
            clients[clientSocketId] = servers[info.socketId]({
              write: function(data, callback) {
                if (!clients[clientSocketId]) return console.error('Already disconnected');
                write(clientSocketId, data, callback);
              },
              disconnect: function() {
                if (!clients[clientSocketId]) return;
                disconnect(clientSocketId);
                delete clients[clientSocketId];
              },
              socketId: clientSocketId
            });
            if (!read) {
              sockets.tcp.onReceive.addListener(read = function(info) {
                var callback = clients[info.socketId];
                if (typeof callback == 'function')
                  callback(info.data);
              });
              sockets.tcp.onReceiveError.addListener(function(info) {
                if (!clients[info.socketId]) return;
                disconnect(info.socketId);
                delete clients[info.socketId];
              });
            }
          });
          sockets.tcpServer.onAcceptError.addListener(function(info) {
            console.error(chrome.runtime.lastError.message);
            if (!servers[info.socketId]) return;
            disconnectServer(info.socketId);
            delete servers[info.socketId];
          });
        }
      });
    }
  };
});
