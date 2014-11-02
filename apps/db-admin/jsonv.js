kernel.add('jsonv', function(o) {
  return function(data, element) {
    
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
      request.setRequestHeader('Accept', 'application/json');
      request.setRequestHeader('Content-Type', 'application/json');
      request.send(o.body);
    };
    
    element.textContent = '';
    o.html.dom(json(data), element);
    
    // TODO: better interface between DOM and data
    // TODO: post to and insert to beginning of arrays
    // TODO: handle duplicate keys in objects
    // TODO: handle key ordering in objects
    // TODO: implement sort on arrays
    // TODO: pending request indicator
    // TODO: handle pagination in objects, arrays (when implemented in db api)
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
          var method = 'INSERT';
          if (this.origType || this.object(elem)) {
            method = 'PUT';
            if (!this.origType)
              this.path.splice(-1, 1, elem.parentNode.children[1].textContent);
          }
          var value = elem.textContent;
          try { value = JSON.parse(value); } catch (e) {}
          console.log(method+' /'+this.path.map(encodeURIComponent).join('/')+'\n'+JSON.stringify(value));
          xhr({method: method, path: '/'+this.path.map(encodeURIComponent).join('/'), body: JSON.stringify(value)});
          this.path = this.origType = this.origValue = null; // reset must be done before DOM changes (?) to prevent double-submit on keydown and blur
          elem.parentNode.children[1].contentEditable = false;
          elem.parentNode.replaceChild(o.html.dom(json(value)), elem);
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
            } else if (c == 'json-delete' || c == 'json-string' || c == 'json-number' || c == 'json-boolean' || c == 'json-null' || t.tagName == 'LI' || t.tagName == 'OL' || t.tagName == 'UL') {
              var item = t;
              if (t.tagName == 'LI' || t.tagName == 'OL' || t.tagName == 'UL') {
                if (item.tagName == 'LI') item = t.parentNode;
                if (item.tagName == 'OL') {
                  item = item.insertBefore(o.html.dom({li: [
                    {span: {className: 'json-delete', children: '×'}},
                    {span: {className: 'json-null'}}
                  ]}), t.tagName == 'OL' ? t.firstChild : t.nextSibling);
                } else {
                  item = o.html.dom({li: [
                    {span: {className: 'json-delete', children: '×'}},
                    {span: {className: 'json-key'}}, ': ',
                    {span: {className: 'json-null'}}
                  ]}, item);
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
    
    element.addEventListener('click', handler);
    element.addEventListener('keydown', handler);
    element.addEventListener('blur', handler, true);
  };
}, {html: 0});