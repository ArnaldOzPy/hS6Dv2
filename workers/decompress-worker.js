import { inverse6D } from '../bwt-rle.js';
import { decompressHS6D } from '../hyper-huffman.js';

self.onmessage = async (e) => {
  try {
    const compressedData = e.data;
    
    // Descomprimir Huffman
    const huffmanDecompressed = decompressHS6D(compressedData);

    // Inversión de BWT/MTF
    const originalData = inverse6D(huffmanDecompressed);

    // Enviar resultado
    self.postMessage({
      decompressed: originalData,
      compressedSize: compressedData.length
    }, [originalData.buffer]);
    
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
