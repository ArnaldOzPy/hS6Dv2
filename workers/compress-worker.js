import { compressHS6D } from '../huffman-engine.js';
import { createBWTProcessor } from '../bwt-engine.js';
import { crc32 } from '../utils.js';

const bwtProcessor = createBWTProcessor();
const CHUNK_SIZE = 5242880; // 5MB

function reportProgress(progress, stage) {
  self.postMessage({ type: 'progress', progress, stage });
}

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

self.onmessage = async (e) => {
  const data = new Uint8Array(e.data.data);
  const fileName = e.data.fileName || `compressed_${Date.now()}`;
  const fileExtension = e.data.fileExtension || '';
  const startTime = performance.now();

  try {
    reportProgress(0.05, 'Iniciando análisis');

    // Validar tamaño máximo (2GB)
    if (data.length > 2147483647) {
      throw new Error("El archivo es demasiado grande (máximo 2GB)");
    }

    let processedData = data;
    let useBWT = !isBinaryData(data);
    
    reportProgress(0.3, useBWT ? 'Aplicando BWT' : 'Comprimiendo binario');

    if (useBWT) {
      // Aplicar BWT en chunks para archivos grandes
      if (data.length > 10485760) { // >10MB
        const chunks = [];
        const totalChunks = Math.ceil(data.length / CHUNK_SIZE);
        
        for (let i = 0; i < totalChunks; i++) {
          const start = i * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, data.length);
          const chunk = data.subarray(start, end);
          
          chunks.push(bwtProcessor.process(chunk));
          
          // Reportar progreso
          const progress = 0.3 + (i / totalChunks) * 0.2;
          reportProgress(progress, `Procesando BWT chunk ${i+1}/${totalChunks}`);
        }
        
        // Combinar chunks BWT
        const totalSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        processedData = new Uint8Array(totalSize);
        let offset = 0;
        
        for (const chunk of chunks) {
          processedData.set(chunk, offset);
          offset += chunk.length;
        }
      } else {
        processedData = bwtProcessor.process(data);
      }
    }

    reportProgress(0.5, 'Comprimiendo con Huffman');
    const { compressed } = compressHS6D(processedData);
    
    let finalCompressed = compressed;
    let isUncompressed = false;
    
    // Verificar si la compresión fue efectiva
    if (compressed.length >= data.length * 0.98) {
      reportProgress(0.6, 'Compresión inefectiva, usando datos originales');
      finalCompressed = data;
      isUncompressed = true;
    }

    reportProgress(0.85, 'Empaquetando archivo');

    // CABECERA MEJORADA (16 bytes)
    const header = new Uint8Array(16);
    const view = new DataView(header.buffer);
    
    // Magic number (4 bytes)
    view.setUint32(0, 0x48533644); // 'HS6D'
    
    // Tamaño original (4 bytes)
    view.setUint32(4, data.length);
    
    // Flags (1 byte)
    let flags = 0;
    if (useBWT) flags |= 1 << 0;        // Bit 0: BWT
    if (isUncompressed) flags |= 1 << 2; // Bit 2: Sin compresión
    view.setUint8(8, flags);
    
    // Checksum CRC32
    const checksum = crc32(finalCompressed);

    // Crear archivo final
    const finalOutput = new Uint8Array(header.length + finalCompressed.length + 4);
    finalOutput.set(header);
    finalOutput.set(finalCompressed, header.length);
    
    // Escribir checksum al final
    const checksumView = new DataView(finalOutput.buffer);
    checksumView.setUint32(finalOutput.length - 4, checksum);

    reportProgress(1.0, 'Finalizado');

    self.postMessage({
      compressed: finalOutput,
      fileName,
      fileExtension,
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
