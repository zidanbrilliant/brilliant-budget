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
export type TxnSource = 'manual' | 'voice' | 'ocr' | 'qr' | 'sms' | 'notification' | 'recurring' | 'import';
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
  theme: 'light' | 'dark';
  pin_enabled: boolean;
  pin_code?: string;
  biometrics_enabled: boolean;
  onboarding_completed: boolean;
  auto_confirm_trusted: boolean;
  view_mode: 'ios_frame' | 'responsive';
}
