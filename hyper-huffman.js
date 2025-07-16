export function compressHS6D(data) {
  const frequencyMap = buildFrequencyMap(data);
  const huffmanTree = buildHuffmanTree(frequencyMap);
  const codes = buildCodeMap(huffmanTree);
  const encodedData = encodeData(data, codes);

  const freqBuffer = new Uint32Array(frequencyMap);
  const freqBytes = new Uint8Array(freqBuffer.buffer);
  const combined = new Uint8Array(freqBytes.length + encodedData.length);
  combined.set(freqBytes, 0);
  combined.set(encodedData, freqBytes.length);

  return {
    compressed: combined,
    originalSize: data.length,
    compressedSize: combined.length
  };
}

export function decompressHS6D(combinedData) {
  const freqBytes = combinedData.slice(0, 1024);
  const compressedBytes = combinedData.slice(1024);

  const freqBuffer = new Uint32Array(freqBytes.buffer);
  const frequencyMap = Array.from(freqBuffer);

  const huffmanTree = buildHuffmanTree(frequencyMap);
  return decodeData(compressedBytes, huffmanTree);
}

function buildFrequencyMap(data) {
  const freq = new Array(256).fill(0);
  for (const byte of data) {
    freq[byte]++;
  }
  return freq;
}

function buildHuffmanTree(freqMap) {
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

  return nodes[0];
}

function buildCodeMap(node, prefix = '', map = {}) {
  if (node.byte !== null) {
    map[node.byte] = prefix;
  } else {
    buildCodeMap(node.left, prefix + '0', map);
    buildCodeMap(node.right, prefix + '1', map);
  }
  return map;
}

function encodeData(data, codes) {
  let bitBuffer = '';
  const output = [];

  for (const byte of data) {
    bitBuffer += codes[byte];
    while (bitBuffer.length >= 8) {
      output.push(parseInt(bitBuffer.substring(0, 8), 2));
      bitBuffer = bitBuffer.substring(8);
    }
  }

  if (bitBuffer.length > 0) {
    output.push(parseInt(bitBuffer.padEnd(8, '0'), 2));
  }

  return new Uint8Array(output);
}

function decodeData(encodedData, huffmanTree) {
  let bitString = '';
  for (const byte of encodedData) {
    bitString += byte.toString(2).padStart(8, '0');
  }

  const output = [];
  let currentNode = huffmanTree;

  for (const bit of bitString) {
    currentNode = bit === '0' ? currentNode.left : currentNode.right;
    if (currentNode.byte !== null) {
      output.push(currentNode.byte);
      currentNode = huffmanTree;
    }
  }

  return new Uint8Array(output);
}
