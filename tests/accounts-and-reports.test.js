import assert from 'node:assert';
import { cascadeDeleteAccount } from '../src/utils/accountDeletion.ts';
import { buildReportSummary } from '../src/utils/reporting.ts';

console.log('--- Testing Account Deletion & Financial Reports ---');

const makeAccount = (id, name, opening_balance = 0) => ({
  id,
  name,
  type: 'bank',
  currency: 'IDR',
  opening_balance,
  icon: 'Landmark',
  color: '#2563EB',
  is_archived: false,
  created_at: 1,
  updated_at: 1,
});

const makeTxn = (id, overrides = {}) => ({
  id,
  type: 'expense',
  amount: 10000,
  account_id: 'acc-a',
  occurred_at: new Date(2026, 9, 15).getTime(),
  status: 'confirmed',
  source: 'manual',
  created_at: 1,
  updated_at: 1,
  ...overrides,
});

// 1. Account deletion reassigns references and preserves opening balance.
const accounts = [
  makeAccount('acc-a', 'Dompet A', 100000),
  makeAccount('acc-b', 'Dompet B', 50000),
  makeAccount('acc-c', 'Dompet C', 0),
];
const txns = [
  makeTxn('t1', { amount: 20000 }),
  makeTxn('t2', { type: 'income', amount: 5000 }),
  makeTxn('t3', {
    type: 'transfer',
    amount: 15000,
    account_id: 'acc-b',
    to_account_id: 'acc-a',
  }),
];
const recurring = [
  {
    id: 'rec-1',
    name: 'Netflix',
    type: 'expense',
    amount: 54000,
    account_id: 'acc-a',
    frequency: 'monthly',
    next_run_at: Date.now(),
    mode: 'auto',
    is_active: true,
  },
];
const goals = [
  {
    id: 'goal-1',
    name: 'Dana Darurat',
    target_amount: 1000000,
    saved_amount: 0,
    account_id: 'acc-a',
  },
];

const deleted = cascadeDeleteAccount(accounts, 'acc-a', txns, recurring, goals, 'acc-b');

assert.strictEqual(deleted.success, true);
assert.strictEqual(deleted.updatedAccounts.length, 2);
assert.strictEqual(deleted.reassignedTo, 'acc-b');
assert.strictEqual(deleted.reassignedTxnCount, 3);
assert.strictEqual(
  deleted.updatedAccounts.find(a => a.id === 'acc-b').opening_balance,
  150000,
  'Opening balance should move to the target account'
);
assert.strictEqual(
  deleted.updatedAccounts.find(a => a.id === 'acc-c').opening_balance,
  0,
  'Other accounts must not change'
);
assert(
  deleted.updatedTransactions.every(
    t => t.account_id !== 'acc-a' && t.to_account_id !== 'acc-a'
  ),
  'No transaction may reference the deleted account'
);
assert.strictEqual(deleted.updatedRecurring[0].account_id, 'acc-b');
assert.strictEqual(deleted.updatedGoals[0].account_id, 'acc-b');
console.log('   ✓ Account deletion reassigns transactions, recurring, goals & balance');

// 2. Preferred target is respected, and the last wallet is protected.
const preferred = cascadeDeleteAccount(accounts, 'acc-a', txns, recurring, goals, 'acc-c');
assert.strictEqual(preferred.reassignedTo, 'acc-c');
console.log('   ✓ Preferred target account is respected');

const blocked = cascadeDeleteAccount([makeAccount('acc-only', 'Satu-satunya')], 'acc-only', [], [], []);
assert.strictEqual(blocked.success, false);
assert.strictEqual(blocked.error, 'Minimal harus ada 1 dompet aktif');
console.log('   ✓ Deleting the last wallet is blocked');

const missing = cascadeDeleteAccount(accounts, 'acc-missing', [], [], []);
assert.strictEqual(missing.success, false);
assert.strictEqual(missing.error, 'Dompet tidak ditemukan');
console.log('   ✓ Deleting an unknown wallet is rejected');

// 3. Monthly report aggregates confirmed income/expense and ignores drafts/transfers.
const categories = [
  { id: 'cat-makan', name: 'Makan', kind: 'expense', icon: 'Cake', color: '#FB7185', sort_order: 1 },
  { id: 'cat-trans', name: 'Transport', kind: 'expense', icon: 'Car', color: '#FDA4AF', sort_order: 2 },
  { id: 'cat-gaji', name: 'Gaji', kind: 'income', icon: 'Briefcase', color: '#10B981', sort_order: 1 },
];
const reportTxns = [
  makeTxn('r1', { amount: 30000, category_id: 'cat-makan' }),
  makeTxn('r2', { amount: 10000, category_id: 'cat-makan' }),
  makeTxn('r3', { amount: 20000, category_id: 'cat-trans' }),
  makeTxn('r4', { type: 'income', amount: 100000, category_id: 'cat-gaji' }),
  makeTxn('r5', { amount: 99999, category_id: 'cat-makan', occurred_at: new Date(2025, 9, 15).getTime() }),
  makeTxn('r6', { amount: 5000, category_id: 'cat-makan', status: 'draft' }),
  makeTxn('r7', { amount: 7000, category_id: 'cat-makan', deleted_at: 123 }),
  makeTxn('r8', {
    type: 'transfer',
    amount: 50000,
    account_id: 'acc-a',
    to_account_id: 'acc-b',
  }),
];

const monthly = buildReportSummary(reportTxns, categories, 'month', 2026, 9);
assert.strictEqual(monthly.income, 100000);
assert.strictEqual(monthly.expense, 60000);
assert.strictEqual(monthly.balance, 40000);
assert.strictEqual(monthly.transactionCount, 4);
assert.strictEqual(monthly.slices.length, 2);
assert.strictEqual(monthly.slices[0].name, 'Makan');
assert.strictEqual(monthly.slices[0].amount, 40000);
assert(Math.abs(monthly.slices[0].percent - 66.6667) < 0.01);
assert.strictEqual(monthly.slices[1].name, 'Transport');
console.log('   ✓ Monthly report aggregates, sorts, and excludes drafts/transfers');

// 4. Yearly report includes all months but not other years.
const yearly = buildReportSummary(reportTxns, categories, 'year', 2026, 0);
assert.strictEqual(yearly.income, 100000);
assert.strictEqual(yearly.expense, 60000);
console.log('   ✓ Yearly report includes the whole year and excludes other years');

// 5. Unknown categories fall back to "Lainnya".
const fallback = buildReportSummary(
  [makeTxn('r9', { amount: 5000, category_id: 'cat-hilang' })],
  categories,
  'month',
  2026,
  9
);
assert.strictEqual(fallback.slices.length, 1);
assert.strictEqual(fallback.slices[0].name, 'Lainnya');
assert.strictEqual(fallback.slices[0].percent, 100);
console.log('   ✓ Unknown categories fall back to "Lainnya"');

console.log('=== SEMUA PENGUJIAN DOMPET & LAPORAN LULUS ===');
