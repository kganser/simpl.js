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
          ttl = 5000,
          id = 1,
          token;
      var send = function(method, params) {
        var message = JSON.stringify({id: id, method: method, params: params});
        log.push('> '+message);
        socket.send(message);
        return new Promise(function(resolve) {
          var i = id++;
          callbacks[i] = resolve;
          setTimeout(function() {
            if (!callbacks[i]) return;
            log.push('> command id='+id+' timed out');
            resolve();
          }, ttl);
        });
      };
      var wait = function(method, test) {
        log.push('> wait for '+method);
        var timeout;
        return new Promise(function(resolve) {
          callbacks[method] = resolve;
          setTimeout(function() {
            if (!callbacks[method]) return;
            log.push('> wait for '+method+' timed out');
            timeout = true;
            resolve();
          }, ttl);
        }).then(function(result) {
          return timeout || !test || test(result) ? result : wait(method, test);
        });
      };
      var load = function(url) {
        return wait('Network.requestWillBeSent', function(result) {
          return result.request.url.split('?')[0] == host+url;
        }).then(function(req) {
          return wait('Network.loadingFinished', function(result) {
            return result.requestId == req.requestId;
          });
        });
      };
      var assert = function(test, description) {
        log.push('> '+(test ? '✓' : '✗')+' '+description);
        tests.push({name: description, pass: test});
      };
      socket.onopen = function() {
        log.push('> debugger connection opened');

        wait('Network.webSocketCreated').then(function(result) {
          token = result.url.split('?token=')[1];
        });

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
          return wait('Network.webSocketFrameReceived', function(result) {
            var message = '';
            try {
              var payload = JSON.parse(result.response.payloadData),
                  data = payload.data;
              if (payload.event == 'log' && data.app == 'Unit Tests') {
                message = data.message[0];
                var type = message[0];
                if (type == '✓' || type == '✗') {
                  assert(type == '✓', 'Unit tests:'+message.substr(1));
                }
              }
            } catch (e) {}
            return ~message.indexOf('tests complete');
          });
        }).then(function() {
          return Promise.all([
            load('/apps/Unit%20Tests/1'),
            send('Runtime.evaluate', {expression:
              "document.querySelector('nav li:nth-child(4) .name').click();"+
              "document.querySelector('nav .toggle').click();"})
          ]).then(function() {
            return send('Page.captureScreenshot').then(function(result) {
              assert(typeof result.data == 'string', 'Log screenshot');
              screenshots.log = string.base64ToBuffer(result.data).buffer;
            });
          });
        }).then(function() {
          return Promise.all([
            load('/apps/Web%20Server/1'),
            send('Runtime.evaluate', {expression:
              "document.querySelector('nav li:nth-child(6)').style.display = 'none';"+
              "document.querySelector('nav li:nth-child(4) .stop').click();"+
              "document.querySelector('nav li:nth-child(5) .name').click();"+
              "document.querySelector('nav .toggle').click();"})
          ]).then(function() {
            return send('Page.captureScreenshot').then(function(result) {
              assert(typeof result.data == 'string', 'Code screenshot');
              screenshots.code = string.base64ToBuffer(result.data).buffer;
            });
          });
        }).then(function() {
          return Promise.all([
            load('/modules/database/1'),
            send('Runtime.evaluate', {expression:
              "document.querySelector('nav > ul:nth-of-type(2) li:nth-child(2) .name').click();"+
              "document.querySelector('nav .toggle').click();"})
          ]).then(function() {
            return send('Page.captureScreenshot').then(function(result) {
              assert(typeof result.data == 'string', 'Docs screenshot');
              screenshots.docs = string.base64ToBuffer(result.data).buffer;
            });
          });
        }).then(function() {
          // publish socket, string
          return Promise.all([
            fetch(host+'/modules/socket/1?token='+token, {method: 'POST'}),
            fetch(host+'/modules/string/1?token='+token, {method: 'POST'})
          ]).then(function() {
            // add published socket, string as dependencies to http
            return Promise.all([
              fetch(host+'/modules/http/1/dependencies?token='+token, {method: 'POST', body: '{"name":"socket",version:1}'}),
              fetch(host+'/modules/http/1/dependencies?token='+token, {method: 'POST', body: '{"name":"string",version:1}'})
            ]);
          }).then(function() {
            // publish http
            return fetch(host+'/modules/http/1?token='+token, {method: 'POST'});
          }).then(function() {
            // add published http as dependency to Web Server
            return fetch(host+'/apps/Web%20Server/1/dependencies?token='+token, {method: 'POST', body: '{"name":"http","version":1}'});
          }).then(function() {
            // publish Web Server
            return fetch(host+'/apps/Web%20Server/1?token='+token, {method: 'POST'});
          }).then(function() {
            // edit code
            return fetch(host+'/apps/Web%20Server/1').then(function(response) {
              return response.json();
            }).then(function(app) {
              return fetch(host+'/apps/Web%20Server/1?token='+token, {method: 'PUT', body: app.code.replace('First', 'Second')});
            });
          }).then(function(result) {
            return send('Page.navigate', {url: host+'/apps/Web%20Server/1/settings'});
          }).then(function(result) {
            return load('/apps/Web%20Server/1');
          }).then(function(result) {
            return send('Runtime.evaluate', {expression:
              "document.querySelector('nav .toggle').click();"+
              "document.querySelector('.timeline li:last-child').click();"+
              "document.querySelector('.timeline li:first-child').click();"});
          }).then(function(result) {
            return send('Page.captureScreenshot').then(function(result) {
              assert(typeof result.data == 'string', 'Config screenshot');
              screenshots.config = string.base64ToBuffer(result.data).buffer;
            });
          });
        }).finally(finish);
      };
      socket.onmessage = function(e) {
        log.push(e.data.length > 1000 ? e.data.substr(0, 1000)+'...' : e.data);
        try { var data = JSON.parse(e.data); } catch (e) { return; }
        var key = data.id || data.method;
        var callback = callbacks[key];
        if (callback) {
          delete callbacks[key];
          callback(data.result || data.params)
        }
      };
    });
  });

  modules.http.serve({port: config.port}, function(req, res) {

    if (req.path == '/results')
      return run.then(function() {
        res.end('<?xml version="1.0" encoding="UTF-8"?><testsuite tests="'+tests.length+'">'+tests.map(function(test) {
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
        res.generic(404, 'txt');
      });
    res.generic(404);
  });
}
