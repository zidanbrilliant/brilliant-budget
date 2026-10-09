import { Account, Category, Txn, BudgetPlan, RecurringRule, Goal, AppSettings } from '../types';

export const INITIAL_ACCOUNTS: Account[] = [
  {
    id: 'acc-bca',
    name: 'BCA Utama 💳',
    type: 'bank',
    currency: 'IDR',
    opening_balance: 0,
    icon: 'Landmark',
    color: '#FB7185',
    is_archived: false,
    created_at: Date.now() - 30 * 86400000,
    updated_at: Date.now(),
  },
  {
    id: 'acc-gopay',
    name: 'GoPay Jajan 🎀',
    type: 'ewallet',
    currency: 'IDR',
    opening_balance: 0,
    icon: 'Smartphone',
    color: '#F472B6',
    is_archived: false,
    created_at: Date.now() - 30 * 86400000,
    updated_at: Date.now(),
  },
  {
    id: 'acc-cash',
    name: 'Dompet Cash 👛',
    type: 'cash',
    currency: 'IDR',
    opening_balance: 0,
    icon: 'PiggyBank',
    color: '#EC4899',
    is_archived: false,
    created_at: Date.now() - 30 * 86400000,
    updated_at: Date.now(),
  },
  {
    id: 'acc-shopeepay',
    name: 'ShopeePay Cantik 🛍️',
    type: 'ewallet',
    currency: 'IDR',
    opening_balance: 0,
    icon: 'CreditCard',
    color: '#FDA4AF',
    is_archived: false,
    created_at: Date.now() - 30 * 86400000,
    updated_at: Date.now(),
  },
];

export const INITIAL_CATEGORIES: Category[] = [
  // Pengeluaran Cantik & Lucu
  { id: 'cat-makan', name: 'Jajan & Kuliner Lucu', kind: 'expense', icon: 'Cake', color: '#FB7185', sort_order: 1 },
  { id: 'cat-belanja', name: 'Shopping & OOTD', kind: 'expense', icon: 'ShoppingBag', color: '#F472B6', sort_order: 2 },
  { id: 'cat-trans', name: 'Jalan-Jalan & Ojol', kind: 'expense', icon: 'Car', color: '#FDA4AF', sort_order: 3 },
  { id: 'cat-tagihan', name: 'Tagihan & Wi-Fi', kind: 'expense', icon: 'Receipt', color: '#FB923C', sort_order: 4 },
  { id: 'cat-hiburan', name: 'Self Care & Me Time', kind: 'expense', icon: 'Flower2', color: '#C084FC', sort_order: 5 },
  { id: 'cat-kesehatan', name: 'Kesehatan & Skincare', kind: 'expense', icon: 'Heart', color: '#EC4899', sort_order: 6 },
  { id: 'cat-pendidikan', name: 'Belajar & Buku', kind: 'expense', icon: 'GraduationCap', color: '#A855F7', sort_order: 7 },
  { id: 'cat-lainnya', name: 'Lain-Lain Gemas', kind: 'expense', icon: 'Smile', color: '#F43F5E', sort_order: 8 },
  // Pemasukan
  { id: 'cat-gaji', name: 'Gaji Pokok', kind: 'income', icon: 'Briefcase', color: '#10B981', sort_order: 1 },
  { id: 'cat-bonus', name: 'Bonus & Side Hustle', kind: 'income', icon: 'BadgeDollarSign', color: '#14B8A6', sort_order: 2 },
  { id: 'cat-invest', name: 'Cuan Investasi', kind: 'income', icon: 'TrendingUp', color: '#8B5CF6', sort_order: 3 },
  { id: 'cat-hadiah', name: 'Uang Jajan & Hadiah', kind: 'income', icon: 'Gift', color: '#F472B6', sort_order: 4 },
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
    { id: 'b-line-1', category_id: 'cat-makan', name: 'Jajan & Kuliner Lucu', amount: 0, rollover: true },
    { id: 'b-line-2', category_id: 'cat-belanja', name: 'Shopping & OOTD', amount: 0, rollover: false },
    { id: 'b-line-3', category_id: 'cat-trans', name: 'Jalan-Jalan & Ojol', amount: 0, rollover: false },
    { id: 'b-line-4', category_id: 'cat-tagihan', name: 'Tagihan & Wi-Fi', amount: 0, rollover: false },
    { id: 'b-line-5', category_id: 'cat-hiburan', name: 'Self Care & Me Time', amount: 0, rollover: false },
    { id: 'b-line-6', category_id: 'cat-kesehatan', name: 'Kesehatan & Skincare', amount: 0, rollover: true },
  ],
};

export const INITIAL_RECURRING: RecurringRule[] = [];

export const INITIAL_GOALS: Goal[] = [];

export const INITIAL_SETTINGS: AppSettings = {
  currency: 'IDR',
  start_day: 1,
  theme: 'pink',
  pin_enabled: false,
  biometrics_enabled: true,
  onboarding_completed: true,
  auto_confirm_trusted: false,
  view_mode: 'ios_frame',
};
