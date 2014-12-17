simpl.add('net', function(modules, proxy) {

  proxy = proxy({
    getInterfaces: function(args, callback) {
      getInterfaces(callback);
    }
  });
  
  if (simpl.worker) return {
    getInterfaces: function(callback) {
      proxy('getInterfaces', null, callback);
    }
  };
  
  var getInterfaces = function(callback) {
    chrome.system.network.getNetworkInterfaces(callback);
  };
  
  /** net: {
        getInterfaces: function(callback:function([NetworkInterface, ...]))
      }
      
      Network adapter information. */
  
  /** NetworkInterface: {
        name: string,
        address: string,
        prefixLength: number
      } */
  return {
    getInterfaces: getInterfaces
  };
});