const ALPHABET_SIZE = 256;
const MAX_BLOCK_SIZE = 10485760; // 10MB
const MIN_BLOCK_SIZE = 1;

// Función de formato de tamaño (si utils.js no está disponible)
function formatSize(bytes) {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${bytes} bytes`;
}

// ================== BLOQUES PEQUEÑOS (CORREGIDO) ==================
function isZeroBlock(encoded) {
  return encoded.length === 1 && encoded[0] === 0xFF;
}

function isSmallBlock(encoded) {
  return encoded.length >= 3 && 
         encoded[0] === 0xFE && 
         encoded[1] === 0xFD;
}

function handleSmallBlock(data) {
  if (data.length === 0) return new Uint8Array([0xFF]);
  
  const output = new Uint8Array(data.length + 3);
  output[0] = 0xFE;
  output[1] = 0xFD;
  output[2] = data.length;
  
  for (let i = 0; i < data.length; i++) {
    output[i + 3] = data[i];
  }
  
  return output;
}

function handleSmallBlockInverse(encoded) {
  if (encoded[0] !== 0xFE || encoded[1] !== 0xFD) {
    throw new Error("Formato de bloque pequeño inválido");
  }

  const originalLength = encoded[2];
  
  if (originalLength > 3 || encoded.length < 3 + originalLength) {
    throw new Error(`Longitud de bloque pequeño inválida: ${originalLength}`);
  }
  
  return encoded.subarray(3, 3 + originalLength);
}

// ================== FUNCIONES PRINCIPALES ==================
export function createBWTProcessor() {
  return {
    process: function(data) {
      if (data.length === 0) return new Uint8Array(0);
      if (data.length > MAX_BLOCK_SIZE) {
        throw new Error(`Tamaño excede límite (${formatSize(MAX_BLOCK_SIZE)})`);
      }

      if (data.length < MIN_BLOCK_SIZE) {
        return handleSmallBlock(data);
      }
      return transform6D(data);
    },
    inverse: function(encoded) {
      if (encoded.length === 0) return new Uint8Array(0);
      
      // Verificar en orden: 1. Vacío, 2. Pequeño, 3. Normal
      if (isZeroBlock(encoded)) return new Uint8Array(0);
      if (isSmallBlock(encoded)) return handleSmallBlockInverse(encoded);
      return inverse6D(encoded);
    }
  };
}

// ================== TRANSFORMACIONES 6D ==================
function transform6D(data) {
  try {
    const { bwt, originalIndex } = applyBWT(data);
    const mtf = mtfEncode(bwt);
    const rle = encodeRLE(mtf);

    if (rle.length === 0) return new Uint8Array([0xFF]);

    const output = new Uint8Array(rle.length + 4);
    const view = new DataView(output.buffer);
    view.setUint32(0, originalIndex, true);
    output.set(rle, 4);
    return output;
  } catch (error) {
    console.error("Error en transform6D:", error);
    throw new Error("Fallo en compresión BWT: " + error.message);
  }
}

function inverse6D(encoded) {
  if (encoded.length < 4) {
    throw new Error(`Datos insuficientes para cabecera BWT`);
  }

  const view = new DataView(encoded.buffer, encoded.byteOffset, 4);
  const originalIndex = view.getUint32(0, true);
  const rleData = encoded.subarray(4);

  try {
    const decodedRLE = decodeRLE(rleData);
    const imtf = mtfDecode(decodedRLE);
    return inverseBWT(imtf, originalIndex);
  } catch (error) {
    console.error("Error en inverse6D:", error);
    throw new Error("Fallo en descompresión BWT: " + error.message);
  }
}

// ================== FUNCIONES AUXILIARES ==================
function buildSuffixArray(data) {
  const n = data.length;
  const sa = Array.from({ length: n }, (_, i) => i);
  const sampleSize = Math.min(500000, n);
  const step = Math.max(1, Math.floor(n / sampleSize));

  sa.sort((a, b) => {
    for (let i = 0; i < n; i += step) {
      const diff = data[(a + i) % n] - data[(b + i) % n];
      if (diff !== 0) return diff;
    }
    return 0;
  });

  return sa;
}

function applyBWT(data) {
  const suffixArray = buildSuffixArray(data);
  const n = data.length;
  const bwt = new Uint8Array(n);
  let originalIndex = -1;

  for (let i = 0; i < n; i++) {
    const pos = suffixArray[i];
    if (pos === 0) {
      originalIndex = i;
      bwt[i] = data[n - 1];
    } else {
      bwt[i] = data[pos - 1];
    }
  }

  if (originalIndex === -1) {
    throw new Error("Índice original no encontrado");
  }

  return { bwt, originalIndex };
}

function mtfEncode(data) {
  const alphabet = Array.from({ length: ALPHABET_SIZE }, (_, i) => i);
  const output = new Uint16Array(data.length);
  const indexMap = new Uint16Array(ALPHABET_SIZE);
  
  for (let i = 0; i < ALPHABET_SIZE; i++) indexMap[i] = i;

  for (let i = 0; i < data.length; i++) {
    const byte = data[i];
    const idx = indexMap[byte];
    output[i] = idx;
    
    for (let j = idx; j > 0; j--) {
      alphabet[j] = alphabet[j - 1];
      indexMap[alphabet[j]] = j;
    }
    alphabet[0] = byte;
    indexMap[byte] = 0;
  }

  return output;
}

function mtfDecode(data) {
  const alphabet = Array.from({ length: ALPHABET_SIZE }, (_, i) => i);
  const output = new Uint8Array(data.length);

  for (let i = 0; i < data.length; i++) {
    const idx = data[i];
    const byte = alphabet[idx];
    output[i] = byte;
    
    for (let j = idx; j > 0; j--) {
      alphabet[j] = alphabet[j - 1];
    }
    alphabet[0] = byte;
  }

  return output;
}

// ================== RLE CON VALIDACIÓN MEJORADA ==================
function encodeRLE(data) {
  const output = [];
  let i = 0;
  const n = data.length;

  while (i < n) {
    let runLength = 1;
    while (i + runLength < n && 
           data[i + runLength] === data[i] && 
           runLength < 16383) {
      runLength++;
    }

    if (runLength >= 3) {
      output.push(0x80 | (runLength >>> 8), runLength & 0xFF, data[i]);
      i += runLength;
    } else {
      let literalEnd = i + 1;
      // Validación mejorada de límites
      while (literalEnd < n - 2 && 
             (literalEnd - i < 16383) && 
             (data[literalEnd] !== data[literalEnd + 1] || 
              data[literalEnd] !== data[literalEnd + 2])) {
        literalEnd++;
      }
      const literalLength = literalEnd - i;
      output.push(0x00, literalLength >>> 8, literalLength & 0xFF);
      for (let j = 0; j < literalLength; j++) output.push(data[i + j]);
      i += literalLength;
    }
  }

  return new Uint8Array(output);
}

function decodeRLE(encoded) {
  const output = [];
  let i = 0;
  const n = encoded.length;

  while (i < n) {
    if (i >= n) break;
    const marker = encoded[i++];

    if (marker & 0x80) {
      if (i + 1 >= n) throw new Error("RLE run truncado");
      const runLength = ((marker & 0x7F) << 8) | encoded[i++];
      const value = encoded[i++];
      for (let j = 0; j < runLength; j++) output.push(value);
    } else {
      if (i + 2 >= n) throw new Error("RLE literal truncado");
      const literalLength = (encoded[i++] << 8) | encoded[i++];
      if (i + literalLength > n) throw new Error("Datos literales incompletos");
      for (let j = 0; j < literalLength; j++) output.push(encoded[i++]);
    }
  }

  return new Uint8Array(output);
}

// ... (código anterior)

function inverseBWT(bwtData, originalIndex) {
  const n = bwtData.length;
  if (originalIndex < 0 || originalIndex >= n) {
    throw new Error(`Índice inválido: ${originalIndex} (rango 0-${n-1})`);
  }

  const counts = new Array(ALPHABET_SIZE).fill(0);
  const starts = new Array(ALPHABET_SIZE);
  const links = new Array(n);

  for (let i = 0; i < n; i++) counts[bwtData[i]]++;

  let total = 0;
  for (let i = 0; i < ALPHABET_SIZE; i++) {
    starts[i] = total;
    total += counts[i];
  }

  const nextIndex = [...starts];
  for (let i = 0; i < n; i++) {
    const byte = bwtData[i];
    links[nextIndex[byte]++] = i;
  }

  const output = new Uint8Array(n);
  let current = originalIndex;
  
  // CORRECCIÓN: Reconstrucción mejorada con validación
  for (let i = n - 1; i >= 0; i--) {
    output[i] = bwtData[current];
    current = links[current];
    
    // Validación de índice durante la reconstrucción
    if (current < 0 || current >= n) {
      throw new Error("Índice fuera de rango durante reconstrucción BWT");
    }
  }

  return output;
}
