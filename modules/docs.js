simpl.add('docs', function(o) {
  
  var pass = function(values) {
    return values[0];
  };
  var collect = function(values) {
    return [values[0]].concat(Array.isArray(values[2]) ? values[2] : [values[2]]);
  };
  var tokens = {
    id: /[a-zA-Z_$][a-zA-Z0-9_$]*/,
    number: /[0-9]+/,
    string: /'[^']*'|"[^"]*"/,
    code: /`[^`]+`/,
    '': /\s+/
  };
  var self, parse = o.parser.generate({
    named_value_nodefault: [
      'id', ':', 'types', function(values) { return {name: values[0], type: values[2]}; }
    ],
    named_value: [
      'id', '=', 'literal', ':', 'types', function(values) { return {name: values[0], default: values[2], type: values[4]}; },
      'named_value_nodefault', pass
    ],
    named_values: [
      'named_value', ',', 'named_values', collect,
      'named_value', pass
    ],
    value: [
      'named_value', pass,
      'types', function(values) { return {type: values[0]}; },
      '...', pass // limit these?
    ],
    values: [
      'value', ',', 'values', collect,
      'value', pass
    ],
    type: [
      'id', pass,
      'function', pass,
      'function', '(', 'values', ')', function(values) { return {function: {args: values[2]}}; },
      '{', 'named_values', '}', function(values) { return {object: values[1]}; },
      '[', 'values', ']', function(values) { return {array: values[1]}; }
    ],
    types: [
      'type', '|', 'types', collect,
      'function', '(', 'values', ')', '->', 'types', function(values) { return {function: {args: values[2], returns: values[5]}}; },
      'type', pass
    ],
    literal: [
      'null', pass,
      'undefined', pass,
      'true', pass,
      'false', pass,
      'string', pass,
      'number', pass,
      'code', pass
    ]
  }, 'named_value_nodefault', tokens);
  
  /** docs: {
        generate: function(code:string) -> [Block, ...],
        stringify: function(code:string, breakLimit=1:number) -> string,
        stringifySpec: function(spec:Value|Type, breakLimit=1:number, depth=0:number, type=false:boolean) -> string
      }
      
      Documentation is parsed from comments in `code` beginning with `/**`, which are split into blocks separated by
      one or more empty lines. The first block is parsed using the doc spec grammar. If the parse succeeds, the result
      is returned in `spec`. Otherwise, `spec` is null, `error` is set to the `parser` module's `ParseError`, and the
      block is parsed as `text` along with subsequent blocks.
      
      `stringify` returns a plain-text version of the doc structure returned by `generate`, and `stringifySpec` does
      the same for the `spec` structure within `Block`. `breakLimit` sets the `depth` at which nested object properties
      stop being separated by line breaks. */
      
  /** Block: {spec:Value|null, error:ParseError|undefined, text:[[string|{code:string}, ...], ...]} */
  /** Value: [Value, ...]|string|{name:string|undefined, default:string|undefined, type:Type} */
  /** Type: [Type, ...]|string|{function:{args:Value, returns:Type|undefined}}|{object:Value}|{array:Value} */
  return self = {
    generate: function(code) {
      return (code.match(/\/\*\*\s*[\s\S]+?\s*\*\//g) || []).map(function(comment) {
        comment = comment.substring(3, comment.length-2).trim().split(/\s*\n\s*\n\s*/);
        var spec = comment.shift(), error;
        try {
          spec = parse(spec);
        } catch (e) {
          comment.unshift(spec);
          spec = null;
          error = e;
        }
        return {
          spec: spec,
          error: error,
          text: comment.map(function(block) {
            var chunks = [], code;
            while (code = tokens.code.exec(block)) {
              if (code.index) chunks.push(block.substr(0, code.index));
              chunks.push({code: code[0].substring(1, code[0].length-1)});
              block = block.substr(code.index+code[0].length);
            }
            if (block) chunks.push(block);
            return chunks;
          })
        };
      });
    },
    stringify: function(code, breakLimit) {
      return self.generate(code).map(function(block) {
        var spec = self.stringifySpec(block.spec, breakLimit);
        return (spec ? [spec] : []).concat(block.text.map(function(chunks) {
          return chunks.map(function(chunk) {
            if (typeof chunk == 'string')
              return chunk.replace(/(^|\n)\s*/g, '');
            return '`'+chunk.code+'`';
          }).join('');
        })).join('\n\n');
      }).join('\n\n');
    },
    stringifySpec: function stringify(node, breakLimit, depth, type) {
      if (typeof node != 'string' && !(typeof node == 'object' && node)) return;
      if (breakLimit == null) breakLimit = 1;
      depth = depth || 0;
      var indent = new Array(depth).join('  ');
      if (type) {
        if (Array.isArray(node))
          return node.map(function(node) { return stringify(node, breakLimit, depth, true); }).join('|');
        if (typeof node == 'string')
          return node;
        node = node[type = Object.keys(node)[0]];
        if (type == 'function')
          return type+'('+stringify(node.args, 0, depth+1)+')'+(node.returns ? ' → '+stringify(node.returns, 0, depth+1, true) : '');
        if (type == 'object')
          return depth >= breakLimit ? '{'+stringify(node, breakLimit, depth+1)+'}' : '{\n  '+indent+stringify(node, breakLimit, depth+1)+'\n'+indent+'}';
        return '['+stringify(node, 0, depth+1)+']';
      }
      if (Array.isArray(node))
        return node.map(function(node) { return stringify(node, breakLimit, depth); }).join(depth > breakLimit ? ', ' : ',\n  '+indent);
      if (typeof node == 'string')
        return node;
      return (node.name ? node.name+(node.default ? '='+node.default : '')+': ' : '')+stringify(node.type, breakLimit, depth, true);
    }
  };
}, {parser: 0});
