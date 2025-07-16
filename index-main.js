

import { compressData, decompressData } from './compress-worker.js'; import { buildSuffixArray } from './suffix-array.js'; import { crc32 } from './crc32.js'; import { findRepeatedBlocks } from './block-match.js';

const fileInput = document.getElementById('fileInput'); const compressBtn = document.getElementById('compressBtn'); const decompressBtn = document.getElementById('decompressBtn'); const resultText = document.getElementById('resultText');

compressBtn.addEventListener('click', async () => { const file = fileInput.files[0]; if (!file) return alert('Selecciona un archivo.'); const arrayBuffer = await file.arrayBuffer(); const uint8Data = new Uint8Array(arrayBuffer);

const compressed = await compressData(uint8Data); resultText.value = btoa(String.fromCharCode(...compressed)); });

decompressBtn.addEventListener('click', async () => { const base64 = resultText.value; const binary = atob(base64); const uint8Data = new Uint8Array(binary.length); for (let i = 0; i < binary.length; i++) uint8Data[i] = binary.charCodeAt(i);

const decompressed = await decompressData(uint8Data); resultText.value = new TextDecoder().decode(decompressed); });



import { bwtEncode, rleEncode, huffmanEncode } from './compressors.js'; import { findRepeatedBlocks } from './block-match.js'; import { crc32 } from './crc32.js';

export async function compressData(data) { const crc = crc32(data);

const patternMap = findRepeatedBlocks(data, 512); const cleanedData = data.filter((_, i) => !patternMap.has(i));

const bwt = bwtEncode(cleanedData); const rle = rleEncode(bwt); const huffman = huffmanEncode(rle);

const crcBytes = new Uint8Array(4); const dv = new DataView(crcBytes.buffer); dv.setUint32(0, crc);

return new Uint8Array([...crcBytes, ...huffman]); }



import { bwtDecode, rleDecode, huffmanDecode } from './compressors.js'; import { crc32 } from './crc32.js';

export async function decompressData(data) { const storedCRC = new DataView(data.buffer).getUint32(0); const payload = data.slice(4);

const huffman = huffmanDecode(payload); const rle = rleDecode(huffman); const bwt = bwtDecode(rle);

const calcCRC = crc32(bwt); if (storedCRC !== calcCRC) throw new Error('CRC mismatch. Archivo corrupto.');

return bwt; }



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

