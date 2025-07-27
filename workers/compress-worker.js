import { createBWTProcessor } from '../bwt-engine.js';
import { createHuffmanEncoder } from '../huffman-engine.js';
import { crc32 } from '../utils.js';

const bwtProcessor = createBWTProcessor();
const huffmanEncoder = createHuffmanEncoder();

// Reportar progreso (0.0 a 1.0)
function reportProgress(progress, stage) {
  self.postMessage({ type: 'progress', progress, stage });
}

// Detección heurística de binario mejorada
function isBinaryData(data) {
  const headers = [
    [0xFF, 0xD8, 0xFF],        // JPEG
    [0x89, 0x50, 0x4E, 0x47],  // PNG
    [0x25, 0x50, 0x44, 0x46],  // PDF
    [0x47, 0x49, 0x46, 0x38],  // GIF
    [0x52, 0x49, 0x46, 0x46],  // WAV/AVI
    [0x1A, 0x45, 0xDF, 0xA3]   // MKV
  ];

  for (const header of headers) {
    if (data.length >= header.length && header.every((b, i) => data[i] === b)) {
      return true;
    }
  }

  // Calcular entropía
  let entropy = 0;
  const freq = new Array(256).fill(0);
  for (const byte of data) freq[byte]++;
  for (const count of freq) {
    if (count > 0) {
      const p = count / data.length;
      entropy -= p * Math.log2(p);
    }
  }

  // Archivos con entropía > 7.9 son altamente aleatorios (no comprimibles)
  return entropy > 7.5 || data.length > 100000 && entropy > 7.0;
}

self.onmessage = async (e) => {
  const data = new Uint8Array(e.data);
  const startTime = performance.now();

  try {
    let compressedData;
    let useBWT = false;
    let isSpecialCase = false;

    reportProgress(0.05, 'Iniciando análisis');

    const binary = isBinaryData(data);

    if (binary) {
      reportProgress(0.2, 'Procesando binario');
      
      // Verificar si es un caso especial (todos los bytes iguales)
      const firstByte = data[0];
      let allSame = true;
      for (let i = 1; i < data.length; i++) {
        if (data[i] !== firstByte) {
          allSame = false;
          break;
        }
      }
      
      if (allSame) {
        reportProgress(0.3, 'Caso especial: bytes repetidos');
        isSpecialCase = true;
        compressedData = huffmanEncoder.encode(data);
      } else {
        // Para binarios normales, usar compresión directa
        compressedData = huffmanEncoder.encode(data);
      }
    } else {
      reportProgress(0.3, 'Aplicando BWT');
      useBWT = true;
      const bwtData = bwtProcessor.process(data);

      reportProgress(0.5, 'Aplicando Huffman');
      // Simular progreso con pausas
      for (let i = 1; i <= 5; i++) {
        await new Promise(r => setTimeout(r, 40));
        reportProgress(0.5 + i * 0.05, 'Comprimiendo...');
      }

      compressedData = huffmanEncoder.encode(bwtData);
    }

    // Verificar si la compresión fue efectiva
    if (compressedData.length >= data.length * 0.98) {
      reportProgress(0.6, 'Compresión inefectiva, usando datos originales');
      compressedData = data;
      useBWT = false;
      isSpecialCase = false;
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
    // Bit 0: BWT aplicado
    // Bit 1: Caso especial (bytes repetidos)
    // Bit 2: Datos sin comprimir (fallback)
    let flags = 0;
    if (useBWT) flags |= 1 << 0;        // Bit 0: BWT
    if (isSpecialCase) flags |= 1 << 1; // Bit 1: Caso especial
    if (compressedData === data) flags |= 1 << 2; // Bit 2: Sin compresión
    
    view.setUint8(8, flags);
    
    // Tiempo de procesamiento (4 bytes como entero de milisegundos)
    const processingTime = Math.round(performance.now() - startTime);
    view.setUint32(9, processingTime);  // Posición 9-12 (4 bytes)
    // Bytes 13-15 reservados (0 por defecto)

    const checksum = crc32(compressedData);

    // Crear archivo final
    const finalOutput = new Uint8Array(header.length + compressedData.length + 4);
    finalOutput.set(header);
    finalOutput.set(compressedData, header.length);
    
    // Escribir checksum al final
    const checksumView = new DataView(finalOutput.buffer);
    checksumView.setUint32(finalOutput.length - 4, checksum);

    reportProgress(1.0, 'Finalizado');

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
