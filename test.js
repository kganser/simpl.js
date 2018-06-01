function(modules) {

  var string = modules.string,
      host = 'http://localhost:'+config.apiPort,
      tests = [], log = [], screenshot;

  var run = fetch('http://localhost:'+config.debuggerPort+'/json').then(function(response) {
    return response.json();
  }).then(function(pages) {
    log.push('> pages: '+JSON.stringify(pages));
    var page = pages.find(function(page) {
      return page.url == 'chrome-extension://kdkheiopehanfbajkkopimfppjmclgbp/simpl.html'
    });
    if (!page) return log.push('> debug page not found');

    return new Promise(function(resolve) {
      var socket = new WebSocket(page.webSocketDebuggerUrl),
          callbacks = {},
          id = 1;
      var send = function(method, params) {
        var message = JSON.stringify({id: id, method: method, params: params});
        log.push('> '+message);
        socket.send(message);
        return new Promise(function(resolve) {
          callbacks[id++] = resolve;
        });
      };
      var wait = function(method) {
        log.push('> wait for '+method);
        return new Promise(function(resolve) {
          callbacks[method] = resolve;
        });
      };
      var assert = function(test, description) {
        log.push('> '+(test ? '✓' : '✗')+' '+description);
        tests.push({name: description, pass: test});
      };
      socket.onopen = function() {
        log.push('> debugger connection opened');
        Promise.all([
          send('Runtime.enable'),
          send('Page.enable'),
          send('Network.enable')
        ]).then(function() {
          return send('Page.navigate', {url: host});
        }).then(function() {
          return Promise.all([,
            send('Emulation.setDeviceMetricsOverride', {width: 600, height: 400, deviceScaleFactor: 0, mobile: false}),
            send('Emulation.setVisibleSize', {width: 600, height: 400}),
            wait('Page.loadEventFired')
          ]);
        }).then(function() {
          return send('Runtime.evaluate', {expression: 'location.href'});
        }).then(function(result) {
          assert(result.result.value == host+'/', 'Page loaded');
          return send('Runtime.evaluate', {expression: "Array.from(document.querySelectorAll('nav li .name')).map(elem => elem.textContent).join();"});
        }).then(function(result) {
          assert(result.result.value == 'Database Admin,Hello World,Simple Login,Unit Tests,Web Server,test,crypto,database,docs,email,html,http,parser,socket,string,system,websocket', 'Modules loaded');
          return send('Runtime.evaluate', {expression: "document.querySelector('nav li:nth-child(4) .run').click();"});
        }).then(function(result) {
          assert(result.result.type == 'undefined', 'Ran Unit Tests app');
          return function read() {
            return wait('Network.webSocketFrameReceived').then(function(params) {
              var message = '';
              try {
                var payload = JSON.parse(params.response.payloadData),
                    data = payload.data;
                if (payload.event == 'log' && data.app == 'Unit Tests') {
                  message = data.message[0];
                  var type = message[0];
                  if (type == '✓' || type == '✗') {
                    assert(type == '✓', 'Unit tests:'+message.substr(1));
                  }
                }
              } catch (e) {}
              if (message.indexOf('tests complete') < 0)
                return read();
            });
          }();
        }).then(function() {
          return send('Page.captureScreenshot');
        }).then(function(result) {
          screenshot = string.base64ToBuffer(result.data).buffer;
          resolve();
        });
      };
      socket.onmessage = function(e) {
        log.push(e.data.substr(0, 1000));
        try { var data = JSON.parse(e.data); } catch (e) { return; }
        var key = data.id || data.method;
        var callback = callbacks[key];
        if (callback) {
          delete callbacks[key];
          callback(data.result || data.params);
        }
      };
    });
  });

  modules.http.serve({port: config.port}, function(req, res) {

    if (req.path == '/results')
      return run.then(function() {
        res.end('<?xml version="1.0" encoding="UTF-8"?><testsuite tests="95">'+tests.map(function(test) {
          return '<testcase name="'+test.name+'"'+(test.pass ? '/>' : '><failure message="test failed"/></testcase>');
        }).join('')+'</testsuite>', {'Content-Type': 'text/xml; charset=utf-8'});
      });
    if (req.path == '/log')
      return run.then(function() {
        res.end(log.join('\n\n'), {'Content-Type': 'text/plain; charset=utf-8'});
      });
    if (req.path == '/screenshot')
      return run.then(function() {
        if (screenshot) return res.end(screenshot, 'png');
        res.generic(404);
      });
    res.generic(404);
  });
}
