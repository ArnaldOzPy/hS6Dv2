import { createBWTProcessor } from '../bwt-engine.js';
import { createHuffmanEncoder } from '../huffman-engine.js';
import { crc32 } from '../utils.js';

const bwtProcessor = createBWTProcessor();
const huffmanEncoder = createHuffmanEncoder();

self.onmessage = async (e) => {
  const compressedData = new Uint8Array(e.data);
  const startTime = performance.now();

  try {
    reportProgress(0.05, 'Iniciando');

    if (compressedData.length < 20) {
      throw new Error("Archivo corrupto: tamaño insuficiente.");
    }

    const headerView = new DataView(compressedData.buffer, 0, 16);
    const magic = headerView.getUint32(0);

    if (magic !== 0x48533644) {
      throw new Error("Formato de archivo inválido (magic number incorrecto).");
    }

    const originalSize = headerView.getUint32(4);
    const _storedProcessingTime = headerView.getFloat64(8); // opcional

    reportProgress(0.15, 'Cabecera validada');

    // Extraer secciones
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

    // Descompresión Huffman
    reportProgress(0.4, 'Descomprimiendo Huffman');
    const huffmanDecompressed = huffmanEncoder.decode(dataSection);

    let originalData;

    if (wasBWTApplied(huffmanDecompressed)) {
      reportProgress(0.7, 'Revirtiendo BWT');
      originalData = bwtProcessor.inverse(huffmanDecompressed);
    } else {
      originalData = huffmanDecompressed;
    }

    // Validar tamaño final
    if (originalData.length !== originalSize) {
      console.warn(`Advertencia: tamaño descomprimido (${originalData.length}) no coincide con el original (${originalSize})`);

      if (originalData.length > originalSize) {
        originalData = originalData.slice(0, originalSize);
      }
    }

    reportProgress(1.0, 'Finalizado');

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

// Reportar progreso al hilo principal
function reportProgress(progress, stage) {
  self.postMessage({ type: 'progress', progress, stage });
}

// Heurística para saber si se aplicó BWT
function wasBWTApplied(data) {
  if (data.length < 8) return false;

  const index = new DataView(data.buffer, 0, 4).getUint32(0, true);
  if (index >= data.length - 4) return false;

  let repeatCount = 0;
  for (let i = 5; i < Math.min(1005, data.length); i++) {
    if (data[i] === data[i - 1]) repeatCount++;
  }

  const ratio = repeatCount / Math.min(1000, data.length - 5);
  return ratio > 0.3;
}
