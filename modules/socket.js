simpl.add('socket', function(modules, proxy) {
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
          if (disconnectSocket) disconnectServer(socketId);
          disconnectSocket = socketId;
        }
        callback(error, socketId);
      });
      return function() {
        if (disconnectSocket) disconnectServer(disconnectSocket);
        disconnectSocket = true;
      };
    },
    connect: function(args, callback, proxy) {
      var disconnectSocket;
      connect(args[0], function(error, socketId) {
        if (!error) {
          if (disconnectSocket) disconnect(socketId);
          disconnectSocket = socketId;
        }
        callback(error, socketId);
        return function(data) {
          proxy('receive', [socketId, data], [data]);
        };
      });
      return function() {
        if (disconnectSocket) disconnect(disconnectSocket);
        disconnectSocket = true;
      };
    },
    accept: function(args) {
      var clientSocketId = args[1],
          server = servers[args[0]];
      if (!server) return;
      clients[clientSocketId] = server({
        send: function(data, callback) {
          proxy('send', [clientSocketId, data], callback, [data]);
        },
        secure: function(options, callback) {
          proxy('secure', [clientSocketId, options], callback);
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
    secure: function(args, callback) {
      secure(args[0], args[1], callback);
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
    }
  });
  
  if (simpl.worker) return {
    listen: function(options, accept, callback) {
      proxy('listen', [options], function(error, socketId) {
        if (error) return callback && callback(error);
        servers[socketId] = accept;
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
    },
    connect: function(options, callback) {
      proxy('connect', [options], function(error, socketId) {
        if (error) return callback(error);
        clients[socketId] = callback(false, {
          send: function(data, callback) {
            proxy('send', [socketId, data], callback, [data]);
          },
          secure: function(options, callback) {
            proxy('secure', [socketId, options], callback);
          },
          disconnect: function() {
            proxy('disconnect', [socketId]);
            delete clients[socketId];
          },
          setNoDelay: function(noDelay, callback) {
            proxy('setNoDelay', [socketId, noDelay], callback);
          },
          getInfo: function(callback) {
            proxy('getInfo', [socketId], callback);
          },
          socketId: socketId
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
    servers[serverSocketId].clients[clientSocketId] = true;
    clients[clientSocketId] = {server: serverSocketId, callback: servers[serverSocketId].callback({
      send: function(data, callback) {
        send(clientSocketId, data, callback);
      },
      secure: function(options, callback) {
        secure(clientSocketId, options, callback);
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
  
  var listen = function(options, accept, callback) {
    sockets.tcpServer.create({name: options.name}, function(info) {
      var socketId = info.socketId;
      try {
        sockets.tcpServer.listen(socketId, options.address || '0.0.0.0', options.port, options.backlog, function(resultCode) {
          if (resultCode) sockets.tcpServer.close(socketId);
          else servers[socketId] = {clients: {}, callback: accept};
          callback(resultCode && chrome.runtime.lastError.message, socketId);
        });
      } catch (e) {
        callback(e.message);
      }
    });
  };
  var connect = function(options, callback) {
    sockets.tcp.create({name: options.name}, function(info) {
      var socketId = info.socketId;
      try {
        sockets.tcp.connect(socketId, options.address || '127.0.0.1', options.port, function(resultCode) {
          if (resultCode) sockets.tcp.close(socketId);
          callback = callback(resultCode && chrome.runtime.lastError.message, socketId);
          if (!resultCode) clients[socketId] = {callback: callback};
        });
      } catch (e) {
        callback(e.message);
      }
    });
  };
  var send = function(socketId, data, callback) {
    if (!clients[socketId]) return callback && callback({resultCode: -1, error: 'Already disconnected'});
    sockets.tcp.send(socketId, data, function(info) {
      if (info.resultCode) info.error = chrome.runtime.lastError.message;
      if (callback) callback(info);
    });
  };
  var secure = function(socketId, options, callback) {
    if (!clients[socketId]) return callback && callback('Already disconnected');
    sockets.tcp.setPaused(socketId, true, function() {
      sockets.tcp.secure(socketId, options, function(error) {
        sockets.tcp.setPaused(socketId, false, function() {
          if (callback) callback(error);
        });
      });
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
    var client = clients[socketId];
    if (!client) return;
    sockets.tcp.disconnect(socketId);
    sockets.tcp.close(socketId);
    if (client.server) delete servers[client.server].clients[socketId];
    delete clients[socketId];
  };
  var getServerInfo = function(socketId, callback) {
    if (!servers[socketId]) return callback();
    sockets.tcp.getInfo(socketId, callback);
  };
  var disconnectServer = function(socketId) {
    if (!servers[socketId]) return;
    sockets.tcpServer.close(socketId);
    Object.keys(servers[socketId].clients).forEach(function(socketId) {
      disconnect(parseInt(socketId, 10));
    });
    delete servers[socketId];
  };
  
  /** socket: {
        connect: function(options:ConnectOptions, callback:function(error:string|null, socket:ClientSocket|false) -> function(data:ArrayBuffer)),
        listen: function(options:ListenOptions, accept:function(ClientSocket) -> function(data:ArrayBuffer), callback:function(error:string|null, socket:ServerSocket|false))
      }
      
      TCP client/server. `callback` receives either an `error` string or `socket` instance. `accept` is executed with
      every accepted connection. A reader function should be returned by `connect`'s `callback` and `listen`'s `accept`
      functions. */
  
  /** ConnectOptions: {
        address='127.0.0.1': string,
        port: number,
        name=undefined: string
      } */
  /** ListenOptions: {
        address='0.0.0.0': string,
        port: number,
        backlog=50: number,
        name=undefined: string
      } */
  /** ClientSocket: {
        send: function(data:ArrayBuffer, callback:function({info:SendInfo, bytesSent:number|undefined})),
        secure: function(options=undefined:SecureOptions, callback:function(error:string|number)),
        disconnect: function,
        setNoDelay: function(noDelay:boolean, callback:function(error:string|number)),
        getInfo: function(callback:function(ClientSocketInfo)),
        socketId: number
      } */
  /** SendInfo: {
        resultCode: number,
        error: string|undefined,
        bytesSent: number|undefined
      } */
  /** SecureOptions: {
        tlsVersion: {min: undefined|string, max:undefined|string}
      }

      `tlsVersion` values can be `'ssl3'`, `'tls1'`, `'tls1.1'`, or `'tls1.2'`. */
  /** ClientSocketInfo: {
        socketId: number,
        name: string|undefined,
        connected: boolean,
        localAddress: string,
        localPort: number,
        peerAddress: string,
        peerPort: number
      } */
  /** ServerSocket: {
        disconnect: function,
        getInfo: function(callback:function(ServerSocketInfo))
      } */
  /** ServerSocketInfo: {
        socketId: number,
        name: string|undefined,
        peerAddress: string,
        peerPort: number
      } */
  return {
    listen: function(options, accept, callback) {
      listen(options, accept, function(error, socketId) {
        if (callback) callback(error, !error && {
          disconnect: function() {
            disconnectServer(socketId);
          },
          getInfo: function(callback) {
            getServerInfo(socketId, callback);
          }
        });
      });
    },
    connect: function(options, callback) {
      connect(options, function(error, socketId) {
        callback(error, !error && {
          send: function(data, callback) {
            send(socketId, data, callback);
          },
          secure: function(options, callback) {
            secure(socketId, options, callback);
          },
          disconnect: function() {
            disconnect(socketId);
          },
          setNoDelay: function(noDelay, callback) {
            setNoDelay(socketId, noDelay, callback);
          },
          getInfo: function(callback) {
            getInfo(socketId, callback);
          },
          socketId: socketId
        });
      });
    }
  };
});