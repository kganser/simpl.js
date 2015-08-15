var markup = function() {
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
  return function markup(node, parent, clear) {
    if (clear && parent) while (parent.firstChild) parent.removeChild(parent.firstChild);
    switch (typeof node) {
      case 'object':
        if (!node) return;
        if (Array.isArray(node)) {
          node.forEach(function(node) { markup(node, parent); });
          return parent;
        }
        var tag = Object.keys(node)[0],
            elem = document.createElement(tag);
        if (parent) parent.appendChild(elem); 
        node = node[tag];
        markup(typeof node == 'object' && node && !Array.isArray(node) ? attr(node, elem) : node, elem);
        return elem;
      case 'function':
        return markup(node(parent), parent);
      case 'string':
      case 'number':
        node = document.createTextNode(node);
        return parent ? parent.appendChild(node) : node;
    }
  };
}();
var xhr = function(url, options, callback) {
  options = options || {};
  if (typeof options == 'function')
    callback = options;
    
  var xhr = new XMLHttpRequest();
  xhr.open(options.method || 'GET', url, true, options.user, options.password);
  
  xhr.timeout = options.timeout;
  xhr.responseType = options.responseType || '';
  xhr.onload = options.onload || callback;
  xhr.onerror = options.onerror || callback;
  xhr.ontimeout = options.ontimeout || callback;
  xhr.onreadystatechange = options.onreadystatechange;
  
  var headers = options.headers || {};
  if (options.json && headers['Content-Type'] === undefined)
    headers['Content-Type'] = 'application/json';
  Object.keys(headers).forEach(function(name) {
    var value = headers[name];
    if (value != null) xhr.setRequestHeader(name, value);
  });
  
  xhr.send(options.json ? JSON.stringify(options.json) : options.data);
  return xhr;
};
var icons = {};
Array.prototype.slice.call(document.getElementById('icons').childNodes).forEach(function(icon) {
  icons[icon.id.substr(5)] = function(el) {
    var ns = 'http://www.w3.org/2000/svg',
        svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', icon.id);
    el.appendChild(svg)
      .appendChild(document.createElementNS(ns, 'use'))
      .setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', '#'+icon.id);
  };
});
