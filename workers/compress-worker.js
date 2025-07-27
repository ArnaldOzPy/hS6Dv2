import { compressHS6D } from '../huffman-engine.js';
import { createBWTProcessor } from '../bwt-engine.js';
import { crc32 } from '../utils.js';

const bwtProcessor = createBWTProcessor();
const CHUNK_SIZE = 5242880; // 5MB

// Función de reporte de progreso
function reportProgress(progress, stage) {
  self.postMessage({ type: 'progress', progress, stage });
}

// Detección de binario (sin cambios)
function isBinaryData(data) { /* ... */ }

self.onmessage = async (e) => {
  const data = new Uint8Array(e.data);
  const startTime = performance.now();

  try {
    reportProgress(0.05, 'Iniciando análisis');

    // 1. Validar tamaño máximo (2GB)
    if (data.length > 2147483647) {
      throw new Error("El archivo es demasiado grande (máximo 2GB)");
    }

    // 2. Determinar tipo de compresión
    const binary = isBinaryData(data);
    const useBWT = !binary;
    
    reportProgress(0.3, binary ? 'Comprimiendo binario' : 'Aplicando BWT');

    // 3. Procesamiento principal
    let processedData = data;
    
    if (useBWT) {
      // Aplicar BWT en chunks para archivos grandes
      if (data.length > 10485760) {
        const chunks = [];
        const totalChunks = Math.ceil(data.length / CHUNK_SIZE);
        
        for (let i = 0; i < totalChunks; i++) {
          const start = i * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, data.length);
          const chunk = data.subarray(start, end);
          
          chunks.push(bwtProcessor.process(chunk));
          reportProgress(0.3 + (i / totalChunks) * 0.2, `BWT chunk ${i+1}/${totalChunks}`);
        }
        
        // Combinar chunks BWT
        processedData = concatenateUint8Arrays(chunks);
      } else {
        processedData = bwtProcessor.process(data);
      }
    }

    // 4. Compresión Huffman
    reportProgress(0.5, 'Comprimiendo con Huffman');
    const { compressed } = compressHS6D(processedData);
    
    // 5. Verificar eficiencia de compresión
    let finalCompressed = compressed;
    let isUncompressed = false;
    
    if (compressed.length >= data.length * 0.98) {
      reportProgress(0.6, 'Compresión inefectiva, usando datos originales');
      finalCompressed = data;
      isUncompressed = true;
    }

    reportProgress(0.85, 'Empaquetando archivo');

    // 6. Crear cabecera (16 bytes)
    const header = new Uint8Array(16);
    const view = new DataView(header.buffer);
    
    // Magic number
    view.setUint32(0, 0x48533644); // 'HS6D'
    
    // Tamaño original
    view.setUint32(4, data.length);
    
    // Flags
    let flags = 0;
    if (useBWT) flags |= 1 << 0;
    if (isUncompressed) flags |= 1 << 2;
    view.setUint8(8, flags);
    
    // Checksum
    const checksum = crc32(finalCompressed);
    
    // 7. Archivo final
    const finalOutput = new Uint8Array(header.length + finalCompressed.length + 4);
    finalOutput.set(header);
    finalOutput.set(finalCompressed, header.length);
    
    // Escribir checksum al final
    const checksumView = new DataView(finalOutput.buffer);
    checksumView.setUint32(finalOutput.length - 4, checksum);

    reportProgress(1.0, 'Finalizado');

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

// Función auxiliar para combinar chunks
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
