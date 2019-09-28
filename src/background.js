simpl.use({console: 0, crypto: 0, database: 0, html: 0, http: 0, jsonv: 0, string: 0, system: 0, webapp:0, websocket: 0}, function(o, proxy) {

  var server, loader, lines, workspace,
      db = o.database.open('simpl'),
      encode = o.string.base64FromBuffer,
      baseSiteUrl = 'https://simpljs.com', // 'http://dev.simpljs.com:1080',
      baseApiUrl = baseSiteUrl.replace('://', '://api.'),
      apps = {}, logs = {}, clients = {}, logins = {},
      csrf, ping, localApiPort, debug;

  const query = o => Object.entries(o).map(([key, value]) =>
    value !== undefined &&
      encodeURIComponent(key) + (value == null ? '' : '=' + encodeURIComponent(value))
  ).filter(Boolean).join('&');

  const api = async (path, config) => {
    console.log(new Error('api call').stack);
    const {method, body, headers, token} = config || {};
    const response = await fetch(baseApiUrl+path, {
      method,
      headers: {
        ...headers,
        ...(token && {Authorization: 'Bearer '+token}),
      },
      body
    });
    return {
      response,
      data: await response.json()
    };
  };
  var restore = function(callback, scope, sparse) {
    if (!scope)
      return db.get('apps', false, 'shallow').get('modules', 'shallow').then(function(apps, mods) {
        if (apps && mods) return callback();
        restore(callback, apps ? 'modules' : mods ? 'apps' : 'both');
      });
    var data = {apps: {}, mods: {}}, pending = 0;
    workspace.forEach(function(item) {
      if (scope != 'both' && scope == 'apps' == !item.file) return;
      pending++;
      fetch((item.file ? '/apps/'+item.file : '/modules/'+item.name)+'.js').then(function(r) { return r.text(); }).then(function(code) {
        if (item.file) {
          data.apps[item.name] = {versions: [{
            code: code,
            config: item.config || {},
            dependencies: item.dependencies || {},
            published: []
          }]};
        } else {
          data.mods[item.name] = {versions: [{
            code: 'function(modules'+(item.proxy ? ', proxy' : '')+') {\n'+code.trim().split(/\n/).slice(1, -1).join('\n')+'\n}',
            dependencies: item.dependencies || {},
            published: []
          }]};
        }
        if (!--pending) {
          var trans = db;
          if (scope != 'modules') {
            Object.keys(apps).forEach(function(id) { stop.apply(null, id.split('@')); });
            trans = sparse
              ? Object.keys(data.apps).reduce(function(t, name) { return t.put('apps/'+encodeURIComponent(name), data.apps[name]); }, trans)
              : trans.put('apps', data.apps);
          }
          if (scope != 'apps')
            trans = sparse
              ? Object.keys(data.mods).reduce(function(t, name) { return t.put('modules/'+encodeURIComponent(name), data.mods[name]); }, trans)
              : trans.put('modules', data.mods);
          trans.then(callback);
        }
      });
    });
  };
  var wrap = function(name, code, version, dependencies) {
    return 'simpl.add(' + [JSON.stringify(name), code, version, JSON.stringify(dependencies)] + ');';
  };
  var send = function(connection, event, data) {
    connection.send(JSON.stringify({event: event, data: data}), function(info) {
      if (info.error) delete clients[connection.socket.socketId];
    });
  };
  var broadcast = function(event, data, user) {
    if (debug) console.log(event+' '+JSON.stringify(data));
    Object.keys(clients).forEach(function(socketId) {
      var client = clients[socketId];
      if (client.user == user) send(client.connection, event, data);
    });
  };
  var state = function(user, connection) {
    send(connection, 'state', Object.keys(apps).reduce(function(apps, id) {
      var i = id.indexOf('@');
      if (id.substr(0, i) == user) apps.push(id.substr(i+1));
      return apps;
    }, []));
    Object.keys(logs).forEach(function(id) {
      if (id.split('@', 1)[0] == user) logs[id].forEach(function(e) {
        send(connection, e.fatal ? 'error' : 'log', e.fatal ? e.fatal : e);
      });
    });
  };
  var run = async function(user, name, version, token) {
    const id = [user, name, version].join('@');
    if (apps[id]) return;
    try {
      const app = await new Promise(resolve => {
        (user
          ? api('/apps/' + encodeURIComponent(name) + '/' + version, {token})
          : db.get('apps/' + encodeURIComponent(name) + '/versions/' + (version - 1))
        ).then(resolve);
      });
      if (!app || app.error)
        throw new Error(app ? app.error : 'App not found');
      logs[id] = [];
      apps[id] = proxy(null, [
        loader + 'var config = ' + JSON.stringify(app.config),
        'simpl.user=' + JSON.stringify(user),
        'simpl.use(' + JSON.stringify(app.dependencies) + ',' + app.code + ',' + JSON.stringify(name.split('@')[1]) + ');'
      ].join(';'), async (module, callback) => {
        let v = module.version;
        const current = v < 1;
        if (current) v = 1 - v;
        try {
          let record = await new Promise(resolve => {
            (user
              ? api('/modules/' + encodeURIComponent(module.name) + '/' + v, {token})
              : db.get('modules/' + encodeURIComponent(module.name) + '/versions/' + (v - 1))
            ).then(resolve);
          });
          if (!record || record.error)
            throw new Error(record ? 'Module ' + module.name + ': ' + record.error : 'Module ' + module.name + ' not found');
          if (!current) record = record.published.pop();
          callback(wrap(module.name, record.code, module.version, record.dependencies));
        } catch (e) {
          if (!apps[id]) return;
          apps[id].terminate();
          delete apps[id];
          const data = {app: name, version, message: e.message};
          logs[id].push({fatal: data});
          broadcast('error', data, user);
        }
      }, (level, message, module, line, column) => {
        const data = {app: name, version, level, message, module, line: module ? line : line > lines ? line - lines : undefined, column};
        if (logs[id].push(data) > 100) logs[id].shift();
        broadcast('log', data, user);
      }, (message, module, line) => {
        delete apps[id];
        const data = {app: name, version, message, module, line: module ? line : line > lines ? line - lines : undefined};
        logs[id].push({fatal: data});
        broadcast('error', data, user);
      });
      broadcast('run', {app: name, version}, user);
    } catch (e) {
      broadcast('error', {app: name, version, message: e.message}, user);
    }
  };
  var stop = function(user, name, version) {
    var id = [user, name, version].join('@');
    if (!apps[id]) return id;
    apps[id].terminate();
    broadcast('stop', {app: name, version: version}, user);
    delete apps[id];
    return id;
  };
  var shutdown = function() {
    if (!server) return;
    server.disconnect();
    clients = {};
    server = port = null;
    clearInterval(ping);
  };
  
  Promise.all(['/simpl.js', '/loader.js'].map(function(file) {
    return fetch(file).then(function(r) { return r.text(); });
  })).then(function(values) {
    loader = values.join('');
    lines = loader.match(/\n/g).length;
  });
  fetch('/icons.json').then(function(r) { return r.json(); }).then(function(r) {
    icons = Object.keys(r).map(function(name) {
      return {symbol: {id: 'icon-'+name, viewBox: '0 0 20 20', children: {path: {d: r[name]}}}};
    });
  });
  fetch('/workspace.json').then(function(r) { return r.json(); }).then(function(r) {
    workspace = r;
    restore(function() {});
  });

  const app = o.webapp();

  app.request = function(request) {
    return (path, handler, method, options) => {
      return request(path, (req, res) => {
        req.token = (req.headers.Authorization || '').replace(/^Bearer /i, '');
        if (method == 'GET' || options && options.auth == false || req.token == csrf)
          return handler(req, res);
        res.generic(401);
      }, method, options);
    }
  }(app.request);

  const updateConsole = () => !debug || o.console.exp > Date.now() ||
    (o.console.next = o.console.next || new Promise(resolve => {
      console.log('fetching updated console module');
      const items = {console: 1, jsonv: 1};
      simpl = {
        add: (name, mod) => {
          if (name in items) {
            o[name] = {...mod(), exp: Date.now()+1000};
            items[name]();
          }
        }
      };
      Promise.all(Object.keys(items).map(name => new Promise(resolve => {
        const script = document.createElement('script');
        script.src = '/modules/' + name + '.js';
        document.head.appendChild(script);
        items[name] = resolve;
      }))).then(resolve);
    }));

  app.get([
    '/',
    '/apps/:name/:version/code',
    '/apps/:name/:version/settings',
    '/apps/:name/:version/log',
    '/modules/:name/:version/code',
    '/modules/:name/:version/settings',
    '/modules/:name/:version/docs'
  ], async (req, res) => {
    const {user, servers, workspace} = await new Promise(async resolve => {
      const {token} = req.cookie;
      if (token) {
        try {
          const [user, workspace] = await Promise.all([ // TODO: consolidate
            api('/user', {token}),
            api('/workspace', {token})
          ]);
          if (!user.response.ok)
            throw new Error(user.data.error);
          const servers = user.data.plan == 'pro' // TODO
            ? await api('/servers', {token})
            : {data: {servers: []}};
          return resolve({
            user: user.data,
            servers: servers.data.servers,
            workspace: workspace.data
          });
        } catch (e) {
          console.error(e);
        }
      }
      db.get('', false, function(path) {
        // apps,modules,sessions/<name>/versions/<#>/code,config,dependencies,published/<#>
        return [
          function(key) { if (key != 'apps' && key != 'modules') return 'skip'; },
          true, true, true,
          function(key) { if (key != 'published') return 'skip'; },
          true
        ][path.length] || false;
      }).then(function(data) {
        resolve({
          workspace: Object.entries(data || {}).reduce((groups, [name, group]) => ({
            ...groups,
            [name]: Object.entries(group).reduce((entries, [name, entry]) => ({
              ...entries,
              [name]: {
                versions: entry.versions.map(
                  version => ({minor: version.published.length - 1})
                )
              }
            }), {})
          }), {})
        });
      });
    });
    res.end(o.html.markup([
      {'!doctype': {html: null}},
      {html: [
        {head: [
          {title: 'Simpl.js'},
          {meta: {charset: 'utf-8'}},
          {meta: {name: 'viewport', content: 'width=device-width, initial-scale=1.0, user-scalable=no'}},
          {link: {rel: 'stylesheet', href: '/codemirror.css'}},
          {link: {rel: 'stylesheet', href: '/console.css'}},
          {link: {rel: 'stylesheet', href: '/jsonv.css'}}
        ]},
        {body: {class: 'console', children: [
          {div: {id: 'root'}},
          {script: {src: '/react.js'}},
          {script: {src: '/codemirror.js'}},
          {script: {src: '/jsonv.js'}},
          {script: {src: '/jshint.js'}},
          {script: {src: '/console.js'}},
          {script: Object.assign(function(props) {
            Object.keys(components).forEach(function(name) {
              var component = components[name],
                  render = component.render;
              component.render = function() {
                return function jsx(node) {
                  if (!Array.isArray(node)) return node;
                  var type = node[0], props, children;
                  if (!type || Array.isArray(type)) {
                    type = React.Fragment;
                    children = node;
                  } else if (typeof node[1] == 'object' && !Array.isArray(node[1])) {
                    props = node[1];
                    children = node.slice(2);
                  } else {
                    children = node.slice(1);
                  }
                  return React.createElement.apply(null, [type, props].concat(children.map(jsx)));
                }(render.call(this));
              };
              components[name] = createReactClass(component);
            });
            ReactDOM.render(
              React.createElement(components.console, props),
              document.getElementById('root')
            );
          }, {
            args: [{
              token: req.cookie.token || csrf,
              login: user,
              loginUrl: '/login',
              baseApiUrl,
              local: true,
              servers,
              workspace,
            }]
          })}
        ]}}
      ]}
    ]), 'html');
  });

  app.get(['/console.css', '/jsonv.css'], async (req, res) => {
    const name = req.path.substr(1).split('.')[0];
    if (name == 'console') await updateConsole();
    res.end(o.html.css(o[name].style), 'css');
  });

  app.get(['/console.js', '/jsonv.js'], async (req, res) => {
    const name = req.path.substr(1).split('.')[0];
    if (name == 'console') await updateConsole();
    res.end('(components = window.components || {}).' + name + ' = ' + o[name].component + '();', 'js');
  });

  app.get([
    '/:name.:version.js',
    '/:name.:version.current.js'
  ], (req, res) => {
    const {name} = req.params;
    const version = +req.params.version || 0;
    const current = req.path.endsWith('current.js');
    if (version <= 0) return res.generic(404);
    db.get(['modules', name, 'versions', version - 1]).then(module => {
      if (module && !current) module = module.published.pop();
      if (!module) return res.generic(404);
      res.end(wrap(name, module.code, version, module.dependencies), 'js');
    })
  });

  // publish major
  app.post(['/apps/:name', '/modules/:name'], (req, res) => {
    const type = req.path.split('/')[1];
    const {name} = req.params;
    const source = +req.query.source || 0;
    if (name.includes('@')) return res.error('Not found', 404);
    if (source <= 0 || source % 1) return res.error('Invalid source version to publish as new major version');
    db.get([type, name, 'versions', source - 1], true).then(function(version) {
      if (!version) return res.error('Not found', 404);
      const {code, config, dependencies} = version;
      if (Object.keys(dependencies).some(name => dependencies[name] < 1))
        return res.error('All dependencies must be published modules');
      const published = version.published.pop();
      if (!published || code == published.code &&
          JSON.stringify(config) == JSON.stringify(published.config) &&
          JSON.stringify(dependencies) == JSON.stringify(published.dependencies))
        return res.error('No changes to publish');
      const record = {
        code,
        config,
        dependencies,
        published: [{
          code,
          config,
          dependencies
        }],
        source: {
          major: source,
          minor: version.published.length
        }
      };
      if (type == 'modules') {
        delete record.config;
        delete record.published[0].config;
      }
      this.append([type, name, 'versions'], record).then(res.ok);
    });
  });

  // publish minor
  app.post(['/apps/:name/:version', '/modules/:name/:version'], (req, res) => {
    const type = req.path.split('/')[1];
    const {name, version} = req.params;
    const path = [type, name, 'versions', +version-1];
    db.get(path, true).then(function(version) {
      if (!version) return res.error('Version does not exist', 404);
      const {code, config, dependencies} = version;
      if (Object.keys(dependencies).some(name => dependencies[name] < 1))
        return res.error('All dependencies must be published modules');
      const published = version.published.pop();
      if (published && code == published.code &&
          JSON.stringify(config) == JSON.stringify(published.config) &&
          JSON.stringify(dependencies) == JSON.stringify(published.dependencies))
        return res.error('No changes to publish');
      this.append(
        [...path, 'published'],
        type == 'modules' ? {code, dependencies} : {code, config, dependencies}
      ).then(res.ok);
    });
  });

  // get current
  app.get(['/apps/:name/:version', '/modules/:name/:version'], (req, res) => {
    const type = req.path.split('/')[1];
    const {name, version} = req.params;
    db.get([type, name, 'versions', +version-1]).then(function(data) {
      if (!data) return res.error('Not found', 404);
      // TODO: change to {code, dependencies, config?, published: {minor, code, dependencies, config?}}
      data.published.slice(0, -1).forEach(version => {
        version.code = version.dependencies = version.config = undefined;
      });
      res.json(data);
    });
  });

  // get minor (history)
  app.get(['/apps/:name/:version/:minor', '/modules/:name/:version/:minor'], (req, res) => {
    const type = req.path.split('/')[1];
    const {name, version, minor} = req.params;
    db.get([type, name, 'versions', +version - 1, 'published', +minor]).then(function(data) {
      if (!data) return res.error('Not found', 404);
      res.json(data);
    });
  });

  // save module code
  app.put(['/apps/:name/:version', '/modules/:name/:version'], (req, res) => {
    const type = req.path.split('/')[1];
    const {name} = req.params;
    const version = +req.params.version || 0;
    const code = req.body;
    if (version <= 0 || version % 1) return res.error('Not found', 404);
    db.put([type, name, 'versions', version-1, 'code'], code).then(function(error) { // TODO: check If-Match header
      if (!error) return res.ok();
      if (version > 1) return res.error('Module does not exist');
      const record = {code, dependencies: {}, published: []};
      if (type == 'apps') record.config = {};
      this.put([type, name], {versions: [record]}).then(res.ok);
    });
  }, {bodyFormat: 'utf8', bodyMaxLength: 1048576});

  // delete module
  app.delete(['/apps/:name/:version', '/modules/:name/:version'], (req, res) => {
    const type = req.path.split('/')[1];
    const {name, version} = req.params;
    if (version != '1') return res.error('Only unpublished modules can be deleted');
    db.delete([type, name]).then(function() {
      // Delete only possible on local workspace for unpublished module
      if (type == 'apps') delete logs[stop('', name, 1)];
      res.ok();
    });
  });

  // update config
  app.put('/apps/:name/:version/config', (req, res) => {
    const type = req.path.split('/')[1];
    const {name} = req.params;
    const version = +req.params.version || 0;
    if (version <= 0 || version % 1) return res.error('Not found', 404);
    db.put([type, name, 'versions', version - 1, 'config'], req.body).then(res.ok);
  }, {bodyFormat: 'json'});

  // add dependency
  app.post(['/apps/:name/:version/dependencies', '/modules/:name/:version/dependencies'], (req, res) => {
    const type = req.path.split('/')[1];
    const {name} = req.params;
    const version = +req.params.version || 0;
    const d = req.body || {};
    if (version <= 0 || version % 1) return res.error('Not found', 404);
    if (!d.name || typeof d.version != 'number' || d.version % 1) return res.error('Invalid dependency');
    db.get(['modules', d.name, 'versions', Math.abs(d.version)], true, 'shallow').then(function(exists) {
      if (!exists) return res.error('Module not found');
      this.put([type, name, 'versions', version - 1, 'dependencies', d.name], d.version).then(res.ok);
    });
  }, {bodyFormat: 'json'});

  // delete dependency
  app.delete(['/apps/:name/:version/dependencies/:module', '/modules/:name/:version/dependencies/:module'], (req, res) => {
    const type = req.path.split('/')[1];
    const {name, version, module} = req.params;
    db.delete([type, name, 'versions', +version - 1, 'dependencies', module]).then(res.ok);
  });

  app.get('/login', async (req, res) => {
    var verifier = crypto.getRandomValues(new Uint8Array(24)),
        state = encode(crypto.getRandomValues(new Uint8Array(24)), true),
        now = Date.now();
    // clean up expired sessions
    Object.entries(logins).forEach(([state, login]) => {
      if (login.exp > now) delete logins[state];
    });
    logins[state] = {
      verifier: encode(verifier, true),
      exp: now + 3600000
    };
    const hash = await crypto.subtle.digest('sha-256', verifier);
    res.generic(302, {
      'Set-Cookie': 'state='+state+'; Path=/',
      Location: baseSiteUrl+'/authorize?'+query({
        response_type: 'code',
        client_id: 'simpljs',
        redirect_uri: 'http://localhost:'+port+'/auth',
        state: state,
        code_challenge: encode(hash, true),
        code_challenge_method: 'S256'
      })+'#confirm'
    });
  });

  app.get('/auth', async (req, res) => {
    // check state, get token using auth code + verifier
    const {state, authorization_code: code} = req.query;
    const session = logins[state];
    if (!session) return res.generic(400);
    delete logins[state];
    try {
      const {data} = await api('/token', {
        method: 'post',
        body: query({
          client_id: 'simpljs',
          grant_type: 'authorization_code',
          redirect_uri: 'http://localhost:'+port+'/auth',
          code_verifier: session.verifier,
          code
        })
      });
      res.end(o.html.markup([
        {'!doctype': {html: null}},
        {script: Object.assign(function(response) {
          if (parent) parent.postMessage(response, location.origin);
        }, {
          args: [data]
        })}
      ]), 'html');
    } catch (e) {
      res.generic(500);
    }
  });

  app.get('/logout', (req, res) => {
    res.generic(302, {
      'Set-Cookie': 'token=; Expires='+new Date().toUTCString(),
      Location: '/'
    });
  });

  app.get('/token', (req, res) => res.end(csrf));

  app.post('/restore', (req, res) => {
    const full = req.body.scope == 'full';
    restore(res.ok, full ? 'both' : 'modules', !full);
  }, {bodyFormat: 'url'});

  app.post('/action', async (req, res) => {
    const {token, body: {command, app, version}} = req;
    if (!token) return res.generic(401);
    try {
      const user = token == csrf ? '' : (await api('/user', {token})).data.username;
      if (command == 'stop' || command == 'restart')
        stop(user, app, version);
      if (command == 'run' || command == 'restart')
        run(user, app, version, token);
      res.generic(200);
    } catch (e) {
      res.generic(401);
    }
  }, {auth: false, bodyFormat: 'json'});

  app.get('/online', async (req, res) => {
    const {ok} = await fetch(baseApiUrl, {method: 'head'});
    res.generic(ok ? 200 : 502);
  });

  app.get('/connect', (req, res) => {
    // Simpl.js service can run apps on this instance scoped to a user account;
    // user-scoped state is returned from ws connection initiated by the instance
    o.websocket.accept(req, res, function(connection) {
      const token = req.query.access_token;
      if (!token) return connection.close(4001, 'Forbidden');
      const id = res.socket.socketId;
      let user;
      (token == csrf
        ? Promise.resolve({data: {}})
        : api('/user', {token})
      ).then(({data: {username, plan}}) => {
        if (plan == 'pro') { // TODO: boolean for connection support instead of plan string
          const remote = new WebSocket(baseApiUrl.replace(/^http/, 'ws')+'/connect?access_token='+token);
          remote.onmessage = e => {
            if (typeof e.data == 'string' && e.data != 'ping')
              connection.send(e.data);
          };
          remote.onclose = e => {
            console.log('api closed connection', e);
            connection.close(e.code, e.message);
          };
        }
        user = username || '';
        send(connection, 'connect', {name: 'Localhost'});
      }, () => {
        // Force client to reset token
        connection.close(4001, 'Forbidden');
      });
      return function(data) {
        if (user == null) return; // client should not issue a command until 'connect' event is sent
        try {
          const {command, app, version, token} = JSON.parse(data) || {};
          if (command == 'connect') {
            clients[id] = {connection, user};
            connection.socket.onDisconnect = () => delete clients[id];
            return state(user, connection);
          }
          if (command == 'stop' || command == 'restart')
            stop(user, app, version);
          if (command == 'run' || command == 'restart')
            run(user, app, version, token);
        } catch (e) {
          console.log(e);
        }
      };
    });
  });

  app.get(/.*/, async (req, res) => {
    try {
      const response = await fetch(req.path);
      if (!response.ok) throw new Error('Not found');
      res.end(await response.arrayBuffer(), (req.path.match(/\.([^.]*)$/) || [])[1]);
    } catch (e) {
      console.log(req.path, 404);
      res.generic(404);
    }
  });
  
  chrome.runtime.onSuspend.addListener(shutdown);
  
  chrome.runtime.onConnect.addListener(function(launcher) {
    launcher.onMessage.addListener(function(command) {
      if (command.action == 'stop') {
        shutdown();
        return launcher.postMessage({action: 'stop'});
      }
      
      csrf = encode(crypto.getRandomValues(new Uint8Array(24)), true);
      o.http.serve({port: command.port}, function(req, res) {

        res.json = (data, status) => res.end(JSON.stringify(data), 'json', status);
        res.ok = () => res.json({status: 'success'});
        res.error = (code, description, status) => {
          if (typeof description == 'number') {
            status = description;
            description = undefined;
          }
          if (code instanceof Error)
            code = code.message;
          res.json({error: code, error_description: description}, status || 400);
        };
        
        return app.route(req, res) || res.generic(404);
        
      }, function(error, s) {
        if (!error) {
          server = s;
          port = command.port;
          ping = setInterval(function() {
            Object.keys(clients).forEach(function(id) {
              clients[id].connection.send('ping');
            });
          }, 30000);
        }
        console.log('Simpl.js server - port '+command.port+' - '+(error ? error : 'running'));
        launcher.postMessage({error: error, action: 'start', port: port, path: path});
        path = '';
      });
    });
    
    if (server) {
      launcher.postMessage({action: 'start', port: port, path: path});
      path = '';
    }
  });
  
  var ws, port, path = '', launcher = false;

  chrome.app.runtime.onLaunched.addListener(function(source) {
    console.log('Simpl.js launched '+JSON.stringify(source));
    var url = (source.url || '').match(/^https:\/\/simpljs\.com\/launch(\/.*)?/);
    var onLauncher = function(callback, loaded) {
      return function(x, fn) {
        if (fn && loaded) fn();
        else if (fn) callback = fn;
        else if (callback) callback();
        else loaded = true;
      };
    }();
    var launch = function(args) {
      if (!args) args = {};
      var token = args.token,
          user = args.user,
          port = Math.max(+args.port, 0),
          app = args.app && args.app.split('@'), // name@version
          connections, client, retries = 0;
      console.log('Simpl.js: launch '+JSON.stringify(args));
      debug = 'debug' in args;
      if (port && !server) onLauncher(null, function() {
        var doc = launcher.contentWindow.document;
        doc.getElementById('port').value = port;
        doc.launcher.onsubmit();
      });
      if (app) run('', app[0], +app[1] || 1);
      if (token && user) {
        localApiPort = +args.localApiPort;
        (function connect() {
          console.log('Simpl.js: attempting headless connection '+retries);
          ws = new WebSocket((localApiPort ? 'ws://localhost:'+localApiPort : 'wss://'+baseApiUrl)+'/connect?access_token='+token);
          ws.onopen = function() {
            console.log('Simpl.js: headless connection opened');
            connections = retries = 0;
            client = {user: user, connection: ws};
          };
          ws.onmessage = function(e) {
            try { var message = JSON.parse(e.data); } catch (e) { return; }
            var command = message.command;
            if (command == 'connect') {
              if (!connections++)
                clients[-1] = client;
              return state(user, ws);
            }
            if (command == 'disconnect') {
              if (!--connections)
                delete clients[-1];
              return;
            }
            if (command == 'stop' || command == 'restart')
              stop(user, message.app, message.version);
            if (command == 'run' || command == 'restart')
              run(user, message.app, message.version, token);
          };
          ws.onclose = function() {
            console.log('Simpl.js: headless connection closed');
            delete clients[-1];
            if (retries < 6) setTimeout(connect, (1 << retries++) * 1000);
            else if (localApiPort) setTimeout(connect, 64000);
            else console.log('Simpl.js: headless connection failed');
          };
        }());
      }
    };
    if (source.source != 'file_handler' && source.source != 'load_and_launch') {
      // TODO: restore login site -> app
      path = url ? '/login?redirect='+encodeURIComponent(url[1] || '') : '';
      if (launcher.focus) {
        if (!server) return launcher.focus();
        chrome.browser.openTab({url: 'http://localhost:'+port+path});
        return path = '';
      }
    } else if (!ws && typeof require == 'function') {
      ws = true;
      launch(require('nw.gui').App.argv.reduce(function(args, flag) {
        flag = flag.split('=');
        args[flag[0].replace(/^--?/, '')] = flag[1] || flag[1] == null;
        return args;
      }, {}));
    }
    launcher = true;
    chrome.app.window.create('simpl.html', {
      id: 'simpl',
      resizable: false,
      innerBounds: {width: 300, height: 100}
    }, function(window) {
      launcher = window;
      launcher.contentWindow.onload = onLauncher;
      launcher.onClosed.addListener(function() {
        launcher = false;
      });
    });
  });
});
