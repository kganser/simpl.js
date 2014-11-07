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
              // TODO: postMessage does not guarantee ordering
              proxy('receive', [connection.socketId, data], null, [data]);
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
        send: function(data, callback) {
          proxy('send', [clientSocketId, data], callback, [data]);
        },
        disconnect: function() {
          proxy('disconnect', [clientSocketId]);
          delete clients[clientSocketId];
        },
        setNoDelay: function(noDelay, callback) {
          proxy('setNoDelay', [clientSocketId, noDelay], callback);
        },
        getInfo: function(callback) {
          proxy('getInfo', [clientSocketId], callback);
        },
        socketId: clientSocketId
      });
    },
    receive: function(args) {
      var callback = clients[args[0]];
      if (typeof callback == 'function')
        callback(args[1]);
    },
    send: function(args, callback) {
      send(args[0], args[1], callback);
    },
    setNoDelay: function(args, callback) {
      setNoDelay(args[0], args[1], callback);
    },
    getInfo: function(args, callback) {
      getInfo(args[0], callback);
    },
    disconnect: function(args) {
      disconnect(args[0]);
    },
    disconnectServer: function(args) {
      disconnectServer(args[0]);
    },
    getServerInfo: function(args, callback) {
      getServerInfo(args[0], callback);
    },
  });
  
  if (kernel.worker) return {
    listen: function(options, onConnect, callback) {
      proxy('listen', [options], function(error, socketId) {
        if (error) return callback && callback(error);
        servers[socketId] = onConnect;
        if (callback) callback(false, {
          disconnect: function() {
            proxy('disconnectServer', [socketId]);
          },
          getInfo: function(callback) {
            proxy('getServerInfo', [socketId], callback);
          }
        });
      });
    }
  };
  
  var sockets = chrome.sockets, accept, receive;
  
  var listen = function(options, callback) {
    sockets.tcpServer.create({name: options.name}, function(info) {
      var socketId = info.socketId;
      sockets.tcpServer.listen(socketId, options.ip || '0.0.0.0', options.port, options.backlog || 50, function(resultCode) {
        callback(resultCode && chrome.runtime.lastError.message, socketId);
      });
    });
  };
  var send = function(socketId, data, callback) {
    if (!clients[socketId]) return callback && callback({resultCode: -1, error: 'Already disconnected'});
    sockets.tcp.send(socketId, data, function(info) {
      if (info.resultCode) info.error = chrome.runtime.lastError.message;
      if (callback) callback(info);
    });
  };
  var setNoDelay = function(socketId, noDelay, callback) {
    if (!clients[socketId]) return callback && callback('Already disconnected');
    sockets.tcp.setNoDelay(socketId, noDelay, callback || function() {});
  };
  var getInfo = function(socketId, callback) {
    if (!clients[socketId]) return callback();
    sockets.tcp.getInfo(socketId, callback);
  };
  var disconnect = function(socketId) {
    if (!clients[socketId]) return;
    sockets.tcp.disconnect(socketId);
    sockets.tcp.close(socketId);
    delete clients[socketId];
  };
  var getServerInfo = function(socketId, callback) {
    if (!servers[socketId]) return callback();
    sockets.tcp.getInfo(socketId, callback);
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
        if (error) return callback && callback(error);
        servers[socketId] = onConnect;
        if (callback) callback(false, {
          disconnect: function() {
            disconnectServer(socketId);
          },
          getInfo: function(callback) {
            getServerInfo(socketId, callback);
          }
        });
        if (!accept) {
          sockets.tcpServer.onAccept.addListener(accept = function(info) {
            var clientSocketId = info.clientSocketId;
            sockets.tcp.setPaused(clientSocketId, false);
            clients[clientSocketId] = servers[info.socketId]({
              send: function(data, callback) {
                send(clientSocketId, data, callback);
              },
              disconnect: function() {
                disconnect(clientSocketId);
              },
              setNoDelay: function(noDelay, callback) {
                setNoDelay(clientSocketId, noDelay, callback);
              },
              getInfo: function(callback) {
                getInfo(socketId, callback);
              },
              socketId: clientSocketId
            });
            if (!receive) {
              sockets.tcp.onReceive.addListener(receive = function(info) {
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
