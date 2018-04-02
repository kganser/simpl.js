var bg = chrome.runtime.connect(),
    link = document.getElementById('link'),
    action = document.getElementById('action'),
    port = document.getElementById('port'),
    info = document.getElementById('info');
port.focus();
link.onclick = function(e) {
  e.preventDefault();
  chrome.browser.openTab({url: this.getAttribute('href')});
};
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
  if (started) {
    info.textContent = message.error || 'Keep this window open while using Simpl.js';
    info.style.color = message.error ? 'red' : 'black';
  }
  action.disabled = false;
  if (!(port.disabled = started && !message.error))
    port.focus();
});
document.launcher.onsubmit = function(e) {
  if (e) e.preventDefault();
  info.textContent = '';
  if (action.value == 'Launch') {
    var p = /^\d+$/.test(port.value) && parseInt(port.value, 10);
    if (!p || p.toString(16).length > 8) {
      info.textContent = 'Invalid port number';
      info.style.color = 'red';
      return port.focus();
    }
    bg.postMessage({action: 'start', port: p});
  } else {
    bg.postMessage({action: 'stop'});
  }
  action.disabled = true;
};
