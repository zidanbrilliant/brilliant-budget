import { api, type AIStatusResponse } from './api.ts';
import {
  DEFAULT_GEMINI_MODELS,
  GEMINI_API_BASE,
  GeminiError,
  classifyGeminiError,
  geminiErrorMessage,
  resolveVoiceGeminiModels,
  runGeminiRequest,
} from '../utils/geminiCore.ts';
import {
  RECEIPT_RESPONSE_SCHEMA,
  VOICE_RESPONSE_SCHEMA,
  buildReceiptPrompt,
  buildVoicePrompt,
  normalizeReceiptResult,
  normalizeVoiceResult,
  type AIContext,
} from '../utils/aiSchemas.ts';
import type { ParsedItem } from '../utils/parser.ts';

const GEMINI_KEY_STORAGE = 'brilliant_budget_gemini_key_v1';
const STATUS_TTL_MS = 60000;

export interface AIStatus {
  available: boolean;
  provider: 'gemini';
  models: string[];
  key_source: 'server' | 'byok' | 'none';
  server_available: boolean;
  reason?: string;
}

export interface AIReceiptScanResult {
  result: ParsedItem;
  model: string;
  source: 'byok' | 'server';
}

export interface AIVoiceTranscriptionResult {
  transcript: string;
  items: ParsedItem[];
  model: string;
  source: 'byok' | 'server';
}

let cachedStatus: { at: number; status: AIStatus } | null = null;

function safeLocalStorage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function getStoredGeminiKey(): string {
  try {
    return (safeLocalStorage()?.getItem(GEMINI_KEY_STORAGE) || '').trim();
  } catch {
    return '';
  }
}

export function setStoredGeminiKey(key: string): void {
  const trimmed = key.trim();
  const storage = safeLocalStorage();
  if (!storage) return;
  if (trimmed) storage.setItem(GEMINI_KEY_STORAGE, trimmed);
  else storage.removeItem(GEMINI_KEY_STORAGE);
  cachedStatus = null;
}

export function clearStoredGeminiKey(): void {
  try {
    safeLocalStorage()?.removeItem(GEMINI_KEY_STORAGE);
  } catch {
    // Abaikan bila storage diblokir.
  }
  cachedStatus = null;
}

export function maskGeminiKey(key: string): string {
  const trimmed = key.trim();
  if (!trimmed) return '';
  if (trimmed.length <= 12) return '••••••••';
  return `${trimmed.slice(0, 6)}••••••${trimmed.slice(-4)}`;
}

export function invalidateAIStatus(): void {
  cachedStatus = null;
}

function mergeStatus(server: AIStatusResponse | null, storedKey: string): AIStatus {
  const serverAvailable = Boolean(server?.available);
  const models =
    Array.isArray(server?.models) && server.models.length > 0
      ? server.models
      : DEFAULT_GEMINI_MODELS;
  return {
    available: serverAvailable || Boolean(storedKey),
    provider: 'gemini',
    models,
    key_source: storedKey ? 'byok' : serverAvailable ? 'server' : 'none',
    server_available: serverAvailable,
    reason: server?.reason,
  };
}

export async function getAIStatus(force = false): Promise<AIStatus> {
  const storedKey = getStoredGeminiKey();
  if (
    !force &&
    cachedStatus &&
    Date.now() - cachedStatus.at < STATUS_TTL_MS &&
    Boolean(storedKey) === Boolean(cachedStatus.status.key_source === 'byok')
  ) {
    return cachedStatus.status;
  }

  let server: AIStatusResponse | null = null;
  try {
    server = await api.getAIStatus();
  } catch {
    server = null;
  }

  const status = mergeStatus(server, storedKey);
  if (!server && !storedKey) {
    status.reason = 'server_unreachable';
  }
  cachedStatus = { at: Date.now(), status };
  return status;
}

export async function isAIAvailable(): Promise<boolean> {
  if (getStoredGeminiKey()) return true;
  const status = await getAIStatus();
  return status.available;
}

function splitDataUrl(value: string): { mimeType: string; data: string } {
  const match = /^data:([^;]+);base64,([\s\S]+)$/i.exec(value);
  if (match) {
    return { mimeType: match[1].toLowerCase(), data: match[2] };
  }
  return { mimeType: 'image/jpeg', data: value };
}

export async function scanReceiptWithAI(
  imageDataUrl: string,
  context: AIContext
): Promise<AIReceiptScanResult> {
  const { mimeType, data } = splitDataUrl(imageDataUrl);
  if (!data || data.length < 100) {
    throw new GeminiError('Gambar struk tidak valid atau kosong.', 'invalid_request', {
      status: 400,
      retryable: false,
    });
  }

  const storedKey = getStoredGeminiKey();
  if (storedKey) {
    const { data: raw, model } = await runGeminiRequest({
      apiKey: storedKey,
      parts: [
        { text: buildReceiptPrompt(context) },
        { inline_data: { mime_type: mimeType, data } },
      ],
      responseSchema: RECEIPT_RESPONSE_SCHEMA,
      maxOutputTokens: 4096,
      timeoutMs: 18000,
      totalTimeoutMs: 55000,
    });
    return {
      result: normalizeReceiptResult(raw, context),
      model,
      source: 'byok',
    };
  }

  const response = await api.scanReceipt({ image: data, mimeType, context });
  return { result: response.result, model: response.model, source: 'server' };
}

export async function transcribeVoiceWithAI(
  audioBase64: string,
  mimeType: string,
  context: AIContext
): Promise<AIVoiceTranscriptionResult> {
  if (!audioBase64 || audioBase64.length < 100) {
    throw new GeminiError('Rekaman suara tidak valid atau kosong.', 'invalid_request', {
      status: 400,
      retryable: false,
    });
  }

  const storedKey = getStoredGeminiKey();
  if (storedKey) {
    const { data, model } = await runGeminiRequest({
      apiKey: storedKey,
      models: resolveVoiceGeminiModels(),
      parts: [
        { text: buildVoicePrompt(context) },
        { inline_data: { mime_type: mimeType || 'audio/wav', data: audioBase64 } },
      ],
      responseSchema: VOICE_RESPONSE_SCHEMA,
      maxOutputTokens: 2048,
      timeoutMs: 18000,
      totalTimeoutMs: 55000,
    });
    const normalized = normalizeVoiceResult(data, context);
    return {
      transcript: normalized.transcript,
      items: normalized.items,
      model,
      source: 'byok',
    };
  }

  const response = await api.voice({ audio: audioBase64, mimeType, context });
  return { ...response, source: 'server' };
}

export async function testGeminiKey(key: string): Promise<string> {
  const trimmed = key.trim();
  if (!trimmed) {
    throw new GeminiError('Kunci Gemini masih kosong.', 'not_configured', {
      status: 400,
      retryable: false,
    });
  }

  // Validasi lewat daftar model: cepat, tidak memakai kuota generate, dan
  // sekaligus memastikan model Flash yang dipakai aplikasi memang tersedia.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${GEMINI_API_BASE}?pageSize=200`, {
      method: 'GET',
      headers: { 'x-goog-api-key': trimmed },
      signal: controller.signal,
    });
    const body = await response.text();
    if (!response.ok) {
      throw classifyGeminiError(response.status, body, 'models-list');
    }

    let payload: { models?: Array<{ name?: string }> } = {};
    try {
      payload = JSON.parse(body) as { models?: Array<{ name?: string }> };
    } catch {
      throw new GeminiError('Respons daftar model Gemini tidak bisa dibaca.', 'invalid_response', {
        status: 502,
        retryable: false,
      });
    }

    const available = new Set(
      (payload.models || [])
        .map(entry => (entry.name || '').replace(/^models\//, '').trim())
        .filter(Boolean)
    );
    const preferred = resolveVoiceGeminiModels();
    const model = preferred.find(candidate => available.has(candidate));
    if (!model) {
      throw new GeminiError(
        'Kunci valid, tetapi model Gemini Flash tidak tersedia untuk akun ini.',
        'unavailable',
        { status: 503, retryable: false }
      );
    }
    return model;
  } catch (error) {
    if (error instanceof GeminiError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    if (/abort|timeout/i.test(message)) {
      throw new GeminiError('Uji kunci melewati batas waktu.', 'timeout', {
        status: 504,
        retryable: true,
      });
    }
    throw new GeminiError(message || 'Gagal menghubungi Gemini.', 'network', {
      status: 502,
      retryable: true,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export { GeminiError, geminiErrorMessage };
