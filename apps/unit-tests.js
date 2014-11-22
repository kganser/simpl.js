var passed = 0, assert = function(test, description) {
  if (test) {
    passed++;
    console.log('✓ '+description);
  } else {
    console.error('✗ '+description);
  }
  return test;
};
var compare = function(a, b) {
  if (a === b) return true;
  var ta = typeof a, tb = typeof b;
  if (ta != tb || ta != 'object' || !(a && b) || (ta = Array.isArray(a)) != Array.isArray(b))
    return false;
  if (ta) return a.length == b.length && !a.some(function(n, i) { return !compare(n, b[i]); });
  var ka = Object.keys(a);
  return compare(ka, Object.keys(b)) && !ka.some(function(k) { return !compare(a[k], b[k]); });
};
simpl.use({async: 0, database: 0, docs: 0, html: 0, string: 0}, function(o) {
  o.async.step(
    function(next, pass) {
      next(assert(pass === undefined, 'async step no argument'));
    },
    function(next, pass) {
      o.async.join(
        function(cb) { assert(pass === true, 'async step with argument'); cb(pass = 1); },
        function(cb) { cb(pass = pass === 1 && 2); },
        function(a, b) { assert(pass === 2, 'async join with sync functions'); }
      );
      o.async.join(
        function(cb) { setTimeout(function() { cb(pass = pass === 3 && 5); }, 10); },
        function(cb) { setTimeout(function() { cb(pass = pass === 2 && 3, 4); }, 0); },
        function(a, b) {
          next(assert(pass === 5 && a === 5 && typeof b == 'object' && b.length == 2 && b[0] === 3 && b[1] === 4,
            'async join with async functions, multiple callback args'));
        }
      );
    },
    function(next) {
      o.database.list(function(dbs) {
        assert(typeof dbs == 'object' && dbs.toString() == '[object DOMStringList]',
          'database list: '+Array.prototype.slice.call(dbs).join(', '));
        if (!dbs.contains('unit-tests')) return next();
        o.database.delete('unit-tests', function(error, blocked) {
          if (!blocked && !error) next();
        });
      });
    },
    function(next) {
      var data = {array: ['elem', 1, null], object: {boolean: true}, string: 'value'},
          db = o.database.open('unit-tests', data);
      db.get().get('array').then(function(root, array) {
        assert(compare(root, data), 'database get root');
        assert(compare(array, data.array), 'database get path');
        db.put('object/boolean', false).then(function() {
          this.get('object/boolean').then(function(result) {
            assert(result === false, 'database put');
            this.put('array/2', 2, true).then(function() {
              this.get('array').then(function(result) {
                assert(compare(['elem', 1, 2, null], result), 'database insert');
                this.append('array', 3).then(function() {
                  this.get('array').then(function(result) {
                    assert(compare(['elem', 1, 2, null, 3], result), 'database append');
                    this.delete('object').then(function() {
                      this.get().get('object').get('object/boolean').then(function(all, deleted, child) {
                        assert(compare({array: ['elem', 1, 2, null, 3], string: 'value'}, all) && deleted === undefined && child === undefined,
                          'database delete record');
                      });
                    });
                  });
                });
              });
            });
          });
        });
        db.get().then(function(result) {
          assert(compare(data, result), 'database read transaction during write transaction');
        });
        db.get('', true).then(function(result) {
          assert(compare({array: ['elem', 1, 2, null, 3], string: 'value'}, result),
            'database write transaction after write transaction');
          var i = 1;
          this.get('', function(path, array) {
            assert(!path.length && !array && i == 1 || path.length == 1 && path[0] === 'array' && array && i == 2,
              'database cursor arguments '+i++);
            return path.length ? function(key) {
              if (key > 2) return 'stop';
            } : {
              upperBound: 'string',
              upperExclusive: true
            };
          }).then(function(result) {
            assert(i == 3 && compare({array: ['elem', 1, 2]}, result), 'database cursor result');
            db.close();
            o.database.delete('unit-tests', function(error, blocked) {
              if (!blocked) next(assert(!error, 'database delete'));
            });
          });
        });
      });
    },
    function(next) {
      var code = '/* comment */ var i = 0; // comment\n/** name: {fn: function(arg1:boolean|string, arg2=undefined:[number, ...]) -> {key:value}, str: string}\n\n first\n second\n\n third */',
          doc = o.docs.generate(code);
      assert(compare(doc,[{spec:{name:'name',type:{object:[{name:'fn',type:{function:{args:[{name:'arg1',type:['boolean','string']},{name:'arg2',default:'undefined',type:{array:[{type:'number'},'...']}}],returns:{object:{name:'key',type:'value'}}}}},{name:'str',type:'string'}]}},error:null,text:[['first second'],['third']]}]),
        'docs generate');
      assert(o.docs.stringify(code) == 'name: {\n  fn: function(arg1: boolean|string, arg2=undefined: [number, ...]) → {key: value},\n  str: string\n}\n\nfirst second\n\nthird',
        'docs stringify');
      assert(o.docs.stringifySpec(doc[0].spec) == 'name: {\n  fn: function(arg1: boolean|string, arg2=undefined: [number, ...]) → {key: value},\n  str: string\n}',
        'docs stringifySpec');
      
      assert(o.html.markup({div: 'hello'}) === '<div>hello</div>',
        'html markup basic');
      assert(o.html.markup({div: [{a: {href: '#', children: 'link'}}, 'hello']}) === '<div><a href="#">link</a>hello</div>',
        'html markup nested');
      assert(o.html.markup([{link: {rel: 'stylesheet'}}, {br: null}]) === '<link rel="stylesheet"><br>',
        'html markup self-closing tags');
      assert(o.html.markup({script: function(a) { if (!a) return 'a'; }}) === '<script>(function (a) { if (!a) return \'a\'; }("a"));</script>',
        'html markup inline code');
      assert(o.html.markup({script: function(a) { if (!a) return ['a', 'b']; }}) === '<script>(function (a) { if (!a) return [\'a\', \'b\']; }(["a","b"]));</script>',
        'html markup inline code single arg');
      assert(o.html.markup({script: function(a, b) { if (!a) return ['a', 'b']; }}) === '<script>(function (a, b) { if (!a) return [\'a\', \'b\']; }("a","b"));</script>',
        'html markup inline code multiple args');
      assert(o.html.markup([{a: {title: '"hello & goodbye"', children: 'hello <& goodbye'}}, {script: function() { '</script>'; }}]) === '<a title="&quot;hello &amp; goodbye&quot;">hello &lt;&amp; goodbye</a><script>(function () { \'<\\/script>\'; }());</script>',
        'html markup escaped');
        
      var uint8 = [116,101,115,116,32,49,50,51,32,195,161,195,169,195,173,195,179,195,186],
          str = 'test 123 áéíóú',
          buf = o.string.toUTF8Buffer(str);
      assert(buf.length == uint8.length && !uint8.some(function(n, i) { return n != buf[i]; }), 'string to buffer');
      assert(o.string.fromUTF8Buffer(new Uint8Array(uint8).buffer) === str, 'string from buffer');
      assert(passed == 29, 'All tests passed ('+passed+'/29)');
    }
  );
})