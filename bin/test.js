#!/usr/bin/env node
const {spawn} = require('child_process');
const os = require('os');
const fs = require('fs');
const readline = require('readline');
const {PNG} = require('pngjs');
const fetch = require('node-fetch');
const WebSocket = require('ws');

const platform = os.platform();
const debuggerPort = 8122;
const port = 8123;
const baseDir = __dirname + '/..';
const baseUrl = 'http://localhost:' + port;

const xvfb = platform != 'darwin' &&
  spawn('Xvfb', [':99', '-ac', '-screen', '0', '1280x720x16', '-nolisten', 'tcp']);

const app = spawn(baseDir + '/build/' + (
  platform == 'darwin' ? 'macos/Simpl.js.app/Contents/MacOS/nwjs' : 'linux/Simpl.js/nw'
), [
  '--remote-debugging-port=' + debuggerPort,
  '--port=' + port
], {
  encoding: 'utf8',
  env: platform == 'darwin' ? undefined : {DISPLAY: ':99'}
});

[app.stdout, app.stderr].forEach(input => {
  const tag = input == app.stdout ? '[CHROME OUT] ' : '[CHROME ERR] ';
  readline.createInterface({input}).on('line', line => {
    if (line) log.push(tag + line);
  });
});

const tests = [];
const log = [];
const timeout = 10000;
const scripts = [{url: baseUrl + '/console.js'}];

// https://github.com/GoogleChrome/puppeteer/blob/561c99/lib/Coverage.js#L269
function convertToDisjointRanges(nestedRanges) {
  const points = [];
  for (const range of nestedRanges) {
    points.push({ offset: range.startOffset, type: 0, range });
    points.push({ offset: range.endOffset, type: 1, range });
  }
  points.sort((a, b) => {
    if (a.offset !== b.offset)
      return a.offset - b.offset;
    if (a.type !== b.type)
      return b.type - a.type;
    const aLength = a.range.endOffset - a.range.startOffset;
    const bLength = b.range.endOffset - b.range.startOffset;
    if (a.type === 0)
      return bLength - aLength;
    return aLength - bLength;
  });

  const hitCountStack = [];
  const results = [];
  let lastOffset = 0;
  for (const point of points) {
    if (hitCountStack.length && lastOffset < point.offset && hitCountStack[hitCountStack.length - 1] > 0) {
      const lastResult = results.length ? results[results.length - 1] : null;
      if (lastResult && lastResult.end === lastOffset)
        lastResult.end = point.offset;
      else
        results.push({start: lastOffset, end: point.offset});
    }
    lastOffset = point.offset;
    if (point.type === 0)
      hitCountStack.push(point.range.count);
    else
      hitCountStack.pop();
  }
  return results.filter(range => range.end - range.start > 1);
}

// TODO: background.js code coverage
// TODO: handle early app crash, ws disconnect

app.on('error', console.error);

const assert = (pass, name, detail, images) => {
  console.log(pass ? '\x1b[32m✓\x1b[0m ' + name : '\x1b[31m✗\x1b[0m ' + name + '\n  ' + detail);
  log.push('[TEST] ' + (pass ? '✓ ' : '✗ ') + name + '\n  ' + detail);
  tests.push({name, pass: !!pass, detail, images});
  return pass;
};

const connect = async url => {
  const listeners = {};
  let id = 1;
  const socket = new WebSocket(url, {perMessageDeflate: false});

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
        if (key == id) delete listeners[key];
        listener(result || params);
      }
    } catch (e) {
      log.push('[ERROR] ws message: ' + e);
    }
  });

  socket.on('error', e => log.push('[ERROR] ' + e));
  // TODO: socket.on('close')

  await new Promise((resolve, reject) => {
    setTimeout(() => reject('Timed out connecting to ' + url), timeout);
    socket.once('open', resolve);
  });

  const self = {
    load: function(url) {
      return self.next('Network.requestWillBeSent', result =>
        result.request.url.split('?')[0] == baseUrl + url
      ).then(req =>
        self.next('Network.loadingFinished', result => result.requestId == req.requestId)
      );
    },
    next: function(method, test) {
      log.push('[TEST] wait for ' + method);
      return new Promise((resolve, reject) => {
        self.subscribe(method, resolve);
        setTimeout(() => {
          if (!listeners[method]) return;
          // delete listeners[method]; // prevents reject() from propagating?
          reject('Timed out waiting for ' + method);
        }, timeout);
      }).then(result =>
        !test || test(result) ? result : self.next(method, test)
      );
    },
    send: function(method, params) {
      const message = JSON.stringify({id, method, params});
      log.push('[TEST] ' + message);
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
    },
    snapshot: async function(name) {
      const id = name.toLowerCase();
      const {data} = await self.send('Page.captureScreenshot');

      const lastFile = 'snapshots/' + id + '.' + platform + '.png';
      const nextFile = 'snapshots/' + id + '.' + platform + '.new.png';

      const [last, next] = await Promise.all([
        new Promise((resolve, reject) =>
          fs.createReadStream(baseDir + '/test/' + lastFile)
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
              .pipe(fs.createWriteStream(baseDir + '/test/' + nextFile))
              .on('finish', resolve)
              .on('error', err => reject('Error writing to ' + nextFile + ': ' + err.code))
          );
        }
      } else if (next) {
        await new Promise((resolve, reject) =>
          fs.mkdir(baseDir + '/test/snapshots', {recursive: true}, err => {
            if (!err || err.code == 'EEXIST') return resolve();
            reject('Error creating screenshots dir: ' + err.code);
          }));
        return new Promise((resolve, reject) =>
          next.pack()
            .pipe(fs.createWriteStream(baseDir + '/test/' + lastFile))
            .on('error', err => reject('Error writing to ' + lastFile + ': ' + err.code))
            .on('finish', resolve)
        ).then(() => {
          assert(true, name + ' snapshot created', null, [lastFile]);
        });
      }
    },
    subscribe: function(method, listener) {
      listeners[method] = listener;
    },
  };

  return self;
};

(async () => {

  const token = await (async retries => {
    while (retries--) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      try {
        const response = await fetch(baseUrl + '/token', {timeout});
        if (response.ok) return response.text();
      } catch (e) {
        // continue
      }
    }
  })(5);

  if (!assert(token, 'Get token', token))
    return;

  const page = await fetch('http://localhost:' + debuggerPort + '/json')
    .then(data => data.json())
    .then(pages => pages.find(page => page.url == 'chrome-extension://kdkheiopehanfbajkkopimfppjmclgbp/simpl.html'));

  if (!assert(page, 'Get page from debugger'))
    return;

  const request = (path, options) =>
    fetch(baseUrl + path, {headers: {Authorization: 'Bearer ' + token}, timeout, ...options});

  await request('/restore', {method: 'post', body: 'scope=full'}).then(response => {
    assert(response.ok, 'Reset workspace', 'Returned ' + response.status);
  });

  const {send, subscribe, next, load, snapshot} = await connect(page.webSocketDebuggerUrl);

  assert(true, 'Open debugger connection');

  const width = 720, height = 450;
  await Promise.all([
    send('Runtime.enable'),
    send('Page.enable'),
    send('Network.enable'),
    send('Profiler.enable'),
    send('Debugger.enable')
  ]);
  send('Profiler.startPreciseCoverage', {callCount: false, detailed: true});
  subscribe('Debugger.scriptParsed', async ({scriptId, url}) => {
    const script = scripts.find(script => script.url == url);
    if (script) {
      script.id = scriptId;
      script.source = (await send('Debugger.getScriptSource', {scriptId})).scriptSource;
    }
  });
  await Promise.all([
    send('Page.navigate', {url: baseUrl}),
    send('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 0, mobile: false}),
    send('Emulation.setVisibleSize', {width, height})
  ]);
  await next('Page.loadEventFired');
  await send('Runtime.evaluate', {expression: 'location.href'}).then(result => {
    assert(result.result.value == baseUrl + '/', 'Page loaded');
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
    await send('Page.navigate', {url: baseUrl + '/apps/Web%20Server/1/settings'});
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

  const [profile] = await Promise.all([
    send('Profiler.takePreciseCoverage'),
    send('Profiler.stopPreciseCoverage')
  ]);

  profile.result.forEach(({scriptId, functions}) => {
    const script = scripts.find(script => script.id == scriptId);
    if (script) script.ranges = convertToDisjointRanges(
      functions.reduce((ranges, fn) => [
        ...ranges,
        ...fn.ranges
      ], [])
    );
  });

})()
.catch(e => {
  assert(false, e && e.message || e, e && e.stack);
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

  const selfClosing = new Set(
    'area base br col command embed hr img input keygen link meta param source track wbr'
      .split(' '));
  const escape = value =>
    String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const markup = node => {
    if (typeof node == 'string' || typeof node == 'number') return node;
    if (!Array.isArray(node)) return '';
    const [tag, ...children] = node;
    if (Array.isArray(tag)) return node.map(markup).join('');
    const attrs = (children[0] || '').constructor == Object
      ? children.shift() : {};
    return '<' + tag +
      Object.entries(attrs).map(([name, value]) =>
        value !== undefined && ' ' + name + (value == null ? ''
          : '="' + value + '"')
      ).filter(Boolean).join('') + '>' + (
        selfClosing.has(tag) ? ''
        : children.map(markup).join('') + '</' + tag + '>'
      );
  };
  const css = styles =>
    Object.entries(styles).map(([selector, props]) =>
      selector + '{' + Object.entries(props).map(([name, value]) =>
        name.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase() + ':' + value
      ).join(';') + '}'
    ).join('');

  fs.writeFile(baseDir + '/test/results.html',
    '<!doctype html>' + markup([
      ['title', 'Simpl.js Test Results'],
      ['style', css({
        '.test': {paddingLeft: '1.5em'},
        '.test:before': {display: 'inline-block', marginLeft: '-1.5em', width: '1.5em'},
        '.pass:before': {content: '"✓"', color: 'green'},
        '.fail:before': {content: '"✗"', color: 'red'},
        '.test img': {width: '100%', maxWidth: '400px', margin: '10px 0'},
        '.coverage table': {borderCollapse: 'collapse', font: '.6em monospace', whiteSpace: 'pre-wrap'},
        '.coverage del': {background: '#fdb8c0', textDecoration: 'none'}
      })],
      ['h1', 'Simpl.js'],
      ['h2', 'Tests'],
      ['p', summary],
      ...tests.map(({name, pass, detail, images}) =>
        ['div', {class: 'test ' + (pass ? 'pass' : 'fail')},
          name,
          !pass && detail && ['div', {class: 'detail'}, detail],
          images && ['div', images.map(src => ['img', {src}])]
        ],
      ),
      ['hr'],
      ['details',
        ['summary', 'Log'],
        ['pre', escape(log.join('\n\n'))]
      ],
      ['h2', 'Code Coverage'],
      ...scripts.map(({url, source, ranges}) => {
        // coverage spans
        const spans = [];
        let position = 0;
        ranges.forEach(range => {
          if (range.start > position)
            spans.push({text: source.substring(position, range.start), covered: false});
          spans.push({text: source.substring(range.start, range.end), covered: true});
          position = range.end;
        });
        if (position < source.length)
          spans.push({text: source.substr(position), covered: false});
        // lines
        const lines = [];
        let line = [];
        spans.forEach(({text, covered}) => {
          const [first, ...rest] = text.split(/\r?\n/g);
          if (first) line.push({text: first, covered});
          rest.forEach(text => {
            if (line.length) lines.push(line);
            line = text ? [{text, covered}] : [];
          });
        });
        if (line.length) lines.push(line);
        // blocks
        const blocks = [];
        let block;
        lines.forEach((spans, i) => {
          const covered = spans.length == 1 && spans[0].covered;
          const line = {number: i + 1, spans};
          if (block && block.covered == covered) {
            block.lines.push(line);
          } else {
            if (block) blocks.push(block);
            block = {lines: [line], covered};
          }
        });
        if (block) blocks.push(block);

        const coveredLines = lines.reduce((total, spans) =>
          spans.length == 1 && spans[0].covered ? total + 1 : total, 0);

        return ['details', {class: 'coverage'},
          ['summary', url + ' - ' + Math.floor(coveredLines / lines.length * 100) + '% lines'],
          ['table', ...blocks.map(({covered, lines}) =>
            ['tbody',
              covered
                ? ['tr', ['td', {colspan: 2}, '...']]
                : lines.map(({number, spans}) => ['tr',
                    ['td', number],
                    ['td', ...spans.map(({covered, text}) =>
                      covered ? escape(text) : ['del', escape(text)]
                    )]
                  ])
            ]
          )]
        ];
      })
    ]),
    err => {
      if (err) console.error('Error writing to results.html: ' + err.code);
    });
  fs.writeFile(baseDir + '/test/results.xml',
    '<?xml version="1.0" encoding="UTF-8"?>' + markup([
      ['testsuite', {tests: total},
        ...tests.map(({name, pass, detail}) =>
          ['testcase', {name}, pass || ['failure', {message: detail}]]
        )
      ]
    ]),
    err => {
      if (err) console.error('Error writing to results.xml: ' + err.code);
    });
});
