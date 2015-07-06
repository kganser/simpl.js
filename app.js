simpl.add('app', function(o) {

  (function(list, rm) {
    list.add('a', 'b');
    if (!list.contains('b'))
      DOMTokenList.prototype.remove = function() { Array.prototype.forEach.call(arguments, rm.bind(this)); };
  }(document.createElement('div').classList, DOMTokenList.prototype.remove));
  
  return function(apps, modules, user, token, body) {
    Object.keys(apps).forEach(function(name) {
      var versions = {},
          n = name.split('@');
      Object.keys(apps[name]).forEach(function(v) {
        versions[n[1] ? v : +v+1] = {minor: apps[name][v], log: []};
      });
      apps[name] = {name: n[0], source: n[1], versions: versions};
    });
    Object.keys(modules).forEach(function(name) {
      var versions = {},
          n = name.split('@');
      Object.keys(modules[name]).forEach(function(v) {
        versions[n[1] ? v : +v+1] = {minor: modules[name][v]};
      });
      modules[name] = {name: n[0], source: n[1], versions: versions};
    });
    var appList, moduleList, selected, code, config, major, minor, remove, dependencies, search, suggest, timeline, history, log, docs, status, connect, send, servers,
        icons = {}, dom = o.html.dom, boilerplate = 'function(modules) {\n  \n}';
    // Entypo pictograms by Daniel Bruce — www.entypo.com
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
    var url = function(e, source) {
      return (e.app ? '/apps/' : '/modules/')+encodeURIComponent(e.id)+(source ? '?source=' : '/')+e.version;
    };
    var request = function(path, options, callback) {
      if (typeof options == 'function') {
        callback = options;
        options = {};
      }
      if (token) path += (~path.indexOf('?') ? '&sid=' : '?sid=')+token;
      options.responseType = 'json';
      o.xhr(path, options, callback);
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
        {div: {className: 'location', children: entry.module+(entry.line ? ':'+entry.line : ''), dataset: {
          module: entry.module,
          version: entry.version,
          line: entry.line
        }}},
        {div: {className: 'message', children: message}}
      ]}};
    };
    var navigate = function(name, version, app, panel, ln, refresh) { // TODO: remove `refresh`
      var record = (app ? apps : modules)[name];
      if (record) {
        var entry = record.versions[version],
            first = app ? entry.running ? 'log' : 'code' : 'docs',
            next = {settings: first, code: 'settings'}[panel = panel || first] || 'code';
        if (selected) body.classList.remove('show-'+selected.panel);
        if (selected && selected.entry == entry && !refresh) {
          selected.panel = panel;
        } else {
          if (selected) {
            selected.entry.tab.classList.remove('selected');
            body.classList.remove(selected.app ? 'show-app' : 'show-module');
          }
          selected = {id: name, name: record.name, source: record.source, version: version, app: app, entry: entry, panel: panel};
          body.classList.add(app ? 'show-app' : 'show-module');
          entry.tab.classList.add('selected');
          if ('code' in entry) {
            code.swapDoc(entry.doc);
            config.update(entry.config || null);
            dependencies(entry.dependencies);
            search.value = '';
            suggest();
            remove.parentNode.style.display = record.source || !entry.minor ? 'inline-block' : 'none';
            major.parentNode.style.display = record.source || !entry.minor ? 'none' : 'inline-block';
            minor.parentNode.style.display = record.source ? 'none' : 'inline-block';
            remove.textContent = record.source ? 'Remove' : 'Delete';
            major.textContent = 'Publish v'+(Object.keys(record.versions).length+1)+'.0';
            minor.textContent = 'Publish v'+version+'.'+entry.minor;
            timeline(record, version);
            if (app) dom(entry.log.map(logLine), log, true);
            else docs(name, entry.code);
          } else if (!refresh && !entry.tab.classList.contains('loading')) {
            entry.tab.classList.add(selected.panel = 'loading');
            request(url(selected), function(e) {
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
              } catch (e) {
                entry.tab.classList.remove('loading');
                entry.tab.classList.add('error');
                if (selected && selected.entry == entry) {
                  entry.tab.classList.remove('selected');
                  body.classList.remove('show-loading');
                  selected = null;
                }
                return status('failure', 'Error retrieving '+(app ? 'app' : 'module'));
              }
              if (selected && selected.entry == entry)
                navigate(name, version, app, panel, ln, true);
            });
          }
        }
        body.classList.add('show-'+selected.panel);
        body.scrollTop = selected.panel == 'log' ? body.scrollHeight : 0;
        entry.view.className = 'view '+next;
        entry.view.title = 'Show '+next[0].toUpperCase()+next.substr(1);
        if (selected.panel == 'code') {
          code.refresh();
          if (ln != null) {
            code.scrollIntoView({line: ln-1, ch: 0});
            var line = code.addLineClass(ln-1, 'background', 'current');
            setTimeout(function() {
              entry.doc.removeLineClass(line, 'background', 'current');
            }, 2000);
          }
        }
      } else if (selected) {
        selected.entry.tab.classList.remove('selected');
        selected = body.className = null;
      }
      if (!name == !record && !refresh) {
        var path = record ? url(selected)+'/'+panel : '/';
        if (location.pathname != path) window.history.pushState(null, null, path);
        document.title = record ? record.name : 'Simpl.js';
      }
    };
    var fork = function(callback) {
      if (!selected.source) return callback();
      var current = selected,
          entry = selected.entry,
          group = selected.app ? apps : modules,
          type = selected.app ? 'app' : 'module',
          name = selected.name in group ? '' : selected.name,
          message = 'This change requires you to copy this '+type+' to your account. Please give it a unique name within your existing '+type+'s to continue.';
      do {
        name = prompt(message, name);
        message = name ? ~name.indexOf('@') ? 'Illegal character: @' : name in group ? 'Name already exists.' : false : 'Please enter a name.';
      } while (name != null && message);
      if (!name) return;
      status('info', 'Copying linked '+type+'...');
      request(url(selected)+'?name='+encodeURIComponent(name), {method: 'POST'}, function(e) {
        if (e.target.status != 200)
          return status('failure', 'Error copying linked '+type);
        group[name] = {name: name, versions: {1: {
          minor: 0,
          code: entry.code,
          config: entry.config,
          dependencies: entry.dependencies,
          doc: entry.doc,
          log: []
        }}};
        // TODO: move to position
        dom(li(name, 1, 0, current.app), current.app ? appList : moduleList);
        entry.tab.parentNode.removeChild(entry.tab);
        navigate(name, 1, current.app, current.panel);
        delete group[current.id];
        callback();
      });
    };
    var publish = function(upgrade) {
      var current = selected,
          entry = selected.entry,
          published = entry.published;
      if (!published || entry.dirty)
        return alert('Please save your code before publishing. Use Ctrl-s in the code editor.');
      if (Object.keys(entry.dependencies).some(function(name) { return entry.dependencies[name] < 1; }))
        return alert('All dependencies must be published module versions');
      published = published.slice(-1).pop();
      if (published && entry.code == published.code &&
          JSON.stringify(entry.config) == JSON.stringify(published.config) &&
          JSON.stringify(entry.dependencies) == JSON.stringify(published.dependencies))
        return alert('No changes to publish');
      status('info', 'Publishing...');
      request(url(current, upgrade), {method: 'POST'}, function(e) {
        if (e.target.status != 200)
          return status('failure', 'Error publishing new version');
        status('success', 'Published');
        var versions = (current.app ? apps : modules)[current.id].versions,
            version = upgrade
              ? Object.keys(versions).length+1
              : 'v'+current.version+'.'+entry.minor++;
        if (upgrade) {
          versions[version] = current.app ? {minor: 1, log: []} : {minor: 1};
          (current.app ? appList : moduleList).insertBefore(
            dom(li(current.id, version, 1, current.app)),
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
          minor.textContent = 'Publish v'+current.version+'.'+entry.minor;
        }
        major.parentNode.style.display = 'inline-block';
        remove.parentNode.style.display = 'none';
      });
    };
    var li = function(name, major, minor, app) {
      var record = (app ? apps : modules)[name],
          entry = record.versions[major],
          v = minor ? 'v'+major+'.'+(minor-1) : '';
      return {li: function(elem) {
        entry.tab = elem;
        elem.onclick = function(e) {
          if (!this.classList.contains('selected'))
            navigate(name, major, app);
        };
        return [
          {div: {className: 'controls', children: [
            {button: {className: 'view', onclick: function() { navigate(name, major, app, this.className.replace(/\s*view\s*/, '')); }, children: function(e) {
              entry.view = e;
              return [app || icons.info, icons.code, icons.settings, app && icons.log];
            }}},
            app && ['run', 'restart', 'stop'].map(function(command) {
              return {button: {className: command, title: command[0].toUpperCase()+command.substr(1), children: icons[command], onclick: function(e) {
                e.stopPropagation();
                send(command, {app: name, version: major});
              }}};
            })
          ]}},
          {span: {
            className: 'name',
            title: v ? name+' '+v : name,
            children: [icons.loading, icons.error, record.name, {span: record.source ? [icons.link, record.source+' '+v] : v}]
          }}
        ];
      }};
    };
    dom([
      {nav: [user
        ? [ {div: {className: 'user', children: [
              {img: {src: user.image}},
              {a: {className: 'logout', href: '/logout', title: 'Log Out', children: icons.logout}},
              user.name
            ]}},
            {div: {className: 'servers localhost', children: [
              {span: [icons.laptop, icons.network]},
              {select: {onchange: function() {
                for (var i = this.firstChild; i; i = i.nextSibling)
                  if (i.disabled) { this.removeChild(i); break; }
                this.parentNode.className = this.value ? 'servers' : 'servers localhost';
                connect(this.value);
                status();
              }, children: function(e) {
                servers = e;
                return {option: {value: '', children: 'Localhost'}};
              }}}
            ]}}]
        : {div: {className: 'home', onclick: function() { navigate(); }, children: [
            {div: {className: 'controls', children: {button: {className: 'settings', title: 'Settings', children: icons.settings}}}},
            'Simpl.js'
          ]}},
        {div: {id: 'connection', children: [
          {span: function(e) {
            var socket, server, unload, timer, countdown, retries = 0;
            var status = function(message, className) {
              e.parentNode.className = message ? className || 'info' : null;
              e.textContent = message;
            };
            send = function(command, data) {
              if (!socket || socket.readyState != 1) return;
              if (!data) data = {};
              data.command = command;
              data.instance = server;
              socket.send(JSON.stringify(data));
            };
            connect = function(host) {
              status('Connecting...', 'connecting');
              server = host || undefined;
              appList.classList.add('disabled');
              Object.keys(apps).forEach(function(name) {
                var versions = apps[name].versions;
                Object.keys(versions).forEach(function(version) {
                  var entry = versions[version];
                  entry.tab.classList.remove('running', 'error');
                  entry.running = false;
                  entry.log = [];
                });
              });
              if (socket) return send('connect');
              if (!window.WebSocket) return status('WebSockets are not supported in this browser.', 'fatal');
              clearInterval(timer);
              socket = new WebSocket('ws://'+location.host+'/connect'+(token ? '?sid='+token : ''));
              socket.onopen = function() {
                retries = 0;
                status();
                send('connect');
              };
              socket.onmessage = function(e) {
                try { var message = JSON.parse(e.data); } catch (e) { return; }
                var event = message.event,
                    instance = message.instance,
                    data = message.data || {},
                    entry = apps[data.app];
                if (entry) entry = entry.versions[data.version];
                if (event in {error: 1, log: 1, run: 1, stop: 1} && (instance != server || !entry)) return;
                switch (event) {
                  case 'connect':
                    for (var i = servers.firstChild; i && i.value.localeCompare(instance) < 0; i = i.nextSibling);
                    if (i.value == instance) i.disabled = false;
                    else servers.insertBefore(dom({option: {value: instance, children: message.name}}), i);
                    break;
                  case 'disconnect':
                    for (var i = servers.firstChild; i; i = i.nextSibling) {
                      if (i.value == instance) {
                        if (instance == server) {
                          i.disabled = true;
                          appList.classList.add('disabled');
                          status('Instance is offline', 'fatal');
                        } else {
                          servers.removeChild(i);
                        }
                        break;
                      }
                    }
                    break;
                  case 'state':
                    Object.keys(data).forEach(function(app) {
                      if (apps[app]) data[app].forEach(function(version) {
                        if (app = apps[app].versions[version]) {
                          app.tab.classList.add('running');
                          app.running = true;
                        }
                      });
                    });
                    if (selected && selected.app) {
                      log.textContent = '';
                      navigate(selected.id, selected.version, true, selected.panel == 'log' && !selected.entry.running ? 'code' : selected.panel);
                    }
                    appList.classList.remove('disabled');
                    status();
                    break;
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
                      line: data.line
                    }) > 1000) entry.log.shift();
                    if (selected && selected.entry == entry) {
                      var scroll = body.classList.contains('show-log') && (body.scrollTop || document.documentElement.scrollTop) + document.documentElement.clientHeight >= body.scrollHeight;
                      dom(logLine(message), log);
                      if (scroll) document.documentElement.scrollTop = body.scrollTop = body.scrollHeight;
                    }
                    break;
                  case 'run':
                  case 'stop':
                    entry.running = event == 'run';
                    entry.tab.classList[entry.running ? 'add' : 'remove']('running');
                    entry.tab.classList.remove('error');
                    if (entry.running) {
                      entry.log = [];
                      if (selected && selected.entry == entry) {
                        log.textContent = '';
                        navigate(data.app, data.version, true, 'log');
                      }
                    }
                    break;
                }
              };
              socket.onclose = function() {
                appList.classList.add('disabled');
                dom({option: {value: '', children: 'Localhost'}}, servers, true);
                server = socket = null;
                if (unload) return;
                if (retries == 6) return status('Disconnected', 'error');
                countdown = 1 << retries++;
                status('Reconnecting in '+countdown);
                timer = setInterval(function() {
                  if (--countdown) status('Reconnecting in '+countdown);
                  else connect();
                }, 1000);
              };
            };
            window.onbeforeunload = function() { unload = true; };
          }},
          {button: {children: 'Connect Now', onclick: function() { connect(); }}}
        ]}},
        {h2: 'Apps'},
        {div: {className: 'form', children: [
          {input: {type: 'text', placeholder: 'New App', onkeyup: function(e) {
            if (e.keyCode == 13) this.nextSibling.click();
          }}},
          {button: {title: 'Add', children: icons.add, onclick: function() {
            var field = this.previousSibling,
                name = field.value,
                error = !name ? 'Please enter app name'
                  : ~name.indexOf('@') ? 'Illegal character: @'
                  : apps[name] && 'App name already exists';
            if (error) {
              field.focus();
              alert(error);
            } else {
              field.value = '';
              apps[name] = {name: name, versions: {1: {minor: 0, code: boilerplate, config: {}, dependencies: {}, doc: CodeMirror.Doc(boilerplate, {name: 'javascript'}), log: []}}};
              dom(li(name, 1, null, true), appList).className = 'changed';
              navigate(name, 1, true);
              code.setCursor(1, 2);
              code.focus();
            }
          }}}
        ]}},
        {ul: function(e) {
          appList = e;
          return Object.keys(apps).map(function(name) {
            var versions = apps[name].versions;
            return Object.keys(versions).map(function(major) {
              return li(name, major, versions[major].minor, true);
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
                name = field.value,
                error = !name ? 'Please enter module name'
                  : ~name.indexOf('@') ? 'Illegal character: @'
                  : modules[name] && 'Module name already exists';
            if (error) {
              field.focus();
              alert(error);
            } else {
              field.value = '';
              modules[name] = {name: name, versions: {1: {minor: 0, code: boilerplate, dependencies: {}, doc: CodeMirror.Doc(boilerplate, {name: 'javascript'})}}};
              dom(li(name, 1), moduleList).className = 'changed';
              navigate(name, 1, false, 'code');
              code.setCursor(1, 2);
              code.focus();
            }
          }}}
        ]}},
        {ul: function(e) {
          moduleList = e;
          return Object.keys(modules).map(function(name) {
            var versions = modules[name].versions;
            return Object.keys(versions).map(function(major) {
              return li(name, major, versions[major].minor);
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
          {div: [
            {a: {target: '_blank', href: 'http://simpljs.com/support', children: [icons.megaphone, {span: 'Simpl.js Forum'}]}},
            {a: {id: 'facebook', target: '_blank', href: 'https://www.facebook.com/simpljs', children: icons.facebook}},
            {a: {id: 'twitter', target: '_blank', href: 'https://twitter.com/simpljs', children: icons.twitter}},
            {a: {id: 'google', target: '_blank', href: 'https://www.google.com/+Simpljs', children: icons.google}}
          ]},
          !user && {form: {method: 'post', action: '/restore', children: [
            {button: {className: 'revert', type: 'submit', name: 'scope', value: 'modules', children: [icons.revert, 'Restore Modules'], onclick: function(e) {
              if (!confirm('This will delete and restore all preinstalled modules in your workspace. Are you sure?'))
                e.preventDefault();
            }}},
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
          code.on('changes', function() {
            selected.entry.dirty = true;
            selected.entry.tab.classList.add('changed');
          });
          code.setOption('extraKeys', {Tab: function() {
            code.replaceSelection('  ');
          }});
          CodeMirror.commands.save = function() {
            fork(function() {
              var entry = selected.entry,
                  code = entry.doc.getValue();
              status('info', 'Saving...');
              request(url(selected), {method: 'PUT', data: code}, function(e) {
                if (e.target.status != 200)
                  return status('failure', 'Error saving document');
                status('success', 'Saved');
                entry.tab.classList.remove('changed');
                entry.code = code;
                entry.dirty = false;
                if (!entry.published) entry.published = [];
                if (selected && !selected.app && selected.entry == entry)
                  docs(selected.name, entry.code);
              });
            });
          };
        }}},
        {div: {id: 'settings', children: [
          {section: {id: 'actions', children: [
            {button: {className: 'publish', children: [icons.upgrade, {span: function(e) { major = e; }}], onclick: function() { publish(true); }}}, {br: null},
            {button: {className: 'publish', children: [icons.upgrade, {span: function(e) { minor = e; }}], onclick: function() { publish(); }}}, {br: null},
            {button: {className: 'delete', children: [icons.delete, {span: function(e) { remove = e; }}], onclick: function() {
              var button = this,
                  current = selected,
                  type = selected.app ? 'app' : 'module';
              if (!confirm('Are you sure you want to delete this '+type+'?')) return;
              button.disabled = true;
              status('info', 'Deleting '+type+'...');
              request(url(current), {method: 'DELETE'}, function(e) {
                button.disabled = false;
                if (e.target.status != 200)
                  return status('failure', 'Error deleting '+type);
                status('success', 'Deleted');
                delete (current.app ? apps : modules)[current.id];
                current.entry.tab.parentNode.removeChild(current.entry.tab);
                if (selected && selected.entry == current.entry) navigate();
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
                    if (~name.indexOf(value) && (selected.app || name != selected.id)) {
                      var versions = modules[name].versions;
                      Object.keys(versions).forEach(function(version) {
                        results.push({name: name, version: 1-version}); // current
                        if (versions[version].minor) results.push({name: name, version: +version}); // published
                      });
                    }
                  });
                  suggest(results);
                } else if (this.nextSibling.firstChild) {
                  this.nextSibling.firstChild.firstChild.click();
                }
              }}},
              {ul: {className: 'suggest', children: function(e) {
                suggest = function(matches) {
                  dom(matches && matches.map(function(match) {
                    var module = modules[match.name],
                        v = match.version;
                    if (v < 0 || !v && module.versions[1] && module.versions[1].minor) v--;
                    return {li: [{button: {className: 'name', children: [match.name, {span: v ? v > 0 ? 'v'+v : 'v'+-v+' current' : ''}], onclick: function() {
                      search.value = '';
                      suggest();
                      fork(function() {
                        var entry = selected.entry;
                        request(url(selected)+'/dependencies', {method: 'POST', json: match}, function(e) {
                          if (e.target.status != 200)
                            return status('failure', 'Error updating dependencies');
                          entry.dependencies[match.name] = match.version;
                          if (selected && selected.entry == entry)
                            dependencies(entry.dependencies);
                        });
                      });
                    }}}]};
                  }), e, true);
                };
              }}}
            ]}},
            {ul: function(e) {
              dependencies = function(values) {
                dom(Object.keys(values).map(function(name) {
                  var module = modules[name],
                      v = values[name];
                  if (v < 0 || !v && module && module.versions[1] && module.versions[1].minor) v--;
                  return {li: {className: 'module', children: [
                    {button: {className: 'delete', title: 'Remove', children: '×', onclick: function() {
                      if (!fork(function() { return true; })) return;
                      var button = this,
                          entry = selected.entry;
                      button.disabled = true;
                      request(url(selected)+'/dependencies/'+encodeURIComponent(name), {method: 'DELETE'}, function(e) {
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
                request(url(selected)+'/config', {method: 'PUT', json: entry.config}, function(e) {
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
                return function(a, b) {
                  var diff = dmp.diff_main(a.replace(/\r\n/g, '\n'), b.replace(/\r\n/g, '\n')),
                      lines = [], insert = [],
                      ln = {change: 0, spans: []},
                      rm = {change: 0, spans: []};
                  dmp.diff_cleanupSemantic(diff);
                  diff.forEach(function(chunk) {
                    var change = chunk[0];
                    chunk[1].split('\n').forEach(function(chunk, i) {
                      if (i) {
                        if (change <= 0) {
                          if (rm.change) lines.push(rm);
                          rm = {change: 0, spans: []};
                        }
                        if (change >= 0) {
                          insert.push(ln);
                          ln = {change: 0, spans: []};
                        }
                        if (!change) {
                          lines = lines.concat(insert);
                          insert = [];
                        }
                      }
                      if (chunk) {
                        if (change < 0 || ln.spans.length) rm.change = -1;
                        if (change > 0 || rm.spans.length) ln.change = 1;
                        if (change <= 0) rm.spans.push({change: change, text: chunk});
                        if (change >= 0) ln.spans.push({change: change, text: chunk});
                      }
                    });
                  });
                  if (rm.change) lines.push(rm);
                  if (ln.spans.length) insert.push(ln);
                  return lines.concat(insert);
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
                var versions = [], range = first && last;
                for (var i = selected.source ? 1 : 0, node = this.firstChild; node; node = node.nextSibling, i++) {
                  if (node == first || node == last) {
                    versions.push(i ? selected.entry.published[selected.entry.published.length-i].code : selected.entry.code);
                    node.className = range ? versions.length > 1 ? 'last selected' : 'first selected' : 'selected';
                  } else {
                    node.className = range && versions.length == 1 ? 'inner' : '';
                  }
                }
                if (range) {
                  var sections = [], gap = [], section = {lines: []},
                      context = 3, i = 0, a = 1, b = 1;
                  diff(versions[1], versions[0]).forEach(function(line) {
                    if (line.change) {
                      i = 0;
                      section.change = true;
                    } else if (!section.change && i == context) {
                      gap.push(section.lines.shift());
                    } else if (section.change && i == context*2) {
                      if (gap.length) sections.push({lines: gap});
                      sections.push(section);
                      gap = section.lines.splice(-context, 1);
                      section = {lines: section.lines.splice(-context+1)};
                      i = context;
                    } else {
                      i++;
                    }
                    line.number = [line.change <= 0 && a++, line.change >= 0 && b++];
                    section.lines.push(line);
                  });
                  if (!section.change) gap = gap.concat(section.lines);
                  if (gap.length) sections.push({lines: gap});
                  if (section.change) {
                    sections.push(section);
                    if (i > context) sections.push(section.lines.splice(context-i));
                  }
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
              timeline = function(record, major) {
                if (typeof record == 'string')
                  return elem.insertBefore(
                    dom({li: [{span: null}, 'Current']}),
                    dom([{span: null}, record], elem.firstChild, true));
                first = last = null;
                history();
                var minor = record.versions[major].minor;
                dom(new Array(minor+1).join().split(',').map(function(x, i) {
                  return {li: [{span: null}, i ? 'v'+major+'.'+(minor-i) : 'Current']};
                }).slice(record.source ? 1 : 0), elem, true);
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
                name = ref.module || selected.id,
                version = ref.version ? 1-ref.version : selected.version;
            if (version > 0)
              navigate(name, version, !ref.module, 'code', ref.line);
          }
        }}},
        {div: {id: 'docs', children: function(e) {
          docs = function(name, code) {
            dom([{h1: name}, o.docs.generateDom(code)], e, true);
          };
        }}},
        {div: {id: 'status', children: function(e, timer) {
          status = function(type, text) {
            if (!type) return e.style.display = 'none';
            e.style.display = 'block';
            e.className = type;
            e.textContent = text;
            clearTimeout(timer);
            timer = setTimeout(function() { e.style.display = 'none'; }, 2000);
          };
        }}}
      ]}}
    ], body);
    window.onpopstate = function(e) {
      var parts = location.pathname.split('/');
      navigate(parts[2] && decodeURIComponent(parts[2]), +parts[3], parts[1] == 'apps', parts[4]);
    };
    window.onpopstate();
    connect();
  };
}, 0, {html: 0, xhr: 0, jsonv: 0, docs: 0});
