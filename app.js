simpl.add('app', function(o) {
  return function(apps, modules, offset, body) {
    Object.keys(apps).forEach(function(name) { apps[name] = {running: apps[name], log: [], loading: false}; });
    Object.keys(modules).forEach(function(name) { modules[name] = {loading: false}; });
    var appList, moduleList, selected, code, config, log, docs, line, status;
    if (window.EventSource) new EventSource('/activity').onmessage = function(e) {
      var message = JSON.parse(e.data),
          event = message.event,
          data = message.data;
      switch (event) {
        case 'log':
          var app = apps[data.app];
          if (!app) return;
          if (app.log.push(message = {
            level: data.level == 'log' ? 'debug' : data.level,
            message: data.message,
            module: data.module || '',
            line: data.line && data.line > offset ? data.module ? data.line : data.line-offset : null
          }) > 1000) app.log.shift();
          if (selected && selected.entry == app) {
            var scroll = body.classList.contains('show-log') && body.scrollHeight - body.scrollTop == document.documentElement.clientHeight;
            o.html.dom(logLine(message), log);
            if (scroll) body.scrollTop = body.scrollHeight;
          }
          break;
        case 'run':
        case 'stop':
        case 'error':
          var app = apps[data.app];
          if (!app) return;
          app.running = event == 'run';
          app.tab.classList[event == 'run' ? 'add' : 'remove']('running');
          app.tab.classList[event == 'error' ? 'add' : 'remove']('error');
          if (event == 'run') {
            app.log = [];
            if (selected && selected.entry == app)
              log.textContent = '';
          } else if (event == 'error') {
            app.log.push(message = {
              level: 'error',
              message: [data.message],
              module: data.module || '',
              line: data.line && data.line > offset ? data.module ? data.line : data.line-offset : null
            });
            if (selected && selected.entry == app)
              o.html.dom(logLine(message), log);
          }
          break;
        case 'delete':
          var entries = data.app ? apps : modules;
              entry = entries[data.name];
          if (!entry) return;
          if (selected && selected.entry == entry) selected = null;
          delete entries[data.name];
          entry.tab.parentNode.removeChild(entry.tab);
          break;
      }
    };
    var logLine = function(entry) {
      var string = entry.message.join(', '),
          message = [], link;
      while (link = /\b(https?|ftp):\/\/\S+\b/.exec(string)) {
        var url = link[0];
        if (link.index) message.push(string.substr(0, link.index));
        message.push({a: {href: url, target: '_blank', children: url}});
        string = string.substr(link.index+url.length);
      }
      if (string) message.push(string);
      return {div: {className: 'entry '+entry.level, children: [
        {div: {className: 'location', children: entry.line && entry.module+':'+entry.line}},
        {div: {className: 'message', children: message}}
      ]}};
    };
    var doc = function(name, code) {
      o.html.dom([{h1: name}, o.docs.generate(code).map(function(block) {
        return [
          {pre: block.spec
            ? {className: 'spec', children: o.docs.stringifySpec(block.spec)}
            : {className: 'spec error', children: block.error.toString()}},
          block.text.map(function(text) {
            return text.pre ? text : {p: text};
          })
        ];
      })], docs, true);
    };
    var handler = function(action, name, app, entry) {
      return function(e) {
        e.stopPropagation();
        var command = action != 'delete' && {action: action, app: name};
        if (!command && !confirm('Are you sure you want to delete?')) return;
        this.disabled = true;
        o.xhr(command ? '/' : (app ? '/apps/' : '/modules/')+encodeURIComponent(name), {
          method: command ? 'POST' : 'DELETE',
          json: command
        }, function() {
          e.target.disabled = false;
          var entry = (app ? apps : modules)[name];
          if (!command || !entry) return;
          entry.running = action != 'stop';
          entry.tab.classList[entry.running ? 'add' : 'remove']('running');
          if (entry.running) {
            entry.log = [];
            if (selected && selected.entry == entry) {
              log.textContent = '';
              toggle(name, true, 'log');
            }
          }
        });
      };
    };
    var toggle = function(name, app, panel, ln, ch) {
      var entry = (app ? apps : modules)[name],
          refresh = selected && selected.entry == entry && entry.tab.classList.contains('selected');
      if (!selected || selected.entry != entry || refresh) {
        if (selected) {
          selected.entry.tab.classList.remove('selected');
          if (!refresh && selected.entry.versions)
            selected.entry.versions[0].code = code.getValue();
        }
        if (entry.versions) {
          selected = line = null;
          code.setOption('readOnly', false);
          code.setValue(entry.versions[0].code);
          config.update(entry.versions[0].config);
          if (app) o.html.dom(entry.log.map(logLine), log, true);
          else doc(name, entry.versions[0].code);
        } else if (!entry.loading) {
          code.setOption('readOnly', 'nocursor');
          code.setValue('');
          entry.loading = true;
          entry.tab.classList.add('loading');
          o.xhr((app ? '/apps/' : '/modules/')+encodeURIComponent(name), {responseType: 'json'}, function(e) {
            // TODO: handle error
            entry.versions = e.target.response.versions;
            entry.tab.classList.remove('loading');
            if (entry == selected.entry) toggle(name, app, panel, ln, ch);
          });
        }
        entry.tab.classList.add('selected');
        selected = {name: name, app: app, entry: entry};
      }
      if (!panel) panel = app ? entry.running ? 'log' : 'code' : 'docs';
      body.className = body.classList.contains('collapsed') ? 'collapsed show-'+panel : 'show-'+panel;
      body.scrollTop = panel == 'log' ? body.scrollHeight : 0;
      var next = {config: entry.running ? 'log' : 'code', code: app ? 'config' : 'docs', log: 'code', docs: 'code'}[panel];
      entry.view.className = 'view '+next;
      entry.view.title = 'Show '+next[0].toUpperCase()+next.slice(1);
      if (panel == 'code') {
        code.refresh();
        if (line) code.removeLineClass(line, 'background', 'current');
        if (ln != null) {
          line = code.addLineClass(ln-1, 'background', 'current');
          code.scrollIntoView({line: ln, ch: ch});
        }
      }
    };
    var li = function(name, app) {
      var entry = (app ? apps : modules)[name];
      return {li: function(elem) {
        entry.tab = elem;
        elem.onclick = function(e) {
          toggle(name, app, (e.target == entry.view) && e.target.className.replace(/\s*view\s*/, ''));
        };
        if (entry.running)
          elem.classList.add('running');
        return [
          {div: {className: 'controls', children: [
            {button: {className: 'view', children: function(e) { entry.view = e; }}},
            app && [
              {button: {className: 'run', title: 'Run', onclick: handler('run', name, app)}},
              {button: {className: 'restart', title: 'Restart', onclick: handler('restart', name, app)}},
              {button: {className: 'stop', title: 'Stop', onclick: handler('stop', name, app)}}
            ],
            {button: {className: 'delete', title: 'Delete', onclick: handler('delete', name, app)}}
          ]}},
          {span: name}
        ];
      }};
    };
    o.html.dom([
      {nav: [
        {h2: 'Apps'},
        {div: {className: 'form', children: [
          {input: {type: 'text', placeholder: 'New App'}},
          {button: {title: 'Add', onclick: function() {
            var field = this.previousSibling,
                name = field.value;
            field.value = '';
            if (!name || apps[name]) {
              field.focus();
              alert(name ? 'App name taken' : 'Please enter app name');
            } else {
              apps[name] = {code: '', config: {}, log: []};
              o.html.dom(li(name, true), appList);
              toggle(name, true);
            }
          }}}
        ]}},
        {ul: function(e) {
          appList = e;
          return Object.keys(apps).map(function(name) {
            return li(name, true);
          });
        }},
        {h2: 'Modules'},
        {div: {className: 'form', children: [
          {input: {type: 'text', placeholder: 'New Module'}},
          {button: {title: 'Add', onclick: function() {
            var field = this.previousSibling,
                name = field.value;
            field.value = '';
            if (!name || modules[name]) {
              field.focus();
              alert(name ? 'Module name taken' : 'Please enter module name');
            } else {
              modules[name] = {code: "simpl.add('"+name.replace(/\\/g, '\\').replace(/'/g, "\\'")+"', function() {\n  \n});\n"};
              o.html.dom(li(name, false), moduleList);
              toggle(name, false, 'code');
            }
          }}}
        ]}},
        {ul: function(e) {
          moduleList = e;
          return Object.keys(modules).map(function(name) {
            return li(name, false);
          });
        }},
        {button: {className: 'toggle', onclick: function() {
          document.body.classList.toggle('collapsed');
          code.refresh();
        }}}
      ]},
      {div: {id: 'main', children: function(e) {
        code = CodeMirror(e, {
          value: selected ? selected.entry.code : '',
          lineNumbers: true,
          matchBrackets: true,
          highlightSelectionMatches: true
        });
        code.on('changes', function(e) {
          if (!selected || e.options.readOnly) return;
          selected.entry.dirty = true;
          selected.entry.tab.classList.add('changed');
        });
        CodeMirror.commands.save = function() {
          if (!selected || !selected.entry.dirty) return;
          var current = selected;
          status('info', 'Saving...');
          o.xhr((selected.app ? '/apps/' : '/modules/')+encodeURIComponent(selected.name), {
            method: 'POST',
            data: selected.entry.versions[0].code = code.getValue()
          }, function(e, ok) {
            var ok = e.target.status == 200;
            if (ok && selected == current) {
              selected.entry.tab.classList.remove('changed');
              doc(selected.name, selected.entry.versions[0].code);
            }
            status(ok ? 'success' : 'failure', ok ? 'Saved' : 'Error');
          });
        };
        return [
          {pre: {id: 'config', className: 'json', children: function(e) {
            config = o.jsonv(selected && selected.entry.versions[0].config, e, function(method, path, data) {
              var app = selected.entry.versions[0];
              status('info', 'Saving...');
              o.xhr('/apps/'+encodeURIComponent(selected.name)+'/config/'+path, {
                method: method,
                json: data,
                responseType: 'json'
              }, function(e, ok) {
                if (ok = e.target.status == 200)
                  app.config = e.target.response;
                status(ok ? 'success' : 'failure', ok ? 'Saved' : 'Error');
              });
            });
          }}},
          {pre: {id: 'log', children: function(e) { log = e; }, onclick: function(e) {
            if (e.target.className == 'location') {
              var ref = e.target.textContent.split(':');
              toggle(ref[0] || selected.name, !ref[0], 'code', ref[1], 0);
            }
          }}},
          {div: {id: 'docs', children: function(e) { docs = e; }}},
          {div: {id: 'status', children: function(e) {
            var i = 0; clear = function() {
              if (!--i) e.style.display = 'none';
            };
            status = function(type, text) {
              e.style.display = 'block';
              e.className = type;
              e.textContent = text;
              setTimeout(clear, 2000);
              i++;
            };
          }}}
        ];
      }}}
    ], body);
  };
}, {html: 0, xhr: 0, jsonv: 0, docs: 0});
