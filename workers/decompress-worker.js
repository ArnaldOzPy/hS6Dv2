// decompress-worker.js
import { CompressionPipeline } from '../engines/compression-core.js';
import { createBWTProcessor } from '../engines/bwt-engine.js';
import { createHuffmanEncoder } from '../engines/huffman-engine.js';
import { createLZ77Processor } from '../engines/lz77-engine.js';
import { createZstdEncoder } from '../engines/zstd-engine.js';
import { processInChunks } from '../utils/chunk-processor.js';
import { crc32 } from '../utils.js';

// Inicializar pipeline modular
const pipeline = new CompressionPipeline();
pipeline.registerTransformer('bwt', createBWTProcessor());
pipeline.registerTransformer('lz77', createLZ77Processor());
pipeline.registerEntropyEncoder('huffman', createHuffmanEncoder());
pipeline.registerEntropyEncoder('zstd', createZstdEncoder());

self.onmessage = async (e) => {
  const compressedData = new Uint8Array(e.data);
  const startTime = performance.now();

  try {
    // Leer configuración de la cabecera
    const headerView = new DataView(compressedData.buffer, 0, 16);
    const config = {
      transformers: [],
      entropyEncoder: headerView.getUint8(12) === 1 ? 'zstd' : 'huffman'
    };

    // Determinar transformadores usados
    const flags = headerView.getUint8(8);
    if (flags & 0x01) config.transformers.push('bwt');
    if (flags & 0x02) config.transformers.push('lz77');

    // ... (resto del código para extraer datos)

    // Descomprimir en chunks si es necesario
    const decompressedData = compressedData.length > 10 * 1024 * 1024
      ? await processInChunks(dataSection, chunk => 
          pipeline.inverse(chunk, config), 
          2 * 1024 * 1024
        )
      : await pipeline.inverse(dataSection, config);

    // ... (resto del código)
    
  


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

    // Verificar tamaño mínimo (16 bytes cabecera + 4 bytes checksum)
    if (compressedData.length < 20) {
      throw new Error("Archivo corrupto: tamaño insuficiente (mínimo 20 bytes)");
    }

    // Crear DataView para cabecera (primeros 16 bytes)
    const headerView = new DataView(compressedData.buffer, 0, 16);
    
    // Validar magic number
    const magic = headerView.getUint32(0);
    if (magic !== 0x48533644) { // 'HS6D'
      throw new Error("Formato de archivo inválido: magic number incorrecto");
    }

    // Leer metadatos
    const originalSize = headerView.getUint32(4);
    const flags = headerView.getUint8(8);
    const usedBWT = (flags & 0x01) === 1;
    
    // Validar tamaños coherentes
    if (originalSize > 1024 * 1024 * 1024) { // >1GB?
      throw new Error("Tamaño original inválido (demasiado grande)");
    }

    reportProgress(0.15, 'Cabecera validada');

    // Extraer sección de datos (excluyendo cabecera y checksum)
    const dataSection = compressedData.slice(16, compressedData.length - 4);
    
    // Verificar checksum (últimos 4 bytes)
    const checksumOffset = compressedData.length - 4;
    if (checksumOffset + 4 > compressedData.buffer.byteLength) {
      throw new Error("Posición de checksum inválida");
    }
    
    const checksumView = new DataView(compressedData.buffer, checksumOffset, 4);
    const storedChecksum = checksumView.getUint32(0);
    const calculatedChecksum = crc32(dataSection);

    if (storedChecksum !== calculatedChecksum) {
      throw new Error(
        `Checksum no coincide: almacenado=${storedChecksum.toString(16)}, calculado=${calculatedChecksum.toString(16)}`
      );
    }

    reportProgress(0.25, 'Checksum validado');

    // Descompresión Huffman
    reportProgress(0.4, 'Descomprimiendo Huffman');
    const huffmanDecompressed = huffmanEncoder.decode(dataSection);
    
    // Aplicar BWT inversa si fue usada
    let originalData;
    if (usedBWT) {
      reportProgress(0.7, 'Revirtiendo BWT');
      originalData = bwtProcessor.inverse(huffmanDecompressed);
    } else {
      reportProgress(0.7, 'Datos sin transformación BWT');
      originalData = huffmanDecompressed;
    }

    // Ajustar tamaño si es necesario
    if (originalData.length !== originalSize) {
      if (originalData.length > originalSize) {
        originalData = originalData.slice(0, originalSize);
      } else {
        throw new Error(`Tamaño insuficiente tras descompresión: esperado=${originalSize}, obtenido=${originalData.length}`);
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
