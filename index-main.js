import { compressHS6D, decompressHS6D } from './hyper-huffman.js';
import { transform6D, inverse6D } from './bwt-rle.js';

const COMPRESS_WORKER = new Worker('./workers/compress-worker.js', { type: 'module' });
const DECOMPRESS_WORKER = new Worker('./workers/decompress-worker.js', { type: 'module' });

COMPRESS_WORKER.onerror = (e) => {
  console.error("Error en COMPRESS_WORKER:", e.message);
  alert("Error al comprimir archivo. Revisa la consola.");
};

DECOMPRESS_WORKER.onerror = (e) => {
  console.error("Error en DECOMPRESS_WORKER:", e.message);
  alert("Error al descomprimir archivo. Revisa la consola.");
};

document.getElementById('compressBtn').addEventListener('click', async () => {
  const file = document.getElementById('fileInput').files[0];
  if (!file) {
    alert("Por favor, selecciona un archivo para comprimir.");
    return;
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    const buffer = e.target.result;
    const data = new Uint8Array(buffer);
    document.getElementById('compressProgress').style.width = '50%';
    COMPRESS_WORKER.postMessage(data, [data.buffer]);
  };
  reader.readAsArrayBuffer(file);
});

document.getElementById('decompressBtn').addEventListener('click', () => {
  const file = document.getElementById('decompressInput').files[0];
  if (!file) {
    alert("Por favor, selecciona un archivo .hs6d para descomprimir.");
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const buffer = e.target.result;
    const data = new Uint8Array(buffer);
    document.getElementById('decompressProgress').style.width = '50%';
    DECOMPRESS_WORKER.postMessage(data, [buffer]);
  };
  reader.readAsArrayBuffer(file);
});

COMPRESS_WORKER.onmessage = (e) => {
  if (e.data.error) {
    console.error("Error en compresión:", e.data.error);
    alert("Ocurrió un error al comprimir.");
    return;
  }

  const { compressed, originalSize, compressedSize } = e.data;
  const blob = new Blob([compressed], { type: 'application/hs6d' });
  const url = URL.createObjectURL(blob);

  document.getElementById('compressProgress').style.width = '100%';
  document.getElementById('originalSize').textContent = formatSize(originalSize);
  document.getElementById('compressedSize').textContent = formatSize(compressedSize);
  document.getElementById('compressionRatio').textContent = `${(originalSize / compressedSize).toFixed(2)}:1`;

  const link = document.getElementById('downloadCompressed');
  link.href = url;
  link.download = `compressed_${Date.now()}.hs6d`;
  link.style.display = 'block';
};

DECOMPRESS_WORKER.onmessage = (e) => {
  if (e.data.error) {
    console.error("Error en descompresión:", e.data.error);
    alert("Ocurrió un error al descomprimir.");
    return;
  }

  const { decompressed, compressedSize } = e.data;
  const blob = new Blob([decompressed]);
  const url = URL.createObjectURL(blob);

  document.getElementById('decompressProgress').style.width = '100%';
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


export function findRepeatedBlocks(data, blockSize = 512) { const seen = new Map(); const repeats = new Set();

for (let i = 0; i < data.length - blockSize; i += blockSize) { const block = data.slice(i, i + blockSize); const key = block.join(',');

if (seen.has(key)) {
  repeats.add(i);
} else {
  seen.set(key, i);
}

}

return repeats; }



export function crc32(buf) { const table = new Uint32Array(256).map((_, n) => { for (let k = 0; k < 8; k++) n = n & 1 ? 0xEDB88320 ^ (n >>> 1) : n >>> 1; return n >>> 0; });

let crc = 0 ^ (-1); for (let i = 0; i < buf.length; i++) { crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF]; } return (crc ^ (-1)) >>> 0; }

