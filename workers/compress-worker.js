import { transform6D } from '../bwt-rle.js';
import { compressHS6D } from '../hyper-huffman.js';


const isBinaryData = (data) => {
  let entropy = 0;
  const freq = new Array(256).fill(0);
  for (const byte of data) freq[byte]++;
  for (const count of freq) {
    if (count > 0) {
      const p = count / data.length;
      entropy -= p * Math.log2(p);
    }
  }
  return entropy > 7.9; 
};

self.onmessage = (e) => {
  const data = e.data;

  try {
    let compressedData;
    
    if (isBinaryData(data)) {
      
      compressedData = compressHS6D(data).compressed;
    } else {
      const bwtCompressed = transform6D(data);
      compressedData = compressHS6D(bwtCompressed).compressed;
    }

    self.postMessage({
      compressed: compressedData,
      originalSize: data.length,
      compressedSize: compressedData.length
    }, [compressedData.buffer]);
    
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
