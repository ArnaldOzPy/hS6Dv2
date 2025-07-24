import { createBWTProcessor } from '../bwt-engine.js';
import { createHuffmanEncoder } from '../huffman-engine.js';
import { crc32 } from '../utils.js';

const bwtProcessor = createBWTProcessor();
const huffmanEncoder = createHuffmanEncoder();

// Reportar progreso (0.0 a 1.0)
function reportProgress(progress, stage) {
  self.postMessage({ type: 'progress', progress, stage });
}

// Detección heurística de binario
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
}

self.onmessage = async (e) => {
  const data = new Uint8Array(e.data);
  const startTime = performance.now();

  try {
    let compressedData;

    reportProgress(0.05, 'Iniciando análisis');

    const binary = isBinaryData(data);

    if (binary) {
      reportProgress(0.2, 'Compresión directa (binaria)');
      compressedData = huffmanEncoder.encode(data);
    } else {
      reportProgress(0.3, 'Aplicando BWT');
      const bwtData = bwtProcessor.process(data);

      reportProgress(0.5, 'Aplicando Huffman');
      // Simular progreso con pausas
      for (let i = 1; i <= 5; i++) {
        await new Promise(r => setTimeout(r, 40));
        reportProgress(0.5 + i * 0.05, 'Comprimiendo...');
      }

      compressedData = huffmanEncoder.encode(bwtData);
    }

    reportProgress(0.85, 'Empaquetando archivo');

    // CABECERA CORREGIDA (16 bytes)
    const header = new Uint8Array(16);
    const view = new DataView(header.buffer);
    
    // Magic number (4 bytes)
    view.setUint32(0, 0x48533644); // 'HS6D'
    
    // Tamaño original (4 bytes)
    view.setUint32(4, data.length);
    
    // Flags (1 byte) - Bit 0: BWT aplicado
    view.setUint8(8, binary ? 0 : 1);
    
    // Tiempo de procesamiento (7 bytes - float64 truncado)
    const processingTime = performance.now() - startTime;
    view.setFloat64(9, processingTime);  // Posición 9-16

    const checksum = crc32(compressedData);

    // Crear archivo final
    const finalOutput = new Uint8Array(header.length + compressedData.length + 4);
    finalOutput.set(header);
    finalOutput.set(compressedData, header.length);
    new DataView(finalOutput.buffer).setUint32(finalOutput.length - 4, checksum);

    reportProgress(1.0, 'Finalizado');

    self.postMessage({
      compressed: finalOutput,
      originalSize: data.length,
      compressedSize: finalOutput.length,
      processingTime
    }, [finalOutput.buffer]);

  } catch (error) {
    self.postMessage({ 
      error: `Error en compresión: ${error.message}`,
      stack: error.stack
    });
  }
};
