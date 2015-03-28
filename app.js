simpl.add('app', function(o) {
  return function(apps, modules, offset, user, body) {
    Object.keys(apps).forEach(function(name) {
      apps[name].forEach(function(version, i, app) {
        app[i] = {minor: version, log: []};
      });
    });
    Object.keys(modules).forEach(function(name) {
      modules[name].forEach(function(version, i, module) {
        module[i] = {minor: version};
      });
    });
    var appList, moduleList, selected, code, config, major, minor, del, dependencies, search, suggest, timeline, history, log, docs, status, feed, server, unload,
        icons = {}, dom = o.html.dom, boilerplate = 'function(modules) {\n  \n}';
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
    var connect = function(host) {
      if (!window.EventSource) return status('failure', 'EventSource is not supported in this browser', true);
      if (feed) feed.close();
      status();
      server = host || undefined;
      appList.classList.add('disabled');
      Object.keys(apps).forEach(function(app) {
        apps[app].forEach(function(entry) {
          entry.tab.classList.remove('running');
          entry.running = false;
          entry.log = [];
        });
      });
      if (selected && selected.app)
        log.innerHTML = '';
      feed = new EventSource(host ? '/servers/'+encodeURIComponent(host)+'/activity' : '/activity');
      feed.onmessage = function(e) {
        try { var message = JSON.parse(e.data); } catch (e) { return; }
        if (message.state) {
          Object.keys(message.state).forEach(function(app) {
            if (!apps[app]) return;
            message.state[app].forEach(function(version) {
              if (app = apps[app][version]) {
                app.tab.classList.add('running');
                app.running = true;
              }
            });
          });
          if (selected && selected.app)
            toggle(selected.name, selected.version, true, selected.panel == 'log' && !selected.entry.running ? 'code' : selected.panel);
          return appList.classList.remove('disabled');
        }
        var data = message.data || {},
            entry = (apps[data.app] || {})[data.version];
        if (!entry) return;
        switch (message.event) {
          case 'error':
            entry.running = false;
            entry.tab.classList.add(data.level = 'error');
            entry.tab.classList.remove('running');
            data.message = [data.message];
          case 'log':
            if (entry.log.push(message = {
              level: data.level == 'log' ? 'debug' : data.level,
              message: data.message,
              module: data.module ? data.module.name : '',
              version: data.module ? data.module.version : '',
              line: data.module ? data.line : data.line > offset ? data.line-offset : null
            }) > 1000) entry.log.shift();
            if (selected && selected.entry == entry) {
              var scroll = body.classList.contains('show-log') && body.scrollHeight - body.scrollTop == document.documentElement.clientHeight;
              dom(logLine(message), log);
              if (scroll) body.scrollTop = body.scrollHeight;
            }
            break;
          case 'run':
          case 'stop':
            entry.running = message.event == 'run';
            entry.tab.classList[entry.running ? 'add' : 'remove']('running');
            entry.tab.classList.remove('error');
            if (entry.running) {
              entry.log = [];
              if (selected && selected.entry == entry)
                log.textContent = '';
            }
            break;
        }
      };
      feed.onerror = function() {
        status('failure', 'Connection lost; please refresh', true);
        feed.close();
        feed = null;
      };
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
    var handler = function(action, name, version) {
      var entry = apps[name][version];
      return function(e) {
        e.stopPropagation();
        var button = this;
        button.disabled = true;
        if (feed && feed.readyState == 2)
          connect(server);
        o.xhr('/', {
          method: 'POST',
          json: {action: action, app: name, version: version, server: server}
        }, function(e) {
          button.disabled = false;
          if (e.target.status != 200)
            return status('failure', 'Command failed');
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
    var toggle = function(name, version, app, panel, ln, ch, refresh) {
      var versions = (app ? apps : modules)[name],
          entry = versions[version],
          origPanel = panel;
      if (selected) body.classList.remove('show-'+selected.panel);
      if (!selected || selected.entry != entry || refresh) {
        if (selected) {
          selected.entry.tab.classList.remove('selected');
          body.classList.remove(selected.app ? 'show-app' : 'show-module');
        }
        body.classList.add(app ? 'show-app' : 'show-module');
        if ('code' in entry) {
          code.swapDoc(entry.doc);
          config.update(entry.config || null);
          dependencies(entry.dependencies);
          search.value = '';
          suggest();
          del.style.display = entry.minor ? 'none' : 'inline-block';
          major.parentNode.style.display = entry.minor ? 'inline-block' : 'none';
          major.textContent = 'Publish v'+(versions.length+1)+'.0';
          minor.textContent = 'Publish v'+(version+1)+'.'+entry.minor;
          timeline(name, version, app);
          if (app) dom(entry.log.map(logLine), log, true);
          else docs(name, entry.code);
        } else if (!refresh) {
          entry.tab.classList.add(panel = 'loading');
          o.xhr(url(app, name, version), {responseType: 'json'}, function(e) {
            try {
              if (e.target.status != 200) throw 'error';
              var response = e.target.response;
              if (typeof response != 'object')
                response = JSON.parse(response);
              entry.doc = CodeMirror.Doc(response.code, {name: 'javascript'});
              entry.code = response.code;
              entry.config = response.config;
              entry.dependencies = response.dependencies;
              entry.published = response.published;
              entry.tab.classList.remove('error', 'loading');
              if (selected && entry == selected.entry)
                toggle(name, version, app, origPanel, ln, ch, true);
            } catch (e) {
              entry.tab.classList.remove('loading');
              entry.tab.classList.add('error');
              if (selected && entry == selected.entry) {
                entry.tab.classList.remove('selected');
                body.classList.remove('show-'+panel);
                selected = null;
              }
              return status('failure', 'Error retrieving '+(app ? 'app' : 'module'));
            }
          });
        }
        entry.tab.classList.add('selected');
        selected = {name: name, version: version, app: app, entry: entry};
      }
      var first = app ? entry.running ? 'log' : 'code' : 'docs',
          next = {loading: first, settings: first, code: 'settings', log: 'code', docs: 'code'}[selected.panel = panel = panel || first];
      body.classList.add('show-'+panel);
      body.scrollTop = panel == 'log' ? body.scrollHeight : 0;
      entry.view.className = 'view '+next;
      entry.view.title = 'Show '+next[0].toUpperCase()+next.slice(1);
      if (panel == 'code') {
        code.refresh();
        if (ln != null) {
          code.scrollIntoView({line: ln-1, ch: ch});
          var line = code.addLineClass(ln-1, 'background', 'current');
          setTimeout(function() {
            entry.doc.removeLineClass(line, 'background', 'current');
          }, 2000);
        }
      }
    };
    var publish = function(upgrade) {
      var current = selected,
          entry = selected.entry,
          published = entry.published.slice(-1).pop();
      if (Object.keys(entry.dependencies).some(function(name) { return entry.dependencies[name] < 0; }))
        return alert('All dependencies must be published module versions');
      if (published && entry.code == published.code &&
          JSON.stringify(entry.config) == JSON.stringify(published.config) &&
          JSON.stringify(entry.dependencies) == JSON.stringify(published.dependencies))
        return alert('No changes to publish');
      status('info', 'Publishing...');
      o.xhr(upgrade ? (current.app ? '/apps/' : '/modules/')+encodeURIComponent(current.name)+'?source='+current.version : url(), {method: 'POST'}, function(e) {
        if (e.target.status != 200)
          return status('failure', 'Error publishing new version');
        status('success', 'Published');
        var versions = (current.app ? apps : modules)[current.name],
            version = upgrade
              ? versions.push(current.app ? {minor: 1, log: []} : {minor: 1})
              : 'v'+(current.version+1)+'.'+(entry.minor++);
        if (upgrade) {
          (current.app ? appList : moduleList).insertBefore(
            dom(li(current.name, version-1, 1, current.app)),
            versions[version-2].tab.nextSibling);
          major.textContent = 'Publish v'+(version+1)+'.0';
        } else {
          entry.published.push(current.app
            ? {code: entry.code, config: entry.config, dependencies: entry.dependencies}
            : {code: entry.code, dependencies: entry.dependencies});
          entry.tab.lastChild.title = current.name+' '+version;
          entry.tab.lastChild.lastChild.textContent = version;
          timeline(version);
          major.parentNode.style.display = 'inline-block';
          major.textContent = 'Publish v'+(versions.length+1)+'.0';
          minor.textContent = 'Publish v'+(current.version+1)+'.'+entry.minor;
        }
        major.parentNode.style.display = 'inline-block';
        del.style.display = 'none';
      });
    };
    var li = function(name, major, minor, app) {
      var entry = (app ? apps : modules)[name][major],
          version = minor ? 'v'+(major+1)+'.'+(minor-1) : '';
      return {li: function(elem) {
        entry.tab = elem;
        elem.onclick = function(e) {
          if (!this.classList.contains('selected'))
            toggle(name, major, app);
        };
        return [
          {div: {className: 'controls', children: [
            {button: {className: 'view', onclick: function() { toggle(name, major, app, this.className.replace(/\s*view\s*/, '')); }, children: function(e) {
              entry.view = e;
              return [app || icons.info, icons.code, icons.settings, app && icons.log];
            }}},
            app && {button: {className: 'run', title: 'Run', onclick: handler('run', name, major), children: icons.run}},
            app && {button: {className: 'restart', title: 'Restart', onclick: handler('restart', name, major), children: icons.restart}},
            app && {button: {className: 'stop', title: 'Stop', onclick: handler('stop', name, major), children: icons.stop}}
          ]}},
          {span: {
            className: 'name',
            title: version ? name+' '+version : name,
            children: [icons.loading, icons.error, name, {span: version}]
          }}
        ];
      }};
    };
    dom([
      {nav: [user
        ? [ {div: {className: 'user', children: [
              {img: {src: 'http://www.gravatar.com/avatar/'+md5(user.email.toLowerCase())}},
              {a: {className: 'logout', href: '/logout', title: 'Log Out', children: icons.logout}},
              user.name
            ]}},
            {div: {className: 'servers localhost', children: [
              {span: [icons.laptop, icons.network]},
              {select: function(elem) {
                elem.disabled = true;
                elem.onchange = function() {
                  this.parentNode.className = this.value ? 'servers' : 'servers localhost';
                  connect(this.value);
                };
                o.xhr('/servers', {responseType: 'json'}, function(e) {
                  elem.disabled = false;
                  e = e.target.response;
                  if (!e || !e.length) return;
                  dom(e.map(function(server) {
                    return {option: {value: server.id, children: server.id+'@'+server.ip}};
                  }), elem);
                });
                return [
                  {option: {value: '', children: 'Localhost'}},
                  {option: {value: 'test', children: 'Test Server'}}
                ];
              }}
            ]}}]
        : {div: {className: 'home', onclick: function() {
            if (!selected) return;
            selected.entry.tab.classList.remove('selected');
            selected = body.className = null;
          }, children: [
            {div: {className: 'controls', children: {button: {className: 'settings', title: 'Settings', children: icons.settings}}}},
            'Simpl.js'
          ]}},
        {h2: 'Apps'},
        {div: {className: 'form', children: [
          {input: {type: 'text', placeholder: 'New App', onkeyup: function(e) {
            if (e.keyCode == 13) this.nextSibling.click();
          }}},
          {button: {title: 'Add', children: icons.add, onclick: function() {
            var field = this.previousSibling,
                name = field.value;
            field.value = '';
            if (!name || apps[name]) {
              field.focus();
              alert(name ? 'App name taken' : 'Please enter app name');
            } else {
              apps[name] = [{minor: 0, code: boilerplate, config: {}, dependencies: {}, doc: CodeMirror.Doc(boilerplate, {name: 'javascript'}), log: []}];
              dom(li(name, 0, null, true), appList);
              toggle(name, 0, true);
              code.setCursor(1, 2);
              code.focus();
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
          {input: {type: 'text', placeholder: 'New Module', onkeyup: function(e) {
            if (e.keyCode == 13) this.nextSibling.click();
          }}},
          {button: {title: 'Add', children: icons.add, onclick: function() {
            var field = this.previousSibling,
                name = field.value;
            field.value = '';
            if (!name || modules[name]) {
              field.focus();
              alert(name ? 'Module name taken' : 'Please enter module name');
            } else {
              modules[name] = [{minor: 0, code: boilerplate, dependencies: {}, doc: CodeMirror.Doc(boilerplate, {name: 'javascript'})}];
              dom(li(name, 0), moduleList);
              toggle(name, 0, false, 'code');
              code.setCursor(1, 2);
              code.focus();
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
        {button: {className: 'toggle', children: [icons.left, icons.right], onclick: function() {
          body.classList.toggle('collapsed');
          code.refresh();
        }}}
      ]},
      {div: {id: 'main', children: [
        {div: {id: 'home', children: [
          {h1: 'Simpl.js'},
          {p: ['Simpl.js makes it easy to develop software that runs in your browser with access to low-level system APIs. ', {strong: 'Apps'}, ' run in separate WebWorker threads with ', {code: 'modules'}, ' and ', {code: 'config'}, ' objects as specified in the app\'s ', icons.settings,'settings panel. Any ', {code: 'console'}, ' output is streamed to the app\'s ', icons.log,'log panel. ', {strong: 'Modules'}, ' are libraries imported as dependencies by apps and other modules. Module documentation is generated using the ', {code: 'docs'}, ' module syntax.']},
          {p: 'Apps and modules can be published with a major-minor versioning scheme. Major versions can be developed in parallel, while minor versions represent backward-compatible incremental changes.'},
          {p: 'Browse the core modules and run the included demo apps to get started.'},
          {form: {method: 'post', action: '/restore', children: [
            {button: {className: 'revert', type: 'submit', name: 'scope', value: 'modules', children: [icons.revert, 'Restore Modules'], onclick: function(e) {
              if (!confirm('This will delete and restore all preinstalled modules in your workspace. Are you sure?'))
                e.preventDefault();
            }}}, ' ',
            {button: {className: 'revert', type: 'submit', name: 'scope', value: 'full', children: [icons.revert, 'Reset Workspace'], onclick: function(e) {
              if (!confirm('This will delete your entire workspace and restore default apps and modules. Are you sure?'))
                e.preventDefault();
            }}}
          ]}}
        ]}},
        {div: {id: 'code', children: function(e) {
          code = CodeMirror(e, {
            value: selected && selected.entry.doc || '',
            lineNumbers: true,
            matchBrackets: true,
            highlightSelectionMatches: true
          });
          code.on('changes', function(e) {
            selected.entry.dirty = true;
            selected.entry.tab.classList.add('changed');
          });
          CodeMirror.commands.save = function() {
            var entry = selected.entry,
                code = entry.doc.getValue();
            status('info', 'Saving...');
            o.xhr(url(), {method: 'PUT', data: code}, function(e) {
              if (e.target.status != 200)
                return status('failure', 'Error saving document');
              status('success', 'Saved');
              entry.tab.classList.remove('changed');
              entry.code = code;
              if (selected && !selected.app && selected.entry == entry)
                docs(selected.name, entry.code);
            });
          };
        }}},
        {div: {id: 'settings', children: [
          {section: {id: 'actions', children: [
            {button: {className: 'publish', children: [user ? icons.publish : icons.upgrade, {span: function(e) { major = e; }}], onclick: function() { publish(true); }}}, {br: null},
            {button: {className: 'publish', children: [user ? icons.publish : icons.upgrade, {span: function(e) { minor = e; }}], onclick: function() { publish(); }}}, {br: null},
            {button: {className: 'delete', children: function(e) { del = e; return [icons.delete, 'Delete']; }, onclick: function() {
              var button = this,
                  current = selected,
                  type = selected.app ? 'app' : 'module';
              if (!confirm('Are you sure you want to delete this '+type+'?')) return;
              button.disabled = true;
              status('info', 'Deleting '+type+'...');
              o.xhr(url(), {method: 'DELETE'}, function(e) {
                button.disabled = false;
                if (e.target.status != 200)
                  return status('failure', 'Error deleting '+type);
                status('success', 'Deleted');
                var items = current.app ? apps : modules,
                    versions = items[current.name];
                delete versions[current.version];
                if (!versions.length) delete items[current.name];
                current.entry.tab.parentNode.removeChild(current.entry.tab);
                if (selected && selected.entry == current.entry) {
                  body.classList.remove(selected.app ? 'show-app' : 'show-module', 'show-'+selected.panel);
                  selected = null;
                }
              });
            }}}
          ]}},
          {section: {id: 'dependencies', children: [
            {h2: 'Dependencies'},
            {div: {className: 'search', children: [
              icons.search,
              {input: {type: 'text', placeholder: 'Search Modules', children: function(e) { search = e; }, onkeydown: function(e) {
                if (e.keyCode != 9 || e.shiftKey) return;
                var second = this.nextSibling.firstChild;
                if (second = second && second.nextSibling.firstChild) {
                  e.preventDefault()
                  second.focus();
                }
              }, onkeyup: function(e) {
                if (e.keyCode != 13) {
                  var results = [], value = this.value;
                  if (value) Object.keys(modules).forEach(function(name) {
                    if (~name.indexOf(value) && (selected.app || name != selected.name))
                      modules[name].forEach(function(version, i) {
                        results.push({name: name, version: -i-1}); // current
                        if (version.minor) results.push({name: name, version: i}); // published
                      });
                  });
                  suggest(results);
                } else if (this.nextSibling.firstChild) {
                  this.nextSibling.firstChild.firstChild.click();
                }
              }}},
              {ul: {className: 'suggest', children: function(e) {
                suggest = function(matches) {
                  dom(matches && matches.map(function(match) {
                    var v = match.version+1,
                        module = modules[match.name];
                    if (v < 1 && module[0] && module[0].minor) v--;
                    return {li: [{button: {className: 'name', children: [match.name, {span: v ? v > 0 ? 'v'+v : 'v'+-v+' current' : ''}], onclick: function() {
                      var entry = selected.entry;
                      search.value = '';
                      suggest();
                      o.xhr(url()+'/dependencies', {method: 'POST', json: match}, function(e) {
                        if (e.target.status != 200)
                          return status('failure', 'Error updating dependencies');
                        entry.dependencies[match.name] = match.version;
                        if (selected && selected.entry == entry)
                          dependencies(entry.dependencies);
                      });
                    }}}]};
                  }), e, true);
                };
              }}}
            ]}},
            {ul: function(e) {
              dependencies = function(values) {
                dom(Object.keys(values).map(function(name) {
                  var v = values[name]+1,
                      module = modules[name];
                  if (v < 1 && module[0] && module[0].minor) v--;
                  return {li: {className: 'module', children: [
                    {button: {className: 'delete', title: 'Remove', children: '×', onclick: function() {
                      var button = this,
                          entry = selected.entry;
                      button.disabled = true;
                      o.xhr(url()+'/dependencies/'+encodeURIComponent(name), {method: 'DELETE'}, function(e) {
                        button.disabled = false;
                        if (e.target.status != 200)
                          return status('failure', 'Error updating dependencies');
                        delete entry.dependencies[name];
                        if (selected && selected.entry == entry)
                          button.parentNode.parentNode.removeChild(button.parentNode);
                      });
                    }}},
                    {span: {className: 'name', children: [name, {span: v ? v > 0 ? 'v'+v : 'v'+-v+' current' : ''}]}}
                  ]}};
                }), e, true);
              };
            }}
          ]}},
          {section: {id: 'config', children: [
            {h2: 'Configuration'},
            {pre: function(e) {
              config = o.jsonv(e, selected ? selected.entry.config : null, function(method, path, data) {
                var entry = selected.entry,
                    config = entry.config;
                path.split('/').map(decodeURIComponent).forEach(function(key, i, path) {
                  if (Array.isArray(config)) key = parseInt(key, 10);
                  if (i < path.length-1) config = config[key];
                  else if (method == 'put') config[key] = data;
                  else if (method == 'insert') config.splice(key, 0, data);
                  else if (typeof key == 'number') config.splice(key, 1);
                  else delete config[key];
                });
                o.xhr(url()+'/config', {method: 'PUT', json: entry.config}, function(e) {
                  if (e.target.status != 200)
                    status('failure', 'Error updating configuration');
                });
              });
            }}
          ]}},
          {section: {id: 'history', children: [
            {h2: 'History'},
            {ul: {className: 'timeline', children: function(elem) {
              var first, last, diff = function(dmp) {
                return function(versions) {
                  var diff = dmp.diff_main(versions[1], versions[0]);
                  dmp.diff_cleanupSemantic(diff);
                  return diff;
                };
              }(new diff_match_patch);
              elem.onclick = function(e) {
                var target = e.target.tagName == 'SPAN' ? e.target.parentNode : e.target;
                if (target == first) {
                  first = last;
                  last = null;
                } else if (target == last) {
                  last = null;
                } else if (first) {
                  last = target;
                } else {
                  first = target;
                }
                var versions = [], span = first && last;
                for (var i = 0, node = this.firstChild; node; node = node.nextSibling, i++) {
                  if (node == first || node == last) {
                    versions.push(i ? selected.entry.published[selected.entry.published.length-i].code : selected.entry.code);
                    node.className = span ? versions.length > 1 ? 'last selected' : 'first selected' : 'selected';
                  } else {
                    node.className = span && versions.length == 1 ? 'inner' : '';
                  }
                }
                if (span) {
                  // TODO: collapse lines differing only by trailing and leading \n chunks
                  var line = {change: 0, spans: []}, section = {lines: []},
                      ins = [], insLines = [], gap = [], sections = [], i = 0, a = 1, b = 1;
                  diff(versions).forEach(function(chunk) {
                    // current line
                    var change = chunk[0], chunks = chunk[1].split('\n');
                    if (!section.change) section.change = change;
                    if (!line.change && change) {
                      line.change = -1;
                      ins = line.spans.slice();
                    }
                    chunk = {change: change, text: chunks.shift()};
                    if (change <= 0) line.spans.push(chunk);
                    if (line.change && change >= 0) ins.push(chunk);
                    chunks.forEach(function(chunk) {
                      // new line
                      chunk = [{change: change, text: chunk}];
                      if (change >= 0 && ins.length) {
                        insLines.push({change: 1, number: [!line.change && a, b++], spans: ins});
                        ins = change ? chunk : [];
                      }
                      if (line.change) {
                        i = 0;
                      } else if (i == 3) {
                        if (section.change) {
                          if (gap.length) {
                            sections.push({change: 0, lines: gap});
                            gap = [];
                          }
                          sections.push(section);
                          section = {change: change, lines: []};
                          i = 1;
                        } else {
                          gap.push(section.lines.shift());
                        }
                      } else if (!i++) {
                        section.lines = section.lines.concat(insLines);
                        insLines = [];
                      }
                      if (change <= 0 && line.spans.length) {
                        section.lines.push({change: line.change, number: [a++, !line.change && b++], spans: line.spans});
                        line = {change: change && -1, spans: chunk};
                      }
                    });
                  });
                  if (ins.length) insLines.push({change: 1, number: [!line.change && a, b], spans: ins});
                  if (line.spans.length) (line.change ? section.lines : insLines).push({change: line.change, number: [a, !line.change && b], spans: line.spans});
                  section.lines = section.lines.concat(insLines);
                  if (!section.change) gap = gap.concat(section.lines);
                  if (gap.length) sections.push({change: 0, lines: gap});
                  if (section.change && section.lines.length) sections.push(section);
                  var ellipses = [a, b].map(function(n) { return String(n).replace(/./g, '·'); });
                  history(sections.map(function(section) {
                    if (!section.change) section.lines.push(null);
                    return {tbody: {className: section.change ? 'changed' : 'unchanged', children: section.lines.map(function(line) {
                      return line ? {tr: {className: ['delete', 'unchanged', 'insert'][line.change+1], children: [
                        {td: {className: 'line', children: line.number[0]}},
                        {td: {className: 'line', children: line.number[1]}},
                        {td: line.spans.map(function(span) {
                          return span.change ? {span: span.text} : span.text;
                        })}
                      ]}} : {tr: {className: sections.length == 1 ? 'placeholder unchanged' : 'placeholder', children: [
                        {td: {className: 'line', children: ellipses[0]}},
                        {td: {className: 'line', children: ellipses[1]}},
                        {td: sections.length == 1 ? 'No Changes' : 'Expand'}
                      ]}};
                    })}};
                  }));
                } else {
                  history(versions[0] != null && {tbody: versions[0].split('\n').map(function(line, i) {
                    return {tr: [{td: {className: 'line', children: i+1}}, {td: line}]};
                  })});
                }
              };
              timeline = function(name, version, app) {
                if (arguments.length == 1)
                  return elem.insertBefore(
                    dom({li: [{span: null}, 'Current']}),
                    dom([{span: null}, name], elem.firstChild, true));
                first = last = null;
                history();
                var minor = (app ? apps : modules)[name][version].minor;
                dom(new Array(minor+1).join().split(',').map(function(x, i) {
                  return {li: [{span: null}, i ? 'v'+(version+1)+'.'+(minor-i) : 'Current']};
                }), elem, true);
              };
            }}},
            {table: function(e) {
              history = function(data) { dom(data, e, true); };
              e.onclick = function(e) {
                var target = e.target;
                while (target != this && target.tagName != 'TBODY') target = target.parentNode;
                if (target.className == 'unchanged') target.className += ' expanded';
              };
            }}
          ]}}
        ]}},
        {pre: {id: 'log', children: function(e) { log = e; }, onclick: function(e) {
          if (e.target.className == 'location') {
            var ref = e.target.dataset,
                name = ref.module || selected.name,
                version = ref.version ? -parseInt(ref.version, 10)-1 : selected.version;
            if (version >= 0)
              toggle(name, version, !ref.module, 'code', ref.line, 0);
          }
        }}},
        {div: {id: 'docs', children: function(e) {
          docs = function(name, code) {
            dom([{h1: name}, o.docs.generateDom(code)], e, true);
          };
        }}},
        {div: {id: 'status', children: function(e) {
          var i = 0; clear = function() {
            if (!--i) e.style.display = 'none';
          };
          status = function(type, text, persist) {
            if (unload) return;
            if (!type) return e.style.display = 'none';
            e.style.display = 'block';
            e.className = type;
            e.textContent = text;
            if (!persist) {
              setTimeout(clear, 2000);
              i++;
            }
          };
        }}}
      ]}}
    ], body);
    connect();
    window.onbeforeunload = function() {
      unload = true;
    };
  };
}, 0, {html: 0, xhr: 0, jsonv: 0, docs: 0});
