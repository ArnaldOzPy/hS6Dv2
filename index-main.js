import { compressHS6D, decompressHS6D } from './hyper-huffman.js';
import { transform6D, inverse6D } from './bwt-rle.js';

const COMPRESS_WORKER = new Worker('./workers/compress-worker.js');
const DECOMPRESS_WORKER = new Worker('./workers/decompress-worker.js');

document.getElementById('compressBtn').addEventListener('click', async () => {
  const file = document.getElementById('fileInput').files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    const buffer = e.target.result;
    const data = new Uint8Array(buffer);
    
    COMPRESS_WORKER.postMessage(data, [data.buffer]);
  };
  reader.readAsArrayBuffer(file);
});

document.getElementById('decompressBtn').addEventListener('click', () => {
  const file = document.getElementById('decompressInput').files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const buffer = e.target.result;
    DECOMPRESS_WORKER.postMessage(new Uint8Array(buffer), [buffer]);
  };
  reader.readAsArrayBuffer(file);
});

COMPRESS_WORKER.onmessage = (e) => {
  const { compressed, originalSize, compressedSize } = e.data;
  const blob = new Blob([compressed], { type: 'application/hs6d' });
  const url = URL.createObjectURL(blob);
  
  document.getElementById('originalSize').textContent = formatSize(originalSize);
  document.getElementById('compressedSize').textContent = formatSize(compressedSize);
  document.getElementById('compressionRatio').textContent = 
    `${(originalSize / compressedSize).toFixed(2)}:1`;
  
  const link = document.getElementById('downloadCompressed');
  link.href = url;
  link.download = `compressed_${Date.now()}.hs6d`;
  link.style.display = 'block';
};

DECOMPRESS_WORKER.onmessage = (e) => {
  const { decompressed, compressedSize } = e.data;
  const blob = new Blob([decompressed]);
  const url = URL.createObjectURL(blob);
  
  document.getElementById('inputCompressedSize').textContent = formatSize(compressedSize);
  document.getElementById('decompressedSize').textContent = formatSize(decompressed.length);
  
  const link = document.getElementById('downloadDecompressed');
  link.href = url;
  link.download = `original_${Date.now()}`;
  link.style.display = 'block';
};

function formatSize(bytes) {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${bytes} bytes`;
}
