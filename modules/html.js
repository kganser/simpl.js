simpl.add('html', function() {
  var self, selfClosing = {
    '!doctype': 1,
    area: 1,
    base: 1,
    br: 1,
    col: 1,
    command: 1,
    embed: 1,
    hr: 1,
    img: 1,
    input: 1,
    keygen: 1,
    link: 1,
    meta: 1,
    param: 1,
    source: 1,
    track: 1,
    wbr:1
  };
  var attr = function(node, parent) {
    Object.keys(node).forEach(function(k) {
      if (k == 'children') return;
      var n = node[k];
      if (typeof parent[k] == 'undefined' || typeof n != 'object' || n == null)
        return parent[k] = n;
      attr(n, parent[k], true);
    });
    return node.children;
  };
  /** html: {
        markup: function(node:any) -> string,
        dom: function(node:any, parent=null:DOMElement, clear=false:boolean) -> DOMNode|undefined,
        model: function(data:object|array, insert:function(value:any, key:number|string, index:number, model:Model) -> any) -> Model
      }
      
      Utilities for generating HTML using native javascript data structures: `markup` produces an HTML string, `dom`
      builds a DOM structure using the client browser API, and `model` synchronizes the client's DOM view to an
      underlying data structure. */
  return self = {
    markup: function(node) {
      switch (typeof node) {
        case 'object':
          if (!node) break;
          if (Array.isArray(node))
            return node.map(self.markup).join('');
          var tag = Object.keys(node)[0],
              value = node[tag],
              object = value && typeof value == 'object' && !Array.isArray(value);
          return '<'+tag+(object ? Object.keys(value) : []).map(function(attr) {
            return attr == 'children' ? '' : ' '+attr+(value[attr] == null ? '' : '="'+value[attr].replace(/&/g, '&amp;').replace(/"/g, '&quot;')+'"');
          }).join('')+'>'+self.markup(object ? value.children : value)+(selfClosing[tag] ? '' : '</'+tag+'>');
        case 'function':
          return '('+node+')('+(node.length
            ? node.length == 1
              ? JSON.stringify(node())
              : node().map(function(node) { return JSON.stringify(node); }).join(',')
            : '')+');';
        case 'string':
          return node.replace(/&/g, '&amp;').replace(/</g, '&lt;');
        case 'number':
          return node;
      }
      return '';
    },
    dom: function(node, parent, clear) {
      if (clear) while (parent.firstChild) parent.removeChild(parent.firstChild);
      switch (typeof node) {
        case 'object':
          if (!node) return;
          if (Array.isArray(node)) {
            node.forEach(function(node) { self.dom(node, parent); });
            return parent;
          }
          var tag = Object.keys(node)[0],
              elem = document.createElement(tag);
          if (parent) parent.appendChild(elem); 
          node = node[tag];
          self.dom(typeof node == 'object' && node && !Array.isArray(node) ? attr(node, elem) : node, elem);
          return elem;
        case 'function':
          return self.dom(node(parent), parent);
        case 'string':
        case 'number':
          node = document.createTextNode(node);
          return parent ? parent.appendChild(node) : node;
      }
    },
    /** Model: {
          get: function(key=null:number|string) -> any,
          remove: function(key:number|string) -> Model,
          insert: function(value:any, key=null:number|string) -> Model,
          insertAll: function(values:object|array) -> Model,
          sort: function(compare:function(a:any, b:any)) -> Model,
          view: function(parent:DOMElement)
        } */
    model: function(data, insert) {
      if (typeof data != 'object' || !data) throw 'data must be object or array';
      var model, elem,
          keys = !Array.isArray(data) && Object.keys(data);
      return model = {
        get: function(key) {
          if (key == null) return data;
          return data[key];
        },
        remove: function(key) {
          var index = keys ? keys.indexOf(key) : key;
          if (index >= 0) {
            if (keys) {
              keys.splice(index, 1);
              delete data[key];
            } else {
              data.splice(index, 1);
            }
            if (elem) elem.removeChild(elem.childNodes[index]);
          }
          return model;
        },
        insert: function(value, key) {
          if (keys && key == null) throw 'insert to object must specify a key';
          var index = key == null ? data.length : key;
          if (keys) {
            if ((index = keys.indexOf(key)) < 0) {
              index = keys.length;
              keys.push(key);
            } else if (elem) {
              elem.removeChild(elem.childNodes[index]);
            }
            data[key] = value;
          } else {
            data.splice(index, 0, value);
          }
          if (elem) elem.insertBefore(self.dom(insert(value, key, index, model)), elem.childNodes[index]);
          return model;
        },
        insertAll: function(values) {
          if (keys) {
            if (typeof values != 'object' || Array.isArray(values) || !values) throw 'values must be an object';
            Object.keys(values).forEach(function(key) {
              model.insert(values[key], key);
            });
          } else {
            if (!Array.isArray(values)) throw 'values must be an array';
            values.forEach(function(value) {
              model.insert(value);
            });
          }
          return model;
        },
        sort: function(compare) { // keep compare function if object?
          // TODO
          return model;
        },
        view: function(parent) {
          var data_ = data;
          elem = parent;
          data = keys ? {} : [];
          keys = keys && [];
          model.insertAll(data_);
        }
      };
    }
  };
});
