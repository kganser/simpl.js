kernel.add('html', function() {
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
  return {
    // returns html string
    markup: function markup(node) {
      switch (typeof node) {
        case 'object':
          if (!node) break;
          if (Array.isArray(node))
            return node.map(markup).join('');
          var tag = Object.keys(node)[0],
              value = node[tag],
              object = value && typeof value == 'object' && !Array.isArray(value);
          return '<'+tag+(object ? Object.keys(value) : []).map(function(attr) {
              return attr == 'children' ? '' : ' '+attr+(value[attr] == null ? '' : '="'+value[attr]+'"');
            }).join('')+'>'+markup(object ? value.children : value)+({
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
    dom: function dom(node, parent) {
      switch (typeof node) {
        case 'object':
          if (!node) return;
          if (Array.isArray(node)) {
            node.forEach(function(node) { dom(node, parent); });
            return parent;
          }
          var tag = Object.keys(node)[0],
              elem = document.createElement(tag);
          if (parent) parent.appendChild(elem); 
          node = node[tag];
          dom(typeof node == 'object' && node && !Array.isArray(node) ? attr(node, elem) : node, elem);
          return elem;
        case 'function':
          return dom(node(parent), parent);
        case 'string':
        case 'number':
          node = document.createTextNode(node);
          return parent ? parent.appendChild(node) : node;
      }
    }
  };
});
