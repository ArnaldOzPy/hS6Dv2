import { inverse6D } from '../bwt-rle.js';
import { decompressHS6D } from '../hyper-huffman.js';

self.onmessage = (e) => {
  try {
    const compressedData = e.data;
    const huffmanDecompressed = decompressHS6D(compressedData);
    const originalData = inverse6D(huffmanDecompressed);

    self.postMessage({
      decompressed: originalData,
      compressedSize: compressedData.length
    }, [originalData.buffer]);
    
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
