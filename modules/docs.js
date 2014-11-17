simpl.add('docs', function(o) {
  
  var pass = function(values) {
    return values[0];
  };
  var collect = function(values) {
    return [values[0]].concat(Array.isArray(values[2]) ? values[2] : [values[2]]);
  };
  var tokens = {
    id: /[a-zA-Z_]+/,
    number: /[0-9]+/,
    string: /'[^']+'|"[^"]+"/,
    code: /`[^`]+`/,
    '': /\s+/
  };
  var self, parse = o.parser.generate({
    named_value_nodefault: [
      [['id', ':', 'types'], function(values) { return {name: values[0], type: values[2]}; }]
    ],
    named_value: [
      [['id', '=', 'literal', ':', 'types'], function(values) { return {name: values[0], default: values[2], type: values[4]}; }],
      [['named_value_nodefault'], pass]
    ],
    named_values: [
      [['named_value', ',', 'named_values'], collect],
      [['named_value'], pass]
    ],
    value: [
      [['named_value'], pass],
      [['types'], function(values) { return {type: values[0]}; }],
      [['...'], pass] // limit these?
    ],
    values: [
      [['value', ',', 'values'], collect],
      [['value'], pass]
    ],
    type: [
      [['id'], pass],
      [['function', '(', 'values', ')'], function(values) { return {function: {args: values[2]}}; }],
      [['{', 'named_values', '}'], function(values) { return {object: values[1]}; }],
      [['[', 'values', ']'], function(values) { return {array: values[1]}; }]
    ],
    types: [
      [['type', '|', 'types'], collect],
      [['function', '(', 'values', ')', '->', 'types'], function(values) { return {function: {args: values[2], returns: values[5]}}; }],
      [['type'], pass]
    ],
    literal: [
      [['null'], pass],
      [['undefined'], pass],
      [['true'], pass],
      [['false'], pass],
      [['string'], pass],
      [['number'], pass],
      [['code'], pass],
    ]
  }, 'named_value_nodefault', tokens);
  
  return self = {
    generate: function(code) {
      return (code.match(/\/\*\*[\s\S]*?\*\//g) || []).map(function(comment) {
        comment = comment.substring(3, comment.length-2).split(/\n\s*\n/);
        var spec = comment.shift();
        try {
          spec = parse(spec);
        } catch (e) {
          comment.unshift(spec);
          spec = null;
        }
        return {
          spec: spec,
          text: comment.map(function(block) {
            var chunks = [], code;
            while (code = /`[^`]+`/.exec(block)) {
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
    stringify: function(code) {
      return self.generate(code).map(function(block) {
        return stringifySpec(block.spec)+block.text.map(function(chunks) {
          return '\n\n'+chunks.map(function(chunk) {
            if (typeof chunk == 'string')
              return chunk.replace(/(^|\n)\s*/g, '');
            return '`'+chunk.code+'`';
          }).join('');
        }).join('\n\n');
      }).join('\n\n');
    },
    stringifySpec: function stringify(node, depth, type) {
      depth = depth || 0;
      if (type) {
        if (Array.isArray(node))
          return node.map(function(node) { return stringify(node, depth, true); }).join('|');
        if (typeof node == 'string')
          return node;
        node = node[type = Object.keys(node)[0]];
        if (type == 'function')
          return type+'('+stringify(node.args, depth+1)+')'+(node.returns ? ' → '+stringify(node.returns, depth, true) : '');
        if (type == 'object')
          return depth ? '{'+stringify(node, depth)+'}' : '{\n  '+stringify(node, depth)+'\n}';
        return '['+stringify(node, depth+1)+']';
      }
      if (Array.isArray(node))
        return node.map(function(node) { return stringify(node, depth); }).join(depth ? ', ' : ',\n  ');
      if (typeof node == 'string')
        return node;
      return (node.name ? node.name+(node.default ? '='+node.default : '')+': ' : '')+stringify(node.type, depth, true);
    }
  };
}, {parser: 0});
