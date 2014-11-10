simpl.add('socket', function(proxy) {
  var clients = {}, servers = {};
  
  proxy = proxy({
    listen: function(args, callback, proxy) {
      var disconnectSocket;
      listen(args[0], function(client) {
        servers[disconnectSocket].clients[client.socketId] = true;
        proxy('accept', [disconnectSocket, client.socketId]);
        return function(data) {
          // TODO: postMessage does not guarantee ordering
          proxy('receive', [client.socketId, data], null, [data]);
        };
      }, function(error, socketId) {
        if (!error) {
          if (disconnectSocket) disconnectServer(disconnectSocket);
          disconnectSocket = socketId;
        }
        callback(error, socketId);
      });
      return function() {
        if (disconnectSocket) disconnectServer(disconnectSocket);
        disconnectSocket = true;
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
  
  if (simpl.worker) return {
    listen: function(options, onConnect, callback) {
      proxy('listen', [options], function(error, socketId) {
        if (error) return callback && callback(error);
        servers[socketId] = onConnect;
        if (callback) callback(false, {
          disconnect: function() {
            proxy('disconnectServer', [socketId]);
            delete servers[socketId];
          },
          getInfo: function(callback) {
            proxy('getServerInfo', [socketId], callback);
          }
        });
      });
    }
  };
  
  var sockets = chrome.sockets;
  
  sockets.tcpServer.onAccept.addListener(function(info) {
    var serverSocketId = info.socketId,
        clientSocketId = info.clientSocketId;
    if (!servers[serverSocketId]) return;
    sockets.tcp.setPaused(clientSocketId, false);
    clients[clientSocketId] = {server: serverSocketId, callback: servers[serverSocketId].callback({
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
        getInfo(clientSocketId, callback);
      },
      socketId: clientSocketId
    })};
  });
  sockets.tcpServer.onAcceptError.addListener(function(info) {
    console.error(chrome.runtime.lastError.message);
    disconnectServer(info.socketId);
  });
  sockets.tcp.onReceive.addListener(function(info) {
    var client = clients[info.socketId];
    if (client && client.callback)
      client.callback(info.data);
  });
  sockets.tcp.onReceiveError.addListener(function(info) {
    disconnect(info.socketId);
  });
  
  var listen = function(options, onConnect, callback) {
    sockets.tcpServer.create({name: options.name}, function(info) {
      var socketId = info.socketId;
      sockets.tcpServer.listen(socketId, options.ip || '0.0.0.0', options.port, options.backlog || 50, function(resultCode) {
        if (resultCode) sockets.tcpServer.close(socketId);
        else servers[socketId] = {clients: {}, callback: onConnect};
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
    var client = clients[socketId = parseInt(socketId, 10)];
    if (!client) return;
    sockets.tcp.disconnect(socketId);
    sockets.tcp.close(socketId);
    delete servers[client.server].clients[socketId];
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
    Object.keys(servers[socketId].clients).forEach(disconnect);
    delete servers[socketId];
  };
  
  return {
    listen: function(options, onConnect, callback) {
      listen(options, onConnect, function(error, socketId) {
        if (callback) callback(error, !error && {
          disconnect: function() {
            disconnectServer(socketId);
          },
          getInfo: function(callback) {
            getServerInfo(socketId, callback);
          }
        });
      });
    }
  };
});
