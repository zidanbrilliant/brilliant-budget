import { Account, Category, Txn, BudgetPlan, RecurringRule, Goal } from '../types/index.ts';

const BASE_URL = '/api';

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  // ponytail: 1500ms timeout prevents hanging when deployed serverless without local node backend
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 1500);

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: options?.body ? { 'Content-Type': 'application/json', ...options?.headers } : options?.headers,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

export const api = {
  getHealth: () => req<{ status: string }>('/health'),
  getAccounts: () => req<Account[]>('/accounts'),
  createAccount: (acc: Partial<Account>) => req<Account>('/accounts', { method: 'POST', body: JSON.stringify(acc) }),
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
};
