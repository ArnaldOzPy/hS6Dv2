// Implementación optimizada de CRC32
export function crc32(buf) {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) {
            c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
        }
        table[n] = c;
    }
    
    let crc = 0 ^ (-1);
    for (let i = 0; i < buf.length; i++) {
        crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ (-1)) >>> 0;
}

// Función para calcular entropía
export function calculateEntropy(data) {
    const freq = new Array(256).fill(0);
    for (const byte of data) freq[byte]++;
    
    let entropy = 0;
    for (const count of freq) {
        if (count > 0) {
            const p = count / data.length;
            entropy -= p * Math.log2(p);
        }
    }
    return entropy;
}
