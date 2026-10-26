export const TARGET_SAMPLE_RATE = 16000;
export const WAV_HEADER_BYTES = 44;

/**
 * Downsample mono Float32 PCM dengan box filter sederhana.
 * Contoh: 48kHz -> 16kHz mengambil rata-rata 3 sampel agar tidak alias.
 */
export function downsampleBuffer(
  input: Float32Array,
  inputRate: number,
  outputRate: number
): Float32Array {
  if (!Number.isFinite(inputRate) || inputRate <= 0) return input;
  if (!Number.isFinite(outputRate) || outputRate <= 0) return input;
  if (outputRate >= inputRate) return input;

  const ratio = inputRate / outputRate;
  const outputLength = Math.max(1, Math.round(input.length / ratio));
  const output = new Float32Array(outputLength);

  for (let i = 0; i < outputLength; i += 1) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    let count = 0;
    for (let j = start; j < end; j += 1) {
      sum += input[j];
      count += 1;
    }
    output[i] = count > 0 ? sum / count : input[start] || 0;
  }

  return output;
}

export function floatTo16BitPCM(input: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(input.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < input.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  return buffer;
}

export function encodeWavBytes(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const pcm = floatTo16BitPCM(samples);
  const buffer = new ArrayBuffer(WAV_HEADER_BYTES + pcm.byteLength);
  const view = new DataView(buffer);

  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + pcm.byteLength, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate (mono, 16-bit)
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, 'data');
  view.setUint32(40, pcm.byteLength, true);

  new Uint8Array(buffer, WAV_HEADER_BYTES).set(new Uint8Array(pcm));
  return buffer;
}

export function encodeWavBlob(samples: Float32Array, sampleRate: number): Blob {
  return new Blob([encodeWavBytes(samples, sampleRate)], { type: 'audio/wav' });
}

export function wavDurationMs(samples: Float32Array, sampleRate: number): number {
  if (!sampleRate) return 0;
  return Math.round((samples.length / sampleRate) * 1000);
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  if (typeof btoa === 'function') return btoa(binary);
  const NodeBuffer = (globalThis as unknown as { Buffer?: { from: (input: string, encoding: string) => { toString: (encoding: string) => string } } }).Buffer;
  if (NodeBuffer) return NodeBuffer.from(binary, 'binary').toString('base64');
  throw new Error('Base64 encoder tidak tersedia');
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const clean = base64.includes(',') ? base64.slice(base64.indexOf(',') + 1) : base64;
  let binary: string;
  if (typeof atob === 'function') {
    binary = atob(clean);
  } else {
    const NodeBuffer = (globalThis as unknown as { Buffer?: { from: (input: string, encoding: string) => { toString: (encoding: string) => string } } }).Buffer;
    if (!NodeBuffer) throw new Error('Base64 decoder tidak tersedia');
    binary = NodeBuffer.from(clean, 'base64').toString('binary');
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer as ArrayBuffer;
}
