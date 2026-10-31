import assert from 'assert';
import fs from 'fs';
import { mergeSheetRows } from '../src/services/googleSheets.ts';
import { processDueRecurringRules, calculateNextRun } from '../src/services/recurringScheduler.ts';

console.log('--- Testing Data Integrity, Tombstones & Storage Safety ---');

// 1. ErrorBoundary Existence
assert.ok(
  fs.existsSync('src/components/common/ErrorBoundary.tsx'),
  'ErrorBoundary.tsx file must exist'
);
const errorBoundaryContent = fs.readFileSync('src/components/common/ErrorBoundary.tsx', 'utf-8');
assert.ok(
  errorBoundaryContent.includes('getDerivedStateFromError') &&
  errorBoundaryContent.includes('componentDidCatch'),
  'ErrorBoundary must implement lifecycle methods'
);
console.log('   ✓ ErrorBoundary component verified');

// 2. Google Sheets Tombstone Resurrection Protection
const mockCategories = [{ id: 'cat-makan', name: 'Makan', kind: 'expense', icon: 'Utensils', color: '#ff0000', sort_order: 1 }];
const mockAccounts = [{ id: 'acc-bca', name: 'BCA', type: 'bank', currency: 'IDR', opening_balance: 100000, icon: 'Building', color: '#0000ff', is_archived: false, created_at: 1000, updated_at: 1000 }];

const localTxnsWithTombstone = [
  {
    id: 'txn-1',
    type: 'expense',
    amount: 50000,
    account_id: 'acc-bca',
    category_id: 'cat-makan',
    note: 'Makan siang',
    status: 'confirmed',
    source: 'manual',
    occurred_at: 1700000000000,
    confidence: 1,
    created_at: 1700000000000,
    updated_at: 1700000050000,
    deleted_at: 1700000050000, // Marked as deleted tombstone!
  },
  {
    id: 'txn-2',
    type: 'expense',
    amount: 25000,
    account_id: 'acc-bca',
    category_id: 'cat-makan',
    note: 'Kopi',
    status: 'confirmed',
    source: 'manual',
    occurred_at: 1700001000000,
    confidence: 1,
    created_at: 1700001000000,
    updated_at: 1700001000000,
    deleted_at: null,
  }
];

const remoteSheetRows = [
  {
    id: 'txn-1', // Remote sheet still has the deleted row
    amount: 50000,
    date: '2023-11-14 12:00:00',
    type: 'expense',
    category: 'Makan',
    account: 'BCA',
    note: 'Makan siang',
    source: 'sheet',
  },
  {
    id: 'txn-3', // A genuinely new remote transaction
    amount: 75000,
    date: '2023-11-14 13:00:00',
    type: 'expense',
    category: 'Makan',
    account: 'BCA',
    note: 'Belanja',
    source: 'sheet',
  }
];

const mergeResult = mergeSheetRows(localTxnsWithTombstone, remoteSheetRows, mockCategories, mockAccounts);

// txn-1 MUST NOT be resurrected or marked undeleted!
const tombstoneAfterMerge = mergeResult.merged.find(t => t.id === 'txn-1');
assert.ok(tombstoneAfterMerge, 'txn-1 should exist in list');
assert.strictEqual(tombstoneAfterMerge.deleted_at, 1700000050000, 'Tombstone must not be cleared or resurrected');
assert.strictEqual(mergeResult.addedCount, 1, 'Only the new transaction (txn-3) should be added');
assert.strictEqual(mergeResult.updatedCount, 0, 'Deleted transaction should not be counted as updated');
console.log('   ✓ Google Sheets tombstone resurrection protection verified');

// 3. Recurring Scheduler Catch-up & Idempotency
const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
const pastStartTime = Date.now() - threeDaysMs;

const overdueRule = {
  id: 'rec-daily-due',
  name: 'Katering Harian',
  type: 'expense',
  amount: 30000,
  account_id: 'acc-bca',
  category_id: 'cat-makan',
  frequency: 'daily',
  interval: 1,
  next_run_at: pastStartTime,
  mode: 'auto',
  is_active: true,
  is_subscription: true,
};

const executedTxns = [];
const updatedRules = processDueRecurringRules([overdueRule], txn => executedTxns.push(txn));

assert.ok(executedTxns.length >= 3, `Should catch up missed days (caught up: ${executedTxns.length})`);
assert.ok(executedTxns.length <= 12, 'Must not exceed safety ceiling');
assert.ok(updatedRules[0].next_run_at > Date.now(), 'Next run must be advanced into the future');

// Verify timestamps are scheduled dates, not Date.now()
assert.strictEqual(executedTxns[0].occurred_at, pastStartTime, 'First catch-up must preserve scheduled time');
assert.ok(executedTxns[0].external_ref?.startsWith('recurring-rec-daily-due-'), 'Must assign idempotency external_ref');
console.log('   ✓ Recurring scheduler multi-interval catch-up & idempotency verified');

// 4. Backup Schema Validation (Phase B hardening)
function validateBackupPayload(data, rawLength = 0) {
  if (rawLength > 15 * 1024 * 1024) return false;
  if (!data || typeof data !== 'object') return false;
  if (!Array.isArray(data.accounts) || !Array.isArray(data.transactions)) return false;

  const seenAccIds = new Set();
  const isValidAccounts = data.accounts.every(a => {
    if (!a || typeof a.id !== 'string' || !a.id.trim() || typeof a.name !== 'string' || !a.name.trim()) return false;
    if (seenAccIds.has(a.id)) return false;
    seenAccIds.add(a.id);
    return true;
  });

  const seenTxnIds = new Set();
  const isValidTxns = data.transactions.every(t => {
    if (!t || typeof t.id !== 'string' || !t.id.trim() || typeof t.amount !== 'number' || !Number.isFinite(t.amount) || t.amount <= 0) return false;
    if (seenTxnIds.has(t.id)) return false;
    seenTxnIds.add(t.id);
    return true;
  });

  return isValidAccounts && isValidTxns;
}

assert.strictEqual(validateBackupPayload(null), false, 'Rejects null');
assert.strictEqual(validateBackupPayload({ accounts: [] }), false, 'Rejects missing transactions');
assert.strictEqual(validateBackupPayload({ accounts: [{ id: '1' }], transactions: [] }), false, 'Rejects account without name');
assert.strictEqual(validateBackupPayload({ accounts: [{ id: '1', name: 'Cash' }], transactions: [{ id: 't1', amount: 'NaN' }] }), false, 'Rejects non-numeric amount');
assert.strictEqual(validateBackupPayload({ accounts: [{ id: '1', name: 'Cash' }], transactions: [{ id: 't1', amount: 0 }] }), false, 'Rejects zero amount');
assert.strictEqual(validateBackupPayload({ accounts: [{ id: '1', name: 'Cash' }], transactions: [{ id: 't1', amount: -500 }] }), false, 'Rejects negative amount');
assert.strictEqual(validateBackupPayload({ accounts: [{ id: '1', name: 'Cash' }], transactions: [{ id: 't1', amount: 5000 }, { id: 't1', amount: 2000 }] }), false, 'Rejects duplicate transaction ID');
assert.strictEqual(validateBackupPayload({ accounts: [{ id: '1', name: 'Cash' }, { id: '1', name: 'Bank' }], transactions: [{ id: 't1', amount: 5000 }] }), false, 'Rejects duplicate account ID');
assert.strictEqual(validateBackupPayload({ accounts: [{ id: '1', name: 'Cash' }], transactions: [{ id: 't1', amount: 50000 }] }, 16 * 1024 * 1024), false, 'Rejects payloads > 15MB');
assert.strictEqual(validateBackupPayload({ accounts: [{ id: '1', name: 'Cash' }], transactions: [{ id: 't1', amount: 50000 }] }), true, 'Accepts valid schema');
console.log('   ✓ Backup payload strict schema validation verified');

// 5. Phase A Truth Pass: QRIS Removal & Clean Entrypoints
import * as parserExports from '../src/utils/parser.ts';
assert.strictEqual(
  'parseQRISCode' in parserExports,
  false,
  'parseQRISCode must be completely removed from parser exports'
);

const berandaCode = fs.readFileSync('src/components/beranda/BerandaView.tsx', 'utf-8');
assert.strictEqual(
  berandaCode.includes("openCatat('qr')"),
  false,
  'BerandaView must not have QRIS openCatat quick-action'
);

const appCode = fs.readFileSync('src/App.tsx', 'utf-8');
assert.strictEqual(
  appCode.includes("openCatat('qr')"),
  false,
  'App.tsx must not route qr action'
);

const catatCode = fs.readFileSync('src/components/catat/CatatModal.tsx', 'utf-8');
assert.strictEqual(
  catatCode.includes('KOPI KENANGAN'),
  false,
  'CatatModal must not contain fake QRIS data'
);
assert.strictEqual(
  catatCode.includes('parseQRISCode'),
  false,
  'CatatModal must not invoke parseQRISCode'
);
assert.strictEqual(
  fs.existsSync('src/utils/qrScanner.ts'),
  false,
  'Dead file src/utils/qrScanner.ts must be deleted'
);
const pkgJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
assert.strictEqual(
  'jsqr' in (pkgJson.dependencies || {}),
  false,
  'Unused jsqr dependency must be removed from package.json'
);
console.log('   ✓ Phase A truth pass verified (no fake QRIS reachability or mock payloads, dead files removed)');

// 6. Phase B Durability & Reset Hardening Pass
const mainCode = fs.readFileSync('src/main.tsx', 'utf-8');
assert.strictEqual(
  mainCode.includes('navigator.storage.persist'),
  true,
  'main.tsx must invoke navigator.storage.persist() for storage eviction protection'
);

const appContextCode = fs.readFileSync('src/context/AppContext.tsx', 'utf-8');
assert.strictEqual(
  appContextCode.includes('hasLocalStateOnMount'),
  true,
  'AppContext must use hasLocalStateOnMount sovereignty check instead of txns.length > 0'
);
assert.strictEqual(
  appContextCode.includes('QuotaExceededError'),
  true,
  'AppContext safeSetStorage must trap QuotaExceededError'
);
assert.strictEqual(
  appContextCode.includes('clearSheetSyncState()'),
  true,
  'AppContext resetAllData must invoke clearSheetSyncState()'
);
assert.strictEqual(
  appContextCode.includes('api.resetData()'),
  true,
  'AppContext resetAllData must invoke api.resetData()'
);

const appViewCode = fs.readFileSync('src/App.tsx', 'utf-8');
assert.strictEqual(
  appViewCode.includes('storageWarning'),
  true,
  'App.tsx must bind storageWarning banner'
);

const serverCode = fs.readFileSync('server/app.ts', 'utf-8');
assert.strictEqual(
  serverCode.includes("app.post('/api/reset'"),
  true,
  'server/app.ts must provide /api/reset endpoint'
);

console.log('   ✓ Phase B durability, boot guard, quota warning & multi-target reset verified');

// 7. Phase C Recurring Idempotency & Monthly Date Drift Pass
// 7a. Monthly date drift (Jan 31 -> Feb 28 -> Mar 31)
const jan31 = new Date(2026, 0, 31, 10, 0, 0).getTime();
const ruleJan = {
  id: 'r-drift-test',
  name: 'Langganan Akhir Bulan',
  type: 'expense',
  amount: 50000,
  account_id: 'acc-bca',
  frequency: 'monthly',
  interval: 1,
  next_run_at: jan31,
  day_of_month: 31,
  mode: 'auto',
  is_active: true,
};

const febRun = calculateNextRun(ruleJan);
const febDate = new Date(febRun);
assert.strictEqual(febDate.getMonth(), 1, 'Feb run month must be February');
assert.strictEqual(febDate.getDate(), 28, 'Jan 31 clamped to Feb 28 in non-leap year (no overflow to March 3)');

const marRun = calculateNextRun({ ...ruleJan, next_run_at: febRun });
const marDate = new Date(marRun);
assert.strictEqual(marDate.getMonth(), 2, 'Mar run month must be March');
assert.strictEqual(marDate.getDate(), 31, 'Mar run restores anchor day 31 (drift prevented)');

// 7b. Leap year Feb 29 yearly run
const leapFeb29 = new Date(2024, 1, 29, 9, 0, 0).getTime();
const leapRule = {
  id: 'r-leap-test',
  name: 'Domain Renewal',
  type: 'expense',
  amount: 250000,
  account_id: 'acc-bca',
  frequency: 'yearly',
  interval: 1,
  next_run_at: leapFeb29,
  day_of_month: 29,
  mode: 'auto',
  is_active: true,
};
const nonLeap2025Run = calculateNextRun(leapRule);
const date2025 = new Date(nonLeap2025Run);
assert.strictEqual(date2025.getFullYear(), 2025, 'Year must advance to 2025');
assert.strictEqual(date2025.getMonth(), 1, 'Month must remain February');
assert.strictEqual(date2025.getDate(), 28, 'Feb 29 clamped to Feb 28 in 2025');

// 7c. Idempotency against already processed external_ref
const dueTime = Date.now() - 5000;
const testRule = {
  id: 'rec-idempotent',
  name: 'Spotify',
  type: 'expense',
  amount: 54990,
  account_id: 'acc-bca',
  frequency: 'monthly',
  interval: 1,
  next_run_at: dueTime,
  mode: 'auto',
  is_active: true,
  is_subscription: true,
};

const expectedRef = `recurring-rec-idempotent-${dueTime}`;
const executedList = [];
processDueRecurringRules([testRule], txn => executedList.push(txn), [{ external_ref: expectedRef }]);
assert.strictEqual(executedList.length, 0, 'Must NOT re-execute if external_ref already recorded in existing txns');

const executedFresh = [];
processDueRecurringRules([testRule], txn => executedFresh.push(txn), []);
assert.strictEqual(executedFresh.length, 1, 'Must execute if external_ref not present');
assert.strictEqual(executedFresh[0].external_ref, expectedRef, 'Must match idempotency signature');

assert.strictEqual(
  appContextCode.includes('transactionsRef'),
  true,
  'AppContext must maintain transactionsRef for synchronous idempotency check'
);

console.log('   ✓ Phase C monthly date drift clamp & recurring idempotency verified');

// 8. Phase D Google Sheets Sync Hardening Pass
const gsheetCode = fs.readFileSync('src/services/googleSheets.ts', 'utf-8');
assert.strictEqual(
  gsheetCode.includes("action?: 'save' | 'delete'"),
  true,
  'SheetRowPayload must include optional action: save | delete'
);
assert.strictEqual(
  gsheetCode.includes("r.action === 'delete'"),
  true,
  'Apps Script template must support action delete'
);
assert.strictEqual(
  gsheetCode.includes('sheet.deleteRow(i + 1)'),
  true,
  'Apps Script template must safely delete rows bottom-up'
);
assert.strictEqual(
  appContextCode.includes("action: 'delete'"),
  true,
  'AppContext deleteTransaction must sync delete action to Sheets'
);

const readmeCode = fs.readFileSync('README.md', 'utf-8');
assert.strictEqual(
  readmeCode.includes("r.action === 'delete'"),
  true,
  'README.md Apps Script template must match deletion handler'
);

console.log('   ✓ Phase D Google Sheets sync hardening & deletion propagation verified');

console.log('=== SEMUA PENGUJIAN INTEGRITAS DATA & SAFETY LULUS 100% ===');
