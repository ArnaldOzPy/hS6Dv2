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
function isBinaryData(data) { 
  // Detección mejorada para archivos pequeños
  if (data.length < 16) return false;

  const headers = [
    [0xFF, 0xD8, 0xFF],        // JPEG
    [0x89, 0x50, 0x4E, 0x47],  // PNG
    [0x25, 0x50, 0x44, 0x46],  // PDF
    [0x47, 0x49, 0x46, 0x38],  // GIF
    [0x52, 0x49, 0x46, 0x46],  // WAV/AVI
    [0x1A, 0x45, 0xDF, 0xA3],  // MKV
    [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70], // MP4 con tamaño
    [0x66, 0x74, 0x79, 0x70], // MP4 sin tamaño
    [0x49, 0x44, 0x33]         // MP3 ID3
  ];

  // Verificar cabeceras conocidas
  for (const header of headers) {
    if (data.length >= header.length && header.every((b, i) => data[i] === b)) {
      return true;
    }
  }

  // Cálculo de entropía optimizado para todos los tamaños
  const freq = new Array(256).fill(0);
  const sampleSize = Math.min(data.length, 1000000);
  const step = Math.max(1, Math.floor(data.length / sampleSize));
  let totalSamples = 0;
  
  for (let i = 0; i < data.length; i += step) {
    freq[data[i]]++;
    totalSamples++;
  }

  let entropy = 0;
  let nonZero = 0;
  
  for (const count of freq) {
    if (count > 0) {
      nonZero++;
      const p = count / totalSamples;
      entropy -= p * Math.log2(p);
    }
  }

  // Archivos con alta entropía o muchos valores únicos
  return entropy > 7.3 || nonZero > 240;
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
    
    reportProgress(0.3, useBWT ? 'Aplicando BWT' : 'Comprimiendo binario');

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
