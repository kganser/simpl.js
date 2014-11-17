simpl.add('database', function() {

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
    path = (path || '').split('/');
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
            var result = cursor.value,
                index = type == 'object' ? result.key : pending-1;
            value[index] = pending++;
            next(result, makePath([result.parent, result.key]), function(child) {
              value[index] = child;
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
  var put = function(store, key, value, callback) {
    // { key: (key or index relative to parent)
    //   parent: (URL path of parent entry)
    //   type: (string|number|boolean|null|array|object)
    //   value: (or null if array or object) }
    var type = Array.isArray(value) ? 'array' : typeof value == 'object' ? value ? 'object' : 'null' : typeof value,
        parent = makePath(key),
        pending = 1,
        cb = function() { if (!--pending) callback(); };
    store.put({parent: key[0], key: key[1], type: type, value: typeof value == 'object' ? null : value}).onsuccess = cb;
    if (type == 'array') {
      value.forEach(function(value, i) {
        pending++;
        put(store, [parent, i], value, cb);
      });
    } else if (type == 'object') {
      Object.keys(value).forEach(function(key) {
        pending++;
        put(store, [parent, key], value[key], cb);
      });
    }
  };
  var deleteChildren = function(store, path, callback) {
    var pending = 1,
        cb = function() { if (!--pending) callback(); };
    store.index('parent').openCursor(path).onsuccess = function(e) {
      var cursor = e.target.result;
      if (!cursor) return cb();
      var result = cursor.value;
      pending++;
      store.delete([result.parent, result.key]).onsuccess = cb;
      if (result.type == 'object' || result.type == 'array') {
        pending++;
        deleteChildren(store, makePath([result.parent, result.key]), cb);
      }
      cursor.continue();
    }
  };
  
  return {
    open: function(database, upgrade, version) {
    /** database: {
          open: function(database:string, upgrade=`{}`:json|function(UpgradeTransaction), version=1:number) -> Database
        }
        
        An upgrade transaction runs if the database version is less than the requested version or does not exist. If
        `upgrade` is a json value, the data store in the first `ScopedTransaction` operation on this `Database` will be
        populated with this value on an upgrade event. Otherwise, an upgrade will be handled by the given function via
        `UpgradeTransaction`. */
      var self, db, queue, open = function(stores, callback) {
        if (db) return callback();
        if (queue) return queue.push(callback);
        queue = [callback];
        var request = indexedDB.open(database, version || 1);
        request.onupgradeneeded = function(e) {
          var self, db = e.target.result,
              data = upgrade === undefined || typeof upgrade == 'function' ? {} : upgrade;
          if (typeof upgrade != 'function') upgrade = function(db) {
            (Array.isArray(stores) ? stores : [stores]).forEach(function(name) {
              db.createObjectStore(name, data);
            });
          };
          /** UpgradeTransaction: {
                oldVersion: number,
                newVersion: number,
                createObjectStore: function(name:string, data=`{}`:json) -> UpgradeTransaction,
                deleteObjectStore: function(name:string) -> UpgradeTransaction
              } */
          upgrade(self = {
            oldVersion: e.oldVersion,
            newVersion: e.newVersion,
            createObjectStore: function(name, data) {
              if (db.objectStoreNames.contains(name))
                throw 'objectStore already exists';
              var store = db.createObjectStore(name, {keyPath: ['parent', 'key']});
              store.createIndex('parent', 'parent');
              put(store, makeKey([]), data === undefined ? {} : data, function() {});
              return self;
            },
            deleteObjectStore: function(name) {
              if (db.objectStoreNames.contains(name))
                db.deleteObjectStore(name);
              return self;
            }
          });
        };
        request.onsuccess = function(e) {
          db = e.target.result;
          while (callback = queue.shift()) callback();
        };
      };
      var transaction = function(type, stores, callback) {
        var trans, pending = 0, values = [], self = {
          // TODO: cursor interface
          get: function(store, path, callback) {
            get(store, makeKey(path), callback);
          },
          put: function(store, path, callback, value, position, insert) {
            var parentPath = path.slice(0, -1);
            store.get(makeKey(parentPath)).onsuccess = function(e) {
              var parent = e.target.result,
                  root = path.length < 2 && !path[0],
                  key = path[path.length-1];
              if (!parent && !root)
                return callback('Parent resource does not exist');
              if (insert && (root || parent.type != 'array'))
                return callback('Parent resource is not an array');
              if (parent && parent.type != 'object' && parent.type != 'array')
                return callback('Parent resource is not an object or array');
              if (parent && parent.type == 'array' && typeof key != 'number')
                return callback('Invalid index to array resource');
              parentPath = root ? 0 : parentPath.join('/');
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
                    var pending = 1,
                        cb = function() { if (!--pending) callback(); };
                    index.openCursor(parentPath, 'prev').onsuccess = function(e) {
                      var cursor = e.target.result,
                          element = cursor.value,
                          key = element.key;
                      if (key < realKey) return put(store, [parentPath, realKey], value, cb);
                      if (key > lastShiftKey) return cursor.continue();
                      pending++;
                      get(store, [parentPath, key], function(result) {
                        deleteChildren(store, parentPath+'/'+key, function() {
                          put(store, [parentPath, key+1], result, cb);
                          cursor.continue();
                        });
                      });
                    };
                  } else {
                    // didn't need to shift anything
                    put(store, [parentPath, realKey], value, callback);
                  }
                  i++;
                };
              } else {
                deleteChildren(store, path.join('/'), function() {
                  put(store, [parentPath, decodeURIComponent(key)], value, callback);
                });
              }
            };
          },
          append: function(store, path, callback, value) {
            store.get(makeKey(path)).onsuccess = function(e) {
              var parent = e.target.result;
              if (!parent)
                return callback('Parent resource does not exist');
              if (parent.type != 'array')
                return callback('Parent resource is not an array');
              store.index('parent').openCursor(path = path.join('/'), 'prev').onsuccess = function(e) {
                var cursor = e.target.result;
                put(store, [path, cursor ? cursor.value.key+1 : 0], value, callback);
              };
            };
          },
          delete: function(store, path, callback) {
            store.delete(makeKey(path));
            deleteChildren(store, path.join('/'), callback);
          }
        };
        Object.keys(self).forEach(function(name) {
          var method = self[name];
          var wrapped = function(store, path, value, insert) {
            var i = values.push(pending++)-1;
            getPath(store = trans.objectStore(store), path, function(path, position) {
              method(store, path, function(value) {
                values[i] = value;
                if (!--pending) {
                  var v = values;
                  values = [];
                  callback.apply(null, v);
                }
              }, value, position, insert);
            });
          };
          self[name] = function(store, path, value, insert) {
            if (trans) return wrapped(store, path, value, insert);
            open(stores, function() {
              if (!trans) trans = db.transaction(stores, type);
              wrapped(store, path, value, insert);
            });
          };
        });
        return self;
      };
      /** Database: {
            transaction: function(writable=false:boolean, stores='data':[string, ...]|string) -> Transaction|ScopedTransaction,
            get: function(path:string|undefined, writable=true:boolean) -> ScopedTransaction,
            put: function(path:string, value:json, insert=false:boolean) -> ScopedTransaction,
            append: function(path:string, value:json) -> ScopedTransaction,
            delete: function(path:string|undefined) -> ScopedTransaction
          }
          
          Calling `transaction` returns a `Transaction` if `stores` is an array, and a `ScopedTransaction` if it is a
          string. `get`, `put`, `append`, and `delete` are convenience methods that initiate and return a
          `ScopedTransaction`. `get` returns a read-only transaction by default. */
      return self = {
        transaction: function(writable, stores) {
          if (stores == null) stores = 'data';
          var cb, trans = transaction(writable ? 'readwrite' : 'readonly', stores, function() {
            if (cb) cb.apply(self, arguments);
          });
          var self = {
            /** Transaction: {
                  objectStore: function(store:string) -> ScopedTransaction
                }
                
                When a transaction acts on multiple data stores, operations must first be scoped to one of these data
                stores. */
            objectStore: function(store) {
              /** ScopedTransaction: {
                    get: function(path='':string) -> ScopedTransaction,
                    put: function(path:string, value:json, insert=false:boolean) -> ScopedTransaction,
                    append: function(path:string, value:json) -> ScopedTransaction,
                    delete: function(path='':string) -> ScopedTransaction,
                    then: function(callback:function(this:ScopedTransaction, json|undefined, ...))
                  }
                  
                  All methods except `then` are chainable and execute on the same ScopedTransaction in parallel. When
                  all pending operations complete, `callback` is called with the result of each queued operation in
                  order. More operations can be queued on to the same transaction at that time using `this`. Results
                  from `put`, `append`, and `delete` are error strings or undefined if successful. `get` results are
                  json data or undefined if no value exists at the requested path.*/
              return {
                get: function(path) {
                  trans.get(store, path);
                  return self;
                },
                put: function(path, value, insert) {
                  trans.put(store, path, value, insert);
                  return self;
                },
                append: function(path, value) {
                  trans.append(store, path, value);
                  return self;
                },
                delete: function(path) {
                  trans.delete(store, path);
                  return self;
                },
                then: function(callback) {
                  cb = callback;
                }
              };
            }
          };
          return Array.isArray(stores) ? self : self = self.objectStore(stores);
        },
        get: function(path, writable) {
          return self.transaction(writable).get(path);
        },
        put: function(path, value, insert) {
          return self.transaction(true).put(path, value, insert);
        },
        append: function(path, value) {
          return self.transaction(true).append(path, value);
        },
        delete: function(path) {
          return self.transaction(true).delete(path);
        }
      };
    }
  };
});
