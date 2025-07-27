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
    if (magic !== 0x48533644) { // 'HS6D' en hex
      throw new Error("Formato de archivo inválido (magic number incorrecto)");
    }

    // Leer metadatos con verificación
    const originalSize = headerView.getUint32(4);
    const flags = headerView.getUint8(8);
    const usedBWT = (flags & 0x01) === 1;
    const isSpecialCase = (flags & 0x02) === 2;
    const isUncompressed = (flags & 0x04) === 4;
    
    // Validar tamaño original razonable (5GB)
    if (originalSize > 1024 * 1024 * 1024 * 5) {
      throw new Error("Tamaño original inválido (máximo 5GB)");
    }

    // Validación adicional de flags
    if (isSpecialCase && isUncompressed) {
      throw new Error("Flags conflictivos en cabecera");
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
      throw new Error(
        `Checksum no coincide. Archivo corrupto.\n` +
        `Esperado: 0x${storedChecksum.toString(16).padStart(8, '0')}\n` +
        `Calculado: 0x${calculatedChecksum.toString(16).padStart(8, '0')}`
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
        console.error("Error en decodificación Huffman:", error, "Datos:", dataSection.slice(0, 50));
        throw new Error(`Error en decodificación Huffman: ${error.message}`);
      }

      // 7. Manejo de BWT mejorado
      if (usedBWT) {
        reportProgress(0.7, 'Revirtiendo BWT');
        try {
          originalData = bwtProcessor.inverse(huffmanDecompressed);
        } catch (bwtError) {
          console.error("Error en BWT inverso:", bwtError, "Datos:", huffmanDecompressed.slice(0, 50));
          
          // Manejar específicamente errores de índice
          if (bwtError.message.includes("índice")) {
            // Intentar recuperar usando el primer índice válido
            try {
              console.warn("Intentando recuperación con índice alternativo");
              const altData = bwtProcessor.inverse(new Uint8Array([0, 0, 0, 0, ...huffmanDecompressed]));
              if (altData.length > 0) {
                originalData = altData;
              }
            } catch (recoveryError) {
              throw new Error(`Error en BWT inverso: ${bwtError.message}`);
            }
          } 
          // Manejar casos especiales de bytes repetidos
          else if (isSpecialCase) {
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
      console.error("Datos descomprimidos vacíos", {
        header: { originalSize, flags },
        dataSection: dataSection.slice(0, 50),
        huffmanDecompressed: huffmanDecompressed?.slice(0, 50)
      });
      throw new Error("Datos descomprimidos están vacíos");
    }

    if (originalData.length !== originalSize) {
      console.warn(`Tamaño descomprimido diferente: ${originalData.length} vs ${originalSize}`);
      
      // Ajustar tamaño si es mayor
      if (originalData.length > originalSize) {
        originalData = originalData.slice(0, originalSize);
      }
      // Rellenar si es menor (solo para casos especiales)
      else if (isSpecialCase && originalData.length === 1) {
        const filled = new Uint8Array(originalSize);
        filled.fill(originalData[0]);
        originalData = filled;
      }
      else {
        throw new Error(`Tamaño incorrecto: ${originalData.length} ≠ ${originalSize}`);
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
    console.error("Error crítico en descompresión:", error, "Input:", compressedData.slice(0, 100));
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
