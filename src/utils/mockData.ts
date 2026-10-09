import { Account, Category, Txn, BudgetPlan, RecurringRule, Goal, AppSettings } from '../types';

export const INITIAL_ACCOUNTS: Account[] = [
  {
    id: 'acc-bca',
    name: 'BCA Utama',
    type: 'bank',
    currency: 'IDR',
    opening_balance: 0,
    icon: 'Landmark',
    color: '#0F172A',
    is_archived: false,
    created_at: Date.now() - 30 * 86400000,
    updated_at: Date.now(),
  },
  {
    id: 'acc-gopay',
    name: 'GoPay',
    type: 'ewallet',
    currency: 'IDR',
    opening_balance: 0,
    icon: 'Smartphone',
    color: '#334155',
    is_archived: false,
    created_at: Date.now() - 30 * 86400000,
    updated_at: Date.now(),
  },
  {
    id: 'acc-cash',
    name: 'Uang Tunai',
    type: 'cash',
    currency: 'IDR',
    opening_balance: 0,
    icon: 'Banknote',
    color: '#059669',
    is_archived: false,
    created_at: Date.now() - 30 * 86400000,
    updated_at: Date.now(),
  },
  {
    id: 'acc-shopeepay',
    name: 'ShopeePay',
    type: 'ewallet',
    currency: 'IDR',
    opening_balance: 0,
    icon: 'CreditCard',
    color: '#475569',
    is_archived: false,
    created_at: Date.now() - 30 * 86400000,
    updated_at: Date.now(),
  },
];

export const INITIAL_CATEGORIES: Category[] = [
  // Pengeluaran (Clean Elegant Monochrome Slate)
  { id: 'cat-makan', name: 'Makan & Minum', kind: 'expense', icon: 'Utensils', color: '#1E293B', sort_order: 1 },
  { id: 'cat-trans', name: 'Transportasi', kind: 'expense', icon: 'Car', color: '#1E293B', sort_order: 2 },
  { id: 'cat-belanja', name: 'Belanja Harian', kind: 'expense', icon: 'ShoppingBag', color: '#1E293B', sort_order: 3 },
  { id: 'cat-tagihan', name: 'Tagihan & Utilitas', kind: 'expense', icon: 'Receipt', color: '#1E293B', sort_order: 4 },
  { id: 'cat-hiburan', name: 'Hiburan & Hobi', kind: 'expense', icon: 'Film', color: '#1E293B', sort_order: 5 },
  { id: 'cat-kesehatan', name: 'Kesehatan', kind: 'expense', icon: 'HeartPulse', color: '#1E293B', sort_order: 6 },
  { id: 'cat-pendidikan', name: 'Pendidikan', kind: 'expense', icon: 'GraduationCap', color: '#1E293B', sort_order: 7 },
  { id: 'cat-lainnya', name: 'Lainnya', kind: 'expense', icon: 'CircleEllipsis', color: '#64748B', sort_order: 8 },
  // Pemasukan (Signature Forest Emerald)
  { id: 'cat-gaji', name: 'Gaji Pokok', kind: 'income', icon: 'Briefcase', color: '#059669', sort_order: 1 },
  { id: 'cat-bonus', name: 'Bonus & Freelance', kind: 'income', icon: 'BadgeDollarSign', color: '#059669', sort_order: 2 },
  { id: 'cat-invest', name: 'Hasil Investasi', kind: 'income', icon: 'TrendingUp', color: '#059669', sort_order: 3 },
  { id: 'cat-hadiah', name: 'Hadiah / Cashback', kind: 'income', icon: 'Gift', color: '#059669', sort_order: 4 },
];

// Clean slate: Default nominal transaksi adalah 0 (kosong)
export const INITIAL_TRANSACTIONS: Txn[] = [];

export const INITIAL_BUDGET: BudgetPlan = {
  id: 'budget-active-1',
  method: 'category',
  period: 'monthly',
  start_day: 1,
  is_active: true,
  total_limit: 0,
  lines: [
    { id: 'b-line-1', category_id: 'cat-makan', name: 'Makan & Minum', amount: 0, rollover: true },
    { id: 'b-line-2', category_id: 'cat-trans', name: 'Transportasi', amount: 0, rollover: false },
    { id: 'b-line-3', category_id: 'cat-belanja', name: 'Belanja Harian', amount: 0, rollover: false },
    { id: 'b-line-4', category_id: 'cat-tagihan', name: 'Tagihan & Utilitas', amount: 0, rollover: false },
    { id: 'b-line-5', category_id: 'cat-hiburan', name: 'Hiburan & Hobi', amount: 0, rollover: false },
    { id: 'b-line-6', category_id: 'cat-kesehatan', name: 'Kesehatan', amount: 0, rollover: true },
  ],
};

export const INITIAL_RECURRING: RecurringRule[] = [];

export const INITIAL_GOALS: Goal[] = [];

export const INITIAL_SETTINGS: AppSettings = {
  currency: 'IDR',
  start_day: 1,
  theme: 'light',
  pin_enabled: false,
  biometrics_enabled: true,
  onboarding_completed: true,
  auto_confirm_trusted: false,
  view_mode: 'ios_frame',
};
