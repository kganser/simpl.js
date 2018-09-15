simpl.add('app', function(o) {

  // polyfills & shims
  (function(list, rm) {
    list.add('a', 'b');
    if (!list.contains('b'))
      DOMTokenList.prototype.remove = function() { Array.prototype.forEach.call(arguments, rm.bind(this)); };
  }(document.createElement('div').classList, DOMTokenList.prototype.remove));
  window.cancelIdleCallback = window.cancelIdleCallback || clearTimeout;
  window.requestIdleCallback = window.requestIdleCallback || function(cb) {
    return setTimeout(function() {
      var start = Date.now();
      cb({didTimeout: false, timeRemaining: function() {
        return Math.max(0, 50 - (Date.now() - start));
      }});
    }, 1);
  };
  
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
    var appList, moduleList, selected, code, config, major, minor, remove, dependencies, search, suggest, timeline, history, log, docs, status, login, connect, send, servers, id,
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
    var url = function(e, unversioned) {
      return (e.app ? '/apps/' : '/modules/')+encodeURIComponent(e.id)+(unversioned ? '' : '/'+e.version);
    };
    var dirty = function() {
      return Object.keys(apps).map(function(name) { return apps[name]; })
        .concat(Object.keys(modules).map(function(name) { return modules[name]; }))
        .some(function(item) {
          return Object.keys(item.versions).some(function(version) {
            return item.versions[version].dirty;
          });
        });
    };
    var request = function(path, options, callback) {
      if (typeof options == 'function') {
        callback = options;
        options = {};
      }
      options.credentials = 'same-origin';
      fetch(path+(~path.indexOf('?') ? '&token=' : '?token=')+token, options).then(function(response) {
        response.json().then(function(body) {
          return body || {};
        }, function() {
          return {};
        }).then(function(body) {
          if (response.status >= 400 && !body.error) body.error = 'Unknown error';
          if (response.status != 401) return callback(body);
          login.open(function(response) {
            if (!response || response.error) callback(response);
            else request(path, options, callback);
          });
        });
      });
    };
    var navigate = function(name, version, app, panel, ln) {
      var record = (app ? apps : modules)[name];
      if (record) {
        var entry = record.versions[version],
            first = app ? entry.state ? 'log' : 'code' : 'docs',
            next = {settings: first, code: 'settings'}[panel = panel || first] || 'code';
        if (selected) body.classList.remove(selected.entry.loading ? 'show-loading' : 'show-'+selected.panel);
        if (selected && selected.entry == entry && selected.rendered) {
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
            selected.rendered = true;
            config.put([], entry.config || null);
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
            if (app)
              log.render(entry.log);
            else if (!docs(record.name, entry.code))
              return navigate(name, version, app, 'code', ln); // redirect to /code if no docs exist
          } else if (!entry.loading) {
            entry.loading = true;
            entry.tab.classList.add('loading');
            request(url(selected), function(response) {
              entry.loading = false;
              entry.tab.classList.remove('loading');
              if (response.error) {
                entry.tab.classList.add('error');
                if (selected && selected.entry == entry) {
                  entry.tab.classList.remove('selected');
                  body.classList.remove('show-loading');
                  selected = null;
                }
                return status('failure', response.error);
              }
              entry.doc = CodeMirror.Doc(response.code, {name: 'javascript'});
              entry.code = response.code;
              entry.config = response.config;
              entry.dependencies = response.dependencies;
              entry.published = response.published.map(function(version, i, versions) { // TODO: remove
                return i < versions.length-1 ? {} : version;
              });
              if (entry.state != 'error') entry.tab.classList.remove('error');
              if (selected && selected.entry == entry) {
                body.classList.remove('show-loading');
                navigate(name, version, app, panel, ln);
              }
            });
          }
        }
        body.classList.add(entry.loading ? 'show-loading' : 'show-'+selected.panel);
        body.lastChild.scrollTop = selected.panel == 'log' ? body.lastChild.scrollHeight : 0;
        entry.view.className = 'view '+next;
        entry.view.title = 'Show '+next[0].toUpperCase()+next.substr(1);
        if (selected.panel == 'code') {
          code.refresh(); // redo measurements with parent node display=block
          if ('code' in entry && code.doc != entry.doc) {
            code.swapDoc(entry.doc);
            if (!entry.rendered) {
              entry.rendered = true;
              entry.code.split('\n').forEach(function(line, i) {
                if (/[\[{] \/\/-$/.test(line)) code.foldCode(CodeMirror.Pos(i, 0), null, 'fold');
              });
            }
          }
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
      if (!name == !record) {
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
      // TODO: use pegged minor version
      request(url(selected)+'?name='+encodeURIComponent(name), {method: 'POST'}, function(response) {
        if (response.error)
          return status('failure', response.error);
        status('success', 'Copied successfully');
        group[name] = {name: name, versions: {1: {
          minor: 0,
          code: entry.code,
          config: entry.config,
          dependencies: entry.dependencies,
          published: [],
          doc: entry.doc,
          log: []
        }}};
        entry.tab.parentNode.removeChild(entry.tab);
        insert(name, 1, 0, current.app);
        navigate(name, 1, current.app, current.panel);
        delete group[current.id];
        if (callback) callback();
      });
    };
    var create = function(callback) {
      var entry = selected.entry;
      if (entry.published) return callback();
      request(url(selected), {method: 'PUT', body: entry.code}, function(response) {
        if (response.error)
          return status('failure', response.error);
        entry.published = [];
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
      request(url(current, true)+(upgrade ? '?source=' : '/')+current.version, {method: 'POST'}, function(response) {
        if (response.error)
          return status('failure', response.error);
        status('success', 'Published');
        if (upgrade) {
          var versions = (current.app ? apps : modules)[current.id].versions,
              version = Object.keys(versions).length+1;
          versions[version] = current.app ? {minor: 1, log: []} : {minor: 1};
          (current.app ? appList : moduleList).insertBefore(
            dom(li(current.id, version, 1, current.app)),
            versions[version-1].tab.nextSibling);
          major.textContent = 'Publish v'+(version+1)+'.0';
        } else {
          entry.published.push(current.app
            ? {code: entry.code, config: entry.config, dependencies: entry.dependencies}
            : {code: entry.code, dependencies: entry.dependencies});
          timeline('v'+current.version+'.'+entry.minor++);
          entry.tab.lastChild.title = current.name+' v'+current.version;
          entry.tab.lastChild.lastChild.textContent = 'v'+current.version;
          minor.textContent = 'Publish v'+current.version+'.'+entry.minor;
        }
        major.parentNode.style.display = 'inline-block';
        remove.parentNode.style.display = 'none';
      });
    };
    var li = function(name, major, minor, app) {
      var record = (app ? apps : modules)[name],
          entry = record.versions[major],
          v = minor ? 'v'+major : '';
      return {li: function(elem) {
        entry.tab = elem;
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
          {a: {
            className: 'name',
            title: v ? name+' '+v : name,
            href: url({app: app, id: name, version: major})+(app ? '/code' : '/docs'),
            onclick: function(e) {
              if (e.which > 1 || e.shiftKey || e.altKey || e.metaKey || e.ctrlKey) return;
              e.preventDefault();
              if (!elem.classList.contains('selected'))
                navigate(name, major, app);
            },
            children: [icons.loading, icons.error, record.name, {span: record.source ? [icons.link, record.source+' '+v] : v}]
          }}
        ];
      }};
    };
    var insert = function(name, major, minor, app) {
      var list = app ? appList : moduleList,
          group = app ? apps : modules,
          i = 0;
      Object.keys(group).forEach(function(n) {
        if (n < name) i += Object.keys(group[n].versions).length;
      });
      return list.insertBefore(dom(li(name, major, minor, app)), list.children[i]);
    };
    dom([
      {nav: [
        {div: {
          className: user ? 'user' : 'home',
          onclick: function() { navigate(); },
          children: [
            {div: {className: 'controls', children: {a: user
              ? {id: 'logout', href: '/logout', title: 'Log Out', children: icons.logout}
              : {id: 'login', href: '/login', title: 'Log In or Register', children: icons.login, onclick: function(e) {
                  e.stopPropagation();
                  e.preventDefault();
                  login.open();
                }}}}},
            user
              ? {span: {className: 'name', style: {backgroundImage: 'url('+user.image+')'}, children: user.name}}
              : 'Simpl.js'
          ]
        }},
        user && {div: {className: 'servers localhost', children: [
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
        ]}},
        {div: {id: 'connection', children: [
          {span: function(e) {
            var socket, server, unload, expired, countdown, retries = 0;
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
              clearInterval(countdown);
              status('Connecting...', 'connecting');
              server = host || undefined;
              appList.classList.add('disabled');
              Object.keys(apps).forEach(function(name) {
                var versions = apps[name].versions;
                Object.keys(versions).forEach(function(version) {
                  var entry = versions[version];
                  entry.tab.classList.remove('running', 'error');
                  entry.state = null;
                  entry.log = [];
                });
              });
              if (user && expired) return login.open(function(response) {
                if (response && !response.error) return connect(server);
                status(response ? response.error : 'Disconnected', 'error');
              });
              if (socket) return send('connect');
              if (!window.WebSocket) return status('WebSockets are not supported in this browser.', 'fatal');
              socket = new WebSocket((location.protocol == 'https:' ? 'wss://' : 'ws://')+location.host+'/connect?token='+token);
              socket.onopen = function() {
                status();
                send('connect');
                expired = false;
                var s = socket;
                setTimeout(function() {
                  if (s == socket) retries = 0;
                }, 2000);
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
                    if (!instance) {
                      id = data.id;
                    } else if (servers) {
                      for (var i = servers.firstChild; i && i.value.localeCompare(instance) < 0; i = i.nextSibling);
                      if (i && i.value == instance) i.disabled = false;
                      else servers.insertBefore(dom({option: {value: instance, children: message.name}}), i);
                    }
                    break;
                  case 'login':
                    if (!data.error) {
                      document.cookie = 'token='+data.token+'; Path=/';
                      if (!user || data.username != user.username) {
                        if (!dirty() || confirm('You have unsaved changes. Continue logging in as '+data.username+'?')) {
                          unload = true;
                          return location.reload();
                        }
                        data.error = 'Login cancelled';
                      }
                    }
                    if (!data.error) {
                      token = data.token;
                      expired = false;
                    }
                    login.close(data);
                    break;
                  case 'expire':
                    dom({option: {value: '', children: 'Localhost'}}, servers, true);
                    expired = data.refresh;
                    server = undefined;
                    send('connect'); // switch to localhost
                    connect();
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
                    if (Array.isArray(data)) data.forEach(function(id) {
                      var i = id.lastIndexOf('@'),
                          app = apps[id.substr(0, i)],
                          entry = app && app.versions[id.substr(i+1)];
                      if (entry) entry.tab.classList.add(entry.state = 'running');
                    });
                    if (selected && selected.app) {
                      log.render();
                      navigate(selected.id, selected.version, true, selected.panel);
                    }
                    appList.classList.remove('disabled');
                    status();
                    break;
                  case 'error':
                    entry.tab.classList.add(entry.state = data.level = 'error');
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
                    if (selected && selected.entry == entry)
                      log.append(message);
                    break;
                  case 'run':
                    entry.state = 'running';
                    entry.tab.classList.add('running');
                    entry.tab.classList.remove('error');
                    entry.log = [];
                    if (selected && selected.entry == entry) {
                      log.render();
                      navigate(data.app, data.version, true, 'log');
                    }
                    break;
                  case 'stop':
                    entry.state = null;
                    entry.tab.classList.remove('running', 'error');
                    break;
                }
              };
              socket.onclose = function() {
                appList.classList.add('disabled');
                dom({option: {value: '', children: 'Localhost'}}, servers, true);
                server = socket = undefined;
                if (unload) return;
                if (retries == 6) return status('Disconnected', 'error');
                var seconds = 1 << retries++;
                status('Reconnecting in '+seconds);
                countdown = setInterval(function() {
                  if (--seconds) status('Reconnecting in '+seconds);
                  else connect();
                }, 1000);
              };
            };
            window.onbeforeunload = function(e) {
              login.close();
              if (dirty() && !unload)
                return e.returnValue = 'You have unsaved changes. Cancel navigation to stay on this page.';
              unload = true;
            };
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
              insert(name, 1, null, true).className = 'changed';
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
              insert(name, 1).className = 'changed';
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
          !user && {div: {className: 'promo', children: [
            {p: [{strong: 'Become a Member!'}, ' Create a profile page and easily share apps and modules as part of the Simpl.js community. You can also deploy your apps to cloud servers and launch them right from your workspace!']},
            {a: {target: '_blank', href: 'https://simpljs.com/register', children: 'Sign Up'}},
            {a: {target: '_blank', href: 'https://simpljs.com/pricing', children: 'Learn More'}}
          ]}},
          {p: ['Simpl.js makes it easy to develop software that runs in your browser with access to low-level system APIs. ', {strong: 'Apps'}, ' run in separate WebWorker threads with ', {code: 'modules'}, ' and ', {code: 'config'}, ' objects as specified in the app\'s ', icons.settings,'settings panel. Any ', {code: 'console'}, ' output is streamed to the app\'s ', icons.log,'log panel. ', {strong: 'Modules'}, ' are libraries imported as dependencies by apps and other modules. Module documentation is generated using the ', {code: 'docs'}, ' module syntax.']},
          {p: 'Apps and modules can be published with a major-minor versioning scheme. Major versions can be developed in parallel, while minor versions represent backward-compatible incremental changes.'},
          {p: 'Browse the core modules and run the included demo apps to get started.'},
          {div: [
            {a: {target: '_blank', href: 'https://simpljs.com/support', children: [icons.megaphone, {span: 'Simpl.js Forum'}]}},
            {a: {id: 'facebook', target: '_blank', href: 'https://www.facebook.com/simpljs', children: icons.facebook}},
            {a: {id: 'twitter', target: '_blank', href: 'https://twitter.com/simpljs', children: icons.twitter}},
            {a: {id: 'google', target: '_blank', href: 'https://www.google.com/+Simpljs', children: icons.google}}
          ]},
          !user && {form: {method: 'post', action: '/restore', children: [
            {input: {type: 'hidden', name: 'token', value: token}},
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
            rulers: [120],
            lineNumbers: true,
            matchBrackets: true,
            styleActiveLine: true,
            highlightSelectionMatches: {minChars: 1},
            foldGutter: true,
            foldOptions: {widget: '\u27f7', minFoldSize: 1},
            gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter'],
            extraKeys: {Tab: 'indentMore', 'Shift-Tab': 'indentLess'}
          });
          code.on('changes', function() {
            var entry = selected.entry,
                dirty = entry.doc.getValue() !== entry.code;
            entry.dirty = dirty;
            entry.tab.classList.toggle('changed', dirty);
          });
          CodeMirror.commands.save = function() {
            fork(function() {
              var entry = selected.entry,
                  code = entry.doc.getValue();
              status('info', 'Saving...');
              request(url(selected), {method: 'PUT', body: code}, function(response) {
                if (response.error)
                  return status('failure', response.error);
                status('success', 'Saved');
                entry.tab.classList.remove('changed');
                entry.code = code;
                entry.dirty = false;
                if (!entry.published) entry.published = [];
                if (selected && selected.entry == entry && !selected.app)
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
              request(url(current, true), {method: 'DELETE'}, function(response) {
                button.disabled = false;
                if (response.error)
                  return status('failure', response.error);
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
              {input: {
                type: 'text',
                placeholder: 'Search Modules',
                children: function(e) { search = e; },
                onkeydown: function(e) {
                  if (e.keyCode == 9 && !e.shiftKey || e.keyCode == 40) {
                    var second = this.nextSibling.firstChild;
                    if (second = second && second.nextSibling.firstChild) {
                      e.preventDefault()
                      second.focus();
                    }
                  }
                },
                onkeyup: function(e) {
                  if (e.keyCode != 13) {
                    var results = [], value = this.value;
                    if (value) Object.keys(modules).forEach(function(name) {
                      var parts = name.split('@');
                      if (~parts[0].indexOf(value) && (selected.app || name != selected.id)) {
                        var versions = modules[name].versions;
                        Object.keys(versions).forEach(function(version) {
                          if (!parts[1]) results.push({name: name, version: 1-version}); // current
                          if (versions[version].minor) results.push({name: name, version: +version}); // published
                        });
                      }
                    });
                    suggest(results);
                  } else if (this.nextSibling.firstChild) {
                    this.nextSibling.firstChild.firstChild.click();
                  }
                }
              }},
              {ul: {className: 'suggest', children: function(e) {
                suggest = function(matches) {
                  dom(matches && matches.map(function(match) {
                    var module = modules[match.name],
                        v = match.version;
                    if (v < 0 || !v && module.versions[1].minor) v--;
                    return {li: [{button: {
                      className: 'name',
                      children: [match.name, {span: v ? v > 0 ? 'v'+v : 'v'+-v+' current' : ''}],
                      onclick: function() {
                        var current = selected,
                            entry = selected.entry;
                        search.value = '';
                        suggest();
                        fork(function() {
                          create(function() {
                            request(url(current)+'/dependencies', {method: 'POST', body: JSON.stringify(match)}, function(response) {
                              if (response.error)
                                return status('failure', response.error);
                              entry.dependencies[match.name] = match.version;
                              if (selected && selected.entry == entry)
                                dependencies(entry.dependencies);
                            });
                          });
                        });
                      },
                      onkeydown: function(e) {
                        if (e.keyCode == 9 && !e.shift || e.keyCode == 40) { // tab, down arrow
                          e.preventDefault()
                          if (this.parentNode.nextSibling)
                            this.parentNode.nextSibling.firstChild.focus();
                        } else if (e.keyCode == 9 && e.shift || e.keyCode == 38) { // shift-tab, up arrow
                          e.preventDefault()
                          if (this.parentNode.previousSibling)
                            this.parentNode.previousSibling.firstChild.focus();
                          else
                            this.parentNode.parentNode.previousSibling.focus();
                        }
                      }
                    }}]};
                  }), e, true);
                };
              }}}
            ]}},
            {ul: function(e) {
              dependencies = function(values) {
                dom(Object.keys(values).map(function(id) {
                  var name = id.split('@'),
                      module = modules[id],
                      v = values[id];
                  if (v < 0 || !v && module && module.versions[1].minor) v--;
                  return {li: {className: 'module', children: [
                    {button: {className: 'delete', title: 'Remove', children: '×', onclick: function() {
                      if (selected.source) return fork();
                      var button = this,
                          entry = selected.entry;
                      button.disabled = true;
                      request(url(selected)+'/dependencies/'+encodeURIComponent(id), {method: 'DELETE'}, function(response) {
                        button.disabled = false;
                        if (response.error)
                          return status('failure', response.error);
                        delete entry.dependencies[id];
                        if (selected && selected.entry == entry)
                          button.parentNode.parentNode.removeChild(button.parentNode);
                      });
                    }}},
                    {span: {className: 'name', children: [name[0], {span: v ? v > 0 ? name[1] ? [icons.link, name[1]+' v'+v] : 'v'+v : 'v'+-v+' current' : ''}]}}
                  ]}};
                }), e, true);
              };
            }}
          ]}},
          {section: {id: 'config', children: [
            {h2: 'Configuration'},
            {pre: function(e) {
              config = o.jsonv(e, selected ? selected.entry.config : null, {
                editor: true,
                listener: function(method, path, data) {
                  if (method == 'toggle') return;
                  var current = selected,
                      config = selected.entry.config;
                  path.forEach(function(key, i, path) {
                    if (i < path.length-1) config = config[key];
                    else if (method == 'put') config[key] = data;
                    else if (method == 'insert') config.splice(key, 0, data);
                    else if (typeof key == 'number') config.splice(key, 1);
                    else delete config[key];
                  });
                  create(function() {
                    request(url(current)+'/config', {method: 'PUT', body: JSON.stringify(selected.entry.config)}, function(response) {
                      if (response.error)
                        status('failure', response.error);
                    });
                  });
                }
              });
            }}
          ]}},
          {section: {id: 'history', children: [
            {h2: 'History'},
            {ul: {className: 'timeline', children: function(elem) {
              var first, last;
              var diff = function(pair, lines) {
                return {table: o.diff.diffChunks(pair[0], pair[1], 3).map(function(chunk, i, chunks) {
                    if (!chunk.change) chunk.lines.push(null); // expander
                    return {tbody: {className: chunk.change ? 'changed' : 'unchanged', children: chunk.lines.map(function(line) {
                      return line ? {tr: {className: ['delete', 'unchanged', 'insert'][line.change+1], children: [
                        {td: {className: 'line', children: lines ? line.number[0] : ['-', '\xa0', '+'][line.change+1]}},
                        lines && {td: {className: 'line', children: line.number[1]}},
                        {td: line.spans.map(function(span) {
                          return span.change ? {span: span.text} : span.text;
                        })}
                      ]}} : {tr: {className: chunks.length == 1 ? 'placeholder unchanged' : 'placeholder', children: [
                        {td: {className: 'line', colSpan: lines && 2, children: '⋮'}},
                        {td: chunks.length == 1 ? 'No Changes' : 'Expand'}
                      ]}};
                    })}};
                })};
              };
              var dependencyString = function(dependencies) {
                return Object.keys(dependencies).map(function(name) {
                  var v = dependencies[name];
                  if (v < 0 || !v && modules[name] && modules[name].versions[1].minor) v--;
                  return name+(v ? v > 0 ? ' v'+v : ' v'+-v+' current' : '');
                }).join('\n');
              };
              var configString = function(config) {
                return JSON.stringify(config, null, 2);
              }
              var render = function(current, minors) {
                var entry = current.entry,
                    loading;
                var versions = minors.map(function(minor) {
                  var version = minor == entry.published.length ? entry : entry.published[minor];
                  if (!version.code && !version.loading) {
                    loading = version.loading = true;
                    request(url(current)+'/'+minor, function(response) {
                      version.loading = false;
                      if (!response.error) entry.published[minor] = response;
                      if (!selected && selected.entry != entry) return;
                      if (response.error) history(response.error);
                      else render(current, minors);
                    });
                  }
                  return version;
                });
                if (loading) {
                  history('Loading...');
                } else if (versions.length == 2) {
                  history([
                    {h3: 'Dependencies'},
                    diff(versions.map(function(version) {
                      return dependencyString(version.dependencies);
                    })),
                    current.app && [
                      {h3: 'Configuration'},
                      diff(versions.map(function(version) {
                        return configString(version.config);
                      }))
                    ],
                    {h3: 'Code'},
                    diff(versions.map(function(version) {
                      return version.code;
                    }), true)
                  ]);
                } else {
                  history(versions[0] && [
                    {h3: 'Dependencies'},
                    {table: [{tbody: dependencyString(versions[0].dependencies).split('\n').map(function(line) {
                      return {tr: [{td: line}]};
                    })}]},
                    current.app && [
                      {h3: 'Configuration'},
                      {table: [{tbody: configString(versions[0].config).split('\n').map(function(line) {
                        return {tr: [{td: line}]};
                      })}]}
                    ],
                    {h3: 'Code'},
                    {table: [{tbody: versions[0].code.split('\n').map(function(line, i) {
                      return {tr: [{td: {className: 'line', children: i+1}}, {td: line}]};
                    })}]}
                  ]);
                }
              };
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
                    versions.push(selected.entry.published.length - i);
                    node.className = range ? versions.length > 1 ? 'last selected' : 'first selected' : 'selected';
                  } else {
                    node.className = range && versions.length == 1 ? 'inner' : '';
                  }
                }
                render(selected, versions.reverse());
              };
              timeline = function(record, major) {
                if (typeof record == 'string')
                  return elem.insertBefore(
                    dom({li: [{span: null}, 'Current']}),
                    dom([{span: null}, record], elem.firstChild, true));
                first = last = null;
                history();
                var minor = record.versions[major].minor;
                dom(Array.apply(null, {length: minor+1}).map(function(x, i) {
                  return {li: [{span: null}, i ? 'v'+major+'.'+(minor-i) : 'Current']};
                }).slice(record.source ? 1 : 0), elem, true);
              };
            }}},
            {div: function(e) {
              history = function(data) { dom(data, e, true); };
              e.onclick = function(e) {
                var target = e.target;
                while (target != this && target.tagName != 'TBODY') target = target.parentNode;
                if (target.className == 'unchanged') target.className += ' expanded';
              };
            }}
          ]}}
        ]}},
        {pre: {
          id: 'log',
          children: function(e) {
            log = function(queue, entry, handle) {
              var render = function() {
                handle = handle || requestIdleCallback(function next() {
                  if (!selected || selected.entry != entry)
                    return handle = null;
                  var panel = body.lastChild,
                      scroll = body.classList.contains('show-log') && panel.scrollTop + panel.clientHeight >= panel.scrollHeight;
                  dom(queue.slice(0, 20).map(function(entry) {
                    var message = [], link;
                    entry.message.forEach(function(part, i) {
                      if (i) message.push(' ');
                      if (typeof part == 'string') {
                        while (link = /\b(https?|ftp):\/\/[^\s/$.?#].\S*/i.exec(part)) {
                          var url = link[0];
                          if (link.index) message.push({span: part.substr(0, link.index)});
                          message.push({a: {href: url, target: '_blank', children: url}});
                          part = part.substr(link.index+url.length);
                        }
                        if (part) message.push({span: part});
                      } else {
                        message.push({div: function(e) {
                          o.jsonv(e, part, {collapsed: true});
                        }});
                      }
                    });
                    return {div: {className: 'entry '+entry.level, children: [
                      {div: {className: 'location', children: entry.module+(entry.line ? ':'+entry.line : ''), dataset: {
                        module: entry.module,
                        version: entry.version,
                        line: entry.line
                      }}},
                      {div: {className: 'message', children: message}}
                    ]}};
                  }), e);
                  if (scroll) panel.scrollTop = panel.scrollHeight;
                  queue = queue.slice(20);
                  handle = queue.length && requestIdleCallback(next, {timeout: 500});
                }, {timeout: 500});
              };
              return {
                render: function(lines) {
                  var len = e.childNodes.length;
                  while (len--) e.removeChild(e.lastChild);
                  entry = selected.entry;
                  queue = (lines || []).slice(0);
                  render();
                },
                append: function(line) {
                  queue.push(line);
                  render();
                }
              };
            }([]);
          },
          onclick: function(e) {
            if (e.target.className != 'location') return;
            var ref = e.target.dataset,
                name = ref.module || selected.id,
                version = ref.version ? 1-ref.version : selected.version;
            if (version > 0)
              navigate(name, version, !ref.module, 'code', ref.line);
          }
        }},
        {div: {id: 'docs', children: function(e) {
          docs = function(name, code) {
            var docs = o.docs.generateDom(code);
            dom([{h1: name}, docs], e, true);
            return docs && docs.length;
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
        }}},
        {div: {id: 'auth', children: function(elem) {
          var handler;
          login = {
            open: function(callback) {
              elem.classList.add('visible');
              handler = callback;
              (function render() {
                dom({div: [{iframe: {src: '/login'+(id ? '?socket='+id : '')}}]}, elem, true);
                fetch('/online').then(function(response) {
                  if (response.ok || !elem.classList.contains('visible')) return;
                  dom({div: [
                    {strong: 'Network Error'}, {br: null},
                    {p: 'Please check your internet connection'},
                    {button: {onclick: render, children: 'Reconnect'}}
                  ]}, elem, true);
                });
              }());
            },
            close: function(response) {
              elem.classList.remove('visible');
              if (handler) handler(response);
              handler = null;
            }
          };
          elem.onclick = function(e) {
            if (this == e.target)
              login.close();
          };
        }}}
      ]}}
    ], body);
    (window.onpopstate = function(e) {
      var parts = location.pathname.split('/');
      navigate(parts[2] && decodeURIComponent(parts[2]), +parts[3], parts[1] == 'apps', parts[4]);
    })();
    connect();
  };
}, 0, {html: 0, jsonv: 0, docs: 0, diff: 0});
