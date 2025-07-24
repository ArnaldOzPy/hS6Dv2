// engines/lz77-engine.js
export function createLZ77Processor(windowSize = 32768) {
  return {
    name: 'lz77',
    async process(data) {
      const result = [];
      let pos = 0;
      
      while (pos < data.length) {
        let bestMatch = { offset: 0, length: 0 };
        
        // Buscar mejor coincidencia en la ventana
        const start = Math.max(0, pos - windowSize);
        for (let i = start; i < pos; i++) {
          let length = 0;
          while (length < 258 && pos + length < data.length && 
                 data[i + length] === data[pos + length]) {
            length++;
          }
          
          if (length > bestMatch.length) {
            bestMatch = { offset: pos - i, length };
          }
        }
        
        // Codificar coincidencia o literal
        if (bestMatch.length > 3) {
          result.push(0x80 | (bestMatch.length - 3));
          result.push(bestMatch.offset >> 8);
          result.push(bestMatch.offset & 0xFF);
          pos += bestMatch.length;
        } else {
          result.push(data[pos]);
          pos++;
        }
      }
      
      return new Uint8Array(result);
    },
    
    async inverse(compressedData) {
      const result = [];
      let pos = 0;
      
      while (pos < compressedData.length) {
        const byte = compressedData[pos++];
        
        if (byte & 0x80) {
          // Decodificar coincidencia
          const length = (byte & 0x7F) + 3;
          const offsetHi = compressedData[pos++];
          const offsetLo = compressedData[pos++];
          const offset = (offsetHi << 8) | offsetLo;
          
          for (let i = 0; i < length; i++) {
            result.push(result[result.length - offset]);
          }
        } else {
          // Literal
          result.push(byte);
        }
      }
      
      return new Uint8Array(result);
    }
  };
}
