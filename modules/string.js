simpl.add('string', function() {
  /** string: {
        toUTF8Buffer: function(string:string) -> Uint8Array,
        fromUTF8Buffer: function(bytes:ArrayBuffer) -> string,
        fromLatin1Buffer: function(bytes:ArrayBuffer) -> string,
        base64ToBuffer: function(base64:string, url=false:boolean) -> Uint8Array,
        base64FromBuffer: function(bytes:ArrayBuffer, url=false:boolean) -> string,
        hexToBuffer: function(hex:string) -> Uint8Array,
        hexFromBuffer: function(bytes:ArrayBuffer) -> string
      }
      
      Converts between strings and binary data representations. Base 64 functions support a URL-safe encoding that
      removes `=` and replaces `+` and `/` with `-` and `_`, respectively. */
  return {
    toUTF8Buffer: function(string) {
      if (typeof string != 'string')
        throw new Error('toUTF8Buffer expects string input');
      var c, len = string.length;
      for (var i = 0, j = 0; i < len; i++) {
        c = string.charCodeAt(i);
        j += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : c < 0x200000 ? 4 : c < 0x4000000 ? 5 : 6;
      }
      var bytes = new Uint8Array(j);
      for (var i = 0, k = 0; i < len; i++) {
        c = string.charCodeAt(i);
        if (c < 128) {
          bytes[k++] = c;
        } else if (c < 0x800) {
          bytes[k++] = 192 + (c >>> 6);
          bytes[k++] = 128 + (c & 63);
        } else if (c < 0x10000) {
          bytes[k++] = 224 + (c >>> 12);
          bytes[k++] = 128 + (c >>> 6 & 63);
          bytes[k++] = 128 + (c & 63);
        } else if (c < 0x200000) {
          bytes[k++] = 240 + (c >>> 18);
          bytes[k++] = 128 + (c >>> 12 & 63);
          bytes[k++] = 128 + (c >>> 6 & 63);
          bytes[k++] = 128 + (c & 63);
        } else if (c < 0x4000000) {
          bytes[k++] = 248 + (c >>> 24);
          bytes[k++] = 128 + (c >>> 18 & 63);
          bytes[k++] = 128 + (c >>> 12 & 63);
          bytes[k++] = 128 + (c >>> 6 & 63);
          bytes[k++] = 128 + (c & 63);
        } else {
          bytes[k++] = 252 + (c >>> 30);
          bytes[k++] = 128 + (c >>> 24 & 63);
          bytes[k++] = 128 + (c >>> 18 & 63);
          bytes[k++] = 128 + (c >>> 12 & 63);
          bytes[k++] = 128 + (c >>> 6 & 63);
          bytes[k++] = 128 + (c & 63);
        }
      }
      return bytes;
    },
    fromUTF8Buffer: function(bytes) {
      bytes = new Uint8Array(bytes);
      var string = [];
      for (var n, len = bytes.length, i = 0; i < len; i++) {
        n = bytes[i];
        string.push(String.fromCharCode(n > 251 && n < 254 && i + 5 < len
          ? (n - 252) * 1073741824 + (bytes[++i] - 128 << 24) + (bytes[++i] - 128 << 18) + (bytes[++i] - 128 << 12) + (bytes[++i] - 128 << 6) + bytes[++i] - 128
          : n > 247 && n < 252 && i + 4 < len
            ? (n - 248 << 24) + (bytes[++i] - 128 << 18) + (bytes[++i] - 128 << 12) + (bytes[++i] - 128 << 6) + bytes[++i] - 128
            : n > 239 && n < 248 && i + 3 < len
              ? (n - 240 << 18) + (bytes[++i] - 128 << 12) + (bytes[++i] - 128 << 6) + bytes[++i] - 128
              : n > 223 && n < 240 && i + 2 < len
                ? (n - 224 << 12) + (bytes[++i] - 128 << 6) + bytes[++i] - 128
                : n > 191 && n < 224 && i + 1 < len
                  ? (n - 192 << 6) + bytes[++i] - 128
                  : n));
      }
      return string.join('');
    },
    fromLatin1Buffer: function(bytes) {
      bytes = new Uint8Array(bytes);
      var string = [];
      for (var len = bytes.length, i = 0; i < len; i++) {
        string.push(String.fromCharCode(bytes[i]));
      }
      return string.join('');
    },
    base64ToBuffer: function(base64, url) {
      if (typeof base64 != 'string')
        throw new Error('base64ToBuffer expects string input');
      if (url) base64 = base64.replace(/-/g, '+').replace(/_/g, '/');
      base64 = base64.replace(/=+$/, '');
      var mod = base64.length % 4;
      if (mod == 1) throw new RangeError('Invalid base-64 string');
      var bytes = new Uint8Array((base64.length / 4 << 0) * 3 + (mod ? mod-1 : 0));
      for (var b = 0, len = base64.length, i = 0, j = 0, k = 0; i < len; i++) {
        var ch = base64.charCodeAt(i);
        ch = ch > 64 && ch < 91 ? ch - 65
          : ch > 96 && ch < 123 ? ch - 71
          : ch > 47 && ch < 58 ? ch + 4
          : ch == 43 ? 62
          : ch == 47 ? 63
          : -1;
        if (ch < 0) throw new RangeError('Invalid base-64 string');
        b |= k < 3 ? k < 2 ? k ? (ch & 48) >> 4 : ch << 2 : (ch & 60) >> 2 : ch;
        if (k) {
          bytes[j++] = b;
          b = k < 3 ? k < 2 ? (ch & 15) << 4 : (ch & 3) << 6 : 0;
        }
        k = k == 3 ? 0 : k + 1;
      }
      return bytes;
    },
    base64FromBuffer: function(bytes, url) {
      bytes = new Uint8Array(bytes);
      var base64 = [];
      for (var len = bytes.length, i = 0; i < len;) {
        var b = bytes[i++] << 16 | bytes[i++] << 8 | bytes[i++];
        for (var j = 0; j < 4; j++) {
          if (j > 1 && bytes[i+j-4] == null) {
            base64.push('=');
          } else {
            var ch = b >> 6*(3-j) & 63;
            base64.push(String.fromCharCode(ch < 26 ? ch + 65
              : ch < 52 ? ch + 71
              : ch < 62 ? ch - 4
              : ch < 63 ? 43
              : 47));
          }
        }
      }
      base64 = base64.join('');
      return url ? base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '') : base64;
    },
    hexToBuffer: function(hex) {
      if (typeof hex != 'string')
        throw new Error('hexToBuffer expects string input');
      var len = hex.length;
      if (/[^0-9a-f]/i.test(hex) || len % 2) throw new RangeError('Invalid hex string');
      var bytes = new Uint8Array(len / 2);
      for (var i = 0; i < len; i++)
        bytes[i] = parseInt(hex.substr(i*2, 2), 16);
      return bytes;
    },
    hexFromBuffer: function(bytes) {
      bytes = new Uint8Array(bytes);
      var hex = [];
      for (var len = bytes.length, i = 0; i < len; i++) {
        var b = bytes[i];
        hex.push((b < 16 ? '0' : '')+b.toString(16));
      }
      return hex.join('');
    }
  };
});