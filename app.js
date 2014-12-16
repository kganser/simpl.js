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
    var appList, moduleList, selected, code, config, major, minor, dependencies, search, suggest, log, docs, line, status,
        dom = o.html.dom;
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
            dom(logLine(message), log);
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
            dom(li(data.name, version-1, 0, data.app)),
            versions[version-2].tab.nextSibling);
          break;
        case 'publish':
          entry.minor = entry.minor == null ? 0 : entry.minor+1;
          entry.published = data.app ? {code: entry.code, config: entry.config} : {code: entry.code};
          var version = (data.version+1)+'.'+entry.minor;
          entry.tab.lastChild.title = data.name+' '+version;
          entry.tab.lastChild.lastChild.textContent = version;
          break;
        case 'config':
          entry.config = data.object;
          if (selected && selected.entry == entry)
            config.update(entry.config);
          break;
        case 'dependencies':
          entry.dependencies = data.object;
          if (selected && selected.entry == entry)
            deps(entry.dependencies);
          break;
      }
    };
    var url = function(app, name, version) {
      if (!arguments.length && selected) {
        app = selected.app;
        name = selected.name;
        version = selected.version;
      }
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
      dom([{h1: name}, o.docs.generateDom(code)], docs, true);
    };
    var deps = function(modules) {
      dom(Object.keys(modules).map(function(module) {
        var version = modules[module];
        return {li: {className: 'module', children: [
          {button: {className: 'delete', title: 'Remove', children: '×', onclick: function() {
            var button = this;
            button.disabled = true;
            o.xhr(url()+'/dependencies/'+encodeURIComponent(module), {method: 'DELETE'}, function(e) {
              button.disabled = false;
              if (e.target.status != 200)
                status('failure', 'Error updating dependencies');
            });
          }}},
          {span: {className: 'name', children: [module, {span: !version || version}]}}
        ]}};
      }), dependencies, true);
    };
    var handler = function(action, name, version, app) {
      var entry = (app ? apps : modules)[name][version];
      return function(e) {
        e.stopPropagation();
        this.disabled = true;
        o.xhr('/', {
          method: 'POST',
          json: {action: action, app: name, version: version}
        }, function() {
          e.target.disabled = false;
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
      var versions = (app ? apps : modules)[name],
          entry = versions[version],
          refresh = entry.tab.classList.contains('loading');
      if (selected) body.classList.remove('show-'+selected.panel);
      if (!selected || selected.entry != entry || refresh) {
        if (selected) {
          selected.entry.tab.classList.remove('selected');
          body.classList.remove(selected.app ? 'show-app' : 'show-module');
          if ('code' in selected.entry && !refresh)
            selected.entry.code = code.getValue();
        }
        body.classList.add(app ? 'show-app' : 'show-module');
        if ('code' in entry) {
          selected = line = null;
          code.setOption('readOnly', false);
          code.setValue(entry.code); // TODO: use codemirror documents
          config.update(entry.config);
          deps(entry.dependencies);
          search.value = '';
          suggest();
          if (entry.minor == null) {
            major.style.display = 'none';
            minor.textContent = 'Publish 1.0';
          } else {
            major.style.display = 'inline-block';
            major.textContent = 'Publish '+(versions.length+1)+'.0';
            minor.textContent = 'Publish '+versions.length+'.'+(entry.minor+1);
          }
          if (app) dom(entry.log.map(logLine), log, true);
          else doc(name, entry.code);
          entry.tab.classList.remove('loading');
        } else if (!refresh) {
          code.setOption('readOnly', 'nocursor');
          code.setValue('');
          entry.tab.classList.add('loading');
          o.xhr(url(app, name, version), {responseType: 'json'}, function(e) {
            if (e.target.status != 200) {
              entry.tab.classList.remove('loading');
              // TODO: add failed class
              return status('failure', 'Error retrieving '+(app ? 'app' : 'module'));
            }
            var response = e.target.response;
            entry.code = response.code;
            entry.config = response.config;
            entry.dependencies = response.dependencies;
            entry.minor = response.minor;
            entry.published = response.published;
            if (entry == selected.entry) toggle(name, version, app, panel, ln, ch);
          });
        }
        entry.tab.classList.add('selected');
        selected = {name: name, version: version, app: app, entry: entry};
      }
      var first = app ? entry.running ? 'log' : 'code' : 'docs',
          next = {settings: first, code: 'settings', log: 'code', docs: 'code'}[selected.panel = panel = panel || first];
      body.classList.add('show-'+panel);
      body.scrollTop = panel == 'log' ? body.scrollHeight : 0;
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
    var publish = function(upgrade) {
      var current = selected.entry,
          published = current.published;
      if (published && current.code == published.code &&
          JSON.stringify(current.config) == JSON.stringify(published.config) &&
          JSON.stringify(current.dependencies) == JSON.stringify(published.dependencies))
        return alert('No changes to publish');
      status('info', 'Publishing...');
      o.xhr(url()+(upgrade ? '/upgrade' : '/publish'), {method: 'POST'}, function(e) {
        if (e.target.status != 200)
          return status('failure', 'Error');
        status('success', 'Published');
      });
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
            {button: {className: 'view', children: function(e) { entry.view = e; }}},
            app && {button: {className: 'run', title: 'Run', onclick: handler('run', name, major, app)}},
            app && {button: {className: 'restart', title: 'Restart', onclick: handler('restart', name, major, app)}},
            app && {button: {className: 'stop', title: 'Stop', onclick: handler('stop', name, major, app)}}
          ]}},
          {span: {
            className: 'name',
            title: version ? name+' '+version : name,
            children: [name, {span: version}]
          }}
        ];
      }};
    };
    dom([
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
              apps[name] = [{code: '', config: {}, dependencies: {}, log: []}];
              dom(li(name, 0, null, true), appList);
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
              modules[name] = [{code: "simpl.add('"+name.replace(/\\/g, '\\').replace(/'/g, "\\'")+"', function() {\n  \n});\n", dependencies: {}}];
              dom(li(name, 0), moduleList);
              toggle(name, 0, false, 'code');
            }
          }}}
        ]}},
        {ul: function(e) {
          moduleList = e;
          return Object.keys(modules).map(function(name) {
            return modules[name].map(function(module, major) {
              return li(name, major, module.minor);
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
          o.xhr(url(), {
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
          {div: {id: 'settings', children: [
            {section: {id: 'actions', children: [
              {button: {className: 'publish', onclick: function() { publish(true); }, children: function(e) { major = e; }}}, {br: null},
              {button: {className: 'publish', onclick: function() { publish(); }, children: function(e) { minor = e; }}}, {br: null},
              {button: {className: 'delete', children: 'Delete', onclick: function() {
                var button = this, type = selected.app ? 'app' : 'module';
                if (!confirm('Are you sure you want to delete this '+type+'?')) return;
                button.disabled = true;
                status('info', 'Deleting '+type);
                o.xhr(url(), {method: 'DELETE'}, function(e) {
                  button.disabled = false;
                  if (e.target.status != 200)
                    status('failure', 'Error deleting '+type);
                });
              }}}
            ]}},
            {section: {id: 'dependencies', children: [
              {h2: 'Dependencies'},
              {div: {className: 'search', children: [
                {input: {type: 'text', placeholder: 'Search Modules', children: function(e) { search = e; }, onkeyup: function() {
                  var results = [], value = this.value;
                  if (value) Object.keys(modules).forEach(function(name) {
                    if (~name.indexOf(value)) results.push.apply(results, modules[name].map(function(module, version) {
                      return {name: name, version: module.minor == null ? version-1 : version};
                    }).reverse());
                  });
                  suggest(results);
                }}},
                {ul: {className: 'suggest', children: function(e) {
                  suggest = function(modules) {
                    dom(modules && modules.map(function(module, i) {
                      return {li: [{button: {className: 'name', children: [module.name, {span: ++module.version || null}], onclick: function() {
                        search.value = '';
                        suggest();
                        o.xhr(url()+'/dependencies', {method: 'POST', json: module}, function(e) {
                          if (e.target.status != 200)
                            status('failure', 'Error updating dependencies');
                        });
                      }}}]};
                    }), e, true);
                  };
                }}}
              ]}},
              {ul: function(e) { dependencies = e; }}
            ]}},
            {section: {id: 'configuration', children: [
              {h2: 'Configuration'},
              {pre: function(e) {
                config = o.jsonv(e, selected ? selected.entry.config : null, function(method, path, data) {
                  o.xhr(url()+'/config/'+path, {method: method, json: data}, function(e) {
                    if (e.target.status != 200)
                      status('failure', 'Error updating configuration');
                  });
                });
              }}
            ]}},
            {section: {id: 'history', children: [
              {h2: 'History'}
            ]}}
          ]}},
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
