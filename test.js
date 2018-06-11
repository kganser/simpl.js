function(modules) {

  var string = modules.string,
      host = 'http://localhost:'+config.apiPort,
      tests = [], log = [], screenshots = {};

  var run = fetch('http://localhost:'+config.debuggerPort+'/json').then(function(response) {
    return response.json();
  }).then(function(pages) {
    log.push('> pages: '+JSON.stringify(pages));
    var page = pages.find(function(page) {
      return page.url == 'chrome-extension://kdkheiopehanfbajkkopimfppjmclgbp/simpl.html'
    });
    if (!page) return log.push('> debug page not found');

    return new Promise(function(finish) {
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
            send('Emulation.setDeviceMetricsOverride', {width: 640, height: 400, deviceScaleFactor: 0, mobile: false}),
            send('Emulation.setVisibleSize', {width: 640, height: 400}),
            wait('Page.loadEventFired')
          ]);
        }).then(function() {
          return send('Runtime.evaluate', {expression: 'location.href'}).then(function(result) {
            assert(result.result.value == host+'/', 'Page loaded');
          });
        }).then(function() {
          return send('Runtime.evaluate', {expression: "Array.from(document.querySelectorAll('nav li .name')).map(elem => elem.textContent).join();"}).then(function(result) {
            assert(result.result.value == 'Database Admin,Hello World,Simple Login,Unit Tests,Web Server,test,crypto,database,docs,email,html,http,parser,socket,string,system,websocket', 'Modules loaded');
          });
        }).then(function() {
          return send('Runtime.evaluate', {expression: "document.querySelector('nav li:nth-child(4) .run').click();"}).then(function(result) {
            assert(result.result.type == 'undefined', 'Ran Unit Tests app');
          });
        }).then(function() {
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
          return send('Runtime.evaluate', {expression:
            "document.querySelector('nav li:nth-child(4) .name').click();"+
            "document.querySelector('nav .toggle').click();"}).then(function() {
            return send('Page.captureScreenshot').then(function(result) {
              screenshots.log = string.base64ToBuffer(result.data).buffer;
            });
          });
        }).then(function() {
          return send('Runtime.evaluate', {expression:
            "document.querySelector('nav li:nth-child(6)').style.display = 'none';"+
            "document.querySelector('nav li:nth-child(4) .stop').click();"+
            "document.querySelector('nav li:nth-child(5) .name').click();"+
            "document.querySelector('nav .toggle').click();"}).then(function() {
            return send('Page.captureScreenshot').then(function(result) {
              screenshots.code = string.base64ToBuffer(result.data).buffer;
            });
          });
        }).then(function() {
          return send('Runtime.evaluate', {expression:
            "document.querySelector('nav > ul:nth-of-type(2) li:nth-child(2) .name').click();"+
            "document.querySelector('nav .toggle').click();"}).then(function() {
            return send('Page.captureScreenshot').then(function(result) {
              screenshots.docs = string.base64ToBuffer(result.data).buffer;
            });
          });
        }).then(function() {
          return send('Runtime.evaluate', {expression:
            "document.querySelector('nav li:nth-child(5) .name').click();"}).then(function() {
            //return wait('Network.loadingFinished').then(function() {
            //  return send('Runtime.evaluate', {expression:
            //    "document.querySelector('#settings .publish[style=\"display: inline-block;\"]').click();"+
            //    "var _rect = document.querySelector('.CodeMirror-code > div:nth-child(10) .CodeMirror-line .cm-string').getBoundingClientRect();"+
            //    "Math.ceil(_rect.x)+','+Math.ceil(_rect.y)"}).then(function(result) {
            //    var xy = result.result.value.split(',');
            //    return send('Input.dispatchMouseEvent', {type: 'mousePressed', x: +xy[0]+20, y: +xy[1], button: 'left', clickCount: 2}).then(function() {
            //      return send('Input.dispatchKeyEvent', {type: 'char', text: 'g'}).then(function(result) {
                    return send('Runtime.evaluate', {expression:
                      "document.querySelector('nav .selected .view').click();"}).then(function() {
                      return send('Page.captureScreenshot').then(function(result) {
                        screenshots.config = string.base64ToBuffer(result.data).buffer;
                      });
                    });
            //      });
            //    });
            //  });
            //});
          });
        }).then(finish);
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
        res.end('<?xml version="1.0" encoding="UTF-8"?><testsuite tests="96">'+tests.map(function(test) {
          return '<testcase name="'+test.name+'"'+(test.pass ? '/>' : '><failure message="test failed"/></testcase>');
        }).join('')+'</testsuite>', {'Content-Type': 'text/xml; charset=utf-8'});
      });
    if (req.path == '/log')
      return run.then(function() {
        res.end(log.join('\n\n'), {'Content-Type': 'text/plain; charset=utf-8'});
      });
    if (/^\/screenshot-/.test(req.path))
      return run.then(function() {
        var screenshot = screenshots[req.path.substr(12)];
        if (screenshot) return res.end(screenshot, 'png');
        res.generic(404);
      });
    res.generic(404);
  });
}
