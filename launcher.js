var bg = chrome.runtime.connect(),
    action = document.getElementById('action'),
    port = document.getElementById('port'),
    error = document.getElementById('error');
if (window.running) action.textContent = 'Stop';
bg.onMessage.addListener(function(message) {
  if (!message.error) {
    action.textContent = message.action == 'start' ? 'Stop' : 'Launch';
    if (message.action == 'start' && message.port)
      open('http://localhost:'+message.port); // TODO: switch to window if already open
  }
  error.textContent = message.error || '';
  action.disabled = false;
});
action.onclick = function() {
  error.textContent = '';
  if (this.textContent == 'Launch') {
    var p = parseInt(port.value, 10);
    if (!(p > 0)) return error.textContent = 'Invalid port number';
    bg.postMessage({action: 'start', port: p});
  } else {
    bg.postMessage({action: 'stop'});
  }
  this.disabled = true;
};