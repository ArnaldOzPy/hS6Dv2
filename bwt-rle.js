
export function transform6D(data) {
  const { bwt, originalIndex } = applyBWT(data);
  const mtf = mtfEncode(bwt);
  const rle = encodeRLE(mtf);
  
  const output = new Uint8Array(rle.length + 4);
  const view = new DataView(output.buffer);
  view.setUint32(0, originalIndex, true);
  output.set(rle, 4);
  return output;
}

export function inverse6D(encoded) {
  const view = new DataView(encoded.buffer);
  const originalIndex = view.getUint32(0, true);
  const rleData = new Uint8Array(encoded.buffer.slice(4));
  const decodedRLE = decodeRLE(rleData);
  const imtf = mtfDecode(decodedRLE);
  return inverseBWT(imtf, originalIndex);
}

function buildSuffixArray(data) {
  const n = data.length;
  const suffixes = Array.from({ length: n }, (_, i) => i);
  
  suffixes.sort((a, b) => {
    for (let i = 0; i < n; i++) {
      const aIdx = (a + i) % n;
      const bIdx = (b + i) % n;
      const diff = data[aIdx] - data[bIdx];
      if (diff !== 0) return diff;
    }
    return 0;
  });
  
  return suffixes;
}

function applyBWT(data) {
  const suffixArray = buildSuffixArray(data);
  const n = data.length;
  const bwt = new Uint8Array(n);
  let originalIndex = -1;

  for (let i = 0; i < n; i++) {
    const pos = suffixArray[i];
    if (pos === 0) {
      originalIndex = i;
      bwt[i] = data[n - 1];
    } else {
      bwt[i] = data[pos - 1];
    }
  }
  
  return { bwt, originalIndex };
}

function mtfEncode(data) {
  const alphabet = Array.from({ length: 256 }, (_, i) => i);
  const output = new Uint8Array(data.length);
  
  for (let i = 0; i < data.length; i++) {
    const byte = data[i];
    const idx = alphabet.indexOf(byte);
    output[i] = idx;
    
  
    alphabet.splice(idx, 1);
    alphabet.unshift(byte);
  }
  
  return output;
}

function mtfDecode(data) {
  const alphabet = Array.from({ length: 256 }, (_, i) => i);
  const output = new Uint8Array(data.length);
  
  for (let i = 0; i < data.length; i++) {
    const idx = data[i];
    const byte = alphabet[idx];
    output[i] = byte;
    
    
    alphabet.splice(idx, 1);
    alphabet.unshift(byte);
  }
  
  return output;
}

function encodeRLE(data) {
  const output = [];
  let i = 0;
  
  while (i < data.length) {
    let runLength = 1;
    const current = data[i];
    
    while (i + runLength < data.length && 
           data[i + runLength] === current && 
           runLength < 128) {
      runLength++;
    }
    
    if (runLength > 1) {
      output.push(current, runLength | 0x80);
      i += runLength;
    } else {
      let literalLength = 1;
      while (i + literalLength < data.length && 
             literalLength < 128 && 
             (i + literalLength >= data.length - 1 || 
              data[i + literalLength] !== data[i + literalLength + 1])) {
        literalLength++;
      }
      
      output.push(0x80, literalLength);
      for (let j = 0; j < literalLength; j++) {
        output.push(data[i + j]);
      }
      i += literalLength;
    }
  }
  
  return new Uint8Array(output);
}

function decodeRLE(encoded) {
  const output = [];
  let i = 0;
  
  while (i < encoded.length) {
    const byte = encoded[i++];
    
    if (byte === 0x80 && i < encoded.length) {
      const length = encoded[i++];
      for (let j = 0; j < length; j++) {
        if (i < encoded.length) {
          output.push(encoded[i++]);
        }
      }
    } else if (byte & 0x80) {
      const runLength = byte & 0x7F;
      const value = encoded[i++];
      for (let j = 0; j < runLength; j++) {
        output.push(value);
      }
    } else {
      output.push(byte);
    }
  }
  
  return new Uint8Array(output);
}

function inverseBWT(bwtData, originalIndex) {
  const n = bwtData.length;
  const counts = new Array(256).fill(0);
  const starts = new Array(256);
  const links = new Array(n);
  
  
  for (let i = 0; i < n; i++) {
    counts[bwtData[i]]++;
  }
  
  
  let total = 0;
  for (let i = 0; i < 256; i++) {
    starts[i] = total;
    total += counts[i];
  }
  
  
  const nextIndex = [...starts];
  for (let i = 0; i < n; i++) {
    const byte = bwtData[i];
    links[nextIndex[byte]] = i;
    nextIndex[byte]++;
  }
  
  
  const output = new Uint8Array(n);
  let current = originalIndex;
  for (let i = 0; i < n; i++) {
    output[i] = bwtData[current];
    current = links[current];
  }
  
  return output;
}
