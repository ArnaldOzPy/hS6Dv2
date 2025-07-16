import { transform6D, inverse6D } from '../bwt-rle.js';
import { compressHS6D, decompressHS6D } from '../hyper-huffman.js';

function generateTestData(size) {
  const data = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    data[i] = Math.floor(Math.random() * 256);
  }
  return data;
}

async function runStressTest() {
  const sizes = [1e5, 1e6, 5e6]; 
  const results = [];

  for (const size of sizes) {
    const data = generateTestData(size);
    
    const startCompress = performance.now();
    const bwtCompressed = transform6D(data);
    const huffmanCompressed = compressHS6D(bwtCompressed);
    const compressTime = performance.now() - startCompress;
    
    const startDecompress = performance.now();
    const huffmanDecompressed = decompressHS6D(huffmanCompressed.compressed, huffmanCompressed.tree);
    const bwtDecompressed = inverse6D(huffmanDecompressed);
    const decompressTime = performance.now() - startDecompress;
    
    const isCorrect = data.every((val, i) => val === bwtDecompressed[i]);
    
    results.push({
      size,
      originalSize: data.length,
      compressedSize: huffmanCompressed.compressed.length,
      ratio: (data.length / huffmanCompressed.compressed.length).toFixed(2),
      compressTime: compressTime.toFixed(2),
      decompressTime: decompressTime.toFixed(2),
      isCorrect
    });
  }
  
  console.table(results);
}

runStressTest();
