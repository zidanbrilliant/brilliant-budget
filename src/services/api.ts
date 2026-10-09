import { Account, Category, Txn, BudgetPlan, RecurringRule, Goal } from '../types/index.ts';

const BASE_URL = '/api';

export const api = {
  async getHealth() {
    const res = await fetch(`${BASE_URL}/health`);
    if (!res.ok) throw new Error('Backend offline');
    return res.json();
  },

  async getAccounts(): Promise<Account[]> {
    const res = await fetch(`${BASE_URL}/accounts`);
    if (!res.ok) throw new Error('Gagal memuat akun');
    return res.json();
  },

  async createAccount(acc: Partial<Account>): Promise<Account> {
    const res = await fetch(`${BASE_URL}/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(acc),
    });
    if (!res.ok) throw new Error('Gagal membuat dompet');
    return res.json();
  },

  async reconcileAccount(id: string, newBalance: number, note?: string) {
    const res = await fetch(`${BASE_URL}/accounts/${id}/reconcile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_balance: newBalance, note }),
    });
    if (!res.ok) throw new Error('Gagal rekonsiliasi');
    return res.json();
  },

  async getCategories(): Promise<Category[]> {
    const res = await fetch(`${BASE_URL}/categories`);
    if (!res.ok) throw new Error('Gagal memuat kategori');
    return res.json();
  },

  async createCategory(cat: Partial<Category>): Promise<Category> {
    const res = await fetch(`${BASE_URL}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cat),
    });
    if (!res.ok) throw new Error('Gagal membuat kategori');
    return res.json();
  },

  async updateCategory(id: string, updates: Partial<Category>): Promise<Category> {
    const res = await fetch(`${BASE_URL}/categories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Gagal mengubah kategori');
    return res.json();
  },

  async deleteCategory(id: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/categories/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Gagal menghapus kategori');
  },

  async getTransactions(status?: string): Promise<Txn[]> {
    const url = status ? `${BASE_URL}/transactions?status=${status}` : `${BASE_URL}/transactions`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Gagal memuat transaksi');
    return res.json();
  },

  async createTransaction(txn: Partial<Txn>): Promise<Txn> {
    const res = await fetch(`${BASE_URL}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(txn),
    });
    if (!res.ok) throw new Error('Gagal menyimpan transaksi');
    return res.json();
  },

  async updateTransaction(id: string, updates: Partial<Txn>): Promise<Txn> {
    const res = await fetch(`${BASE_URL}/transactions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Gagal mengubah transaksi');
    return res.json();
  },

  async deleteTransaction(id: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/transactions/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Gagal menghapus transaksi');
  },

  async confirmDraft(id: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/transactions/${id}/confirm`, { method: 'POST' });
    if (!res.ok) throw new Error('Gagal konfirmasi draft');
  },

  async confirmAllDrafts(): Promise<{ updated_count: number }> {
    const res = await fetch(`${BASE_URL}/transactions/drafts/confirm-all`, { method: 'POST' });
    if (!res.ok) throw new Error('Gagal konfirmasi semua draft');
    return res.json();
  },

  async getBudget(): Promise<BudgetPlan> {
    const res = await fetch(`${BASE_URL}/budget`);
    if (!res.ok) throw new Error('Gagal memuat budget');
    return res.json();
  },

  async saveBudget(plan: BudgetPlan): Promise<void> {
    const res = await fetch(`${BASE_URL}/budget`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(plan),
    });
    if (!res.ok) throw new Error('Gagal menyimpan budget');
  },

  async getRecurring(): Promise<RecurringRule[]> {
    const res = await fetch(`${BASE_URL}/recurring`);
    if (!res.ok) throw new Error('Gagal memuat recurring');
    return res.json();
  },

  async createRecurring(rule: Partial<RecurringRule>): Promise<RecurringRule> {
    const res = await fetch(`${BASE_URL}/recurring`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rule),
    });
    if (!res.ok) throw new Error('Gagal membuat recurring');
    return res.json();
  },

  async deleteRecurring(id: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/recurring/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Gagal menghapus recurring');
  },

  async getGoals(): Promise<Goal[]> {
    const res = await fetch(`${BASE_URL}/goals`);
    if (!res.ok) throw new Error('Gagal memuat target tabungan');
    return res.json();
  },

  async createGoal(goal: Partial<Goal>): Promise<Goal> {
    const res = await fetch(`${BASE_URL}/goals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(goal),
    });
    if (!res.ok) throw new Error('Gagal membuat target');
    return res.json();
  },

  async contributeGoal(id: string, amount: number): Promise<Goal> {
    const res = await fetch(`${BASE_URL}/goals/${id}/contribute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount }),
    });
    if (!res.ok) throw new Error('Gagal kontribusi tabungan');
    return res.json();
  },

  async parseVoice(text: string) {
    const res = await fetch(`${BASE_URL}/parse/voice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    return res.json();
  },

  async parseOCR(text: string) {
    const res = await fetch(`${BASE_URL}/parse/ocr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    return res.json();
  },

  async parseSMS(text: string) {
    const res = await fetch(`${BASE_URL}/parse/sms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    return res.json();
  },

  async parseQRIS(payload: string) {
    const res = await fetch(`${BASE_URL}/parse/qris`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload }),
    });
    return res.json();
  },

  async exportBackup() {
    const res = await fetch(`${BASE_URL}/backup`);
    if (!res.ok) throw new Error('Gagal ekspor backup');
    return res.json();
  },

  async restoreBackup(data: any) {
    const res = await fetch(`${BASE_URL}/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Gagal restore backup');
    return res.json();
  },
};
