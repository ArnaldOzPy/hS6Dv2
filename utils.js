export function crc32(buf) {
    // Optimización para buffers grandes
    if (!buf || buf.length === 0) return 0;
    
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) {
            c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
        }
        table[n] = c;
    }
    
    let crc = 0 ^ (-1);
    const chunkSize = 65536;
    const chunks = Math.ceil(buf.length / chunkSize);
    
    for (let chunk = 0; chunk < chunks; chunk++) {
        const start = chunk * chunkSize;
        const end = Math.min(start + chunkSize, buf.length);
        
        for (let i = start; i < end; i++) {
            crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
        }
    }
    
    return (crc ^ (-1)) >>> 0;
}

export function formatSize(bytes) {
    if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`;
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(2)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${bytes} bytes`;
}
