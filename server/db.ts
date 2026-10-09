import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';

// ponytail: single local sqlite db file covers 100% offline requirement. upgrade to SQLCipher if hardware keystore needed.
const DB_PATH = path.resolve(process.cwd(), 'catat.db');

export const db = new DatabaseSync(DB_PATH);

// Inisialisasi skema tabel berdasarkan PRD Bagian 9
export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS account (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      currency TEXT NOT NULL DEFAULT 'IDR',
      opening_balance INTEGER NOT NULL DEFAULT 0,
      icon TEXT,
      color TEXT,
      is_archived INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      deleted_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS category (
      id TEXT PRIMARY KEY,
      parent_id TEXT,
      name TEXT NOT NULL,
      kind TEXT NOT NULL,
      icon TEXT,
      color TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      deleted_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS txn (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      account_id TEXT NOT NULL,
      to_account_id TEXT,
      category_id TEXT,
      merchant TEXT,
      occurred_at INTEGER NOT NULL,
      note TEXT,
      status TEXT NOT NULL DEFAULT 'confirmed',
      source TEXT NOT NULL,
      external_ref TEXT,
      confidence REAL,
      admin_fee INTEGER,
      raw_source_text TEXT,
      recurring_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      deleted_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS txn_item (
      id TEXT PRIMARY KEY,
      txn_id TEXT NOT NULL,
      name TEXT NOT NULL,
      qty REAL DEFAULT 1,
      unit_price INTEGER,
      total INTEGER NOT NULL,
      category_id TEXT
    );

    CREATE TABLE IF NOT EXISTS budget_plan (
      id TEXT PRIMARY KEY,
      method TEXT NOT NULL,
      period TEXT NOT NULL DEFAULT 'monthly',
      start_day INTEGER DEFAULT 1,
      is_active INTEGER DEFAULT 1,
      total_limit INTEGER NOT NULL DEFAULT 5500000,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS budget_line (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL,
      category_id TEXT,
      name TEXT,
      amount INTEGER NOT NULL,
      percent REAL,
      rollover INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS recurring_rule (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'expense',
      amount INTEGER NOT NULL,
      account_id TEXT NOT NULL,
      category_id TEXT,
      frequency TEXT NOT NULL DEFAULT 'monthly',
      interval INTEGER DEFAULT 1,
      day_of_month INTEGER,
      next_run_at INTEGER NOT NULL,
      mode TEXT NOT NULL DEFAULT 'draft',
      is_active INTEGER DEFAULT 1,
      is_subscription INTEGER DEFAULT 0,
      total_tenor INTEGER,
      remaining_tenor INTEGER
    );

    CREATE TABLE IF NOT EXISTS goal (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      target_amount INTEGER NOT NULL,
      saved_amount INTEGER DEFAULT 0,
      due_at INTEGER,
      account_id TEXT,
      auto_amount INTEGER,
      created_at INTEGER,
      updated_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS setting (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  seedInitialDataIfEmpty();
}

function seedInitialDataIfEmpty() {
  const countStmt = db.prepare('SELECT count(*) as count FROM account');
  const countRes = countStmt.get() as { count: number };
  if (countRes.count > 0) return;

  const now = Date.now();
  const day = 86400000;

  // 1. Seed Accounts (Default Saldo Awal = 0)
  const insertAcc = db.prepare(`
    INSERT INTO account (id, name, type, currency, opening_balance, icon, color, is_archived, created_at, updated_at)
    VALUES (?, ?, ?, 'IDR', 0, ?, ?, 0, ?, ?)
  `);

  insertAcc.run('acc-bca', 'BCA Utama', 'bank', 'Landmark', '#0F172A', now, now);
  insertAcc.run('acc-gopay', 'GoPay', 'ewallet', 'Smartphone', '#334155', now, now);
  insertAcc.run('acc-cash', 'Uang Tunai', 'cash', 'Banknote', '#059669', now, now);
  insertAcc.run('acc-shopeepay', 'ShopeePay', 'ewallet', 'CreditCard', '#475569', now, now);

  // 2. Seed Categories (Minimalist 2-3 Colors)
  const insertCat = db.prepare(`
    INSERT INTO category (id, name, kind, icon, color, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertCat.run('cat-makan', 'Makan & Minum', 'expense', 'Utensils', '#1E293B', 1, now, now);
  insertCat.run('cat-trans', 'Transportasi', 'expense', 'Car', '#1E293B', 2, now, now);
  insertCat.run('cat-belanja', 'Belanja Harian', 'expense', 'ShoppingBag', '#1E293B', 3, now, now);
  insertCat.run('cat-tagihan', 'Tagihan & Utilitas', 'expense', 'Receipt', '#1E293B', 4, now, now);
  insertCat.run('cat-hiburan', 'Hiburan & Hobi', 'expense', 'Film', '#1E293B', 5, now, now);
  insertCat.run('cat-kesehatan', 'Kesehatan', 'expense', 'HeartPulse', '#1E293B', 6, now, now);
  insertCat.run('cat-pendidikan', 'Pendidikan', 'expense', 'GraduationCap', '#1E293B', 7, now, now);
  insertCat.run('cat-lainnya', 'Lainnya', 'expense', 'CircleEllipsis', '#64748B', 8, now, now);

  insertCat.run('cat-gaji', 'Gaji Pokok', 'income', 'Briefcase', '#059669', 1, now, now);
  insertCat.run('cat-bonus', 'Bonus & Freelance', 'income', 'BadgeDollarSign', '#059669', 2, now, now);
  insertCat.run('cat-invest', 'Hasil Investasi', 'income', 'TrendingUp', '#059669', 3, now, now);
  insertCat.run('cat-hadiah', 'Hadiah / Cashback', 'income', 'Gift', '#059669', 4, now, now);

  // 3. Clean Slate: Tidak ada transaksi tiruan awal (default 0 transaksi)

  // 4. Seed Budget Plan & Lines (Default 0)
  const insertPlan = db.prepare(`
    INSERT INTO budget_plan (id, method, period, start_day, is_active, total_limit, created_at, updated_at)
    VALUES (?, ?, ?, ?, 1, 0, ?, ?)
  `);
  insertPlan.run('budget-active-1', 'category', 'monthly', 1, now, now);

  const insertLine = db.prepare(`
    INSERT INTO budget_line (id, plan_id, category_id, name, amount, rollover)
    VALUES (?, ?, ?, ?, 0, ?)
  `);
  insertLine.run('b-line-1', 'budget-active-1', 'cat-makan', 'Makan & Minum', 1);
  insertLine.run('b-line-2', 'budget-active-1', 'cat-trans', 'Transportasi', 0);
  insertLine.run('b-line-3', 'budget-active-1', 'cat-belanja', 'Belanja Harian', 0);
  insertLine.run('b-line-4', 'budget-active-1', 'cat-tagihan', 'Tagihan & Utilitas', 0);
  insertLine.run('b-line-5', 'budget-active-1', 'cat-hiburan', 'Hiburan & Hobi', 0);
  insertLine.run('b-line-6', 'budget-active-1', 'cat-kesehatan', 'Kesehatan', 1);

  // 5. Seed Settings
  const insertSet = db.prepare('INSERT INTO setting (key, value) VALUES (?, ?)');
  insertSet.run('currency', 'IDR');
  insertSet.run('start_day', '1');
  insertSet.run('theme', 'light');
  insertSet.run('pin_enabled', 'false');
  insertSet.run('biometrics_enabled', 'true');
  insertSet.run('onboarding_completed', 'true');
  insertSet.run('view_mode', 'ios_frame');
}
