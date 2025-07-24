
export class CompressionPipeline {
  constructor() {
    this.transformers = [];
    this.entropyEncoders = [];
  }

  registerTransformer(name, processor) {
    this.transformers.push({ name, processor });
  }

  registerEntropyEncoder(name, encoder) {
    this.entropyEncoders.push({ name, encoder });
  }

  async process(data, config) {
    let processed = data;
    
    // Aplicar transformadores
    for (const { name, processor } of this.transformers) {
      if (config.transformers.includes(name)) {
        processed = await processor.process(processed);
      }
    }
    
    // Aplicar codificador de entropía
    const encoder = this.entropyEncoders.find(e => e.name === config.entropyEncoder);
    if (!encoder) throw new Error(`Encoder no encontrado: ${config.entropyEncoder}`);
    
    return encoder.encoder.encode(processed);
  }

  async inverse(data, config) {
    let processed = data;
    
    // Decodificar entropía
    const encoder = this.entropyEncoders.find(e => e.name === config.entropyEncoder);
    if (!encoder) throw new Error(`Encoder no encontrado: ${config.entropyEncoder}`);
    processed = encoder.encoder.decode(processed);
    
    // Aplicar transformadores inversos en orden inverso
    for (const { name, processor } of [...this.transformers].reverse()) {
      if (config.transformers.includes(name)) {
        processed = await processor.inverse(processed);
      }
    }
    
    return processed;
  }
}
