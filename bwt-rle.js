export function transform6D(data) {
  const suffixArray = buildSuffixArray(data);
  const bwt = applyBWT(data, suffixArray);
  return encodeRLE(bwt);
}

export function inverse6D(encoded) {
  const decodedRLE = decodeRLE(encoded);
  return inverseBWT(decodedRLE);
}

function buildSuffixArray(data) {
  const n = data.length;
  const suffixes = Array.from({length: n}, (_, i) => i);
  
  suffixes.sort((a, b) => {
    while (a < n && b < n && data[a] === data[b]) {
      a++;
      b++;
    }
    return a === n ? -1 : b === n ? 1 : data[a] - data[b];
  });
  
  return suffixes;
}

function applyBWT(data, suffixArray) {
  const output = new Uint8Array(data.length);
  for (let i = 0; i < suffixArray.length; i++) {
    output[i] = data[(suffixArray[i] === 0 ? data.length : suffixArray[i]) - 1];
  }
  return output;
}

function encodeRLE(data) {
  const output = [];
  let count = 1;
  
  for (let i = 1; i <= data.length; i++) {
    if (i < data.length && data[i] === data[i-1]) {
      count++;
    } else {
      output.push(data[i-1]);
      if (count > 1) output.push(count);
      count = 1;
    }
  }
  
  return new Uint8Array(output);
}

function decodeRLE(encoded) {
  const output = [];
  let i = 0;
  
  while (i < encoded.length) {
    const value = encoded[i++];
    const nextIsNumber = i < encoded.length && typeof encoded[i] === 'number';
    const count = nextIsNumber ? encoded[i++] : 1;
    
    for (let j = 0; j < count; j++) {
      output.push(value);
    }
  }
  
  return new Uint8Array(output);
}

function inverseBWT(bwtData) {
  const n = bwtData.length;
  const table = Array.from({length: n}, () => new Uint8Array(n));
  
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      table[j][i] = i === 0 ? bwtData[j] : table[j][i-1];
    }
    table.sort((a, b) => {
      for (let k = 0; k < n; k++) {
        if (a[k] !== b[k]) return a[k] - b[k];
      }
      return 0;
    });
  }
  
  return table.find(row => row[n-1] === 0).slice(0, -1);
}
