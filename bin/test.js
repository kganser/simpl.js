#!/usr/bin/env node
const {spawn} = require('child_process');
const os = require('os');
const fs = require('fs');
const {PNG} = require('pngjs');
const fetch = require('node-fetch');
const WebSocket = require('ws');

const platform = os.platform();
const debuggerPort = 8122;
const port = 8123;
const base = 'http://localhost:' + port;

const xvfb = platform != 'darwin' &&
  spawn('Xvfb', [':99', '-ac', '-screen', '0', '1280x720x16', '-nolisten', 'tcp']);

const app = spawn(__dirname + '/../build/' + (
  platform == 'darwin' ? 'macos/Simpl.js.app/Contents/MacOS/nwjs' : 'linux/Simpl.js/nw'
), [
  '--remote-debugging-port=' + debuggerPort,
  '--port=' + port
], platform == 'darwin' ? undefined : {
  env: {DISPLAY: ':99'}
});

const tests = [];
const log = [];
const listeners = {};
const timeout = 10000;

// TODO: code coverage
// TODO: record app output
app.on('error', console.error);

const getToken = async i => {
  await new Promise(resolve => setTimeout(resolve, 1000));
  try {
    const response = await fetch(base + '/token', {timeout});
    if (response.ok) return response.text();
  } catch (e) {
    // continue
  }
  return i && getToken(i - 1);
};

const assert = (pass, name, detail, images) => {
  console.log(pass ? '\x1b[32m✓\x1b[0m ' + name : '\x1b[31m✗\x1b[0m ' + name + '\n  ' + detail);
  log.push(pass ? '✓ ' + name : '✗ ' + name + '\n  ' + detail);
  tests.push({name, pass, detail, images});
};

getToken(5).then(async token => {

  assert(token, 'Get token', 'Made up to 5 requests to /token');
  if (!token) return;

  const page = await fetch('http://localhost:' + debuggerPort + '/json')
    .then(data => data.json())
    .then(pages => pages.find(page => page.url == 'chrome-extension://kdkheiopehanfbajkkopimfppjmclgbp/simpl.html'));

  assert(page, 'Get page from debugger');
  if (!page) return;

  const request = (path, options) =>
    fetch(base + path, {headers: {Authorization: 'Bearer ' + token}, timeout, ...options});

  await request('/restore', {method: 'post', body: 'scope=full'}).then(response => {
    assert(response.ok, 'Reset workspace', 'Returned ' + response.status);
  });

  const socket = new WebSocket(page.webSocketDebuggerUrl, {perMessageDeflate: false});

  let id = 1;
  const send = (method, params) => {
    const message = JSON.stringify({id, method, params});
    log.push('> ' + message);
    socket.send(message);
    return new Promise((resolve, reject) => {
      const i = id++;
      listeners[i] = resolve;
      setTimeout(() => {
        if (!listeners[i]) return;
        delete listeners[i];
        reject('Timed out waiting for response to ' + method);
      }, timeout);
    });
  };

  const next = (method, test) => {
    log.push('> wait for ' + method);
    return new Promise((resolve, reject) => {
      listeners[method] = resolve;
      setTimeout(() => {
        if (!listeners[method]) return;
        // delete listeners[method]; // prevents reject() from propagating?
        reject('Timed out waiting for ' + method);
      }, timeout);
    }).then(result =>
      !test || test(result) ? result : next(method, test)
    );
  };

  const load = url => {
    return next('Network.requestWillBeSent', result =>
      result.request.url.split('?')[0] == base + url
    ).then(req =>
      next('Network.loadingFinished', result => result.requestId == req.requestId)
    );
  };

  const snapshot = async name => {
    const id = name.toLowerCase();
    const {data} = await send('Page.captureScreenshot');

    const lastFile = 'snapshots/' + id + '.' + platform + '.png';
    const nextFile = 'snapshots/' + id + '.' + platform + '.new.png';

    const [last, next] = await Promise.all([
      new Promise((resolve, reject) =>
        fs.createReadStream(__dirname + '/' + lastFile)
          .on('error', err => {
            if (err.code == 'ENOENT') {
              resolve();
            } else {
              reject('Error reading ' + lastFile + ': ' + err.code);
            }
          })
          .pipe(new PNG())
          .on('parsed', function() { resolve(this); })
      ),
      new Promise((resolve, reject) =>
        new PNG().parse(
          Buffer.from(data, 'base64'),
          (err, data) => {
            if (err) return reject('Error parsing ' + id + ' screenshot');
            resolve(data);
          }
        )
      )
    ]);
    
    if (last) {
      const description = name + ' matches snapshot';
      if (
        last.width == next.width &&
        last.height == next.height &&
        last.data.every((pixel, i) => pixel == next.data[i])
      ) {
        assert(true, description, null, [lastFile]);
      } else {
        assert(false, description, 'Comparing ' + lastFile + ' to ' + nextFile, [lastFile, nextFile]);
        return new Promise((resolve, reject) =>
          next.pack()
            .pipe(fs.createWriteStream(__dirname + '/' + nextFile))
            .on('finish', resolve)
            .on('error', err => reject('Error writing to ' + nextFile + ': ' + err.code))
        );
      }
    } else if (next) {
      await new Promise((resolve, reject) =>
        fs.mkdir(__dirname + '/snapshots', {recursive: true}, err => {
          if (!err || err.code == 'EEXIST') return resolve();
          reject('Error creating screenshots dir: ' + err.code);
        }));
      return new Promise((resolve, reject) =>
        next.pack()
          .pipe(fs.createWriteStream(__dirname + '/' + lastFile))
          .on('error', err => reject('Error writing to ' + lastFile + ': ' + err.code))
          .on('finish', resolve)
      ).then(() => {
        assert(true, name + ' snapshot created', null, [lastFile]);
      });
    }
  };

  socket.on('unexpected-response', (req, res) => {
    let body = '';
    res.setEncoding('utf8');
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      assert(false, 'Open debugger connection', res.statusCode + ': ' + body);
    });
  });
   
  socket.on('message', data => {
    try {
      log.push(data.length > 1000 ? data.substr(0, 1000) + '...' : data);
      const {id, method, params, result} = JSON.parse(data);
      const key = id || method;
      const listener = listeners[key];
      if (listener) {
        delete listeners[key];
        listener(result || params);
      }
    } catch (e) {
      log.push('Error parsing ws message: ' + e);
    }
  });

  socket.on('error', console.error);
  // TODO: socket.on('close')

  await new Promise((resolve, reject) => {
    setTimeout(() => reject('Timed out connecting to ' + page.webSocketDebuggerUrl), timeout);
    socket.once('open', resolve);
  });

  assert(true, 'Open debugger connection');

  const width = 720, height = 450;
  await Promise.all([
    send('Runtime.enable'),
    send('Page.enable'),
    send('Network.enable')
  ]);
  await Promise.all([
    send('Page.navigate', {url: base}),
    send('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 0, mobile: false}),
    send('Emulation.setVisibleSize', {width, height})
  ]);
  await next('Page.loadEventFired');
  await send('Runtime.evaluate', {expression: 'location.href'}).then(result => {
    assert(result.result.value == base + '/', 'Page loaded');
  });

  await next('Network.webSocketFrameReceived', result =>
    result.response.payloadData == '{"event":"state","data":[]}'
  ).then(state => {
    assert(state, 'Socket connection established');
  });

  await snapshot('Home');

  await send('Runtime.evaluate', {
    expression: 'Array.from(document.querySelectorAll("nav li .name")).map(elem => elem.textContent).join();'
  }).then(result => {
    const list = result.result.value;
    assert(list == [
      'Database Admin', 'Hello World', 'Simple Login', 'Unit Tests', 'Web Server',
      'crypto', 'database', 'docs', 'email', 'html', 'http', 'parser', 'socket', 'string', 'system', 'websocket'
    ].join(), 'Modules loaded', list);
  });

  await send('Runtime.evaluate', {
    expression: 'document.querySelector("nav li:nth-child(4) .run").click();'
  }).then(result => {
    assert(result.result.type == 'undefined', 'Started Unit Tests app');
  });

  try {
    const errors = [];
    await next('Network.webSocketFrameReceived', result => {
      const {data: {app, message}, event} = JSON.parse(result.response.payloadData);
      if (event == 'log' && app == 'Unit Tests') {
        const line = message[0];
        if (line[0] == '✗') errors.push(line);
        return line.includes('tests complete');
      }
    });
    assert(!errors.length, 'Unit tests', errors.join('\n  '));
  } catch (e) {
    assert(false, 'Unit tests', e);
  }

  await send('Runtime.evaluate', {
    expression:
      'document.querySelector("nav li:nth-child(4) .name").click();' +
      'document.querySelector("nav .toggle").click();'
  });
  await snapshot('Log');

  await Promise.all([
    load('/apps/Web%20Server/1'),
    send('Runtime.evaluate', {
      expression:
        'document.querySelector("nav li:nth-child(4) .stop").click();' +
        'document.querySelector("nav li:nth-child(5) .name").click();' +
        'document.querySelector("nav .toggle").click();'
    })
  ]);
  await snapshot('Code');

  await Promise.all([
    load('/modules/database/1'),
    send('Runtime.evaluate', {
      expression:
        'document.querySelector("nav > ul:nth-of-type(2) li:nth-child(2) .name").click();' +
        'document.querySelector("nav > ul:nth-of-type(2) li:nth-child(2) .view").click();' +
        'document.querySelector("nav > ul:nth-of-type(2) li:nth-child(2) .view").click();' +
        'document.querySelector("nav .toggle").click();'
    })
  ]);
  await snapshot('Docs');

  try {
    // publish socket, string
    await Promise.all([
      request('/modules/socket/1', {method: 'post'}),
      request('/modules/string/1', {method: 'post'})
    ]).then(responses => {
      if (!responses.every(r => r.ok)) throw 'Publish socket, string modules: ' + responses.map(r => r.status);
    });
    // add published socket, string as dependencies to http
    await Promise.all([
      request('/modules/http/1/dependencies', {method: 'post', body: '{"name":"socket","version":1}'}),
      request('/modules/http/1/dependencies', {method: 'post', body: '{"name":"string","version":1}'})
    ]).then(responses => {
      if (!responses.every(r => r.ok)) throw 'Add dependencies to http module: ' + responses.map(r => r.status);
    });
    // publish http
    await request('/modules/http/1', {method: 'post'}).then(response => {
      if (!response.ok) throw 'Publish http module:' + response.status;
    });
    // add published http as dependency to Web Server
    await request('/apps/Web%20Server/1/dependencies', {method: 'post', body: '{"name":"http","version":1}'}).then(response => {
      if (!response.ok) throw 'Add published http module as dependency: ' + response.status;
    });
    // publish Web Server
    await request('/apps/Web%20Server/1', {method: 'post'}).then(response => {
      if (!response.ok) throw 'Publish web server app: ' + response.status;
    });
    // edit code
    await request('/apps/Web%20Server/1')
      .then(response => {
        if (response.ok) return response.json();
        throw 'Get web server code: ' + response.status;
      })
      .then(app =>
        request('/apps/Web%20Server/1', {method: 'put', body: app.code.replace('First', 'Second')})
      ).then(response => {
        if (!response.ok) throw 'Update web server code: ' + response.status;
      });
    await send('Page.navigate', {url: base + '/apps/Web%20Server/1/settings'});
    await load('/apps/Web%20Server/1');
    await send('Runtime.evaluate', {
      expression:
        'document.querySelector("nav .toggle").click();' +
        'document.querySelector(".timeline li:last-child").click();' +
        'document.querySelector(".timeline li:first-child").click();'
    });
    await snapshot('Config');
  } catch (e) {
    assert(false, 'Config snapshot', e);
  }
})
.catch(e => {
  assert(false, 'Unhandled exception', e);
})
.finally(() => {
  const total = 14;
  const failures = tests.filter(test => !test.pass).length;
  const pass = !failures && tests.length == total;
  const summary = tests.length + '/' + total + ' ran, ' + failures + ' failed';
  assert(pass, 'Tests passed', summary);
  process.exitCode = pass ? 0 : 1;

  app.kill();
  if (xvfb) xvfb.kill();

  fs.writeFile(__dirname + '/results.html',
    '<!doctype html>' +
    '<title>Simpl.js Test Results</title>' +
    '<style>' +
      '.test { padding-left: 1.5em }' +
      '.test:before { display: inline-block; margin-left: -1.5em; width: 1.5em }' +
      '.pass:before { content: "✓"; color: green }' +
      '.fail:before { content: "✗"; color: red }' +
      '.test img { width: 100%; max-width: 400px; margin: 10px 0 }' +
    '</style>' +
    '<h1>Simpl.js</h1>' +
    '<h2>Tests</h2>' +
    '<p>' + summary + '</p>' +
    tests.map(({name, pass, detail, images}) =>
      '<div class="test ' + (pass ? 'pass' : 'fail') + '">' + name +
        (!pass && detail ? '<div class="detail">' + detail + '</div>' : '') +
        '<div>' + (images || []).map(url => '<img src="' + url + '">').join(' ') + '</div>' +
      '</div>').join('') +
    '<hr><details><summary>Log</summary><pre>' +
      log.join('\n\n') +
    '</pre></details>',
    err => {
      if (err) console.error('Error writing to results.html: ' + err.code);
      else console.log('Output to results.html');
    });
});
