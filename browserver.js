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

kernel.add('string', function() {
  return {
    toUTF8Buffer: function(string) {
      var c, len = string.length;
      for (var i = 0, j = 0; i < len; i++) {
        c = string.charCodeAt(i);
        j += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : c < 0x200000 ? 4 : c < 0x4000000 ? 5 : 6;
      }
      var buffer = new Uint8Array(j);
      for (var i = 0, k = 0; i < len; i++) {
        c = string.charCodeAt(i);
        if (c < 128) {
          buffer[k++] = c;
        } else if (c < 0x800) {
          buffer[k++] = 192 + (c >>> 6);
          buffer[k++] = 128 + (c & 63);
        } else if (c < 0x10000) {
          buffer[k++] = 224 + (c >>> 12);
          buffer[k++] = 128 + (c >>> 6 & 63);
          buffer[k++] = 128 + (c & 63);
        } else if (c < 0x200000) {
          buffer[k++] = 240 + (c >>> 18);
          buffer[k++] = 128 + (c >>> 12 & 63);
          buffer[k++] = 128 + (c >>> 6 & 63);
          buffer[k++] = 128 + (c & 63);
        } else if (c < 0x4000000) {
          buffer[k++] = 248 + (c >>> 24);
          buffer[k++] = 128 + (c >>> 18 & 63);
          buffer[k++] = 128 + (c >>> 12 & 63);
          buffer[k++] = 128 + (c >>> 6 & 63);
          buffer[k++] = 128 + (c & 63);
        } else {
          buffer[k++] = 252 + (c >>> 30);
          buffer[k++] = 128 + (c >>> 24 & 63);
          buffer[k++] = 128 + (c >>> 18 & 63);
          buffer[k++] = 128 + (c >>> 12 & 63);
          buffer[k++] = 128 + (c >>> 6 & 63);
          buffer[k++] = 128 + (c & 63);
        }
      }
      return buffer;
    },
    fromUTF8Buffer: function(buffer) {
      buffer = new Uint8Array(buffer);
      var string = '';
      for (var n, len = buffer.length, i = 0; i < len; i++) {
        n = buffer[i];
        string += String.fromCharCode(n > 251 && n < 254 && i + 5 < len
          ? (n - 252) * 1073741824 + (buffer[++i] - 128 << 24) + (buffer[++i] - 128 << 18) + (buffer[++i] - 128 << 12) + (buffer[++i] - 128 << 6) + buffer[++i] - 128
          : n > 247 && n < 252 && i + 4 < len
            ? (n - 248 << 24) + (buffer[++i] - 128 << 18) + (buffer[++i] - 128 << 12) + (buffer[++i] - 128 << 6) + buffer[++i] - 128
            : n > 239 && n < 248 && i + 3 < len
              ? (n - 240 << 18) + (buffer[++i] - 128 << 12) + (buffer[++i] - 128 << 6) + buffer[++i] - 128
              : n > 223 && n < 240 && i + 2 < len
                ? (n - 224 << 12) + (buffer[++i] - 128 << 6) + buffer[++i] - 128
                : n > 191 && n < 224 && i + 1 < len
                  ? (n - 192 << 6) + buffer[++i] - 128
                  : n);
      }
      return string;
    },
    fromAsciiBuffer: function(buffer) {
      return String.fromCharCode.apply(null, new Uint8Array(buffer)); // TODO: limit is 65536 characters; use loop
    }
  };
});

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

kernel.add('http', function() {

  var parseQuery = function(query) {
    var o = {};
    if (query) query.split('&').forEach(function(field) {
      field = field.split('=');
      var key = decodeURIComponent(field[0].replace(/\+/g, '%20')),
          value = decodeURIComponent(field[1].replace(/\+/g, '%20'));
      if (!o.hasOwnProperty(key))
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
      kernel.use({socket: 0, string: 0}, function(o) {
        o.socket.listen(options, function(socket) {
          var request = {headers: {}, query: {}, post: {}, peerAddress: socket.peerAddress},
              headers = '',
              split = -1,
              complete;
          //console.log('new socket', socket.socketId);
          // TODO: support keep-alive, chunked encoding, and (ultimately) pipelined requests
          socket.read(function(buffer) {
            if (complete) return;
            if (split < 0) {
              // headers are ascii
              var offset = headers.length;
              headers += o.string.fromAsciiBuffer(buffer);
              if ((split = headers.indexOf('\r\n\r\n')) > -1) {
                request.body = buffer.slice(split+4-offset);
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
              var tmp = new ArrayBuffer(request.body.byteLength+buffer.byteLength);
              tmp.set(request.body, 0);
              tmp.set(buffer, request.body.byteLength);
              request.body = tmp;
            }
            if (split > -1 && (!request.headers['Content-Length'] || request.body.byteLength >= request.headers['Content-Length'])) {
              complete = true;
              if (request.headers['Content-Type'] == 'application/x-www-form-urlencoded')
                request.post = parseQuery(o.string.fromAsciiBuffer(request.body));
              callback(request, {
                end: function(body, headers, status) {
                  headers = headers || {};
                  if (!(body instanceof ArrayBuffer))
                    body = o.string.toUTF8Buffer(String(body)).buffer;
                  headers['Content-Length'] = body.byteLength;
                  if (!headers['Content-Type']) headers['Content-Type'] = 'text/plain';
                  if (!headers.Connection) headers.Connection = 'close';
                  socket.write(o.string.toUTF8Buffer(['HTTP/1.1 '+(status || '200 OK')].concat(Object.keys(headers).map(function(header) { return header+': '+headers[header]; })).join('\r\n')+'\r\n\r\n').buffer);
                  socket.write(body, socket.disconnect);
                }
              });
            }
          });
        });
      });
    },
    getMimeType: function(ext) {
      // partial list from nginx mime_types file
      return {
        html: 'text/html',
        css:  'text/css',
        xml:  'text/xml',
        rss:  'text/xml',
        gif:  'text/gif',
        jpg:  'image/jpeg',
        jpeg: 'image/jpeg',
        js:   'application/x-javascript',
        json: 'application/json',
        txt:  'text/plain',
        png:  'image/png',
        ico:  'image/x-icon',
        pdf:  'application/pdf',
        zip:  'application/zip',
        exe:  'application/octet-stream',
        mp3:  'audio/mpeg',
        mpg:  'video/mpeg',
        mpeg: 'video/mpeg',
        mov:  'video/quicktime',
        flv:  'video/x-flv',
        avi:  'video/x-msvideo',
        wmv:  'video/x-ms-wmv'
      }[ext];
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

kernel.add('database', function() {

  // Database entries:
  // {
  //   type: (string|number|boolean|null|array|object)
  //   parent: (path of parent entry; indexed)
  //   path: (URL path of this entry; primary key)
  //   value: (or null if array or object)
  // }

  var self, db, open = function(callback) {
    var request = indexedDB.open('browserver');
    request.onupgradeneeded = function() {
      db = request.result;
      db.createObjectStore('data', {keyPath: 'path'})
        .createIndex('parent', 'parent');
    };
    request.onsuccess = function(e) {
      callback(db = e.target.result);
      // TODO: remove
      self.put('', {
        string: 'hello world',
        number: 123,
        null: null,
        object: {key: 'value'},
        array: ['element']
      }, function() {});
    };
    request.onerror = function(e) {
      console.log('db error', e);
    };
    open = function(callback) { callback(); };
  };
  return self = {
    // TODO: specify length and depth limit
    get: function(path, callback) {
      open(function() {
        var store = db.transaction('data').objectStore('data');
        store.get(path).onsuccess = function(e) {
          var result = e.target.result;
          if (!result) return callback(result);
          var value = result.value,
              pending = 0;
          if (result.type == 'object' || result.type == 'array') {
            value = result.type == 'object' ? {} : [];
            (function next(value, path) {
              pending++;
              store.index('parent').openCursor(path).onsuccess = function(e) {
                var cursor = e.target.result;
                if (cursor) {
                  var result = cursor.value,
                      key = decodeURIComponent(result.path.split('/').slice(-1));
                  if (Array.isArray(value)) key = parseInt(key, 10);
                  value[key] = result.value;
                  if (result.type == 'object' || result.type == 'array') {
                    value[key] = result.type == 'object' ? {} : [];
                    next(value[key], result.path);
                  }
                  cursor.continue();
                } else if (!--pending) {
                  callback(value);
                }
              };
            })(value, path);
          } else {
            callback(value);
          }
        };
      });
    },
    put: function(path, value, callback) {
      open(function() {
        var trans = db.transaction('data', 'readwrite');
        (function next(path, value) {
          var type = Array.isArray(value) ? 'array' : typeof value == 'object' ? value ? 'object' : 'null' : typeof value,
              parent = path ? path.split('/').slice(0, -1).join('/') : null;
          trans.objectStore('data').put({path: path, parent: parent, type: type, value: typeof value == 'object' ? null : value});
          if (type == 'array') {
            value.forEach(function(value, i) {
              next(path ? path+'/'+i : i, value);
            });
          } else if (type == 'object') {
            Object.keys(value).forEach(function(key) {
              next(path ? path+'/'+encodeURIComponent(key) : key, value[key]);
            });
          }
        })(path, value);
        trans.oncomplete = callback;
      });
    },
    delete: function(path, callback) {
      open(function() {
        var trans = db.transaction('data', 'readwrite'),
            store = trans.objectStore('data');
        (function next(path) {
          store.delete(path);
          store.index('parent').openCursor(path).onsuccess = function(e) {
            var cursor = e.target.result;
            if (cursor) {
              var result = cursor.value;
              if (result.type == 'object' || result.type == 'array')
                next(result.path);
              cursor.continue();
            }
          }
        })(path);
        trans.oncomplete = callback;
      });
    }
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
  kernel.use({http: 0, html: 0, database: 0, string: 0}, function(o) {
    o.http.serve({port: 8088}, function(request, response) {
      if (request.headers.View == 'data' || request.query.view == 'data') {
        var path = request.path.substr(1);
        switch (request.method.toLowerCase()) {
          case 'get':
            return o.database.get(path, function(object) {
              if (object === undefined) response.end('404 Resource Not Found', null, 404);
              response.end(JSON.stringify(object), {'Content-Type': 'application/json'});
            });
          case 'put':
            // TODO: check if parent record exists first?
            var data = o.string.fromUTF8Buffer(request.body);
            try { data = JSON.parse(data); } catch (e) {}
            return o.database.put(path, data, function() {
              response.end('200 Success');
            });
          case 'delete':
            return o.database.delete(path, function() {
              response.end('200 Success');
            });
          default:
            return response.end('501 Not Implemented', null, 501);
        }
      }
      if (request.path.length > 1) { // proxy request
        var xhr = new XMLHttpRequest();
        xhr.responseType = 'arraybuffer';
        xhr.onload = function() {
          response.end(xhr.response, {'Content-Type': o.http.getMimeType((request.path.match(/\.([^.]*)$/) || [])[1])});
        };
        xhr.onerror = function() {
          response.end('404 Resource Not Found', null, 404);
        };
        xhr.open('GET', request.path);
        return xhr.send();
      }
      o.database.get('', function(data) {
        response.end(o.html([
          {'!doctype': {html: null}},
          {head: [
            {title: 'Browserver'},
            {meta: {charset: 'utf-8'}},
            {link: {rel: 'stylesheet', href: '/browserver.css'}},
            {link: {rel: 'shortcut icon', href: '/icon.png'}}
          ]},
          {body: [
            {pre: {id: 'value', 'class': 'json', children: JSON.stringify(data, null, 2)}},
            {script: {src: 'http://rawgit.com/kganser/jsml/master/src/jsml.js'}},
            {script: function(d) {
              if (!d) return JSON.stringify(data);
              var json = function(data) {
                var type = Array.isArray(data) ? 'array' : typeof data == 'object' ? data ? 'object' : 'null' : typeof data;
                return {span: {className: 'json-'+type, children: type == 'array'
                  ? {ol: data.map(function(e) { return {li: [{span: {className: 'json-delete', children: '×'}}, json(e)]}; })}
                  : type == 'object'
                    ? {ul: Object.keys(data).map(function(key) { return {li: [{span: {className: 'json-delete', children: '×'}}, {span: {className: 'json-key', children: key}}, ': ', json(data[key])]}; })}
                    : String(data)}};
              };
              var xhr = function(o, callback) {
                var request = new XMLHttpRequest();
                request.onload = callback && function() { callback(request); };
                request.open(o.method || 'GET', o.path);
                request.setRequestHeader('View', 'data');
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
                    this.path = this.origType = this.origValue = null;
                  } else { // remove if adding
                    elem.parentNode.parentNode.removeChild(elem.parentNode);
                  }
                },
                submit: function(elem) {
                  if (!this.path) return;
                  if (this.origType && elem.textContent == this.origValue) { // value unchanged
                    elem.contentEditable = false;
                    this.path = this.origType = this.origValue = null;
                  } else {
                    var method = 'SPLICE';
                    if (this.object(elem)) {
                      this.path.splice(-1, 1, elem.parentNode.children[1].textContent);
                      method = 'PUT';
                    }
                    var value = elem.textContent;
                    try { value = JSON.parse(value); } catch (e) {}
                    console.log(method+' /'+this.path.map(encodeURIComponent).join('/')+'\n'+JSON.stringify(value));
                    xhr({method: method, path: '/'+this.path.map(encodeURIComponent).join('/'), body: JSON.stringify(value)});
                    this.path = this.origType = this.origValue = null; // reset must be done before DOM changes (?) to prevent double-submit on keydown and blur
                    elem.parentNode.children[1].contentEditable = false;
                    elem.parentNode.replaceChild(jsml(json(value)), elem);
                  }
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
                      } else if (c == 'json-delete' || c == 'json-string' || c == 'json-number' || c == 'json-boolean' || c == 'json-null' || t.tagName == 'LI') {
                        var item;
                        if (t.tagName == 'LI') {
                          if (t.parentNode.tagName == 'OL') {
                            item = t.parentNode.insertBefore(jsml({li: [
                              {span: {className: 'json-delete', children: '×'}},
                              {span: {className: 'json-null'}}
                            ]}), t.nextSibling);
                          } else {
                            item = jsml({li: [
                              {span: {className: 'json-delete', children: '×'}},
                              {span: {className: 'json-key'}}, ': ',
                              {span: {className: 'json-null'}}
                            ]}, t.parentNode);
                          }
                          t = item.children[1];
                        } else {
                          item = t.parentNode;
                          this.origType = c;
                          this.origValue = t.textContent;
                        }
                        if (c != 'json-delete') {
                          t.contentEditable = true;
                          t.focus();
                          document.execCommand('selectAll', false, null);
                        }
                        this.path = [];
                        while (item != e.currentTarget) {
                          this.path.unshift(item.children[1].className == 'json-key'
                            ? item.children[1].textContent
                            : Array.prototype.indexOf.call(item.parentNode.children, item));
                          item = item.parentNode.parentNode.parentNode; // li/root > span > ul/ol > li
                        }
                        if (c == 'json-delete') {
                          console.log('DELETE /'+this.path.map(encodeURIComponent).join('/'));
                          xhr({method: 'DELETE', path: '/'+this.path.map(encodeURIComponent).join('/')});
                          t.parentNode.parentNode.removeChild(t.parentNode);
                          this.path = this.origType = this.origValue = null;
                        }
                      }
                      break;
                    case 'keydown':
                      var esc = e.keyCode == 27,
                          tab = e.keyCode == 9,
                          enter = e.keyCode == 13,
                          colon = e.keyCode == 186,
                          key = c == 'json-key';
                      if (esc || !t.textContent && (tab || enter || key && colon)) { // cancel
                        e.preventDefault();
                        this.cancel(t);
                      } else if (!key && (tab || enter) && !e.shiftKey) { // submit
                        e.preventDefault();
                        this.submit(t);
                      } else if (key && t.textContent && (tab || enter || colon)) { // move to value
                        e.preventDefault();
                        t.contentEditable = false;
                        t.parentNode.lastChild.contentEditable = true;
                        t.parentNode.lastChild.focus();
                      } else if (this.object(t) && !key && (tab || enter) && e.shiftKey) { // move to key
                        e.preventDefault();
                        if (this.origType) {
                          t.blur();
                        } else {
                          t.contentEditable = false;
                          t.parentNode.children[1].contentEditable = true;
                          t.parentNode.children[1].focus();
                        }
                      }
                      break;
                    case 'blur':
                      var p = t.parentNode;
                      t = p.lastChild;
                      if ((c == 'json-string' || c == 'json-number' || c == 'json-boolean' || c == 'json-null' || c == 'json-key')
                        && (!e.relatedTarget || e.relatedTarget.parentNode != p)) {
                        if (p.children[1].textContent && t.textContent) {
                          this.submit(t);
                        } else {
                          this.cancel(t);
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
});
