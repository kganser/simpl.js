kernel.add('html', function() {
  var html, attr = function(node, parent) {
    Object.keys(node).forEach(function(k) {
      if (k == 'children') return;
      var n = node[k];
      if (typeof parent[k] == 'undefined' || typeof n != 'object' || n == null)
        return parent[k] = n;
      attr(n, parent[k], true);
    });
    return node.children;
  };
  return html = {
    // returns html string
    markup: function(node) {
      switch (typeof node) {
        case 'object':
          if (!node) break;
          if (Array.isArray(node))
            return node.map(html.markup).join('');
          var tag = Object.keys(node)[0],
              value = node[tag],
              object = value && typeof value == 'object' && !Array.isArray(value);
          return '<'+tag+(object ? Object.keys(value) : []).map(function(attr) {
              return attr == 'children' ? '' : ' '+attr+(value[attr] == null ? '' : '="'+value[attr]+'"');
            }).join('')+'>'+html.markup(object ? value.children : value)+({
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
    },
    // generates dom (client-side implementation; from http://kganser.com/jsml)
    dom: function(node, parent, clear) {
      if (clear) while (parent.firstChild) parent.removeChild(parent.firstChild);
      switch (typeof node) {
        case 'object':
          if (!node) return;
          if (Array.isArray(node)) {
            node.forEach(function(node) { html.dom(node, parent); });
            return parent;
          }
          var tag = Object.keys(node)[0],
              elem = document.createElement(tag);
          if (parent) parent.appendChild(elem); 
          node = node[tag];
          html.dom(typeof node == 'object' && node && !Array.isArray(node) ? attr(node, elem) : node, elem);
          return elem;
        case 'function':
          return html.dom(node(parent), parent);
        case 'string':
        case 'number':
          node = document.createTextNode(node);
          return parent ? parent.appendChild(node) : node;
      }
    },
    model: function(data, insert) {
      if (typeof data != 'object' || !data) throw 'data must be object or array';
      var self, node,
          keys = !Array.isArray(data) && Object.keys(data);
      return self = {
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
            if (node) node.removeChild(node.childNodes[index]);
          }
          return self;
        },
        insert: function(value, key) {
          if (keys && key == null) throw 'insert to object must specify a key';
          var index = key == null ? data.length : key;
          if (keys) {
            if ((index = keys.indexOf(key)) < 0) {
              index = keys.length;
              keys.push(key);
            } else if (node) {
              node.removeChild(node.childNodes[index]);
            }
            data[key] = value;
          } else {
            data.splice(index, 0, value);
          }
          if (node) node.insertBefore(html.dom(insert(value, key, index, self)), node.childNodes[index]);
          return self;
        },
        insertAll: function(values) {
          if (keys) {
            if (typeof values != 'object' || Array.isArray(values) || !values) throw 'values must be an object';
            Object.keys(values).forEach(function(key) {
              self.insert(values[key], key);
            });
          } else {
            if (!Array.isArray(values)) throw 'values must be an array';
            values.forEach(function(value) {
              self.insert(value);
            });
          }
          return self;
        },
        sort: function(compare) { // keep compare function if object?
          // TODO
          return self;
        },
        view: function(element) {
          var copy = data;
          node = element;
          data = keys ? {} : [];
          keys = keys && [];
          self.insertAll(copy);
        }
      };
    }
  };
});
