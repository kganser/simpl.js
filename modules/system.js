simpl.add('system', function(modules, proxy) {

  proxy = proxy({
    getCPUInfo: function(args, callback) {
      getCPUInfo(callback);
    },
    getDisplayInfo: function(args, callback) {
      getDisplayInfo(callback);
    },
    getMemoryInfo: function(args, callback) {
      getMemoryInfo(callback);
    },
    getNetworkInterfaces: function(args, callback) {
      getNetworkInterfaces(callback);
    },
    getStorageInfo: function(args, callback) {
      getStorageInfo(callback);
    }
  });
  
  if (simpl.worker) return {
    cpu: {
      getInfo: function(callback) {
        proxy('getCPUInfo', null, callback);
      }
    },
    display: {
      getInfo: function(callback) {
        proxy('getDisplayInfo', null, callback);
      }
    },
    memory: {
      getInfo: function(callback) {
        proxy('getMemoryInfo', null, callback);
      }
    },
    network: {
      getInterfaces: function(callback) {
        proxy('getNetworkInterfaces', null, callback);
      }
    },
    storage: {
      getInfo: function(callback) {
        proxy('getStorageInfo', null, callback);
      }
    }
  };
  
  var getCPUInfo = function(callback) {
    chrome.system.cpu.getInfo(callback);
  };
  var getDisplayInfo = function(callback) {
    chrome.system.display.getInfo(callback);
  };
  var getMemoryInfo = function(callback) {
    chrome.system.memory.getInfo(callback);
  };
  var getNetworkInterfaces = function(callback) {
    chrome.system.network.getNetworkInterfaces(callback);
  };
  var getStorageInfo = function(callback) {
    chrome.system.storage.getInfo(callback);
  };
  
  /** system: {
        cpu: {
          getInfo: function(callback:function(CPUInfo))
        },
        memory: {
          getInfo: function(callback:function(MemoryInfo))
        },
        network: {
          getInterfaces: function(callback:function([NetworkInterface, ...]))
        },
        storage: {
          getInfo: function(callback:function([StorageUnitInfo, ...]))
        }
      }
      
      System settings and information. */
  
  /** CPUInfo: {
        numOfProcessors: number,
        archName: string,
        modelName: string,
        features: [string, ...],
        processors: [ProcessorInfo]
      } */
  /** DisplayInfo: {
        id: string,
        name: string,
        mirroringSourceId: string,
        isPrimary: boolean,
        isInternal: boolean,
        isEnabled: boolean,
        dpiX: number,
        dpiY: number,
        rotation: number,
        bounds: Bounds,
        overscan: Insets,
        workArea: Bounds
      } */
  /** Bounds: {
        left: number,
        top: number,
        width: number,
        height: number
      } */
  /** Insets: {
        left: number,
        top: number,
        right: number,
        bottom: number
      } */
  /** ProcessorInfo: {
        usage: {
          user: number,
          kernel: number,
          idle: number
        }
      } */
  /** MemoryInfo: {
        capacity: number,
        availableCapacity: number
      } */
  /** NetworkInterface: {
        name: string,
        address: string,
        prefixLength: number
      } */
  /** StorageUnitInfo: {
        id: string,
        name: string,
        type: string,
        capacity: number
      } */
  return {
    cpu: {
      getInfo: getCPUInfo
    },
    memory: {
      getInfo: getMemoryInfo
    },
    network: {
      getInterfaces: getNetworkInterfaces
    },
    storage: {
      getInfo: getStorageInfo
    }
  };
});