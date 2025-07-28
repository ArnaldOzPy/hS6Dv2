import { decompressHS6D } from '../huffman-engine.js';
import { createBWTProcessor } from '../bwt-engine.js';
import { crc32 } from '../utils.js';

const bwtProcessor = createBWTProcessor();

function reportProgress(progress, stage) {
  self.postMessage({ type: 'progress', progress, stage });
}

self.onmessage = async (e) => {
  const compressedData = new Uint8Array(e.data.data);
  const originalFileName = e.data.fileName || 'decompressed';
  const originalFileExtension = e.data.fileExtension || 'bin';
  const startTime = performance.now();

  try {
    reportProgress(0.05, 'Iniciando descompresión');

    // 1. Validar tamaño mínimo
    if (compressedData.length < 20) {
      throw new Error("Archivo corrupto: tamaño insuficiente");
    }

    const headerView = new DataView(compressedData.buffer, 0, 16);
    
    // Validar magic number
    if (headerView.getUint32(0) !== 0x48533644) {
      throw new Error("Formato de archivo inválido");
    }

    // Leer metadatos
    const originalSize = headerView.getUint32(4);
    const flags = headerView.getUint8(8);
    const usedBWT = (flags & 0x01) === 1;
    const isUncompressed = (flags & 0x04) === 4;
    
    reportProgress(0.15, 'Cabecera validada');

    // 2. Extraer datos y verificar checksum
    const dataSection = compressedData.slice(16, compressedData.length - 4);
    const storedChecksum = new DataView(
      compressedData.buffer, 
      compressedData.length - 4, 
      4
    ).getUint32(0);
    
    if (storedChecksum !== crc32(dataSection)) {
      throw new Error("Checksum no coincide. Archivo corrupto");
    }

    reportProgress(0.25, 'Checksum validado');

    // 3. Manejo especial para archivos vacíos
    if (originalSize === 0) {
      reportProgress(1.0, 'Archivo vacío procesado');
      self.postMessage({ 
        decompressed: new Uint8Array(0),
        fileName: `${originalFileName}.${originalFileExtension}`,
        compressedSize: compressedData.length,
        originalSize: 0,
        processingTime: performance.now() - startTime
      });
      return;
    }

    // 4. Descompresión
    let intermediateData = dataSection;
    
    if (!isUncompressed) {
      reportProgress(0.4, 'Descomprimiendo Huffman');
      intermediateData = decompressHS6D(dataSection);
    }

    // 5. Revertir BWT si es necesario
    let finalData = intermediateData;
    
    if (usedBWT && !isUncompressed) {
      reportProgress(0.7, 'Revirtiendo BWT');
      finalData = bwtProcessor.inverse(intermediateData);
    }

    // 6. Validar tamaño
    let outputData = finalData;
    if (finalData.length !== originalSize) {
      reportProgress(0.85, 'Ajustando tamaño');
      
      if (finalData.length > originalSize) {
        outputData = finalData.slice(0, originalSize);
      } else {
        // Crear buffer con tamaño exacto
        const padded = new Uint8Array(originalSize);
        padded.set(finalData);
        outputData = padded;
      }
    }

    reportProgress(0.95, 'Finalizando descompresión');

    // 7. Crear nombre de archivo con extensión original
    const outputFileName = `${originalFileName}.${originalFileExtension}`;
    
    reportProgress(1.0, 'Descompresión completada');

    // 8. Enviar datos con metadatos
    self.postMessage({ 
      decompressed: outputData,
      fileName: outputFileName,
      compressedSize: compressedData.length,
      originalSize: originalSize,
      processingTime: performance.now() - startTime
    }, [outputData.buffer]);

  } catch (error) {
    self.postMessage({
      error: `Error en descompresión: ${error.message}`,
      details: error.stack
    });
  }
};
