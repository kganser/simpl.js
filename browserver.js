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
          Object.keys(modules).forEach(function(name, i) {
            modules[name] = {code: modules[name], running: !!apps[name]};
          });
          response.end(o.html.markup([
            {'!doctype': {html: null}},
            {html: [
              {head: [
                {title: 'Browserver'},
                {meta: {charset: 'utf-8'}},
                {link: {rel: 'shortcut icon', href: '/icon.png'}},
                {link: {rel: 'stylesheet', href: '/codemirror/codemirror.css'}},
                {link: {rel: 'stylesheet', href: '/browserver.css'}}
              ]},
              {body: [
                {script: {src: '/kernel.js'}},
                {script: {src: '/modules/html.js'}},
                {script: {src: '/modules/xhr.js'}},
                {script: {src: '/codemirror/codemirror.js'}},
                {script: {src: '/codemirror/javascript.js'}},
                {script: {src: '/codemirror/matchbrackets.js'}},
                {script: {src: '/codemirror/match-highlighter.js'}},
                {script: function(m) {
                  if (!m) return modules;
                  kernel.use({html: 0, xhr: 0}, function(o) {
                    var name, add, list, tab, active = Object.keys(m)[0], entry = function(name) {
                      var encoded = encodeURIComponent(name),
                          module = m[name];
                      return {li: function(e) {
                        if (name == active)
                          (tab = e).className = 'active';
                        e.onclick = function() {
                          if (tab) tab.className = '';
                          (tab = this).className = 'active';
                          editor.setValue(module.code);
                        };
                        return [
                          name,
                          {button: {children: module.running ? 'Stop' : 'Run', onclick: function(e) {
                            e.stopPropagation();
                            this.disabled = true;
                            o.xhr('/', {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'}, data: 'module='+encoded}, function() {
                              e.target.disabled = false;
                              e.target.textContent = (module.running = !module.running) ? 'Stop' : 'Run';
                            });
                          }}}
                        ];
                      }};
                    };
                    o.html.dom([
                      {div: {id: 'nav', children: [
                        {div: {id: 'module', children: [
                          {input: {type: 'text', placeholder: 'New Module', onkeyup: function() { add.disabled = !this.value; }, children: function(e) { name = e; }}},
                          {button: {disabled: 'disabled', children: function(e) { add = e; return 'Add'; }, onclick: function() {
                            if (m[name.value]) return alert('Module name already exists');
                            m[name.value] = {code: ''};
                            tab.className = '';
                            active = name.value;
                            o.html.dom(entry(name.value), list);
                            name.value = '';
                          }}}
                        ]}},
                        {ul: function(e) { list = e; return Object.keys(m).map(entry); }}
                      ]}},
                      {div: {id: 'editor', children: [
                        {textarea: function(e) { code = e; return active ? m[active].code : ''; }}
                      ]}}
                    ], document.body);
                    var editor = CodeMirror.fromTextArea(code, {
                      lineNumbers: true,
                      matchBrackets: true,
                      highlightSelectionMatches: true
                    });
                    CodeMirror.commands.save = function() {
                      if (!active) return;
                      o.xhr('/'+encodeURIComponent(active), {method: 'POST', data: module[active] = editor.getValue()});
                    };
                  });
                }}
              ]}
            ]}
          ]), {'Content-Type': 'text/html'});
        });
      }
      
      if (request.method == 'GET')
        return o.xhr(location.origin+request.path, {responseType: 'arraybuffer'}, function(e) {
          if (e.target.status != 200)
            return response.end('404 Resource not found', null, 404);
          response.end(e.target.response, {'Content-Type': o.http.getMimeType((request.path.match(/\.([^.]*)$/) || [])[1])});
        });
      
      var module = decodeURIComponent(request.path.substr(1)),
          path = 'modules/'+encodeURIComponent(module);
      
      if (request.method == 'DELETE')
        return o.database.delete(path, function() {
          response.end('Deleted');
        });
      
      // TODO: validate encoding
      if (request.method == 'POST')
        return o.database.put(path, o.string.fromUTF8Buffer(request.body), function() {
          response.end('Saved');
        });
    });
  });
});
