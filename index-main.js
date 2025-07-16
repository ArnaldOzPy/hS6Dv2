import { compressHS6D, decompressHS6D } from './hyper-huffman.js'; import { transform6D, inverse6D } from './bwt-rle.js';

const COMPRESS_WORKER = new Worker('./workers/compress-worker.js'); const DECOMPRESS_WORKER = new Worker('./workers/decompress-worker.js');

const compressBtn = document.getElementById('compressBtn'); const decompressBtn = document.getElementById('decompressBtn'); const compressProgress = document.getElementById('compressProgress'); const decompressProgress = document.getElementById('decompressProgress'); const compressETA = document.getElementById('compressETA'); const decompressETA = document.getElementById('decompressETA');

compressBtn.addEventListener('click', async () => { const file = document.getElementById('fileInput').files[0]; if (!file) return alert("Selecciona un archivo para comprimir");

const reader = new FileReader(); reader.onload = async (e) => { const buffer = e.target.result; const data = new Uint8Array(buffer); let startTime = Date.now();

simulateProgress(compressProgress, compressETA);
COMPRESS_WORKER.postMessage(data, [data.buffer]);

}; reader.readAsArrayBuffer(file); });

decompressBtn.addEventListener('click', () => { const file = document.getElementById('decompressInput').files[0]; if (!file) return alert("Selecciona un archivo .hs6d para descomprimir");

const reader = new FileReader(); reader.onload = (e) => { const buffer = e.target.result; const uint8Data = new Uint8Array(buffer);

simulateProgress(decompressProgress, decompressETA);
DECOMPRESS_WORKER.postMessage(uint8Data, [uint8Data.buffer]);

}; reader.readAsArrayBuffer(file); });

COMPRESS_WORKER.onmessage = (e) => { const { compressed, originalSize, compressedSize, error } = e.data; if (error) return alert("Error al comprimir: " + error);

const blob = new Blob([compressed], { type: 'application/hs6d' }); const url = URL.createObjectURL(blob);

document.getElementById('originalSize').textContent = formatSize(originalSize); document.getElementById('compressedSize').textContent = formatSize(compressedSize); document.getElementById('compressionRatio').textContent = ${(originalSize / compressedSize).toFixed(2)}:1;

const link = document.getElementById('downloadCompressed'); link.href = url; link.download = compressed_${Date.now()}.hs6d; link.style.display = 'block';

compressProgress.style.width = '100%'; compressETA.textContent = 'ETA: 0s'; };

DECOMPRESS_WORKER.onmessage = (e) => { const { decompressed, compressedSize, error } = e.data; if (error) return alert("Error al descomprimir: " + error);

const blob = new Blob([decompressed]); const url = URL.createObjectURL(blob);

document.getElementById('inputCompressedSize').textContent = formatSize(compressedSize); document.getElementById('decompressedSize').textContent = formatSize(decompressed.length);

const link = document.getElementById('downloadDecompressed'); link.href = url; link.download = original_${Date.now()}; link.style.display = 'block';

decompressProgress.style.width = '100%'; decompressETA.textContent = 'ETA: 0s'; };

function formatSize(bytes) { if (bytes >= 1048576) return ${(bytes / 1048576).toFixed(2)} MB; if (bytes >= 1024) return ${(bytes / 1024).toFixed(2)} KB; return ${bytes} bytes; }

function simulateProgress(bar, eta) { let progress = 0; let duration = 5 + Math.random() * 4; let start = Date.now();

const interval = setInterval(() => { const elapsed = (Date.now() - start) / 1000; progress = Math.min((elapsed / duration) * 100, 98); bar.style.width = ${progress.toFixed(0)}%; let remaining = Math.max(duration - elapsed, 0); eta.textContent = ETA: ${remaining.toFixed(1)}s;

if (progress >= 98) clearInterval(interval);

}, 200); }

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
