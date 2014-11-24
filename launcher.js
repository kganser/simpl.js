var port = chrome.runtime.connect(),
    action = document.getElementById('action'),
    input = document.getElementById('port'),
    error = document.getElementById('error');
port.onMessage.addListener(function(message) {
  if (!message.error) {
    action.textContent = message.action == 'start' ? 'Stop' : 'Launch';
    if (message.action == 'start') open('http://localhost:'+message.port);
  }
  error.textContent = message.error || '';
  action.disabled = false;
});
action.onclick = function() {
  error.textContent = '';
  if (this.textContent == 'Launch') {
    var p = parseInt(input.value, 10);
    if (!(p > 0)) return error.textContent = 'Invalid port number';
    port.postMessage({action: 'start', port: p});
  } else {
    port.postMessage({action: 'stop'});
  }
  this.disabled = true;
};