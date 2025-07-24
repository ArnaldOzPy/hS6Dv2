export function compressHS6D(data) {
  const frequencyMap = buildFrequencyMap(data);
  const { codes, lengths } = buildCanonicalHuffman(frequencyMap);
  const header = encodeCanonicalHeader(lengths);
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

// ----------------------------
// Helpers
// ----------------------------

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
  if (nodes.length > 0) assignLengths(nodes[0], 0, lengths);

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
  let currentLength = symbols[0]?.length || 0;
  const codes = {};

  for (const { byte, length } of symbols) {
    while (currentLength < length) {
      currentCode <<= 1;
      currentLength++;
    }

    codes[byte] = currentCode.toString(2).padStart(length, '0');
    currentCode++;
  }

  return { codes, lengths };
}

function assignLengths(node, depth, lengths) {
  if (node.byte !== null) {
    lengths[node.byte] = depth;
  } else {
    if (node.left) assignLengths(node.left, depth + 1, lengths);
    if (node.right) assignLengths(node.right, depth + 1, lengths);
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
  let pos = 0;

  for (let i = 0; i < headerData.length; i += 2) {
    if (pos >= 256) break;
    const lengthVal = headerData[i];
    const count = headerData[i + 1];

    for (let j = 0; j < count; j++) {
      if (pos < 256) lengths[pos++] = lengthVal;
    }
  }

  return {
    lengths,
    headerSize: headerData.length
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
  let currentLength = symbols[0]?.length || 0;
  const codes = {};

  for (const { byte, length } of symbols) {
    while (currentLength < length) {
      currentCode <<= 1;
      currentLength++;
    }

    codes[byte] = currentCode.toString(2).padStart(length, '0');
    currentCode++;
  }

  return codes;
}

// ----------------------------
// Core: encode/decode
// ----------------------------

function encodeData(data, codes) {
  let bitBuffer = 0;
  let bitCount = 0;
  const output = [];

  for (const byte of data) {
    const code = codes[byte];
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
  const root = {};
  for (const [byteStr, code] of Object.entries(codes)) {
    const byte = parseInt(byteStr);
    let node = root;
    for (const bit of code) {
      node = node[bit] = node[bit] || {};
    }
    node.byte = byte;
  }

  let bitBuffer = 0;
  let bitCount = 0;
  let node = root;
  const output = [];

  for (const byte of encodedData) {
    bitBuffer = (bitBuffer << 8) | byte;
    bitCount += 8;

    while (bitCount > 0) {
      const bit = (bitBuffer >>> (bitCount - 1)) & 1;
      node = node[bit];
      bitCount--;

      if (!node) {
        throw new Error("Decoding failed: invalid bit sequence");
      }

      if (node.byte !== undefined) {
        output.push(node.byte);
        node = root;
      }
    }
  }

  return new Uint8Array(output);
}
