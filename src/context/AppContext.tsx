import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import {
  Account,
  Category,
  Txn,
  BudgetPlan,
  RecurringRule,
  Goal,
  AppSettings,
  TxnType,
} from '../types/index.ts';
import {
  INITIAL_ACCOUNTS,
  INITIAL_CATEGORIES,
  INITIAL_TRANSACTIONS,
  INITIAL_BUDGET,
  INITIAL_RECURRING,
  INITIAL_GOALS,
  INITIAL_SETTINGS,
} from '../utils/mockData';
import { api } from '../services/api';
import {
  cascadeDeleteCategory,
  SYSTEM_CATEGORY_ID,
} from '../utils/budgetLogic.ts';
import { cascadeDeleteAccount } from '../utils/accountDeletion.ts';
import { processDueRecurringRules } from '../services/recurringScheduler';
import {
  syncTransactionToSheet,
  flushSheetQueue,
  pullTransactionsFromSheet,
  mergeSheetRows,
  getSheetWebhookUrl,
  setLastPullTime,
  isConfigSyncEnabled,
  setConfigSyncEnabled as persistConfigSyncEnabled,
  pullConfigFromSheet,
  pushConfigToSheet,
  type ConfigSnapshot,
  type ConfigSyncResult,
} from '../services/googleSheets';

const STORAGE_KEY = 'CATAT_APP_STATE_V4';

interface ToastAction {
  message: string;
  undo?: () => void;
}

interface AppContextType {
  accounts: Account[];
  categories: Category[];
  transactions: Txn[];
  budget: BudgetPlan;
  recurring: RecurringRule[];
  goals: Goal[];
  settings: AppSettings;
  activeTab: 'beranda' | 'transaksi' | 'catat' | 'budget' | 'lainnya';
  setActiveTab: (tab: 'beranda' | 'transaksi' | 'catat' | 'budget' | 'lainnya') => void;
  isCatatOpen: boolean;
  openCatat: (mode?: 'manual' | 'voice' | 'ocr' | 'screenshot' | 'qr', initialType?: TxnType) => void;
  closeCatat: () => void;
  catatInitialMode: 'manual' | 'voice' | 'ocr' | 'screenshot' | 'qr';
  catatInitialType: TxnType;
  toast: ToastAction | null;
  showToast: (message: string, undo?: () => void) => void;
  clearToast: () => void;
  isBackendConnected: boolean;
  syncFromSheet: (silent?: boolean) => Promise<number>;
  configSyncEnabled: boolean;
  setConfigSyncEnabled: (enabled: boolean) => void;
  saveConfigToSheet: () => Promise<ConfigSyncResult>;
  restoreConfigFromSheet: () => Promise<ConfigSyncResult>;

  // Calculators
  getAccountBalance: (accountId: string) => number;
  getTotalNetWorth: () => number;
  getMonthSummary: () => { income: number; expense: number; balance: number; remainingBudget: number };
  getCategorySpending: (categoryId: string) => number;

  // Actions
  addTransaction: (data: Partial<Txn>) => Txn;
  updateTransaction: (id: string, updates: Partial<Txn>) => void;
  deleteTransaction: (id: string) => void;
  confirmDraft: (id: string) => void;
  confirmAllDrafts: () => void;
  discardDraft: (id: string) => void;

  addAccount: (acc: Omit<Account, 'id' | 'created_at' | 'updated_at'>) => void;
  updateAccount: (id: string, updates: Partial<Account>) => void;
  deleteAccount: (id: string, reassignToId?: string) => void;
  adjustAccountBalance: (id: string, newBalance: number, note?: string) => void;
  addCategory: (cat: Omit<Category, 'id' | 'sort_order'>) => void;
  updateCategory: (id: string, updates: Partial<Category>) => void;
  deleteCategory: (id: string) => void;

  updateBudget: (budget: BudgetPlan) => void;
  updateBudgetLine: (categoryId: string, amount: number, rollover?: boolean) => void;
  addRecurring: (rule: Omit<RecurringRule, 'id'>) => void;
  updateRecurring: (id: string, updates: Partial<RecurringRule>) => void;
  deleteRecurring: (id: string) => void;

  addGoal: (goal: Omit<Goal, 'id'>) => void;
  updateGoal: (id: string, updates: Partial<Goal>) => void;
  deleteGoal: (id: string) => void;
  contributeToGoal: (id: string, amount: number, accountId?: string) => void;

  updateSettings: (updates: Partial<AppSettings>) => void;
  exportBackupData: () => string;
  importBackupData: (jsonStr: string) => boolean;
  resetAllData: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Load saved state or default
  const [accounts, setAccounts] = useState<Account[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY + '_accounts');
      return saved ? JSON.parse(saved) : INITIAL_ACCOUNTS;
    } catch {
      return INITIAL_ACCOUNTS;
    }
  });

  const [categories, setCategories] = useState<Category[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY + '_categories');
      return saved ? JSON.parse(saved) : INITIAL_CATEGORIES;
    } catch {
      return INITIAL_CATEGORIES;
    }
  });

  const [transactions, setTransactions] = useState<Txn[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY + '_txns');
      return saved ? JSON.parse(saved) : INITIAL_TRANSACTIONS;
    } catch {
      return INITIAL_TRANSACTIONS;
    }
  });

  const [budget, setBudget] = useState<BudgetPlan>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY + '_budget');
      return saved ? JSON.parse(saved) : INITIAL_BUDGET;
    } catch {
      return INITIAL_BUDGET;
    }
  });

  const [recurring, setRecurring] = useState<RecurringRule[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY + '_recurring');
      return saved ? JSON.parse(saved) : INITIAL_RECURRING;
    } catch {
      return INITIAL_RECURRING;
    }
  });

  const [goals, setGoals] = useState<Goal[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY + '_goals');
      return saved ? JSON.parse(saved) : INITIAL_GOALS;
    } catch {
      return INITIAL_GOALS;
    }
  });

  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY + '_settings');
      return saved ? JSON.parse(saved) : INITIAL_SETTINGS;
    } catch {
      return INITIAL_SETTINGS;
    }
  });

  // UI State
  const [activeTab, setActiveTab] = useState<'beranda' | 'transaksi' | 'catat' | 'budget' | 'lainnya'>('beranda');
  const [isCatatOpen, setIsCatatOpen] = useState(false);
  const [catatInitialMode, setCatatInitialMode] = useState<'manual' | 'voice' | 'ocr' | 'screenshot' | 'qr'>('manual');
  const [catatInitialType, setCatatInitialType] = useState<TxnType>('expense');
  const [toast, setToast] = useState<ToastAction | null>(null);
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [configSyncEnabled, setConfigSyncEnabledState] = useState<boolean>(() =>
    isConfigSyncEnabled()
  );

  // Sync to Backend if available (with offline fallback)
  useEffect(() => {
    let mounted = true;
    async function syncWithBackend() {
      try {
        const health = await api.getHealth();
        if (health && health.status === 'ok') {
          if (!mounted) return;
          setIsBackendConnected(true);

          const [bAccounts, bCategories, bTxns, bBudget, bRecurring, bGoals] = await Promise.all([
            api.getAccounts().catch(() => null),
            api.getCategories().catch(() => null),
            api.getTransactions().catch(() => null),
            api.getBudget().catch(() => null),
            api.getRecurring().catch(() => null),
            api.getGoals().catch(() => null),
          ]);

          if (bAccounts && bAccounts.length) setAccounts(bAccounts);
          if (bCategories && bCategories.length) setCategories(bCategories);
          if (bTxns && bTxns.length) setTransactions(bTxns);
          if (bBudget) setBudget(bBudget);
          if (bRecurring) setRecurring(bRecurring);
          if (bGoals) setGoals(bGoals);
        }
      } catch {
        // Fallback silently to localStorage
        if (mounted) setIsBackendConnected(false);
      }
    }
    syncWithBackend();
    return () => {
      mounted = false;
    };
  }, []);

  // Seamless 2-way Google Sheets sync
  const isSyncingFromSheet = React.useRef(false);
  const lastSheetSyncAt = React.useRef(0);

  const syncFromSheet = async (silent = true): Promise<number> => {
    const url = getSheetWebhookUrl();
    if (!url || !navigator.onLine || isSyncingFromSheet.current) return 0;

    const now = Date.now();
    if (now - lastSheetSyncAt.current < 4000) return 0;

    isSyncingFromSheet.current = true;
    lastSheetSyncAt.current = now;

    try {
      const rows = await pullTransactionsFromSheet(url);
      if (!rows || rows.length === 0) return 0;

      let added = 0;
      let updated = 0;

      setTransactions(prev => {
        const res = mergeSheetRows(prev, rows, categories, accounts);
        added = res.addedCount;
        updated = res.updatedCount;
        if (added > 0 || updated > 0) {
          if (isBackendConnected) {
            for (const t of res.merged) {
              if (!prev.some(p => p.id === t.id)) {
                api.createTransaction(t).catch(console.error);
              }
            }
          }
          return res.merged;
        }
        return prev;
      });

      setLastPullTime(Date.now());

      if (!silent) {
        if (added + updated > 0) {
          showToast(`${added} transaksi baru ditarik dari Google Sheets`);
        } else {
          showToast('Data sudah yang terbaru');
        }
      }

      return added + updated;
    } catch (err) {
      console.warn('Sync from sheet error:', err);
      if (!silent) showToast('Gagal menarik data dari Google Sheets');
      return 0;
    } finally {
      isSyncingFromSheet.current = false;
    }
  };

  // ===================== Config sync (dompet, kategori, budget, setelan) =====================
  const lastConfigPushSignature = React.useRef('');
  const configPushTimer = React.useRef<number | null>(null);

  const buildConfigSnapshot = (): ConfigSnapshot => ({
    accounts,
    categories,
    budget,
    recurring,
    goals,
    settings,
  });

  const configSignature = (snapshot: ConfigSnapshot): string =>
    JSON.stringify([
      snapshot.accounts,
      snapshot.categories,
      snapshot.budget,
      snapshot.recurring,
      snapshot.goals,
      snapshot.settings,
    ]);

  const setConfigSyncEnabled = (enabled: boolean) => {
    setConfigSyncEnabledState(enabled);
    persistConfigSyncEnabled(enabled);
    if (!enabled && configPushTimer.current !== null) {
      window.clearTimeout(configPushTimer.current);
      configPushTimer.current = null;
    }
  };

  const saveConfigToSheet = async (): Promise<ConfigSyncResult> => {
    const url = getSheetWebhookUrl();
    if (!url) {
      return { ok: false, message: 'Isi URL Webhook Google Sheets terlebih dahulu.' };
    }

    const snapshot = buildConfigSnapshot();
    const result = await pushConfigToSheet(url, snapshot);
    if (result.ok) {
      lastConfigPushSignature.current = configSignature(snapshot);
      setConfigSyncEnabled(true);
    }
    return result;
  };

  const restoreConfigFromSheet = async (): Promise<ConfigSyncResult> => {
    const url = getSheetWebhookUrl();
    if (!url) {
      return { ok: false, message: 'Isi URL Webhook Google Sheets terlebih dahulu.' };
    }
    if (navigator.onLine === false) {
      return { ok: false, message: 'Sedang offline. Sambungkan internet lalu coba lagi.' };
    }

    const pulled = await pullConfigFromSheet(url);
    if (pulled.version < 2) {
      return {
        ok: false,
        message:
          pulled.version === 1
            ? 'Skrip Apps Script masih versi lama. Perbarui kode skrip ke v2 (sheet Config), lalu Deploy ulang.'
            : 'Tidak bisa memverifikasi skrip. Pastikan URL Web App benar dan akses deployment "Anyone".',
      };
    }
    if (!pulled.config) {
      return {
        ok: false,
        message: 'Belum ada konfigurasi tersimpan di Sheets. Simpan dulu dari perangkat lama.',
      };
    }

    const config = pulled.config;
    const nextBudget = config.budget || budget;
    const nextRecurring = config.recurring || recurring;
    const nextGoals = config.goals || goals;
    // Gabungkan dengan setelan saat ini supaya field baru (mis. preferensi AI)
    // tidak hilang saat memulihkan cadangan dari versi aplikasi sebelumnya.
    const nextSettings = config.settings ? { ...settings, ...config.settings } : settings;

    // Pasang signature sebelum state berubah agar efek auto-push tidak
    // langsung mengirim balik data yang baru saja dipulihkan.
    lastConfigPushSignature.current = configSignature({
      accounts: config.accounts,
      categories: config.categories,
      budget: nextBudget,
      recurring: nextRecurring,
      goals: nextGoals,
      settings: nextSettings,
    });

    setAccounts(config.accounts);
    setCategories(config.categories);
    setBudget(nextBudget);
    setRecurring(nextRecurring);
    setGoals(nextGoals);
    setSettings(nextSettings);

    // Transaksi memakai konteks hasil restore agar nama kategori/dompet cocok.
    try {
      const rows = await pullTransactionsFromSheet(url);
      if (rows.length > 0) {
        setTransactions(prev =>
          mergeSheetRows(prev, rows, config.categories, config.accounts).merged
        );
      }
    } catch (err) {
      console.warn('Restore transaksi dari Sheets gagal:', err);
    }

    setConfigSyncEnabled(true);
    return {
      ok: true,
      message:
        'Dompet, kategori, budget, langganan, target, dan setelan berhasil dipulihkan.',
    };
  };

  // Auto-push config setelah ada perubahan nyata. Run pertama hanya dijadikan
  // baseline supaya instalasi baru tidak menimpa config lama di Sheets.
  useEffect(() => {
    if (!configSyncEnabled) return;

    const url = getSheetWebhookUrl();
    if (!url || !navigator.onLine) return;

    const snapshot = buildConfigSnapshot();
    const signature = configSignature(snapshot);

    if (!lastConfigPushSignature.current) {
      lastConfigPushSignature.current = signature;
      return;
    }
    if (signature === lastConfigPushSignature.current) return;

    configPushTimer.current = window.setTimeout(async () => {
      const result = await pushConfigToSheet(url, snapshot);
      if (result.ok) {
        lastConfigPushSignature.current = signature;
      }
    }, 1500);

    return () => {
      if (configPushTimer.current !== null) {
        window.clearTimeout(configPushTimer.current);
        configPushTimer.current = null;
      }
    };
  }, [accounts, categories, budget, recurring, goals, settings, configSyncEnabled]);

  // Seamless Auto-Sync Google Sheets in background
  useEffect(() => {
    syncFromSheet(true).catch(console.error);

    const handleOnline = () => {
      flushSheetQueue().then(count => {
        if (count > 0) showToast(`${count} transaksi disinkron ke Google Sheets`);
      }).catch(console.error);
      syncFromSheet(true).catch(console.error);
    };
    window.addEventListener('online', handleOnline);
    if (navigator.onLine) handleOnline();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        syncFromSheet(true).catch(console.error);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);

    const timer = setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        syncFromSheet(true).catch(console.error);
      }
    }, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
      clearInterval(timer);
    };
  }, [categories, accounts]);

  // Sync to localStorage as offline mirror
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY + '_accounts', JSON.stringify(accounts));
  }, [accounts]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY + '_categories', JSON.stringify(categories));
  }, [categories]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY + '_txns', JSON.stringify(transactions));
  }, [transactions]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY + '_budget', JSON.stringify(budget));
  }, [budget]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY + '_recurring', JSON.stringify(recurring));
  }, [recurring]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY + '_goals', JSON.stringify(goals));
  }, [goals]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY + '_settings', JSON.stringify(settings));
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('theme-light');
      document.documentElement.classList.remove('theme-pink');
    } else if (settings.theme === 'light') {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('theme-light');
      document.documentElement.classList.remove('theme-pink');
    } else {
      // Default: Soft Pink Cute
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.remove('theme-light');
      document.documentElement.classList.add('theme-pink');
    }
  }, [settings]);

  // Toast handler
  const showToast = (message: string, undo?: () => void) => {
    setToast({ message, undo });
    setTimeout(() => {
      setToast(prev => (prev?.message === message ? null : prev));
    }, 4500);
  };

  const clearToast = () => setToast(null);

  const openCatat = (
    mode: 'manual' | 'voice' | 'ocr' | 'screenshot' | 'qr' = 'manual',
    initialType: TxnType = 'expense'
  ) => {
    setCatatInitialMode(mode);
    setCatatInitialType(initialType);
    setIsCatatOpen(true);
  };

  const closeCatat = () => {
    setIsCatatOpen(false);
  };

  // Saldo Dompet dihitung dari opening_balance + transaksi (PRD 9 & 10)
  const getAccountBalance = (accountId: string): number => {
    const acc = accounts.find(a => a.id === accountId);
    if (!acc) return 0;
    let balance = acc.opening_balance;

    for (const t of transactions) {
      if (t.deleted_at || t.status === 'draft') continue;
      if (t.type === 'expense' && t.account_id === accountId) {
        balance -= t.amount;
      } else if (t.type === 'income' && t.account_id === accountId) {
        balance += t.amount;
      } else if (t.type === 'transfer') {
        if (t.account_id === accountId) {
          balance -= t.amount;
          if (t.admin_fee) balance -= t.admin_fee;
        }
        if (t.to_account_id === accountId) {
          balance += t.amount;
        }
      }
    }
    return balance;
  };

  const getTotalNetWorth = (): number => {
    return accounts.reduce((acc, curr) => acc + getAccountBalance(curr.id), 0);
  };

  // Pengeluaran per kategori bulan berjalan
  const getCategorySpending = (categoryId: string): number => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return transactions
      .filter(t => {
        if (t.deleted_at || t.status === 'draft') return false;
        if (t.type !== 'expense') return false;
        if (t.category_id !== categoryId) return false;
        const d = new Date(t.occurred_at);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      })
      .reduce((sum, t) => sum + t.amount, 0);
  };

  // Ringkasan bulan berjalan
  const getMonthSummary = () => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let income = 0;
    let expense = 0;

    for (const t of transactions) {
      if (t.deleted_at || t.status === 'draft') continue;
      const d = new Date(t.occurred_at);
      if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
        if (t.type === 'income') income += t.amount;
        if (t.type === 'expense') expense += t.amount;
      }
    }

    const remainingBudget = Math.max(0, budget.total_limit - expense);

    return {
      income,
      expense,
      balance: income - expense,
      remainingBudget,
    };
  };

  // Transactions Actions
  const addTransaction = (data: Partial<Txn>): Txn => {
    const newTxn: Txn = {
      id: data.id || 'txn-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      type: data.type || 'expense',
      amount: data.amount || 0,
      account_id: data.account_id || accounts[0]?.id || 'acc-bca',
      to_account_id: data.to_account_id,
      category_id: data.category_id,
      merchant: data.merchant,
      occurred_at: data.occurred_at || Date.now(),
      note: data.note,
      status: data.status || 'confirmed',
      source: data.source || 'manual',
      external_ref: data.external_ref,
      confidence: data.confidence ?? 1.0,
      admin_fee: data.admin_fee,
      raw_source_text: data.raw_source_text,
      items: data.items,
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    setTransactions(prev => [newTxn, ...prev]);
    showToast(newTxn.status === 'draft' ? 'Disimpan ke Inbox Draft' : 'Transaksi berhasil dicatat');

    // Async sync to backend
    if (isBackendConnected) {
      api.createTransaction(newTxn).catch(console.error);
    }

    // Async sync to Google Sheets
    if (newTxn.status === 'confirmed') {
      const catName = categories.find(c => c.id === newTxn.category_id)?.name || 'Lainnya';
      const accName = accounts.find(a => a.id === newTxn.account_id)?.name || 'Dompet';
      const dateStr = new Date(newTxn.occurred_at).toLocaleString('sv-SE');
      syncTransactionToSheet({
        id: newTxn.id,
        date: dateStr,
        type: newTxn.type,
        category: catName,
        amount: newTxn.amount,
        account: accName,
        note: newTxn.merchant ? `${newTxn.merchant} ${newTxn.note ? `(${newTxn.note})` : ''}`.trim() : (newTxn.note || '-'),
        source: newTxn.source,
      }).catch(console.error);
    }

    return newTxn;
  };

  const updateTransaction = (id: string, updates: Partial<Txn>) => {
    const prevTxn = transactions.find(t => t.id === id);
    if (!prevTxn) return;

    setTransactions(prev =>
      prev.map(t => (t.id === id ? { ...t, ...updates, updated_at: Date.now() } : t))
    );

    if (isBackendConnected) {
      api.updateTransaction(id, updates).catch(console.error);
    }

    const updatedTxn = { ...prevTxn, ...updates };
    if (updatedTxn.status === 'confirmed') {
      const catName = categories.find(c => c.id === updatedTxn.category_id)?.name || 'Lainnya';
      const accName = accounts.find(a => a.id === updatedTxn.account_id)?.name || 'Dompet';
      const dateStr = new Date(updatedTxn.occurred_at).toLocaleString('sv-SE');
      syncTransactionToSheet({
        id: updatedTxn.id,
        date: dateStr,
        type: updatedTxn.type,
        category: catName,
        amount: updatedTxn.amount,
        account: accName,
        note: updatedTxn.merchant ? `${updatedTxn.merchant} ${updatedTxn.note ? `(${updatedTxn.note})` : ''}`.trim() : (updatedTxn.note || '-'),
        source: updatedTxn.source,
      }).catch(console.error);
    }

    showToast('Perubahan disimpan', () => {
      setTransactions(p => p.map(t => (t.id === id ? prevTxn : t)));
      if (isBackendConnected) api.updateTransaction(id, prevTxn).catch(console.error);
    });
  };

  const deleteTransaction = (id: string) => {
    const target = transactions.find(t => t.id === id);
    if (!target) return;

    setTransactions(prev => prev.filter(t => t.id !== id));
    if (isBackendConnected) {
      api.deleteTransaction(id).catch(console.error);
    }

    showToast('Transaksi dihapus', () => {
      setTransactions(prev => [target, ...prev]);
      if (isBackendConnected) api.createTransaction(target).catch(console.error);
    });
  };

  const confirmDraft = (id: string) => {
    const target = transactions.find(t => t.id === id);
    setTransactions(prev =>
      prev.map(t => (t.id === id ? { ...t, status: 'confirmed', updated_at: Date.now() } : t))
    );
    if (isBackendConnected) {
      api.confirmDraft(id).catch(console.error);
    }
    if (target) {
      const catName = categories.find(c => c.id === target.category_id)?.name || 'Lainnya';
      const accName = accounts.find(a => a.id === target.account_id)?.name || 'Dompet';
      const dateStr = new Date(target.occurred_at).toLocaleString('sv-SE');
      syncTransactionToSheet({
        id: target.id,
        date: dateStr,
        type: target.type,
        category: catName,
        amount: target.amount,
        account: accName,
        note: target.merchant ? `${target.merchant} ${target.note ? `(${target.note})` : ''}`.trim() : (target.note || '-'),
        source: target.source,
      }).catch(console.error);
    }
    showToast('Draft dikonfirmasi');
  };

  const confirmAllDrafts = () => {
    const pendingDrafts = transactions.filter(t => t.status === 'draft' && !t.deleted_at);
    if (pendingDrafts.length === 0) return;
    setTransactions(prev =>
      prev.map(t => (t.status === 'draft' ? { ...t, status: 'confirmed', updated_at: Date.now() } : t))
    );
    if (isBackendConnected) {
      api.confirmAllDrafts().catch(console.error);
    }
    pendingDrafts.forEach(d => {
      const catName = categories.find(c => c.id === d.category_id)?.name || 'Lainnya';
      const accName = accounts.find(a => a.id === d.account_id)?.name || 'Dompet';
      const dateStr = new Date(d.occurred_at).toLocaleString('sv-SE');
      syncTransactionToSheet({
        id: d.id,
        date: dateStr,
        type: d.type,
        category: catName,
        amount: d.amount,
        account: accName,
        note: d.merchant ? `${d.merchant} ${d.note ? `(${d.note})` : ''}`.trim() : (d.note || '-'),
        source: d.source,
      }).catch(console.error);
    });
    showToast(`${pendingDrafts.length} draft berhasil dikonfirmasi`);
  };

  const discardDraft = (id: string) => {
    deleteTransaction(id);
  };

  // Account actions
  const addAccount = (acc: Omit<Account, 'id' | 'created_at' | 'updated_at'>) => {
    const newAcc: Account = {
      ...acc,
      id: 'acc-' + Date.now(),
      created_at: Date.now(),
      updated_at: Date.now(),
    };
    setAccounts(prev => [...prev, newAcc]);
    if (isBackendConnected) {
      api.createAccount(newAcc).catch(console.error);
    }
    showToast(`Dompet ${newAcc.name} ditambahkan`);
  };

  const addCategory = (cat: Omit<Category, 'id' | 'sort_order'>) => {
    const newCat: Category = {
      ...cat,
      id: 'cat-' + Date.now(),
      sort_order: categories.length + 1,
    };
    setCategories(prev => [...prev, newCat]);
    if (isBackendConnected) {
      api.createCategory(newCat).catch(console.error);
    }
    showToast(`Kategori ${newCat.name} dibuat`);
  };

  const updateCategory = (id: string, updates: Partial<Category>) => {
    setCategories(prev =>
      prev.map(c => (c.id === id ? { ...c, ...updates, updated_at: Date.now() } : c))
    );
    if (isBackendConnected) {
      api.updateCategory(id, updates).catch(console.error);
    }
    showToast('Kategori diperbarui');
  };

  const deleteCategory = (id: string) => {
    const result = cascadeDeleteCategory(categories, id, transactions, budget.lines);
    if (!result.success) {
      showToast(result.error || 'Gagal menghapus kategori');
      return;
    }

    setCategories(result.updatedCategories);
    setTransactions(result.updatedTransactions);

    const nextLines = result.updatedBudgetLines;
    const nextTotal = budget.total_limit;

    const nextBudget: BudgetPlan = {
      ...budget,
      lines: nextLines,
      total_limit: nextTotal,
    };
    setBudget(nextBudget);

    if (isBackendConnected) {
      api.deleteCategory(id).catch(console.error);
      api.saveBudget(nextBudget).catch(console.error);
    }

    const note =
      result.reassignedTxnCount > 0
        ? `Kategori dihapus (${result.reassignedTxnCount} transaksi dialihkan ke Lainnya)`
        : 'Kategori dihapus';
    showToast(note);
  };

  const updateBudgetLine = (categoryId: string, amount: number, rollover?: boolean) => {
    const cat = categories.find(c => c.id === categoryId);
    let lineExists = false;
    const updatedLines = budget.lines.map(line => {
      if (line.category_id === categoryId) {
        lineExists = true;
        return {
          ...line,
          amount: Math.max(0, amount),
          rollover: rollover !== undefined ? rollover : line.rollover,
        };
      }
      return line;
    });

    if (!lineExists && cat) {
      updatedLines.push({
        id: 'b-line-' + Date.now(),
        category_id: categoryId,
        name: cat.name,
        amount: Math.max(0, amount),
        rollover: rollover || false,
      });
    }

    const nextTotal = budget.total_limit;

    const nextBudget: BudgetPlan = {
      ...budget,
      lines: updatedLines,
      total_limit: nextTotal,
    };

    updateBudget(nextBudget);
  };

  const updateAccount = (id: string, updates: Partial<Account>) => {
    setAccounts(prev =>
      prev.map(a => (a.id === id ? { ...a, ...updates, updated_at: Date.now() } : a))
    );
  };

  const deleteAccount = (id: string, reassignToId?: string) => {
    const result = cascadeDeleteAccount(
      accounts,
      id,
      transactions,
      recurring,
      goals,
      reassignToId
    );

    if (!result.success) {
      showToast(result.error || 'Gagal menghapus dompet');
      return;
    }

    const deletedName = accounts.find(a => a.id === id)?.name || 'Dompet';
    const targetName =
      accounts.find(a => a.id === result.reassignedTo)?.name || 'dompet tujuan';

    setAccounts(result.updatedAccounts);
    setTransactions(result.updatedTransactions);
    setRecurring(result.updatedRecurring);
    setGoals(result.updatedGoals);

    if (isBackendConnected) {
      api.deleteAccount(id, result.reassignedTo).catch(console.error);
    }

    showToast(
      result.reassignedTxnCount > 0
        ? `${deletedName} dihapus, ${result.reassignedTxnCount} transaksi dipindahkan ke ${targetName}`
        : `${deletedName} dihapus`
    );
  };

  // Rekonsiliasi / Penyesuaian Saldo (FR-30)
  const adjustAccountBalance = (id: string, newBalance: number, note?: string) => {
    const current = getAccountBalance(id);
    const diff = newBalance - current;
    if (diff === 0) return;

    // Catat transaksi koreksi saldo
    const type: TxnType = diff > 0 ? 'income' : 'expense';
    addTransaction({
      type,
      amount: Math.abs(diff),
      account_id: id,
      note: note || `Koreksi Saldo (${diff > 0 ? '+' : '-'}${Math.abs(diff).toLocaleString('id-ID')})`,
      category_id: 'cat-lainnya',
      source: 'manual',
      status: 'confirmed',
    });

    if (isBackendConnected) {
      api.reconcileAccount(id, newBalance, note).catch(console.error);
    }
    showToast(`Saldo berhasil disesuaikan ke ${newBalance.toLocaleString('id-ID')}`);
  };

  // Budget actions
  const updateBudget = (newBudget: BudgetPlan) => {
    setBudget(newBudget);
    if (isBackendConnected) {
      api.saveBudget(newBudget).catch(console.error);
    }
    showToast('Pengaturan budget diperbarui');
  };

  // Recurring actions
  const addRecurring = (rule: Omit<RecurringRule, 'id'>) => {
    const newRule: RecurringRule = {
      ...rule,
      id: 'rec-' + Date.now(),
    };
    setRecurring(prev => [...prev, newRule]);
    if (isBackendConnected) {
      api.createRecurring(newRule).catch(console.error);
    }
    showToast(`Pengingat ${newRule.name} ditambahkan`);
  };

  const updateRecurring = (id: string, updates: Partial<RecurringRule>) => {
    setRecurring(prev => prev.map(r => (r.id === id ? { ...r, ...updates } : r)));
    if (isBackendConnected) {
      api.updateRecurring(id, updates).catch(console.error);
    }
    showToast('Transaksi berulang diperbarui');
  };

  const deleteRecurring = (id: string) => {
    setRecurring(prev => prev.filter(r => r.id !== id));
    if (isBackendConnected) {
      api.deleteRecurring(id).catch(console.error);
    }
    showToast('Transaksi berulang dihapus');
  };

  // Auto-execute recurring rules when due
  useEffect(() => {
    const runScheduler = () => {
      setRecurring(prevRules => {
        return processDueRecurringRules(prevRules, txnData => {
          addTransaction(txnData);
        });
      });
    };

    runScheduler();
    const timer = setInterval(runScheduler, 30000);
    return () => clearInterval(timer);
  }, [accounts]);

  // Goals actions
  const addGoal = (goal: Omit<Goal, 'id'>) => {
    const newGoal: Goal = {
      ...goal,
      id: 'goal-' + Date.now(),
    };
    setGoals(prev => [...prev, newGoal]);
    if (isBackendConnected) {
      api.createGoal(newGoal).catch(console.error);
    }
    showToast(`Target ${newGoal.name} dibuat`);
  };

  const updateGoal = (id: string, updates: Partial<Goal>) => {
    setGoals(prev => prev.map(g => (g.id === id ? { ...g, ...updates } : g)));
    if (isBackendConnected) {
      api.updateGoal(id, updates).catch(console.error);
    }
    showToast('Target tabungan diperbarui');
  };

  const deleteGoal = (id: string) => {
    setGoals(prev => prev.filter(g => g.id !== id));
    if (isBackendConnected) {
      api.deleteGoal(id).catch(console.error);
    }
    showToast('Target tabungan dihapus');
  };

  const contributeToGoal = (id: string, amount: number, accountId?: string) => {
    const target = goals.find(g => g.id === id);
    if (!target) return;
    const debitAccountId = accountId || target.account_id || accounts[0]?.id || 'acc-bca';

    setGoals(prev =>
      prev.map(g => (g.id === id ? { ...g, saved_amount: g.saved_amount + amount } : g))
    );

    addTransaction({
      type: 'expense',
      amount,
      category_id: 'cat-lainnya',
      account_id: debitAccountId,
      merchant: `Tabungan: ${target.name}`,
      note: `Setor tabungan impian: ${target.name}`,
      source: 'manual',
      status: 'confirmed',
    });

    if (isBackendConnected) {
      api.contributeGoal(id, amount).catch(console.error);
    }
    showToast(`Berhasil menambah tabungan Rp ${amount.toLocaleString('id-ID')}`);
  };

  // Settings
  const updateSettings = (updates: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  };

  // Backup & Restore (FR-55)
  const exportBackupData = (): string => {
    const payload = {
      version: '0.1.0-sqlite',
      exported_at: Date.now(),
      accounts,
      categories,
      transactions,
      budget,
      recurring,
      goals,
      settings,
    };
    return JSON.stringify(payload, null, 2);
  };

  const importBackupData = (jsonStr: string): boolean => {
    try {
      const data = JSON.parse(jsonStr);
      if (!data.accounts || !data.transactions) return false;
      if (data.accounts) setAccounts(data.accounts);
      if (data.categories) setCategories(data.categories);
      if (data.transactions) setTransactions(data.transactions);
      if (data.budget) setBudget(data.budget);
      if (data.recurring) setRecurring(data.recurring);
      if (data.goals) setGoals(data.goals);
      if (data.settings) setSettings(data.settings);

      if (isBackendConnected) {
        api.restoreBackup(data).catch(console.error);
      }
      showToast('Data berhasil dipulihkan dari file backup!');
      return true;
    } catch {
      return false;
    }
  };

  const resetAllData = () => {
    // Jangan biarkan reset lokal menimpa config di Sheets secara otomatis.
    setConfigSyncEnabled(false);
    lastConfigPushSignature.current = '';
    setAccounts(INITIAL_ACCOUNTS);
    setCategories(INITIAL_CATEGORIES);
    setTransactions(INITIAL_TRANSACTIONS);
    setBudget(INITIAL_BUDGET);
    setRecurring(INITIAL_RECURRING);
    setGoals(INITIAL_GOALS);
    setSettings(INITIAL_SETTINGS);
    showToast('Data dikembalikan ke setelan awal');
  };

  return (
    <AppContext.Provider
      value={{
        accounts,
        categories,
        transactions,
        budget,
        recurring,
        goals,
        settings,
        activeTab,
        setActiveTab,
        isCatatOpen,
        openCatat,
        closeCatat,
        catatInitialMode,
        catatInitialType,
        toast,
        showToast,
        clearToast,
        isBackendConnected,
        syncFromSheet,
        configSyncEnabled,
        setConfigSyncEnabled,
        saveConfigToSheet,
        restoreConfigFromSheet,
        getAccountBalance,
        getTotalNetWorth,
        getMonthSummary,
        getCategorySpending,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        confirmDraft,
        confirmAllDrafts,
        discardDraft,
        addAccount,
        updateAccount,
        deleteAccount,
        adjustAccountBalance,
        addCategory,
        updateCategory,
        deleteCategory,
        updateBudget,
        updateBudgetLine,
        addRecurring,
        updateRecurring,
        deleteRecurring,
        addGoal,
        updateGoal,
        deleteGoal,
        contributeToGoal,
        updateSettings,
        exportBackupData,
        importBackupData,
        resetAllData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};
