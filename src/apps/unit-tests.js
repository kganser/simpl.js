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
  
  new Promise(function(resolve) {
    var utf8 = modules.string.toUTF8Buffer,
        hex = modules.string.hexToBuffer,
        toHex = modules.string.hexFromBuffer,
        base64 = modules.string.base64FromBuffer;
    assert(![
      ['', 'd41d8cd98f00b204e9800998ecf8427e'],
      ['abc', '900150983cd24fb0d6963f7d28e17f72'],
      ['The quick brown fox jumps over the lazy dog', '9e107d9d372bb6826bd81d3542a419d6'],
      ['c\'\u00e8', '8ef7c2941d78fe89f31e614437c9db59']
    ].some(function(test) {
      return toHex(modules.crypto.md5(utf8(test[0]))) !== test[1];
    }), 'crypto md5');
    assert(![
      ['', 'da39a3ee5e6b4b0d3255bfef95601890afd80709'],
      ['abc', 'a9993e364706816aba3e25717850c26c9cd0d89d'],
      ['The quick brown fox jumps over the lazy dog', '2fd4e1c67a2d28fced849ee1bb76e7391b93eb12'],
      ['c\'\u00e8', '98c9a3f804daa73b68a5660d032499a447350c0d']
    ].some(function(test) {
      return toHex(modules.crypto.sha1(utf8(test[0]))) !== test[1];
    }), 'crypto sha1');
    assert(![
      ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
      ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
      ['c\'\u00e8', '1aa15c717afffd312acce2217ce1c2e5dabca53c92165999132ec9ca5decdaca'],
      ['abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq', '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1']
    ].some(function(test) {
      return toHex(modules.crypto.sha256(utf8(test[0]))) !== test[1];
    }), 'crypto sha256');
    assert(![{
      key: '0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b',
      data: '4869205468657265',
      mac: 'b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7'
    }, {
      key: '4a656665',
      data: '7768617420646f2079612077616e7420666f72206e6f7468696e673f',
      mac: '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843'
    }, {
      key: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      data: 'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
      mac: '773ea91e36800e46854db8ebd09181a72959098b3ef8c122d9635514ced565fe'
    }, {
      key: '0102030405060708090a0b0c0d0e0f10111213141516171819',
      data: 'cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd',
      mac: '82558a389a443c0ea4cc819899f2083a85f0faa3e578f8077a2e3ff46729665b'
    }, {
      key: '0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c',
      data: '546573742057697468205472756e636174696f6e',
      mac: 'a3b6167473100ee06e0c796c2955552b'
    }, {
      key: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      data: '5468697320697320612074657374207573696e672061206c6172676572207468616e20626c6f636b2d73697a65206b657920616e642061206c6172676572207468616e20626c6f636b2d73697a6520646174612e20546865206b6579206e6565647320746f20626520686173686564206265666f7265206265696e6720757365642062792074686520484d414320616c676f726974686d2e',
      mac: '9b09ffa71b942fcb27635fbcd5b0e944bfdc63644f0713938a7f51535c3a35e2'
    }].some(function(test) {
      toHex(modules.crypto.hmac(hex(test.key), hex(test.data))) !== test.mac;
    }), 'crypto hmac');
    assert(
      base64(modules.crypto.pbkdf2(utf8('password'), utf8('salt'))) === 'YywoEuRtRgQQK6dhjp1tfS+BKPYma0oDJk0qBGC33LM=' &&
      base64(modules.crypto.pbkdf2(utf8('password'), utf8('salt'), 100)) === 'B+aZcYDPfxKQTwQQDUBdNIiP32KvbVBqDswjsZb+mdg=',
      'crypto pbkdf2');
    
    modules.database.list(function(dbs) {
      assert(Array.isArray(dbs), 'database list: '+dbs.join(', '));
      if (!~dbs.indexOf('unit-tests')) return resolve();
      modules.database.delete('unit-tests', function(error, blocked) {
        if (!blocked && !error) resolve();
      });
    });
  }).then(function() {
    return new Promise(function(resolve) {
      var data = {array: ['elem', 1, {a: null, b: [1,2,3]}], object: {boolean: true}, string: 'value'},
          db = modules.database.open('unit-tests', data);
      db.get().get('array').then(function(root, array) {
        assert(compare(root, data), 'database get root');
        assert(compare(array, data.array), 'database get path');
        this.count('array').count('object').count('string').then(function(a, b, c) {
          assert(a === 3 && b === 1 && c === 0, 'database count');
          db.put('object/boolean', false).then(function() {
            this.get('object/boolean').then(function(result) {
              assert(result === false, 'database put');
              this.insert('array/2', 2).then(function() {
                this.get('array').then(function(result) {
                  assert(compare(['elem', 1, 2, {a: null, b: [1,2,3]}], result), 'database insert');
                  this.append('array', {object: {}}).then(function() {
                    this.get('array').then(function(result) {
                      assert(compare(['elem', 1, 2, {a: null, b: [1,2,3]}, {object: {}}], result), 'database append');
                      this.delete('object').then(function() {
                        this.get().get('object').get('object/boolean').then(function(all, deleted, child) {
                          assert(compare({array: ['elem', 1, 2, {a: null, b: [1,2,3]}, {object: {}}], string: 'value'}, all) && deleted === undefined && child === undefined,
                            'database delete record');
                          this.delete('array/3').then(function() {
                            this.get('array').then(function(result) {
                              assert(compare(['elem', 1, 2, {object: {}}], result), 'database delete array element');
                              this.get(['array', 1]).get(['array', '4']).get(['array', 4, 'object']).then(function(a, b, c) {
                                assert(a === 1 && b === undefined, 'database unencoded array path');
                                assert(c === undefined, 'database array index resolution 1');
                                this.put('array/4', 4).then(function() {
                                  this.get('array').then(function(result) {
                                    assert(compare(['elem', 1, 2, {object: {}}, 4], result), 'database array index resolution 2');
                                  }).get('array/1').then(function(result) {
                                    assert(result === 1, 'database multiple transaction callbacks');
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
          });
          db.get('', true).then(function(result) {
            assert(compare({array: ['elem', 1, 2, {object: {}}, 4], string: 'value'}, result),
              'database write transaction after write transaction');
            var i = 1;
            this.get('', function(path, array) {
              assert(i == 1 && !path.length && !array
                  || i == 2 && path.length == 1 && path[0] === 'array' && array
                  || i == 5 && compare(path, ['array', 3]) && !array
                  || i == 6 && compare(path, ['array', 3, 'object']) && !array,
                'database cursor arguments '+(i++ > 2 ? i-3 : i-1));
              return array ? {
                upperBound: 3,
                action: function(key) {
                  if (key == 1) return 'skip';
                },
                value: function(key, value) {
                  assert(i == 3 && key === 0 && value === 'elem'
                      || i == 4 && key === 2 && value === 2
                      || i == 7 && key == 3 && compare(value, {object: {}})
                      || i == 8 && key === null && compare(value, ['elem', undefined, 3]),
                    'database cursor values '+(i++ > 4 ? i-5 : i-3));
                  if (i == 4) return value;
                  if (i == 5) return 3;
                  if (i == 9) return {data: value};
                }
              } : {
                upperBound: 'string',
                upperExclusive: true
              };
            }).then(function(result) {
              assert(i == 9 && compare({array: {data: ['elem', undefined, 3]}}, result), 'database cursor result');
              i = 1;
              this.get('array', {lowerBound: 1, upperBound: 2, action: function(key) {
                assert(key == i, 'database cursor action key '+i++);
              }}).then(function(result) {
                assert(i == 3 && compare([1, 2], result), 'database cursor object');
                this.put(encodeURIComponent('e$caped "stríng"'), "'válue'").then(function() {
                  this.get().then(function(value) {
                    assert('e$caped "stríng"' in value && value['e$caped "stríng"'] === "'válue'",
                      'database put/get encoded paths, unicode values');
                    db.close();
                    modules.database.delete('unit-tests', function(error, blocked) {
                      if (blocked) return;
                      assert(!error, 'database delete');
                      resolve();
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  }).then(function() {
    return new Promise(function(resolve) {
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
      var fn = function(a) { if (!a) return 'a'; };
      assert(modules.html.markup({script: fn}) === '<script>('+fn+'("a"));</script>',
        'html markup inline code');
      fn = function() { code = true; };
      assert(modules.html.markup({script: fn}) === '<script>('+fn+'());</script>' && code !== true,
        'html markup inline code no params');
      fn = function(a) { if (!a) return ['a', 'b']; };
      assert(modules.html.markup({script: fn}) === '<script>('+fn+'(["a","b"]));</script>',
        'html markup inline code single param');
      fn = function(a, b) { if (!a) return ['a', 'b']; };
      assert(modules.html.markup({script: fn}) === '<script>('+fn+'("a","b"));</script>',
        'html markup inline code multiple params');
      fn = function() { '</script>'; };
      assert(modules.html.markup([{a: {title: '"hello & goodbye"', children: 'hello <& goodbye'}}, {script: fn}])
        === '<a title="&quot;hello &amp; goodbye&quot;">hello &lt;&amp; goodbye</a><script>('+fn.toString().replace(/<\//, '<\\/')+'());</script>',
        'html markup escaped');
      assert(modules.html.css({body: {margin: '0', fontFamily: 'sans-serif'}}) === 'body{margin:0;font-family:sans-serif}',
        'html css');
      assert(modules.html.css({'@media screen': {body: {margin: 0}}}) === '@media screen{body{margin:0}}',
        'html css @media query');
      assert(modules.html.css({':before': {content: ''}}) === ':before{content:""}',
        'html css empty string');
      assert(modules.html.css({body: {margin: 0, '.a': {display: 'block'}, '&.b': {width: 'auto'}}}) === 'body{margin:0}body .a{display:block}body.b{width:auto}',
        'html css recursive');
      assert(modules.html.css({body: {margin: 0, '.a': {display: 'block'}, 'padding': 0}}) === 'body{margin:0}body .a{display:block}body{padding:0}',
        'html css recursive preserve ordering');
      assert(modules.html.css({body: {'div, span': {'html &': {color: 'red'}}}}) === 'html body div{color:red}html body span{color:red}',
        'html css recursive complex selectors');
      
      var i = 1, large = new Array(1000).join('yabadabadoo');
      modules.http.serve({port: 9123, address: '127.0.0.1'}, function(request, response) {
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
            response.ok();
          }, 'utf8');
        }
        if (i == 9 && i++) {
          assert(request.method === 'POST' && request.headers['Content-Length'] == large.length,
            'http large request body');
          return request.slurp(function(body) { i++; });
        }
        if (request.path == '/second') {
          assert(request.method === 'POST' && request.headers['Content-Length'] == 19,
            'http concurrent request');
          return request.slurp(function(body) {
            assert(body === undefined, 'http malformed json request');
            response.error();
          }, 'json');
        }
        i++;
        response.error();
      }, function(error, server) {
        assert(!error, 'http listen on port 9123');
        if (error) return resolve();
        var host = 'http://127.0.0.1:9123';
        fetch(host).then(function(r) {
          return Promise.all([r, r.text()]);
        }).then(function(r) {
          assert(i++ == 2 && r[0].status == 200 && r[1] === 'hello',
            'http get response');
          fetch(host+'/path?a=1&b=ab%20cd&a=2&c=3', {headers: {'Accept': 'text/plain; q=0.9'}}).then(function(r) {
            return Promise.all([r, r.text()]);
          }).then(function(r) {
            assert(i++ == 5 && r[0].status == 200 && r[1] === 'hellogoodbye',
              'http chunked response receive');
            fetch(host, {method: 'POST', body: 'yabadaba'}).then(function(r) {
              return Promise.all([r, r.text()]);
            }).then(function(r) {
              assert(i++ == 8 && r[0].status == 200 && r[1] === '200 OK',
                'http response after slurp');
              fetch(host, {method: 'POST', body: large}).then(function(r) {
                assert(i++ == 10 && r.status == 413,
                  'http request body too large error');
                fetch(host+'/first', {headers: {'X-Large-Header': large}}).then(function(r) {
                  assert(i++ < 13 && r.status == 431,
                    'http request header too large error');
                  if (i == 13) resolve(server);
                });
                fetch(host+'/second', {method: 'POST', body: '{"malformed": json}'}).then(function(r) {
                  return Promise.all([r, r.text()]);
                }).then(function(r) {
                  assert(i++ < 13 && r[0].status == 400 && r[1] === '400 Bad Request',
                    'http response to malformed body');
                  if (i == 13) resolve(server);
                });
              });
            });
          });
        });
      });
    });
  }).then(function(server) {
    if (server) server.disconnect();
    return new Promise(function(resolve) {
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
        assert(!e.message.indexOf('Shift-reduce conflict'), 'parser shift-reduce error detection');
      }
      try {
        modules.parser.generate({S: ['A', 0, 'A', 0]}, 'S');
        assert(false, 'parser reduce-reduce error detection');
      } catch (e) {
        assert(!e.message.indexOf('Reduce-reduce conflict'), 'parser reduce-reduce error detection');
      }
      
      var i = 1;
      modules.socket.listen({port: 9123}, function(socket) {
        socket.send(modules.string.toUTF8Buffer('ping').buffer);
        return function(data) {
          assert(i++ == 2 && modules.string.fromUTF8Buffer(data) == 'pong', 'socket receive from client');
          server.disconnect();
          resolve();
        };
      }, function(error, s) {
        server = s;
        assert(!error, 'socket listen on port 9123');
        modules.socket.connect({port: 9123}, function(error, socket) {
          assert(!error && socket, 'socket connect');
          return function(data) {
            assert(i++ == 1 && modules.string.fromUTF8Buffer(data) == 'ping', 'socket receive from server');
            socket.send(modules.string.toUTF8Buffer('pong').buffer);
          };
        });
      });
    });
  }).then(function() {
    return new Promise(function(resolve) {
      var utf8Str = 'test 123 áéíóú',
          utf8Chk = new Uint8Array([0x74,0x65,0x73,0x74,0x20,0x31,0x32,0x33,0x20,0xc3,0xa1,0xc3,0xa9,0xc3,0xad,0xc3,0xb3,0xc3,0xba]),
          utf8Buf = modules.string.toUTF8Buffer(utf8Str),
          latin1Chk = new Uint8Array([0x74,0x65,0x73,0x74,0x20,0x31,0x32,0x33,0x20,0xe1,0xe9,0xed,0xf3,0xfa]),
          base64Str = 'aGVsbG8gd29ybGQ=',
          base64Chk = new Uint8Array([0x68,0x65,0x6c,0x6c,0x6f,0x20,0x77,0x6f,0x72,0x6c,0x64]),
          base64Buf = modules.string.base64ToBuffer(base64Str),
          hexStr = '68656c6c6f',
          hexChk = new Uint8Array([0x68,0x65,0x6c,0x6c,0x6f]),
          hexBuf = modules.string.hexToBuffer(hexStr);
      assert(utf8Buf.length == utf8Chk.length && Array.prototype.every.call(utf8Buf, function(n, i) { return n == utf8Chk[i]; }), 'string to utf-8 buffer');
      assert(modules.string.fromUTF8Buffer(utf8Chk.buffer) === utf8Str, 'string from utf-8 buffer');
      assert(modules.string.fromLatin1Buffer(latin1Chk.buffer) === utf8Str, 'string from latin-1 buffer');
      assert(base64Buf.length == base64Chk.length && Array.prototype.every.call(base64Buf, function(n, i) { return n == base64Chk[i]; }), 'string base64 to buffer');
      assert(modules.string.base64FromBuffer(base64Chk.buffer) === base64Str, 'string base64 from buffer');
      assert(hexBuf.length == hexChk.length && Array.prototype.every.call(hexBuf, function(n, i) { return n == hexChk[i]; }), 'string hex to buffer');
      assert(modules.string.hexFromBuffer(hexChk.buffer) === hexStr, 'string hex from buffer');
      
      modules.system.cpu.getInfo(function(info) {
        assert(info, 'system cpu info');
        modules.system.display.getInfo(function(info) {
          assert(info, 'system display info');
          modules.system.memory.getInfo(function(info) {
            assert(info, 'system memory info');
            modules.system.network.getInterfaces(function(info) {
              assert(info, 'system network info');
              modules.system.storage.getInfo(function(info) {
                assert(info, 'system storage info');
                resolve();
              });
            });
          });
        });
      });
    });
  }).then(function() {
    return new Promise(function(resolve) {
      var i = 0;
      modules.http.serve({port: 9123, address: '127.0.0.1'}, function(request, response) {
        modules.websocket.accept(request, response, function(connection, protocol, extensions) {
          assert(i++ == 1 && protocol === 'myprotocol', 'websocket request');
          connection.send('hello');
          return function(message) {
            assert(i++ == 3 && message === 'goodbye', 'websocket message from client');
            connection.send(modules.string.toUTF8Buffer('binary').buffer).close();
          };
        }, {protocols: ['myprotocol']});
      }, function(error, server) {
        if (error) return resolve();
        var ws = new WebSocket('ws://localhost:9123', 'myprotocol');
        ws.binaryType = 'arraybuffer';
        ws.onopen = function() {
          assert(!i++, 'websocket handshake');
        };
        ws.onmessage = function(e) {
          if (i == 2 && i++) {
            assert(e.data == 'hello', 'websocket message from server');
            return ws.send('goodbye');
          }
          if (i++ == 4)
            assert(e.data instanceof ArrayBuffer && modules.string.fromUTF8Buffer(e.data) === 'binary', 'websocket binary message');
        };
        ws.onclose = function() {
          assert(i++ == 5, 'websocket close');
          server.disconnect();
          resolve();
        };
        ws.onerror = function() { i++; };
      });
    });
  }).then(function() {
    assert(passed == 100, 'tests complete ('+passed+'/100 in '+(Date.now()-start)+'ms)');
  });
}
