simpl.add('html', function() {
  var self;
  /** html: {
        markup: function(node:any) -> string,
        dom: function(node:any, parent=null:DOMElement, clear=false:boolean) -> DOMNode|undefined,
        css: function(styles:object) -> string
      }
      
      Utilities for generating HTML using native javascript data structures: `markup` produces an HTML string, `dom`
      builds a DOM structure using the client browser API, and `css` renders CSS from an object representation. */
  return self = {
    /** markup: function(node:any) -> string
        
        In `markup`, `node` represents an HTML node. An object is translated to an element using its first key and
        value as the tag name and content, respectively:

        `{div: 'hello world'} → <div>hello world</div>`
        
        If the value is itself an object, it is interpreted as the element's attributes:
        
        `{label: {for: 'name'}} → <label for="name"></label>`
        
        Inside an attributes object, the `children` key is interpreted as a `node`:
        
        `{label: {for: 'name', children: 'Name'}} → <label for="name">Name</label>`

        If `node` is an array, `markup` is recursively called on its elements:
        
        `{ul: [{li: 'first'}, {li: 'second'}]} → <ul><li>first</li><li>second</li></ul>`
        
        If `node` is a function, it is output as a self-invoking function `'('+node+'('+node()+'));'`*. This allows
        client-side scripts to be inlined into markup generated on the server and run on the client with any needed
        json data passed in:

       `var data = [1,2,3];
        markup({script: function(numbers) {
          if (!numbers) return data;
          console.log(numbers);
        }});`
        
        becomes
        
       `<script>(function(numbers) {
          if (!numbers) return data;
          console.log(numbers);
        }([1,2,3]));</script>`
        
        Here, `return data;` only executes in the server's closure context, where `data` is defined, and `console.log`
        only runs in the client browser.
        
        If `node` is a number, it is treated as a string. Other data types return '', so boolean operators can be used
        to toggle sections of markup. Within elements in the markup, `&` and `<` are encoded as `&amp;` and `&gt;`, and
        within element attributes, `&` and `"` are encoded as `&amp;` and `&quot;`.
        
        * function `node` is actually stringified as follows:
        
       `var args;
        return '('+node+'('+(
          node.length && (args = node()) !== undefined ? Array.isArray(args) && node.length >= args.length ? args : [args] : []
        ).map(function(arg) { return JSON.stringify(arg); }).join(',')+'));';` */
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
            var v = value[attr];
            return attr == 'children' || v === false ? '' : ' '+attr+(v == null || v === true ? '' : '="'+String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;')+'"');
          }).join('')+'>'+markup(object ? value.children : value)+({'!doctype':1,area:1,base:1,br:1,col:1,command:1,
          embed:1,hr:1,img:1,input:1,keygen:1,link:1,meta:1,param:1,source:1,track:1,wbr:1}[tag] ? '' : '</'+tag+'>');
        case 'function':
          var args;
          return ('('+node+'('+(node.length && (args = node()) !== undefined ? Array.isArray(args) && node.length >= args.length ? args : [args] : [])
            .map(function(arg) { return typeof arg == 'function' ? arg : JSON.stringify(arg); }).join(',')+'));').replace(/<\/(script)>/ig, '<\\/$1>');
        case 'string':
          return node.replace(/&/g, '&amp;').replace(/</g, '&lt;');
        case 'number':
          return node;
      }
      return '';
    },
    /** dom: function(node:any, parent=null:DOMElement, clear=false:boolean) -> DOMNode|undefined
        
        `dom` represents HTML the same way as `markup`, but operates on the DOM API, generating and attaching DOM
        elements and text nodes rather than concatenating strings. Hence, attributes can be applied recursively however
        the client DOM API allows:
        
        `{div: {style: {display: 'block'}}} ←→ document.createElement('div').style.display = 'block';`
        
        This also allows event handlers to be attached as attributes:

        `{div: {onclick: function(event) { alert('clicked!'); }}}`
        
        If `node` is a function (in contrast to its treatment in `markup`) it is invoked with the parent `DOMElement`
        as its first argument, and `dom` continues to operate on its return value as a `node` substructure. This way,
        references to elements can be intercepted for later use as the `node` structure is constructed.
        
        If `parent` is a `DOMElement`, the structure is appended to it. If `clear` is true, `dom` first removes all
        children of `parent` (if set). `dom` returns the DOMNode corresponding to the top level of `node` created, or
        `parent` if `node` is an array. */
    dom: function dom(node, parent, clear) {
      if (clear && parent) while (parent.firstChild) parent.removeChild(parent.firstChild);
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
          dom(typeof node == 'object' && node && !Array.isArray(node) ? function attr(node, parent) {
            Object.keys(node).forEach(function(k) {
              if (k == 'children') return;
              var n = node[k];
              if (typeof parent[k] == 'undefined' || typeof n != 'object' || n == null)
                return parent[k] = n;
              attr(n, parent[k], true);
            });
            return node.children;
          }(node, elem) : node, elem);
          return elem;
        case 'function':
          return dom(node(parent), parent);
        case 'string':
        case 'number':
          node = document.createTextNode(node);
          return parent ? parent.appendChild(node) : node;
      }
    },
    /** css: function(styles:object) -> string
    
        Generates a string of CSS from its object representation. The `styles` object consists of selectors as keys
        mapping to objects with CSS property keys (in camelCase) and values. Descendant selectors (identified by object
        type values) can also be specified recursively within a parent selector's styles. If `&` is present within the
        child selector, its resolved parent selector will be inserted there instead. If a top-level `styles` key begins
        with `'@media'`, its value object is treated as an embedded `styles` object wrapped with the media query. */
    css: function css(styles) {
      
      // styles     := { rule* }
      // rule       := selector : properties
      // properties := { (property|rule)* }
      // property   := name : value
      
      var rule = function(selector, properties) {
        var rules = [],
            styles = [];
        Object.keys(properties).forEach(function(name) {
          var value = properties[name];
          if (typeof value == 'object') {
            if (styles.length) {
              rules.push(selector+'{'+styles.join(';')+'}');
              styles = [];
            }
            selector.split(',').forEach(function(s) {
              s = s.trim();
              name.split(',').forEach(function(n) {
                n = n.trim();
                rule(~n.indexOf('&') ? n.replace('&', s) : s+' '+n, value).forEach(function(rule) {
                  rules.push(rule);
                });
              });
            });
          } else {
            styles.push(
              name.replace(/([a-z])([A-Z])/g, '$1-$2').replace(/^(webkit|moz|o|ms)-/, '-$1-').toLowerCase()
              +':'+(value === '' ? '""' : value));
          }
        });
        if (styles.length)
          rules.push(selector+'{'+styles.join(';')+'}');
        return rules;
      };
      
      return Object.keys(styles || {}).reduce(function(rules, selector) {
        var properties = styles[selector];
        return rules.concat(
          selector.indexOf('@media ')
            ? rule(selector, properties)
            : selector+'{'+css(properties)+'}');
      }, []).join('');
    }
  };
});
