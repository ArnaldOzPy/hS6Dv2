// workers/decompress-worker.js
import { createBWTProcessor } from '../bwt-engine.js';
import { createHuffmanEncoder } from '../huffman-engine.js';
import { crc32 } from '../utils.js';

const bwtProcessor = createBWTProcessor();
const huffmanEncoder = createHuffmanEncoder();

self.onmessage = async (e) => {
    const compressedData = new Uint8Array(e.data);
    
    try {
        const startTime = performance.now();
        
        // 1. Verificar formato y extraer secciones
        if (compressedData.length < 20) {
            throw new Error("Archivo corrupto: tamaño insuficiente");
        }
        
        const headerView = new DataView(compressedData.buffer, 0, 16);
        const magic = headerView.getUint32(0);
        
        // Verificar magic number
        if (magic !== 0x48533644) { // 'HS6D'
            throw new Error("Formato de archivo inválido");
        }
        
        const originalSize = headerView.getUint32(4);
        const processingTime = headerView.getFloat64(8);
        
        // 2. Verificar checksum
        const dataSection = compressedData.slice(16, compressedData.length - 4);
        const checksumSection = compressedData.slice(compressedData.length - 4);
        const checksumView = new DataView(checksumSection.buffer);
        const storedChecksum = checksumView.getUint32(0);
        
        const calculatedChecksum = crc32(dataSection);
        if (storedChecksum !== calculatedChecksum) {
            throw new Error(`Checksum no coincide. Archivo corrupto. 
                Esperado: ${storedChecksum.toString(16)}, 
                Calculado: ${calculatedChecksum.toString(16)}`);
        }
        
        // 3. Descomprimir con Huffman
        const huffmanDecompressed = huffmanEncoder.decode(dataSection);
        
        // 4. Determinar si se aplicó BWT
        let originalData;
        if (wasBWTApplied(huffmanDecompressed)) {
            originalData = bwtProcessor.inverse(huffmanDecompressed);
        } else {
            originalData = huffmanDecompressed;
        }
        
        // 5. Verificar tamaño final
        if (originalData.length !== originalSize) {
            console.warn(`Tamaño descomprimido (${originalData.length}) 
                no coincide con el original (${originalSize})`);
            
            // Ajustar al tamaño original si es posible
            if (originalData.length > originalSize) {
                originalData = originalData.slice(0, originalSize);
            }
        }
        
        self.postMessage({
            decompressed: originalData,
            compressedSize: compressedData.length,
            originalSize: originalData.length,
            processingTime: performance.now() - startTime
        }, [originalData.buffer]);
        
    } catch (error) {
        self.postMessage({ 
            error: `Error en descompresión: ${error.message}`,
            stack: error.stack
        });
    }
};

// Heurística para determinar si se aplicó BWT
function wasBWTApplied(data) {
    // 1. Verificar estructura BWT (primeros 4 bytes son índice)
    if (data.length < 4) return false;
    
    const indexView = new DataView(data.buffer, 0, 4);
    const index = indexView.getUint32(0, true);
    
    // El índice debe ser válido (menor que el tamaño de datos)
    if (index >= data.length - 4) return false;
    
    // 2. Verificar distribución típica de BWT
    let sameCharRuns = 0;
    for (let i = 4; i < Math.min(1000, data.length); i++) {
        if (data[i] === data[i - 1]) sameCharRuns++;
    }
    
    const runRatio = sameCharRuns / Math.min(1000, data.length - 4);
    return runRatio > 0.3; // BWT tiende a crear secuencias repetidas
      }
