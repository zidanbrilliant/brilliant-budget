import {
  normalizeAIContext,
  type AIContext,
} from '../src/utils/aiSchemas.ts';
import { todayInJakarta } from '../src/utils/dateParsing.ts';
import { GeminiError } from '../src/utils/geminiCore.ts';
import {
  getServerAIStatus,
  scanReceiptWithServerAI,
  transcribeVoiceWithServerAI,
} from './gemini.ts';

export interface AIHandlerResult {
  status: number;
  body: Record<string, unknown>;
}

const FALLBACK_CONTEXT: AIContext = {
  categories: [
    { id: 'cat-makan', name: 'Makan & Minuman', kind: 'expense' },
    { id: 'cat-belanja', name: 'Belanja', kind: 'expense' },
    { id: 'cat-trans', name: 'Transport', kind: 'expense' },
    { id: 'cat-tagihan', name: 'Tagihan', kind: 'expense' },
    { id: 'cat-hiburan', name: 'Hiburan', kind: 'expense' },
    { id: 'cat-kesehatan', name: 'Kesehatan', kind: 'expense' },
    { id: 'cat-pendidikan', name: 'Pendidikan', kind: 'expense' },
    { id: 'cat-lainnya', name: 'Lainnya', kind: 'expense' },
    { id: 'cat-gaji', name: 'Gaji', kind: 'income' },
    { id: 'cat-bonus', name: 'Bonus', kind: 'income' },
    { id: 'cat-invest', name: 'Investasi', kind: 'income' },
    { id: 'cat-hadiah', name: 'Hadiah', kind: 'income' },
  ],
  accounts: [
    { id: 'acc-bca', name: 'BCA', type: 'bank' },
    { id: 'acc-gopay', name: 'GoPay', type: 'ewallet' },
    { id: 'acc-cash', name: 'Cash', type: 'cash' },
    { id: 'acc-shopeepay', name: 'ShopeePay', type: 'ewallet' },
  ],
  today: todayInJakarta(),
};

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function toHttpStatus(error: GeminiError): number {
  switch (error.code) {
    case 'not_configured':
      return 503;
    case 'auth':
      return 502;
    case 'quota':
      return 429;
    case 'too_large':
      return 413;
    case 'invalid_request':
      return 400;
    case 'timeout':
      return 504;
    case 'unavailable':
      return 503;
    default:
      return 502;
  }
}

function errorResult(error: unknown): AIHandlerResult {
  if (error instanceof GeminiError) {
    return {
      status: toHttpStatus(error),
      body: {
        error: error.message,
        code: error.code,
        model: error.model,
      },
    };
  }
  const message = error instanceof Error ? error.message : 'Gagal memproses dengan Gemini.';
  return {
    status: 502,
    body: {
      error: message,
      code: 'unknown',
    },
  };
}

export async function runAIStatus(): Promise<AIHandlerResult> {
  return { status: 200, body: { ...getServerAIStatus() } };
}

export async function runScanReceipt(body: unknown): Promise<AIHandlerResult> {
  try {
    const record = asRecord(body);
    const context = normalizeAIContext(record.context, FALLBACK_CONTEXT);
    const image = typeof record.image === 'string' ? record.image : '';
    const mimeType = typeof record.mimeType === 'string' ? record.mimeType : 'image/jpeg';
    const result = await scanReceiptWithServerAI(image, mimeType, context);
    return {
      status: 200,
      body: {
        result: result.result,
        model: result.model,
      },
    };
  } catch (error) {
    return errorResult(error);
  }
}

export async function runVoice(body: unknown): Promise<AIHandlerResult> {
  try {
    const record = asRecord(body);
    const context = normalizeAIContext(record.context, FALLBACK_CONTEXT);
    const audio = typeof record.audio === 'string' ? record.audio : '';
    const mimeType = typeof record.mimeType === 'string' ? record.mimeType : 'audio/wav';
    const result = await transcribeVoiceWithServerAI(audio, mimeType, context);
    return {
      status: 200,
      body: {
        transcript: result.transcript,
        items: result.items,
        model: result.model,
      },
    };
  } catch (error) {
    return errorResult(error);
  }
}
