
import { compressBWT_RLE, decompressBWT_RLE } from './bwt-rle.js';
import { compressHuffman, decompressHuffman } from './hyper-huffman.js';

function textEncoder(buffer) {
  return new TextDecoder().decode(buffer);
}

function textDecoder(text) {
  return new TextEncoder().encode(text);
}

const inputFile = document.getElementById('fileInput');
inputFile.addEventListener('change', async () => {
  const file = inputFile.files[0];
  const reader = new FileReader();
  reader.onload = async () => {
    const buffer = reader.result;
    const originalText = textEncoder(buffer);

    // Capa 3: BWT + RLE
    const bwtText = compressBWT_RLE(originalText);

    // Capa 4: Huffman
    const { compressed, tree, padLength } = compressHuffman(bwtText);

    document.getElementById('originalSize').textContent = (buffer.byteLength / 1024).toFixed(2) + ' KB';
    document.getElementById('finalSize').textContent = (compressed.byteLength / 1024).toFixed(2) + ' KB';
    const reduction = 100 - ((compressed.byteLength / buffer.byteLength) * 100);
    document.getElementById('compressionRate').textContent = reduction.toFixed(2) + ' %';

    const metadata = JSON.stringify({ tree, padLength });
    const metaBuffer = textDecoder(metadata);
    const finalBuffer = new Uint8Array(1 + metaBuffer.length + compressed.length);
    finalBuffer[0] = metaBuffer.length;
    finalBuffer.set(metaBuffer, 1);
    finalBuffer.set(compressed, 1 + metaBuffer.length);

    const blob = new Blob([finalBuffer], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const link = document.getElementById('downloadCompressed');
    link.href = url;
    link.download = file.name + '.h6d';
    link.style.display = 'block';
  };
  reader.onprogress = e => {
    const percent = Math.round((e.loaded / e.total) * 100);
    const bar = document.getElementById('progressFill');
    bar.style.width = percent + '%';
    bar.textContent = percent + '%';
  };
  reader.readAsArrayBuffer(file);
});

const decompressInput = document.getElementById('decompressInput');
decompressInput.addEventListener('change', () => {
  const file = decompressInput.files[0];
  const reader = new FileReader();
  reader.onload = () => {
    const buffer = new Uint8Array(reader.result);
    const metaLength = buffer[0];
    const meta = textEncoder(buffer.slice(1, 1 + metaLength));
    const { tree, padLength } = JSON.parse(meta);
    const compressed = buffer.slice(1 + metaLength);

    const bwtText = decompressHuffman(compressed, tree, padLength);
    const original = decompressBWT_RLE(bwtText);
    const originalBuffer = textDecoder(original);

    document.getElementById('compressedInputSize').textContent = (buffer.byteLength / 1024).toFixed(2) + ' KB';
    document.getElementById('decompressedOutputSize').textContent = (originalBuffer.byteLength / 1024).toFixed(2) + ' KB';

    const blob = new Blob([originalBuffer], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const link = document.getElementById('downloadOriginal');
    link.href = url;
    link.download = file.name.replace(/\.h6d$/, '');
    link.style.display = 'block';
  };
  reader.onprogress = e => {
    const percent = Math.round((e.loaded / e.total) * 100);
    const bar = document.getElementById('decompressProgress');
    bar.style.width = percent + '%';
    bar.textContent = percent + '%';
  };
  reader.readAsArrayBuffer(file);
});
