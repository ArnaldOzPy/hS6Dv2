export async function processInChunks(data, processor, chunkSize = 1024 * 1024) {
  const results = [];
  const totalChunks = Math.ceil(data.length / chunkSize);
  
  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, data.length);
    const chunk = data.slice(start, end);
    
    // Procesar chunk (puede ser paralelizado con Workers)
    const processed = await processor(chunk);
    results.push(processed);
    
    // Reportar progreso
    self.postMessage({
      type: 'progress',
      progress: (i + 1) / totalChunks,
      stage: `Procesando chunk ${i+1}/${totalChunks}`
    });
  }
  
  return concatenateUint8Arrays(results);
}

function concatenateUint8Arrays(arrays) {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  
  return result;
}
