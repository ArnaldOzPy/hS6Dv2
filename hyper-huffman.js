
export function buildFrequencyMap(data) {
  const freq = {};
  for (let char of data) {
    freq[char] = (freq[char] || 0) + 1;
  }
  return freq;
}

export function buildHuffmanTree(freqMap) {
  const nodes = Object.entries(freqMap).map(([char, freq]) => ({ char, freq }));
  while (nodes.length > 1) {
    nodes.sort((a, b) => a.freq - b.freq);
    const left = nodes.shift();
    const right = nodes.shift();
    nodes.push({ left, right, freq: left.freq + right.freq });
  }
  return nodes[0];
}

function buildCodes(node, prefix = "", map = {}) {
  if (node.char) {
    map[node.char] = prefix;
  } else {
    buildCodes(node.left, prefix + "0", map);
    buildCodes(node.right, prefix + "1", map);
  }
  return map;
}

export function compressHuffman(text) {
  const freqMap = buildFrequencyMap(text);
  const tree = buildHuffmanTree(freqMap);
  const codes = buildCodes(tree);

  let binaryStr = "";
  for (let char of text) {
    binaryStr += codes[char];
  }

  const padLength = (8 - binaryStr.length % 8) % 8;
  binaryStr = binaryStr.padEnd(binaryStr.length + padLength, "0");

  const byteArr = new Uint8Array((binaryStr.length + 7) >> 3);
  for (let i = 0; i < byteArr.length; i++) {
    byteArr[i] = parseInt(binaryStr.slice(i * 8, i * 8 + 8), 2);
  }

  return {
    compressed: byteArr,
    tree: JSON.stringify(freqMap),
    padLength
  };
}

export function decompressHuffman(byteArr, freqMapStr, padLength) {
  const freqMap = JSON.parse(freqMapStr);
  const tree = buildHuffmanTree(freqMap);

  let binaryStr = "";
  for (let byte of byteArr) {
    binaryStr += byte.toString(2).padStart(8, "0");
  }
  binaryStr = binaryStr.slice(0, binaryStr.length - padLength);

  let output = "";
  let node = tree;
  for (let bit of binaryStr) {
    node = bit === "0" ? node.left : node.right;
    if (node.char) {
      output += node.char;
      node = tree;
    }
  }

  return output;
}
