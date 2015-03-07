function(modules) {

  var assert = function(test, description) {
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
  
  var passed = 0, start = Date.now();
  
  modules.async.step(
    function(next, pass) {
      next(assert(pass === undefined, 'async step no argument'));
    },
    function(next, pass) {
      modules.async.join(
        function(cb) { assert(pass === true, 'async step with argument'); cb(pass = 1); },
        function(cb) { cb(pass = pass === 1 && 2); },
        function(a, b) { assert(pass === 2, 'async join with sync functions'); }
      );
      modules.async.join(
        function(cb) { setTimeout(function() { cb(pass = pass === 3 && 5); }, 10); },
        function(cb) { setTimeout(function() { cb(pass = pass === 2 && 3, 4); }, 0); },
        function(a, b) {
          next(assert(pass === 5 && a === 5 && typeof b == 'object' && b.length == 2 && b[0] === 3 && b[1] === 4,
            'async join with async functions, multiple callback args'));
        }
      );
    },
    function(next) {
      modules.database.list(function(dbs) {
        assert(typeof dbs == 'object' && dbs.toString() == '[object DOMStringList]',
          'database list: '+Array.prototype.slice.call(dbs).join(', '));
        if (!dbs.contains('unit-tests')) return next();
        modules.database.delete('unit-tests', function(error, blocked) {
          if (!blocked && !error) next();
        });
      });
    },
    function(next) {
      var data = {array: ['elem', 1, null], object: {boolean: true}, string: 'value'},
          db = modules.database.open('unit-tests', data);
      db.get().get('array').then(function(root, array) {
        assert(compare(root, data), 'database get root');
        assert(compare(array, data.array), 'database get path');
        db.put('object/boolean', false).then(function() {
          this.get('object/boolean').then(function(result) {
            assert(result === false, 'database put');
            this.insert('array/2', 2).then(function() {
              this.get('array').then(function(result) {
                assert(compare(['elem', 1, 2, null], result), 'database insert');
                this.append('array', 3).then(function() {
                  this.get('array').then(function(result) {
                    assert(compare(['elem', 1, 2, null, 3], result), 'database append');
                    this.delete('object').then(function() {
                      this.get().get('object').get('object/boolean').then(function(all, deleted, child) {
                        assert(compare({array: ['elem', 1, 2, null, 3], string: 'value'}, all) && deleted === undefined && child === undefined,
                          'database delete record');
                        this.delete('array/3').then(function() {
                          this.get('array').then(function(result) {
                            assert(compare(['elem', 1, 2, 3], result), 'database delete array element');
                            this.put('array/4', 4).then(function() {
                              this.get('array').then(function(result) {
                                assert(compare(['elem', 1, 2, 3, 4], result), 'database array index resolution');
                              });
                            });
                          });
                        });
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
          assert(compare({array: ['elem', 1, 2, 3, 4], string: 'value'}, result),
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
            this.put(encodeURIComponent('e$caped "stríng"'), "'válue'").then(function() {
              this.get().then(function(value) {
                assert('e$caped "stríng"' in value && value['e$caped "stríng"'] === "'válue'",
                  'database put/get encoded paths, unicode values');
                db.close();
                modules.database.delete('unit-tests', function(error, blocked) {
                  if (!blocked) next(assert(!error, 'database delete'));
                });
              });
            });
          });
        });
      });
    },
    function(next) {
      var code = '/* comment */ var i = 0; // comment\n/** name: {fn: function(arg1:boolean|string, arg2=undefined:[number, ...]) -> {key:value}, str: string}\n\n first\n second\n\n third */',
          doc = modules.docs.generate(code);
      assert(compare(doc,[{spec:{name:'name',type:{object:[{name:'fn',type:{function:{args:[{name:'arg1',type:['boolean','string']},{name:'arg2',default:'undefined',type:{array:[{type:'number'},'...']}}],returns:{object:{name:'key',type:'value'}}}}},{name:'str',type:'string'}]}},error:null,text:[['first second'],['third']]}]),
        'docs generate');
      assert(modules.docs.stringify(code) == 'name: {\n  fn: function(arg1: boolean|string, arg2=undefined: [number, ...]) → {key: value},\n  str: string\n}\n\nfirst second\n\nthird',
        'docs stringify');
      assert(modules.docs.stringifySpec(doc[0].spec) == 'name: {\n  fn: function(arg1: boolean|string, arg2=undefined: [number, ...]) → {key: value},\n  str: string\n}',
        'docs stringifySpec');
      
      assert(modules.html.markup({div: 'hello'}) === '<div>hello</div>',
        'html markup basic');
      assert(modules.html.markup({div: [{a: {href: '#', children: 'link'}}, 'hello']}) === '<div><a href="#">link</a>hello</div>',
        'html markup nested');
      assert(modules.html.markup([{link: {rel: 'stylesheet'}}, {br: null}]) === '<link rel="stylesheet"><br>',
        'html markup self-closing tags');
      assert(modules.html.markup({script: function(a) { if (!a) return 'a'; }}) === '<script>(function (a) { if (!a) return \'a\'; }("a"));</script>',
        'html markup inline code');
      assert(modules.html.markup({script: function() { code = true; }}) === '<script>(function () { code = true; }());</script>' && code !== true,
        'html markup inline code no params');
      assert(modules.html.markup({script: function(a) { if (!a) return ['a', 'b']; }}) === '<script>(function (a) { if (!a) return [\'a\', \'b\']; }(["a","b"]));</script>',
        'html markup inline code single param');
      assert(modules.html.markup({script: function(a, b) { if (!a) return ['a', 'b']; }}) === '<script>(function (a, b) { if (!a) return [\'a\', \'b\']; }("a","b"));</script>',
        'html markup inline code multiple params');
      assert(modules.html.markup([{a: {title: '"hello & goodbye"', children: 'hello <& goodbye'}}, {script: function() { '</script>'; }}]) === '<a title="&quot;hello &amp; goodbye&quot;">hello &lt;&amp; goodbye</a><script>(function () { \'<\\/script>\'; }());</script>',
        'html markup escaped');
      
      var i = 1, j = 1;
      modules.http.serve({port: 9123, ip: '127.0.0.1'}, function(request, response, socket) {
        if (i == 1 && i++) {
          assert(request.method === 'GET' && request.path === '/', 'http get request');
          return response.end('hello');
        }
        if (i == 3 && i++) {
          assert(request.method === 'GET' && request.path === '/path' && request.uri === '/path?a=1&b=ab%20cd&a=2&c=3' && compare(request.query, {a: ['1', '2'], b: 'ab cd', c: '3'}) && request.headers.Accept === 'text/plain; q=0.9',
            'http query, header parsing');
          response.send('hello');
          return setTimeout(function() {
            assert(i++ == 4, 'http chunked response send');
            response.end('goodbye');
          }, 10);
        }
        if (i == 6 && i++) {
          return request.slurp(function(body) {
            assert(i++ == 7 && request.method === 'POST' && body === 'yabadaba', 'http request body slurp');
            response.generic();
          }, 'utf8');
        }
        if (i == 9 && i++) {
          assert(request.path === '/first' && request.method === 'POST' && request.headers['Content-Length'] == 7992,
            'http large request body');
          return request.slurp(function(body) { i++; });
        }
        if (request.path == '/second') {
          assert(request.method === 'POST' && request.headers['Content-Length'] == 19,
            'http concurrent request');
          return request.slurp(function(body) {
            assert(body == null, 'http malformed json request');
            response.error();
          }, 'json');
        }
      }, function(error, server) {
        assert(!error, 'http listen on port 9123');
        if (error) return next();
        var host = 'http://127.0.0.1:9123';
        modules.xhr(host, function(e) {
          assert(i++ == 2 && e.target.status == 200 && e.target.responseText === 'hello',
            'http get response');
          modules.xhr(host+'/path?a=1&b=ab%20cd&a=2&c=3', {headers: {'Accept': 'text/plain; q=0.9'}}, function(e) {
            assert(i++ == 5 && e.target.status == 200 && e.target.responseText === 'hellogoodbye' && e.target.getResponseHeader('Transfer-Encoding') === 'chunked',
              'http chunked response receive');
            modules.xhr(host, {method: 'POST', data: 'yabadaba'}, function(e) {
              assert(i++ == 8 && e.target.status == 200 && e.target.responseText === '200 OK',
                'http response after slurp');
              modules.xhr(host+'/first', {method: 'POST', data: new Array(1000).join('yabadaba')}, function(e) {
                assert(i++ == 10 && e.target.status == 413,
                  'http request too large error');
              });
              modules.xhr(host+'/second', {method: 'POST', data: '{"malformed": json}'}, function(e) {
                assert(i++ == 11 && e.target.status == 400 && e.target.responseText === '400 Bad Request',
                  'http response to malformed body');
                server.disconnect();
                next();
              });
            });
          });
        });
      });
    },
    function(next) {
      var grammar = {
        addition: [
          'addition', '+', 'multiplication', function(e) { return e[0] + e[2]; },
          'addition', '-', 'multiplication', function(e) { return e[0] - e[2]; },
          'multiplication', function(e) { return e[0]; }
        ],
        multiplication: [
          'multiplication', '*', 'group', function(e) { return e[0] * e[2]; },
          'multiplication', '/', 'group', function(e) { return e[0] / e[2]; },
          'group', function(e) { return e[0]; }
        ],
        group: [
          '(', 'addition', ')', function(e) { return e[1]; },
          'number', function(e) { return parseInt(e[0], 10); }
        ]
      };
      var tokens = {number: /[0-9]+/, '': /\s+/};
      try {
        var parse = modules.parser.generate(grammar, 'addition', tokens);
        assert(true, 'parser compile valid SLR grammar');
        try {
          assert(parse('(1 + 2) * 3 / 4 - 5') === -2.75, 'parser parse valid SLR input');
        } catch (e) {
          assert(false, 'parser parse valid SLR input');
        }
        try {
          parse('');
          assert(false, 'parser error on truncated input');
        } catch (e) {
          assert(true, 'parser error on truncated input');
          assert(e && e.message === 'Unexpected end of input' && e.line === '' && e.row === 0 && e.column === 0, 'parser end of input error');
        }
        try {
          parse('\n5 +\n4 + 5 && 6\n');
          assert(false, 'parser error on invalid input');
        } catch (e) {
          assert(true, 'parser error on invalid input');
          assert(e && e.message === 'Unexpected token' && e.line === '4 + 5 && 6' && e.row === 2 && e.column === 6, 'parser unexpected token error');
        }
        try {
          parse = JSON.parse(JSON.stringify(parse()));
          assert(true, 'parser serialize state machine representation');
          try {
            parse = modules.parser.generate(grammar, parse, tokens);
            assert(true, 'parser deserialize state machine representation');
            try {
              assert(parse('(1 + 2) * 3 / 4 - 5') === -2.75, 'parser parse valid input after deserialization');
            } catch (e) {
              assert(false, 'parser parse valid input after deserialization');
            }
          } catch (e) {
            assert(false, 'parser deserialize state machine representation');
          }
        } catch (e) {
          assert(false, 'parser serialize state machine representation');
        }
      } catch (e) {
        assert(false, 'parser compile valid SLR grammar');
      }
      try {
        var parse = modules.parser.generate({
          S: ['L', '=', 'R', 0, 'R', 0],
          L: ['*', 'R', 0, 'id', 0],
          R: ['L', 0]
        }, 'S');
        assert(true, 'parser compile valid LALR grammar');
        try {
          parse('**id=id');
          assert(true, 'parser parse valid LALR input');
        } catch (e) {
          assert(false, 'parser parse valid LALR input');
        }
      } catch (e) {
        assert(false, 'parser compile valid LALR grammar');
      }
      try {
        modules.parser.generate({
          S: ['A', 'S', 0, 'b', 0],
          A: ['S', 'A', 0, 'a', 0]
        }, 'S');
        assert(false, 'parser error compiling non-LALR grammar');
      } catch (e) {
        assert(true, 'parser error compiling non-LALR grammar');
        assert(!e.indexOf('Shift-reduce conflict'), 'parser shift-reduce error detection');
      }
      try {
        modules.parser.generate({S: ['A', 0, 'A', 0]}, 'S');
        assert(false, 'parser reduce-reduce error detection');
      } catch (e) {
        assert(!e.indexOf('Reduce-reduce conflict'), 'parser reduce-reduce error detection');
      }
      
      var i = 1, server;
      modules.socket.listen({port: 9123}, function(socket) {
        socket.send(modules.string.toUTF8Buffer('ping').buffer);
        return function(data) {
          assert(i++ == 2 && modules.string.fromUTF8Buffer(data) == 'pong', 'socket receive from client');
          if (server) server.disconnect();
          next();
        };
      }, function(error) {
        assert(!error, 'socket listen on port 9123');
        modules.socket.connect({port: 9123}, function(error, socket) {
          assert(!error && (server = socket), 'socket connect');
          return function(data) {
            assert(i++ == 1 && modules.string.fromUTF8Buffer(data) == 'ping', 'socket receive from server');
            socket.send(modules.string.toUTF8Buffer('pong').buffer);
          };
        });
      });
    },
    function(next) {
      var uint8 = [116,101,115,116,32,49,50,51,32,195,161,195,169,195,173,195,179,195,186],
          str = 'test 123 áéíóú',
          buf = modules.string.toUTF8Buffer(str);
      assert(buf.length == uint8.length && !uint8.some(function(n, i) { return n != buf[i]; }), 'string to buffer');
      assert(modules.string.fromUTF8Buffer(new Uint8Array(uint8).buffer) === str, 'string from buffer');
      assert(passed == 64, 'tests complete ('+passed+'/64 in '+(Date.now()-start)+'ms)');
    }
  );
}