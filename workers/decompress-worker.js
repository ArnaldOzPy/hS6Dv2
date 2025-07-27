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

    // 1. Validación mejorada de tamaño mínimo
    if (compressedData.length < 20) {
      throw new Error("Archivo corrupto: tamaño insuficiente (mínimo 20 bytes)");
    }

    // 2. Leer cabecera con verificación de límites
    const headerView = new DataView(compressedData.buffer, 0, 16);
    
    // Validar magic number primero
    const magic = headerView.getUint32(0);
    if (magic !== 0x48533644) {
      throw new Error("Formato de archivo inválido (magic number incorrecto)");
    }

    // Leer metadatos con verificación
    const originalSize = headerView.getUint32(4);
    const flags = headerView.getUint8(8);
    const usedBWT = (flags & 0x01) === 1;
    const isSpecialCase = (flags & 0x02) === 2;  // Bytes repetidos
    const isUncompressed = (flags & 0x04) === 4;  // Sin compresión
    
    // Validar tamaño original razonable (5GB)
    if (originalSize > 1024 * 1024 * 1024 * 5) {
      throw new Error("Tamaño original inválido (máximo 5GB)");
    }

    reportProgress(0.15, 'Cabecera validada');

    // 3. Extracción segura de secciones
    const headerLength = 16;
    const checksumLength = 4;
    
    if (compressedData.length < headerLength + checksumLength) {
      throw new Error("Archivo corrupto: no hay espacio para datos y checksum");
    }

    const dataSection = compressedData.slice(headerLength, compressedData.length - checksumLength);
    
    // 4. Verificación de checksum con manejo de errores detallado
    const checksumOffset = compressedData.length - checksumLength;
    const storedChecksum = new DataView(compressedData.buffer, checksumOffset, 4).getUint32(0);
    const calculatedChecksum = crc32(dataSection);

    if (storedChecksum !== calculatedChecksum) {
      // Crear mensaje de error más informativo
      const errorDetails = {
        stored: storedChecksum.toString(16).padStart(8, '0'),
        calculated: calculatedChecksum.toString(16).padStart(8, '0'),
        position: checksumOffset,
        dataLength: dataSection.length
      };
      
      throw new Error(
        `Checksum no coincide. Archivo corrupto.\n` +
        `Esperado: 0x${errorDetails.stored}\n` +
        `Calculado: 0x${errorDetails.calculated}\n` +
        `Posición: ${errorDetails.position}\n` +
        `Longitud datos: ${errorDetails.dataLength}`
      );
    }

    reportProgress(0.25, 'Checksum validado');

    // 5. Manejo de datos sin comprimir
    let originalData;
    if (isUncompressed) {
      reportProgress(0.8, 'Datos sin comprimir (modo fallback)');
      originalData = dataSection;
    } else {
      // 6. Descompresión Huffman con manejo de errores
      reportProgress(0.4, 'Descomprimiendo Huffman');
      let huffmanDecompressed;
      
      try {
        huffmanDecompressed = huffmanEncoder.decode(dataSection);
      } catch (error) {
        throw new Error(`Error en decodificación Huffman: ${error.message}`);
      }

      // 7. Manejo de BWT mejorado
      if (usedBWT) {
        reportProgress(0.7, 'Revirtiendo BWT');
        try {
          originalData = bwtProcessor.inverse(huffmanDecompressed);
        } catch (bwtError) {
          if (isSpecialCase) {
            // Manejar casos especiales de bytes repetidos
            originalData = huffmanDecompressed;
          } else {
            throw new Error(`Error en BWT inverso: ${bwtError.message}`);
          }
        }
      } else {
        reportProgress(0.7, 'Datos sin transformación BWT');
        originalData = huffmanDecompressed;
      }
    }

    // 8. Manejar caso especial de bytes repetidos
    if (isSpecialCase && originalData.length === 1 && originalSize > 1) {
      reportProgress(0.9, 'Replicando bytes para caso especial');
      const repeated = new Uint8Array(originalSize);
      repeated.fill(originalData[0]);
      originalData = repeated;
    }

    // 9. Validación de tamaño mejorada
    if (!originalData || originalData.length === 0) {
      throw new Error("Datos descomprimidos están vacíos");
    }

    if (originalData.length !== originalSize) {
      const sizeInfo = `Original: ${originalSize} bytes | Descomprimido: ${originalData.length} bytes`;
      
      // Manejar casos especiales de bytes repetidos
      if (isSpecialCase && originalData.length === 1 && originalSize > 1) {
        originalData = new Uint8Array(originalSize).fill(originalData[0]);
      }
      // Recortar solo si es mayor
      else if (originalData.length > originalSize) {
        console.warn(`Recortando datos (${sizeInfo})`);
        originalData = originalData.slice(0, originalSize);
      } else {
        throw new Error(`Tamaño insuficiente tras descompresión (${sizeInfo})`);
      }
    }

    reportProgress(1.0, 'Descompresión completada');

    // 10. Enviar resultados con información adicional
    self.postMessage({
      decompressed: originalData,
      compressedSize: compressedData.length,
      originalSize: originalData.length,
      processingTime: performance.now() - startTime,
      compressionRatio: (compressedData.length / originalData.length).toFixed(2)
    }, [originalData.buffer]);

  } catch (error) {
    // Error detallado con información de depuración
    const errorInfo = {
      message: error.message,
      stack: error.stack,
      inputSize: compressedData.length
    };
    
    self.postMessage({
      error: `Error en descompresión: ${errorInfo.message}`,
      details: errorInfo
    });
  }
};
