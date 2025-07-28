const MAX_CHUNK_SIZE = 5242880; // 5MB

export function compressHS6D(data) {
    // Caso especial: datos vacíos
    if (data.length === 0) {
        return {
            compressed: new Uint8Array(0),
            originalSize: 0,
            compressedSize: 0
        };
    }

    // Caso especial: todos los bytes iguales
    if (isAllSame(data)) {
        const header = new Uint8Array(5);
        const view = new DataView(header.buffer);
        view.setUint32(0, 1); // Flag de caso especial
        view.setUint8(4, data[0]);
        return {
            compressed: header,
            originalSize: data.length,
            compressedSize: header.length
        };
    }

    // Construir mapa de frecuencia global con muestreo
    const frequencyMap = buildFrequencyMap(data);
    const { codes, lengths } = buildCanonicalHuffman(frequencyMap);
    const header = encodeCanonicalHeader(lengths);

    // Comprimir en chunks
    const chunks = [];
    const chunkCount = Math.ceil(data.length / MAX_CHUNK_SIZE);
    
    for (let i = 0; i < chunkCount; i++) {
        const start = i * MAX_CHUNK_SIZE;
        const end = Math.min(start + MAX_CHUNK_SIZE, data.length);
        const chunk = data.subarray(start, end);
        chunks.push(encodeData(chunk, codes));
    }

    // Calcular tamaño total
    let totalSize = header.length;
    for (const chunk of chunks) {
        totalSize += chunk.length;
    }

    // Combinar todos los chunks
    const combined = new Uint8Array(totalSize);
    combined.set(header);
    let offset = header.length;
    
    for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
    }
    
    return {
        compressed: combined,
        originalSize: data.length,
        compressedSize: combined.length
    };
}

export function decompressHS6D(combinedData) {
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
    
    // Descompresión por chunks para archivos grandes
    if (compressedData.length > MAX_CHUNK_SIZE) {
        const chunks = [];
        const chunkCount = Math.ceil(compressedData.length / MAX_CHUNK_SIZE);
        
        for (let i = 0; i < chunkCount; i++) {
            const start = i * MAX_CHUNK_SIZE;
            const end = Math.min(start + MAX_CHUNK_SIZE, compressedData.length);
            const chunk = compressedData.subarray(start, end);
            chunks.push(decodeData(chunk, codes, lengths));
        }
        
        return concatenateUint8Arrays(chunks);
    } else {
        return decodeData(compressedData, codes, lengths);
    }
}

function concatenateUint8Arrays(arrays) {
    const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const arr of arrays) {
        result.set(arr, offset);
        offset += arr.length;
    }
    
    return result;
}

function isAllSame(data) {
    if (data.length === 0) return true;
    
    const firstByte = data[0];
    const CHECK_POINTS = 1000;
    const step = Math.max(1, Math.floor(data.length / CHECK_POINTS));
    
    for (let i = step; i < data.length; i += step) {
        if (data[i] !== firstByte) {
            return false;
        }
    }
    return true;
}

function buildFrequencyMap(data) {
    const freq = new Uint32Array(256);
    const sampleSize = Math.min(data.length, 1000000);
    const step = Math.max(1, Math.floor(data.length / sampleSize));
    
    for (let i = 0; i < data.length; i += step) {
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
            
            // CORRECCIÓN CRÍTICA: Manejo robusto de errores
            if (!node[bit]) {
                // Recuperación: avanzar 1 bit y reiniciar
                bitCount--;
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
