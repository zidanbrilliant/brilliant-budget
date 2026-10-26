import {
  GeminiError,
  resolveGeminiModels,
  resolveVoiceGeminiModels,
  runGeminiRequest,
} from '../src/utils/geminiCore.ts';
import {
  RECEIPT_RESPONSE_SCHEMA,
  VOICE_RESPONSE_SCHEMA,
  buildReceiptPrompt,
  buildVoicePrompt,
  normalizeReceiptResult,
  normalizeVoiceResult,
  type AIContext,
} from '../src/utils/aiSchemas.ts';
import type { ParsedItem } from '../src/utils/parser.ts';

export interface ServerAIStatus {
  available: boolean;
  provider: 'gemini';
  models: string[];
  key_source: 'server' | 'none';
  reason?: string;
}

export interface ServerReceiptResult {
  result: ParsedItem;
  model: string;
}

export interface ServerVoiceResult {
  transcript: string;
  items: ParsedItem[];
  model: string;
}

export function getServerGeminiKey(): string {
  return (process.env.GEMINI_API_KEY || '').trim();
}

export function getServerGeminiModels(): string[] {
  return resolveGeminiModels(process.env.GEMINI_MODEL?.trim() || undefined);
}

export function getServerVoiceGeminiModels(): string[] {
  return resolveVoiceGeminiModels(process.env.GEMINI_VOICE_MODEL?.trim() || undefined);
}

export function isServerAIConfigured(): boolean {
  return getServerGeminiKey().length > 0;
}

export function getServerAIStatus(): ServerAIStatus {
  const configured = isServerAIConfigured();
  return {
    available: configured,
    provider: 'gemini',
    models: getServerGeminiModels(),
    key_source: configured ? 'server' : 'none',
    reason: configured ? undefined : 'no_server_key',
  };
}

let geminiFetch: typeof fetch = fetch;

/** Hanya untuk unit test: ganti transport Gemini tanpa menyentuh fetch global. */
export function setGeminiFetchForTests(fetchImpl: typeof fetch | null): void {
  geminiFetch = fetchImpl || fetch;
}

function cleanBase64(value: string): string {
  const comma = value.indexOf(',');
  if (value.startsWith('data:') && comma >= 0) return value.slice(comma + 1).replace(/\s/g, '');
  return value.replace(/\s/g, '');
}

function normalizeMimeType(value: string, fallback: string): string {
  return (value.split(';')[0] || fallback).trim().toLowerCase();
}

function requireImagePayload(imageBase64: string, mimeType: string): { data: string; mimeType: string } {
  const data = cleanBase64(imageBase64);
  if (data.length < 100) {
    throw new GeminiError('Gambar tidak valid atau kosong.', 'invalid_request', {
      status: 400,
      retryable: false,
    });
  }
  if (data.length > 12_000_000) {
    throw new GeminiError('Gambar terlalu besar. Maksimal sekitar 9 MB.', 'too_large', {
      status: 413,
      retryable: false,
    });
  }
  const normalized = normalizeMimeType(mimeType, 'image/jpeg');
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
  if (!allowed.includes(normalized)) {
    throw new GeminiError(`Format gambar ${normalized} tidak didukung.`, 'invalid_request', {
      status: 415,
      retryable: false,
    });
  }
  return { data, mimeType: normalized === 'image/jpg' ? 'image/jpeg' : normalized };
}

function requireAudioPayload(audioBase64: string, mimeType: string): { data: string; mimeType: string } {
  const data = cleanBase64(audioBase64);
  if (data.length < 100) {
    throw new GeminiError('Audio tidak valid atau kosong.', 'invalid_request', {
      status: 400,
      retryable: false,
    });
  }
  if (data.length > 8_000_000) {
    throw new GeminiError('Audio terlalu besar. Maksimal sekitar 6 MB.', 'too_large', {
      status: 413,
      retryable: false,
    });
  }
  const normalized = normalizeMimeType(mimeType, 'audio/wav');
  const allowed = [
    'audio/wav',
    'audio/x-wav',
    'audio/wave',
    'audio/mp3',
    'audio/mpeg',
    'audio/aiff',
    'audio/aac',
    'audio/ogg',
    'audio/flac',
  ];
  if (!allowed.includes(normalized)) {
    throw new GeminiError(`Format audio ${normalized} tidak didukung.`, 'invalid_request', {
      status: 415,
      retryable: false,
    });
  }
  return {
    data,
    mimeType: normalized === 'audio/x-wav' || normalized === 'audio/wave' ? 'audio/wav' : normalized,
  };
}

function requireServerKey(): string {
  const key = getServerGeminiKey();
  if (!key) {
    throw new GeminiError(
      'Gemini server belum dikonfigurasi. Tempel kunci API di Pengaturan → Gemini AI.',
      'not_configured',
      { status: 503, retryable: false }
    );
  }
  return key;
}

export async function scanReceiptWithServerAI(
  imageBase64: string,
  mimeType: string,
  context: AIContext
): Promise<ServerReceiptResult> {
  const payload = requireImagePayload(imageBase64, mimeType);
  const key = requireServerKey();

  const { data, model } = await runGeminiRequest({
    apiKey: key,
    models: getServerGeminiModels(),
    parts: [
      { text: buildReceiptPrompt(context) },
      { inline_data: { mime_type: payload.mimeType, data: payload.data } },
    ],
    responseSchema: RECEIPT_RESPONSE_SCHEMA,
    maxOutputTokens: 4096,
    timeoutMs: 18000,
    totalTimeoutMs: 50000,
    fetchImpl: geminiFetch,
  });

  return { result: normalizeReceiptResult(data, context), model };
}

export async function transcribeVoiceWithServerAI(
  audioBase64: string,
  mimeType: string,
  context: AIContext
): Promise<ServerVoiceResult> {
  const payload = requireAudioPayload(audioBase64, mimeType);
  const key = requireServerKey();

  const { data, model } = await runGeminiRequest({
    apiKey: key,
    models: getServerVoiceGeminiModels(),
    parts: [
      { text: buildVoicePrompt(context) },
      { inline_data: { mime_type: payload.mimeType, data: payload.data } },
    ],
    responseSchema: VOICE_RESPONSE_SCHEMA,
    maxOutputTokens: 2048,
    timeoutMs: 18000,
    totalTimeoutMs: 50000,
    fetchImpl: geminiFetch,
  });

  const normalized = normalizeVoiceResult(data, context);
  return { transcript: normalized.transcript, items: normalized.items, model };
}
