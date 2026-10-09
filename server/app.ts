import express, { type Request, type Response } from 'express';
import cors from 'cors';
import { db, initDatabase } from './db.ts';
import {
  parseVoiceInput,
  parseOCRText,
  parseQRISCode,
} from '../src/utils/parser.ts';

initDatabase();

export const app = express();
app.use(cors());
app.use(express.json());

// Health & Info
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', offline: true, database: 'SQLite (PRD Section 9)' });
});

// Helper: Calculate account balances in SQLite (PRD 9 & 10)
function calculateAccountBalance(accountId: string): number {
  const acc = db.prepare('SELECT opening_balance FROM account WHERE id = ?').get(accountId) as { opening_balance: number } | undefined;
  if (!acc) return 0;
  let balance = acc.opening_balance;

  const txns = db.prepare(`
    SELECT type, amount, account_id, to_account_id, admin_fee
    FROM txn
    WHERE (account_id = ? OR to_account_id = ?) AND status = 'confirmed' AND deleted_at IS NULL
  `).all(accountId, accountId) as Array<{
    type: string;
    amount: number;
    account_id: string;
    to_account_id?: string;
    admin_fee?: number;
  }>;

  for (const t of txns) {
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
}

// ---------------- ACCOUNTS ----------------
app.get('/api/accounts', (_req: Request, res: Response) => {
  const accounts = db.prepare(`
    SELECT * FROM account WHERE is_archived = 0 AND deleted_at IS NULL ORDER BY created_at ASC
  `).all() as any[];

  const withBalances = accounts.map(a => ({
    ...a,
    is_archived: Boolean(a.is_archived),
    balance: calculateAccountBalance(a.id),
  }));

  res.json(withBalances);
});

app.post('/api/accounts', (req: Request, res: Response) => {
  const { name, type, opening_balance = 0, icon = 'CreditCard', color = '#10B981' } = req.body;
  const id = 'acc-' + Date.now();
  const now = Date.now();

  db.prepare(`
    INSERT INTO account (id, name, type, currency, opening_balance, icon, color, is_archived, created_at, updated_at)
    VALUES (?, ?, ?, 'IDR', ?, ?, ?, 0, ?, ?)
  `).run(id, name, type, opening_balance, icon, color, now, now);

  res.status(201).json({ id, name, type, opening_balance, icon, color, balance: opening_balance });
});

// Rekonsiliasi Saldo Akun (FR-30)
app.post('/api/accounts/:id/reconcile', (req: Request, res: Response) => {
  const accountId = String(req.params.id);
  const { new_balance, note } = req.body;
  const current = calculateAccountBalance(accountId);
  const diff = Number(new_balance) - current;

  if (diff !== 0) {
    const txnId = 'txn-' + Date.now();
    const type = diff > 0 ? 'income' : 'expense';
    const now = Date.now();
    db.prepare(`
      INSERT INTO txn (
        id, type, amount, account_id, note, status, source, occurred_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'confirmed', 'manual', ?, ?, ?)
    `).run(
      txnId,
      type,
      Math.abs(diff),
      accountId,
      note || `Koreksi Saldo (${diff > 0 ? '+' : '-'}${Math.abs(diff).toLocaleString('id-ID')})`,
      now,
      now,
      now
    );
  }

  res.json({ success: true, balance: Number(new_balance) });
});

// ---------------- CATEGORIES ----------------
app.get('/api/categories', (_req: Request, res: Response) => {
  const categories = db.prepare('SELECT * FROM category WHERE deleted_at IS NULL ORDER BY sort_order ASC').all();
  res.json(categories);
});

// Tambah Kategori Kustom (FR-35)
app.post('/api/categories', (req: Request, res: Response) => {
  const { name, kind = 'expense', icon = 'CircleEllipsis', color = '#10B981' } = req.body;
  const id = 'cat-' + Date.now();
  const now = Date.now();
  db.prepare(`
    INSERT INTO category (id, name, kind, icon, color, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 99, ?, ?)
  `).run(id, name, kind, icon, color, now, now);
  res.status(201).json({ id, name, kind, icon, color, sort_order: 99 });
});

// Update Kategori (FR-35)
app.put('/api/categories/:id', (req: Request, res: Response) => {
  const id = String(req.params.id);
  const { name, icon, color, kind } = req.body;
  const now = Date.now();

  const current = db.prepare('SELECT * FROM category WHERE id = ?').get(id) as any;
  if (!current) {
    res.status(404).json({ error: 'Kategori tidak ditemukan' });
    return;
  }

  db.prepare(`
    UPDATE category SET
      name = COALESCE(?, name),
      icon = COALESCE(?, icon),
      color = COALESCE(?, color),
      kind = COALESCE(?, kind),
      updated_at = ?
    WHERE id = ?
  `).run(name || null, icon || null, color || null, kind || null, now, id);

  const updated = db.prepare('SELECT * FROM category WHERE id = ?').get(id);
  res.json(updated);
});

// Hapus Kategori dengan Cascade Reassign ke cat-lainnya
app.delete('/api/categories/:id', (req: Request, res: Response) => {
  const id = String(req.params.id);
  if (id === 'cat-lainnya') {
    res.status(400).json({ error: 'Kategori sistem tidak dapat dihapus' });
    return;
  }

  const now = Date.now();
  // 1. Reassign transactions to 'cat-lainnya'
  db.prepare("UPDATE txn SET category_id = 'cat-lainnya', updated_at = ? WHERE category_id = ?").run(now, id);
  // 2. Remove referencing budget lines
  db.prepare('DELETE FROM budget_line WHERE category_id = ?').run(id);
  // 3. Delete category
  db.prepare('DELETE FROM category WHERE id = ?').run(id);

  res.json({ success: true, id });
});

// ---------------- TRANSACTIONS ----------------
app.get('/api/transactions', (req: Request, res: Response) => {
  const status = req.query.status as string | undefined;
  let query = 'SELECT * FROM txn WHERE deleted_at IS NULL';
  const params: any[] = [];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  query += ' ORDER BY occurred_at DESC';

  const txns = db.prepare(query).all(...params);
  res.json(txns);
});

app.post('/api/transactions', (req: Request, res: Response) => {
  const {
    type = 'expense',
    amount,
    account_id,
    to_account_id,
    category_id,
    merchant,
    note,
    status = 'confirmed',
    source = 'manual',
    external_ref,
    confidence = 1.0,
    admin_fee,
    raw_source_text,
    occurred_at = Date.now(),
  } = req.body;

  const id = req.body.id || 'txn-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
  const now = Date.now();

  db.prepare(`
    INSERT INTO txn (
      id, type, amount, account_id, to_account_id, category_id, merchant, occurred_at,
      note, status, source, external_ref, confidence, admin_fee, raw_source_text, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    type,
    amount,
    account_id,
    to_account_id || null,
    category_id || null,
    merchant || null,
    occurred_at,
    note || null,
    status,
    source,
    external_ref || null,
    confidence,
    admin_fee || null,
    raw_source_text || null,
    now,
    now
  );

  // Simpan rincian item struk ke txn_item (PRD Bagian 9)
  if (Array.isArray(req.body.items)) {
    const insertItem = db.prepare(`
      INSERT INTO txn_item (id, txn_id, name, qty, total, category_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const item of req.body.items) {
      insertItem.run(
        item.id || 'item-' + Math.random().toString(36).slice(2, 7),
        id,
        item.name,
        item.qty || 1,
        item.total,
        item.category_id || category_id || null
      );
    }
  }

  const created = db.prepare('SELECT * FROM txn WHERE id = ?').get(id);
  res.status(201).json(created);
});

app.put('/api/transactions/:id', (req: Request, res: Response) => {
  const id = String(req.params.id);
  const updates = req.body;
  const now = Date.now();

  const current = db.prepare('SELECT * FROM txn WHERE id = ?').get(id) as any;
  if (!current) {
    res.status(404).json({ error: 'Transaksi tidak ditemukan' });
    return;
  }

  const merged = { ...current, ...updates, updated_at: now };

  db.prepare(`
    UPDATE txn SET
      type = ?, amount = ?, account_id = ?, to_account_id = ?, category_id = ?,
      merchant = ?, occurred_at = ?, note = ?, status = ?, external_ref = ?, updated_at = ?
    WHERE id = ?
  `).run(
    merged.type,
    merged.amount,
    merged.account_id,
    merged.to_account_id || null,
    merged.category_id || null,
    merged.merchant || null,
    merged.occurred_at,
    merged.note || null,
    merged.status,
    merged.external_ref || null,
    now,
    id
  );

  res.json(merged);
});

app.delete('/api/transactions/:id', (req: Request, res: Response) => {
  const id = String(req.params.id);
  db.prepare('DELETE FROM txn WHERE id = ?').run(id);
  res.json({ success: true, id });
});

// Confirm Draft (FR-25)
app.post('/api/transactions/:id/confirm', (req: Request, res: Response) => {
  const id = String(req.params.id);
  db.prepare("UPDATE txn SET status = 'confirmed', updated_at = ? WHERE id = ?").run(Date.now(), id);
  res.json({ success: true, id });
});

// Confirm All Drafts (FR-25, 7.3)
app.post('/api/transactions/drafts/confirm-all', (_req: Request, res: Response) => {
  const result = db.prepare("UPDATE txn SET status = 'confirmed', updated_at = ? WHERE status = 'draft' AND deleted_at IS NULL").run(Date.now());
  res.json({ success: true, updated_count: result.changes });
});

// ---------------- BUDGET (FR-37 to FR-41) ----------------
app.get('/api/budget', (_req: Request, res: Response) => {
  const plan = db.prepare('SELECT * FROM budget_plan WHERE is_active = 1 LIMIT 1').get() as any;
  if (!plan) {
    res.status(404).json({ error: 'Budget plan tidak ditemukan' });
    return;
  }
  const lines = db.prepare('SELECT * FROM budget_line WHERE plan_id = ?').all(plan.id) as any[];
  res.json({
    ...plan,
    is_active: Boolean(plan.is_active),
    lines: lines.map(l => ({ ...l, rollover: Boolean(l.rollover) })),
  });
});

app.put('/api/budget', (req: Request, res: Response) => {
  const { method, total_limit, period = 'monthly', start_day = 1, lines } = req.body;
  const now = Date.now();
  let plan = db.prepare('SELECT id FROM budget_plan WHERE is_active = 1 LIMIT 1').get() as { id: string } | undefined;
  const planId = plan?.id || 'budget-active-1';

  db.prepare(`
    INSERT OR REPLACE INTO budget_plan (id, method, period, start_day, is_active, total_limit, created_at, updated_at)
    VALUES (?, ?, ?, ?, 1, ?, ?, ?)
  `).run(planId, method, period, start_day, total_limit, now, now);

  if (Array.isArray(lines)) {
    db.prepare('DELETE FROM budget_line WHERE plan_id = ?').run(planId);
    const insertLine = db.prepare(`
      INSERT INTO budget_line (id, plan_id, category_id, name, amount, rollover)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const l of lines) {
      insertLine.run(
        l.id || 'b-line-' + Math.random().toString(36).slice(2, 7),
        planId,
        l.category_id || null,
        l.name || null,
        l.amount || 0,
        l.rollover ? 1 : 0
      );
    }
  }

  res.json({ success: true, planId });
});

// ---------------- RECURRING (FR-42 to FR-45) ----------------
app.get('/api/recurring', (_req: Request, res: Response) => {
  const items = db.prepare('SELECT * FROM recurring_rule WHERE is_active = 1').all() as any[];
  res.json(items.map(r => ({
    ...r,
    is_active: Boolean(r.is_active),
    is_subscription: Boolean(r.is_subscription),
  })));
});

app.post('/api/recurring', (req: Request, res: Response) => {
  const { name, type = 'expense', amount, account_id, category_id, frequency = 'monthly', day_of_month = 1, mode = 'draft', is_subscription = false, total_tenor, remaining_tenor } = req.body;
  const id = 'rec-' + Date.now();
  const next_run_at = Date.now() + 30 * 86400000;

  db.prepare(`
    INSERT INTO recurring_rule (
      id, name, type, amount, account_id, category_id, frequency, interval,
      day_of_month, next_run_at, mode, is_active, is_subscription, total_tenor, remaining_tenor
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, 1, ?, ?, ?)
  `).run(id, name, type, amount, account_id, category_id || null, frequency, day_of_month, next_run_at, mode, is_subscription ? 1 : 0, total_tenor || null, remaining_tenor || null);

  res.status(201).json({ id, name, amount });
});

app.delete('/api/recurring/:id', (req: Request, res: Response) => {
  const id = String(req.params.id);
  db.prepare('DELETE FROM recurring_rule WHERE id = ?').run(id);
  res.json({ success: true, id });
});

// ---------------- GOALS (FR-46 to FR-48) ----------------
app.get('/api/goals', (_req: Request, res: Response) => {
  const items = db.prepare('SELECT * FROM goal ORDER BY created_at ASC').all();
  res.json(items);
});

app.post('/api/goals', (req: Request, res: Response) => {
  const { name, target_amount, saved_amount = 0, due_at, account_id } = req.body;
  const id = 'goal-' + Date.now();
  const now = Date.now();

  db.prepare(`
    INSERT INTO goal (id, name, target_amount, saved_amount, due_at, account_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, target_amount, saved_amount, due_at || null, account_id || null, now, now);

  res.status(201).json({ id, name, target_amount, saved_amount });
});

app.post('/api/goals/:id/contribute', (req: Request, res: Response) => {
  const id = String(req.params.id);
  const { amount } = req.body;
  db.prepare(`
    UPDATE goal SET saved_amount = saved_amount + ?, updated_at = ? WHERE id = ?
  `).run(Number(amount), Date.now(), id);

  const updated = db.prepare('SELECT * FROM goal WHERE id = ?').get(id);
  res.json(updated);
});

// ---------------- INGESTION / PARSER (FR-6 to FR-25) ----------------
app.post('/api/parse/voice', (req: Request, res: Response) => {
  const { text } = req.body;
  const items = parseVoiceInput(text || '');
  res.json({ parsed_items: items });
});

app.post('/api/parse/ocr', (req: Request, res: Response) => {
  const { text } = req.body;
  const result = parseOCRText(text || '');
  res.json(result);
});

app.post('/api/parse/sms', (req: Request, res: Response) => {
  const { text } = req.body;
  const result = parseOCRText(text || '');
  res.json(result);
});

app.post('/api/parse/qris', (req: Request, res: Response) => {
  const { payload } = req.body;
  const result = parseQRISCode(payload || '');
  res.json(result);
});

// ---------------- BACKUP & RESTORE (FR-55) ----------------
app.get('/api/backup', (_req: Request, res: Response) => {
  const accounts = db.prepare('SELECT * FROM account').all();
  const categories = db.prepare('SELECT * FROM category').all();
  const txns = db.prepare('SELECT * FROM txn').all();
  const budgetPlan = db.prepare('SELECT * FROM budget_plan').get();
  const budgetLines = db.prepare('SELECT * FROM budget_line').all();
  const recurring = db.prepare('SELECT * FROM recurring_rule').all();
  const goals = db.prepare('SELECT * FROM goal').all();
  const settings = db.prepare('SELECT * FROM setting').all();

  res.json({
    version: '0.1.0-sqlite',
    exported_at: Date.now(),
    accounts,
    categories,
    transactions: txns,
    budget: { ...budgetPlan, lines: budgetLines },
    recurring,
    goals,
    settings,
  });
});

app.post('/api/restore', (req: Request, res: Response) => {
  const data = req.body;
  if (!data || !Array.isArray(data.accounts) || !Array.isArray(data.transactions)) {
    res.status(400).json({ error: 'Format berkas backup tidak valid' });
    return;
  }

  // Clear & Replace
  db.exec('DELETE FROM txn; DELETE FROM account; DELETE FROM category; DELETE FROM budget_line; DELETE FROM budget_plan; DELETE FROM recurring_rule; DELETE FROM goal;');

  const insertAcc = db.prepare(`
    INSERT INTO account (id, name, type, currency, opening_balance, icon, color, is_archived, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const a of data.accounts) {
    insertAcc.run(a.id, a.name, a.type, a.currency || 'IDR', a.opening_balance || 0, a.icon, a.color, a.is_archived ? 1 : 0, a.created_at, a.updated_at);
  }

  const insertTxn = db.prepare(`
    INSERT INTO txn (
      id, type, amount, account_id, to_account_id, category_id, merchant, occurred_at,
      note, status, source, external_ref, confidence, admin_fee, raw_source_text, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const t of data.transactions) {
    insertTxn.run(
      t.id, t.type, t.amount, t.account_id, t.to_account_id || null, t.category_id || null,
      t.merchant || null, t.occurred_at, t.note || null, t.status || 'confirmed', t.source || 'manual',
      t.external_ref || null, t.confidence || 1.0, t.admin_fee || null, t.raw_source_text || null,
      t.created_at, t.updated_at
    );
  }

  res.json({ success: true, message: 'Data berhasil dipulihkan' });
});
