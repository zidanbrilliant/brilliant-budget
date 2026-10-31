import type { Account, Category, Txn, BudgetPlan, RecurringRule, Goal } from '../types/index.ts';
import type { ParsedItem } from '../utils/parser.ts';
import type { AIContext } from '../utils/aiSchemas.ts';

const BASE_URL = '/api';
const DEFAULT_TIMEOUT_MS = 1500;
const AI_TIMEOUT_MS = 65000;

export interface AIStatusResponse {
  available: boolean;
  provider: string;
  models: string[];
  key_source?: 'server' | 'none' | string;
  reason?: string;
}

export interface AIScanReceiptResponse {
  result: ParsedItem;
  model: string;
}

export interface AIVoiceResponse {
  transcript: string;
  items: ParsedItem[];
  model: string;
}

async function req<T>(
  path: string,
  options?: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<T> {
  // Timeout pendek mencegah UI menggantung saat backend tidak tersedia.
  // Endpoint AI memakai timeout panjang karena Gemini butuh beberapa detik.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: options?.body ? { 'Content-Type': 'application/json', ...options?.headers } : options?.headers,
    });
    if (!res.ok) {
      let message = `HTTP ${res.status}`;
      let code: string | undefined;
      try {
        const body = await res.json();
        if (body && typeof body === 'object') {
          message = body.error || body.message || message;
          code = body.code;
        }
      } catch {
        // Body error bukan JSON; pakai pesan HTTP.
      }
      const error = new Error(message) as Error & { status?: number; code?: string };
      error.status = res.status;
      error.code = code;
      throw error;
    }
    if (res.status === 204) return undefined as T;
    return res.json();
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      const timeoutError = new Error('Permintaan melewati batas waktu') as Error & { code?: string };
      timeoutError.code = 'timeout';
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export const api = {
  getHealth: () => req<{ status: string }>('/health'),
  getAccounts: () => req<Account[]>('/accounts'),
  createAccount: (acc: Partial<Account>) => req<Account>('/accounts', { method: 'POST', body: JSON.stringify(acc) }),
  deleteAccount: (id: string, reassignToId?: string) =>
    req<{ success: boolean; reassigned_to: string }>(
      `/accounts/${id}${reassignToId ? `?reassign_to=${encodeURIComponent(reassignToId)}` : ''}`,
      { method: 'DELETE' }
    ),
  reconcileAccount: (id: string, newBalance: number, note?: string) =>
    req<{ success: boolean; balance: number }>(`/accounts/${id}/reconcile`, { method: 'POST', body: JSON.stringify({ new_balance: newBalance, note }) }),
  getCategories: () => req<Category[]>('/categories'),
  createCategory: (cat: Partial<Category>) => req<Category>('/categories', { method: 'POST', body: JSON.stringify(cat) }),
  updateCategory: (id: string, updates: Partial<Category>) =>
    req<Category>(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(updates) }),
  deleteCategory: (id: string) => req<void>(`/categories/${id}`, { method: 'DELETE' }),
  getTransactions: (status?: string) => req<Txn[]>(status ? `/transactions?status=${status}` : '/transactions'),
  createTransaction: (txn: Partial<Txn>) => req<Txn>('/transactions', { method: 'POST', body: JSON.stringify(txn) }),
  updateTransaction: (id: string, updates: Partial<Txn>) =>
    req<Txn>(`/transactions/${id}`, { method: 'PUT', body: JSON.stringify(updates) }),
  deleteTransaction: (id: string) => req<void>(`/transactions/${id}`, { method: 'DELETE' }),
  confirmDraft: (id: string) => req<void>(`/transactions/${id}/confirm`, { method: 'POST' }),
  confirmAllDrafts: () => req<{ updated_count: number }>('/transactions/drafts/confirm-all', { method: 'POST' }),
  getBudget: () => req<BudgetPlan>('/budget'),
  saveBudget: (plan: BudgetPlan) => req<void>('/budget', { method: 'PUT', body: JSON.stringify(plan) }),
  getRecurring: () => req<RecurringRule[]>('/recurring'),
  createRecurring: (rule: Partial<RecurringRule>) => req<RecurringRule>('/recurring', { method: 'POST', body: JSON.stringify(rule) }),
  updateRecurring: (id: string, updates: Partial<RecurringRule>) =>
    req<void>(`/recurring/${id}`, { method: 'PUT', body: JSON.stringify(updates) }),
  deleteRecurring: (id: string) => req<void>(`/recurring/${id}`, { method: 'DELETE' }),
  getGoals: () => req<Goal[]>('/goals'),
  createGoal: (goal: Partial<Goal>) => req<Goal>('/goals', { method: 'POST', body: JSON.stringify(goal) }),
  updateGoal: (id: string, goal: Partial<Goal>) => req<Goal>(`/goals/${id}`, { method: 'PUT', body: JSON.stringify(goal) }),
  deleteGoal: (id: string) => req<{ success: boolean }>(`/goals/${id}`, { method: 'DELETE' }),
  contributeGoal: (id: string, amount: number) => req<Goal>(`/goals/${id}/contribute`, { method: 'POST', body: JSON.stringify({ amount }) }),
  exportBackup: () => req<any>('/backup'),
  restoreBackup: (data: any) => req<any>('/restore', { method: 'POST', body: JSON.stringify(data) }),
  resetData: () => req<{ success: boolean }>('/reset', { method: 'POST' }),

  // Gemini AI (server proxy). Kunci API tetap di server; klien tidak pernah menerimanya.
  getAIStatus: () => req<AIStatusResponse>('/ai/status', undefined, 6000),
  scanReceipt: (payload: { image: string; mimeType: string; context: AIContext }) =>
    req<AIScanReceiptResponse>(
      '/ai/scan-receipt',
      { method: 'POST', body: JSON.stringify(payload) },
      AI_TIMEOUT_MS
    ),
  voice: (payload: { audio: string; mimeType: string; context: AIContext }) =>
    req<AIVoiceResponse>(
      '/ai/voice',
      { method: 'POST', body: JSON.stringify(payload) },
      AI_TIMEOUT_MS
    ),
};
