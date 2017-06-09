simpl.add('crypto', function() {

/** crypto: {
      md5: HashFunction,
      sha1: HashFunction,
      sha256: HashFunction,
      hmac: function(key:ArrayBuffer, data=null:ArrayBuffer, algorithm=`crypto.sha256`:HashFunction) -> ArrayBuffer|function(data:ArrayBuffer) -> ArrayBuffer,
      pbkdf2: function(password:ArrayBuffer, salt:ArrayBuffer, iterations=1000:number) -> ArrayBuffer
    }

    Cryptographic functions. `hmac` returns an ArrayBuffer MAC if `data` is provided up front, or a MAC generator
    function otherwise.
    
    Consider using native `crypto.subtle` functions (which operate asynchronously using Promises) instead of this module
    for secure crypto primitives:

   `// hash (MD5 not supported):
    crypto.subtle.digest('sha-256', data);`
    
   `// hmac:
    crypto.subtle.importKey('raw', key, {name: 'hmac', hash: 'sha-256'}, false, ['sign']).then(function(key) {
      return crypto.subtle.sign({name: 'hmac', hash: 'sha-256'}, key, data);
    });`
    
   `// pbkdf2:
    crypto.subtle.importKey('raw', password, 'pbkdf2', false, ['deriveKey']).then(function(key) {
      return crypto.subtle.deriveKey({name: 'pbkdf2', salt: salt, iterations: iterations, hash: 'sha-256'},
        key, {name: 'aes-cbc', length: 256}, true, ['encrypt']);
    }).then(function(key) {
      return crypto.subtle.exportKey('raw', key);
    });` */
    
/** HashFunction: function(data=undefined:ArrayBuffer) -> ArrayBuffer|MessageDigest

    A hash function returns an ArrayBuffer hash if `data` is provided up front, or a MessageDigest object otherwise. */
    
/** MessageDigest: {
      update: function(data:ArrayBuffer) -> MessageDigest,
      digest: function -> ArrayBuffer
    } */
  
  var self,
      md5Index = [
        0,1, 2, 3, 4, 5, 6, 7, 8, 9,10,11,12,13,14,15,
        1,6,11, 0, 5,10,15, 4, 9,14, 3, 8,13, 2, 7,12,
        5,8,11,14, 1, 4, 7,10,13, 0, 3, 6, 9,12,15, 2,
        0,7,14, 5,12, 3,10, 1, 8,15, 6,13, 4,11, 2, 9],
      md5Shift = [
        7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,
        5, 9,14,20,5, 9,14,20,5, 9,14,20,5, 9,14,20,
        4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,
        6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21],
      md5Key = [
        0xd76aa478,0xe8c7b756,0x242070db,0xc1bdceee,0xf57c0faf,0x4787c62a,0xa8304613,0xfd469501,
        0x698098d8,0x8b44f7af,0xffff5bb1,0x895cd7be,0x6b901122,0xfd987193,0xa679438e,0x49b40821,
        0xf61e2562,0xc040b340,0x265e5a51,0xe9b6c7aa,0xd62f105d,0x02441453,0xd8a1e681,0xe7d3fbc8,
        0x21e1cde6,0xc33707d6,0xf4d50d87,0x455a14ed,0xa9e3e905,0xfcefa3f8,0x676f02d9,0x8d2a4c8a,
        0xfffa3942,0x8771f681,0x6d9d6122,0xfde5380c,0xa4beea44,0x4bdecfa9,0xf6bb4b60,0xbebfbc70,
        0x289b7ec6,0xeaa127fa,0xd4ef3085,0x04881d05,0xd9d4d039,0xe6db99e5,0x1fa27cf8,0xc4ac5665,
        0xf4292244,0x432aff97,0xab9423a7,0xfc93a039,0x655b59c3,0x8f0ccc92,0xffeff47d,0x85845dd1,
        0x6fa87e4f,0xfe2ce6e0,0xa3014314,0x4e0811a1,0xf7537e82,0xbd3af235,0x2ad7d2bb,0xeb86d391],
      sha256Key = [
        0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
        0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
        0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
        0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
        0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
        0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
        0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
        0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  
  var md5 = function(length, bufferLength, buffer, h0, h1, h2, h3) {
    var self,
        bufferBytes = new Uint8Array(64),
        bufferData = new DataView(bufferBytes.buffer);
    if (buffer && bufferLength) bufferBytes.set(buffer.subarray(0, bufferLength));
    return self = {
      update: function(data) {
        var offset = 0,
            len = data.byteLength,
            words = [];
        if (!length) {
          h0 = 0x67452301;
          h1 = 0xefcdab89;
          h2 = 0x98badcfe;
          h3 = 0x10325476;
        }
        length += len;
        data = new Uint8Array(data);
        do {
          bufferBytes.set(data.subarray(offset, offset+64-bufferLength), bufferLength);
          if (bufferLength + len - offset < 64) {
            bufferLength += len - offset;
            break;
          }
          offset += 64 - bufferLength;
          bufferLength = 0;
          var r, tmp, i0 = h0, i1 = h1, i2 = h2, i3 = h3;
          for (var i = 0; i < 64; i++) {
            if (i < 16) words[i] = bufferData.getUint32(i*4, true);
            tmp = i0 + md5Key[i] + words[md5Index[i]];
            tmp += i < 16 ? i3 ^ i1 & (i2 ^ i3)
                 : i < 32 ? i2 ^ i3 & (i1 ^ i2)
                 : i < 48 ? i1 ^ i2 ^ i3
                 : i2 ^ (i1 | ~i3);
            i0 = i3;
            i3 = i2;
            i2 = i1;
            r = md5Shift[i];
            i1 += tmp << r | tmp >>> 32 - r;
          }
          h0 = h0+i0 | 0;
          h1 = h1+i1 | 0;
          h2 = h2+i2 | 0;
          h3 = h3+i3 | 0;
        } while (true);
        return self;
      },
      digest: function() {
        var len = (bufferLength < 56 ? 64 : 128) - bufferLength,
            padding = new DataView(new ArrayBuffer(len)),
            hash = new DataView(new ArrayBuffer(16));
        length *= 8;
        padding.setUint8(0, 128);
        padding.setUint32(len-8, length | 0, true);
        padding.setUint32(len-4, length / 0x100000000 | 0, true);
        self.update(padding.buffer);
        [h0,h1,h2,h3].forEach(function(h, i) { hash.setUint32(i*4, h, true); });
        length = bufferLength = 0;
        return hash.buffer;
      },
      clone: function() {
        return md5(length, bufferLength, bufferBytes, h0, h1, h2, h3);
      }
    };
  };
  var sha1 = function(length, bufferLength, buffer, h0, h1, h2, h3, h4) {
    var self,
        bufferBytes = new Uint8Array(64),
        bufferData = new DataView(bufferBytes.buffer);
    if (buffer && bufferLength) bufferBytes.set(buffer.subarray(0, bufferLength));
    return self = {
      update: function(data) {
        var offset = 0,
            len = data.byteLength,
            words = [];
        if (!length) {
          h0 = 0x67452301;
          h1 = 0xefcdab89;
          h2 = 0x98badcfe;
          h3 = 0x10325476;
          h4 = 0xc3d2e1f0;
        }
        length += len;
        data = new Uint8Array(data);
        do {
          bufferBytes.set(data.subarray(offset, offset+64-bufferLength), bufferLength);
          if (bufferLength + len - offset < 64) {
            bufferLength += len - offset;
            break;
          }
          offset += 64 - bufferLength;
          bufferLength = 0;
          var tmp, i0 = h0, i1 = h1, i2 = h2, i3 = h3, i4 = h4;
          for (var i = 0; i < 80; i++) {
            if (i < 16) {
              tmp = words[i] = bufferData.getUint32(i*4);
            } else if (i < 32) {
              tmp = words[i-3] ^ words[i-8] ^ words[i-14] ^ words[i-16];
              tmp = words[i] = tmp << 1 | tmp >>> 31;
            } else {
              tmp = words[i-6] ^ words[i-16] ^ words[i-28] ^ words[i-32];
              tmp = words[i] = tmp << 2 | tmp >>> 30;
            }
            tmp += (i0 << 5 | i0 >>> 27) + i4;
            tmp += i < 20 ? (i3 ^ i1 & (i2 ^ i3)) + 0x5a827999
                 : i < 40 ? (i1 ^ i2 ^ i3) + 0x6ed9eba1
                 : i < 60 ? (i1 & i2 | i3 & (i1 ^ i2)) + 0x8f1bbcdc
                 : (i1 ^ i2 ^ i3) + 0xca62c1d6;
            i4 = i3;
            i3 = i2;
            i2 = i1 << 30 | i1 >>> 2;
            i1 = i0;
            i0 = tmp;
          }
          h0 = h0+i0 | 0;
          h1 = h1+i1 | 0;
          h2 = h2+i2 | 0;
          h3 = h3+i3 | 0;
          h4 = h4+i4 | 0;
        } while (true);
        return self;
      },
      digest: function() {
        var len = (bufferLength < 56 ? 64 : 128) - bufferLength,
            padding = new DataView(new ArrayBuffer(len)),
            hash = new DataView(new ArrayBuffer(20));
        length *= 8;
        padding.setUint8(0, 128);
        padding.setUint32(len-8, length / 0x100000000 | 0);
        padding.setUint32(len-4, length | 0);
        self.update(padding.buffer);
        [h0,h1,h2,h3,h4].forEach(function(h, i) { hash.setUint32(i*4, h); });
        length = bufferLength = 0;
        return hash.buffer;
      },
      clone: function() {
        return sha1(length, bufferLength, bufferBytes, h0, h1, h2, h3, h4);
      }
    }
  };
  var sha256 = function(length, bufferLength, buffer, h0, h1, h2, h3, h4, h5, h6, h7) {
    var self,
        bufferBytes = new Uint8Array(64),
        bufferData = new DataView(bufferBytes.buffer);
    if (buffer && bufferLength) bufferBytes.set(buffer.subarray(0, bufferLength));
    return self = {
      update: function(data) {
        var offset = 0,
            len = data.byteLength,
            words = [];
        if (!length) {
          h0 = 0x6a09e667;
          h1 = 0xbb67ae85;
          h2 = 0x3c6ef372;
          h3 = 0xa54ff53a;
          h4 = 0x510e527f;
          h5 = 0x9b05688c;
          h6 = 0x1f83d9ab;
          h7 = 0x5be0cd19;
        }
        length += len;
        data = new Uint8Array(data);
        do {
          bufferBytes.set(data.subarray(offset, offset+64-bufferLength), bufferLength);
          if (bufferLength + len - offset < 64) {
            bufferLength += len - offset;
            break;
          }
          offset += 64 - bufferLength;
          bufferLength = 0;
          var a, b, tmp,
              i0 = h0, i1 = h1, i2 = h2, i3 = h3,
              i4 = h4, i5 = h5, i6 = h6, i7 = h7;
          for (var i = 0; i < 64; i++) {
            if (i < 16) {
              tmp = words[i] = bufferData.getUint32(i*4);
            } else {
              a = words[i+1 & 15];
              b = words[i+14 & 15];
              tmp = words[i & 15] = (a >>> 7 ^ a >>> 18 ^ a >>> 3 ^ a << 25 ^ a << 14) + 
                (b >>> 17 ^ b >>> 19 ^ b >>> 10 ^ b << 15 ^ b << 13) +
                words[i & 15] + words[i+9 & 15] | 0;
            }
            tmp += i7 + (i4 >>> 6 ^ i4 >>> 11 ^ i4 >>> 25 ^ i4 << 26 ^ i4 << 21 ^ i4 << 7) + (i6 ^ i4 & (i5 ^ i6)) + sha256Key[i];
            i7 = i6;
            i6 = i5;
            i5 = i4;
            i4 = i3 + tmp | 0;
            i3 = i2;
            i2 = i1;
            i1 = i0;
            i0 = tmp + (i1 & i2 ^ i3 & (i1 ^ i2)) + (i1 >>> 2 ^ i1 >>> 13 ^ i1 >>> 22 ^ i1 << 30 ^ i1 << 19 ^ i1 << 10) | 0;
          }
          h0 = h0+i0 | 0;
          h1 = h1+i1 | 0;
          h2 = h2+i2 | 0;
          h3 = h3+i3 | 0;
          h4 = h4+i4 | 0;
          h5 = h5+i5 | 0;
          h6 = h6+i6 | 0;
          h7 = h7+i7 | 0;
        } while (true);
        return self;
      },
      digest: function() {
        var len = (bufferLength < 56 ? 64 : 128) - bufferLength,
            padding = new DataView(new ArrayBuffer(len)),
            hash = new DataView(new ArrayBuffer(32));
        length *= 8;
        padding.setUint8(0, 128);
        padding.setUint32(len-8, length / 0x100000000 | 0);
        padding.setUint32(len-4, length | 0);
        self.update(padding.buffer);
        [h0,h1,h2,h3,h4,h5,h6,h7].forEach(function(h, i) { hash.setUint32(i*4, h); });
        length = bufferLength = 0;
        return hash.buffer;
      },
      clone: function() {
        return sha256(length, bufferLength, bufferBytes, h0, h1, h2, h3, h4, h5, h6, h7);
      }
    };
  };
  
  return self = {
    md5: function(data) {
      var hash = md5(0, 0);
      return data ? hash.update(data).digest() : hash;
    },
    sha1: function(data) {
      var hash = sha1(0, 0);
      return data ? hash.update(data).digest() : hash;
    },
    sha256: function(data) {
      var hash = sha256(0, 0);
      return data ? hash.update(data).digest() : hash;
    },
    hmac: function(key, data, algorithm) {
      var hash = algorithm || self.sha256, k,
          a = new DataView(new ArrayBuffer(64)),
          b = new DataView(new ArrayBuffer(64));
      if (key.byteLength > 64)
        key = hash(key);
      if (key.byteLength < 64) {
        k = new Uint8Array(new ArrayBuffer(64));
        k.set(new Uint8Array(key));
        key = k.buffer;
      }
      key = new DataView(key);
      for (var i = 0; i < 64; i += 4) {
        k = key.getUint32(i);
        a.setUint32(i, k ^ 0x36363636);
        b.setUint32(i, k ^ 0x5c5c5c5c);
      }
      a = hash().update(a.buffer);
      b = hash().update(b.buffer);
      return data ? b.update(a.update(data).digest()).digest() : function(data) {
        return b.clone().update(a.clone().update(data).digest()).digest();
      };
    },
    pbkdf2: function(password, salt, iterations) {
      if (!iterations) iterations = 1000;
      var key, prf = self.hmac(password);
      var s = new Uint8Array(salt.byteLength+4);
      s.set(new Uint8Array(salt));
      s[s.length-1] = 1;
      var k = key = new Uint8Array(prf(s.buffer));
      for (var i = 1; i < iterations; i++) {
        k = new Uint8Array(prf(k.buffer));
        for (var j = 0; j < k.length; j++)
          key[j] ^= k[j];
      }
      return key.buffer;
    }
  };
});