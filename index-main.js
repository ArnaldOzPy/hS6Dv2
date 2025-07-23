import { formatSize } from './utils.js';

console.log("HyperStorage6D v2 iniciado");

const COMPRESS_WORKER = new Worker('./workers/compress-worker.js', { type: 'module' });
const DECOMPRESS_WORKER = new Worker('./workers/decompress-worker.js', { type: 'module' });

// Variables para el seguimiento del progreso
let compressStartTime, decompressStartTime;
let compressInterval, decompressInterval;
let compressFileSize = 0;

COMPRESS_WORKER.onerror = (e) => {
    console.error("Error en COMPRESS_WORKER:", e.message);
    showError("Error al comprimir archivo. Revisa la consola para más detalles.");
    stopProgressTracking('compress');
};

DECOMPRESS_WORKER.onerror = (e) => {
    console.error("Error en DECOMPRESS_WORKER:", e.message);
    showError("Error al descomprimir archivo. Revisa la consola para más detalles.");
    stopProgressTracking('decompress');
};

document.getElementById('compressBtn').addEventListener('click', async () => {
    const fileInput = document.getElementById('fileInput');
    if (!fileInput.files || fileInput.files.length === 0) {
        showError("Por favor, selecciona un archivo para comprimir.");
        return;
    }
    
    const file = fileInput.files[0];
    console.log("Iniciando compresión de:", file.name);
    
    // Reiniciar estado
    resetProgress('compress');
    
    // Obtener tamaño del archivo
    compressFileSize = file.size;
    document.getElementById('originalSize').textContent = formatSize(compressFileSize);
    
    // Iniciar temporizador y seguimiento de progreso
    compressStartTime = Date.now();
    startProgressTracking('compress');
    
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const buffer = e.target.result;
            const data = new Uint8Array(buffer);
            COMPRESS_WORKER.postMessage(data, [data.buffer]);
            console.log("Datos enviados al worker de compresión");
        } catch (error) {
            console.error("Error al procesar el archivo:", error);
            showError("Error al procesar el archivo");
            stopProgressTracking('compress');
        }
    };
    
    reader.onerror = (error) => {
        console.error("Error en FileReader:", error);
        showError("Error al leer el archivo");
        stopProgressTracking('compress');
    };
    
    reader.readAsArrayBuffer(file);
});

document.getElementById('decompressBtn').addEventListener('click', () => {
    const fileInput = document.getElementById('decompressInput');
    if (!fileInput.files || fileInput.files.length === 0) {
        showError("Por favor, selecciona un archivo .hs6d para descomprimir.");
        return;
    }
    
    const file = fileInput.files[0];
    console.log("Iniciando descompresión de:", file.name);
    
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
        try {
            const buffer = e.target.result;
            const data = new Uint8Array(buffer);
            DECOMPRESS_WORKER.postMessage(data, [data.buffer]);
            console.log("Datos enviados al worker de descompresión");
        } catch (error) {
            console.error("Error al procesar el archivo:", error);
            showError("Error al procesar el archivo");
            stopProgressTracking('decompress');
        }
    };
    
    reader.onerror = (error) => {
        console.error("Error en FileReader:", error);
        showError("Error al leer el archivo");
        stopProgressTracking('decompress');
    };
    
    reader.readAsArrayBuffer(file);
});

COMPRESS_WORKER.onmessage = (e) => {
    if (e.data.error) {
        console.error("Error en compresión:", e.data.error);
        showError(`Error en compresión: ${e.data.error}`);
        stopProgressTracking('compress');
        return;
    }
    
    // Procesar eventos de progreso
    if (e.data.type === 'progress') {
        updateProgress('compress', e.data.progress * 100);
        return;
    }

    console.log("Compresión completada recibida del worker");
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
        showError(`Error en descompresión: ${e.data.error}`);
        stopProgressTracking('decompress');
        return;
    }
    
    // Procesar eventos de progreso
    if (e.data.type === 'progress') {
        updateProgress('decompress', e.data.progress * 100);
        return;
    }
    
    console.log("Descompresión completada recibida del worker");
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
function startProgressTracking(type) {
    const prefix = type;
    const startTime = Date.now();
    
    // Actualizar cada 100ms
    const interval = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        const percentage = parseFloat(document.getElementById(`${prefix}Percentage`).textContent) || 0;
        
        // Actualizar tiempo transcurrido
        document.getElementById(`${prefix}Elapsed`).textContent = `${elapsed.toFixed(1)}s`;
        
        // Calcular tiempo restante si hay progreso
        if (percentage > 0 && type === 'compress' && compressFileSize > 0) {
            const remaining = (100 - percentage) * (elapsed / percentage);
            document.getElementById(`${prefix}Remaining`).textContent = `${remaining.toFixed(1)}s`;
            
            // Calcular velocidad (MB/s)
            const processedSize = (compressFileSize * percentage) / 100;
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
    const prefix = type;
    const startTime = type === 'compress' ? compressStartTime : decompressStartTime;
    const elapsed = (Date.now() - startTime) / 1000;
    
    // Actualizar tiempo total
    document.getElementById(`${prefix}Time`).textContent = `${elapsed.toFixed(2)}s`;
    
    // Detener el intervalo
    if (type === 'compress' && compressInterval) {
        clearInterval(compressInterval);
        compressInterval = null;
    } else if (decompressInterval) {
        clearInterval(decompressInterval);
        decompressInterval = null;
    }
}

function resetProgress(type) {
    const prefix = type;
    
    // Resetear barras y valores
    document.getElementById(`${prefix}Progress`).style.width = '0%';
    document.getElementById(`${prefix}Percentage`).textContent = '0%';
    document.getElementById(`${prefix}Elapsed`).textContent = '0s';
    document.getElementById(`${prefix}Remaining`).textContent = 'Calculando...';
    document.getElementById(`${prefix}Speed`).textContent = '0 MB/s';
    
    // Resetear estadísticas
    if (type === 'compress') {
        document.getElementById('compressedSize').textContent = '-';
        document.getElementById('compressionRatio').textContent = '-';
        document.getElementById('downloadCompressed').style.display = 'none';
    } else {
        document.getElementById('decompressedSize').textContent = '-';
        document.getElementById('downloadDecompressed').style.display = 'none';
    }
}

function updateProgress(type, progress) {
    const prefix = type;
    const percentage = Math.min(100, Math.max(0, progress));
    
    // Actualizar barra de progreso y porcentaje
    document.getElementById(`${prefix}Progress`).style.width = `${percentage}%`;
    document.getElementById(`${prefix}Percentage`).textContent = `${Math.round(percentage)}%`;
}

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    errorDiv.style.position = 'fixed';
    errorDiv.style.top = '20px';
    errorDiv.style.right = '20px';
    errorDiv.style.padding = '15px';
    errorDiv.style.backgroundColor = '#ff3860';
    errorDiv.style.color = 'white';
    errorDiv.style.borderRadius = '5px';
    errorDiv.style.zIndex = '1000';
    errorDiv.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
    
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
        document.body.removeChild(errorDiv);
    }, 5000);
}

// Si no tienes utils.js, define formatSize aquí
if (typeof formatSize === 'undefined') {
    function formatSize(bytes) {
        if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`;
        if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(2)} MB`;
        if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
        return `${bytes} bytes`;
    }
}

console.log("index.main.js completamente cargado");
