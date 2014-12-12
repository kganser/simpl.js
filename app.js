simpl.add('app', function(o) {
  return function(apps, modules, offset, body) {
    Object.keys(apps).forEach(function(name) {
      apps[name].forEach(function(version, i, app) {
        app[i] = {minor: version[0], running: version[1], log: []};
      });
    });
    Object.keys(modules).forEach(function(name) {
      modules[name].forEach(function(version, i, module) {
        module[i] = {minor: version};
      });
    });
    var appList, moduleList, selected, code, config, log, docs, line, status;
    if (window.EventSource) new EventSource('/activity').onmessage = function(e) {
      try { var message = JSON.parse(e.data); } catch (e) { return; }
      var event = message.event,
          data = message.data || {},
          versions = event in {run: 1, stop: 1, log: 1, error: 1} ? apps[data.app] : (data.app ? apps : modules)[data.name],
          entry = versions && versions[data.version];
      if (!entry) return;
      switch (event) {
        case 'log':
        case 'error':
          if (event == 'error') {
            entry.running = false;
            entry.tab.classList.add(data.level = 'error');
            data.message = [data.message];
          }
          if (entry.log.push(message = {
            level: data.level == 'log' ? 'debug' : data.level,
            message: data.message,
            module: data.module ? data.module.name : '',
            version: data.module ? data.module.version : '',
            line: data.line > offset ? data.module ? data.line : data.line-offset : null
          }) > 1000) entry.log.shift();
          if (selected && selected.entry == entry) {
            var scroll = body.classList.contains('show-log') && body.scrollHeight - body.scrollTop == document.documentElement.clientHeight;
            o.html.dom(logLine(message), log);
            if (scroll) body.scrollTop = body.scrollHeight;
          }
          break;
        case 'run':
        case 'stop':
          entry.running = event == 'run';
          entry.tab.classList[event == 'run' ? 'add' : 'remove']('running');
          entry.tab.classList.remove('error');
          if (event == 'run') {
            entry.log = [];
            if (selected && selected.entry == entry)
              log.textContent = '';
          }
          break;
        case 'delete':
          if (selected && selected.entry == entry) selected = null;
          delete versions[data.version];
          if (!versions.length) delete (data.app ? apps : modules)[data.name];
          entry.tab.parentNode.removeChild(entry.tab);
          break;
        case 'upgrade':
          var version = versions.push(data.app ? {minor: 0, log: []} : {minor: 0});
          (data.app ? appList : moduleList).insertBefore(
            o.html.dom(li(data.name, version-1, 0, data.app)),
            versions[version-2].tab.nextSibling);
          break;
        case 'publish':
          entry.minor = entry.minor == null ? 0 : entry.minor+1;
          entry.published = data.app ? {code: entry.code, config: entry.config} : {code: entry.code};
          var version = (data.version+1)+'.'+entry.minor;
          entry.tab.lastChild.title = data.name+' '+version;
          entry.tab.lastChild.lastChild.textContent = version;
          break;
      }
    };
    var url = function(app, name, version) {
      return [app ? '/apps' : '/modules', encodeURIComponent(name), version].join('/');
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
        {div: {className: 'location', children: entry.line && entry.module+':'+entry.line, dataset: {
          module: entry.module,
          version: entry.version,
          line: entry.line
        }}},
        {div: {className: 'message', children: message}}
      ]}};
    };
    var doc = function(name, code) {
      o.html.dom([{h1: name}, o.docs.generateDom(code)], docs, true);
    };
    var handler = function(action, name, version, app, entry) {
      return function(e) {
        e.stopPropagation();
        var command = action != 'delete' && {action: action, app: name, version: version};
        if (!command && !confirm('Are you sure you want to delete this '+(app ? 'app?' : 'module?'))) return;
        this.disabled = true;
        o.xhr(command ? '/' : url(app, name, version), {
          method: command ? 'POST' : 'DELETE',
          json: command
        }, function() {
          e.target.disabled = false;
          var entry = (app ? apps : modules)[name][version];
          if (!command || !entry) return;
          entry.running = action != 'stop';
          entry.tab.classList[entry.running ? 'add' : 'remove']('running');
          if (entry.running) {
            entry.log = [];
            if (selected && selected.entry == entry) {
              log.textContent = '';
              toggle(name, version, true, 'log');
            }
          }
        });
      };
    };
    var toggle = function(name, version, app, panel, ln, ch) {
      var entry = (app ? apps : modules)[name][version],
          refresh = entry.tab.classList.contains('loading');
      if (!selected || selected.entry != entry || refresh) {
        if (selected) {
          selected.entry.tab.classList.remove('selected');
          if ('code' in selected.entry && !refresh)
            selected.entry.code = code.getValue();
        }
        if ('code' in entry) {
          selected = line = null;
          code.setOption('readOnly', false);
          code.setValue(entry.code); // TODO: use codemirror documents
          config.update(entry.config);
          if (app) o.html.dom(entry.log.map(logLine), log, true);
          else doc(name, entry.code);
          entry.tab.classList.remove('loading');
        } else if (!refresh) {
          code.setOption('readOnly', 'nocursor');
          code.setValue('');
          entry.tab.classList.add('loading');
          o.xhr(url(app, name, version), {responseType: 'json'}, function(e) {
            if (e.target.status != 200) {
              entry.tab.classList.remove('loading');
              return status('failure', 'Error retrieving '+(app ? 'app' : 'module'));
            }
            var response = e.target.response;
            entry.code = response.code;
            entry.config = response.config;
            entry.minor = response.minor;
            entry.published = response.published;
            if (entry == selected.entry) toggle(name, version, app, panel, ln, ch);
          });
        }
        entry.tab.classList.add('selected');
        selected = {name: name, version: version, app: app, entry: entry};
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
    var publish = function(name, version, app) {
      return function() {
        var entity = (app ? apps : modules)[name][version];
        if (entity.published && entity.code == entity.published.code && JSON.stringify(entity.config) == JSON.stringify(entity.published.config))
          return alert('No changes to publish');
        status('info', 'Publishing...');
        o.xhr(url(app, name, version)+'/publish', {method: 'POST'}, function(e) {
          if (e.target.status != 200)
            return status('failure', 'Error');
          status('success', 'Published');
        });
      };
    };
    var li = function(name, major, minor, app) {
      var entry = (app ? apps : modules)[name][major],
          version = minor == null ? '' : (major+1)+'.'+minor;
      return {li: function(elem) {
        entry.tab = elem;
        elem.onclick = function(e) {
          toggle(name, major, app, (e.target == entry.view) && e.target.className.replace(/\s*view\s*/, ''));
        };
        if (entry.running)
          elem.classList.add('running');
        return [
          {div: {className: 'controls', children: [
            {button: {className: 'publish', title: 'Publish', onclick: publish(name, major, app)}},
            {button: {className: 'view', children: function(e) { entry.view = e; }}},
            app && {button: {className: 'run', title: 'Run', onclick: handler('run', name, major, app)}},
            app && {button: {className: 'restart', title: 'Restart', onclick: handler('restart', name, major, app)}},
            app && {button: {className: 'stop', title: 'Stop', onclick: handler('stop', name, major, app)}},
            {button: {className: 'delete', title: 'Delete', onclick: handler('delete', name, major, app)}}
          ]}},
          {span: {
            className: 'name',
            title: version ? name+' '+version : name,
            children: [name, {span: version}]
          }}
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
              apps[name] = [{code: '', config: {}, log: []}];
              o.html.dom(li(name, true), appList);
              toggle(name, 0, true);
            }
          }}}
        ]}},
        {ul: function(e) {
          appList = e;
          return Object.keys(apps).map(function(name) {
            return apps[name].map(function(app, major) {
              return li(name, major, app.minor, true);
            });
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
              modules[name] = [{code: "simpl.add('"+name.replace(/\\/g, '\\').replace(/'/g, "\\'")+"', function() {\n  \n});\n"}];
              o.html.dom(li(name, false), moduleList);
              toggle(name, 0, false, 'code');
            }
          }}}
        ]}},
        {ul: function(e) {
          moduleList = e;
          return Object.keys(modules).map(function(name) {
            return modules[name].map(function(module, major) {
              return li(name, major, module.minor, false);
            });
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
          var entry = selected.entry;
          status('info', 'Saving...');
          o.xhr(url(selected.app, selected.name, selected.version), {
            method: 'POST',
            data: entry.code = code.getValue()
          }, function(e) {
            if (e.target.status != 200)
              return status('failure', 'Error');
            status('success', 'Saved');
            entry.tab.classList.remove('changed');
            if (selected && !selected.app && selected.entry == entry)
              doc(selected.name, entry.code);
          });
        };
        return [
          {pre: {id: 'config', className: 'json', children: function(e) {
            config = o.jsonv(e, selected ? selected.entry.config : null, function(method, path, data) {
              var app = selected.entry;
              status('info', 'Saving...');
              o.xhr(url(true, selected.name, selected.version)+'/config/'+path, {
                method: method,
                json: data,
                responseType: 'json'
              }, function(e) {
                if (e.target.status != 200)
                  return status('failure', 'Error');
                status('success', 'Saved');
                app.config = e.target.response;
              });
            });
          }}},
          {pre: {id: 'log', children: function(e) { log = e; }, onclick: function(e) {
            if (e.target.className == 'location') {
              var ref = e.target.dataset,
                  name = ref.module || selected.name,
                  version = ref.version ? parseInt(ref.version, 10) : selected.version;
              toggle(name, version, !ref.module, 'code', ref.line, 0);
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
}, 0, {html: 0, xhr: 0, jsonv: 0, docs: 0});
