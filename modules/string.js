simpl.add('string', function() {
  /** string: {
        toUTF8Buffer: function(string:string) -> Uint8Array,
        fromUTF8Buffer: function(buffer:ArrayBuffer) -> string
      }
      
      Converts between utf8-encoded binary ArrayBuffers and javascript strings. */
  return {
    toUTF8Buffer: function(string) {
      var c, len = string.length;
      for (var i = 0, j = 0; i < len; i++) {
        c = string.charCodeAt(i);
        j += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : c < 0x200000 ? 4 : c < 0x4000000 ? 5 : 6;
      }
      var buffer = new Uint8Array(j);
      for (var i = 0, k = 0; i < len; i++) {
        c = string.charCodeAt(i);
        if (c < 128) {
          buffer[k++] = c;
        } else if (c < 0x800) {
          buffer[k++] = 192 + (c >>> 6);
          buffer[k++] = 128 + (c & 63);
        } else if (c < 0x10000) {
          buffer[k++] = 224 + (c >>> 12);
          buffer[k++] = 128 + (c >>> 6 & 63);
          buffer[k++] = 128 + (c & 63);
        } else if (c < 0x200000) {
          buffer[k++] = 240 + (c >>> 18);
          buffer[k++] = 128 + (c >>> 12 & 63);
          buffer[k++] = 128 + (c >>> 6 & 63);
          buffer[k++] = 128 + (c & 63);
        } else if (c < 0x4000000) {
          buffer[k++] = 248 + (c >>> 24);
          buffer[k++] = 128 + (c >>> 18 & 63);
          buffer[k++] = 128 + (c >>> 12 & 63);
          buffer[k++] = 128 + (c >>> 6 & 63);
          buffer[k++] = 128 + (c & 63);
        } else {
          buffer[k++] = 252 + (c >>> 30);
          buffer[k++] = 128 + (c >>> 24 & 63);
          buffer[k++] = 128 + (c >>> 18 & 63);
          buffer[k++] = 128 + (c >>> 12 & 63);
          buffer[k++] = 128 + (c >>> 6 & 63);
          buffer[k++] = 128 + (c & 63);
        }
      }
      return buffer;
    },
    fromUTF8Buffer: function(buffer) {
      buffer = new Uint8Array(buffer);
      var string = '';
      for (var n, len = buffer.length, i = 0; i < len; i++) {
        n = buffer[i];
        string += String.fromCharCode(n > 251 && n < 254 && i + 5 < len
          ? (n - 252) * 1073741824 + (buffer[++i] - 128 << 24) + (buffer[++i] - 128 << 18) + (buffer[++i] - 128 << 12) + (buffer[++i] - 128 << 6) + buffer[++i] - 128
          : n > 247 && n < 252 && i + 4 < len
            ? (n - 248 << 24) + (buffer[++i] - 128 << 18) + (buffer[++i] - 128 << 12) + (buffer[++i] - 128 << 6) + buffer[++i] - 128
            : n > 239 && n < 248 && i + 3 < len
              ? (n - 240 << 18) + (buffer[++i] - 128 << 12) + (buffer[++i] - 128 << 6) + buffer[++i] - 128
              : n > 223 && n < 240 && i + 2 < len
                ? (n - 224 << 12) + (buffer[++i] - 128 << 6) + buffer[++i] - 128
                : n > 191 && n < 224 && i + 1 < len
                  ? (n - 192 << 6) + buffer[++i] - 128
                  : n);
      }
      return string;
    }
  };
});