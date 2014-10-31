kernel.use({http: 0, html: 0, database: 0, xhr: 0, string: 0}, function(o, proxy) {

  o.xhr('/kernel.js', function(e) {
    var apps = {},
        kernel = e.target.responseText;
    
    o.http.serve({port: 8000}, function(request, response) {
      if (request.path == '/') {
        if (request.method == 'POST' && request.post && request.post.module) {
          var module = request.post.module;
          return o.database.get('modules/'+encodeURIComponent(module), function(code) {
            if (apps[module]) {
              apps[module].terminate();
              delete apps[module];
            } else {
              apps[module] = proxy(null, kernel+code, function(module, callback) {
                module = encodeURIComponent(module);
                o.database.get('modules/'+module, function(code) {
                  if (code) return callback(code);
                  o.xhr('/modules/'+module+'.js', function(e) { callback(e.target.responseText); });
                });
              }, function(e) {
                // TODO: communicate module error in UI
                console.error(e);
                delete apps[module];
              });
            }
            response.end('Success', {Location: '/'}, 303);
          });
        }
        return o.database.get('modules', function(modules) {
          response.end(o.html.markup([
            {'!doctype': {html: null}},
            {html: [
              {head: [
                {title: 'Browserver'},
                {link: {rel: 'shortcut icon', href: 'http://localhost:8001/icon.png'}}
              ]},
              {body: [
                {input: {type: 'text', placeholder: 'Module name', id: 'name'}},
                {button: {children: 'Add', disabled: 'disabled', id: 'add'}},
                {form: {action: '/', method: 'post', children: [
                  {ul: {id: 'modules', children: Object.keys(modules).map(function(module) {
                    return {li: [
                      {a: {href: '/'+encodeURIComponent(module), target: '_blank', children: module}}, ' ',
                      {button: {type: 'submit', name: 'module', value: module, children: apps[module] ? 'Stop' : 'Run'}}
                    ]};
                  })}}
                ]}},
                {script: {src: 'http://localhost:8001/kernel.js'}},
                {script: {src: 'http://localhost:8001/modules/html.js'}},
                {script: function(m) {
                  if (!m) return Object.keys(modules);
                  kernel.use({html: 0}, function(o) {
                    var add = document.getElementById('add'),
                        name = document.getElementById('name'),
                        list = document.getElementById('modules');
                    name.onkeyup = function() {
                      add.disabled = !this.value;
                    };
                    add.onclick = function() {
                      if (~m.indexOf(name.value)) return alert('Module name already exists');
                      m.push(name.value);
                      o.html.dom({li: [
                        {a: {href: '/'+encodeURIComponent(name.value), target: '_blank', children: name.value}}, ' ',
                        {button: {type: 'submit', name: 'module', value: name.value, children: 'Run'}}
                      ]}, list);
                    };
                  });
                }}
              ]}
            ]}
          ]), {'Content-Type': 'text/html'});
        });
      }
      
      var module = decodeURIComponent(request.path.substr(1)),
          path = 'modules/'+encodeURIComponent(module);
      
      if (request.method == 'DELETE')
        return o.database.delete(path, function() {
          response.end('Success');
        });
      
      // TODO: validate encoding
      if (request.method == 'POST')
        return o.database.put(path, o.string.fromUTF8Buffer(request.body), function() {
          response.end('Success', {Location: request.path}, 303);
        });
      
      o.database.get(path, function(code) {
        response.end(o.html.markup([
          {'!doctype': {html: null}},
          {html: [
            {head: [
              {title: 'Browserver'},
              {meta: {charset: 'utf-8'}},
              {link: {rel: 'shortcut icon', href: 'http://localhost:8001/icon.png'}},
              {link: {rel: 'stylesheet', href: 'http://localhost:8001/codemirror/codemirror.css'}},
              {style: 'body { margin: 0; } .CodeMirror { height: auto; } .CodeMirror-scroll { overflow-x: auto; overflow-y: hidden; }'},
            ]},
            {body: [
              {textarea: code || ''},
              {script: {src: 'http://localhost:8001/codemirror/codemirror.js'}},
              {script: {src: 'http://localhost:8001/codemirror/javascript.js'}},
              {script: {src: 'http://localhost:8001/codemirror/matchbrackets.js'}},
              {script: {src: 'http://localhost:8001/codemirror/match-highlighter.js'}},
              {script: function() {
                CodeMirror.fromTextArea(document.getElementsByTagName('textarea')[0], {
                  lineNumbers: true,
                  matchBrackets: true,
                  highlightSelectionMatches: true
                });
                CodeMirror.commands.save = function(cm) {
                  var request = new XMLHttpRequest();
                  request.open('POST', location.pathname);
                  request.send(cm.getValue());
                };
              }}
            ]}
          ]}
        ]), {'Content-Type': 'text/html'});
      });
    });
  });
  
  o.http.serve({port: 8001}, function(request, response) {
    o.xhr(location.origin+request.path, {responseType: 'arraybuffer'}, function(e) {
      if (e.target.status != 200)
        return response.end('404 Resource not found', null, 404);
      response.end(e.target.response, {'Content-Type': o.http.getMimeType((request.path.match(/\.([^.]*)$/) || [])[1])});
    });
  });
});
