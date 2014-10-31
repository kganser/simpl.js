kernel.add('socket', function(proxy) {
  var clients = {}, servers = {};
  
  proxy = proxy({
    listen: function(args, callback, proxy) {
      var disconnect;
      listen(args[0], function(error, socketId) {
        if (!error) {
          servers[socketId] = function(connection) {
            proxy('accept', [socketId, connection.socketId]);
            return function(data) {
              proxy('read', [connection.socketId, data]);
            };
          };
          if (disconnect) disconnectServer(socketId);
          disconnect = socketId;
        }
        callback(error, socketId);
      });
      return function() {
        if (disconnect) disconnectServer(disconnect);
        disconnect = true;
        // TODO: disconnect active connections
      };
    },
    accept: function(args) {
      var clientSocketId = args[1];
      clients[clientSocketId] = servers[args[0]]({
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
      var callback = clients[args[0]];
      if (typeof callback == 'function')
        callback(args[1]);
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
  
  if (kernel.worker) return {
    listen: function(options, onConnect, callback) {
      proxy('listen', [options], function(error, socketId) {
        if (error) return console.error(error);
        servers[socketId] = onConnect;
        if (callback) callback({
          disconnect: function() {
            proxy('disconnectServer', [socketId]);
          }
        });
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
    if (!clients[socketId]) return;
    sockets.tcp.disconnect(socketId);
    sockets.tcp.close(socketId);
    delete clients[socketId];
  };
  var disconnectServer = function(socketId) {
    if (!servers[socketId]) return;
    sockets.tcpServer.disconnect(socketId);
    sockets.tcpServer.close(socketId);
    delete servers[socketId];
  };
  
  return {
    listen: function(options, onConnect, callback) {
      listen(options, function(error, socketId) {
        if (error) return console.error(error);
        servers[socketId] = onConnect;
        if (callback) callback({
          disconnect: function() {
            disconnectServer(socketId);
          }
        });
        if (!accept) {
          sockets.tcpServer.onAccept.addListener(accept = function(info) {
            var clientSocketId = info.clientSocketId;
            sockets.tcp.setPaused(clientSocketId, false);
            clients[clientSocketId] = servers[info.socketId]({
              write: function(data, callback) {
                if (!clients[clientSocketId]) return console.error('Already disconnected');
                write(clientSocketId, data, callback);
              },
              disconnect: function() {
                disconnect(clientSocketId);
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
                disconnect(info.socketId);
              });
            }
          });
          sockets.tcpServer.onAcceptError.addListener(function(info) {
            console.error(chrome.runtime.lastError.message);
            disconnectServer(info.socketId);
          });
        }
      });
    }
  };
});
