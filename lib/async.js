kernel.add('async', function() {
  return {
    // Executes all but last function(callback) arguments in parallel, then
    // executes last argument function with arguments as provided to callbacks
    // by the previous functions, in specified order.
    join: function() {
      var results = [],
          count = arguments.length-1,
          callback = arguments[count];
      Array.prototype.slice.call(arguments, 0, -1).forEach(function(fn, i) {
        fn(function() {
          results[i] = arguments;
          if (!--count) callback.apply(null, results);
        });
      });
    }
  };
});
