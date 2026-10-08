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

  // 1. Seed Accounts
  const insertAcc = db.prepare(`
    INSERT INTO account (id, name, type, currency, opening_balance, icon, color, is_archived, created_at, updated_at)
    VALUES (?, ?, ?, 'IDR', ?, ?, ?, 0, ?, ?)
  `);

  insertAcc.run('acc-bca', 'BCA Utama', 'bank', 14500000, 'Landmark', '#0F172A', now, now);
  insertAcc.run('acc-gopay', 'GoPay', 'ewallet', 385000, 'Smartphone', '#334155', now, now);
  insertAcc.run('acc-cash', 'Uang Tunai', 'cash', 240000, 'Banknote', '#059669', now, now);
  insertAcc.run('acc-shopeepay', 'ShopeePay', 'ewallet', 115000, 'CreditCard', '#475569', now, now);

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

  // 3. Seed Transactions (termasuk 3 draft Inbox PRD 6.5)
  const insertTxn = db.prepare(`
    INSERT INTO txn (
      id, type, amount, account_id, to_account_id, category_id, merchant, occurred_at,
      note, status, source, external_ref, confidence, admin_fee, raw_source_text, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Drafts
  insertTxn.run('txn-draft-1', 'expense', 35000, 'acc-gopay', null, 'cat-makan', 'Soto Betawi Bang Ali', now - 35 * 60000, 'Makan siang sama teman kantor', 'draft', 'voice', null, 0.92, null, '"Makan siang soto betawi 35 ribu pakai GoPay"', now, now);
  insertTxn.run('txn-draft-2', 'expense', 54500, 'acc-bca', null, 'cat-belanja', 'Indomaret Point Sudirman', now - 3 * 3600000, 'Roti, susu oat, air mineral', 'draft', 'ocr', 'IND-994182', 0.88, null, 'Foto Struk Kasir Indomaret Point total Rp 54.500', now, now);
  insertTxn.run('txn-draft-3', 'expense', 22000, 'acc-gopay', null, 'cat-trans', 'Gojek Ride', now - 6 * 3600000, 'Transport ke kantor pagi', 'draft', 'notification', 'GK-88271', 0.96, null, 'Notifikasi: Pembayaran GoRide berhasil Rp 22.000 ke Gojek', now, now);

  // Confirmed
  insertTxn.run('txn-conf-1', 'expense', 25000, 'acc-gopay', null, 'cat-makan', 'Kopi Kenangan', now - 5 * 3600000, 'Kopi Kenangan Mantan Large', 'confirmed', 'qr', null, 0.99, null, null, now, now);
  insertTxn.run('txn-conf-2', 'expense', 14000, 'acc-bca', null, 'cat-trans', 'MRT Jakarta', now - 7 * 3600000, 'Tap in Bundaran HI - Blok M', 'confirmed', 'manual', null, 1.0, null, null, now, now);
  insertTxn.run('txn-conf-3', 'expense', 185000, 'acc-bca', null, 'cat-tagihan', 'PLN Pascabayar', now - day, 'Listrik kos bulanan', 'confirmed', 'ocr', 'PLN-202610-09', 0.95, null, null, now, now);
  insertTxn.run('txn-conf-4', 'expense', 45000, 'acc-cash', null, 'cat-makan', 'Warung Nasi Padang', now - day - 4 * 3600000, 'Ayam pop + es teh manis', 'confirmed', 'manual', null, 1.0, null, null, now, now);
  insertTxn.run('txn-conf-5', 'income', 9500000, 'acc-bca', null, 'cat-gaji', 'PT Solusi Teknologi', now - 4 * day, 'Gaji Oktober 2026', 'confirmed', 'sms', 'BCA-SAL-1026', 1.0, null, null, now, now);
  insertTxn.run('txn-conf-6', 'transfer', 500000, 'acc-bca', 'acc-gopay', null, null, now - 3 * day, 'Top up GoPay jajan', 'confirmed', 'manual', null, 1.0, 1000, null, now, now);
  insertTxn.run('txn-conf-7', 'expense', 120000, 'acc-bca', null, 'cat-hiburan', 'Cinema XXI', now - 2 * day, 'Nonton film 2 tiket + popcorn', 'confirmed', 'manual', null, 1.0, null, null, now, now);

  // 4. Seed Budget Plan & Lines
  const insertPlan = db.prepare(`
    INSERT INTO budget_plan (id, method, period, start_day, is_active, total_limit, created_at, updated_at)
    VALUES (?, ?, ?, ?, 1, ?, ?, ?)
  `);
  insertPlan.run('budget-active-1', 'category', 'monthly', 1, 5500000, now, now);

  const insertLine = db.prepare(`
    INSERT INTO budget_line (id, plan_id, category_id, name, amount, rollover)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  insertLine.run('b-line-1', 'budget-active-1', 'cat-makan', 'Makan & Minum', 2000000, 1);
  insertLine.run('b-line-2', 'budget-active-1', 'cat-trans', 'Transportasi', 750000, 0);
  insertLine.run('b-line-3', 'budget-active-1', 'cat-belanja', 'Belanja Harian', 1000000, 0);
  insertLine.run('b-line-4', 'budget-active-1', 'cat-tagihan', 'Tagihan & Utilitas', 950000, 0);
  insertLine.run('b-line-5', 'budget-active-1', 'cat-hiburan', 'Hiburan & Hobi', 500000, 0);
  insertLine.run('b-line-6', 'budget-active-1', 'cat-kesehatan', 'Kesehatan', 300000, 1);

  // 5. Seed Recurring Rules
  const insertRec = db.prepare(`
    INSERT INTO recurring_rule (
      id, name, type, amount, account_id, category_id, frequency, interval,
      day_of_month, next_run_at, mode, is_active, is_subscription, total_tenor, remaining_tenor
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, 1, ?, ?, ?)
  `);
  insertRec.run('rec-netflix', 'Netflix Premium', 'expense', 186000, 'acc-bca', 'cat-hiburan', 'monthly', 15, now + 7 * day, 'auto', 1, null, null);
  insertRec.run('rec-bpjs', 'BPJS Kesehatan Mandiri', 'expense', 150000, 'acc-bca', 'cat-kesehatan', 'monthly', 10, now + 2 * day, 'draft', 1, null, null);
  insertRec.run('rec-cicilan', 'Cicilan Gadget (iPhone)', 'expense', 1250000, 'acc-bca', 'cat-tagihan', 'monthly', 25, now + 17 * day, 'draft', 0, 12, 5);

  // 6. Seed Goals
  const insertGoal = db.prepare(`
    INSERT INTO goal (id, name, target_amount, saved_amount, due_at, account_id, auto_amount, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertGoal.run('goal-emergency', 'Dana Darurat 6 Bulan', 20000000, 14500000, now + 120 * day, 'acc-bca', 1000000, now, now);
  insertGoal.run('goal-bali', 'Liburan Akhir Tahun Bali', 6000000, 3200000, now + 75 * day, 'acc-bca', 750000, now, now);

  // 7. Seed Settings
  const insertSet = db.prepare('INSERT INTO setting (key, value) VALUES (?, ?)');
  insertSet.run('currency', 'IDR');
  insertSet.run('start_day', '1');
  insertSet.run('theme', 'light');
  insertSet.run('pin_enabled', 'false');
  insertSet.run('biometrics_enabled', 'true');
  insertSet.run('onboarding_completed', 'true');
  insertSet.run('view_mode', 'ios_frame');
}
