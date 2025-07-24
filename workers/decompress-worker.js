import { createBWTProcessor } from '../bwt-engine.js';
import { createHuffmanEncoder } from '../huffman-engine.js';
import { crc32 } from '../utils.js';

const bwtProcessor = createBWTProcessor();
const huffmanEncoder = createHuffmanEncoder();

// Reportar progreso al hilo principal
function reportProgress(progress, stage) {
  self.postMessage({ type: 'progress', progress, stage });
}

self.onmessage = async (e) => {
  const compressedData = new Uint8Array(e.data);
  const startTime = performance.now();

  try {
    reportProgress(0.05, 'Iniciando descompresión');

    // Verificación mínima de tamaño
    if (compressedData.length < 20) {
      throw new Error("Archivo corrupto: tamaño insuficiente.");
    }

    // Leer cabecera (16 bytes)
    const headerView = new DataView(compressedData.buffer, 0, 16);
    const magic = headerView.getUint32(0);

    // Validar magic number
    if (magic !== 0x48533644) {
      throw new Error("Formato de archivo inválido (magic number incorrecto).");
    }

    const originalSize = headerView.getUint32(4);
    const flags = headerView.getUint8(8);  // Byte de flags
    const usedBWT = (flags & 0x01) === 1; // Bit 0: BWT aplicado (1) o no (0)

    reportProgress(0.15, 'Cabecera validada');

    // Extraer secciones de datos
    const dataSection = compressedData.slice(16, compressedData.length - 4);
    
    // Verificar checksum
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
    
    // Procesar BWT según flag
    let originalData;
    if (usedBWT) {
      reportProgress(0.7, 'Revirtiendo BWT');
      originalData = bwtProcessor.inverse(huffmanDecompressed);
    } else {
      reportProgress(0.7, 'Datos sin transformación BWT');
      originalData = huffmanDecompressed;
    }

    // Validar tamaño final
    if (originalData.length !== originalSize) {
      console.warn(`Advertencia: tamaño descomprimido (${originalData.length}) no coincide con el original (${originalSize})`);
      
      // Ajustar tamaño si es necesario
      if (originalData.length > originalSize) {
        originalData = originalData.slice(0, originalSize);
      }
    }

    reportProgress(1.0, 'Descompresión completada');

    // Enviar resultados
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
