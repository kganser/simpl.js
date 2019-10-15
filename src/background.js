simpl.use({console: 0, crypto: 0, database: 0, html: 0, http: 0, jsonv: 0, string: 0, system: 0, webapp:0, websocket: 0}, (o, proxy) => {

  const db = o.database.open('simpl');
  const encode = o.string.base64FromBuffer;
  const baseSiteUrl = 'https://simpljs.com';
  const baseApiUrl = baseSiteUrl.replace('://', '://api.');
  const apps = {}, logs = {}, logins = {};

  let server, loader, lines, workspace, csrf, ping, localApiPort, debug;
  let clients = {};

  const query = o => Object.entries(o).map(([key, value]) =>
    value !== undefined &&
      encodeURIComponent(key) + (value == null ? '' : '=' + encodeURIComponent(value))
  ).filter(Boolean).join('&');

  const api = async (path, config) => {
    const {method, body, headers, token} = config || {};
    const response = await fetch(baseApiUrl + path, {
      method,
      headers: {
        ...headers,
        ...(token && {Authorization: 'Bearer ' + token}),
      },
      body
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data && data.error || response.statusText);
    return data;
  };
  const restore = async (scope, sparse) => {
    if (!scope)
      return new Promise(resolve =>
        db.get('apps', false, 'shallow').get('modules', 'shallow').then((apps, mods) => {
          if (apps && mods) return resolve();
          restore(apps ? 'modules' : mods ? 'apps' : 'both').then(resolve);
        })
      );
    const items = await Promise.all(workspace.filter(
      item => scope == 'both' || !item.file == (scope == 'modules')
    ).map(({file, name, config = {}, dependencies, proxy}) =>
      fetch((file ? '/apps/' + file : '/modules/' + name) + '.js')
        .then(r => r.text())
        .then(code => ({
          app: !!file,
          name,
          versions: [{
            code: file ? code
              : 'function(modules' + (proxy ? ', proxy' : '') + ') {\n' + code.trim().split(/\n/).slice(1, -1).join('\n') + '\n}',
            ...(file && {config}),
            dependencies,
            published: []
          }]
        }))
    ));
    return new Promise(resolve => {
      let txn = db;
      if (sparse) {
        items.forEach(({app, name, versions}) => {
          txn = txn.put([app ? 'apps' : 'modules', name], {versions});
        });
      } else {
        if (scope != 'modules')
          txn = txn.put('apps', items.filter(item => item.app).reduce((data, {name, versions}) => ({
            ...data,
            [name]: {versions}
          }), {}));
        if (scope != 'apps')
          txn = txn.put('modules', items.filter(item => !item.app).reduce((data, {name, versions}) => ({
            ...data,
            [name]: {versions}
          }), {}));
      }
      txn.then(resolve);
    });
  };
  const wrap = (name, code, version, dependencies) =>
    'simpl.add(' + [JSON.stringify(name), code, version, JSON.stringify(dependencies)] + ');';
  const send = (connection, event, data) =>
    connection.send(JSON.stringify({event: event, data: data}), info => {
      if (info.error) delete clients[connection.socket.socketId];
    });
  const broadcast = (event, data, user) => {
    if (debug) console.log(event + ' ' + JSON.stringify(data));
    Object.values(clients).forEach(client => {
      if (client.user == user) send(client.connection, event, data);
    });
  };
  const state = (user, connection) => {
    send(connection, 'state', Object.keys(apps).reduce((apps, id) => {
      const i = id.indexOf('@');
      return id.substr(0, i) == user ? [...apps, id.substr(i + 1)] : apps;
    }, []));
    Object.keys(logs).forEach(id => {
      if (id.split('@')[0] == user) logs[id].forEach(e =>
        send(connection, e.fatal ? 'error' : 'log', e.fatal ? e.fatal : e)
      );
    });
  };
  const run = async (user, name, version, token) => {
    const id = [user, name, version].join('@');
    try {
      const {code, config, dependencies} = await (user
        ? api('/apps/' + encodeURIComponent(name) + '/' + version, {token})
        : new Promise(resolve => db.get(['apps', name, 'versions', version - 1]).then(resolve)));
      if (apps[id]) return;
      logs[id] = [];
      apps[id] = proxy(null, [
        loader + 'var config = ' + JSON.stringify(config),
        'simpl.user=' + JSON.stringify(user),
        'simpl.use(' + JSON.stringify(dependencies) + ',' + code + ',' + JSON.stringify(name.split('@')[1]) + ');'
      ].join(';'), async (module, callback) => {
        let v = module.version;
        const current = v < 1;
        if (current) v = 1 - v;
        try {
          const data = await (user
            ? api('/modules/' + encodeURIComponent(module.name) + '/' + v, {token})
            : new Promise(resolve => db.get('modules/' + encodeURIComponent(module.name) + '/versions/' + (v - 1)).then(resolve)));
          const {code, dependencies} = current ? data : data.published.pop();
          callback(wrap(module.name, code, module.version, dependencies));
        } catch (e) {
          if (!apps[id]) return;
          apps[id].terminate();
          delete apps[id];
          const data = {app: name, version, message: 'Module ' + module.name + ': ' + e.message};
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
  const stop = (user, name, version) => {
    const id = [user, name, version].join('@');
    if (apps[id]) {
      apps[id].terminate();
      broadcast('stop', {app: name, version}, user);
      delete apps[id];
    }
    return id;
  };
  const shutdown = () => {
    if (!server) return;
    server.disconnect();
    clients = {};
    server = port = null;
    clearInterval(ping);
  };
  
  Promise.all(['/simpl.js', '/loader.js'].map(file =>
    fetch(file).then(r => r.text())
  )).then(values => {
    loader = values.join('');
    lines = loader.match(/\n/g).length;
  });
  fetch('/workspace.json').then(r => r.json()).then(data => {
    workspace = data;
    restore(); // restore db if empty
  });

  const app = o.webapp();

  app.request = function(request) {
    return (path, handler, method, options) =>
      request(path, (req, res) => {
        req.token = (req.headers.Authorization || '').replace(/^Bearer /i, '');
        if (method == 'GET' || options && options.auth == false || req.token == csrf)
          return handler(req, res);
        res.generic(401);
      }, method, options);
  }(app.request);

  app.get([
    '/',
    '/apps/:name/:version/code',
    '/apps/:name/:version/settings',
    '/apps/:name/:version/log',
    '/modules/:name/:version/code',
    '/modules/:name/:version/settings',
    '/modules/:name/:version/docs'
  ], async (req, res) => {
    const {token} = req.cookie;
    try {
      const {user, servers, workspace} = await new Promise((resolve, reject) => {
        if (token) {
          return Promise.all([ // TODO: consolidate
            api('/user', {token}),
            api('/workspace', {token})
          ]).then(
            ([user, workspace]) =>
              user.plan == 'pro'
                ? api('/servers', {token}).then(({servers}) => ({user, workspace, servers}))
                : {user, workspace, servers: []}
          ).then(resolve, reject);
        }
        db.get('', false, path => [
          // apps,modules/<name>/versions/<#>/code,config,dependencies,published/<#>
          key => key == 'apps' || key == 'modules' || 'skip',
          true, true, true,
          key => key == 'published' || 'skip',
          true
        ][path.length] || false).then(data => {
          resolve({
            workspace: Object.entries(data || {}).reduce((groups, [name, group]) => ({
              ...groups,
              [name]: Object.entries(group).reduce((entries, [name, entry]) => ({
                ...entries,
                [name]: {
                  versions: entry.versions.map(
                    version => version.published.length
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
            /* eslint-disable prefer-arrow-callback, no-var */
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
                token: token || csrf,
                login: user,
                loginUrl: '/login',
                baseApiUrl,
                local: true,
                servers,
                workspace,
              }]
            })}
            /* eslint-enable */
          ]}}
        ]}
      ]), 'html');
    } catch (e) {
      return token
        ? res.generic(302, {'Set-Cookie': 'token=; Expires=' + new Date().toUTCString(), Location: '/'})
        : res.end('Error: ' + e.message, 500);
    }
  });

  app.get(['/console.css', '/jsonv.css'], async (req, res) => {
    const name = req.path.substr(1).split('.')[0];
    res.end(o.html.css(o[name].style), 'css');
  });

  app.get(['/console.js', '/jsonv.js'], async (req, res) => {
    const name = req.path.substr(1).split('.')[0];
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
    });
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
    const path = [type, name, 'versions', +version - 1];
    db.get(path, true).then(function(version) {
      if (!version) return res.error('Version does not exist', 404);
      const {code, config, dependencies} = version;
      if (Object.values(dependencies || {}).some(version => version < 1))
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
    db.get([type, name, 'versions', +version - 1]).then(data => {
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
    db.get([type, name, 'versions', +version - 1, 'published', +minor]).then(data => {
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
    db.put([type, name, 'versions', version - 1, 'code'], code).then(function(error) { // TODO: check If-Match header
      if (!error) return res.ok();
      if (version > 1) return res.error('Module does not exist');
      const record = {code, dependencies: {}, published: []};
      if (type == 'apps') record.config = {};
      this.put([type, name], {versions: [record]}).then(res.ok);
    });
  }, {bodyFormat: 'utf8', bodyMaxLength: 1048576});

  // delete module
  app.delete(['/apps/:name', '/modules/:name'], (req, res) => {
    const type = req.path.split('/')[1];
    const {name} = req.params;
    db.delete([type, name]).then(() => {
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
    // -1 => v2 current [1], 0 => v1 current/unpublished [0], 1 => v1 published [0], 2 => v2 published [1]
    db.get(['modules', d.name, 'versions', d.version > 0 ? d.version - 1 : -d.version], true, 'shallow').then(function(exists) {
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
    const verifier = crypto.getRandomValues(new Uint8Array(24));
    const state = encode(crypto.getRandomValues(new Uint8Array(24)), true);
    const now = Date.now();
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
      'Set-Cookie': 'state=' + state + '; Path=/',
      Location: baseSiteUrl + '/authorize?' + query({
        response_type: 'code',
        client_id: 'simpljs',
        redirect_uri: 'http://localhost:' + port + '/auth',
        state: state,
        code_challenge: encode(hash, true),
        code_challenge_method: 'S256'
      }) + '#confirm'
    });
  });

  app.get('/auth', async (req, res) => {
    // check state, get token using auth code + verifier
    const {state, authorization_code: code} = req.query;
    const session = logins[state];
    if (!session) return res.generic(400);
    delete logins[state];
    try {
      const data = await api('/token', {
        method: 'post',
        body: query({
          client_id: 'simpljs',
          grant_type: 'authorization_code',
          redirect_uri: 'http://localhost:' + port + '/auth',
          code_verifier: session.verifier,
          code
        })
      });
      res.end(o.html.markup([
        {'!doctype': {html: null}},
        // eslint-disable-next-line prefer-arrow-callback
        {script: Object.assign(function(response) {
          if (parent) parent.postMessage(response, location.origin);
        }, {args: [data]})}
      ]), 'html');
    } catch (e) {
      res.generic(500);
    }
  });

  app.get('/logout', (req, res) => {
    res.generic(302, {
      'Set-Cookie': 'token=; Expires=' + new Date().toUTCString(),
      Location: '/'
    });
  });

  app.get('/token', (req, res) => res.end(csrf));

  app.post('/restore', async (req, res) => {
    const full = req.body.scope == 'full';
    await restore(full ? 'both' : 'modules', !full);
    res.ok();
  }, {bodyFormat: 'url'});

  app.post('/action', async (req, res) => {
    const {token, body: {command, app, version}} = req;
    if (!token) return res.generic(401);
    try {
      const user = token == csrf ? '' : (await api('/user', {token})).username;
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
    o.websocket.accept(req, res, connection => {
      const token = req.query.access_token;
      if (!token) return connection.close(4001, 'Forbidden');
      const id = res.socket.socketId;
      let user;
      (token == csrf ? Promise.resolve({}) : api('/user', {token})).then(({username, plan}) => {
        if (plan == 'pro') { // TODO: boolean for connection support instead of plan string
          const remote = new WebSocket(baseApiUrl.replace(/^http/, 'ws') + '/connect?access_token=' + token);
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
          const {command, app, version} = JSON.parse(data) || {};
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
  
  chrome.runtime.onConnect.addListener(launcher => {
    launcher.onMessage.addListener(command => {
      if (command.action == 'stop') {
        shutdown();
        return launcher.postMessage({action: 'stop'});
      }
      
      csrf = encode(crypto.getRandomValues(new Uint8Array(24)), true);
      o.http.serve({port: command.port}, (req, res) => {

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
        
      }, (error, s) => {
        if (!error) {
          server = s;
          port = command.port;
          ping = setInterval(() => {
            Object.values(clients).forEach(client =>
              client.connection.send('ping')
            );
          }, 30000);
        }
        console.log('Simpl.js server - port ' + command.port + ' - ' + (error ? error : 'running'));
        launcher.postMessage({error: error, action: 'start', port: port, path: path});
        path = '';
      });
    });
    
    if (server) {
      launcher.postMessage({action: 'start', port: port, path: path});
      path = '';
    }
  });
  
  let ws, port, path = '', launcher = false;

  chrome.app.runtime.onLaunched.addListener(source => {
    console.log('Simpl.js launched ' + JSON.stringify(source));
    const url = (source.url || '').match(/^https:\/\/simpljs\.com\/launch(\/.*)?/);

    let onLauncherLoad;
    const launcherLoaded = new Promise(resolve => {
      onLauncherLoad = resolve;
    });

    const launch = args => {
      const {token, user} = args;
      const port = Math.max(+args.port, 0);
      const app = args.app && args.app.split('@'); // name@version
      let connections, client, retries = 0;
      debug = 'debug' in args;

      console.log('Simpl.js: launch ' + JSON.stringify(args));

      if (port && !server) launcherLoaded.then(() => {
        const doc = launcher.contentWindow.document;
        doc.getElementById('port').value = port;
        doc.launcher.onsubmit();
      });
      if (app) run('', app[0], +app[1] || 1);
      if (token && user) {
        localApiPort = +args.localApiPort;
        (function connect() {
          console.log('Simpl.js: attempting headless connection ' + retries);
          ws = new WebSocket((localApiPort ? 'ws://localhost:' + localApiPort : 'wss://' + baseApiUrl) + '/connect?access_token=' + token);
          ws.onopen = () => {
            console.log('Simpl.js: headless connection opened');
            connections = retries = 0;
            client = {user: user, connection: ws};
          };
          ws.onmessage = e => {
            let message;
            try { message = JSON.parse(e.data); } catch (e) { return; }
            const {app, command, version} = message || {};
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
              stop(user, app, version);
            if (command == 'run' || command == 'restart')
              run(user, app, version, token);
          };
          ws.onclose = () => {
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
      path = url ? '/login?redirect=' + encodeURIComponent(url[1] || '') : '';
      if (launcher.focus) {
        if (!server) return launcher.focus();
        chrome.browser.openTab({url: 'http://localhost:' + port + path});
        return path = '';
      }
    } else if (!ws && typeof require == 'function') {
      ws = true;
      launch(require('nw.gui').App.argv.reduce((args, flag) => {
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
    }, window => {
      launcher = window;
      launcher.contentWindow.onload = onLauncherLoad;
      launcher.onClosed.addListener(() => {
        launcher = false;
      });
    });
  });
});
