function(modules) {

  var host = '//localhost:'+config.apiPort,
      ws;
      
  modules.http.serve({port: config.port}, function(req, res) {
    if (req.path != '/' || ws) return res.generic(404);
    
    var close = function() {
      if (!ws) return;
      ws.close();
      ws = null;
      res.end('</testsuite>');
    };

    setTimeout(close, 10000);

    res.send('<?xml version="1.0" encoding="UTF-8"?><testsuite tests="92">', 'xml');

    fetch('http:'+host+'/token').then(function(res) { return res.text(); }).then(function(token) {
      ws = new WebSocket('ws:'+host+'/connect?token='+token);
      ws.onopen = function() {
        fetch('http:'+host+'/action', {
          method: 'POST',
          body: JSON.stringify({
            command: 'restart',
            app: 'Unit Tests',
            version: 1,
            token: token
          })
        });
      };
      ws.onmessage = function(e) {
        try { var message = JSON.parse(e.data); } catch (e) { return; }
        var data = message.data || {};
        if (message.event != 'log' || data.app != 'Unit Tests') return;
        var line = String((data.message || [])[0]),
            type = line[0],
            detail = line.substr(2);
        if (type != '✓' && type != '✗') return;
        res.send('<testcase name="'+detail+'"'+(type == '✓' ? '/>' : '><failure message="test failed"/></testcase>'));
        if (!detail.indexOf('tests complete')) close();
      };
      ws.onclose = close;
    });
  });
}
