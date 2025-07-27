const ALPHABET_SIZE = 256;
const MAX_BLOCK_SIZE = 10485760; // 10MB

export function createBWTProcessor() {
    return {
        process: function(data) {
            if (data.length > MAX_BLOCK_SIZE) {
                throw new Error(`El tamaño de datos (${formatSize(data.length)}) excede el límite máximo de BWT (${formatSize(MAX_BLOCK_SIZE)})`);
            }
            return transform6D(data);
        },
        inverse: function(encoded) {
            return inverse6D(encoded);
        }
    };
}

function formatSize(bytes) {
    if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(2) + ' GB';
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(2) + ' MB';
    if (bytes >= 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return bytes + ' bytes';
}

function transform6D(data) {
    const { bwt, originalIndex } = applyBWT(data);
    const mtf = mtfEncode(bwt);
    const rle = encodeRLE(mtf);
    
    const output = new Uint8Array(rle.length + 4);
    const view = new DataView(output.buffer);
    view.setUint32(0, originalIndex, true);
    output.set(rle, 4);
    return output;
}

function inverse6D(encoded) {
    const view = new DataView(encoded.buffer);
    const originalIndex = view.getUint32(0, true);
    const rleData = new Uint8Array(encoded.buffer.slice(4));
    const decodedRLE = decodeRLE(rleData);
    const imtf = mtfDecode(decodedRLE);
    return inverseBWT(imtf, originalIndex);
}

function buildSuffixArray(data) {
    const n = data.length;
    const sa = Array.from({ length: n }, (_, i) => i);
    
    // Optimización para archivos grandes: muestreo parcial
    const sampleSize = Math.min(500000, n);
    const step = Math.max(1, Math.floor(n / sampleSize));
    
    sa.sort((a, b) => {
        for (let i = 0; i < n; i += step) {
            const aIdx = (a + i) % n;
            const bIdx = (b + i) % n;
            const diff = data[aIdx] - data[bIdx];
            if (diff !== 0) return diff;
        }
        return 0;
    });
    
    return sa;
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
    const alphabet = Array.from({ length: ALPHABET_SIZE }, (_, i) => i);
    const output = new Uint16Array(data.length);
    const indexMap = new Uint16Array(ALPHABET_SIZE);
    
    for (let i = 0; i < ALPHABET_SIZE; i++) {
        indexMap[i] = i;
    }
    
    for (let i = 0; i < data.length; i++) {
        const byte = data[i];
        const idx = indexMap[byte];
        output[i] = idx;
        
        // Actualizar posiciones
        for (let j = idx; j > 0; j--) {
            alphabet[j] = alphabet[j - 1];
            indexMap[alphabet[j]] = j;
        }
        alphabet[0] = byte;
        indexMap[byte] = 0;
    }
    
    return output;
}

function mtfDecode(data) {
    const alphabet = Array.from({ length: ALPHABET_SIZE }, (_, i) => i);
    const output = new Uint8Array(data.length);
    
    for (let i = 0; i < data.length; i++) {
        const idx = data[i];
        const byte = alphabet[idx];
        output[i] = byte;
        
        // Actualizar alfabeto
        for (let j = idx; j > 0; j--) {
            alphabet[j] = alphabet[j - 1];
        }
        alphabet[0] = byte;
    }
    
    return output;
}

function encodeRLE(data) {
    const output = [];
    let i = 0;
    const n = data.length;
    
    while (i < n) {
        let runLength = 1;
        while (i + runLength < n && data[i + runLength] === data[i] && runLength < 16383) {
            runLength++;
        }
        
        if (runLength >= 3) {
            output.push(0x80 | (runLength >>> 8), runLength & 0xFF, data[i]);
            i += runLength;
        } else {
            let literalEnd = i + 1;
            while (literalEnd < n && (literalEnd - i < 16383) && 
                   (literalEnd + 1 >= n || data[literalEnd] !== data[literalEnd + 1] || 
                   (literalEnd + 2 < n && data[literalEnd] !== data[literalEnd + 2]))) {
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
                if (i < encoded.length) {
                    output.push(encoded[i++]);
                }
            }
        }
    }
    
    return new Uint8Array(output);
}

function inverseBWT(bwtData, originalIndex) {
    const n = bwtData.length;
    const counts = new Array(ALPHABET_SIZE).fill(0);
    const starts = new Array(ALPHABET_SIZE);
    const links = new Array(n);
    
    // Contar frecuencia de símbolos
    for (let i = 0; i < n; i++) {
        counts[bwtData[i]]++;
    }
    
    // Calcular posiciones iniciales
    let total = 0;
    for (let i = 0; i < ALPHABET_SIZE; i++) {
        starts[i] = total;
        total += counts[i];
    }
    
    // Construir enlaces
    const nextIndex = [...starts];
    for (let i = 0; i < n; i++) {
        const byte = bwtData[i];
        links[nextIndex[byte]] = i;
        nextIndex[byte]++;
    }
    
    // Reconstruir datos originales
    const output = new Uint8Array(n);
    let current = originalIndex;
    for (let i = 0; i < n; i++) {
        output[i] = bwtData[current];
        current = links[current];
    }
    
    return output;
}
