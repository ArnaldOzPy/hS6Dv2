import { createBWTProcessor } from '../bwt-engine.js';
import { createHuffmanEncoder } from '../huffman-engine.js';
import { crc32 } from '../utils.js';

const bwtProcessor = createBWTProcessor();
const huffmanEncoder = createHuffmanEncoder();
const CHUNK_SIZE = 5242880; // 5MB

// Reportar progreso (0.0 a 1.0)
function reportProgress(progress, stage) {
  self.postMessage({ type: 'progress', progress, stage });
}

// Detección heurística de binario mejorada
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

self.onmessage = async (e) => {
  const data = new Uint8Array(e.data);
  const startTime = performance.now();

  // Declarar bwtData en un ámbito superior e inicializar como null
  let bwtData = null;

  try {
    // Validar tamaño máximo (2GB)
    if (data.length > 2147483647) {
      throw new Error("El archivo es demasiado grande (máximo 2GB)");
    }

    let compressedData;
    let useBWT = false;
    let isSpecialCase = false;
    let isUncompressed = false;

    reportProgress(0.05, 'Iniciando análisis');

    const binary = isBinaryData(data);

    // Segmentación para archivos grandes (>50MB)
    let huffmanChunks = [];

    if (binary) {
      reportProgress(0.2, 'Procesando binario');
      
      // Verificar si es un caso especial (todos los bytes iguales)
      if (isAllSame(data)) {
        reportProgress(0.3, 'Caso especial: bytes repetidos');
        isSpecialCase = true;
        compressedData = huffmanEncoder.encode(data);
      } else {
        reportProgress(0.3, 'Comprimiendo en chunks');
        
        // Compresión por chunks para archivos grandes
        if (data.length > 52428800) { // >50MB
          const totalChunks = Math.ceil(data.length / CHUNK_SIZE);
          
          for (let i = 0; i < totalChunks; i++) {
            try {
              const start = i * CHUNK_SIZE;
              const end = Math.min(start + CHUNK_SIZE, data.length);
              const chunk = data.subarray(start, end);
              
              huffmanChunks.push(huffmanEncoder.encode(chunk));
              
              const progress = 0.3 + (i / totalChunks) * 0.5;
              reportProgress(progress, `Comprimiendo chunk ${i+1}/${totalChunks}`);
            } catch (chunkError) {
              console.error(`Error en chunk ${i}:`, chunkError);
              throw new Error(`Fallo en compresión de chunk ${i+1}/${totalChunks}`);
            }
          }
          
          // Calcular tamaño total
          const totalSize = huffmanChunks.reduce((sum, chunk) => sum + chunk.length, 0);
          compressedData = new Uint8Array(totalSize);
          
          // Combinar chunks
          let offset = 0;
          for (const chunk of huffmanChunks) {
            compressedData.set(chunk, offset);
            offset += chunk.length;
          }
        } else {
          try {
            compressedData = huffmanEncoder.encode(data);
          } catch (error) {
            console.error("Error en compresión Huffman:", error);
            throw new Error("Fallo en compresión Huffman");
          }
        }
      }
    } else {
      reportProgress(0.3, 'Aplicando BWT');
      useBWT = true;
      
      // Añadir manejo de errores en BWT
      try {
        // Aplicar BWT en chunks para archivos grandes
        if (data.length > 10485760) { // >10MB
          const totalChunks = Math.ceil(data.length / CHUNK_SIZE);
          let bwtChunks = [];
          
          for (let i = 0; i < totalChunks; i++) {
            const start = i * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, data.length);
            const chunk = data.subarray(start, end);
            
            bwtChunks.push(bwtProcessor.process(chunk));
            
            // Reportar progreso
            const progress = 0.3 + (i / totalChunks) * 0.2;
            reportProgress(progress, `Procesando BWT chunk ${i+1}/${totalChunks}`);
          }
          
          // Combinar chunks BWT
          const totalSize = bwtChunks.reduce((sum, chunk) => sum + chunk.length, 0);
          bwtData = new Uint8Array(totalSize);
          let offset = 0;
          
          for (const chunk of bwtChunks) {
            bwtData.set(chunk, offset);
            offset += chunk.length;
          }
        } else {
          bwtData = bwtProcessor.process(data);
        }
      } catch (bwtError) {
        console.error("Error en BWT:", bwtError);
        throw new Error("Fallo en transformación BWT");
      }

      reportProgress(0.5, 'Aplicando Huffman');
      
      // Compresión Huffman en chunks
      if (bwtData.length > 52428800) { // >50MB
        const totalChunks = Math.ceil(bwtData.length / CHUNK_SIZE);
        
        for (let i = 0; i < totalChunks; i++) {
          try {
            const start = i * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, bwtData.length);
            const chunk = bwtData.subarray(start, end);
            
            huffmanChunks.push(huffmanEncoder.encode(chunk));
            
            // Reportar progreso
            const progress = 0.5 + (i / totalChunks) * 0.35;
            reportProgress(progress, `Comprimiendo Huffman chunk ${i+1}/${totalChunks}`);
          } catch (chunkError) {
            console.error(`Error en chunk Huffman ${i}:`, chunkError);
            throw new Error(`Fallo en compresión Huffman chunk ${i+1}/${totalChunks}`);
          }
        }
        
        // Calcular tamaño total
        const totalSize = huffmanChunks.reduce((sum, chunk) => sum + chunk.length, 0);
        compressedData = new Uint8Array(totalSize);
        
        // Combinar chunks
        let offset = 0;
        for (const chunk of huffmanChunks) {
          compressedData.set(chunk, offset);
          offset += chunk.length;
        }
      } else {
        try {
          compressedData = huffmanEncoder.encode(bwtData);
        } catch (error) {
          console.error("Error en compresión Huffman:", error);
          throw new Error("Fallo en compresión Huffman");
        }
      }
    }

    // Verificar si la compresión fue efectiva
    if (compressedData.length >= data.length * 0.98) {
      reportProgress(0.6, 'Compresión inefectiva, usando datos originales');
      compressedData = data;
      useBWT = false;
      isSpecialCase = false;
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
    if (isSpecialCase) flags |= 1 << 1; // Bit 1: Caso especial
    if (isUncompressed) flags |= 1 << 2; // Bit 2: Sin compresión
    
    view.setUint8(8, flags);
    
    // Tiempo de procesamiento (4 bytes como entero de milisegundos)
    const processingTime = Math.round(performance.now() - startTime);
    view.setUint32(9, processingTime);
    // Bytes 13-15 reservados (0 por defecto)

    const checksum = crc32(compressedData);

    // Crear archivo final con verificación de tamaño
    const totalSize = header.length + compressedData.length + 4;
    if (totalSize > 2147483647) {
      throw new Error("Tamaño comprimido excede el límite máximo (2GB)");
    }
    
    const finalOutput = new Uint8Array(totalSize);
    finalOutput.set(header);
    finalOutput.set(compressedData, header.length);
    
    // Escribir checksum al final
    const checksumView = new DataView(finalOutput.buffer);
    checksumView.setUint32(finalOutput.length - 4, checksum);

    reportProgress(1.0, 'Finalizado');

    // Liberar memoria
    bwtData = null;
    huffmanChunks = [];

    self.postMessage({
      compressed: finalOutput,
      originalSize: data.length,
      compressedSize: finalOutput.length,
      processingTime,
      compressionRatio: (finalOutput.length / data.length).toFixed(4)
    }, [finalOutput.buffer]);

  } catch (error) {
    self.postMessage({ 
      error: `Error en compresión: ${error.message}`,
      stack: error.stack,
      inputSize: data.length
    });
  }
};
