simpl.add('diff', function() {

  var buildValues = function(components, newString, oldString) {
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
      components[length - 2].value += lastComponent.value;
      components.pop();
    }
    return components;
  };
  var pushComponent = function(components, added, removed) {
    var last = components[components.length - 1];
    if (last && last.added === added && last.removed === removed)
      components[components.length - 1] = {count: last.count + 1, added: added, removed: removed};
    else
      components.push({count: 1, added: added, removed: removed});
  };
  var extractCommon = function(basePath, newString, oldString, diagonalPath) {
    var newPos = basePath.newPos,
        oldPos = newPos - diagonalPath,
        count = 0;
    while (newPos < newString.length-1 && oldPos < oldString.length-1 && newString[newPos+1] === oldString[oldPos+1]) {
      newPos++;
      oldPos++;
      count++;
    }
    if (count) basePath.components.push({count: count});
    basePath.newPos = newPos;
    return oldPos;
  };
  var tokenize = function(value) {
    return value.replace(/\r?\n$/, '').split('\n').map(function(line) {
      return line + '\n';
    });
  };
  var highlightPair = function(a, b) {
    var ta = a.spans[0].text,
        tb = b.spans[0].text,
        min = Math.min(ta.length, tb.length);
    for (var i = 0; i < min && ta[i] == tb[i]; i++);
    for (var j = 0; j < min - i && ta[ta.length-j-1] == tb[tb.length-j-1]; j++);
    var prefix = ta.substr(0, i),
        suffix = ta.substr(ta.length-j);
    if (!/^\s*$/.test(prefix) || !/^\s*$/.test(suffix)) {
      a.spans = [{text: prefix}, {change: true, text: ta.substring(i, ta.length-j)}, {text: suffix}];
      b.spans = [{text: prefix}, {change: true, text: tb.substring(i, tb.length-j)}, {text: suffix}];
    }
  };
  var highlight = function(lines) {
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
          added.forEach(function(line, i) {
            highlightPair(line, removed[i]);
          });
        added = [];
        removed = [];
      }
    }
    return lines;
  };
  var self;
  return self = {
    diffLines: function(a, b) {

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
    },
    diffChunks: function(a, b, context) {
      var lineA = 1, lineB = 1,
          changeStart, changeEnd = 0, prevEnd = 0,
          groups = [];

      context = Math.max(0, context) || 0;

      var lines = self.diffLines(a, b).reduce(function(lines, span) {
        var change = span.added ? 1 : span.removed ? -1 : 0;
        return lines.concat(span.value.replace(/\n$/, '').split('\n').map(function(line) {
          return {
            change: change,
            number: [change <= 0 && lineA++, change >= 0 && lineB++],
            spans: [{text: line}]
          };
        }));
      }, []);

      lines.forEach(function(line, i) {
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
  };
});
