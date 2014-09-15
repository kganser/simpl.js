var kernel; if (!kernel) kernel = (function(modules, clients) {
  
  var dispatch = function(client) {
    for (var i = client ? clients.push(client)-1 : 0; i < clients.length; i++) {
      var dependencies = [], count = 0;
      for (var module in clients[i].dependencies) {
        if (clients[i].dependencies.hasOwnProperty(module) && ++count) {
          if (!modules[module]) { dependencies = false; break; }
          var versions = clients[i].dependencies[module];
          for (var j = 0; j < versions.length && dependencies.length != count; j++) {
            var major = versions[j][0], minors = versions[j][1];
            if (!modules[module][major]) continue;
            major = modules[module][major];
            for (var k = 0; k < minors.length && dependencies.length != count; k++) {
              if (k && typeof minors[k] == 'number') {
                if (major[minors[k]]) dependencies.push({name: module, module: major[minors[k]]});
              } else {
                for (var minor = major.length-1; minor >= 0; minor--) {
                  if (major.hasOwnProperty(minor)) {
                    if (typeof minors[k] == 'number' ? minor >= minors[k] : minor <= minors[k][1] && minor >= minors[k][0]) {
                      dependencies.push({name: module, module: major[minor]});
                      break;
                    }
                  }
                }
              }
            }
          }
          if (dependencies.length != count) { dependencies = false; break; }
        }
      }
      if (dependencies) {
        var dependency, m = {};
        while (dependency = dependencies.shift()) {
          if (!dependency.module.hasOwnProperty('instance')) dependency.module.instance = dependency.module.init();
          m[dependency.name] = dependency.module.instance;
        }
        clients.splice(i--, 1)[0].callback(m);
      }
    }
  };
  
  return {
    add: function(name, module, major, minor) {
      if (typeof major != 'number') major = 0;
      if (typeof minor != 'number') minor = 0;
      if (typeof module != 'function') throw new Error('Invalid module');
      if (!modules.hasOwnProperty(name)) {
        if (name in modules) throw new Error('Invalid module name');
        modules[name] = [];
      }
      if (!modules[name][major]) modules[name][major] = [];
      if (!modules[name][major][minor]) {
        modules[name][major][minor] = {init: module};
        dispatch();
      }
      return this;
    },
    use: function(modules, callback) {
      var client = {dependencies: {}, callback: callback};
      for (var module in modules) {
        if (modules.hasOwnProperty(module)) {
          var versions = modules[module], dependency = client.dependencies[module] = [];
          if (versions instanceof Array) {
            for (var i = 0; i < versions.length; i++) {
              if (typeof versions[i] == 'number') {
                dependency[i] = [versions[i], [0]];
              } else if (versions[i] instanceof Array) {
                var major = versions[i][0];
                var minor = versions[i][1];
                dependency[i] = [typeof major == 'number' ? major : 0, []];
                if (minor instanceof Array) {
                  for (var j = minor.length-1; j >= 0; j--) {
                    if (typeof minor[j] == 'number') {
                      dependency[i][1].push(minor[j]);
                    } else if (minor[j] instanceof Array && minor[j].length) {
                      dependency[i][1].push(minor[j].length == 1 ? minor[j][0] : [minor[j][0], minor[j][1]]);
                    }
                  }
                }
                if (!dependency[i][1].length) {
                  dependency[i][1].push(typeof minor == 'number' ? minor : 0);
                } else {
                  dependency[i][1].sort(function(a, b) {
                    return (typeof b == 'number' ? b : b[1]) - (typeof a == 'number' ? a : a[1]);
                  });
                }
              }
            }
          }
          if (!dependency.length) {
            dependency.push([typeof versions == 'number' ? versions : 0, [0]]);
          } else {
            dependency.sort(function(a, b) { return b[0] - a[0]; });
          }
        }
      }
      dispatch(client);
      return this;
    }
  };
})({}, []);

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
                        // TODO: handle multibyte characters
                        callback(String.fromCharCode.apply(null, new Uint8Array(readInfo.data)));
                        socket.read(connectionSocket.socketId, null, read);
                      }.bind(this));
                    },
                    write: function(str, callback) {
                      if (disconnected) return console.error('Already disconnected');
                      // TODO: handle multibyte
                      var buffer = new ArrayBuffer(str.length*2),
                          view = new Uint8Array(buffer);
                      for (var i = 0, len = str.length; i < len; i++)
                        view[i] = str.charCodeAt(i);
                      socket.write(connectionSocket.socketId, buffer, callback || function() {});
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

kernel.add('http', function() {

  var parseQuery = function(query) {
    var o = {};
    if (query) query.split('&').forEach(function(field) {
      field = field.split('=');
      var key = decodeURIComponent(field[0].replace(/\+/g, '%20')),
          value = decodeURIComponent(field[1].replace(/\+/g, '%20'));
      if (!o[key])
        o[key] = value;
      else if (Array.isArray(o[key]))
        o[key].push(value);
      else
        o[key] = [o[key], value];
    });
    return o;
  };
  
  return {
    serve: function(options, callback) {
      kernel.use({socket: 0}, function(o) {
        o.socket.listen(options, function(socket) {
          var request = {body: '', headers: {}, query: {}, post: {}, peerAddress: socket.peerAddress},
              headers = '',
              split = -1,
              complete;
          //console.log('new socket', socket.socketId);
          // TODO: support keep-alive, chunked encoding, and ultimately) pipelined requests
          socket.read(function(str) {
            if (complete) return;
            if (split < 0) {
              headers += str;
              if ((split = headers.indexOf('\r\n\r\n')) > -1) {
                request.body = headers.substr(split+4);
                headers = headers.substr(0, split).split('\r\n');
                var line = headers.shift().split(' '),
                    uri = line[1] ? line[1].split('?', 2) : [];
                request.method = line[0];
                request.uri = line[1];
                request.path = uri[0];
                request.query = parseQuery(uri[1]);
                headers.forEach(function(line) {
                  line = line.split(': ', 2);
                  request.headers[line[0]] = line[1];
                });
                //console.log(request.method, request.uri);
              }
            } else {
              request.body += str;
            }
            if (split > -1 && (!request.headers['Content-Length'] || request.body.length + (encodeURIComponent(request.body).match(/%[89AB]/g) || []).length >= request.headers['Content-Length'])) {
              complete = true;
              if (request.headers['Content-Type'] == 'application/x-www-form-urlencoded')
                request.post = parseQuery(request.body);
              callback(request, {
                end: function(body, headers, status) {
                  headers = headers || {};
                  headers['Content-Length'] = body.length + (encodeURIComponent(body).match(/%[89AB]/g) || []).length;
                  if (!headers['Content-Type']) headers['Content-Type'] = 'text/plain';
                  if (!headers.Connection) headers.Connection = 'close';
                  socket.write(['HTTP/1.1 '+(status || '200 OK')].concat(Object.keys(headers).map(function(header) { return header+': '+headers[header]; })).join('\r\n')+'\r\n\r\n'+body, socket.disconnect);
                }
              });
            }
          });
        });
      });
    }
  };
});

kernel.add('html', function() {
  // server-side implementation
  return function html(node) {
    switch (typeof node) {
      case 'object':
        if (!node) break;
        if (Array.isArray(node))
          return node.map(html).join('');
        var tag = Object.keys(node)[0],
            value = node[tag],
            object = value && typeof value == 'object' && !Array.isArray(value);
        return '<'+tag+(object ? Object.keys(value) : []).map(function(attr) {
            return attr == 'children' ? '' : ' '+attr+(value[attr] == null ? '' : '="'+value[attr]+'"');
          }).join('')+'>'+html(object ? value.children : value)+({
            '!doctype':1, area:1, base:1, br:1, col:1, command:1, embed:1, hr:1, img:1,
            input:1, keygen:1, link:1, meta:1, param:1, source:1, track:1, wbr:1
          }[tag] ? '' : '</'+tag+'>');
      case 'function':
        return '('+node+')('+(node.length ? node.length == 1 ? node() : node().join(',') : '')+');';
      case 'string':
        return node.replace(/&/g, '&amp;').replace(/</g, '&lt;');
      case 'number':
        return node;
    }
    return '';
  };
});

kernel.add('eval', function() {
  var id = 0,
      log = {},
      loaded,
      dispatch = function(code, id) { iframe.contentWindow.postMessage({code: code, id: id++}, '*'); },
      iframe = document.createElement('iframe');
  iframe.src = 'eval.html';
  iframe.onload = function() {
    loaded = true;
    Object.keys(log).forEach(function(k) { dispatch(log[k].code, k); });
  };
  document.body.appendChild(iframe);
  window.addEventListener('message', function(e) {
    if (!log.hasOwnProperty(e.data.id)) return;
    log[e.data.id].callback(e.data.result, e.data.error);
    delete log[e.data.id];
  });
  return function(code, callback) {
    do { id = (id + 1) % Number.MAX_VALUE; } while (log[id]);
    log[id] = {code: code, callback: callback};
    if (loaded) dispatch(code, id);
  };
});

// PUT assigns a value (from request body) to the global object at the given path
// - errors if parent object does not exist
// POST pushes a value (from request body) onto array at given path
// - creates array first if path is undefined in parent object
// - errors if already defined as something other than an array, or parent object undefined
// DELETE deletes key represented by path in parent object, if it exists
// - error if it does not exist

chrome.app.runtime.onLaunched.addListener(function() {
  kernel.use({http: 0, html: 0}, function(o) {
  
    var data = {
      string: "hello world",
      number: 123,
      null: null,
      object: {
        "key": "value"
      },
      array: [
        "element"
      ]
    };
    
    o.http.serve({port: 4088}, function(request, response) {
      var key, parent, object = data,
          path = request.path.split('/');
      
      for (var i = 1; i < path.length; i++) {
        key = path[i];
        if (!key) continue;
        if (!object.hasOwnProperty(key))
          return response.end('404 Resource not found', null, 404);
        parent = object;
        object = object[key];
      }
      
      try {
        switch (request.method.toLowerCase()) {
          case 'get':
            return response.end(JSON.stringify(object), {'Content-Type': 'application/json'});
          case 'put':
            if (!parent) return response.end('404 Resource not found', null, 404);
            parent[key] = JSON.parse(request.body);
            break;
          case 'post':
            if (!parent) return response.end('404 Resource not found', null, 404);
            if (typeof object != 'undefined' && !Array.isArray(object))
              return response.end('415 Resource is not an array', null, 415);
            var value = JSON.parse(request.body);
            if (!object) {
              parent[key] = [value];
            } else {
              object.push(value);
            }
            break;
          case 'delete':
            delete parent[key];
            break;
        }
      } catch (e) {
        return response.end('415 Invalid JSON', null, 415);
      }
      return response.end('200 Success');
    });
    
    o.http.serve({port: 8088}, function(request, response) {
      response.end(o.html([
        {'!doctype': {html: null}},
        {head: [
          {title: 'Browserver'},
          {style: '\n'+[
            {'.json-object ul, .json-array ol': [
              'display: inline',
              'list-style: none',
              'padding: 0'
            ]},
            {'.json li': [
              'margin-left: 1.2em'
            ]},
            {'.json li:after': [
              'content: ","'
            ]},
            {'.json li:last-child:after': [
              'display: none'
            ]},
            {'.json-object:before, .json-array:before': [
              'content: ""',
              'display: inline-block',
              'border-style: solid',
              'border-width: .6em .4em 0 .4em',
              'border-color: #666 transparent transparent transparent',
              'margin-right: .4em',
              'cursor: pointer'
            ]},
            {'.json-object.closed:before, .json-array.closed:before': [
              'border-width: .4em 0 .4em .6em',
              'border-color: transparent transparent transparent #666',
              'margin-right: .6em'
            ]},
            {'.json-object.closed li, .json-array.closed li': [
              'display: none'
            ]},
            {'.json-object ul:before': [
              'content: "{"'
            ]},
            {'.json-object ul:after': [
              'content: "}"'
            ]},
            {'.json-object.closed ul:before': [
              'content: "{\\2026"'
            ]},
            {'.json-array ol:before': [
              'content: "["'
            ]},
            {'.json-array ol:after': [
              'content: "]"'
            ]},
            {'.json-array.closed ol:before': [
              'content: "[\\2026"'
            ]},
            {'.json-string:before, .json-string:after': [
              'content: "\\""'
            ]},
            {'.json-key': [
              'color: #881391'
            ]},
            {'.json-string': [
              'color: #C5201C'
            ]},
            {'.json-number, .json-boolean': [
              'color: #1C00CF'
            ]},
            {'.json-undefined, .json-null': [
              'color: #666'
            ]},
            {'.json span[contenteditable=true]': [
              'color: black',
              'border: solid 1px #999',
              'padding: 0 2px',
              'box-shadow: 3px 3px 3px #999',
              'outline: none'
            ]},
            {'.json-string[contenteditable=true]:before, .json-string[contenteditable=true]:after, .json-key[contenteditable=true]:after': [
              'content: none'
            ]}
          ].map(function(style) {
            var selector = Object.keys(style)[0];
            return selector+' {\n'+style[selector].map(function(style) {
              return '  '+style+';\n';
            }).join('')+'}\n';
          }).join('')}
        ]},
        {body: [
          {pre: {id: 'value', 'class': 'json', children: JSON.stringify(data, null, 2)}},
          {script: {src: 'http://git.kganser.com/jsml/src/jsml.js'}},
          {script: function(d) {
            if (!d) return JSON.stringify(data);
            var json = function(data) {
              var type = Array.isArray(data) ? 'array' : typeof data == 'object' ? data ? 'object' : 'null' : typeof data;
              return {span: {className: 'json-'+type, children: type == 'array'
                ? {ol: data.map(function(e) { return {li: [json(e)]}; })}
                : type == 'object'
                  ? {ul: Object.keys(data).map(function(key) { return {li: [{span: {className: 'json-key', children: key}}, ': ', json(data[key])]}; })}
                  : String(data)}};
            };
            var xhr = function(o, callback) {
              var request = new XMLHttpRequest();
              request.onload = callback && function() { callback(request); };
              request.open(o.method || 'GET', o.path);
              request.send(o.body);
            };
            var value = document.getElementById('value');
            
            value.textContent = '';
            jsml(json(d), value);
            
            var handler = {
              object: function(elem) {
                return elem.parentNode.parentNode.parentNode.className == 'json-object';
              },
              cancel: function(elem) {
                if (!this.path) return;
                this.path = null;
                if (this.origType) { // revert if editing
                  elem.contentEditable = false;
                  elem.className = this.origType;
                  elem.textContent = this.origValue;
                  this.origType = this.origValue = null;
                } else { // remove if adding
                  elem.parentNode.parentNode.removeChild(elem.parentNode);
                }
              },
              submit: function(elem) {
                if (!this.path) return;
                var method = 'SPLICE';
                if (this.object(elem)) {
                  this.path.pop();
                  this.path.push(elem.parentNode.firstChild.textContent);
                  method = 'PUT';
                }
                var value = elem.textContent;
                try { value = JSON.parse(value); } catch (e) {}
                console.log(method+' /'+this.path.map(encodeURIComponent).join('/')+'\n'+JSON.stringify(value));
                this.path = null; // prevent double-submit on keydown and blur
                elem.parentNode.firstChild.contentEditable = false;
                elem.parentNode.replaceChild(jsml(json(value)), elem);
              },
              handleEvent: function(e) {
                var t = e.target,
                    c = t.className;
                switch (e.type) {
                  case 'click':
                    if (c == 'json-object' || c == 'json-array') {
                      t.className += ' closed';
                    } else if (c == 'json-object closed' || c == 'json-array closed') {
                      t.className = c.split(' ')[0];
                    } else if (c == 'json-string' || c == 'json-number' || c == 'json-null' || c == 'json-undefined' || t.tagName == 'LI') {
                      var item;
                      if (t.tagName == 'LI') {
                        if (t.parentNode.tagName == 'OL') {
                          item = t.parentNode.insertBefore(jsml({li: [
                            {span: {className: 'json-undefined'}}
                          ]}), t.nextSibling);
                        } else {
                          item = jsml({li: [
                            {span: {className: 'json-key'}}, ': ',
                            {span: {className: 'json-undefined'}}
                          ]}, t.parentNode);
                        }
                        t = item.firstChild;
                      } else {
                        item = t.parentNode;
                        this.origType = c;
                        this.origValue = t.textContent;
                      }
                      t.contentEditable = true;
                      t.focus();
                      document.execCommand('selectAll', false, null);
                      this.path = [];
                      while (item != e.currentTarget) {
                        this.path.unshift(item.firstChild.className == 'json-key'
                          ? item.firstChild.textContent
                          : Array.prototype.indexOf.call(item.parentNode.children, item));
                        item = item.parentNode.parentNode.parentNode; // li/root > span > ul/ol > li
                      }
                    }
                    break;
                  case 'keydown':
                    var esc = e.keyCode == 27,
                        tab = e.keyCode == 9,
                        enter = e.keyCode == 13,
                        colon = e.keyCode == 186,
                        key = t.className == 'json-key';
                    if (esc || !t.textContent && (tab || enter || key && colon)) { // cancel
                      e.preventDefault();
                      this.cancel(t);
                    } else if (!key && (tab || enter) && !e.shiftKey) { // submit
                      e.preventDefault();
                      this.submit(t, key);
                    } else if (key && t.textContent && (tab || enter || colon)) { // move to value
                      e.preventDefault();
                      t.contentEditable = false;
                      t.parentNode.lastChild.contentEditable = true;
                      t.parentNode.lastChild.focus();
                    } else if (this.object(t) && !key && (tab || enter) && e.shiftKey) { // move to key
                      e.preventDefault();
                      t.contentEditable = false;
                      t.parentNode.firstChild.contentEditable = true;
                      t.parentNode.firstChild.focus();
                    }
                    break;
                  case 'blur':
                    var p = t.parentNode;
                    t = p.lastChild;
                    if ((c == 'json-string' || c == 'json-number' || c == 'json-null' || c == 'json-undefined' || c == 'json-key')
                      && (!e.relatedTarget || e.relatedTarget.parentNode != p)) {
                      if (p.firstChild.textContent && t.textContent) {
                        this.submit(t);
                      } else {
                        this.cancel(t, p.firstChild);
                      }
                    }
                    break;
                }
              }
            };
            
            value.addEventListener('click', handler);
            value.addEventListener('keydown', handler);
            value.addEventListener('blur', handler, true);
          }}
        ]}
      ]), {'Content-Type': 'text/html'});
    });
  });
});
