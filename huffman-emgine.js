export function createHuffmanEncoder() {
    return {
        encode: function(data) {
            return compressHS6D(data).compressed;
        },
        decode: function(data) {
            return decompressHS6D(data);
        }
    };
}

function compressHS6D(data) {
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

function decompressHS6D(combinedData) {
    const { lengths, headerSize } = decodeCanonicalHeader(combinedData);
    const codes = buildCodesFromLengths(lengths);
    const compressedData = combinedData.slice(headerSize);
    return decodeData(compressedData, codes, lengths);
}

function buildFrequencyMap(data) {
    const freq = new Array(256).fill(0);
    for (let i = 0; i < data.length; i++) {
        freq[data[i]]++;
    }
    return freq;
}

function buildCanonicalHuffman(freqMap) {
    const nodes = [];
    for (let byte = 0; byte < 256; byte++) {
        if (freqMap[byte] > 0) {
            nodes.push({ byte, freq: freqMap[byte] });
        }
    }
    
    if (nodes.length === 0) {
        return { codes: {}, lengths: new Array(256).fill(0) };
    }
    
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

function encodeData(data, codes) {
    let bitBuffer = 0;
    let bitCount = 0;
    const output = [];
    
    for (let i = 0; i < data.length; i++) {
        const byte = data[i];
        const code = codes[byte];
        if (!code) continue;
        
        for (let j = 0; j < code.length; j++) {
            bitBuffer = (bitBuffer << 1) | (code[j] === '1' ? 1 : 0);
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

function decodeData(encodedData, codes, lengths) {
    const root = {};
    for (const byte in codes) {
        const code = codes[byte];
        let node = root;
        for (let i = 0; i < code.length; i++) {
            const bit = code[i];
            if (!node[bit]) node[bit] = {};
            node = node[bit];
        }
        node.byte = parseInt(byte);
    }
    
    let bitBuffer = 0;
    let bitCount = 0;
    let node = root;
    const output = [];
    
    for (let i = 0; i < encodedData.length; i++) {
        bitBuffer = (bitBuffer << 8) | encodedData[i];
        bitCount += 8;
        
        while (bitCount > 0) {
            const bit = (bitBuffer >> (bitCount - 1)) & 1;
            node = node[bit];
            bitCount--;
            
            if (node.byte !== undefined) {
                output.push(node.byte);
                node = root;
            }
        }
    }
    
    return new Uint8Array(output);
}
