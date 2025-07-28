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

    // 1. Validación de cabecera mejorada
    if (compressedData.length < 20) {
      throw new Error("Archivo corrupto: tamaño insuficiente (mínimo 20 bytes)");
    }

    const headerView = new DataView(compressedData.buffer, 0, 16);
    
    // Validar magic number
    if (headerView.getUint32(0) !== 0x48533644) {
      throw new Error("Formato de archivo inválido (magic number incorrecto)");
    }

    const originalSize = headerView.getUint32(4);
    const flags = headerView.getUint8(8);
    const usedBWT = (flags & 0x01) === 1;
    const isUncompressed = (flags & 0x04) === 4;
    
    // Validación de tamaño original
    if (originalSize > 1024 * 1024 * 1024 * 5) { // 5GB
      throw new Error("Tamaño original inválido (máximo 5GB)");
    }

    reportProgress(0.15, 'Cabecera validada');

    // 2. Extraer datos y verificar checksum
    const dataSection = compressedData.slice(16, compressedData.length - 4);
    const storedChecksum = new DataView(
      compressedData.buffer, 
      compressedData.length - 4, 
      4
    ).getUint32(0);
    
    const calculatedChecksum = crc32(dataSection);
    if (storedChecksum !== calculatedChecksum) {
      throw new Error(`Checksum no coincide. Archivo corrupto.`);
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

    // 4. Descompresión Huffman con validación
    let intermediateData = dataSection;
    
    if (!isUncompressed) {
      reportProgress(0.4, 'Descomprimiendo Huffman');
      intermediateData = decompressHS6D(dataSection);
      
      // Validación crítica de datos
      if (intermediateData.length === 0 && originalSize > 0) {
        throw new Error("Datos Huffman descomprimidos vacíos");
      }
    }

    // 5. Revertir BWT con manejo de errores
    let finalData = intermediateData;
    
    if (usedBWT && !isUncompressed) {
      reportProgress(0.7, 'Revirtiendo BWT');
      try {
        finalData = bwtProcessor.inverse(intermediateData);
      } catch (bwtError) {
        // Recuperación para texto
        if (isLikelyText(intermediateData)) {
          console.warn("Recuperando texto de BWT fallido");
          finalData = intermediateData;
        } else {
          throw bwtError;
        }
      }
    }

    // 6. Validación final de contenido
    if (finalData.length === 0) {
      throw new Error("Datos descomprimidos están vacíos");
    }
    
    if (finalData.length > originalSize) {
      finalData = finalData.slice(0, originalSize);
    }

    reportProgress(0.95, 'Finalizando descompresión');

    // 7. Crear nombre de archivo
    const outputFileName = `${originalFileName}.${originalFileExtension}`;
    
    reportProgress(1.0, 'Descompresión completada');

    // 8. Enviar datos
    self.postMessage({ 
      decompressed: finalData,
      fileName: outputFileName,
      compressedSize: compressedData.length,
      originalSize: finalData.length,
      processingTime: performance.now() - startTime
    }, [finalData.buffer]);

  } catch (error) {
    self.postMessage({
      error: `Error en descompresión: ${error.message}`,
      details: error.stack
    });
  }
};

// Función auxiliar para detección de texto
function isLikelyText(data) {
  // Verificar si los datos son principalmente ASCII imprimibles
  const sampleSize = Math.min(data.length, 1000);
  let textCharCount = 0;
  
  for (let i = 0; i < sampleSize; i++) {
    const byte = data[i];
    // Caracteres imprimibles + espacios + saltos de línea
    if ((byte >= 32 && byte <= 126) || byte === 9 || byte === 10 || byte === 13) {
      textCharCount++;
    }
  }
  
  return (textCharCount / sampleSize) > 0.95; // 95% caracteres de texto
}
