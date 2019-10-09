(async ({string, http}) => {

  const host = 'http://localhost:' + config.apiPort;
  const tests = [], log = [], screenshots = {};

  const run = fetch('http://localhost:' + config.debuggerPort + '/json')
    .then(data => data.json())
    .then(pages => {

    log.push('> pages: ' + JSON.stringify(pages));
    const page = pages.find(page => page.url == 'chrome-extension://kdkheiopehanfbajkkopimfppjmclgbp/simpl.html');
    if (!page) return log.push('> debug page not found');

    return new Promise(finish => {
      const socket = new WebSocket(page.webSocketDebuggerUrl);
      const callbacks = {};
      const ttl = 5000;
      let id = 1, token;
      const send = (method, params) => {
        const message = JSON.stringify({id, method, params});
        log.push('> ' + message);
        socket.send(message);
        return new Promise(resolve => {
          const i = id++;
          callbacks[i] = resolve;
          setTimeout(() => {
            if (!callbacks[i]) return;
            log.push('> command id=' + id + ' timed out');
            resolve();
          }, ttl);
        });
      };
      const wait = (method, test) => {
        log.push('> wait for ' + method);
        let timeout;
        return new Promise(resolve => {
          callbacks[method] = resolve;
          setTimeout(() => {
            if (!callbacks[method]) return;
            log.push('> wait for ' + method + ' timed out');
            timeout = true;
            resolve();
          }, ttl);
        }).then(result =>
          timeout || !test || test(result) ? result : wait(method, test)
        );
      };
      const load = url =>
        wait('Network.requestWillBeSent', result =>
          result.request.url.split('?')[0] == host + url
        ).then(req =>
          wait('Network.loadingFinished', result => result.requestId == req.requestId)
        );
      const assert = (test, description) => {
        log.push('> ' + (test ? '✓' : '✗') + ' ' + description);
        tests.push({name: description, pass: test});
      };
      socket.onopen = async () => {
        log.push('> debugger connection opened');

        wait('Network.webSocketCreated').then(result => {
          token = result.url.split('?token=')[1];
        });

        await Promise.all([
          send('Runtime.enable'),
          send('Page.enable'),
          send('Network.enable')
        ])
        await Promise.all([
          send('Page.navigate', {url: host}),
          send('Emulation.setDeviceMetricsOverride', {width: 640, height: 400, deviceScaleFactor: 0, mobile: false}),
          send('Emulation.setVisibleSize', {width: 640, height: 400})
        ]);
        await wait('Page.loadEventFired');
        await send('Runtime.evaluate', {expression: 'location.href'}).then(result => {
          assert(result.result.value == host + '/', 'Page loaded');
        });
        const state = await wait('Network.webSocketFrameReceived', result =>
          result.response.payloadData == '{"event":"state","data":["test@1"]}'
        );
        assert(state, 'Socket connection established');
        await send('Runtime.evaluate', {expression: "Array.from(document.querySelectorAll('nav li .name')).map(elem => elem.textContent).join();"}).then(result => {
          assert(result.result.value == 'Database Admin,Hello World,Simple Login,Unit Tests,Web Server,test,crypto,database,docs,email,html,http,parser,socket,string,system,websocket', 'Modules loaded');
        });
        await send('Runtime.evaluate', {expression: "document.querySelector('nav li:nth-child(4) .run').click();"}).then(result => {
          assert(result.result.type == 'undefined', 'Ran Unit Tests app');
        });
        await wait('Network.webSocketFrameReceived', result => {
          let lastMessage = '';
          try {
            const {data: {app, message}, event} = JSON.parse(result.response.payloadData);
            if (event == 'log' && app == 'Unit Tests') {
              lastMessage = message[0];
              const type = message[0][0];
              if (type == '✓' || type == '✗') {
                assert(type == '✓', 'Unit tests:' + message[0].substr(1));
              }
            }
          } catch (e) {}
          return lastMessage.includes('tests complete');
        });
        await send('Runtime.evaluate', {expression:
            "document.querySelector('nav li:nth-child(4) .name').click();" +
            "document.querySelector('nav .toggle').click();"});
        await send('Page.captureScreenshot').then(result => {
          assert(typeof result.data == 'string', 'Log screenshot');
          screenshots.log = string.base64ToBuffer(result.data).buffer;
        });
        await Promise.all([
          load('/apps/Web%20Server/1'),
          send('Runtime.evaluate', {expression:
            "document.querySelector('nav li:nth-child(6)').style.display = 'none';" +
            "document.querySelector('nav li:nth-child(4) .stop').click();" +
            "document.querySelector('nav li:nth-child(5) .name').click();" +
            "document.querySelector('nav .toggle').click();"})
        ]);
        await send('Page.captureScreenshot').then(result => {
          assert(typeof result.data == 'string', 'Code screenshot');
          screenshots.code = string.base64ToBuffer(result.data).buffer;
        });
        await Promise.all([
          load('/modules/database/1'),
          send('Runtime.evaluate', {expression:
            "document.querySelector('nav > ul:nth-of-type(2) li:nth-child(2) .name').click();" +
            "document.querySelector('nav > ul:nth-of-type(2) li:nth-child(2) .view').click();" +
            "document.querySelector('nav > ul:nth-of-type(2) li:nth-child(2) .view').click();" +
            "document.querySelector('nav .toggle').click();"})
        ]);
        await send('Page.captureScreenshot').then(result => {
          assert(typeof result.data == 'string', 'Docs screenshot');
          screenshots.docs = string.base64ToBuffer(result.data).buffer;
        });
        // publish socket, string
        await Promise.all([
          fetch(host + '/modules/socket/1?token=' + token, {method: 'POST'}),
          fetch(host + '/modules/string/1?token=' + token, {method: 'POST'})
        ]);
        // add published socket, string as dependencies to http
        await Promise.all([
          fetch(host + '/modules/http/1/dependencies?token=' + token, {method: 'POST', body: '{"name":"socket",version:1}'}),
          fetch(host + '/modules/http/1/dependencies?token=' + token, {method: 'POST', body: '{"name":"string",version:1}'})
        ]);
        // publish http
        await fetch(host + '/modules/http/1?token=' + token, {method: 'POST'});
        // add published http as dependency to Web Server
        await fetch(host + '/apps/Web%20Server/1/dependencies?token=' + token, {method: 'POST', body: '{"name":"http","version":1}'});
        // publish Web Server
        await fetch(host + '/apps/Web%20Server/1?token=' + token, {method: 'POST'});
        // edit code
        await fetch(host + '/apps/Web%20Server/1')
          .then(response => response.json())
          .then(app =>
            fetch(host + '/apps/Web%20Server/1?token=' + token, {method: 'PUT', body: app.code.replace('First', 'Second')})
          );
        await send('Page.navigate', {url: host + '/apps/Web%20Server/1/settings'});
        await load('/apps/Web%20Server/1');
        await send('Runtime.evaluate', {expression:
          "document.querySelector('nav .toggle').click();" +
          "document.querySelector('.timeline li:last-child').click();" +
          "document.querySelector('.timeline li:first-child').click();"});
        await send('Page.captureScreenshot').then(result => {
          assert(typeof result.data == 'string', 'Config screenshot');
          screenshots.config = string.base64ToBuffer(result.data).buffer;
        });
        finish();
      };
      socket.onmessage = e => {
        log.push(e.data.length > 1000 ? e.data.substr(0, 1000) + '...' : e.data);
        try {
          const data = JSON.parse(e.data);
          const key = data.id || data.method;
          const callback = callbacks[key];
          if (callback) {
            delete callbacks[key];
            callback(data.result || data.params)
          }
        } catch (e) {}
      };
    });
  });

  http.serve({port: config.port}, async (req, res) => {
    if (req.path == '/results') {
      await run;
      return res.end(
        '<?xml version="1.0" encoding="UTF-8"?><testsuite tests="' + tests.length + '">' +
        tests.map(test =>
          '<testcase name="' + test.name + '"' + (test.pass ? '/>' : '><failure message="test failed"/></testcase>')
        ).join('')
        + '</testsuite>',
        {'Content-Type': 'text/xml; charset=utf-8'}
      );
    }
    if (req.path == '/log') {
      await run;
      return res.end(log.join('\n\n'), {'Content-Type': 'text/plain; charset=utf-8'});
    }
    if (/^\/screenshot-/.test(req.path)) {
      await run;
      const screenshot = screenshots[req.path.substr(12)];
      if (screenshot) return res.end(screenshot, 'png');
      res.generic(404, 'txt');
    }
    res.generic(404);
  });
})
