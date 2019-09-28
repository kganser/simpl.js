simpl.add('jsonv', function(modules) {
  return {
    style: {
      '.jsonv': {
        font: '12px/16px SFMono-Regular, Consolas, "Liberation Mono", Menlo, Courier, monospace',
        li: {
          whiteSpace: 'nowrap',
          paddingLeft: '1.2em',
          '&:after': {
            content: '","'
          },
          '&:last-child.last:after': {
            content: 'none'
          }
        },
        button: {
          border: 'solid .1em #ddd',
          borderRadius: '3px',
          background: 'white',
          color: '#808080',
          cursor: 'pointer',
          outline: 'none',
          '&:disabled': {
            color: '#ddd'
          },
          '&:enabled:hover': {
            color: 'white',
            borderColor: 'transparent'
          }
        },
        '.jsonv-delete, .jsonv-add': {
          display: 'none',
          verticalAlign: 'top',
          width: '1em',
          padding: 0,
          margin: '.2em 0 0 .1em',
          font: '1em/.8em sans-serif'
        },
        '.jsonv-delete': {
          float: 'left',
          margin: '.2em .2em 0 -1.2em',
          '&:hover': {
            background: '#c5201c'
          }
        },
        '.jsonv-add:hover': {
          background: '#0c0'
        },
        'ul, ol': {
          listStyle: 'none',
          padding: 0,
          margin: 0
        },
        '.disabled > ul, .disabled > ol': {
          opacity: .5
        },
        'li > .jsonv-add': {
          margin: '.2em -1.7em 0 .7em'
        },
        '&:hover, li:hover': {
          '> .jsonv-object, > .jsonv-array': {
            '> .jsonv-add': {
              display: 'inline-block'
            }
          }
        },
        'li:hover': {
          '> .jsonv-add, > .jsonv-delete': {
            display: 'inline-block'
          }
        },
        '.jsonv-toggle': {
          margin: '0 .65em 0 -1.8em',
          cursor: 'pointer',
          userSelect: 'none',
          '&:before': {
            content: '',
            display: 'inline-block',
            verticalAlign: 'middle',
            height: 0,
            borderStyle: 'solid',
            borderWidth: '.6em .35em 0 .35em',
            borderColor: '#5a5a5a transparent transparent',
            margin: '.2em .25em'
          }
        },
        '.jsonv-object, .jsonv-array': {
          marginLeft: '1.2em',
          '&.closed': {
            '.jsonv-toggle:before': {
              borderWidth: '.35em 0 .35em .6em',
              borderColor: 'transparent transparent transparent #5a5a5a',
              margin: '.2em .3em'
            },
            'ul, ol': {
              display: 'inline-block'
            },
            li: {
              display: 'inline',
              paddingLeft: 0,
              '&:last-child:after': {
                content: '",…"'
              },
              '&.last:last-child:after': {
                content: 'none'
              },
            },
            '.jsonv-object, .jsonv-array': {
              marginLeft: 0
            }
          }
        },
        '.jsonv-object': {
          '&:before': {
            content: '"{"'
          },
          '&:after': {
            content: '"}"'
          }
        },
        '.jsonv-array': {
          '&:before': {
            content: '"["'
          },
          '&:after': {
            content: '"]"'
          }
        },
        '.jsonv-string': {
          color: '#c5201c',
          whiteSpace: 'pre-wrap',
          '&:before, &:after': {
            content: '"\\\""'
          }
        },
        '.jsonv-key': {
          color: '#881391',
          whiteSpace: 'pre-wrap',
        },
        '.jsonv-number, .jsonv-boolean': {
          color: '#1c00cf'
        },
        '.jsonv-null': {
          color: '#808080'
        },
        '.jsonv-next': {
          paddingLeft: '1.2em',
          button: {
            padding: '0 5px',
            fontSize: '11px',
            '&:enabled:hover': {
              background: '#8097bd'
            }
          }
        },
        '.jsonv-error': {
          font: '12px sans-serif',
          marginLeft: '10px',
          '&:before': {
            content: '"⚠️"'
          }
        },
        '.jsonv-input': {
          position: 'relative',
          display: 'inline-block',
          verticalAlign: 'top',
          padding: '0 1px',
          margin: '-1px -2px',
          border: 'solid 1px #999',
          pre: {
            font: 'inherit',
            margin: 0,
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
            padding: 0,
            visibility: 'hidden',
            minWidth: '3px'
          },
          textarea: {
            font: 'inherit',
            margin: 0,
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
            overflow: 'hidden',
            position: 'absolute',
            top: 0,
            left: 0,
            height: '100%',
            width: '100%',
            padding: '0 1px',
            boxSizing: 'border-box',
            border: 'none',
            outline: 'none',
            resize: 'none'
          }
        }
      }
    },
    component: function() {
      return {
        getInitialState: function() {
          return {
            // Re-use props.value as defaultValue if onChange is missing?
            // i.e. {value: this.props.onChange ? undefined : this.props.value}
            value: this.props.defaultValue,
            collapsed: this.props.collapsed
          };
        },
        find: function(value, path) {
          var metadata = this.props.metadata;
          for (var i = 0; i < path.length; i++) {
            if (!value) return;
            if (metadata) value = value.data || {};
            if (typeof path[i] == 'number' && !Array.isArray(value)) return;
            value = value[path[i]];
          }
          return value;
        },
        expand: function expand(value) {
          return !value || typeof value != 'object' ? value : {
            data: Array.isArray(value)
              ? value.map(expand)
              : Object.keys(value).reduce(function(object, key) {
                  object[key] = expand(value[key]);
                  return object;
                }, {})
          };
        },
        update: function(operation, path, value) {
          var metadata = this.props.metadata;
          if (metadata && (operation == 'put' || operation == 'insert'))
            value = this.expand(value);
          return function clone(data, i) {
            var update = metadata && operation == 'set' && i == path.length && value,
                wrapper = metadata && typeof data == 'object' && data && !Array.isArray(data) && Object.assign({}, data, update || {}),
                payload = wrapper ? data.data : data;
            if (Array.isArray(payload)) {
              payload = payload.reduce(function(array, item, index) {
                var prefix = path[i] === index,
                    match = prefix && i == path.length - 1;
                return array.concat(
                  match && operation == 'put' ? [value]
                  : match && operation == 'insert' ? [value, clone(item, prefix ? i + 1 : -1)]
                  : match && operation == 'delete' ? []
                  : [clone(item, prefix ? i + 1 : -1)]
                );
              }, []);
              if (update) {
                [].push.apply(payload, value.data || []); // value.data: ?array
              } else if (operation == 'insert' && i == path.length - 1 && path[i] === payload.length) {
                payload.push(value);
              }
            } else if (typeof payload == 'object' && payload) {
              payload = Object.keys(payload).reduce(function(object, key) {
                if (!update || !(value.data || {}).hasOwnProperty(key)) {
                  var prefix = path[i] === key,
                      match = prefix && i == path.length - 1;
                  if (!match || operation != 'delete') {
                    object[key] = match && operation == 'put' ? value
                      : clone(payload[key], prefix ? i + 1 : -1);
                  }
                }
                return object;
              }, {});
              if (update) {
                Object.keys(value.data || {}).forEach(function(key) { // value.data: ?object
                  payload[key] = value.data[key];
                });
              } else if (operation == 'put' && i == path.length - 1 && typeof path[i] == 'string' && !payload.hasOwnProperty(path[i])) {
                payload[path[i]] = value;
              }
            }
            if (wrapper) wrapper.data = payload;
            return wrapper || payload;
          }(this.state.value === undefined ? this.props.value : this.state.value, 0);
        },
        _input: function(isKey, initialValue) {
          var currentValue = isKey ? this.state.editKey : this.state.editValue,
              self = this;
          return ['span', {className: 'jsonv-input'},
            ['pre', ['span', currentValue], ['br']],
            ['textarea', {
              value: currentValue || '',
              ref: function(ref) {
                if (isKey) {
                  self.keyInput = ref;
                } else {
                  self.valueInput = ref;
                }
              },
              onChange: function(e) {
                var value = e.target.value;
                self.setState(isKey ? {editKey: value} : {editValue: value});
              },
              onKeyDown: function(e) {
                var esc = e.keyCode == 27,
                    move = e.keyCode == 9 || e.keyCode == 13, // tab, enter
                    colon = e.keyCode == 186 || e.keyCode == 59 && e.shiftKey;
                if (esc || !isKey && move && !e.shiftKey) { // cancel/submit
                  e.preventDefault();
                  e.target.blur();
                } else if (isKey && (move || colon)) { // move to value
                  e.preventDefault();
                  if (self.valueInput) self.valueInput.focus();
                } else if (!isKey && self.keyInput && move && e.shiftKey) { // move to key
                  e.preventDefault();
                  self.keyInput.focus();
                }
              },
              onBlur: function() {
                var key = self.state.editKey,
                    value = self.state.editValue;
                setTimeout(function() {
                  var neighbor = isKey ? self.valueInput : self.keyInput;
                  if (neighbor != document.activeElement) {
                    self.setState({editing: false, editKey: undefined, editValue: undefined});
                    if (!value) return;
                    try { value = JSON.parse(value); } catch (e) {}
                    if (value !== initialValue) {
                      var operation = typeof key == 'number' ? 'insert' : 'put',
                          path = initialValue === undefined ? [key] : [];
                      self._onChange(operation, path, value);
                    }
                  }
                });
              }
            }]
          ];
        },
        _onInsert: function(key, value) {
          var self = this;
          try {
            JSON.parse(value); // json-escape value if this succeeds
            value = JSON.stringify(value);
          } catch (e) {}
          return function() {
            self.setState({
              editing: true,
              editKey: key,
              editValue: value || '',
            }, function() {
              var input = typeof key == 'string' ? self.keyInput : self.valueInput;
              if (input) {
                input.focus();
                if (value) input.select();
              }
            });
          };
        },
        _onChange: function(type, path, value) {
          var onChange = this.props.onChange;
          if (onChange) {
            onChange(type, path, value, this);
          } else {
            this.setState({value: this.update(type, path, value)});
          }
        },
        render: function() {
          var value = this.state.value === undefined ? this.props.value : this.state.value,
              metadata = this.props.metadata,
              onToggle = this.props.onToggle,
              onLoad = this.props.onLoad,
              editor = this.props.editor,
              peek = this.props.peek,
              editing = this.state.editing,
              editKey = this.state.editKey,
              collapsed = this.state.collapsed,
              type = typeof value,
              self = this,
              disabled, loading, error, remaining;
          if (type == 'object') {
            if (metadata && value && typeof value.data == 'object') {
              collapsed = value.collapsed;
              disabled = !!value.disabled;
              loading = !!value.loading;
              error = value.error;
              remaining = value.remaining || false;
              value = value.data;
            }
            type = Array.isArray(value) ? 'array' : value ? type : 'null';
          }
          var object = type == 'object',
              scalar = !object && type != 'array',
              items = object ? Object.keys(value).sort() : value,
              closed = peek || collapsed;
      
          error = !error || !closed && ['span', {className: 'jsonv-error'}, String(error)];
    
          return editing && scalar ? this._input(false, value) : ['span', {
            className: 'jsonv-' + type + (collapsed ? ' closed' : '') + (disabled ? ' disabled' : ''),
            onClick: scalar && editor && !disabled ? this._onInsert(undefined, value) : undefined
          }].concat(
            scalar ? [
              type == 'string' && peek ? value.replace(/[\r\n]/g, '↵') : String(value),
              error
            ] : [
              !peek && ['span', {
                className: 'jsonv-toggle',
                onClick: function() {
                  if (onToggle) onToggle([], !collapsed, self);
                  if (!metadata) self.setState({collapsed: !collapsed});
                }
              }],
              !editor || !closed && ['button', {
                className: 'jsonv-add',
                title: object ? 'Add' : 'Insert at index 0',
                disabled: disabled,
                onClick: this._onInsert(object ? '' : 0)
              }, '+'],
              [object ? 'ul' : 'ol'].concat(
                (closed ? items.slice(0, 1) : items).map(function(x, i) {
                  var key = object ? x : i;
                  return [
                    editing && !closed && (object && !i || editKey === i) && ['li', {key: 'edit-' + key},
                      ['button', {className: 'jsonv-delete', title: 'Cancel'}, '×']
                    ].concat(
                      object ? [self._input(true), ': '] : [],
                      [self._input(false)]
                    ),
                    ['li', {
                      key: key,
                      className: i == items.length - 1 ? 'last' : undefined,
                      value: object ? undefined : i
                    },
                      !editor || !closed && ['button', {
                        className: 'jsonv-delete',
                        title: 'Delete',
                        onClick: function() {
                          self._onChange('delete', [key]);
                        }
                      }, '×'],
                      object && [['span', {className: 'jsonv-key'}, key], ': '],
                      [components.jsonv, {
                        value: value[key],
                        collapsed: self.props.collapsed,
                        metadata: metadata,
                        editor: editor,
                        peek: closed,
                        onChange: function(type, path, value) {
                          self._onChange(type, [key].concat(path), value);
                        },
                        onLoad: onLoad && function(path, last) {
                          onLoad([key].concat(path), last, self);
                        },
                        onToggle: onToggle && function(path, collapsed) {
                          onToggle([key].concat(path), collapsed, self);
                        }
                      }],
                      !editor || !object && !closed && ['button', {
                        className: 'jsonv-add',
                        title: 'Insert at index ' + (i + 1),
                        disabled: disabled,
                        onClick: self._onInsert(i + 1)
                      }, '+']
                    ]
                  ];
                }),
                editing && !closed && (editKey === items.length || !items.length) ? [
                  ['li', ['button', {className: 'jsonv-delete', title: 'Cancel'}, '×']].concat(
                    object ? [this._input(true), ': '] : [],
                    [this._input(false)]
                  )
                ] : []
              ),
              !closed && ['div', {className: 'jsonv-next'},
                remaining && ['button', {
                  disabled: loading || disabled,
                  onClick: function() {
                    var last = items.length - 1;
                    if (onLoad) onLoad([], object ? items[last] : last, self);
                  }
                }, loading ? 'Loading...' : remaining === true ? 'more' : remaining + ' more'],
                error
              ]
            ]
          );
        }
      };
    }
  };
});