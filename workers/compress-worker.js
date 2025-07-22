import { createBWTProcessor } from './bwt-engine.js';
import { createHuffmanEncoder } from './huffman-engine.js';
import { crc32 } from './utils.js';

const bwtProcessor = createBWTProcessor();
const huffmanEncoder = createHuffmanEncoder();

// Detección de tipo de datos mejorada
const isBinaryData = (data) => {
    // Verificar headers de formatos conocidos
    const headers = [
        [0xFF, 0xD8, 0xFF], // JPEG
        [0x89, 0x50, 0x4E, 0x47], // PNG
        [0x25, 0x50, 0x44, 0x46], // PDF
        [0x47, 0x49, 0x46, 0x38], // GIF
        [0x52, 0x49, 0x46, 0x46], // WAV/AVI
        [0x1A, 0x45, 0xDF, 0xA3]  // MKV
    ];
    
    for (const header of headers) {
        if (data.length >= header.length) {
            let match = true;
            for (let i = 0; i < header.length; i++) {
                if (data[i] !== header[i]) {
                    match = false;
                    break;
                }
            }
            if (match) return true;
        }
    }
    
    // Análisis heurístico
    let entropy = 0;
    const freq = new Array(256).fill(0);
    for (const byte of data) freq[byte]++;
    for (const count of freq) {
        if (count > 0) {
            const p = count / data.length;
            entropy -= p * Math.log2(p);
        }
    }
    return entropy > 7.5;
};

self.onmessage = async (e) => {
    const data = new Uint8Array(e.data);
    
    try {
        let compressedData;
        const startTime = performance.now();
        
        if (isBinaryData(data)) {
            // Compresión directa para binarios
            compressedData = huffmanEncoder.encode(data);
        } else {
            // Texto: BWT + MTF + RLE + Huffman
            const transformed = bwtProcessor.process(data);
            compressedData = huffmanEncoder.encode(transformed);
        }
        
        // Añadir cabecera con metadatos
        const header = new Uint8Array(16);
        const view = new DataView(header.buffer);
        view.setUint32(0, 0x48533644); // Magic number 'HS6D'
        view.setUint32(4, data.length);
        view.setFloat64(8, performance.now() - startTime);
        
        // Calcular checksum
        const checksum = crc32(compressedData);
        
        // Construir resultado final
        const finalOutput = new Uint8Array(header.length + compressedData.length + 4);
        finalOutput.set(header);
        finalOutput.set(compressedData, header.length);
        const checksumView = new DataView(finalOutput.buffer, finalOutput.length - 4, 4);
        checksumView.setUint32(0, checksum);
        
        self.postMessage({
            compressed: finalOutput,
            originalSize: data.length,
            compressedSize: finalOutput.length,
            processingTime: performance.now() - startTime
        }, [finalOutput.buffer]);
        
    } catch (error) {
        self.postMessage({ 
            error: `Error en compresión: ${error.message}`,
            stack: error.stack
        });
    }
};
