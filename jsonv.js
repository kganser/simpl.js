simpl.add('jsonv', function(o) {
  var json = function(data, options, path) {
    var type = typeof data, name = type;
    if (type == 'object') {
      type = name = Array.isArray(data) ? 'array' : data ? type : 'null';
      if (type != 'null' && options.collapsed(path)) name += ' closed';
    }
    return {span: {className: 'jsonv-'+name, children:
      type == 'array' ? {ol: data.map(function(e, i) {
        return {li: [{span: {className: 'jsonv-delete', children: '×'}}, json(e, options, path.concat([i]))]};
      })} :
      type == 'object' ? {ul: Object.keys(data).sort().map(function(key) {
        return {li: [
          {span: {className: 'jsonv-delete', children: '×'}},
          {span: {className: 'jsonv-key', children: key}}, ': ', json(data[key], options, path.concat([key]))
        ]};
      })} :
      String(data)
    }};
  };
  var scalars = {'jsonv-string': 1, 'jsonv-number': 1, 'jsonv-boolean': 1, 'jsonv-null': 1},
      compounds = {LI: 1, OL: 1, UL: 1};
  // TODO: implement sort on arrays
  // TODO: pending request indicator
  // TODO: pagination for objects, arrays
  var handler = function(editor, data, self) {
    return self = {
      data: data,
      object: function(elem) {
        return elem.parentNode.parentNode.parentNode.className == 'jsonv-object';
      },
      clean: function(html) {
        return html.replace(/<br\s*\/?>/ig, '\n').replace(/<[^>]>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
      },
      parent: function(path) {
        var parent = self.data;
        path.slice(0, -1).forEach(function(key) { parent = parent[key]; });
        return parent;
      },
      cancel: function(elem) {
        if (self.path && self.origType) { // revert if editing
          elem.contentEditable = false;
          elem.className = self.origType;
          elem.textContent = self.origValue;
        } else { // remove if adding
          elem.parentNode.parentNode.removeChild(elem.parentNode);
        }
        self.path = self.origType = self.origValue = null;
      },
      submit: function(elem) {
        if (!self.path) return;
        var origJson = self.origType == 'jsonv-string' ? JSON.stringify(self.origValue) : self.origValue;
        if (self.origType && elem.textContent == origJson) { // value unchanged
          elem.textContent = self.origValue;
          elem.contentEditable = false;
        } else {
          var method = 'insert',
              object = self.object(elem),
              value = self.clean(elem.innerHTML),
              item = elem.parentNode,
              parent = self.parent(self.path),
              key = self.path.pop();
          try { value = JSON.parse(value); } catch (e) {}
          if (self.origType || object) {
            if (!self.origType) {
              key = self.clean(item.children[1].innerHTML);
              var replace = key in parent;
            }
            method = 'put';
            parent[key] = value;
          } else {
            parent.splice(key, 0, value);
          }
          self.path.push(key);
          editor.listener(method, self.path, value);
          item.children[1].contentEditable = false;
          if (object) { // move into position alphabetically
            var list = item.parentNode,
                i = Object.keys(parent).sort().indexOf(key);
            if (replace) {
              list.removeChild(item);
              elem = list.children[i].children[2];
            } else if (item != list.children[i]) {
              list.insertBefore(list.removeChild(item), list.children[i]);
            }
          }
          elem.parentNode.replaceChild(o.html.dom(json(value, editor, self.path)), elem);
        }
        self.path = self.origType = self.origValue = null;
      },
      locate: function(item, root) {
        var path = [];
        while (item != root) {
          path.unshift(item.children[1].className == 'jsonv-key'
            ? self.clean(item.children[1].innerHTML)
            : Array.prototype.indexOf.call(item.parentNode.children, item));
          item = item.parentNode.parentNode.parentNode; // li/root > span > ul/ol > li
        }
        return path;
      },
      handleEvent: function(e) {
        var t = e.target,
            c = t.className;
        switch (e.type) {
          case 'click':
            if (c == 'jsonv-object' || c == 'jsonv-array') {
              t.classList.add('closed');
              if (editor) editor.listener('collapse', self.locate(t.parentNode, e.currentTarget));
            } else if (c == 'jsonv-object closed' || c == 'jsonv-array closed') {
              t.classList.remove('closed');
              var path = self.locate(t.parentNode, e.currentTarget);
              // TODO: loading
              if (editor) editor.listener('expand', path, undefined, function(error, data) {
                if (error) {
                  t.classList.add('closed');
                  editor.listener('collapse', path);
                } else {
                  t.parentNode.replaceChild(o.html.dom(json(data, editor, path)), t);
                  if (path.length) self.parent(path)[path.pop()] = data;
                  else self.data = data;
                }
              });
            } else if (editor && t.contentEditable != 'true' && (c in scalars || c == 'jsonv-delete' || t.tagName in compounds)) {
              var item = t;
              if (t.tagName in compounds) {
                if (item.tagName == 'LI') item = t.parentNode;
                if (item.parentNode.classList.contains('closed')) return;
                if (item.tagName == 'OL') {
                  item = item.insertBefore(o.html.dom({li: [
                    {span: {className: 'jsonv-delete', children: '×'}},
                    {span: {className: 'jsonv-null'}}
                  ]}), t.tagName == 'OL' ? t.firstChild : t.nextSibling);
                } else {
                  item = o.html.dom({li: [
                    {span: {className: 'jsonv-delete', children: '×'}},
                    {span: {className: 'jsonv-key'}}, ': ',
                    {span: {className: 'jsonv-null'}}
                  ]}, item);
                }
                t = item.children[1];
              } else {
                item = t.parentNode;
                self.origType = c;
                self.origValue = t.textContent;
                if (c == 'jsonv-string') t.textContent = JSON.stringify(t.textContent);
              }
              self.path = self.locate(item, e.currentTarget);
              if (c == 'jsonv-delete') {
                editor.listener('delete', self.path);
                var parent = self.parent(self.path),
                    key = self.path.pop();
                if (typeof key == 'number') parent.splice(key, 1);
                else delete parent[key];
                self.path = self.origType = self.origValue = null;
                t.parentNode.parentNode.removeChild(t.parentNode);
              } else {
                t.contentEditable = true;
                t.focus();
                document.execCommand('selectAll', false, null);
              }
            }
            break;
          case 'keydown':
            var esc = e.keyCode == 27,
                tab = e.keyCode == 9,
                enter = e.keyCode == 13,
                colon = e.keyCode == 186 || e.keyCode == 59 && e.shiftKey,
                key = c == 'jsonv-key';
            if (esc || !t.textContent && (tab || enter || key && colon)) { // cancel
              e.preventDefault();
              t.textContent = '';
              t.blur();
            } else if (!key && (tab || enter) && !e.shiftKey) { // submit
              e.preventDefault();
              self.submit(t);
            } else if (key && t.textContent && (tab || enter || colon)) { // move to value
              e.preventDefault();
              e.stopPropagation();
              t.contentEditable = false;
              t.parentNode.lastChild.contentEditable = true;
              t.parentNode.lastChild.focus();
            } else if (self.object(t) && !key && (tab || enter) && e.shiftKey) { // move to key
              e.preventDefault();
              if (self.origType) {
                t.blur();
              } else {
                t.contentEditable = false;
                t.parentNode.children[1].contentEditable = true;
                t.parentNode.children[1].focus();
              }
            }
            break;
          case 'blur':
            if (c in scalars || c == 'jsonv-key') {
              self.focus = null;
              setTimeout(function() {
                var parent = t.parentNode;
                if (self.focus == parent) return;
                t = parent.lastChild;
                if (parent.children[1].textContent && t.textContent)
                  return self.submit(t);
                self.cancel(t);
              }, 0);
            }
            break;
          case 'focus':
            self.focus = e.target.parentNode;
            break;
        }
      }
    };
  };
  var click = handler();
  return function(elem, data, options) {
    if (data === undefined) data = JSON.parse(elem.textContent);
    if (!options) options = {};
    else if (typeof options == 'function') options = {listener: options};
    if (options.listener) {
      var listener = handler(options, JSON.parse(JSON.stringify(data)));
      elem.classList.add('jsonv-editable');
      elem.addEventListener('keydown', listener);
      elem.addEventListener('blur', listener, true);
      elem.addEventListener('focus', listener, true);
    }
    if (typeof options.collapsed != 'function')
      options.collapsed = options.collapsed ? function() { return true; } : function() {};
    elem.classList.add('jsonv');
    elem.addEventListener('click', listener || click);
    o.html.dom(json(data, options, []), elem, true);
    return {
      update: function(data) {
        if (data !== undefined) {
          if (listener) listener.data = JSON.parse(JSON.stringify(data));
          o.html.dom(json(data, options, []), elem, true);
        } else if (elem.firstChild) {
          (function collapse(span, path) {
            var c = span.classList, o = c.contains('jsonv-object');
            if (o || c.contains('jsonv-array')) {
              c.toggle('closed', options.collapsed(path));
              Array.prototype.slice.call(span.firstChild.children).forEach(function(li, i) {
                collapse(li.lastChild, path.concat([o ? li.children[1].textContent : i]));
              });
            }
          }(elem.firstChild, []));
        }
      }
    };
  };
}, 0, {html: 0});
