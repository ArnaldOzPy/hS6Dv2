export function compressHS6D(data) {
  const frequencyMap = buildFrequencyMap(data);
  const { codes, canonicalLengths } = buildCanonicalHuffman(frequencyMap);
  const header = encodeCanonicalHeader(canonicalLengths);
  const encodedData = encodeData(data, codes);
  
  const combined = new Uint8Array(header.length + encodedData.length);
  combined.set(header);
  combined.set(encodedData, header.length);
  
  return {
    compressed: combined,
    originalSize: data.length,
    compressedSize: combined.length
  };
}

export function decompressHS6D(combinedData) {
  const { lengths, headerSize } = decodeCanonicalHeader(combinedData);
  const codes = buildCodesFromLengths(lengths);
  const compressedData = combinedData.slice(headerSize);
  return decodeData(compressedData, codes);
}

function buildFrequencyMap(data) {
  const freq = new Array(256).fill(0);
  for (const byte of data) {
    freq[byte]++;
  }
  return freq;
}

function buildCanonicalHuffman(freqMap) {
  
  const nodes = freqMap
    .map((freq, byte) => ({ byte, freq }))
    .filter(node => node.freq > 0);
  
  while (nodes.length > 1) {
    nodes.sort((a, b) => a.freq - b.freq);
    const left = nodes.shift();
    const right = nodes.shift();
    nodes.push({
      left,
      right,
      freq: left.freq + right.freq,
      byte: null
    });
  }
  
  
  const lengths = new Array(256).fill(0);
  assignLengths(nodes[0], 0, lengths);
  
  
  const symbols = [];
  for (let byte = 0; byte < 256; byte++) {
    if (lengths[byte] > 0) {
      symbols.push({ byte, length: lengths[byte] });
    }
  }
  
  symbols.sort((a, b) => {
    if (a.length !== b.length) return a.length - b.length;
    return a.byte - b.byte;
  });
  
  
  let currentCode = 0;
  const codes = {};
  for (const { byte, length } of symbols) {
    codes[byte] = currentCode.toString(2).padStart(length, '0');
    currentCode = (currentCode + 1) << (symbols[0].length - length);
  }
  
  return { codes, canonicalLengths: lengths };
}

function assignLengths(node, depth, lengths) {
  if (node.byte !== null) {
    lengths[node.byte] = depth;
  } else {
    assignLengths(node.left, depth + 1, lengths);
    assignLengths(node.right, depth + 1, lengths);
  }
}

function encodeCanonicalHeader(lengths) {
  
  const header = [];
  let current = lengths[0];
  let count = 1;
  
  for (let i = 1; i < 256; i++) {
    if (lengths[i] === current && count < 255) {
      count++;
    } else {
      header.push(current, count);
      current = lengths[i];
      count = 1;
    }
  }
  header.push(current, count);
  
  return new Uint8Array(header);
}

function decodeCanonicalHeader(headerData) {
  const lengths = new Array(256).fill(0);
  let index = 0;
  let pos = 0;
  
  for (let i = 0; i < headerData.length; i += 2) {
    if (pos >= 256) break;
    
    const lengthVal = headerData[i];
    const count = headerData[i + 1];
    
    for (let j = 0; j < count && pos < 256; j++) {
      lengths[pos++] = lengthVal;
    }
  }
  
  return { 
    lengths, 
    headerSize: Math.min(headerData.length, 512) 
  };
}

function buildCodesFromLengths(lengths) {
  const symbols = [];
  for (let byte = 0; byte < 256; byte++) {
    if (lengths[byte] > 0) {
      symbols.push({ byte, length: lengths[byte] });
    }
  }
  
  symbols.sort((a, b) => {
    if (a.length !== b.length) return a.length - b.length;
    return a.byte - b.byte;
  });
  
  let currentCode = 0;
  const codes = {};
  for (const { byte, length } of symbols) {
    codes[byte] = currentCode.toString(2).padStart(length, '0');
    currentCode = (currentCode + 1) << (symbols[0].length - length);
  }
  
  return codes;
}

function encodeData(data, codes) {
  let bitBuffer = 0;
  let bitCount = 0;
  const output = [];
  
  for (const byte of data) {
    const code = codes[byte];
    if (!code) continue;
    
    for (const bit of code) {
      bitBuffer = (bitBuffer << 1) | (bit === '1' ? 1 : 0);
      bitCount++;
      
      if (bitCount === 8) {
        output.push(bitBuffer);
        bitBuffer = 0;
        bitCount = 0;
      }
    }
  }
  
  
  if (bitCount > 0) {
    bitBuffer <<= (8 - bitCount);
    output.push(bitBuffer);
  }
  
  return new Uint8Array(output);
}

function decodeData(encodedData, codes) {

  const codeMap = {};
  for (const [byte, code] of Object.entries(codes)) {
    codeMap[code] = parseInt(byte);
  }
  
  let bitString = '';
  const output = [];
  
  for (const byte of encodedData) {
    const bits = byte.toString(2).padStart(8, '0');
    for (const bit of bits) {
      bitString += bit;
      if (codeMap[bitString] !== undefined) {
        output.push(codeMap[bitString]);
        bitString = '';
      }
    }
  }
  
  return new Uint8Array(output);
}
