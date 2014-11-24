var bg = chrome.runtime.connect(),
    action = document.getElementById('action'),
    port = document.getElementById('port'),
    error = document.getElementById('error');
bg.onMessage.addListener(function(message) {
  var started = message.action == 'start';
  if (!message.error) {
    action.value = started ? 'Stop' : 'Launch';
    if (message.port) port.value = message.port;
    if (message.action == 'start' && !message.init)
      open('http://localhost:'+message.port); // TODO: switch to window if already open
  }
  error.textContent = message.error || '';
  port.disabled = started && !message.error;
  action.disabled = false;
});
document.launcher.onsubmit = function(e) {
  e.preventDefault();
  error.textContent = '';
  if (action.value == 'Launch') {
    var p = /^\d+$/.test(port.value) && parseInt(port.value, 10);
    if (!p) return error.textContent = 'Invalid port number';
    bg.postMessage({action: 'start', port: p});
  } else {
    bg.postMessage({action: 'stop'});
  }
  action.disabled = true;
};