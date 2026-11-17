export type AccountType = 'cash' | 'bank' | 'ewallet' | 'credit_card' | 'other';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  currency: string;
  opening_balance: number;
  icon: string;
  color: string;
  is_archived: boolean;
  created_at: number;
  updated_at: number;
}

export type CategoryKind = 'expense' | 'income';

export interface Category {
  id: string;
  parent_id?: string;
  name: string;
  kind: CategoryKind;
  icon: string;
  color: string;
  sort_order: number;
}

export type TxnType = 'expense' | 'income' | 'transfer';
export type TxnSource = 'manual' | 'voice' | 'ocr' | 'qr' | 'sms' | 'notification' | 'recurring' | 'import' | 'budget';
export type TxnStatus = 'draft' | 'confirmed';

export interface TxnItem {
  id: string;
  txn_id?: string;
  name: string;
  qty: number;
  unit_price?: number;
  total: number;
  category_id?: string;
}

export interface TxnTemplate {
  id: string;
  name: string;
  amount: number;
  category_id: string;
  account_id: string;
  merchant?: string;
  icon?: string;
}

export interface Txn {
  id: string;
  type: TxnType;
  amount: number;
  account_id: string;
  to_account_id?: string;
  category_id?: string;
  merchant?: string;
  occurred_at: number;
  note?: string;
  status: TxnStatus;
  source: TxnSource;
  external_ref?: string;
  confidence?: number;
  admin_fee?: number;
  raw_source_text?: string;
  items?: TxnItem[];
  created_at: number;
  updated_at: number;
  deleted_at?: number | null;
}

export type BudgetMethod = 'category' | 'envelope' | 'percent' | 'total';

export interface BudgetLine {
  id: string;
  category_id?: string;
  name?: string;
  amount: number;
  percent?: number;
  rollover?: boolean;
}

export interface BudgetPlan {
  id: string;
  method: BudgetMethod;
  period: 'monthly' | 'weekly';
  start_day: number;
  is_active: boolean;
  total_limit: number;
  lines: BudgetLine[];
  // Pengaturan Jatah Harian
  daily_category_id?: string;        // ID kategori yang dilacak (opsional, kosong = semua pengeluaran)
  daily_savings_account_id?: string; // ID dompet tujuan simpan sisa harian
  daily_source_account_id?: string;  // ID dompet asal transfer sisa harian
  daily_auto_save_enabled?: boolean; // default true; false = sisa harian tidak disimpan otomatis
  // Reset Siklus & Sisa Anggaran
  cycle_auto_sweep?: boolean;        // default false; true = pindah sisa anggaran otomatis saat siklus berganti
  salary_category_id?: string;       // ID kategori pemasukan gaji untuk deteksi siklus; '' = deteksi dimatikan
  cycle_settled_start?: string;      // marker 'YYYY-MM-DD' siklus berjalan yang sudah disettle
}

export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface RecurringRule {
  id: string;
  name: string;
  type: TxnType;
  amount: number;
  account_id: string;
  category_id?: string;
  frequency: RecurringFrequency;
  interval?: number;
  day_of_month?: number;
  next_run_at: number;
  mode: 'draft' | 'auto';
  is_active: boolean;
  is_subscription?: boolean;
  total_tenor?: number;
  remaining_tenor?: number;
}

export interface Goal {
  id: string;
  name: string;
  target_amount: number;
  saved_amount: number;
  due_at?: number;
  account_id?: string;
  auto_amount?: number;
}

export interface AppSettings {
  currency: string;
  start_day: number;
  theme: 'pink' | 'light' | 'dark';
  onboarding_completed: boolean;
}
