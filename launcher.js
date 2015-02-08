var bg = chrome.runtime.connect(),
    link = document.getElementById('link'),
    action = document.getElementById('action'),
    port = document.getElementById('port'),
    error = document.getElementById('error');
port.focus();
bg.onMessage.addListener(function(message) {
  var started = message.action == 'start';
  if (!message.error) {
    action.value = started ? 'Stop' : 'Launch';
    if (message.port) port.value = message.port;
    if (started) {
      link.setAttribute('href', 'http://localhost:'+message.port+message.path);
      if (message.path) {
        link.click();
        link.setAttribute('href', 'http://localhost:'+message.port);
      }
    } else {
      link.removeAttribute('href');
    }
  }
  error.textContent = message.error || '';
  action.disabled = false;
  if (!(port.disabled = started && !message.error))
    port.focus();
});
document.launcher.onsubmit = function(e) {
  e.preventDefault();
  error.textContent = '';
  if (action.value == 'Launch') {
    var p = /^\d+$/.test(port.value) && parseInt(port.value, 10);
    if (!p || p.toString(16).length > 8) {
      error.textContent = 'Invalid port number';
      return port.focus();
    }
    bg.postMessage({action: 'start', port: p});
  } else {
    bg.postMessage({action: 'stop'});
  }
  action.disabled = true;
};
