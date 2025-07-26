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
    // Caso especial: datos vacíos
    if (data.length === 0) {
        return {
            compressed: new Uint8Array(0),
            originalSize: 0,
            compressedSize: 0
        };
    }

    // Caso especial: todos los bytes iguales
    const firstByte = data[0];
    let allSame = true;
    for (let i = 1; i < Math.min(data.length, 10000); i++) {
        if (data[i] !== firstByte) {
            allSame = false;
            break;
        }
    }
    
    if (allSame) {
        // Comprobación final para todo el archivo
        for (let i = 10000; i < data.length; i += 10000) {
            if (data[i] !== firstByte) {
                allSame = false;
                break;
            }
        }
        
        if (allSame) {
            const header = new Uint8Array(5);
            const view = new DataView(header.buffer);
            view.setUint32(0, 1); // Flag de caso especial
            view.setUint8(4, firstByte);
            return {
                compressed: header,
                originalSize: data.length,
                compressedSize: header.length
            };
        }
    }

    // Proceso Huffman normal
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
    // Caso especial: datos vacíos
    if (combinedData.length === 0) {
        return new Uint8Array(0);
    }

    // Verificar caso especial de bytes repetidos
    if (combinedData.length >= 5) {
        const view = new DataView(combinedData.buffer);
        if (view.getUint32(0) === 1) {
            const byte = view.getUint8(4);
            return new Uint8Array(1).fill(byte);
        }
    }

    // Proceso Huffman normal
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
        if (!code) {
            // Si no hay código, usar el valor literal como fallback
            for (let j = 0; j < 8; j++) {
                const bit = (byte >> (7 - j)) & 1;
                bitBuffer = (bitBuffer << 1) | bit;
                bitCount++;
                
                if (bitCount === 8) {
                    output.push(bitBuffer);
                    bitBuffer = 0;
                    bitCount = 0;
                }
            }
            continue;
        }
        
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
    // Construir árbol de Huffman
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
            if (!node[bit]) {
                // Fallback: usar valor literal
                const literal = (bitBuffer >> (bitCount - 8)) & 0xFF;
                output.push(literal);
                bitCount -= 8;
                node = root;
                continue;
            }
            
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
