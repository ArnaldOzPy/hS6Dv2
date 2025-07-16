
export function burrowsWheelerTransform(input) {
  const s = input + "\0";
  const table = [];
  for (let i = 0; i < s.length; i++) {
    table.push(s.slice(i) + s.slice(0, i));
  }
  table.sort();
  return table.map(row => row[row.length - 1]).join('');
}

export function inverseBWT(bwt) {
  const n = bwt.length;
  const table = Array(n).fill('');
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      table[j] = bwt[j] + table[j];
    }
    table.sort();
  }
  return table.find(row => row.endsWith('\0')).slice(0, -1);
}

export function runLengthEncode(input) {
  let encoded = '';
  let count = 1;
  for (let i = 1; i <= input.length; i++) {
    if (input[i] === input[i - 1]) {
      count++;
    } else {
      encoded += input[i - 1] + (count > 1 ? count : '');
      count = 1;
    }
  }
  return encoded;
}

export function runLengthDecode(input) {
  let decoded = '';
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    let num = '';
    while (i + 1 < input.length && /\d/.test(input[i + 1])) {
      num += input[++i];
    }
    decoded += char.repeat(num ? parseInt(num) : 1);
  }
  return decoded;
}

export function compressBWT_RLE(text) {
  const bwt = burrowsWheelerTransform(text);
  const rle = runLengthEncode(bwt);
  return rle;
}

export function decompressBWT_RLE(encoded) {
  const rle = runLengthDecode(encoded);
  const original = inverseBWT(rle);
  return original;
}
