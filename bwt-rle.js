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
    while (i + runLength < data.length && 
           data[i + runLength] === data[i] && 
           runLength < 16383) {
      runLength++;
    }

    if (runLength >= 3) {
      
      output.push(0x80 | (runLength >>> 8), runLength & 0xFF, data[i]);
      i += runLength;
    } else {
      
      let literalEnd = i + 1;
      while (literalEnd < data.length && 
             (literalEnd - i < 16383) && 
             (data[literalEnd] !== data[literalEnd + 1] || 
              data[literalEnd] !== data[literalEnd + 2])) {
        literalEnd++;
      }
      const literalLength = literalEnd - i;
      output.push(0x00, literalLength >>> 8, literalLength & 0xFF);
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
    const marker = encoded[i++];
    
    if (marker & 0x80) { 
      const runLength = ((marker & 0x7F) << 8) | encoded[i++];
      const value = encoded[i++];
      for (let j = 0; j < runLength; j++) {
        output.push(value);
      }
    } else { 
      const literalLength = (encoded[i++] << 8) | encoded[i++];
      for (let j = 0; j < literalLength; j++) {
        output.push(encoded[i++]);
      }
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
