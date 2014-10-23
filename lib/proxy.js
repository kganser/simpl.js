kernel.add('proxy', function() {
  var clients = {}, host;
  return function(listeners, path, worker) {
    var id = 0, log = {}, peer,
        origin = worker || typeof WorkerGlobalScope != 'undefined' ? undefined : '*';
    
    if (path) {
      if (path in clients) throw 'proxy already exists for path '+path;
      clients[path] = true;
      
      if (worker) {
        peer = new Worker(path);
      } else {
        var iframe = document.createElement('iframe');
        iframe.src = path;
        iframe.onload = function() {
          peer = iframe.contentWindow;
          Object.keys(log).forEach(function(id) {
            peer.postMessage({id: id, command: log[id].command, args: log[id].args}, origin);
          });
        };
        document.body.appendChild(iframe);
      }
    } else {
      peer = origin ? parent : self;
    }
    
    // TODO: support transferable objects
    var channel = {
      peer: peer,
      send: function(command, args, callback, persist) {
        // TODO: use a guid?
        var start = id;
        do { id = id == Number.MAX_SAFE_INTEGER ? 0 : id + 1 } while (log[id] && id != start);
        if (id == start) throw 'message queue full';
        log[id] = {command: command, args: args, callback: callback, persist: persist};
        if (peer) peer.postMessage({id: id, command: command, args: args}, origin);
      }
    };
    
    if (path || !host) {
      listeners = listeners || {};
      (origin ? window : peer).onmessage = function(e) {
        if ('result' in e.data) {
          var message = log[e.data.id];
          if (message.callback)
            message.callback.apply(null, e.data.result);
          if (!message.persist)
            delete log[e.data.id];
          // TODO: clean up persistent callbacks
        } else if (listeners[e.data.command]) {
          listeners[e.data.command](e.data.args, function() {
            peer.postMessage({id: e.data.id, result: Array.prototype.slice.call(arguments)}, origin);
          });
        }
      };
    }
    
    return path ? channel : host ? host : host = channel;
  };
});
