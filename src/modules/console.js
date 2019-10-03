simpl.add('console', function(modules) {
  return {
    style: { //-
      html: { //-
        height: '100%'
      },
      '.console': {
        margin: 0,
        font: '13px -apple-system, BlinkMacSystemFont, sans-serif',
        webkitTextSizeAdjust: 'none',
        '&, #root, #root > div, #main, #code, .CodeMirror': { //-
          height: '100%'
        },
        svg: { //-
          width: '15px',
          height: '15px',
          verticalAlign: 'bottom',
          fill: 'currentColor'
        },
        'pre, code, kbd, samp, tt, .CodeMirror, #history table': { //-
          fontFamily: 'SFMono-Regular, Consolas, "Liberation Mono", Menlo, Courier, monospace',
          fontSize: '12px'
        },
        'pre, .CodeMirror, #history table': { //-
          lineHeight: '16px'
        },
        pre: { //-
          margin: 0
        },
        code: { //-
          padding: '0 2px',
          border: 'solid 1px #e0e0e0'
        },
        p: { //-
          lineHeight: 1.5,
          svg: {
            color: '#666',
            height: '1.5em',
            margin: '0 2px'
          },
          'button svg, a svg': {
            height: '15px',
            margin: 0
          }
        },
        h1: { //-
          font: '500 2em -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          margin: '0 0 .5em 0'
        },
        'nav h2, #settings h2': { //-
          margin: '0 0 1px 0',
          padding: '2px 0 2px 10px',
          fontSize: '11px',
          fontWeight: 'normal',
          textTransform: 'uppercase',
          letterSpacing: '1px',
          background: '#333',
          color: '#ddd'
        },
        '.home': { //-
          marginBottom: '1px',
          position: 'relative',
          cursor: 'default',
          '&.logged-out': {
            font: '500 15px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
          },
          '.icon-logo': {
            width: '16px',
            height: '16px',
            marginRight: '5px',
            verticalAlign: 'top'
          },
          img: {
            float: 'left',
            height: '25px',
            width: '25px',
            margin: '-5px 10px 0 -10px'
          }
        },
        '.servers': { //-
          marginBottom: '1px',
          position: 'relative',
          height: '20px',
          padding: '5px 25px 0 35px',
          '.icon': {
            background: '#f7f7f7',
            width: '25px',
            height: '100%',
            color: '#666',
            textAlign: 'center',
            position: 'absolute',
            left: 0,
            top: 0,
            pointerEvents: 'none'
          },
          '.select': {
            margin: '-5px -25px 0 -35px',
            select: {
              webkitAppearance: 'none',
              width: '100%',
              height: '25px',
              border: 'none',
              paddingLeft: '35px',
              outline: 'none',
              font: 'inherit',
              background: 'transparent'
            },
            '&:after': {
              content: '',
              position: 'absolute',
              top: '10px',
              right: '11px',
              borderStyle: 'solid',
              borderWidth: '7px 4px 0 4px',
              borderColor: '#333 transparent transparent',
              pointerEvents: 'none'
            }
          }
        },
        button: { //-
          margin: 0,
          padding: 0,
          font: 'inherit',
          display: 'inline-block',
          verticalAlign: 'top',
          background: '#f7f7f7',
          color: '#666',
          border: 'none',
          outline: 'none',
          overflow: 'hidden',
          cursor: 'pointer',
          textAlign: 'center',
          '&:hover': {
            color: 'white'
          },
          '&:active': {
            opacity: .7
          }
        },
        input: { //-
          borderRadius: 0,
          border: 'solid 1px #ddd',
          padding: '3px',
          font: 'inherit',
          outline: 'none',
          boxSizing: 'border-box'
        },
        ul: { //-
          listStyle: 'none',
          margin: 0,
          padding: 0
        },
        nav: { //-
          position: 'fixed',
          width: '249px',
          height: '100%',
          paddingRight: '1px',
          background: 'white',
          overflowY: 'auto',
          overflowX: 'hidden',
          '&:after': {
            content: '',
            position: 'absolute',
            top: 0,
            right: '-15px',
            height: '100%',
            width: '15px',
            boxShadow: '0 0 3px rgba(0, 0, 0, .3)'
          },
          form: {
            position: 'relative',
            marginBottom: '1px',
            input: {
              width: '100%',
              height: '25px',
              padding: '0 30px 0 10px',
              border: 'none'
            },
            button: {
              background: '#3c3',
              color: 'white',
              position: 'absolute',
              top: 0,
              right: 0
            }
          },
          button: {
            height: '25px',
            width: '30px',
            marginLeft: '1px',
            position: 'relative'
          },
          svg: {
            height: '100%'
          },
          li: {
            height: '25px',
            marginBottom: '1px',
            cursor: 'default',
            '&.selected': {
              background: '#f7f7f7'
            }
          },
          '.controls': {
            float: 'right',
            a: {
              display: 'inline-block',
              height: '25px',
              width: '30px',
              verticalAlign: 'top',
              background: '#f7f7f7',
              color: 'white',
              padding: 0,
              border: 'none',
              outline: 'none',
              overflow: 'hidden',
              cursor: 'pointer',
              textAlign: 'center',
              '&:active': {
                opacity: .7
              }
            }
          },
          '.name': {
            display: 'block',
            position: 'relative',
            height: '20px',
            padding: '5px 0 0 10px',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            overflow: 'hidden',
            color: 'inherit',
            textDecoration: 'inherit',
            '&:active': {
              opacity: 1
            }
          },
          '.version': {
            fontSize: '90%',
            color: '#999',
            marginLeft: '10px'
          },
          '.disabled': {
            '.run, .stop, .restart': {
              display: 'none'
            }
          },
          '.icon-loading, .icon-error, .icon-link': {
            height: '15px',
            color: '#666'
          },
          '.icon-loading, .icon-error': {
            float: 'right',
            margin: '0 7px'
          },
          '.icon-error': {
            color: '#c33'
          },
          '.changed .name:before': {
            content: '',
            display: 'inline-block',
            verticalAlign: 'middle',
            height: '4px',
            width: '4px',
            background: 'black',
            borderRadius: '50%',
            margin: '0 3px 4px 0'
          },
          '.view': {
            display: 'none'
          },
          '.selected': {
            position: 'relative',
            button: {
              background: '#e0e0e0'
            },
            '.view': {
              display: 'inline-block'
            }
          }
        },
        '#connection': { //-
          background: 'yellow',
          padding: '3px 3px 3px 10px',
          marginBottom: '1px',
          button: {
            float: 'right',
            width: 'auto',
            height: 'auto',
            padding: '2px 4px',
            fontSize: '11px',
            lineHeight: '12px',
            background: 'white',
            color: 'black',
            boxShadow: '0 0 3px rgba(0, 0, 0, .3)'
          },
          '&.disconnected, &.fatal': {
            background: '#c33',
            color: 'white'
          }
        },
        '.run:hover, .restart:hover, #status.success': { //-
          background: '#3c3'
        },
        '#logout, #actions .delete:hover, #dependencies .delete:hover, .stop:hover, .revert:hover, #status.error': { //-
          background: '#c33'
        },
        '#login, .view:hover, #status.info': { //-
          background: '#36c'
        },
        '.publish:hover': { //-
          background: '#93c'
        },
        '.toggle:hover, .show-code .toggle:hover': { //-
          background: '#666'
        },
        'nav .selected:after, .show-home .home:after': { //-
          content: '',
          position: 'absolute',
          top: 0,
          right: '-1px',
          background: 'white',
          width: '13px',
          height: '13px',
          transform: 'translate(6px, 6px) rotate(45deg) skew(22.5deg, 22.5deg)',
          webkitTransform: 'translate(6px, 6px) rotate(45deg) skew(22.5deg, 22.5deg)',
          boxShadow: '0 0 3px rgba(0, 0, 0, .3)',
          zIndex: 1
        },
        '.show-code nav .selected:after, .show-code .toggle': { //-
          background: '#f7f7f7'
        },
        '.toggle': { //-
          position: 'absolute',
          width: '15px',
          bottom: '50px',
          right: 0,
          background: 'white',
          boxShadow: '0 0 3px rgba(0, 0, 0, .3)',
          zIndex: 1
        },
        '.collapsed': { //-
          '.home, .servers, #connection, nav h2, nav form, nav li, nav .selected:after': {
            display: 'none'
          },
          nav: {
            width: '30px',
            overflowY: 'hidden',
            '.name': {
              padding: '8px 10px 0 0',
              width: '200px',
              textAlign: 'right',
              transform: 'rotate(-90deg) translate(0, -210px)',
              webkitTransform: 'rotate(-90deg) translate(0, -210px)',
              transformOrigin: 'right top 0',
              webkitTransformOrigin: 'right top 0'
            },
            button: {
              marginBottom: '1px'
            },
            '.selected': {
              display: 'block',
              position: 'absolute',
              left: 0,
              right: '1px',
              height: '100%',
              whiteSpace: 'normal'
            }
          },
          '#main': {
            marginLeft: '31px'
          }
        },
        '#main': { //-
          marginLeft: '250px',
          height: '100%',
          overflowX: 'auto'
        },
        '#status': { //-
          position: 'fixed',
          top: 0,
          right: 0,
          zIndex: 6,
          color: 'white',
          padding: '3px 8px'
        },
        '#modal': { //-
          position: 'fixed',
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          background: 'rgba(0, 0, 0, .3)',
          overflow: 'auto',
          zIndex: 6,
          '> div': {
            width: '400px',
            maxWidth: '100%',
            background: 'white',
            boxShadow: '0 0 0 8px rgba(0, 0, 0, .3)',
            margin: '50px auto 0',
            textAlign: 'center',
            padding: '20px 0'
          },
          iframe: {
            display: 'block',
            width: '100%',
            height: '500px',
            border: 'none',
            margin: '-20px 0'
          }
        },
        '#home': { //-
          margin: '0 auto',
          padding: '8% 15px 15px',
          maxWidth: '600px',
          '.icon-logo': {
            width: '32px',
            height: '32px',
            marginRight: '10px'
          },
          p: {
            fontSize: '15px'
          },
          '.promo': {
            border: 'solid 1px #e0e0e0',
            padding: '0 10px 3px',
            p: {
              margin: '5px 0'
            }
          },
          a: {
            display: 'inline-block',
            fontSize: '13px',
            textDecoration: 'none',
            background: '#f7f7f7',
            color: '#666',
            '&:hover': {
              color: 'white',
              background: '#3c3'
            },
            span: {
              marginLeft: '8px'
            }
          },
          'button, a': {
            padding: '5px 10px',
            margin: '0 5px 5px 0'
          },
          'button svg': {
            marginRight: '8px'
          },
          '#facebook:hover': {
            background: '#3b5998'
          },
          '#twitter:hover': {
            background: '#55acee'
          },
          '#google:hover': {
            background: '#d73d32'
          }
        },
        '#code': { //-
          '.CodeMirror-gutters': {
            borderRight: 'none'
          },
          '.CodeMirror-dialog input': {
            font: 'inherit',
            border: 'none'
          },
          '.CodeMirror-matchingbracket, .CodeMirror-nonmatchingbracket': {
            color: 'black',
            background: 'yellow',
            padding: '1px 0',
            boxShadow: '0 0 3px rgba(0, 0, 0, .6)',
            borderRadius: '3px'
          },
          '.CodeMirror-nonmatchingbracket': {
            background: 'red'
          },
          '.CodeMirror-focused .cm-matchhighlight': {
            background: 'rgba(215, 212, 240, .5)'
          },
          '.CodeMirror-foldmarker': {
            textShadow: 'none',
            display: 'inline-block',
            verticalAlign: 'middle',
            padding: '3.5px 1px',
            marginBottom: '2px',
            borderRadius: '3px',
            background: '#666',
            color: 'white',
            fontFamily: 'inherit'
          },
          '.CodeMirror-gutter-elt': {
            fontSize: '13px'
          },
          '.CodeMirror-simplescroll-horizontal, .CodeMirror-simplescroll-vertical': {
            position: 'absolute',
            zIndex: 6,
            background: '#eee',
            div: {
              position: 'absolute',
              background: '#ccc',
              boxSizing: 'border-box',
              border: '1px solid #bbb',
              borderRadius: '2px'
            }
          },
          '.CodeMirror-simplescroll-horizontal': {
            bottom: 0,
            left: 0,
            height: '8px',
            div: {
              bottom: 0,
              height: '100%'
            }
          },
          '.CodeMirror-simplescroll-vertical': {
            right: 0,
            top: 0,
            width: '8px',
            div: {
              right: 0,
              width: '100%'
            }
          }
        },
        '#home, #code, #settings, #log, #docs': { //-
          minWidth: '259px',
          display: 'none'
        },
        '.show-home #home, .show-code #code, .show-settings #settings, .show-log #log, .show-docs #docs': { //-
          display: 'block'
        },
        '.show-module #settings': { //-
          'section': {
            width: '50%'
          },
          '#config': {
            display: 'none'
          }
        },
        '#log': { //-
          padding: '5px 15px',
          '.entry': {
            borderBottom: 'solid 1px #ececec',
            padding: '1px 0',
            whiteSpace: 'normal',
            '&:after': {
              content: '',
              display: 'block',
              clear: 'both',
              height: 0
            }
          },
          '.location': {
            float: 'right',
            color: '#999',
            cursor: 'pointer'
          },
          '.message > span': {
            whiteSpace: 'pre-wrap'
          },
          '.error, .warn': {
            color: 'red'
          },
          '.jsonv': {
            display: 'inline-block',
            verticalAlign: 'top',
            color: 'black'
          }
        },
        '#settings': { //-
          section: {
            display: 'inline-block',
            verticalAlign: 'top',
            boxSizing: 'border-box',
            width: '25%',
            minHeight: '199px',
            borderLeft: '1px solid white'
          },
          '#history': {
            display: 'block',
            borderLeft: 'none',
            width: 'auto',
            minHeight: 0,
            paddingLeft: '83px'
          },
          '#actions': {
            paddingTop: '50px',
            textAlign: 'center',
            button: {
              padding: '5px 10px',
              margin: '0 5px 5px 0',
              svg: {
                marginRight: '8px'
              }
            }
          },
          '#config': {
            width: '50%'
          }
        },
        '.search': { //-
          position: 'relative',
          marginBottom: '5px',
          input: {
            padding: '0 10px 0 28px',
            border: 'none',
            height: '25px',
            width: '100%',
            '&:focus + ul li:first-child button': {
              color: 'white',
              background: '#36c',
              outline: 'none'
            }
          },
          '.icon-search': {
            position: 'absolute',
            top: '5px',
            left: '8px',
            color: '#aaa'
          }
        },
        '#dependencies': { //-
          '.module': {
            padding: '0 0 5px 10px',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            overflow: 'hidden'
          },
          '.delete': {
            marginRight: '5px',
            lineHeight: '.8em',
            color: '#808080',
            textAlign: 'center',
            width: '1em',
            height: '1em',
            '&:hover': {
              color: 'white'
            }
          },
          'button:focus span, input:focus + ul li:first-child button span': {
            color: '#def'
          },
          '.version': {
            fontSize: '90%',
            color: '#999',
            marginLeft: '10px'
          }
        },
        '.suggest': { //-
          position: 'absolute',
          left: '3px',
          right: '3px',
          boxShadow: '0 3px 3px rgba(0, 0, 0, .3)',
          button: {
            color: 'black',
            background: 'white',
            display: 'block',
            boxSizing: 'border-box',
            width: '100%',
            padding: '3px 0 3px 25px',
            textAlign: 'left',
            '&:hover': {
              color: 'black',
              background: '#def'
            },
            '&:focus': {
              color: 'white',
              background: '#36c',
              outline: 'none'
            }
          }
        },
        '#config .jsonv': { //-
          padding: '4px 10px',
          minHeight: '174px',
          overflowX: 'auto'
        },
        '.timeline': { //-
          position: 'relative',
          whiteSpace: 'nowrap',
          float: 'left',
          width: '83px',
          marginLeft: '-83px',
          zIndex: 1,
          li: {
            padding: '10px 0 10px 12px',
            position: 'relative',
            cursor: 'pointer',
            color: '#999',
            '&:before, &:after': {
              content: '',
              display: 'block',
              position: 'absolute',
              height: '50%',
              width: '12px',
              top: 0,
              left: '12px',
              background: '#ddd',
              zIndex: -1
            },
            '&:after': {
              top: 'auto',
              bottom: 0
            },
            '&:first-child:before, &:last-child:after': {
              content: 'none'
            },
            span: {
              display: 'inline-block',
              verticalAlign: 'middle',
              height: '6px',
              width: '6px',
              background: '#ddd',
              marginRight: '5px',
              border: '3px solid #ddd',
              borderRadius: '6px'
            },
            '&:hover, &.selected': {
              color: 'black'
            },
            '&.selected span, &.inner span': {
              borderColor: '#36c',
              background: '#36c'
            },
            '&:hover span': {
              background: 'white'
            },
            '&.first:after, &.inner:after, &.last:before, &.inner:before': {
              background: '#36c'
            }
          }
        },
        '#history': { //-
          h2: {
            margin: '0 0 2px -83px'
          },
          h3: {
            fontSize: '11px',
            fontWeight: 'normal',
            letterSpacing: '1px',
            textTransform: 'uppercase',
            background: '#f7f7f7',
            padding: '2px 7px',
            margin: '0 0 2px'
          },
          table: {
            width: '100%',
            whiteSpace: 'pre-wrap',
            borderCollapse: 'collapse',
            borderSpacing: 0,
            marginBottom: '10px'
          },
          tbody: {
            borderBottom: '2px solid white'
          },
          td: {
            verticalAlign: 'top',
            padding: '0 7px'
          },
          '.line': {
            width: '1%',
            color: '#999',
            background: '#f7f7f7',
            textAlign: 'right',
            webkitUserSelect: 'none'
          },
          '.delete': {
            background: '#fdd',
            '.line': {
              background: '#fcc',
              color: '#666'
            },
            span: {
              background: '#faa'
            }
          },
          '.insert': {
            background: '#dfd',
            '.line': {
              background: '#bfb',
              color: '#666'
            },
            span: {
              background: '#afa'
            }
          },
          '.placeholder': {
            background: '#f1f8ff',
            color: 'transparent',
            cursor: 'pointer',
            webkitUserSelect: 'none',
            '&:hover, &.unchanged': {
              color: '#666'
            },
            '.line': {
              color: 'white',
              background: '#def',
              textAlign: 'center'
            },
            '&:hover .line': {
              background: '#36c'
            }
          },
          '.unchanged': {
            color: '#999',
            'tr, &.expanded .placeholder': {
              display: 'none'
            },
            '&.expanded tr, .placeholder': {
              display: 'table-row'
            }
          }
        },
        '#docs': { //-
          padding: '5px 15px',
          pre: {
            overflow: 'auto',
            margin: '1em 0',
            padding: '4px 10px 5px',
            background: '#f7f7f7'
          },
          '.error': {
            color: 'red'
          },
          '.docjs-spec': {
            background: 'transparent',
            border: 'solid 1px #e0e0e0'
          },
          '.docjs-type-function, .docjs-type-number, .docjs-type-boolean, .docjs-type-string': {
            color: '#008'
          },
          '.docjs-named-value': {
            '> .docjs-type:before, > .docjs-types:before': {
              content: '": "',
              color: 'initial'
            }
          },
          '.docjs-args': {
            '&:before': {
              content: '"("'
            },
            '&:after': {
              content: '")"'
            },
            '&, > .docjs-values': {
              '> .docjs-value > .docjs-named-value': {
                '&:hover': {
                  cursor: 'default',
                  display: 'inline-block',
                  position: 'relative',
                  margin: '-2px 0 -3px',
                  padding: '2px 3px 3px',
                  background: 'white',
                  boxShadow: '0 0 3px rgba(0, 0, 0, .6)',
                  borderRadius: '3px',
                  '.docjs-args, .docjs-args > .docjs-values': {
                    '> .docjs-value > .docjs-named-value:hover': {
                      margin: '2px 0 1px'
                    }
                  },
                  '> .docjs-name': {
                    borderBottom: 'none'
                  },
                  '> .docjs-type, > .docjs-types, > .docjs-default': {
                    display: 'inline'
                  }
                },
                '> .docjs-name': {
                  borderBottom: 'dotted 1px #999'
                },
                '> .docjs-type, > .docjs-types, > .docjs-default': {
                  display: 'none'
                }
              }
            }
          },
          '.docjs-default': {
            color: '#066',
            '&:before': {
              content: '"="',
              color: 'initial'
            }
          },
          '.docjs-function:before': {
            content: '"function"'
          },
          '.docjs-args, .docjs-returns': {
            color: 'initial'
          },
          '.docjs-returns:before': {
            content: '" → "'
          },
          '.docjs-object': {
            '&:before': {
              content: '"{"'
            },
            '&:after': {
              content: '"}"'
            },
            '.docjs-value': {
              display: 'block',
              paddingLeft: '1.2em'
            }
          },
          '.docjs-array': {
            '&:before': {
              content: '"["'
            },
            '&:after': {
              content: '"]"'
            }
          },
          '.docjs-args, .docjs-array, .docjs-object .docjs-object': {
            '.docjs-value': {
              display: 'inline',
              padding: 0
            }
          },
          '.docjs-values > span': {
            '&:after': {
              content: '", "'
            },
            '&:last-child:after': {
              content: 'none'
            }
          },
          '.docjs-types > span': {
            '&:after': {
              content: '"|"',
              color: 'initial'
            },
            '&:last-child:after': {
              content: 'none'
            }
          }
        }
      }
    },
    component: function(site) {
      const capital = str => str[0].toUpperCase() + str.substr(1);
      const diff = function() { //-
        var buildValues = (components, newString, oldString) => {
          var length = components.length,
            newPos = 0,
            oldPos = 0;
          for (var i = 0; i < length; i++) {
            var component = components[i];
            if (!component.removed) {
              component.value = newString.slice(newPos, newPos + component.count).join('');
              newPos += component.count;
              if (!component.added)
                oldPos += component.count;
            } else {
              component.value = oldString.slice(oldPos, oldPos + component.count).join('');
              oldPos += component.count;
              if (i && components[i - 1].added) {
                components[i] = components[i - 1];
                components[i - 1] = component;
              }
            }
          }
          var last = components[length - 1];
          if (length > 1 && last.value === '' && (last.added || last.removed)) {
            components[length - 2].value += last.value;
            components.pop();
          }
          return components;
        };
        var pushComponent = (components, added, removed) => {
          var last = components[components.length - 1];
          if (last && last.added === added && last.removed === removed)
            components[components.length - 1] = {count: last.count + 1, added: added, removed: removed};
          else
            components.push({count: 1, added: added, removed: removed});
        };
        var extractCommon = (basePath, newString, oldString, diagonalPath) => {
          var newPos = basePath.newPos,
            oldPos = newPos - diagonalPath,
            count = 0;
          while (newPos < newString.length - 1 && oldPos < oldString.length - 1 && newString[newPos + 1] === oldString[oldPos + 1]) {
            newPos++;
            oldPos++;
            count++;
          }
          if (count) basePath.components.push({count: count});
          basePath.newPos = newPos;
          return oldPos;
        };
        var tokenize = value =>
          value.replace(/\r?\n$/, '').split('\n').map(line => line + '\n');
        var highlightPair = (a, b) => {
          var ta = a.spans[0].text,
            tb = b.spans[0].text,
            min = Math.min(ta.length, tb.length);
          for (var i = 0; i < min && ta[i] == tb[i]; i++);
          for (var j = 0; j < min - i && ta[ta.length - j - 1] == tb[tb.length - j - 1]; j++);
          var prefix = ta.substr(0, i),
            suffix = ta.substr(ta.length - j);
          if (!/^\s*$/.test(prefix) || !/^\s*$/.test(suffix)) {
            a.spans = [{text: prefix}, {change: true, text: ta.substring(i, ta.length - j)}, {text: suffix}];
            b.spans = [{text: prefix}, {change: true, text: tb.substring(i, tb.length - j)}, {text: suffix}];
          }
        };
        var highlight = lines => {
          var added = [],
            removed = [];
          for (var i = 0; i <= lines.length; i++) {
            var line = lines[i] || {};
            if (line.change > 0) {
              added.push(line);
            } else if (line.change < 0) {
              removed.push(line);
            } else {
              if (added.length > 0 && added.length == removed.length)
                added.forEach((line, i) => highlightPair(line, removed[i]));
              added = [];
              removed = [];
            }
          }
          return lines;
        };
        var diffLines = (a, b) => {
          a = tokenize(a);
          b = tokenize(b);

          var aLen = a.length,
            bLen = b.length,
            editLength = 1,
            maxEditLength = aLen + bLen,
            bestPath = [{newPos: -1, components: []}];

          var aPos = extractCommon(bestPath[0], b, a, 0);
          if (bestPath[0].newPos + 1 >= bLen && aPos + 1 >= aLen)
            return [{value: b.join(''), count: b.length}];

          while (editLength <= maxEditLength) {
            for (var diagonalPath = -1 * editLength; diagonalPath <= editLength; diagonalPath += 2) {
              var basePath,
                addPath = bestPath[diagonalPath - 1],
                removePath = bestPath[diagonalPath + 1],
                aPos = (removePath ? removePath.newPos : 0) - diagonalPath;
              if (addPath)
                bestPath[diagonalPath - 1] = undefined;

              var canAdd = addPath && addPath.newPos + 1 < bLen,
                canRemove = removePath && 0 <= aPos && aPos < aLen;
              if (!canAdd && !canRemove) {
                bestPath[diagonalPath] = undefined;
                continue;
              }

              if (!canAdd || canRemove && addPath.newPos < removePath.newPos) {
                basePath = {newPos: removePath.newPos, components: removePath.components.slice(0)};
                pushComponent(basePath.components, undefined, true);
              } else {
                basePath = addPath;
                basePath.newPos++;
                pushComponent(basePath.components, true, undefined);
              }

              aPos = extractCommon(basePath, b, a, diagonalPath);

              if (basePath.newPos + 1 >= bLen && aPos + 1 >= aLen) {
                return buildValues(basePath.components, b, a);
              } else {
                bestPath[diagonalPath] = basePath;
              }
            }
            editLength++;
          }
        };
        return (a, b, context) => {
          var lineA = 1, lineB = 1,
            changeStart, changeEnd = 0, prevEnd = 0,
            groups = [];

          context = Math.max(0, context) || 0;

          var lines = diffLines(a, b).reduce((lines, span) => {
            const change = span.added ? 1 : span.removed ? -1 : 0;
            return [...lines, ...span.value.replace(/\n$/, '').split('\n').map(line => ({
              change: change,
              number: [change <= 0 && lineA++, change >= 0 && lineB++],
              spans: [{text: line}]
            }))];
          }, []);

          lines.forEach((line, i) => {
            if (line.change) {
              if (changeStart == null) {
                changeStart = Math.max(0, i - context);
              } else if (i > changeEnd + context) {
                if (changeStart > prevEnd)
                  groups.push({change: false, lines: lines.slice(prevEnd, changeStart)});
                groups.push({change: true, lines: highlight(lines.slice(changeStart, changeEnd))});
                prevEnd = changeEnd;
                changeStart = i - context;
              }
              changeEnd = i + context + 1;
            }
          });

          if (changeStart != null) {
            if (changeStart > prevEnd)
              groups.push({change: false, lines: lines.slice(prevEnd, changeStart)});
            groups.push({change: true, lines: highlight(lines.slice(changeStart, changeEnd))});
          }
          if (changeEnd < lines.length)
            groups.push({change: false, lines: lines.slice(changeEnd)});

          return groups;
        }
      }();
      const parseDoc = function() { //-
        const tokens = {
          id: /[a-z_$][a-z0-9_$]*/i,
          number: /(0|[1-9][0-9]*)(\.[0-9]*)?|\.[0-9]*/,
          string: /'[^\\'\r\n]*(\\.[^\\'\r\n]*)*'|"[^\\"\r\n]*(\\.[^\\"\r\n]*)*"/,
          code: /`[^\\`\r\n]*(\\.[^\\`\r\n]*)*`/,
          '': /\s+/
        };
        const parse = function(grammar, start, tokens) { //-
          var symbols = {}, states = [], tokens_ = {}, grammar_ = {}, nonterminals = Object.keys(grammar);
          
          Object.keys(tokens || {}).forEach(function(token) {
            tokens_[token] = new RegExp(tokens[token].source.replace(/^\^?/, '^(?:')+')', tokens[token].ignoreCase ? 'i' : '');
          });
          tokens = tokens_;
          
          nonterminals.forEach(function(nonterminal) {
            var productions = [], production = [];
            grammar[nonterminal].forEach(function(elem) {
              var type = typeof elem;
              if (type == 'string') {
                production.push(elem);
              } else {
                productions.push([production, type == 'function' ? elem : function(values) {
                  return function copy(elem) {
                    var type = typeof elem;
                    if (type != 'object' || !elem)
                      return type == 'number' && elem >= 0 && elem < values.length && !(elem % 1)
                        ? values[elem] : elem;
                    var value = {};
                    if (Array.isArray(elem)) {
                      value = [];
                      elem.forEach(function(elem) {
                        value = value.concat(Array.isArray(elem = copy(elem)) ? elem : [elem]);
                      });
                    } else {
                      Object.keys(elem).forEach(function(key) {
                        value[key] = copy(elem[key]);
                      });
                    }
                    return value;
                  }(elem);
                }]);
                production = [];
              }
            });
            grammar_[nonterminal] = productions;
          });
          grammar = grammar_;
          
          start[0].forEach(function(symbol) { symbols[symbol] = 1; });
          (states = start.slice(1).map(function(state) {
            return {transitions: {}, reductions: {}, raw: state};
          })).forEach(function(state) {
            var t = Array.isArray(state.raw) ? state.raw[0] : state.raw,
                r = Array.isArray(state.raw) ? state.raw[1] : {};
            Object.keys(t).forEach(function(symbol) {
              state.transitions[start[0][symbol-1]] = states[t[symbol]];
            });
            Object.keys(r).forEach(function(symbol) {
              var value = r[symbol],
                  nonterminal = start[0][Array.isArray(value) ? value[0]-1 : value-1],
                  production = nonterminal ? grammar[nonterminal][Array.isArray(value) ? value[1] : 0] : [[Object.keys(states[0].transitions)[0]], function(e) { return e; }];
              state.reductions[+symbol ? start[0][symbol-1] : ''] = [nonterminal, production[0], null, null, production[1] || function(o) { return o; }];
            });
            delete state.raw;
          });
          
          return function(string) {
            var token, match, ignore = tokens[''], substring = string, values = [], stack = [], state = states[0], i = 0;
            
            while (state) {
              token = undefined;
              
              if (ignore && (match = ignore.exec(substring))) {
                substring = substring.substr(match[0].length);
                i += match[0].length;
                continue;
              }
              
              (function(process) {
                Object.keys(state.transitions).forEach(process(false));
                Object.keys(state.reductions).forEach(process(true));
              })(function(reduce) {
                return function(symbol) {
                  if (symbol && tokens.hasOwnProperty(symbol)) {
                    if ((match = tokens[symbol].exec(substring)) && (!token || match[0].length > token.value.length))
                      token = {symbol: symbol, value: match[0], reduce: reduce};
                  } else if (!grammar.hasOwnProperty(symbol) && substring.substr(0, symbol.length) == symbol && (!token || symbol.length >= token.value.length) && (symbol || i == string.length)) {
                    token = {symbol: symbol, value: symbol, reduce: reduce};
                  }
                };
              });
              
              if (!token) {
                var before = string.substr(0, i),
                    newlines = before.match(/\n/g),
                    lastNewline = before.lastIndexOf('\n') + 1;
                throw {
                  message: i == string.length ? 'Unexpected end of input' : 'Unexpected token',
                  index: i,
                  line: string.substring(lastNewline, (string+'\n').indexOf('\n', lastNewline)),
                  row: newlines ? newlines.length : 0,
                  column: i - lastNewline,
                  toString: function() {
                    return [this.message, this.line.replace(/\t/g, ' '), new Array(this.column+1).join(' ')+'^'].join('\n');
                  }
                };
              }
              
              if (token.reduce) {
                var args = [],
                    reduction = state.reductions[token.symbol];
                for (var j = reduction[1].length; j; j--) {
                  state = stack.pop();
                  args.unshift(values.pop());
                }
                stack.push(state);
                state = state.transitions[reduction[0]];
                values.push(reduction[4](args));
              } else {
                stack.push(state);
                values.push(token.value);
                state = state.transitions[token.symbol];
                substring = substring.substr(token.value.length);
                i += token.value.length;
              }
            }
            
            return values.pop().pop();
          };
        }({
          spec: [
            'id', ':', 'types', {name: 0, type: 2}
          ],
          named_value: [
            'id', '=', 'literal', ':', 'types', {name: 0, default: 2, type: 4},
            'spec', 0,
            '...', 0 // limit these?
          ],
          named_values: [
            'named_value', ',', 'named_values', [0, 2],
            'named_value', 0
          ],
          value: [
            'named_value', 0,
            'types', {type: 0}
          ],
          values: [
            'value', ',', 'values', [0, 2],
            'value', 0
          ],
          type: [
            'id', 0,
            'function', 0,
            'function', '(', 'values', ')', {function: {args: 2}},
            '{', 'named_values', '}', {object: 1},
            '[', 'values', ']', {array: 1}
          ],
          types: [
            'type', '|', 'types', [0, 2],
            'function', '->', 'types', {function: {returns: 2}},
            'function', '(', 'values', ')', '->', 'types', {function: {args: 2, returns: 5}},
            'type', 0
          ],
          literal: [
            'null', 0,
            'undefined', 0,
            'true', 0,
            'false', 0,
            'string', 0,
            'number', 0,
            'code', 0
          ]
        }, [['spec','id',':','types','named_value','=','literal','...','named_values',',','value','values','type',
        'function','(',')','{','}','[',']','|','->','null','undefined','true','false','string','number','code'],
        {1:1,2:2},[{},{0:0}],{3:3},{2:7,4:4,13:5,14:6,17:8,19:9},[{},{0:1,10:1,16:1,18:1,20:1}],[{21:10},{0:[4,3],
        10:[4,3],16:[4,3],18:[4,3],20:[4,3]}],[{15:12,22:11},{0:[13,1],10:[13,1],16:[13,1],18:[13,1],20:[13,1],21:
        [13,1]}],[{},{0:13,10:13,16:13,18:13,20:13,21:13}],{1:16,2:15,5:14,8:17,9:13},{1:16,2:22,4:21,5:20,8:17,11:
        19,12:18,13:5,14:6,17:8,19:9},{2:7,4:23,13:5,14:6,17:8,19:9},{2:7,4:24,13:5,14:6,17:8,19:9},{1:16,2:22,4:
        21,5:20,8:17,11:19,12:25,13:5,14:6,17:8,19:9},{18:26},[{10:27},{18:[9,1]}],{3:3,6:28},[{},{10:[5,1],16:[5,
        1],18:[5,1],20:[5,1]}],[{},{10:[5,2],16:[5,2],18:[5,2],20:[5,2]}],{20:29},[{10:30},{16:[12,1],20:[12,1]}],
        [{},{10:11,16:11,20:11}],[{},{10:[11,1],16:[11,1],20:[11,1]}],[{3:3,6:28},{10:13,16:13,20:13,21:13}],[{},
        {0:4,10:4,16:4,18:4,20:4}],[{},{0:[4,1],10:[4,1],16:[4,1],18:[4,1],20:[4,1]}],{16:31},[{},{0:[13,3],10:[13,
        3],16:[13,3],18:[13,3],20:[13,3],21:[13,3]}],{1:16,2:15,5:14,8:17,9:32},{7:33,23:34,24:35,25:36,26:37,27:
        38,28:39,29:40},[{},{0:[13,4],10:[13,4],16:[13,4],18:[13,4],20:[13,4],21:[13,4]}],{1:16,2:22,4:21,5:20,8:
        17,11:19,12:41,13:5,14:6,17:8,19:9},[{22:42},{0:[13,2],10:[13,2],16:[13,2],18:[13,2],20:[13,2],21:[13,2]}],
        [{},{18:9}],{3:43},[{},{3:7}],[{},{3:[7,1]}],[{},{3:[7,2]}],[{},{3:[7,3]}],[{},{3:[7,4]}],[{},{3:[7,5]}],[
        {},{3:[7,6]}],[{},{16:12,20:12}],{2:7,4:44,13:5,14:6,17:8,19:9},{2:7,4:45,13:5,14:6,17:8,19:9},[{},{0:[4,
        2],10:[4,2],16:[4,2],18:[4,2],20:[4,2]}],[{},{10:5,16:5,18:5,20:5}]], tokens);

        return function(code) {
          return (code.match(/\/\*\*\s*[\s\S]+?\s*\*\//g) || []).map(function(comment) {
            var blocks = comment.substring(3, comment.length-2).trim().split(/\n\s*\n/),
                spec = blocks.shift(), error = null;
            try {
              spec = parse(spec);
            } catch (e) {
              blocks.unshift(spec);
              spec = null;
              error = e;
            }
            return {
              spec: spec,
              error: error,
              text: blocks.map(function(block) {
                var chunks = [], code;
                if (code = block.match(/^(\s*)`([^`]+)`\s*$/))
                  return {pre: code[2].replace(new RegExp('\n'+code[1]+' ', 'g'), '\n')};
                block = block.trim().replace(/\s*\n\s*|\s\s+/g, ' ');
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
        };
      }();
      const url = ({app, id, version, query}, ...rest) => [
        app ? '/apps' : '/modules',
        encodeURIComponent(id),
        ...(version ? [version] : []),
        ...rest.map(encodeURIComponent)
      ].join('/') + (
        '?' + Object.entries(query || {}).map(
          (name, value) => name + '=' + encodeURIComponent(value)
        ).join('&')
      ).replace(/\?$/, '');
      return {
        getInitialState: function() { //-
          const {login, token, workspace: {apps, modules}} = this.props;
          [apps, modules].forEach(entries => {
            Object.entries(entries).forEach(([id, entry]) => {
              const owned = Array.isArray(entry.versions); // TODO: change to object in api in both cases
              const [name, source] = id.split('@');
              entry.app = entries == apps;
              entry.id = id;
              entry.name = name;
              entry.source = source;
              entry.versions = Object.entries(entry.versions).reduce((versions, [major, published]) => ({
                ...versions,
                [owned ? +major + 1 : major]: {
                  minor: published - 1,
                  ...(entries == modules ? {} : {log: []})
                }
              }), {});
            });
          });
          return {
            login,
            token,
            apps,
            modules,
            servers: [],
            connection: {status: 'disconnected'},
            appName: '',
            moduleName: '',
            moduleSearch: ''
          };
        },
        componentDidMount: function() {
          if (!self.components) self.components = site.components;
          this.connect();
          window.addEventListener('beforeunload', e => {
            if (this.dirty() && !this.unloading)
              return e.returnValue = 'You have unsaved changes. Cancel navigation to stay on this page.';
            this.unloading = true;
          });
          window.addEventListener('message', e => {
            // TODO: message type
            if (this.processLogin) this.processLogin(e.data);
          });
          window.onpopstate = () => {
            const [type, name, version, panel] = location.pathname.substr(1).split('/');
            this.navigate({
              app: type == 'apps',
              id: name && decodeURIComponent(name),
              version: +version
            }, panel);
          };
          window.onpopstate();
        },
        icon: function(type) { //-
          if (type == 'logo') {
            return ['svg', {viewBox: '0 0 16 16', className: 'icon-logo'},
              ['rect', {x: 11, y: 1, width: 4, height: 4, fill: '#c33'}],
              ['rect', {x: 6, y: 6, width: 4, height: 4, fill: '#36c'}],
              ['rect', {x: 1, y: 11, width: 4, height: 4, fill: '#3c3'}],
              ['rect', {x: 11, y: 6, width: 4, height: 4, fill: '#ccc'}],
              ['rect', {x: 6, y: 11, width: 4, height: 4, fill: '#ccc'}],
              ['rect', {x: 11, y: 11, width: 4, height: 4, fill: '#ccc'}]
            ];
          }
          return ['svg', {viewBox: '0 0 20 20', className: 'icon-' + type},
            ['path', {
              d: {
                left: 'M14,5v10l-9-5L14,5z',
                right: 'M15,10l-9,5V5L15,10z',
                login: 'M14,10L8,5v3H1v4h7v3L14,10z M17,17H9v2h8c1.1,0,2-0.9,2-2V3c0-1.1-0.9-2-2-2H9v2h8V17z',
                logout: 'M19,10l-6-5v3H6v4h7v3L19,10z M3,3h8V1H3C1.9,1,1,1.9,1,3v14c0,1.1,0.9,2,2,2h8v-2H3V3z',
                add: 'M16,10c0,0.553-0.048,1-0.601,1H11v4.399C11,15.951,10.553,16,10,16c-0.553,0-1-0.049-1-0.601V11H4.601C4.049,11,4,10.553,4,10c0-0.553,0.049-1,0.601-1H9V4.601C9,4.048,9.447,4,10,4c0.553,0,1,0.048,1,0.601V9h4.399C15.952,9,16,9.447,16,10z',
                run: 'M15,10.001c0,0.299-0.305,0.514-0.305,0.514l-8.561,5.303C5.51,16.227,5,15.924,5,15.149V4.852c0-0.777,0.51-1.078,1.135-0.67l8.561,5.305C14.695,9.487,15,9.702,15,10.001z',
                restart: 'M19.315,10h-2.372V9.795c-0.108-4.434-3.724-7.996-8.169-7.996C4.259,1.799,0.6,5.471,0.6,10s3.659,8.199,8.174,8.199c1.898,0,3.645-0.65,5.033-1.738l-1.406-1.504c-1.016,0.748-2.27,1.193-3.627,1.193c-3.386,0-6.131-2.754-6.131-6.15s2.745-6.15,6.131-6.15c3.317,0,6.018,2.643,6.125,5.945V10h-2.672l3.494,3.894L19.315,10z',
                stop: 'M16,4.995v9.808C16,15.464,15.464,16,14.804,16H4.997C4.446,16,4,15.554,4,15.003V5.196C4,4.536,4.536,4,5.196,4h9.808C15.554,4,16,4.446,16,4.995z',
                code: 'M5.719,14.75c-0.236,0-0.474-0.083-0.664-0.252L-0.005,10l5.341-4.748c0.412-0.365,1.044-0.33,1.411,0.083s0.33,1.045-0.083,1.412L3.005,10l3.378,3.002c0.413,0.367,0.45,0.999,0.083,1.412C6.269,14.637,5.994,14.75,5.719,14.75zM14.664,14.748L20.005,10l-5.06-4.498c-0.413-0.367-1.045-0.33-1.411,0.083c-0.367,0.413-0.33,1.045,0.083,1.412L16.995,10l-3.659,3.252c-0.413,0.367-0.45,0.999-0.083,1.412C13.45,14.887,13.725,15,14,15C14.236,15,14.474,14.917,14.664,14.748zM9.986,16.165l2-12c0.091-0.545-0.277-1.06-0.822-1.151c-0.547-0.092-1.061,0.277-1.15,0.822l-2,12c-0.091,0.545,0.277,1.06,0.822,1.151C8.892,16.996,8.946,17,9.001,17C9.481,17,9.905,16.653,9.986,16.165z',
                settings: 'M16.783,10c0-1.049,0.646-1.875,1.617-2.443c-0.176-0.584-0.407-1.145-0.692-1.672c-1.089,0.285-1.97-0.141-2.711-0.883c-0.741-0.74-0.968-1.621-0.683-2.711c-0.527-0.285-1.088-0.518-1.672-0.691C12.074,2.57,11.047,3.215,10,3.215c-1.048,0-2.074-0.645-2.643-1.615C6.772,1.773,6.213,2.006,5.686,2.291c0.285,1.09,0.059,1.971-0.684,2.711C4.262,5.744,3.381,6.17,2.291,5.885C2.006,6.412,1.774,6.973,1.6,7.557C2.57,8.125,3.215,8.951,3.215,10c0,1.047-0.645,2.074-1.615,2.643c0.175,0.584,0.406,1.144,0.691,1.672c1.09-0.285,1.971-0.059,2.711,0.682c0.741,0.742,0.969,1.623,0.684,2.711c0.527,0.285,1.087,0.518,1.672,0.693c0.568-0.973,1.595-1.617,2.643-1.617c1.047,0,2.074,0.645,2.643,1.617c0.584-0.176,1.144-0.408,1.672-0.693c-0.285-1.088-0.059-1.969,0.683-2.711c0.741-0.74,1.622-1.166,2.711-0.883c0.285-0.527,0.517-1.086,0.692-1.672C17.429,11.873,16.783,11.047,16.783,10z M10,13.652c-2.018,0-3.653-1.635-3.653-3.652c0-2.018,1.636-3.654,3.653-3.654c2.018,0,3.652,1.637,3.652,3.654C13.652,12.018,12.018,13.652,10,13.652z',
                log: 'M16.4,9H3.6C3.048,9,3,9.447,3,10c0,0.553,0.048,1,0.6,1h12.8c0.552,0,0.6-0.447,0.6-1S16.952,9,16.4,9zM16.4,13H3.6C3.048,13,3,13.447,3,14c0,0.553,0.048,1,0.6,1h12.8c0.552,0,0.6-0.447,0.6-1S16.952,13,16.4,13z M3.6,7h12.8C16.952,7,17,6.553,17,6s-0.048-1-0.6-1H3.6C3.048,5,3,5.447,3,6S3.048,7,3.6,7z',
                info: 'M12.432,0c1.34,0,2.01,0.912,2.01,1.957c0,1.305-1.164,2.512-2.679,2.512c-1.269,0-2.009-0.75-1.974-1.99C9.789,1.436,10.67,0,12.432,0z M8.309,20c-1.058,0-1.833-0.652-1.093-3.524l1.214-5.092c0.211-0.814,0.246-1.141,0-1.141c-0.317,0-1.689,0.562-2.502,1.117L5.4,10.48c2.572-2.186,5.531-3.467,6.801-3.467c1.057,0,1.233,1.273,0.705,3.23l-1.391,5.352c-0.246,0.945-0.141,1.271,0.106,1.271c0.317,0,1.357-0.392,2.379-1.207l0.6,0.814C12.098,19.02,9.365,20,8.309,20z',
                delete: 'M3.389,7.113L4.49,18.021C4.551,18.482,6.777,19.998,10,20c3.225-0.002,5.451-1.518,5.511-1.979l1.102-10.908C14.929,8.055,12.412,8.5,10,8.5C7.59,8.5,5.072,8.055,3.389,7.113z M13.168,1.51l-0.859-0.951C11.977,0.086,11.617,0,10.916,0H9.085c-0.7,0-1.061,0.086-1.392,0.559L6.834,1.51C4.264,1.959,2.4,3.15,2.4,4.029v0.17C2.4,5.746,5.803,7,10,7c4.198,0,7.601-1.254,7.601-2.801v-0.17C17.601,3.15,15.738,1.959,13.168,1.51z M12.07,4.34L11,3H9L7.932,4.34h-1.7c0,0,1.862-2.221,2.111-2.522C8.533,1.588,8.727,1.5,8.979,1.5h2.043c0.253,0,0.447,0.088,0.637,0.318C11.907,2.119,13.77,4.34,13.77,4.34H12.07z',
                upgrade: 'M10,2.5L16.5,9H13v8H7V9H3.5L10,2.5z',
                search: 'M17.545,15.467l-3.779-3.779c0.57-0.935,0.898-2.035,0.898-3.21c0-3.417-2.961-6.377-6.378-6.377C4.869,2.1,2.1,4.87,2.1,8.287c0,3.416,2.961,6.377,6.377,6.377c1.137,0,2.2-0.309,3.115-0.844l3.799,3.801c0.372,0.371,0.975,0.371,1.346,0l0.943-0.943C18.051,16.307,17.916,15.838,17.545,15.467z M4.004,8.287c0-2.366,1.917-4.283,4.282-4.283c2.366,0,4.474,2.107,4.474,4.474c0,2.365-1.918,4.283-4.283,4.283C6.111,12.76,4.004,10.652,4.004,8.287z',
                error: 'M19.511,17.98L10.604,1.348C10.48,1.133,10.25,1,10,1C9.749,1,9.519,1.133,9.396,1.348L0.49,17.98c-0.121,0.211-0.119,0.471,0.005,0.68C0.62,18.871,0.847,19,1.093,19h17.814c0.245,0,0.474-0.129,0.598-0.34C19.629,18.451,19.631,18.191,19.511,17.98z M11,17H9v-2h2V17z M11,13.5H9V7h2V13.5z',
                loading: 'M15.6,4.576c0-2.139,0-2.348,0-2.348C15.6,1.439,13.092,0,10,0C6.907,0,4.4,1.439,4.4,2.228c0,0,0,0.209,0,2.348C4.4,6.717,8.277,8.484,8.277,10c0,1.514-3.877,3.281-3.877,5.422s0,2.35,0,2.35C4.4,18.56,6.907,20,10,20c3.092,0,5.6-1.44,5.6-2.229c0,0,0-0.209,0-2.35s-3.877-3.908-3.877-5.422C11.723,8.484,15.6,6.717,15.6,4.576z M5.941,2.328c0.696-0.439,2-1.082,4.114-1.082c2.113,0,4.006,1.082,4.006,1.082c0.142,0.086,0.698,0.383,0.317,0.609C13.54,3.434,11.9,3.957,10,3.957S6.516,3.381,5.676,2.883C5.295,2.658,5.941,2.328,5.941,2.328z M10.501,10c0,1.193,0.996,1.961,2.051,2.986c0.771,0.748,1.826,1.773,1.826,2.435v1.328c-0.97-0.483-3.872-0.955-3.872-2.504c0-0.783-1.013-0.783-1.013,0c0,1.549-2.902,2.021-3.872,2.504v-1.328c0-0.662,1.056-1.688,1.826-2.435C8.502,11.961,9.498,11.193,9.498,10S8.502,8.039,7.447,7.014c-0.771-0.75-1.826-1.775-1.826-2.438L5.575,3.578C6.601,4.131,8.227,4.656,10,4.656c1.772,0,3.406-0.525,4.433-1.078l-0.055,0.998c0,0.662-1.056,1.688-1.826,2.438C11.498,8.039,10.501,8.807,10.501,10z',
                network: 'M5.274,6.915c0.2,0,0.394,0.029,0.576,0.086c0.69-0.773,1.455-1.477,2.283-2.1C8.098,4.755,8.079,4.602,8.079,4.446c0-0.217,0.036-0.426,0.102-0.621C7.252,3.161,6.244,2.602,5.17,2.171C4.165,2.792,3.288,3.602,2.588,4.552c0.519,0.92,1.136,1.777,1.838,2.557C4.682,6.985,4.969,6.915,5.274,6.915z M3.316,8.872c0-0.275,0.058-0.537,0.159-0.773C2.847,7.407,2.278,6.663,1.78,5.87C1.155,7.112,0.8,8.515,0.8,10.001c0,1.719,0.474,3.328,1.295,4.705c0.294-1.654,0.851-3.219,1.62-4.652C3.465,9.726,3.316,9.315,3.316,8.872z M10.036,2.489c0.517,0,0.985,0.201,1.336,0.529c1.021-0.439,2.096-0.777,3.215-0.992C13.236,1.247,11.67,0.8,10,0.8c-1.139,0-2.229,0.209-3.236,0.588c0.799,0.395,1.561,0.855,2.277,1.375C9.333,2.589,9.672,2.489,10.036,2.489z M12.962,11.708c0.122-0.254,0.295-0.479,0.509-0.656c-0.578-1.777-1.493-3.404-2.672-4.803c-0.234,0.1-0.492,0.154-0.764,0.154c-0.425,0-0.816-0.137-1.137-0.365c-0.71,0.539-1.367,1.143-1.964,1.803C7.122,8.14,7.231,8.493,7.231,8.872c0,0.203-0.031,0.4-0.09,0.586C8.858,10.604,10.835,11.392,12.962,11.708z M15.501,14.351c0.026,0.371,0.041,0.744,0.041,1.121c0,0.664-0.042,1.318-0.122,1.961c1.56-1.139,2.748-2.758,3.347-4.639c-0.71,0.172-1.438,0.295-2.181,0.365C16.413,13.696,16.014,14.128,15.501,14.351z M12.504,13.024c-2.272-0.377-4.377-1.244-6.21-2.484c-0.298,0.182-0.647,0.289-1.021,0.289c-0.139,0-0.272-0.014-0.402-0.041c-0.877,1.662-1.438,3.517-1.599,5.484c0.876,0.94,1.944,1.697,3.145,2.205C7.909,16.184,9.993,14.288,12.504,13.024z M16.176,3.181c-1.475,0.143-2.883,0.514-4.193,1.068c0.006,0.066,0.01,0.131,0.01,0.197c0,0.309-0.074,0.6-0.201,0.859c1.311,1.539,2.327,3.33,2.969,5.291c0.797,0.016,1.477,0.502,1.77,1.195c0.886-0.09,1.748-0.26,2.578-0.504c0.06-0.42,0.092-0.85,0.092-1.287C19.2,7.296,18.034,4.864,16.176,3.181z M13.489,14.069c-2.344,1.098-4.304,2.789-5.723,4.856C8.481,19.104,9.229,19.2,10,19.2c1.387,0,2.702-0.309,3.882-0.859c0.19-0.928,0.29-1.887,0.29-2.869c0-0.355-0.016-0.707-0.043-1.055C13.893,14.341,13.676,14.224,13.489,14.069z',
                laptop: 'M19.754,15.631C19.507,15.26,18,13,18,13V4c0-1.102-0.9-2-2-2H4C2.899,2,2,2.898,2,4v9c0,0-1.507,2.26-1.754,2.631C0,16,0,16.213,0,16.5V17c0,0.5,0.5,1,0.999,1h18.002C19.5,18,20,17.5,20,17v-0.5C20,16.213,20,16,19.754,15.631z M7,16l0.6-1h4.8l0.6,1H7z M16,12H4V4h12V12z',
                link: 'M7.859,14.691l-0.81,0.805c-0.701,0.695-1.843,0.695-2.545,0c-0.336-0.334-0.521-0.779-0.521-1.252s0.186-0.916,0.521-1.252l2.98-2.955c0.617-0.613,1.779-1.515,2.626-0.675c0.389,0.386,1.016,0.384,1.403-0.005c0.385-0.389,0.383-1.017-0.006-1.402C10.069,6.527,7.941,6.791,6.088,8.63l-2.98,2.956C2.393,12.295,2,13.24,2,14.244c0,1.006,0.394,1.949,1.108,2.658c0.736,0.73,1.702,1.096,2.669,1.096s1.934-0.365,2.669-1.096l0.811-0.805c0.389-0.385,0.391-1.012,0.005-1.4C8.875,14.309,8.248,14.307,7.859,14.691z M16.891,3.207c-1.547-1.534-3.709-1.617-5.139-0.197l-1.009,1.002c-0.389,0.386-0.392,1.013-0.006,1.401c0.386,0.389,1.013,0.391,1.402,0.005l1.01-1.001c0.74-0.736,1.711-0.431,2.346,0.197c0.336,0.335,0.522,0.779,0.522,1.252s-0.186,0.917-0.522,1.251l-3.18,3.154c-1.454,1.441-2.136,0.766-2.427,0.477c-0.389-0.386-1.016-0.383-1.401,0.005c-0.386,0.389-0.384,1.017,0.005,1.401c0.668,0.662,1.43,0.99,2.228,0.99c0.977,0,2.01-0.492,2.993-1.467l3.18-3.153C17.605,7.814,18,6.87,18,5.866C18,4.861,17.605,3.917,16.891,3.207z',
                revert: 'M11,1.799c-4.445,0-8.061,3.562-8.169,7.996V10H0.459l3.594,3.894L7.547,10H4.875V9.795C4.982,6.492,7.683,3.85,11,3.85c3.386,0,6.131,2.754,6.131,6.15S14.386,16.15,11,16.15c-1.357,0-2.611-0.445-3.627-1.193l-1.406,1.504c1.388,1.088,3.135,1.738,5.033,1.738c4.515,0,8.174-3.67,8.174-8.199S15.515,1.799,11,1.799z M10,5v5c0,0.13,0.027,0.26,0.077,0.382c0.051,0.122,0.124,0.233,0.216,0.325l3.2,3.2c0.283-0.183,0.55-0.389,0.787-0.628L12,11V5H10z',
                megaphone: 'M17.223,7.03c-1.584-3.686-4.132-6.49-5.421-5.967c-2.189,0.891,1.304,5.164-9.447,9.533c-0.929,0.379-1.164,1.888-0.775,2.792c0.388,0.902,1.658,1.801,2.587,1.424c0.161-0.066,0.751-0.256,0.751-0.256c0.663,0.891,1.357,0.363,1.604,0.928c0.296,0.68,0.939,2.158,1.158,2.66c0.219,0.502,0.715,0.967,1.075,0.83c0.359-0.137,1.582-0.602,2.05-0.779c0.468-0.178,0.579-0.596,0.436-0.924c-0.154-0.355-0.786-0.459-0.967-0.873c-0.18-0.412-0.769-1.738-0.938-2.156c-0.23-0.568,0.259-1.031,0.97-1.104c4.894-0.512,5.809,2.512,7.475,1.834C19.068,14.447,18.806,10.713,17.223,7.03z M16.672,13.006c-0.287,0.115-2.213-1.402-3.443-4.267c-1.231-2.863-1.076-5.48-0.79-5.597c0.286-0.115,2.165,1.717,3.395,4.58C17.065,10.585,16.958,12.889,16.672,13.006z',
                facebook: 'M17,1H3C1.9,1,1,1.9,1,3v14c0,1.101,0.9,2,2,2h7v-7H8V9.525h2v-2.05c0-2.164,1.212-3.684,3.766-3.684l1.803,0.002v2.605h-1.197C13.378,6.398,13,7.144,13,7.836v1.69h2.568L15,12h-2v7h4c1.1,0,2-0.899,2-2V3C19,1.9,18.1,1,17,1z',
                twitter: 'M17.316,6.246c0.008,0.162,0.011,0.326,0.011,0.488c0,4.99-3.797,10.742-10.74,10.742c-2.133,0-4.116-0.625-5.787-1.697c0.296,0.035,0.596,0.053,0.9,0.053c1.77,0,3.397-0.604,4.688-1.615c-1.651-0.031-3.046-1.121-3.526-2.621c0.23,0.043,0.467,0.066,0.71,0.066c0.345,0,0.679-0.045,0.995-0.131C2.84,11.183,1.539,9.658,1.539,7.828c0-0.016,0-0.031,0-0.047c0.509,0.283,1.092,0.453,1.71,0.473c-1.013-0.678-1.68-1.832-1.68-3.143c0-0.691,0.186-1.34,0.512-1.898C3.942,5.498,6.725,7,9.862,7.158C9.798,6.881,9.765,6.594,9.765,6.297c0-2.084,1.689-3.773,3.774-3.773c1.086,0,2.067,0.457,2.756,1.191c0.859-0.17,1.667-0.484,2.397-0.916c-0.282,0.881-0.881,1.621-1.66,2.088c0.764-0.092,1.49-0.293,2.168-0.594C18.694,5.051,18.054,5.715,17.316,6.246z',
                github: 'M13.18,11.309c-0.718,0-1.3,0.807-1.3,1.799c0,0.994,0.582,1.801,1.3,1.801s1.3-0.807,1.3-1.801C14.479,12.116,13.898,11.309,13.18,11.309z M17.706,6.626c0.149-0.365,0.155-2.439-0.635-4.426c0,0-1.811,0.199-4.551,2.08c-0.575-0.16-1.548-0.238-2.519-0.238c-0.973,0-1.945,0.078-2.52,0.238C4.74,2.399,2.929,2.2,2.929,2.2C2.14,4.187,2.148,6.261,2.295,6.626C1.367,7.634,0.8,8.845,0.8,10.497c0,7.186,5.963,7.301,7.467,7.301c0.342,0,1.018,0.002,1.734,0.002c0.715,0,1.392-0.002,1.732-0.002c1.506,0,7.467-0.115,7.467-7.301C19.2,8.845,18.634,7.634,17.706,6.626z M10.028,16.915H9.972c-3.771,0-6.709-0.449-6.709-4.115c0-0.879,0.31-1.693,1.047-2.369C5.537,9.304,7.615,9.9,9.972,9.9c0.01,0,0.02,0,0.029,0c0.01,0,0.018,0,0.027,0c2.357,0,4.436-0.596,5.664,0.531c0.735,0.676,1.045,1.49,1.045,2.369C16.737,16.466,13.8,16.915,10.028,16.915z M6.821,11.309c-0.718,0-1.3,0.807-1.3,1.799c0,0.994,0.582,1.801,1.3,1.801c0.719,0,1.301-0.807,1.301-1.801C8.122,12.116,7.54,11.309,6.821,11.309z'
              }[type]
            }]
          ];
        },
        dirty: function() { //-
          const {apps, modules} = this.state;
          return [apps, modules].some(
            group => Object.values(group).some(
              entry => Object.values(entry.versions).some(
                version => version.dirty
              )
            )
          );
        },
        login: async function() { //-
          if (this.pendingLogin) return this.pendingLogin;
          this.setState({modal: 'login'});
          return this.pendinglogin = new Promise((resolve, reject) => {
            this.processLogin = async ({access_token: token, error, error_description}) => {
              if (error) {
                this.setStatus('error', error_description || error);
                this.processLogin = this.abortLogin = this.pendinglogin = null;
              } else {
                const {user} = this.state.login || {};
                // TODO: fetch /user server-side from callback endpoint
                const login = await fetch(this.props.baseApiUrl + '/user', {
                  headers: {Authorization: 'Bearer ' + token}
                }).then(response => response.json());
                this.processLogin = this.abortLogin = this.pendinglogin = null;
                document.cookie = 'token=' + token + '; Path=/';
                if (user == login.username) {
                  this.setState({login, modal: null, token}, () => resolve(token));
                } else {
                  if (!this.dirty() || confirm('You have unsaved changes. Continue logging in as ' + login.username + '?')) {
                    // TODO: update without reloading
                    this.unloading = true;
                    return location.reload();
                  }
                  this.setStatus('error', 'Login cancelled');
                }
              }
            };
            this.abortLogin = () => {
              this.processLogin = this.abortLogin = this.pendinglogin = null;
              this.setState({modal: null}, reject);
            };
          });
        },
        getToken: async function() { //-
          const {login, token} = this.state;
          if (token) return token;
          if (login) return this.login();
          try {
            // should always be local
            return (await fetch('/token')).text();
          } catch (e) {
            throw new Error('Token request failed');
          }
        },
        clearToken: function() { //-
          document.cookie = 'token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT';
          return new Promise(resolve => this.setState({token: null}, resolve));
        },
        setStatus: function(type, message) { //-
          this.setState({status: {type, message}}, () => {
            clearTimeout(this.statusTimer);
            this.statusTimer = setTimeout(() => this.setState({status: null}), 1000);
          });
        },
        send: function(command, data) { //-
          if (!this.socket || this.socket.readyState != 1) return;
          if (!data) data = {};
          data.command = command;
          data.instance = this.state.server;
          this.socket.send(JSON.stringify(data));

          if (command == 'connect')
            this.setState({connection: {status: 'open', message: 'Connecting...'}});
        },
        connect: async function() { //-
          clearInterval(this.connectCountdown);

          // status: pending, connecting, open, connected, disconnected, fatal
          this.setState({connection: {status: 'connecting', message: 'Connecting...'}});

          try {
            const token = await this.getToken();
            const {local, baseApiUrl} = this.props;
            const base = local ? 'ws://' + location.host : baseApiUrl.replace(/^http/, 'ws');
            const socket = this.socket = new WebSocket(base + '/connect?access_token=' + token);
            socket.onopen = () => { //-
              this.setState({
                connection: this.state.server
                  ? {status: 'fatal', message: 'Server is offline'}
                  : {status: 'open', message: 'No servers connected'}
              });
              setTimeout(function() {
                if (this.socket == socket)
                  this.connectRetries = 0;
              }, 2000);
            };
            socket.onmessage = async e => { //-
              let message;
              try {
                message = JSON.parse(e.data);
              } catch (e) {
                return;
              }
              const {server, servers, apps} = this.state;
              const instance = message.instance || '';
              const data = message.data || {};
              const id = data.app && {app: true, id: data.app, version: data.version};
              if (['error', 'log', 'run', 'stop'].includes(message.event) && !(instance == server && id)) return;
              switch (message.event) {
                case 'connect':
                  const i = servers.findIndex(({id}) => id.localeCompare(instance) >= 0);
                  const entry = {id: instance, name: data.name};
                  this.setState({
                    server: server == null ? instance : server,
                    servers: [ // TODO: servers object?
                      ...servers.slice(0, i < 0 ? servers.length : i),
                      entry,
                      ...(i < 0 ? [] : servers.slice(servers[i].id == instance ? i + 1 : i))
                    ]
                  }, () => {
                    if (this.state.server == instance)
                      this.send('connect');
                  });
                  break;
                case 'disconnect':
                  if (server == instance) {
                    this.setState({
                      connection: {status: 'fatal', message: 'Instance is offline'},
                      servers: servers.map(server => ({
                        ...server,
                        ...(server.id == instance ? {disabled: true} : {})
                      }))
                    });
                  } else {
                    this.setState({
                      servers: servers.filter(({id}) => id != instance)
                    });
                  }
                  break;
                case 'state':
                  this.setState({
                    connection: {status: 'connected'},
                    apps: Object.entries(apps).reduce((apps, [name, app]) => ({
                      ...apps,
                      [name]: {
                        ...app,
                        versions: Object.entries(app.versions).reduce((versions, [major, version]) => ({
                          ...versions,
                          [major]: {
                            ...version,
                            log: [],
                            state: data.some(id => {
                              const i = id.lastIndexOf('@');
                              return id.substr(0, i) == app.id && id.substr(i + 1) == major;
                            }) ? 'running' : undefined
                          }
                        }), [])
                      }
                    }), {})
                  });
                  break;
                case 'error':
                  this.updateVersion(id, ({log}) => ({
                    state: undefined,
                    error: data.message,
                    log: [
                      ...log,
                      {level: 'error', message: [data.message]}
                    ]
                  }));
                  break;
                case 'log':
                  const {clientHeight, scrollHeight, scrollTop} = this.scroller || {};
                  const pinned = scrollTop + clientHeight >= scrollHeight;
                  await this.updateVersion(id, ({log}) => ({
                    log: [
                      ...log.slice(log.length >= 1000 ? 1 : 0),
                      {
                        level: data.level == 'log' ? 'debug' : data.level,
                        message: data.message,
                        module: data.module ? data.module.name : '',
                        version: data.module ? data.module.version : '',
                        line: data.line
                      }
                    ]
                  }));
                  if (pinned) this.scrollLogs();
                  break;
                case 'run':
                  this.updateVersion(id, {
                    state: 'running',
                    error: undefined,
                    log: []
                  });
                  break;
                case 'stop':
                  this.updateVersion(id, {
                    state: undefined,
                    error: undefined
                  });
                  break;
              }
            };
            socket.onclose = async e => { //-
              if (e.code == 4001) {
                await this.clearToken();
                this.connectRetries = 0;
              } else if (!this.connectRetries) {
                this.connectRetries = 0;
              }
              const reconnect = !this.unloading && this.connectRetries < 6;
              let seconds = reconnect ? 1 << this.connectRetries++ : 0;
              this.socket = null;
              this.setState({
                connection: reconnect
                  ? {status: 'pending', message: 'Reconnecting in ' + seconds}
                  : {status: 'disconnected', message: 'Disconnected'},
                servers: [],
                server: null,
              });
              if (reconnect) {
                this.connectCountdown = setInterval(() => {
                  if (--seconds) {
                    this.setState({connection: {status: 'pending', message: 'Reconnecting in ' + seconds}});
                  } else {
                    this.connect();
                  }
                }, 1000);
              }
            };
          } catch (e) {
            this.setState({connection: {status: 'disconnected', message: 'Disconnected'}});
          }
        },
        publish: async function(upgrade) { //-
          const {current, version: {published, dirty}} = this.getCurrent();
          const {app, id, version} = current;
          if (!published || dirty)
            return alert('Please save your code before publishing. Use Ctrl-s in the code editor.');
          this.updateVersion(current, {publishing: true});
          this.setStatus('info', 'Publishing...');
          try {
            await this.request(
              url(upgrade ? {app, id, query: {source: version}} : current),
              {method: 'post'}
            );
            this.setStatus('success', 'Published');
            if (upgrade) {
              let newVersion;
              await this.updateVersion({app, id}, versions => {
                newVersion = Object.keys(versions).length + 1;
                return {
                  [version]: {
                    ...versions[version],
                    publishing: undefined,
                  },
                  [newVersion]: {
                    minor: 0,
                    ...(app ? {log: []} : {})
                  }
                };
              });
              this.navigate({app, id, version: newVersion});
            } else {
              this.updateVersion(current, ({minor, code, config, dependencies, published}) => ({
                minor: minor + 1,
                published: [
                  ...published,
                  {code, config, dependencies}
                ],
                publishing: undefined
              }));
            }
          } catch (e) {
            this.setStatus('error', e.message);
            this.updateVersion(current, {publishing: undefined});
          }
        },
        fork: async function() {
          // return current after successful fork
          const {current, entry, version: {code, config, dependencies}} = this.getCurrent();
          const {source, app} = entry;
          if (!source) return current;
          const {apps, modules, panel} = this.state;
          const group = app ? apps : modules;
          const type = app ? 'app' : 'module';
          let name = entry.name in group ? '' : entry.name;
          let message = 'This change requires you to copy this ' + type + ' to your account. Please give it a unique name within your existing ' + type + 's to continue.';
          do {
            name = prompt(message, name);
            message = name ? ~name.indexOf('@') ? 'Illegal character: @' : name in group ? 'Name already exists.' : false : 'Please enter a name.';
          } while (name != null && message);
          if (!name) throw new Error('Aborted');
          this.setStatus('info', 'Copying linked ' + type + '...');
          // TODO: use pegged minor version
          await this.request(url({...current, query: {name}}), {method: 'post'});
          this.setStatus('success', 'Copied successfully');
          return new Promise(resolve =>
            this.setState({
              [type + 's']: {
                ...group, // TODO: remove linked entry (version)
                [name]: {
                  app,
                  name,
                  id: name,
                  versions: {
                    1: {
                      minor: 0,
                      code,
                      config,
                      dependencies,
                      published: [],
                      doc: entry.doc,
                      ...(app ? {log: []} : {})
                    }
                  }
                }
              }
            }, () => {
              const current = {app, id: name, version};
              this.navigate(current, panel);
              resolve(current);
            })
          );
        },
        remove: async function() { //-
          const {current} = this.state;
          const {app, id, version} = current;
          const type = app ? 'app' : 'module';
          if (!confirm('Are you sure you want to delete this ' + type + '?')) return;
          this.updateVersion(current, {deleting: true});
          this.setStatus('info', 'Deleting ' + type + '...');
          try {
            // TODO: only unpublished modules can be deleted (if owned) -- no version number
            await this.request(url(id.includes('@') ? current : {app, id}), {method: 'delete'});
            this.setStatus('success', 'Deleted');
            this.setState(state => {
              const {[id]: entry, ...group} = state[type + 's'];
              const {[version]: _, ...versions} = entry.versions;
              return {
                current: null,
                panel: null,
                [type + 's']: {
                  ...group,
                  ...(Object.keys(versions).length ? {
                    [id]: {
                      ...entry,
                      versions
                    }
                  } : {})
                }
              };
            });
          } catch (e) {
            this.setStatus('error', e.message);
            this.updateVersion(current, {deleting: undefined});
          }
        },
        request: async function(path, options) { //-
          let response, error, body = {};
          try {
            const token = await this.getToken();
            if (!options) options = {};
            if (!options.headers) options.headers = {};
            options.headers.Authorization = 'Bearer ' + token;
            const {login} = this.state;
            const base = login ? this.props.baseApiUrl : '';
            response = await fetch(base + path, options);
            body = (await response.json()) || {};
          } catch (e) {
            console.error(e);
            error = e && e.message || 'Request failed';
          }
          if (response && response.status == 401) {
            await this.clearToken();
            return this.request(path, options);
          }
          if (body.error || error)
            throw new Error(body.error || error);
          return body;
        },
        navigate: function(item, panel, line) { //-
          return new Promise(resolve => {
            const baseUrl = this.props.baseUrl || '';
            if (!item) {
              const homeUrl = baseUrl || '/';
              if (location.pathname != homeUrl) window.history.pushState(null, null, homeUrl);
              document.title = 'Simpl.js';
              return this.setState({current: null, panel: null}, resolve);
            }

            const {entry, version} = this.getVersion(item);
            if (!version) return resolve();

            let {code, config, doc, loading, state} = version;
            if (!panel) panel = item.app && state == 'running' ? 'log' : 'code';

            this.setState({
              current: item,
              panel,
              ...(this.isCurrent(item) ? {} : {diffVersions: [], diffExpanded: {}})
            }, async () => {
              const initialLoad = !doc && !loading;
              if (initialLoad) {
                this.updateVersion(item, {loading: true});
                try {
                  const {dependencies, published, ...data} = await this.request(url(item));
                  code = data.code || '';
                  config = data.config || {};
                  doc = data.code == null ? null : CodeMirror.Doc(code, {name: 'javascript'});
                  this.updateVersion(item, {
                    doc,
                    code,
                    config,
                    dependencies,
                    published: (published || []).map( // TODO: remove
                      (version, i, versions) => i < versions.length - 1 ? {} : version
                    ),
                    error: undefined,
                    loading: false,
                    hidden: !doc
                  });
                } catch (e) {
                  this.setStatus('error', e.message);
                  this.updateVersion(item, {
                    error: e.message,
                    loading: false
                  })
                }
              }
              if (this.isCurrent(item)) {
                if (doc && this.editor && panel == 'code') {
                  if (this.editor.doc != doc) {
                    this.editor.swapDoc(doc);
                    this.editor.performLint();
                  }
                  if (initialLoad) {
                    // collapse brackets followed by //- on initial render
                    code.split('\n').forEach((line, i) => {
                      if (/[\[{] \/\/-$/.test(line))
                        this.editor.foldCode(i, null, 'fold');
                    });
                  }
                  if (line > 0) {
                    doc.setCursor(line - 1);
                    doc.setCursor(line - 1); // in case code was unfolded with last call
                  }
                } else if (panel == 'log') {
                  this.scrollLogs();
                }
                const path = baseUrl + url(item, panel);
                if (location.pathname != path) window.history.pushState(null, null, path);
                document.title = entry.name;
              }
              resolve();
            });
          });
        },
        renderDiff: function(key, items) { //-
          const {diffExpanded} = this.state;
          const showLines = key == 'code';
          return ['table',
            ...(items.length == 1 ? [
              ['tbody', ...items[0].split('\n').map(
                (line, i) => ['tr', showLines && ['td', {className: 'line'}, i + 1], ['td', line]]
              )]
            ] : diff(items[1], items[0], 3).map(({lines, change}, i, chunks) => {
              const id = key + '-' + i;
              return ['tbody', {className: change ? 'changed' : diffExpanded[id] ? 'unchanged expanded' : 'unchanged'},
                ...lines.map(line =>
                  ['tr', {className: ['delete', 'unchanged', 'insert'][line.change + 1]},
                    ['td', {className: 'line'}, showLines ? line.number[0] : ['-', '\xa0', '+'][line.change + 1]],
                    showLines && ['td', {className: 'line'}, line.number[1]],
                    ['td',
                      ...line.spans.map(({change, text}) => change ? ['span', text] : text)
                    ]
                  ]
                ),
                !change && ['tr', {
                  className: chunks.length == 1 ? 'placeholder unchanged' : 'placeholder',
                  onClick: () => this.setState({diffExpanded: {...diffExpanded, [id]: true}})
                },
                  ['td', {className: 'line', colSpan: showLines && 2}, '⋮'],
                  ['td', chunks.length == 1 ? 'No Changes' : 'Expand']
                ]
              ];
            }))
          ];
        },
        renderDocNode: function(node, type) { //-
          if (type) {
            if (Array.isArray(node))
              return ['span', {className: 'docjs-types'},
                ...node.map(node => this.renderDocNode(node, true))
              ];
            type = typeof node == 'string' ? node : Object.keys(node)[0];
            return ['span', {className: 'docjs-type docjs-type-' + type},
              node == type ? ['span', node] : ['span', {className: 'docjs-' + type},
                ...(type == 'function' ? [
                  node.function.args && ['span', {className: 'docjs-args'},
                    this.renderDocNode(node.function.args)
                  ],
                  node.function.returns && ['span', {className: 'docjs-returns'},
                    this.renderDocNode(node.function.returns, true)
                  ]
                ] : [this.renderDocNode(node[type])])
              ]
            ];
          }
          if (Array.isArray(node))
            return ['span', {className: 'docjs-values'},
              ...node.map(node => this.renderDocNode(node))
            ];
          return ['span', {className: 'docjs-value'},
            ['span', {className: 'docjs-' + (node.name ? '' : 'un') + 'named-value'},
              typeof node == 'string' ? node : [
                node.name && ['span', {className: 'docjs-name'}, node.name],
                node.default && ['span', {className: 'docjs-default'}, node.default],
                this.renderDocNode(node.type, true)
              ]
            ]
          ];
        },
        renderDocs: function(code) { //-
          return parseDoc(code).reduce((blocks, block) => {
            if (!block.spec) console.error(block.error.toString());
            return [
              ...blocks,
              block.spec && ['pre', {className: 'docjs-spec'}, this.renderDocNode(block.spec)],
              ...block.text.map(text => text.pre
                ? ['pre', text.pre]
                : ['p', ...text.map(text => text.code ? ['code', text.code] : ['span', text])]
              )
            ];
          }, []);
        },
        getVersion: function(value) { //-
          const {apps, modules} = this.state;
          const entry = value && (value.app ? apps : modules)[value.id];
          return {entry, version: entry && entry.versions[value.version]};
        },
        dependencyVersionLabel: function(name, version) {
          const {modules} = this.state;
          if (version < 0 || !version && modules[name].versions[1].minor >= 0) version--;
          return version ? version > 0 ? 'v' + version : 'v' + -version + ' current' : '';
        },
        updateVersion: function({app, id, version}, value) { //-
          const fn = typeof value == 'function' ? value : () => value;
          return new Promise(resolve => this.setState(state => {
            const type = app ? 'apps' : 'modules';
            const group = state[type];
            const entry = group[id];
            const {versions} = entry;
            return {
              [type]: {
                ...group,
                [id]: {
                  ...entry,
                  versions: {
                    ...versions,
                    ...(version && {
                      [version]: {
                        ...versions[version],
                        ...fn(versions[version])
                      }
                    } || fn(versions))
                  }
                }
              }
            }
          }, resolve));
        },
        isCurrent: function({app, id, version}) { //-
          const {current} = this.state;
          return current && current.app == app && current.id == id && current.version == version;
        },
        getCurrent: function() { //-
          const {current} = this.state;
          return {current, ...this.getVersion(current)};
        },
        attachEditor: function(ref) { //-
          if (!ref || !window.CodeMirror) return;
          const {doc} = this.getCurrent().version || {};
          const editor = window.editor = this.editor = CodeMirror(ref, {
            value: doc || '',
            rulers: [120],
            lineNumbers: true,
            lint: {
              jshint: {esversion: 9},
              annotateScrollbar: true
            },
            matchBrackets: true,
            styleActiveLine: true,
            scrollbarStyle: 'simple',
            highlightSelectionMatches: {
              annotateScrollbar: true,
              minChars: 1
            },
            foldGutter: true,
            foldOptions: {widget: '\u27f7', minFoldSize: 1},
            gutters: ['CodeMirror-lint-markers', 'CodeMirror-linenumbers', 'CodeMirror-foldgutter'],
            extraKeys: {Tab: 'indentMore', 'Shift-Tab': 'indentLess'}
          });
          editor.on('changes', () => {
            const {current, version: {code, doc}} = this.getCurrent();
            this.updateVersion(current, {dirty: doc.getValue() !== code});
          });
          CodeMirror.commands.save = async () => {
            try {
              const current = await this.fork();
              this.setStatus('info', 'Saving...');
              const code = editor.getValue();
              await this.request(url(current), {method: 'put', body: code});
              this.setStatus('success', 'Saved');
              this.updateVersion(current, {code, dirty: false});
            } catch (e) {
              this.setStatus('error', e.message);
            }
          };
        },
        scrollLogs: function() { //-
          if (this.scroller)
            this.scroller.scrollTop = this.scroller.scrollHeight;
        },
        render: function() {
          const {
            login,
            apps,
            modules,
            connection,
            servers,
            server,
            status,
            panel,
            collapsed,
            appName,
            moduleName,
            moduleSearch,
            modal
          } = this.state;

          const baseUrl = this.props.baseUrl || '';
          const {current, entry, version} = this.getCurrent();
          const {loading, hidden, code} = version || {};
          const {app, id, version: major} = current || {};
          const published = (version && version.published || []).slice().reverse();
          const diffVersions = this.state.diffVersions || [];
          const diffIndex = diffVersions.filter(x => x != null)
            .map(minor => minor < 0 ? 0 : published.length - minor)
            .sort(); // new to old
          const diffEntries = diffIndex.map(i => i ? published[i - 1] : version);

          return ['div', {
            className: [
              collapsed && 'collapsed',
              !hidden && (loading ? 'show-loading' : panel ? 'show-' + panel : 'show-home'),
              current && (app ? 'show-app' : 'show-module')
            ].filter(Boolean).join(' ')
          },
            ['nav',
              ['div', {
                className: login ? 'home' : 'home logged-out',
                onClick: () => this.navigate()
              },
                ['div', {className: 'controls'},
                  // TODO: login, logout urls
                  login ? ['a',
                    {id: 'logout', href: '/logout', title: 'Log Out'},
                    this.icon('logout')
                  ] : ['a',
                      {
                        id: 'login', href: '/login', title: 'Log In or Register', onClick: e => {
                          e.preventDefault();
                          this.login()
                        }
                      },
                      this.icon('login')
                    ]
                ],
                ['span', {className: 'name'}, ...(login
                  ? [['img', {src: login.avatar}], login.name]
                  : [this.icon('logo'), 'Simpl.js']
                )]
              ],
              !servers.length || !login || ['div', {className: 'servers'},
                ['span', {className: 'icon'}, this.icon('network')],
                servers.length == 1
                  ? servers[0].name
                  : ['div', {className: 'select'},
                      ['select', {
                        value: server,
                        onChange: e => this.setState({
                          server: e.target.value,
                          // TODO: remove disconnected server after switching off of it
                          servers: this.state.servers.filter(server => !server.disabled)
                        }, () => this.send('connect'))
                      }, ...servers.map(({id, name, disabled}) =>
                        ['option', {value: id, disabled}, name]
                      )]
                    ]
              ],
              connection.message && ['div', {id: 'connection', className: connection.status},
                ['span', connection.message],
                ['pending', 'disconnected'].includes(connection.status) &&
                ['button', {onClick: this.connect}, 'Connect Now']
              ],
              [apps, modules].map(group => {
                const app = group == apps;
                const fieldName = app ? 'appName' : 'moduleName';
                const disabledName = app ? 'appDisabled' : 'moduleDisabled';
                const disabled = this.state[disabledName];
                return [
                  ['h2', app ? 'Apps' : 'Modules'],
                  ['form', {
                    onSubmit: e => { //-
                      e.preventDefault();
                      const id = this.state[fieldName];
                      const error = !id ? 'Please enter ' + (app ? 'app' : 'module') + ' name'
                          : id.includes('@') ? 'Illegal character: @'
                          : group[id] && 'Name already exists';
                      if (error) {
                        this[fieldName].focus();
                        alert(error);
                      } else {
                        this.setState({[disabledName]: true}, async () => {
                          const code = 'function(modules) {\n  \n}';
                          try {
                            await this.request(url({app, id, version: 1}), {
                              method: 'put',
                              body: code
                            });
                            this.setState({
                              [fieldName]: '',
                              [disabledName]: undefined,
                              [app ? 'apps' : 'modules']: {
                                ...group,
                                [id]: {
                                  id,
                                  name: id,
                                  versions: {
                                    1: {
                                      minor: -1,
                                      code,
                                      config: {},
                                      dependencies: {},
                                      doc: CodeMirror.Doc(code, {name: 'javascript'}),
                                      log: []
                                    }
                                  }
                                }
                              }
                            }, async () => {
                              await this.navigate({app, id, version: 1});
                              if (this.editor) {
                                this.editor.setCursor(1, 2);
                                this.editor.focus();
                              }
                            });
                          } catch (e) {
                            this.setStatus('error', e.message);
                            this.setState({[disabledName]: undefined});
                          }
                        });
                      }
                    }
                  },
                    ['input', {
                      ref: ref => this[fieldName] = ref,
                      disabled,
                      name: 'name',
                      value: app ? appName : moduleName,
                      onChange: e => this.setState({[fieldName]: e.target.value}),
                      placeholder: app ? 'New App' : 'New Module'
                    }],
                    ['button', {
                      disabled,
                      title: 'Add'
                    }, this.icon('add')]
                  ],
                  ['ul', {className: app && connection.status == 'connected' ? null : 'disabled'},
                    // TODO: change apps, modules to array to avoid sorting
                    ...Object.keys(group).sort().reduce((list, key) => {
                      const {id, name, source, versions} = group[key];
                      return [ //-
                        ...list,
                        ...Object.entries(versions).map(([version, {minor, state, dirty, loading, error}]) => {
                          const versionLabel = minor >= 0 ? 'v' + version : '';
                          const item = {app, id, version};
                          const selected = this.isCurrent(item);
                          const running = state == 'running';
                          const nextPanel = {
                            code: 'settings',
                            settings: app ? running && 'log' : 'docs'
                          }[panel] || 'code';
                          return ['li', {
                            className: [
                              selected && 'selected',
                              dirty && 'changed'
                            ].filter(Boolean).join(' ')
                          },
                            ['div', {className: 'controls'},
                              ['button', {
                                className: 'view',
                                title: 'View ' + capital(nextPanel),
                                onClick: () => this.navigate(item, nextPanel)
                              },
                                this.icon(nextPanel == 'docs' ? 'info' : nextPanel)
                              ],
                              ...(app ? running ? ['stop', 'restart'] : ['run'] : []).map(command =>
                                ['button', {
                                  className: command,
                                  title: capital(command),
                                  onClick: e => {
                                    e.stopPropagation();
                                    this.send(command, {app: name, version});
                                    if (command == 'run' || command == 'restart')
                                      this.navigate(item, 'log');
                                  }
                                }, this.icon(command)]
                              )
                            ],
                            ['a', {
                              className: 'name',
                              title: versionLabel ? name + ' ' + versionLabel : name,
                              href: baseUrl + url(item, app ? 'code' : 'docs'),
                              onClick: e => {
                                if (e.which > 1 || e.shiftKey || e.altKey || e.metaKey || e.ctrlKey) return;
                                e.preventDefault();
                                if (!selected) this.navigate(item);
                              }
                            },
                              loading && this.icon('loading'),
                              error && this.icon('error'),
                              name,
                              ['span', {className: 'version'},
                                ...(source ? [this.icon('link'), source + ' ' + versionLabel] : [versionLabel])
                              ]
                            ]
                          ];
                        })
                      ];
                    }, [])
                  ]
                ];
              }),
              ['button', {
                className: 'toggle',
                onClick: () => this.setState({collapsed: !collapsed})
              },
                this.icon(collapsed ? 'right' : 'left')
              ]
            ],
            ['div', {
              id: 'main',
              ref: ref => this.scroller = ref
            },
              ['div', {id: 'home'},
                ['h1', this.icon('logo'), 'Simpl.js'],
                !login && ['div', {className: 'promo'},
                  ['p',
                    ['strong', 'Become a Member!'],
                    ' Create a profile page and easily share apps and modules as part of the Simpl.js community. You can also deploy your apps to cloud servers and launch them right from your workspace!'
                  ],
                  ['a', {target: '_blank', href: 'https://simpljs.com/register'}, 'Sign Up'],
                  ['a', {target: '_blank', href: 'https://simpljs.com/pricing'}, 'Learn More']
                ],
                ['p',
                  'Simpl.js makes it easy to develop software that runs in your browser with access to low-level system APIs. ',
                  ['strong', 'Apps'], ' run in separate WebWorker threads with ', ['code', 'modules'], ' and ', ['code', 'config'],
                  ' objects as specified in the app\'s ', this.icon('settings'), 'settings panel. Any ', ['code', 'console'],
                  ' output is streamed to the app\'s ', this.icon('log'), 'log panel. ', ['strong', 'Modules'],
                  ' are libraries imported as dependencies by apps and other modules. Module documentation is generated using the ',
                  ['code', 'docs'], ' module syntax.'
                ],
                ['p', 'Apps and modules can be published with a major-minor versioning scheme. Major versions can be developed in parallel, while minor versions represent backward-compatible incremental changes.'],
                ['p', 'Browse the core modules and run the included demo apps to get started.'],
                ['div',
                  ['a', {target: '_blank', href: 'https://simpljs.com/support'}, this.icon('megaphone'), ['span', 'Simpl.js Forum']],
                  ['a', {id: 'facebook', target: '_blank', href: 'https://www.facebook.com/simpljs'}, this.icon('facebook')],
                  ['a', {id: 'twitter', target: '_blank', href: 'https://twitter.com/simpljs'}, this.icon('twitter')]
                ],
                !login && ['div',
                  ['button', {
                    className: 'revert', type: 'button', onClick: async () => {
                      if (!confirm('This will delete and restore all preinstalled modules in your workspace. Are you sure?'))
                        return;
                      await this.request('/restore', {method: 'post', body: 'scope=modules'});
                      location.reload();
                    }
                  },
                    this.icon('revert'),
                    'Restore Modules'
                  ],
                  ['button', {
                    className: 'revert', type: 'button', onClick: async () => {
                      if (!confirm('This will delete your entire workspace and restore default apps and modules. Are you sure?'))
                        return;
                      await this.request('/restore', {method: 'post', body: 'scope=full'});
                      location.reload();
                    }
                  },
                    this.icon('revert'),
                    'Reset Workspace'
                  ]
                ]
              ],
              ['div', {id: 'code', ref: this.attachEditor}],
              version && ['div', {id: 'settings'},
                ['section', {id: 'actions'},
                  !(entry.source || version.minor < 0) && ['div',
                    ['button', {className: 'publish', disabled: version.publishing, onClick: () => this.publish(true)},
                      this.icon('upgrade'),
                      'Publish v' + (Object.keys(entry.versions).length + 1) + '.0'
                    ]
                  ],
                  !entry.source && ['div',
                    ['button', {className: 'publish', disabled: version.publishing, onClick: () => this.publish()},
                      this.icon('upgrade'),
                      'Publish v' + major + '.' + (version.minor + 1)
                    ],
                  ],
                  (entry.source || version.minor < 0) && ['div',
                    ['button', {className: 'delete', disabled: version.deleting, onClick: this.remove},
                      this.icon('delete'),
                      entry.source ? 'Remove' : 'Delete'
                    ]
                  ]
                ],
                ['section', {id: 'dependencies'},
                  ['h2', 'Dependencies'],
                  ['div', {className: 'search'},
                    this.icon('search'),
                    ['input', { //-
                      placeholder: 'Search Modules',
                      value: moduleSearch,
                      onChange: e => this.setState({moduleSearch: e.target.value}),
                      onKeyDown: e => {
                        // TODO: handle focus on tab, up/down arrows
                        /*if (e.keyCode == 9 && !e.shiftKey || e.keyCode == 40) {
                          var second = this.nextSibling.firstChild;
                          if (second = second && second.nextSibling.firstChild) {
                            e.preventDefault()
                            second.focus();
                          }
                        }*/
                      }
                    }],
                    moduleSearch && ['ul', {className: 'suggest'},
                      ...Object.values(modules).reduce((results, {id, name, source, versions}) => { //-
                        if (name.toLowerCase().includes(moduleSearch.toLowerCase()) && (app || id != current.id)) {
                          const installedVersion = version.dependencies[id];
                          Object.entries(versions).forEach(([major, {minor}]) => {
                            if (!source && installedVersion != 1 - major)
                              results.push({name: id, version: 1 - major}); // current
                            if (minor >= 0 && installedVersion != major)
                              results.push({name: id, version: +major}); // published
                          });
                        }
                        return results;
                      }, []).map(({name, version}) => { //-
                        return ['li',
                          ['button', {
                            className: 'name',
                            onClick: async () => {
                              this.setState({moduleSearch: ''});
                              try {
                                const current = await this.fork();
                                await this.request(url(current, 'dependencies'), {
                                  method: 'post',
                                  body: JSON.stringify({name, version})
                                });
                                this.updateVersion(current, ({dependencies}) => ({
                                  dependencies: {
                                    ...dependencies,
                                    [name]: version
                                  }
                                }));
                              } catch (e) {
                                this.setStatus('error', e.message);
                              }
                            }
                          },
                            name,
                            ['span', {className: 'version'}, this.dependencyVersionLabel(name, version)]
                          ]
                        ];
                      })
                    ]
                  ],
                  ['ul', {className: 'dependencies'},
                    ...Object.entries(version.dependencies || {}).map(([id, version]) => { //-
                      const [name, source] = id.split('@');
                      return ['li', {className: 'module'},
                        ['button', {
                          className: 'delete', title: 'Remove', onClick: async () => {
                            // TODO: disable button
                            try {
                              const current = await this.fork();
                              await this.request(url(current, 'dependencies', id), {
                                method: 'delete'
                              });
                              this.updateVersion(current, ({dependencies}) => ({
                                dependencies: Object.keys(dependencies).reduce((dependencies, key) => ({
                                  ...dependencies,
                                  ...(key == id ? {} : {[key]: version})
                                }), {})
                              }));
                            } catch (e) {
                              this.setStatus('error', e.message);
                            }
                          }
                        }, '×'],
                        ['span', {className: 'name'},
                          name,
                          ['span', {className: 'version'},
                            ...(source ? [this.icon('link'), source + ' '] : []),
                            this.dependencyVersionLabel(name, version)
                          ]
                        ]
                      ];
                    })
                  ]
                ],
                ['section', {id: 'config'},
                  ['h2', 'Configuration'],
                  ['pre', {className: 'jsonv'},
                    [components.jsonv, {
                      value: version.config || {},
                      editor: true,
                      onChange: async (type, path, value, instance) => { //-
                        const before = version.config;
                        const config = instance.update(type, path, value);
                        this.updateVersion(current, {config});
                        try {
                          await this.request(url(current, 'config'), {
                            method: 'put',
                            body: JSON.stringify(config)
                          });
                        } catch (e) {
                          this.updateVersion(current, {config: before});
                          this.setStatus('error', e.message);
                        }
                      }
                    }]
                  ]
                ],
                ['section', {id: 'history'},
                  ['h2', 'History'],
                  ['ul', {className: 'timeline'},
                    ...[version, ...published].map((item, i) => {
                      const minor = i ? published.length - i : -1; // -1 ... 3 2 1 0
                      return ['li', { //-
                        className: [
                          i == diffIndex[0] && 'selected',
                          i == diffIndex[0] ? 'first selected'
                            : i == diffIndex[1] ? 'last selected'
                              : i > diffIndex[0] && i < diffIndex[1] && 'inner'
                        ][diffIndex.length - 1],
                        onClick: async () => {
                          const [first, last] = diffVersions;
                          this.setState({
                            diffVersions: minor == first ? [last, null]
                              : minor == last ? [first, null]
                              : first == null ? [minor, null]
                              : [first, minor],
                            diffExpanded: {}
                          });
                          if (item.code == null && !item.loading) {
                            this.updateVersion(current, {
                              published: [
                                ...published.slice(0, i - 1),
                                {loading: true},
                                ...published.slice(i)
                              ].reverse()
                            });
                            let data = {};
                            try {
                              data = await this.request(url(current, minor));
                            } catch (e) {
                              this.setStatus('error', e.message);
                            }
                            this.updateVersion(current, {
                              published: [
                                ...published.slice(0, i - 1),
                                data,
                                ...published.slice(i)
                              ].reverse()
                            });
                          }
                        }
                      },
                        ['span'],
                        i ? 'v' + major + '.' + minor : 'Current'
                      ];
                    }).slice(entry.source ? 1 : 0) // no current version for linked modules
                  ],
                  diffEntries.some(version => version.loading)
                    ? ['div', 'Loading...']
                    : diffEntries.length > 0 && ['div',
                      ['h3', 'Dependencies'],
                      this.renderDiff('dependencies', diffEntries.map(version =>
                        Object.entries(version.dependencies).map(
                          ([name, version]) => name + ' ' + this.dependencyVersionLabel(name, version)
                        ).join('\n')
                      )),
                      app && [
                        ['h3', 'Configuration'],
                        this.renderDiff('config', diffEntries.map(version =>
                          JSON.stringify(version.config, null, 2)
                        ))
                      ],
                      ['h3', 'Code'],
                      this.renderDiff('code', diffEntries.map(version => version.code))
                    ]
                ]
              ],
              app ? ['pre', {id: 'log'},
                ...version.log.map(({level, message, module, version, line}) =>
                  ['div', {className: 'entry ' + (level == 'log' ? 'debug' : level)},
                    ['div', {
                      className: 'location',
                      onClick: () => this.navigate({
                        app: !module,
                        id: module || id,
                        version: version ? 1 - version : major
                      }, 'code', line)
                    },
                      (module || '') + (line ? ':' + line : '')
                    ],
                    ['div', {className: 'message'},
                      ...message.reduce((spans, part, i) => {
                        let span = [];
                        if (typeof part == 'string') {
                          let link;
                          while (link = /\b(https?|ftp):\/\/[^\s/$.?#].\S*/i.exec(part)) {
                            const url = link[0];
                            if (link.index) span.push(['span', part.substr(0, link.index)]);
                            span.push(['a', {href: url, target: '_blank'}, url]);
                            part = part.substr(link.index + url.length);
                          }
                          if (part) span.push(['span', part]);
                        } else {
                          span = [
                            ['div', {className: 'jsonv'}, 
                              [components.jsonv, {value: part, collapsed: true}]
                            ]
                          ];
                        }
                        return [
                          ...spans,
                          ...(i ? [' '] : []),
                          ...span
                        ];
                      }, [])
                    ]
                  ]
                )
              ] : ['div', {id: 'docs'},
                ['h1', entry && entry.name],
                ...(code ? this.renderDocs(code) : [])
              ],
              status && ['div', {id: 'status', className: status.type}, status.message],
              modal && ['div', {
                id: 'modal',
                onClick: e => {
                  if (e.target == e.currentTarget)
                    this.abortLogin();
                }
              },
                ['div',
                  ['iframe', {src: this.props.loginUrl}]
                ]
              ]
            ]
          ];
        }
      };
    }
  };
});