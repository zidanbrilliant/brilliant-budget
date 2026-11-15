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
  getBudgetPeriod,
  calculateDailyBudgetSummary,
  type DailyBudgetSummary,
  type BudgetPeriod,
} from '../utils/budgetLogic.ts';
import { cascadeDeleteAccount } from '../utils/accountDeletion.ts';
import { processDueRecurringRules } from '../services/recurringScheduler';
import {
  syncTransactionToSheet,
  flushSheetQueue,
  pullTransactionsFromSheet,
  mergeSheetRows,
  formatTxnForSheetPayload,
  getSheetWebhookUrl,
  setLastPullTime,
  isConfigSyncEnabled,
  setConfigSyncEnabled as persistConfigSyncEnabled,
  clearSheetSyncState,
  pullConfigFromSheet,
  pushConfigToSheet,
  getLastConfigUpdatedAt,
  setLastConfigUpdatedAt,
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
  openCatat: (mode?: 'manual' | 'voice' | 'ocr' | 'screenshot', initialType?: TxnType) => void;
  closeCatat: () => void;
  catatInitialMode: 'manual' | 'voice' | 'ocr' | 'screenshot';
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
  getMonthSummary: () => {
    income: number;
    expense: number;
    balance: number;
    remainingBudget: number;
    period?: BudgetPeriod;
  };
  getDailyBudgetSummary: () => DailyBudgetSummary;
  getCategorySpending: (categoryId: string) => number;
  saveDailyRemainder: () => Txn | null; // Transfer sisa harian ke dompet tabungan

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
  storageWarning: string | null;
  dismissStorageWarning: () => void;
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

  const transactionsRef = React.useRef<Txn[]>(transactions);
  useEffect(() => {
    transactionsRef.current = transactions;
  }, [transactions]);

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
  const [catatInitialMode, setCatatInitialMode] = useState<'manual' | 'voice' | 'ocr' | 'screenshot'>('manual');
  const [catatInitialType, setCatatInitialType] = useState<TxnType>('expense');
  const [toast, setToast] = useState<ToastAction | null>(null);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const dismissStorageWarning = () => setStorageWarning(null);
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [configSyncEnabled, setConfigSyncEnabledState] = useState<boolean>(() =>
    isConfigSyncEnabled()
  );

  // Sovereignty flag: treat local storage as source of truth on initial boot
  const [hasLocalStateOnMount] = useState<boolean>(() => {
    try {
      return (
        localStorage.getItem(STORAGE_KEY + '_txns') !== null ||
        localStorage.getItem(STORAGE_KEY + '_accounts') !== null ||
        localStorage.getItem(STORAGE_KEY + '_categories') !== null ||
        localStorage.getItem(STORAGE_KEY + '_init') !== null
      );
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY + '_init', '1');
    } catch {}
  }, []);

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

          // Safeguard: Backend adalah mirror/dev server opsional.
          // Jika penyimpanan lokal sudah terinisialisasi, data lokal adalah sovereign.
          if (!hasLocalStateOnMount) {
            if (bAccounts && bAccounts.length) setAccounts(bAccounts);
            if (bCategories && bCategories.length) setCategories(bCategories);
            if (bTxns && bTxns.length) setTransactions(bTxns);
            if (bBudget) setBudget(bBudget);
            if (bRecurring) setRecurring(bRecurring);
            if (bGoals) setGoals(bGoals);
          }
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
  }, [hasLocalStateOnMount]);

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
      let activeCategories = categories;
      let activeAccounts = accounts;

      if (configSyncEnabled) {
        try {
          const pulled = await pullConfigFromSheet(url);
          if (pulled.version >= 2) {
            if (pulled.config) {
              const localUpdated = getLastConfigUpdatedAt();
              if (pulled.updatedAt > localUpdated) {
                const cfg = pulled.config;
                const nextBudget = cfg.budget || budget;
                const nextRecurring = cfg.recurring || recurring;
                const nextGoals = cfg.goals || goals;
                const nextSettings = cfg.settings ? { ...settings, ...cfg.settings } : settings;

                lastConfigPushSignature.current = configSignature({
                  accounts: cfg.accounts,
                  categories: cfg.categories,
                  budget: nextBudget,
                  recurring: nextRecurring,
                  goals: nextGoals,
                  settings: nextSettings,
                });

                setAccounts(cfg.accounts);
                setCategories(cfg.categories);
                setBudget(nextBudget);
                setRecurring(nextRecurring);
                setGoals(nextGoals);
                setSettings(nextSettings);
                setLastConfigUpdatedAt(pulled.updatedAt);

                activeCategories = cfg.categories;
                activeAccounts = cfg.accounts;
              }
            } else if (!lastConfigPushSignature.current) {
              const snapshot = buildConfigSnapshot();
              pushConfigToSheet(url, snapshot).catch(console.error);
            }
          }
        } catch (err) {
          console.warn('Config pull error during sync:', err);
        }
      }

      const rows = await pullTransactionsFromSheet(url);
      if (!rows || rows.length === 0) return 0;

      let added = 0;
      let updated = 0;

      setTransactions(prev => {
        const res = mergeSheetRows(prev, rows, activeCategories, activeAccounts);
        added = res.addedCount;
        updated = res.updatedCount;

        if (res.newAccounts && res.newAccounts.length > 0) {
          setAccounts(curr => {
            const existingIds = new Set(curr.map(a => a.id));
            const existingNames = new Set(curr.map(a => a.name.toLowerCase()));
            const toAdd = res.newAccounts!.filter(
              a => !existingIds.has(a.id) && !existingNames.has(a.name.toLowerCase())
            );
            if (toAdd.length === 0) return curr;
            if (isBackendConnected) {
              toAdd.forEach(a => api.createAccount(a).catch(console.error));
            }
            return [...curr, ...toAdd];
          });
        }

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
    setLastConfigUpdatedAt(pulled.updatedAt || Date.now());

    // Transaksi memakai konteks hasil restore agar nama kategori/dompet cocok.
    try {
      const rows = await pullTransactionsFromSheet(url);
      if (rows.length > 0) {
        setTransactions(prev => {
          const res = mergeSheetRows(prev, rows, config.categories, config.accounts);
          if (res.newAccounts && res.newAccounts.length > 0) {
            setAccounts(curr => {
              const existingIds = new Set(curr.map(a => a.id));
              const existingNames = new Set(curr.map(a => a.name.toLowerCase()));
              const toAdd = res.newAccounts!.filter(
                a => !existingIds.has(a.id) && !existingNames.has(a.name.toLowerCase())
              );
              return toAdd.length > 0 ? [...curr, ...toAdd] : curr;
            });
          }
          return res.merged;
        });
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

  // Helper penyimpan aman (tahan QuotaExceededError)
  const safeSetStorage = (key: string, value: unknown) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err: any) {
      const isQuota =
        err?.name === 'QuotaExceededError' ||
        err?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        err?.code === 22 ||
        err?.code === 1014;
      if (isQuota) {
        setStorageWarning(
          'Penyimpanan browser penuh. Sebagian data terbaru mungkin belum tersimpan secara persisten. Silakan ekspor cadangan data Anda.'
        );
      }
      console.warn(`Penyimpanan lokal penuh atau gagal untuk key "${key}":`, err);
    }
  };

  // Sync to localStorage as offline mirror
  useEffect(() => {
    safeSetStorage(STORAGE_KEY + '_accounts', accounts);
  }, [accounts]);
  useEffect(() => {
    safeSetStorage(STORAGE_KEY + '_categories', categories);
  }, [categories]);
  useEffect(() => {
    safeSetStorage(STORAGE_KEY + '_txns', transactions);
  }, [transactions]);
  useEffect(() => {
    safeSetStorage(STORAGE_KEY + '_budget', budget);
  }, [budget]);
  useEffect(() => {
    safeSetStorage(STORAGE_KEY + '_recurring', recurring);
  }, [recurring]);
  useEffect(() => {
    safeSetStorage(STORAGE_KEY + '_goals', goals);
  }, [goals]);
  useEffect(() => {
    safeSetStorage(STORAGE_KEY + '_settings', settings);
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
    mode: 'manual' | 'voice' | 'ocr' | 'screenshot' = 'manual',
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

  // Pengeluaran per kategori periode berjalan (sesuai siklus budget & start_day)
  const getCategorySpending = (categoryId: string): number => {
    const period = getBudgetPeriod(budget.start_day);
    const startTs = period.startDate.getTime();
    const endTs = period.endDate.getTime();

    return transactions
      .filter(t => {
        if (t.deleted_at || t.status === 'draft') return false;
        if (t.type !== 'expense') return false;
        if (t.category_id !== categoryId) return false;
        return t.occurred_at >= startTs && t.occurred_at <= endTs;
      })
      .reduce((sum, t) => sum + t.amount, 0);
  };

  // Ringkasan periode berjalan (sesuai siklus budget & tanggal gajian)
  const getMonthSummary = () => {
    const period = getBudgetPeriod(budget.start_day);
    const startTs = period.startDate.getTime();
    const endTs = period.endDate.getTime();

    let income = 0;
    let expense = 0;

    for (const t of transactions) {
      if (t.deleted_at || t.status === 'draft') continue;
      if (t.occurred_at >= startTs && t.occurred_at <= endTs) {
        if (t.type === 'income') income += t.amount;
        if (t.type === 'expense') expense += t.amount;
      }
    }

    const remainingBudget = Math.max(0, (budget.total_limit || 0) - expense);

    return {
      income,
      expense,
      balance: income - expense,
      remainingBudget,
      period,
    };
  };

  // Ringkasan budget harian & proyeksi belanja akhir periode (FR-40)
  const getDailyBudgetSummary = (): DailyBudgetSummary => {
    const period = getBudgetPeriod(budget.start_day);
    const summary = getMonthSummary();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const categoryId = budget.daily_category_id;
    const categoryLabel = categoryId
      ? (categories.find(c => c.id === categoryId)?.name)
      : undefined;
    const isCategoryMode = !!categoryId;

    // Budget yang dilacak: jika mode kategori, ambil limit dari budget.lines
    // untuk kategori tersebut; jika tidak ada limit khusus, gunakan total_limit
    let trackedBudget = budget.total_limit || 0;
    let trackedSpentInPeriod = summary.expense;

    if (isCategoryMode && categoryId) {
      const catLine = budget.lines.find(l => l.category_id === categoryId);
      if (catLine && catLine.amount > 0) {
        trackedBudget = catLine.amount;
      }
      // Hitung pengeluaran kategori dalam periode aktif
      trackedSpentInPeriod = transactions
        .filter(t => {
          if (t.deleted_at || t.status === 'draft') return false;
          if (t.type !== 'expense') return false;
          if (t.category_id !== categoryId) return false;
          return t.occurred_at >= period.startDate.getTime() && t.occurred_at <= period.endDate.getTime();
        })
        .reduce((sum, t) => sum + t.amount, 0);
    }

    // Pengeluaran hari ini — filter per kategori jika mode aktif
    const todaySpent = transactions
      .filter(t => {
        if (t.deleted_at || t.status === 'draft') return false;
        if (t.type !== 'expense') return false;
        if (isCategoryMode && t.category_id !== categoryId) return false;
        return t.occurred_at >= todayStart.getTime() && t.occurred_at <= todayEnd.getTime();
      })
      .reduce((sum, t) => sum + t.amount, 0);

    return calculateDailyBudgetSummary({
      totalBudget: trackedBudget,
      spentInPeriod: trackedSpentInPeriod,
      todaySpent,
      period,
      categoryLabel,
      isCategoryMode,
    });
  };

  /**
   * Membuat transaksi Transfer dari dompet asal ke dompet tabungan
   * sebesar sisa budget harian hari ini.
   * Mengembalikan Txn baru, atau null jika kondisi belum terpenuhi.
   */
  const saveDailyRemainder = (): Txn | null => {
    const savingsAccountId = budget.daily_savings_account_id;
    const sourceAccountId = budget.daily_source_account_id;
    if (!savingsAccountId || !sourceAccountId) return null;
    if (savingsAccountId === sourceAccountId) return null;

    const summary = getDailyBudgetSummary();
    if (!summary.canSaveRemainder || summary.todayRemaining <= 0) return null;

    // Cek apakah sudah ada simpan hari ini (idempotency)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    const alreadySaved = transactions.some(
      t =>
        t.type === 'transfer' &&
        t.account_id === sourceAccountId &&
        t.to_account_id === savingsAccountId &&
        t.note === 'Tabungan harian otomatis' &&
        !t.deleted_at &&
        t.occurred_at >= todayStart.getTime() &&
        t.occurred_at <= todayEnd.getTime()
    );
    if (alreadySaved) return null;

    return addTransaction({
      type: 'transfer',
      amount: Math.round(summary.todayRemaining),
      account_id: sourceAccountId,
      to_account_id: savingsAccountId,
      category_id: 'cat-lainnya',
      note: 'Tabungan harian otomatis',
      occurred_at: Date.now(),
      status: 'confirmed',
    });
  };

  // Transactions Actions
  const addTransaction = (data: Partial<Txn>): Txn => {
    // Idempotency: jangan buat duplikat jika external_ref sudah tercatat
    if (data.external_ref) {
      const existing = transactionsRef.current.find(t => t.external_ref === data.external_ref);
      if (existing) {
        return existing;
      }
    }

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

    setTransactions(prev => {
      if (data.external_ref && prev.some(t => t.external_ref === data.external_ref)) {
        return prev;
      }
      const updated = [newTxn, ...prev];
      transactionsRef.current = updated;
      return updated;
    });
    showToast(newTxn.status === 'draft' ? 'Disimpan ke Inbox Draft' : 'Transaksi berhasil dicatat');

    // Async sync to backend
    if (isBackendConnected) {
      api.createTransaction(newTxn).catch(console.error);
    }

    // Async sync to Google Sheets
    if (newTxn.status === 'confirmed') {
      syncTransactionToSheet(formatTxnForSheetPayload(newTxn, categories, accounts)).catch(console.error);
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
      syncTransactionToSheet(formatTxnForSheetPayload(updatedTxn, categories, accounts)).catch(console.error);
    }

    showToast('Perubahan disimpan', () => {
      setTransactions(p => p.map(t => (t.id === id ? prevTxn : t)));
      if (isBackendConnected) api.updateTransaction(id, prevTxn).catch(console.error);
    });
  };

  const deleteTransaction = (id: string) => {
    const target = transactions.find(t => t.id === id);
    if (!target) return;

    setTransactions(prev =>
      prev.map(t => (t.id === id ? { ...t, deleted_at: Date.now(), updated_at: Date.now() } : t))
    );
    if (isBackendConnected) {
      api.deleteTransaction(id).catch(console.error);
    }

    if (target.status === 'confirmed') {
      syncTransactionToSheet({
        ...formatTxnForSheetPayload(target, categories, accounts),
        action: 'delete',
      }).catch(console.error);
    }

    showToast('Transaksi dihapus', () => {
      setTransactions(prev =>
        prev.map(t => (t.id === id ? { ...t, deleted_at: null, updated_at: Date.now() } : t))
      );
      if (isBackendConnected) api.createTransaction(target).catch(console.error);
      if (target.status === 'confirmed') {
        syncTransactionToSheet(formatTxnForSheetPayload(target, categories, accounts, 'save')).catch(console.error);
      }
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
      const confirmedTarget = { ...target, status: 'confirmed' as const };
      syncTransactionToSheet(formatTxnForSheetPayload(confirmedTarget, categories, accounts)).catch(console.error);
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
      const confirmedD = { ...d, status: 'confirmed' as const };
      syncTransactionToSheet(formatTxnForSheetPayload(confirmedD, categories, accounts)).catch(console.error);
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
    if (isBackendConnected) {
      api.updateAccount(id, updates).catch(console.error);
    }
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
        return processDueRecurringRules(
          prevRules,
          txnData => {
            addTransaction(txnData);
          },
          transactionsRef.current
        );
      });
    };

    runScheduler();
    const timer = setInterval(runScheduler, 30000);
    return () => clearInterval(timer);
  }, [accounts]);

  // Auto-simpan sisa harian saat berganti hari (cek setiap menit)
  useEffect(() => {
    if (!budget.daily_savings_account_id || !budget.daily_source_account_id) return;

    let lastCheckedDate = new Date().toDateString();

    const checkAndSaveRemainder = () => {
      const today = new Date().toDateString();
      // Hanya jalankan saat tanggal berganti (tengah malam)
      if (today !== lastCheckedDate) {
        lastCheckedDate = today;
        // Simpan sisa hari kemarin (masih dalam window 00:00)
        // saveDailyRemainder() sudah handle idempotency via note + tanggal
        const result = saveDailyRemainder();
        if (result) {
          console.info('[DailyBudget] Sisa harian otomatis disimpan:', result.amount);
        }
      }
    };

    const timer = setInterval(checkAndSaveRemainder, 60000); // cek tiap menit
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budget.daily_savings_account_id, budget.daily_source_account_id]);

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
      if (typeof jsonStr !== 'string' || jsonStr.length > 15 * 1024 * 1024) return false;
      const data = JSON.parse(jsonStr);
      if (!data || typeof data !== 'object') return false;

      // Validasi ketat schema agar data rusak/malformed ditolak
      if (!Array.isArray(data.accounts) || !Array.isArray(data.transactions)) {
        return false;
      }

      const seenAccIds = new Set<string>();
      const isValidAccounts = data.accounts.every((a: any) => {
        if (!a || typeof a.id !== 'string' || !a.id.trim() || typeof a.name !== 'string' || !a.name.trim()) return false;
        if (seenAccIds.has(a.id)) return false;
        seenAccIds.add(a.id);
        return true;
      });

      const seenTxnIds = new Set<string>();
      const isValidTxns = data.transactions.every((t: any) => {
        if (
          !t ||
          typeof t.id !== 'string' ||
          !t.id.trim() ||
          typeof t.amount !== 'number' ||
          !Number.isFinite(t.amount) ||
          t.amount <= 0
        ) {
          return false;
        }
        if (seenTxnIds.has(t.id)) return false;
        seenTxnIds.add(t.id);
        return true;
      });

      if (!isValidAccounts || !isValidTxns) {
        return false;
      }

      // Snapshot untuk opsi pembatalan (Undo)
      const previousSnapshot = exportBackupData();
      try {
        localStorage.setItem('bb_backup_undo_snapshot', previousSnapshot);
      } catch {}

      if (data.accounts) setAccounts(data.accounts);
      if (Array.isArray(data.categories)) setCategories(data.categories);
      if (data.transactions) setTransactions(data.transactions);
      if (data.budget && typeof data.budget === 'object') setBudget(data.budget);
      if (Array.isArray(data.recurring)) setRecurring(data.recurring);
      if (Array.isArray(data.goals)) setGoals(data.goals);
      if (data.settings && typeof data.settings === 'object') setSettings(data.settings);

      if (isBackendConnected) {
        api.restoreBackup(data).catch(console.error);
      }

      showToast('Data berhasil dipulihkan dari cadangan', () => {
        importBackupData(previousSnapshot);
      });
      return true;
    } catch {
      return false;
    }
  };

  const resetAllData = () => {
    // 1. Matikan config sync dan bersihkan antrean Sheets
    setConfigSyncEnabled(false);
    clearSheetSyncState();
    lastConfigPushSignature.current = '';

    // 2. Bersihkan local storage keys
    try {
      localStorage.removeItem(STORAGE_KEY + '_accounts');
      localStorage.removeItem(STORAGE_KEY + '_categories');
      localStorage.removeItem(STORAGE_KEY + '_txns');
      localStorage.removeItem(STORAGE_KEY + '_budget');
      localStorage.removeItem(STORAGE_KEY + '_recurring');
      localStorage.removeItem(STORAGE_KEY + '_goals');
      localStorage.removeItem(STORAGE_KEY + '_settings');
      localStorage.removeItem('bb_backup_undo_snapshot');
      localStorage.setItem(STORAGE_KEY + '_init', '1');
    } catch {}

    // 3. Reset state memori ke nilai awal
    setAccounts(INITIAL_ACCOUNTS);
    setCategories(INITIAL_CATEGORIES);
    setTransactions(INITIAL_TRANSACTIONS);
    setBudget(INITIAL_BUDGET);
    setRecurring(INITIAL_RECURRING);
    setGoals(INITIAL_GOALS);
    setSettings(INITIAL_SETTINGS);

    // 4. Bersihkan database backend mirror jika terkoneksi
    if (isBackendConnected) {
      api.resetData().catch(console.error);
    }

    showToast('Semua data berhasil direset ke setelan awal');
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
        getDailyBudgetSummary,
        getCategorySpending,
        saveDailyRemainder,
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
        storageWarning,
        dismissStorageWarning,
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
