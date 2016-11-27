simpl.add('socket', function(modules, proxy) {
  var clients = {}, servers = {};
  
  proxy = proxy({
    listen: function(args, callback, proxy) {
      var destroy, socketId;
      listen(args[0], function(client) {
        client.onError = function(error) {
          proxy('clientError', [client.socketId, error]);
        };
        client.onDisconnect = function() {
          proxy('clientDisconnect', [client.socketId]);
        };
        proxy('accept', [socketId, client.socketId]);
        return function(data) {
          proxy('receive', [client.socketId, data], null, [data]);
        };
      }, function(error, id) {
        if (!error && destroy) disconnectServer(id);
        callback(error, socketId = id);
      }, function(error) {
        proxy('serverError', [socketId, error]);
      }, function() {
        proxy('serverDisconnect', [socketId]);
      });
      return function() {
        if (socketId) disconnectServer(socketId);
        destroy = true;
      };
    },
    connect: function(args, callback, proxy) {
      var destroy, socketId;
      connect(args[0], function(error, id) {
        if (!error && destroy) disconnect(id);
        callback(error, socketId = id);
        return function(data) {
          proxy('receive', [socketId, data], [data]);
        };
      }, function(error) {
        proxy('clientError', [socketId, error]);
      }, function() {
        proxy('clientDisconnect', [socketId]);
      });
      return function() {
        if (socketId) disconnect(socketId);
        destroy = true;
      };
    },
    accept: function(args) {
      var clientSocketId = args[1],
          server = servers[args[0]],
          socket;
      if (!server) return;
      var receive = server.accept(socket = {
        send: function(data, callback) {
          proxy('send', [clientSocketId, data], callback, [data]);
        },
// TODO: Enable when socket.setPaused issue is resolved: https://code.google.com/p/chromium/issues/detail?id=467677
//        secure: function(options, callback) {
//          proxy('secure', [clientSocketId, options], callback);
//        },
        disconnect: function() {
          proxy('disconnect', [clientSocketId]);
        },
        setPaused: function(paused, callback) {
          proxy('setPaused', [clientSocketId, paused], callback);
        },
        setKeepAlive: function(enabled, delay, callback) {
          proxy('setKeepAlive', [clientSocketId, enabled, delay], callback);
        },
        setNoDelay: function(enabled, callback) {
          proxy('setNoDelay', [clientSocketId, enabled], callback);
        },
        getInfo: function(callback) {
          proxy('getInfo', [clientSocketId], callback);
        },
        socketId: clientSocketId
      });
      if (typeof socket.onReceive != 'function')
        socket.onReceive = receive;
      clients[clientSocketId] = {
        receive: function(data) {
          if (socket.onReceive) socket.onReceive(data);
        },
        error: function(error) {
          if (socket.onError) socket.onError(error);
        },
        disconnect: function() {
          if (socket.onDisconnect) socket.onDisconnect();
        }
      };
    },
    receive: function(args) {
      var client = clients[args[0]];
      if (client) client.receive(args[1]);
    },
    send: function(args, callback) {
      send(args[0], args[1], callback);
    },
    secure: function(args, callback) {
      secure(args[0], args[1], callback);
    },
    setPaused: function(args, callback) {
      setPaused(args[0], args[1], callback);
    },
    setKeepAlive: function(args, callback) {
      setKeepAlive(args[0], args[1], args[2], callback);
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
    clientError: function(args) {
      var client = clients[args[0]];
      if (client) client.error(args[1]);
    },
    clientDisconnect: function(args) {
      var client = clients[args[0]];
      if (client) client.disconnect();
      delete clients[args[0]];
    },
    serverError: function(args) {
      var server = servers[args[0]];
      if (server) server.error(args[1]);
    },
    serverDisconnect: function(args) {
      var server = servers[args[0]];
      if (server) server.disconnect();
      delete servers[args[0]];
    }
  });
  
  if (simpl.worker) return {
    listen: function(options, accept, callback) {
      proxy('listen', [options], function(error, socketId) {
        if (error) return callback && callback(error, false);
        var socket = {
          disconnect: function() {
            proxy('disconnectServer', [socketId]);
          },
          getInfo: function(callback) {
            proxy('getServerInfo', [socketId], callback);
          },
          socketId: socketId
        };
        servers[socketId] = {
          accept: accept,
          error: function(error) {
            if (socket.onError) socket.onError(error);
          },
          disconnect: function() {
            if (socket.onDisconnect) socket.onDisconnect();
          }
        };
        if (callback) callback(false, socket);
      });
    },
    connect: function(options, callback) {
      proxy('connect', [options], function(error, socketId) {
        if (error) return callback(error, false);
        var socket = {
          send: function(data, callback) {
            proxy('send', [socketId, data], callback, [data]);
          },
//          secure: function(options, callback) {
//            proxy('secure', [socketId, options], callback);
//          },
          disconnect: function() {
            proxy('disconnect', [socketId]);
          },
          setNoDelay: function(noDelay, callback) {
            proxy('setNoDelay', [socketId, noDelay], callback);
          },
          getInfo: function(callback) {
            proxy('getInfo', [socketId], callback);
          },
          socketId: socketId
        };
        var receive = callback(false, socket);
        if (typeof socket.onReceive != 'function')
          socket.onReceive = receive;
        clients[socketId] = {
          receive: function(data) {
            if (socket.onReceive) socket.onReceive(data);
          },
          error: function(error) {
            if (socket.onError) socket.onError(error);
          },
          disconnect: function() {
            if (socket.onDisconnect) socket.onDisconnect();
          }
        };
      });
    }
  };
  
  var sockets = chrome.sockets,
      runtime = chrome.runtime;
  
  sockets.tcpServer.onAccept.addListener(function(info) {
    var clientSocketId = info.clientSocketId,
        server = servers[info.socketId],
        socket;
    if (!server) return;
    sockets.tcp.setPaused(clientSocketId, false);
    server.clients[clientSocketId] = true;
    var receive = server.accept(socket = {
      send: function(data, callback) {
        send(clientSocketId, data, callback);
      },
      secure: function(options, callback) {
        secure(clientSocketId, options, callback);
      },
      disconnect: function() {
        disconnect(clientSocketId);
      },
      setPaused: function(paused, callback) {
        setPaused(clientSocketId, paused, callback);
      },
      setKeepAlive: function(enabled, delay, callback) {
        setKeepAlive(clientSocketId, enabled, delay, callback);
      },
      setNoDelay: function(enabled, callback) {
        setNoDelay(clientSocketId, enabled, callback);
      },
      getInfo: function(callback) {
        getInfo(clientSocketId, callback);
      },
      socketId: clientSocketId
    });
    if (typeof socket.onReceive != 'function')
      socket.onReceive = receive;
    clients[clientSocketId] = {
      server: info.socketId,
      receive: function(data) {
        if (socket.onReceive) socket.onReceive(data);
      },
      error: function(error) {
        if (socket.onError) socket.onError(error);
      },
      disconnect: function() {
        if (socket.onDisconnect) socket.onDisconnect();
      }
    };
  });
  sockets.tcpServer.onAcceptError.addListener(function(info) {
    var server = servers[info.socketId];
    if (!server) return;
    server.error(info.resultCode);
    disconnectServer(info.socketId);
  });
  sockets.tcp.onReceive.addListener(function(info) {
    var client = clients[info.socketId];
    if (client) client.receive(info.data);
  });
  sockets.tcp.onReceiveError.addListener(function(info) {
    var client = clients[info.socketId];
    if (!client) return;
    client.error(info.resultCode);
    disconnect(info.socketId);
  });
  
  var listen = function(options, accept, callback, error, disconnect) {
    sockets.tcpServer.create({name: options.name}, function(info) {
      var socketId = info.socketId;
      sockets.tcpServer.listen(socketId, options.address || '0.0.0.0', options.port, options.backlog, function(resultCode) {
        if (resultCode) sockets.tcpServer.close(socketId);
        else servers[socketId] = {clients: {}, accept: accept, error: error, disconnect: disconnect};
        callback(runtime.lastError ? runtime.lastError.message : false, socketId);
      });
    });
  };
  var connect = function(options, callback, error, disconnect) {
    sockets.tcp.create({name: options.name}, function(info) {
      var socketId = info.socketId;
      sockets.tcp.connect(socketId, options.address || '127.0.0.1', options.port, function(resultCode) {
        callback = callback(runtime.lastError ? runtime.lastError.message : false, socketId);
        if (resultCode) return sockets.tcp.close(socketId);
        clients[socketId] = {receive: callback, error: error, disconnect: disconnect};
      });
    });
  };
  var send = function(socketId, data, callback) {
    sockets.tcp.send(socketId, data, function(info) {
      if (!info) info = {resultCode: -2};
      if (runtime.lastError) info.error = runtime.lastError.message;
      if (callback) callback(info);
    });
  };
  var secure = function(socketId, options, callback) {
    sockets.tcp.setPaused(socketId, true, function() {
      sockets.tcp.secure(socketId, options, function(error) {
        if (runtime.lastError) error = runtime.lastError.message;
        sockets.tcp.setPaused(socketId, false, function() {
          if (callback) callback(error || false);
        });
      });
    });
  };
  var setPaused = function(socketId, paused, callback) {
    sockets.tcp.setPaused(socketId, paused, function() {
      if (callback) callback(runtime.lastError ? runtime.lastError.message : false);
    });
  };
  var setKeepAlive = function(socketId, enabled, delay, callback) {
    sockets.tcp.setKeepAlive(socketId, enabled, delay, function() {
      if (callback) callback(runtime.lastError ? runtime.lastError.message : false);
    });
  };
  var setNoDelay = function(socketId, enabled, callback) {
    sockets.tcp.setNoDelay(socketId, enabled, function() {
      if (callback) callback(runtime.lastError ? runtime.lastError.message : false);
    });
  };
  var getInfo = function(socketId, callback) {
    sockets.tcp.getInfo(socketId, callback);
  };
  var disconnect = function(socketId) {
    var client = clients[socketId];
    if (!client) return;
    sockets.tcp.disconnect(socketId, client.disconnect);
    sockets.tcp.close(socketId);
    if (client.server) delete servers[client.server].clients[socketId];
    delete clients[socketId];
  };
  var getServerInfo = function(socketId, callback) {
    sockets.tcpServer.getInfo(socketId, callback);
  };
  var disconnectServer = function(socketId) {
    var server = servers[socketId];
    if (!server) return;
    sockets.tcpServer.close(socketId, server.disconnect);
    Object.keys(server.clients).forEach(function(socketId) {
      disconnect(parseInt(socketId, 10));
    });
    delete servers[socketId];
  };
  
  /** socket: {
        connect: function(options:ConnectOptions, callback:function(error:string|false, socket:ClientSocket|false) -> undefined|function(data:ArrayBuffer)),
        listen: function(options:ListenOptions, accept:function(ClientSocket) -> undefined|function(data:ArrayBuffer), callback:function(error:string|false, socket:ServerSocket|false))
      }
      
      TCP client/server. `callback` receives either an `error` string or `socket` instance. `accept` is executed with
      every accepted connection. Data is received on a `ClientSocket` object by setting its `onReceive` listener or
      returning the listener from `connect`'s `callback` or `listen`'s `accept` functions. `onError` and `onDisconnect`
      listeners can be set on `ClientSocket` and `ServerSocket` objects. */
  
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
        send: function(data:ArrayBuffer, callback:function(info:SendInfo)),
        disconnect: function,
        setPaused: function(paused:boolean, callback:function(error:string|false)),
        setKeepAlive: function(enabled:boolean, delay:number, callback:function(error:string|false)),
        setNoDelay: function(enabled:boolean, callback:function(error:string|false)),
        getInfo: function(callback:function(ClientSocketInfo)),
        socketId: number,
        onReceive: function(data:ArrayBuffer),
        onError: function(error:number),
        onDisconnect: function
      }

      `setKeepAlive` accepts a `delay` in seconds since the socket's last transmission. */
  /** SendInfo: {
        resultCode: number,
        error: string|undefined,
        bytesSent: number|undefined
      } */
  /*  SecureOptions: {
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
        getInfo: function(callback:function(ServerSocketInfo)),
        socketId: number,
        onError: function(error:number),
        onDisconnect: function
      } */
  /** ServerSocketInfo: {
        socketId: number,
        name: string|undefined,
        peerAddress: string,
        peerPort: number
      } */
  return {
    listen: function(options, accept, callback) {
      var socket;
      listen(options, accept, function(error, socketId) {
        socket = {
          disconnect: function() {
            disconnectServer(socketId);
          },
          getInfo: function(callback) {
            getServerInfo(socketId, callback);
          },
          socketId: socketId
        };
        if (callback) callback(error, !error && socket);
      }, function(error) {
        if (socket.onError) socket.onError(error);
      }, function() {
        if (socket.onDisconnect) socket.onDisconnect();
      });
    },
    connect: function(options, callback) {
      var socket;
      connect(options, function(error, socketId) {
        socket = {
          send: function(data, callback) {
            send(socketId, data, callback);
          },
//          secure: function(options, callback) {
//            secure(socketId, options, callback);
//          },
          disconnect: function() {
            disconnect(socketId);
          },
          setKeepAlive: function(enabled, delay, callback) {
            setKeepAlive(socketId, enabled, delay, callback);
          },
          setNoDelay: function(noDelay, callback) {
            setNoDelay(socketId, noDelay, callback);
          },
          getInfo: function(callback) {
            getInfo(socketId, callback);
          },
          socketId: socketId
        };
        var receive = callback(error, !error && socket);
        if (typeof socket.onReceive != 'function')
          socket.onReceive = receive;
        return function(data) {
          if (socket.onReceive) socket.onReceive(data);
        };
      }, function(error) {
        if (socket.onError) socket.onError(error);
      }, function() {
        if (socket.onDisconnect) socket.onDisconnect();
      });
    }
  };
});