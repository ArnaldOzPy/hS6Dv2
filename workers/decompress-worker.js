import { createBWTProcessor } from '../bwt-engine.js';
import { createHuffmanEncoder } from '../huffman-engine.js';
import { crc32 } from '../utils.js';

const bwtProcessor = createBWTProcessor();
const huffmanEncoder = createHuffmanEncoder();

function reportProgress(progress, stage) {
  self.postMessage({ type: 'progress', progress, stage });
}

self.onmessage = async (e) => {
  const compressedData = new Uint8Array(e.data);
  const startTime = performance.now();

  try {
    reportProgress(0.05, 'Iniciando descompresión');

    if (compressedData.length < 20) {
      throw new Error("Archivo corrupto: tamaño insuficiente.");
    }

    const headerView = new DataView(compressedData.buffer, 0, 16);
    const magic = headerView.getUint32(0);

    if (magic !== 0x48533644) {
      throw new Error("Formato de archivo inválido (magic number incorrecto).");
    }

    const originalSize = headerView.getUint32(4);
    const flags = headerView.getUint8(8);
    const usedBWT = (flags & 0x01) === 1;
    // Opcional: const processingTime = headerView.getUint32(9);

    reportProgress(0.15, 'Cabecera validada');

    const dataSection = compressedData.slice(16, compressedData.length - 4);
    const checksumView = new DataView(compressedData.buffer, compressedData.length - 4);
    const storedChecksum = checksumView.getUint32(0);
    const calculatedChecksum = crc32(dataSection);

    if (storedChecksum !== calculatedChecksum) {
      throw new Error(
        `Checksum no coincide. Archivo corrupto.\nEsperado: ${storedChecksum.toString(16)}\nCalculado: ${calculatedChecksum.toString(16)}`
      );
    }

    reportProgress(0.25, 'Checksum validado');

    reportProgress(0.4, 'Descomprimiendo Huffman');
    const huffmanDecompressed = huffmanEncoder.decode(dataSection);
    
    let originalData;
    if (usedBWT) {
      reportProgress(0.7, 'Revirtiendo BWT');
      originalData = bwtProcessor.inverse(huffmanDecompressed);
    } else {
      reportProgress(0.7, 'Datos sin transformación BWT');
      originalData = huffmanDecompressed;
    }

    if (originalData.length !== originalSize) {
      console.warn(`Advertencia: tamaño descomprimido (${originalData.length}) no coincide con el original (${originalSize})`);
      if (originalData.length > originalSize) {
        originalData = originalData.slice(0, originalSize);
      }
    }

    reportProgress(1.0, 'Descompresión completada');

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
