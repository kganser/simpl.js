simpl.add('database', function() {

  // Database entries:
  // {
  //   key: (key or index relative to parent)
  //   parent: (URL path of parent entry)
  //   type: (string|number|boolean|null|array|object)
  //   value: (or null if array or object)
  // }

  // TODO: support separate databases, objectStores
  // TODO: deterministic (alphabetical) ordering of keys in objects
  var defaultCallback = function(e) { if (e) console.error(e); };
  var db, open = function(callback) {
    var queue = [callback],
        request = indexedDB.open('simpl');
    request.onupgradeneeded = function() {
      db = request.result;
      db.createObjectStore('data', {keyPath: ['parent', 'key']})
        .createIndex('parent', 'parent');
    };
    request.onsuccess = function(e) {
      db = e.target.result;
      // top level is an object
      var trans = db.transaction('data', 'readwrite');
      putElement(trans.objectStore('data'), makeKey([]), {});
      trans.oncomplete = function() {
        while (callback = queue.shift()) callback();
        open = function(callback) { callback(); };
      };
    };
    open = function(callback) {
      queue.push(callback);
    };
  };
  var makeKey = function(path) {
    var key = path.length ? path[path.length-1] : '';
    return [path.length < 2 && !key ? 0 : path.slice(0, -1).join('/'), typeof key == 'number' ? key : decodeURIComponent(key)];
  };
  var makePath = function(key) {
    return (key[0] ? key[0]+'/' : '')+encodeURIComponent(key[1]);
  };
  var getPath = function(store, path, callback) {
    // substitute array indices in path with element keys
    // if last segment is an array index, its original (numeric) value
    // will be returned as `position`
    var position;
    path = path.split('/');
    (function advance(i) {
      while (i < path.length && !/0|[1-9][0-9]*/.test(path[i])) i++;
      if (i == path.length) return callback(path, position);
      var skip = position = parseInt(path[i]);
      store.get(makeKey(path.slice(0, i))).onsuccess = function(e) {
        var result = e.target.result;
        if (!result) return callback(path, position);
        if (result.type != 'array') return advance(i+1);
        // set to numeric index initially, and to key if element is found
        path[i] = position;
        store.index('parent').openCursor(path.slice(0, i).join('/')).onsuccess = function(e) {
          var cursor = e.target.result;
          if (cursor && skip) {
            cursor.advance(skip);
            skip = 0;
          } else {
            if (cursor) path[i] = cursor.value.key;
            advance(i+1);
          }
        };
      };
    })(1);
  };
  var get = function(store, key, callback) {
    var empty = true;
    store.get(key).onsuccess = function(e) {
      var result = e.target.result;
      if (!result) return empty && callback();
      empty = function next(parent, path, callback) {
        var value = parent.value,
            type = parent.type,
            pending = 1;
        if (type == 'object' || type == 'array') {
          value = type == 'object' ? {} : [];
          store.index('parent').openCursor(path).onsuccess = function(e) {
            var cursor = e.target.result;
            if (!cursor) return --pending || callback(value);
            var result = cursor.value;
            pending++;
            next(result, makePath([result.parent, result.key]), function(child) {
              if (type == 'object') {
                value[result.key] = child;
              } else {
                value.push(child);
              }
              if (!--pending) callback(value);
            });
            cursor.continue();
          };
        } else {
          callback(value);
        }
      }(result, makePath(key), callback);
    };
  };
  var putElement = function(store, key, value) {
    var type = Array.isArray(value) ? 'array' : typeof value == 'object' ? value ? 'object' : 'null' : typeof value,
        record = {parent: key[0], key: key[1], type: type, value: typeof value == 'object' ? null : value};
    store.put(record);
    return record;
  };
  var put = function(store, key, value) {
    var type = putElement(store, key, value).type,
        parent = makePath(key);
    if (type == 'array') {
      value.forEach(function(value, i) {
        put(store, [parent, i], value);
      });
    } else if (type == 'object') {
      Object.keys(value).forEach(function(key) {
        put(store, [parent, key], value[key]);
      });
    }
  };
  var deleteChildren = function(store, path, callback) {
    var pending = 1;
    store.index('parent').openCursor(path).onsuccess = function(e) {
      var cursor = e.target.result;
      if (!cursor) return --pending || callback();
      var result = cursor.value,
          next = function() { if (!--pending) callback(); };
      pending++;
      store.delete([result.parent, result.key]).onsuccess = next;
      if (result.type == 'object' || result.type == 'array') {
        pending++;
        deleteChildren(store, makePath([result.parent, result.key]), next);
      }
      cursor.continue();
    }
  };
  return {
    // TODO: specify length and depth limit
    get: function(path, callback) {
      open(function() {
        var store = db.transaction('data').objectStore('data');
        getPath(store, path, function(path) {
          get(store, makeKey(path), callback);
        });
      });
    },
    put: function(path, value, insert, callback) {
      if (typeof insert == 'function') {
        callback = insert;
        insert = false;
      }
      if (!callback) callback = defaultCallback;
      if (!path) return callback('Cannot replace root object');
      open(function() {
        var trans = db.transaction('data', 'readwrite'),
            store = trans.objectStore('data');
        getPath(store, path, function(path, position) {
          var parentPath = path.slice(0, -1);
          store.get(makeKey(parentPath)).onsuccess = function(e) {
            var parent = e.target.result,
                key = path[path.length-1];
            if (!parent)
              return callback('Parent resource does not exist');
            if (parent.type != 'array' && insert)
              return callback('Parent resource is not an array');
            if (parent.type != 'object' && parent.type != 'array')
              return callback('Parent resource is not an object or array');
            if (parent.type == 'array' && typeof key != 'number')
              return callback('Invalid index to array resource');
            parentPath = parentPath.join('/');
            if (insert) {
              var i = 0, realKey = 0, lastShiftKey = -1,
                  index = store.index('parent');
              index.openCursor(parentPath).onsuccess = function(e) {
                var cursor = e.target.result;
                if (cursor && i < position) {
                  // before desired position, track real key as previous key + 1
                  realKey = cursor.value.key+1;
                  cursor.continue();
                } else if (cursor && cursor.value.key == realKey+i-position) {
                  // all contiguous keys after desired position must be shifted by one
                  lastShiftKey = cursor.value.key;
                  cursor.continue();
                } else if (lastShiftKey >= 0) {
                  // shift subsequent elements' keys
                  index.openCursor(parentPath, 'prev').onsuccess = function(e) {
                    var cursor = e.target.result,
                        element = cursor.value,
                        key = element.key;
                    if (key < realKey) return put(store, [parentPath, realKey], value);
                    if (key > lastShiftKey) return cursor.continue();
                    get(store, [parentPath, key], function(result) {
                      deleteChildren(store, parentPath+'/'+key, function() {
                        put(store, [parentPath, key+1], result);
                        cursor.continue();
                      });
                    });
                  };
                } else {
                  // didn't need to shift anything
                  put(store, [parentPath, realKey], value);
                }
                i++;
              };
            } else {
              deleteChildren(store, path.join('/'), function() {
                put(store, [parentPath, decodeURIComponent(key)], value);
              });
            }
            trans.oncomplete = function() { callback(); };
          };
        });
      });
    },
    append: function(path, value, callback) {
      if (!callback) callback = defaultCallback;
      open(function() {
        var trans = db.transaction('data', 'readwrite'),
            store = trans.objectStore('data');
        getPath(store, path, function(path) {
          store.get(makeKey(path)).onsuccess = function(e) {
            var parent = e.target.result;
            if (!parent)
              return callback('Parent resource does not exist');
            if (parent.type != 'array')
              return callback('Parent resource is not an array');
            store.index('parent').openCursor(path = path.join('/'), 'prev').onsuccess = function(e) {
              var cursor = e.target.result;
              put(store, [path, cursor ? cursor.value.key+1 : 0], value);
            };
            trans.oncomplete = function() { callback(); };
          };
        });
      });
    },
    delete: function(path, callback) {
      if (!callback) callback = defaultCallback;
      if (!path) return callback('Cannot delete root object');
      open(function() {
        var trans = db.transaction('data', 'readwrite'),
            store = trans.objectStore('data');
        getPath(store, path, function(path) {
          store.delete(makeKey(path));
          deleteChildren(store, path.join('/'), function() {});
        });
        trans.oncomplete = function() { callback(); };
      });
    }
  };
});
