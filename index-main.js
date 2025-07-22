// index.main.js
import { compressHS6D, decompressHS6D } from './hyper-huffman.js';
import { transform6D, inverse6D } from './bwt-rle.js';
import { formatSize } from './utils.js';

const COMPRESS_WORKER = new Worker('./workers/compress-worker.js', { type: 'module' });
const DECOMPRESS_WORKER = new Worker('./workers/decompress-worker.js', { type: 'module' });

// Variables para el seguimiento del progreso
let compressStartTime, decompressStartTime;
let compressInterval, decompressInterval;

COMPRESS_WORKER.onerror = (e) => {
    console.error("Error en COMPRESS_WORKER:", e.message);
    alert("Error al comprimir archivo. Revisa la consola.");
    stopProgressTracking('compress');
};

DECOMPRESS_WORKER.onerror = (e) => {
    console.error("Error en DECOMPRESS_WORKER:", e.message);
    alert("Error al descomprimir archivo. Revisa la consola.");
    stopProgressTracking('decompress');
};

document.getElementById('compressBtn').addEventListener('click', async () => {
    const file = document.getElementById('fileInput').files[0];
    if (!file) {
        alert("Por favor, selecciona un archivo para comprimir.");
        return;
    }
    
    // Reiniciar estado
    resetProgress('compress');
    
    // Obtener tamaño del archivo
    const fileSize = file.size;
    document.getElementById('originalSize').textContent = formatSize(fileSize);
    
    // Iniciar temporizador y seguimiento de progreso
    compressStartTime = Date.now();
    startProgressTracking('compress', fileSize);
    
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
    if (!file) {
        alert("Por favor, selecciona un archivo .hs6d para descomprimir.");
        return;
    }
    
    // Reiniciar estado
    resetProgress('decompress');
    
    // Obtener tamaño del archivo
    const fileSize = file.size;
    document.getElementById('inputCompressedSize').textContent = formatSize(fileSize);
    
    // Iniciar temporizador y seguimiento de progreso
    decompressStartTime = Date.now();
    startProgressTracking('decompress', fileSize);
    
    const reader = new FileReader();
    reader.onload = (e) => {
        const buffer = e.target.result;
        const data = new Uint8Array(buffer);
        DECOMPRESS_WORKER.postMessage(data, [buffer]);
    };
    reader.readAsArrayBuffer(file);
});

COMPRESS_WORKER.onmessage = (e) => {
    if (e.data.error) {
        console.error("Error en compresión:", e.data.error);
        alert("Ocurrió un error al comprimir.");
        stopProgressTracking('compress');
        return;
    }
    
    // Procesar eventos de progreso
    if (e.data.type === 'progress') {
        const progress = e.data.progress;
        updateProgress('compress', progress);
        return;
    }

    const { compressed, originalSize, compressedSize } = e.data;
    const blob = new Blob([compressed], { type: 'application/hs6d' });
    const url = URL.createObjectURL(blob);
    
    // Detener el seguimiento del progreso
    stopProgressTracking('compress');
    
    // Actualizar estadísticas
    document.getElementById('compressedSize').textContent = formatSize(compressedSize);
    document.getElementById('compressionRatio').textContent = (originalSize / compressedSize).toFixed(2) + ":1";
    
    const link = document.getElementById('downloadCompressed');
    link.href = url;
    link.download = `compressed_${Date.now()}.hs6d`;
    link.style.display = 'block';
};

DECOMPRESS_WORKER.onmessage = (e) => {
    if (e.data.error) {
        console.error("Error en descompresión:", e.data.error);
        alert("Ocurrió un error al descomprimir.");
        stopProgressTracking('decompress');
        return;
    }
    
    // Procesar eventos de progreso
    if (e.data.type === 'progress') {
        const progress = e.data.progress;
        updateProgress('decompress', progress);
        return;
    }
    
    const { decompressed, compressedSize, originalSize } = e.data;
    const blob = new Blob([decompressed]);
    const url = URL.createObjectURL(blob);
    
    // Detener el seguimiento del progreso
    stopProgressTracking('decompress');
    
    // Actualizar estadísticas
    document.getElementById('decompressedSize').textContent = formatSize(originalSize);
    
    const link = document.getElementById('downloadDecompressed');
    link.href = url;
    link.download = `original_${Date.now()}`;
    link.style.display = 'block';
};

// Funciones para manejar el progreso
function startProgressTracking(type, totalSize) {
    const startTime = Date.now();
    const prefix = type === 'compress' ? 'compress' : 'decompress';
    
    // Actualizar cada 100ms
    const interval = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        const percentage = parseFloat(document.getElementById(`${prefix}Percentage`).textContent) || 0;
        
        // Actualizar tiempo transcurrido
        document.getElementById(`${prefix}Elapsed`).textContent = `${elapsed.toFixed(1)}s`;
        
        // Calcular tiempo restante si hay progreso
        if (percentage > 0) {
            const remaining = (100 - percentage) * (elapsed / percentage);
            document.getElementById(`${prefix}Remaining`).textContent = `${remaining.toFixed(1)}s`;
            
            // Calcular velocidad (MB/s)
            const processedSize = (totalSize * percentage) / 100;
            const speed = (processedSize / (1024 * 1024)) / elapsed;
            document.getElementById(`${prefix}Speed`).textContent = `${speed.toFixed(2)} MB/s`;
        }
    }, 100);
    
    if (type === 'compress') {
        compressInterval = interval;
    } else {
        decompressInterval = interval;
    }
}

function stopProgressTracking(type) {
    const prefix = type === 'compress' ? 'compress' : 'decompress';
    const elapsed = (Date.now() - (type === 'compress' ? compressStartTime : decompressStartTime)) / 1000;
    
    // Actualizar tiempo total
    document.getElementById(`${prefix}Time`).textContent = `${elapsed.toFixed(2)}s`;
    
    // Detener el intervalo
    if (type === 'compress' && compressInterval) {
        clearInterval(compressInterval);
    } else if (decompressInterval) {
        clearInterval(decompressInterval);
    }
}

function resetProgress(type) {
    const prefix = type === 'compress' ? 'compress' : 'decompress';
    
    // Resetear barras y valores
    document.getElementById(`${prefix}Progress`).style.width = '0%';
    document.getElementById(`${prefix}Percentage`).textContent = '0%';
    document.getElementById(`${prefix}Elapsed`).textContent = '0s';
    document.getElementById(`${prefix}Remaining`).textContent = 'Calculando...';
    document.getElementById(`${prefix}Speed`).textContent = '0 MB/s';
    
    // Ocultar enlaces de descarga
    if (type === 'compress') {
        document.getElementById('downloadCompressed').style.display = 'none';
    } else {
        document.getElementById('downloadDecompressed').style.display = 'none';
    }
}

function updateProgress(type, progress) {
    const prefix = type === 'compress' ? 'compress' : 'decompress';
    const percentage = Math.round(progress * 100);
    
    // Actualizar barra de progreso y porcentaje
    document.getElementById(`${prefix}Progress`).style.width = `${percentage}%`;
    document.getElementById(`${prefix}Percentage`).textContent = `${percentage}%`;
}

// Funciones utilitarias (si no están en utils.js)
export function findRepeatedBlocks(data, blockSize = 512) { 
    const seen = new Map(); 
    const repeats = new Set();

    for (let i = 0; i < data.length - blockSize; i += blockSize) { 
        const block = data.slice(i, i + blockSize); 
        const key = block.join(',');

        if (seen.has(key)) {
            repeats.add(i);
        } else {
            seen.set(key, i);
        }
    }

    return repeats; 
}

export function crc32(buf) {
    const table = new Uint32Array(256).map((_, n) => {
        for (let k = 0; k < 8; k++) n = n & 1 ? 0xEDB88320 ^ (n >>> 1) : n >>> 1;
        return n >>> 0;
    });

    let crc = 0 ^ (-1);
    for (let i = 0; i < buf.length; i++) { 
        crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF]; 
    } 
    return (crc ^ (-1)) >>> 0; 
}
