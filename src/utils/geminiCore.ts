export const DEFAULT_GEMINI_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
];

// Model suara: 3.6-flash terbukti paling responsif untuk audio pada kuota gratis.
export const DEFAULT_VOICE_GEMINI_MODELS = [
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.8-flash',
];

export const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export type GeminiErrorCode =
  | 'not_configured'
  | 'auth'
  | 'quota'
  | 'unavailable'
  | 'timeout'
  | 'invalid_request'
  | 'too_large'
  | 'invalid_response'
  | 'empty_response'
  | 'network'
  | 'unknown';

export interface GeminiErrorOptions {
  status?: number;
  model?: string;
  retryable?: boolean;
}

export class GeminiError extends Error {
  code: GeminiErrorCode;
  status: number;
  model?: string;
  retryable: boolean;

  constructor(message: string, code: GeminiErrorCode, options: GeminiErrorOptions = {}) {
    super(message);
    this.name = 'GeminiError';
    this.code = code;
    this.status = options.status ?? 502;
    this.model = options.model;
    this.retryable = options.retryable ?? false;
  }
}

export interface GeminiPart {
  text?: string;
  inline_data?: {
    mime_type: string;
    data: string;
  };
}

export interface GeminiRequestOptions {
  apiKey: string;
  parts: GeminiPart[];
  responseSchema: unknown;
  models?: string[];
  maxOutputTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  totalTimeoutMs?: number;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}

export interface GeminiRequestResult {
  data: unknown;
  model: string;
  rawText: string;
}

export function resolveGeminiModels(primary?: string): string[] {
  const candidates = [primary, ...DEFAULT_GEMINI_MODELS]
    .map(model => (typeof model === 'string' ? model.trim() : ''))
    .filter(Boolean);
  return Array.from(new Set(candidates));
}

export function resolveVoiceGeminiModels(primary?: string): string[] {
  const candidates = [primary, ...DEFAULT_VOICE_GEMINI_MODELS, ...DEFAULT_GEMINI_MODELS]
    .map(model => (typeof model === 'string' ? model.trim() : ''))
    .filter(Boolean);
  return Array.from(new Set(candidates));
}

interface RawResponse {
  ok: boolean;
  status: number;
  text: string;
}

async function postModel(
  model: string,
  options: GeminiRequestOptions,
  includeThinkingConfig: boolean
): Promise<RawResponse> {
  const fetchImpl = options.fetchImpl || fetch;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs ?? 18000);
  const onAbort = () => controller.abort();
  options.signal?.addEventListener('abort', onAbort);

  try {
    const generationConfig: Record<string, unknown> = {
      responseMimeType: 'application/json',
      responseSchema: options.responseSchema,
      temperature: options.temperature ?? 0,
      maxOutputTokens: options.maxOutputTokens ?? 4096,
    };
    if (includeThinkingConfig) {
      generationConfig.thinkingConfig = { thinkingBudget: 0 };
    }

    const response = await fetchImpl(
      `${GEMINI_API_BASE}/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': options.apiKey,
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: options.parts }],
          generationConfig,
        }),
      }
    );

    // Baca body di dalam timeout agar koneksi yang menggantung ikut dibatalkan.
    const text = await response.text();
    return { ok: response.ok, status: response.status, text };
  } finally {
    clearTimeout(timeoutId);
    options.signal?.removeEventListener('abort', onAbort);
  }
}

function parseGeminiResponse(body: string, model: string): { data: unknown; rawText: string } {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    throw new GeminiError('Respons Gemini bukan JSON yang valid.', 'invalid_response', {
      model,
      retryable: true,
    });
  }

  const record = payload as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
      finishReason?: string;
    }>;
    promptFeedback?: { blockReason?: string };
  };
  const candidate = record.candidates?.[0];
  const rawText = (candidate?.content?.parts || [])
    .map(part => (typeof part?.text === 'string' ? part.text : ''))
    .join('')
    .trim();

  if (!rawText) {
    const reason = candidate?.finishReason || record.promptFeedback?.blockReason || '';
    throw new GeminiError(
      `Gemini tidak mengembalikan teks${reason ? ` (${reason})` : ''}.`,
      reason === 'SAFETY' ? 'invalid_response' : 'empty_response',
      { model, retryable: reason !== 'SAFETY' }
    );
  }

  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  const jsonText = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;

  try {
    return { data: JSON.parse(jsonText), rawText: cleaned };
  } catch {
    throw new GeminiError('Format JSON dari Gemini tidak bisa dibaca.', 'invalid_response', {
      model,
      retryable: true,
    });
  }
}

export function classifyGeminiError(status: number, body: string, model: string): GeminiError {
  let message = '';
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } };
    message = parsed.error?.message || '';
  } catch {
    // Body bukan JSON; pakai pesan generik.
  }
  const safeMessage = message || `Gemini mengembalikan HTTP ${status}.`;

  // Google memakai HTTP 400 untuk kunci yang tidak valid.
  if (/api[_ ]?key[_ ]?(?:not valid|invalid|expired)|invalid api key/i.test(safeMessage)) {
    return new GeminiError(safeMessage, 'auth', { status: 401, model, retryable: false });
  }
  if (status === 400) {
    return new GeminiError(safeMessage, 'invalid_request', {
      status,
      model,
      retryable: false,
    });
  }
  if (status === 401 || status === 403) {
    return new GeminiError(safeMessage, 'auth', { status, model, retryable: false });
  }
  if (status === 404) {
    return new GeminiError(safeMessage, 'unavailable', { status, model, retryable: true });
  }
  if (status === 413) {
    return new GeminiError(safeMessage, 'too_large', { status, model, retryable: false });
  }
  if (status === 429) {
    return new GeminiError(safeMessage, 'quota', { status, model, retryable: true });
  }
  if (status >= 500) {
    return new GeminiError(safeMessage, 'unavailable', { status, model, retryable: true });
  }
  return new GeminiError(safeMessage, 'unknown', { status, model, retryable: false });
}

function toGeminiError(error: unknown, model: string): GeminiError {
  if (error instanceof GeminiError) {
    if (!error.model) error.model = model;
    return error;
  }
  const message = error instanceof Error ? error.message : String(error);
  if (/abort|timeout/i.test(message)) {
    return new GeminiError('Permintaan ke Gemini melewati batas waktu.', 'timeout', {
      model,
      retryable: true,
      status: 504,
    });
  }
  return new GeminiError(message || 'Gagal menghubungi Gemini.', 'network', {
    model,
    retryable: true,
    status: 502,
  });
}

export async function runGeminiRequest(
  options: GeminiRequestOptions
): Promise<GeminiRequestResult> {
  if (!options.apiKey || !options.apiKey.trim()) {
    throw new GeminiError('Kunci Gemini belum diatur.', 'not_configured', {
      status: 503,
      retryable: false,
    });
  }
  if (!Array.isArray(options.parts) || options.parts.length === 0) {
    throw new GeminiError('Tidak ada konten untuk dikirim ke Gemini.', 'invalid_request', {
      status: 400,
      retryable: false,
    });
  }

  const models =
    options.models && options.models.length > 0
      ? Array.from(
          new Set(
            options.models
              .map(model => (typeof model === 'string' ? model.trim() : ''))
              .filter(Boolean)
          )
        )
      : DEFAULT_GEMINI_MODELS;
  const deadline =
    options.totalTimeoutMs && options.totalTimeoutMs > 0
      ? Date.now() + options.totalTimeoutMs
      : Number.POSITIVE_INFINITY;
  let lastError: GeminiError | null = null;

  for (const model of models) {
    const remaining = deadline - Date.now();
    if (remaining <= 1000) {
      lastError =
        lastError ||
        new GeminiError('Permintaan ke Gemini melewati batas waktu.', 'timeout', {
          status: 504,
          retryable: true,
        });
      break;
    }

    const attemptOptions: GeminiRequestOptions = {
      ...options,
      timeoutMs: Math.min(options.timeoutMs ?? 18000, remaining),
    };

    let result: RawResponse;
    try {
      result = await postModel(model, attemptOptions, true);
    } catch (error) {
      lastError = toGeminiError(error, model);
      if (options.signal?.aborted) throw lastError;
      continue;
    }

    if (result.ok) {
      try {
        const parsed = parseGeminiResponse(result.text, model);
        return { data: parsed.data, model, rawText: parsed.rawText };
      } catch (error) {
        lastError = toGeminiError(error, model);
        continue;
      }
    }

    let apiError = classifyGeminiError(result.status, result.text, model);

    // Sebagian model menolak thinkingConfig. Coba sekali lagi tanpa konfigurasi itu.
    if (result.status === 400 && /thinking/i.test(result.text)) {
      const retryRemaining = deadline - Date.now();
      if (retryRemaining > 1000) {
        try {
          const retry = await postModel(
            model,
            {
              ...options,
              timeoutMs: Math.min(options.timeoutMs ?? 18000, retryRemaining),
            },
            false
          );
          if (retry.ok) {
            const parsed = parseGeminiResponse(retry.text, model);
            return { data: parsed.data, model, rawText: parsed.rawText };
          }
          apiError = classifyGeminiError(retry.status, retry.text, model);
        } catch (error) {
          apiError = toGeminiError(error, model);
        }
      }
    }

    lastError = apiError;
    if (!apiError.retryable) throw apiError;
  }

  throw (
    lastError ||
    new GeminiError('Semua model Gemini sedang tidak tersedia. Coba lagi sebentar.', 'unavailable', {
      status: 503,
      retryable: true,
    })
  );
}

export function geminiErrorMessage(error: unknown): string {
  if (error instanceof GeminiError) {
    switch (error.code) {
      case 'not_configured':
        return 'Gemini belum aktif. Tempel kunci API di Pengaturan → Gemini AI.';
      case 'auth':
        return 'Kunci Gemini tidak valid atau ditolak. Periksa di Pengaturan → Gemini AI.';
      case 'quota':
        return 'Kuota Gemini gratis sedang penuh. Coba lagi beberapa saat lagi.';
      case 'unavailable':
        return 'Model Gemini sedang sibuk. Coba lagi sebentar atau gunakan input manual.';
      case 'timeout':
        return 'Gemini terlalu lama merespons. Coba lagi dengan rekaman/foto yang lebih kecil.';
      case 'too_large':
        return 'File terlalu besar untuk Gemini. Coba foto dengan resolusi lebih kecil.';
      case 'invalid_response':
      case 'empty_response':
        return 'Gemini mengembalikan hasil yang tidak bisa dibaca. Coba lagi.';
      case 'network':
        return 'Tidak bisa menghubungi Gemini. Periksa koneksi internet.';
      default:
        return error.message || 'Gagal memproses dengan Gemini.';
    }
  }
  if (error instanceof Error) return error.message || 'Gagal memproses dengan Gemini.';
  return 'Gagal memproses dengan Gemini.';
}
