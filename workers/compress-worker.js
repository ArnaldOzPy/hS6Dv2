import { transform6D } from '../bwt-rle.js';
import { compressHS6D } from '../hyper-huffman.js';

self.onmessage = (e) => {
  const data = e.data;

  try {
    const bwtCompressed = transform6D(data);
    const huffmanCompressed = compressHS6D(bwtCompressed);

    self.postMessage({
      compressed: huffmanCompressed.compressed,
      originalSize: data.length,
      compressedSize: huffmanCompressed.compressed.length
    }, [huffmanCompressed.compressed.buffer]);
    
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
