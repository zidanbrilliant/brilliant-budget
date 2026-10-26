import {
  TARGET_SAMPLE_RATE,
  arrayBufferToBase64,
  downsampleBuffer,
  encodeWavBytes,
  wavDurationMs,
} from './wav.ts';

export interface RecordedVoiceClip {
  base64: string;
  mimeType: 'audio/wav';
  durationMs: number;
  sampleRate: number;
}

export function isVoiceRecordingSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined'
  );
}

function pickMimeType(): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];
  if (typeof MediaRecorder.isTypeSupported !== 'function') return '';
  return candidates.find(type => MediaRecorder.isTypeSupported(type)) || '';
}

function decodeAudio(ctx: AudioContext, data: ArrayBuffer): Promise<AudioBuffer> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const done = (buffer: AudioBuffer) => {
      if (settled) return;
      settled = true;
      resolve(buffer);
    };
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      reject(error instanceof Error ? error : new Error(String(error)));
    };

    try {
      const maybePromise = ctx.decodeAudioData(data, done, fail);
      if (maybePromise && typeof maybePromise.then === 'function') {
        maybePromise.then(done).catch(fail);
      }
    } catch (error) {
      fail(error);
    }
  });
}

function mixToMono(buffer: AudioBuffer): Float32Array {
  if (buffer.numberOfChannels <= 1) {
    return buffer.getChannelData(0);
  }
  const mixed = new Float32Array(buffer.length);
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < data.length; i += 1) {
      mixed[i] += data[i] / buffer.numberOfChannels;
    }
  }
  return mixed;
}

/**
 * Merekam suara lewat MediaRecorder, lalu mengubahnya menjadi WAV mono 16kHz.
 * Format ini adalah input terbaik untuk Gemini audio dan berukuran kecil.
 */
export class VoiceRecorder {
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private startedAt = 0;
  private stopPromise: Promise<RecordedVoiceClip> | null = null;
  private resolveStop: ((clip: RecordedVoiceClip) => void) | null = null;
  private rejectStop: ((error: Error) => void) | null = null;
  private settled = false;
  private cancelled = false;

  get isRecording(): boolean {
    return !!this.recorder && this.recorder.state === 'recording';
  }

  async start(): Promise<void> {
    if (this.isRecording) return;
    if (!isVoiceRecordingSupported()) {
      throw new Error('Perekaman suara tidak didukung di browser ini.');
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: { ideal: 48000 },
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    const mimeType = pickMimeType();
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(
        stream,
        mimeType
          ? { mimeType, audioBitsPerSecond: 128000 }
          : { audioBitsPerSecond: 128000 }
      );
    } catch {
      stream.getTracks().forEach(track => track.stop());
      throw new Error('Format rekaman suara tidak didukung browser ini.');
    }

    this.stream = stream;
    this.recorder = recorder;
    this.chunks = [];
    this.startedAt = Date.now();
    this.settled = false;
    this.cancelled = false;

    this.stopPromise = new Promise<RecordedVoiceClip>((resolve, reject) => {
      this.resolveStop = resolve;
      this.rejectStop = reject;
    });
    // Jangan biarkan promise ditolak tanpa penanganan saat modal ditutup.
    this.stopPromise.catch(() => {});

    recorder.ondataavailable = event => {
      if (event.data && event.data.size > 0) {
        this.chunks.push(event.data);
      }
    };

    recorder.onerror = () => {
      this.fail(new Error('Perekaman suara gagal. Coba lagi.'));
    };

    recorder.onstop = () => {
      void this.finish(recorder.mimeType || mimeType || 'audio/webm');
    };

    try {
      recorder.start(1000);
    } catch (error) {
      const startError =
        error instanceof Error ? error : new Error('Gagal memulai perekaman suara.');
      this.settled = true;
      this.cleanupStream();
      this.rejectStop?.(startError);
      this.recorder = null;
      this.stopPromise = null;
      this.resolveStop = null;
      this.rejectStop = null;
      throw startError;
    }
  }

  async stop(): Promise<RecordedVoiceClip> {
    const recorder = this.recorder;
    const promise = this.stopPromise;
    if (!recorder || !promise) {
      throw new Error('Tidak sedang merekam suara.');
    }
    if (recorder.state !== 'inactive') {
      recorder.stop();
    }
    return promise;
  }

  cancel(): void {
    if (this.settled) return;
    this.cancelled = true;
    this.settled = true;
    const recorder = this.recorder;
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop();
      } catch {
        // Abaikan; stream tetap dibersihkan di bawah.
      }
    }
    this.cleanupStream();
    this.rejectStop?.(new Error('Perekaman dibatalkan.'));
    this.recorder = null;
    this.stopPromise = null;
    this.resolveStop = null;
    this.rejectStop = null;
  }

  private async finish(recordedMimeType: string): Promise<void> {
    if (this.settled) return;
    this.settled = true;

    const durationMs = Date.now() - this.startedAt;
    const chunks = this.chunks;
    this.chunks = [];
    this.cleanupStream();

    try {
      if (this.cancelled) return;
      const blob = new Blob(chunks, { type: recordedMimeType });
      if (blob.size === 0) {
        throw new Error('Audio kosong. Coba rekam lebih lama.');
      }

      const arrayBuffer = await blob.arrayBuffer();
      const AudioContextCtor =
        (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
          .AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) {
        throw new Error('Browser tidak bisa memproses audio.');
      }

      const ctx = new AudioContextCtor();
      let audioBuffer: AudioBuffer;
      try {
        audioBuffer = await decodeAudio(ctx, arrayBuffer);
      } finally {
        ctx.close().catch(() => {});
      }

      const mono = mixToMono(audioBuffer);
      const downsampled = downsampleBuffer(mono, audioBuffer.sampleRate, TARGET_SAMPLE_RATE);
      const wav = encodeWavBytes(downsampled, TARGET_SAMPLE_RATE);

      this.resolveStop?.({
        base64: arrayBufferToBase64(wav),
        mimeType: 'audio/wav',
        durationMs: durationMs || wavDurationMs(downsampled, TARGET_SAMPLE_RATE),
        sampleRate: TARGET_SAMPLE_RATE,
      });
    } catch (error) {
      this.rejectStop?.(error instanceof Error ? error : new Error(String(error)));
    } finally {
      this.recorder = null;
      this.stopPromise = null;
      this.resolveStop = null;
      this.rejectStop = null;
    }
  }

  private fail(error: Error): void {
    if (this.settled) return;
    this.settled = true;
    this.cleanupStream();
    this.rejectStop?.(error);
    this.recorder = null;
    this.stopPromise = null;
    this.resolveStop = null;
    this.rejectStop = null;
  }

  private cleanupStream(): void {
    this.stream?.getTracks().forEach(track => track.stop());
    this.stream = null;
  }
}
