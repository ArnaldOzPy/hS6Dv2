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
      throw new Error("Archivo corrupto: tamaño insuficiente (mínimo 20 bytes)");
    }

    // 2. Leer y validar cabecera
    const headerView = new DataView(compressedData.buffer, 0, 16);
    
    // Validar magic number
    const magic = headerView.getUint32(0);
    if (magic !== 0x48533644) {
      throw new Error("Formato de archivo inválido (magic number incorrecto)");
    }

    // Leer metadatos con verificación
    const originalSize = headerView.getUint32(4);
    const flags = headerView.getUint8(8);
    const usedBWT = (flags & 0x01) === 1;
    const isUncompressed = (flags & 0x04) === 4;
    
    // Validar tamaño original razonable (5GB)
    if (originalSize > 1024 * 1024 * 1024 * 5) {
      throw new Error("Tamaño original inválido (máximo 5GB)");
    }

    reportProgress(0.15, 'Cabecera validada');

    // 3. Extraer datos y verificar checksum
    const dataSection = compressedData.slice(16, compressedData.length - 4);
    const storedChecksum = new DataView(
      compressedData.buffer, 
      compressedData.length - 4, 
      4
    ).getUint32(0);
    
    const calculatedChecksum = crc32(dataSection);
    if (storedChecksum !== calculatedChecksum) {
      throw new Error(
        `Checksum no coincide. Archivo corrupto.\n` +
        `Esperado: 0x${storedChecksum.toString(16).padStart(8, '0')}\n` +
        `Calculado: 0x${calculatedChecksum.toString(16).padStart(8, '0')}`
      );
    }

    reportProgress(0.25, 'Checksum validado');

    // 4. Proceso de descompresión principal
    let decompressedData = dataSection;
    
    if (!isUncompressed) {
      try {
        reportProgress(0.4, 'Descomprimiendo Huffman');
        decompressedData = decompressHS6D(dataSection);
      } catch (huffmanError) {
        throw new Error(`Error Huffman: ${huffmanError.message}`);
      }
    }

    // 5. Aplicar BWT inversa si es necesario
    let finalData = decompressedData;
    
    if (usedBWT && !isUncompressed) {
      try {
        reportProgress(0.7, 'Revirtiendo BWT');
        finalData = bwtProcessor.inverse(decompressedData);
      } catch (bwtError) {
        console.warn(`Fallo BWT inverso: ${bwtError.message}`);
        // Fallback: mantener datos sin BWT
        finalData = decompressedData;
      }
    }

    // 6. Ajustar tamaño final
    let outputData = finalData;
    if (finalData.length !== originalSize) {
      reportProgress(0.85, 'Ajustando tamaño');
      
      if (finalData.length > originalSize) {
        outputData = finalData.slice(0, originalSize);
      } else {
        console.warn(`Tamaño insuficiente: ${finalData.length} < ${originalSize}`);
        // Rellenar con 0 como último recurso
        const padded = new Uint8Array(originalSize);
        padded.set(finalData);
        outputData = padded;
      }
    }

    reportProgress(0.95, 'Finalizando descompresión');

    // 7. Crear nombre de archivo con extensión original
    const outputFileName = `${originalFileName}.${originalFileExtension}`;
    
    reportProgress(1.0, 'Descompresión completada');

    // 8. Enviar resultado final
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
      details: {
        message: error.message,
        stack: error.stack,
        inputSize: compressedData.length
      }
    });
  }
};
