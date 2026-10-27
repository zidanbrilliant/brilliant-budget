import assert from 'assert';
import {
  mergeSheetRows,
  normalizeConfigSnapshot,
  isConfigSyncEnabled,
  setConfigSyncEnabled,
  pullConfigFromSheet,
  pushConfigToSheet,
  GOOGLE_APPS_SCRIPT_TEMPLATE,
} from '../src/services/googleSheets.ts';

console.log('--- Testing Google Sheets Sync Logic & Queue ---');

// Mock localStorage
const storage = {};
global.localStorage = {
  getItem: (k) => storage[k] || null,
  setItem: (k, v) => { storage[k] = String(v); },
  removeItem: (k) => { delete storage[k]; }
};

// Test Queue logic
let queue = [];
function saveQueue(q) {
  localStorage.setItem('bb_gsheet_queue', JSON.stringify(q));
}
function getQueue() {
  return JSON.parse(localStorage.getItem('bb_gsheet_queue') || '[]');
}

assert.strictEqual(getQueue().length, 0, 'Initial queue must be empty');

// Enqueue item
const sampleTxn = {
  id: 'txn-test-1',
  date: '2026-10-20 14:30:00',
  type: 'expense',
  category: 'Makanan',
  amount: 45000,
  account: 'GoPay',
  note: 'Kopi Kenangan',
  source: 'manual'
};
queue.push(sampleTxn);
saveQueue(queue);

assert.strictEqual(getQueue().length, 1, 'Queue should hold 1 transaction');
assert.strictEqual(getQueue()[0].amount, 45000, 'Payload amount preserved');

// Flush queue
queue = [];
saveQueue(queue);
assert.strictEqual(getQueue().length, 0, 'Flushed queue should be empty');
console.log('   ✓ Offline queue storage and flush verified');

// Test Webhook URL getter/setter
const testUrl = 'https://script.google.com/macros/s/AKfycbytest/exec';
localStorage.setItem('bb_gsheet_url', testUrl);
assert.strictEqual(localStorage.getItem('bb_gsheet_url'), testUrl, 'URL getter/setter verified');
console.log('   ✓ Google Sheets Webhook URL persistence verified');

// Test mergeSheetRows
const mockCategories = [
  { id: 'cat-makan', name: 'Makan & Minum', kind: 'expense', icon: 'Utensils', color: '#ff0000', sort_order: 1 },
  { id: 'cat-gaji', name: 'Gaji', kind: 'income', icon: 'Briefcase', color: '#00ff00', sort_order: 2 },
  { id: 'cat-lainnya', name: 'Lainnya', kind: 'expense', icon: 'MoreHorizontal', color: '#888888', sort_order: 3 },
];

const mockAccounts = [
  { id: 'acc-bca', name: 'BCA Utama', type: 'bank', currency: 'IDR', opening_balance: 0, icon: 'Landmark', color: '#0000ff', is_archived: false, created_at: 0, updated_at: 0 },
  { id: 'acc-gopay', name: 'GoPay Jajan', type: 'ewallet', currency: 'IDR', opening_balance: 0, icon: 'Smartphone', color: '#00ffff', is_archived: false, created_at: 0, updated_at: 0 },
];

const localTxns = [
  {
    id: 'txn-local-1',
    type: 'expense',
    amount: 25000,
    account_id: 'acc-gopay',
    category_id: 'cat-makan',
    note: 'Kopi',
    status: 'confirmed',
    source: 'manual',
    occurred_at: new Date('2026-10-26T10:00:00Z').getTime(),
    confidence: 1,
    created_at: 0,
    updated_at: 0,
  }
];

// Case 1: Pull row with brand new ID from laptop to phone
const sheetRows1 = [
  {
    id: 'txn-laptop-1',
    date: '2026-10-26 12:00:00',
    type: 'expense',
    category: 'Makan & Minum',
    amount: 50000,
    account: 'BCA Utama',
    note: 'Makan siang bareng tim',
    source: 'manual'
  }
];

const res1 = mergeSheetRows(localTxns, sheetRows1, mockCategories, mockAccounts);
assert.strictEqual(res1.addedCount, 1, 'Should add 1 new transaction from sheet');
assert.strictEqual(res1.updatedCount, 0, 'Should not update any transaction');
assert.strictEqual(res1.merged.length, 2, 'Total merged should be 2');
assert.strictEqual(res1.merged.find(t => t.id === 'txn-laptop-1')?.amount, 50000);
assert.strictEqual(res1.merged.find(t => t.id === 'txn-laptop-1')?.account_id, 'acc-bca');
console.log('   ✓ Merge new remote transactions with ID verified');

// Case 2: Row with existing ID but edited amount
const sheetRows2 = [
  {
    id: 'txn-local-1',
    date: '2026-10-26 10:00:00',
    type: 'expense',
    category: 'Makan & Minum',
    amount: 30000, // changed from 25000
    account: 'GoPay Jajan',
    note: 'Kopi Susu Extra Shot',
    source: 'manual'
  }
];

const res2 = mergeSheetRows(localTxns, sheetRows2, mockCategories, mockAccounts);
assert.strictEqual(res2.addedCount, 0, 'No addition expected');
assert.strictEqual(res2.updatedCount, 1, 'Should update 1 transaction');
assert.strictEqual(res2.merged.find(t => t.id === 'txn-local-1')?.amount, 30000);
assert.strictEqual(res2.merged.find(t => t.id === 'txn-local-1')?.note, 'Kopi Susu Extra Shot');
console.log('   ✓ Remote edit / update in-place verified');

// Case 3: Row without ID (manually typed in Google Sheets)
const sheetRows3 = [
  {
    date: '2026-10-25 09:15:00',
    type: 'income',
    category: 'Gaji',
    amount: 5000000,
    account: 'BCA',
    note: 'Gaji Bulanan',
    source: 'sheet'
  }
];

const res3 = mergeSheetRows(localTxns, sheetRows3, mockCategories, mockAccounts);
assert.strictEqual(res3.addedCount, 1, 'Should add 1 transaction without ID');
const newIncome = res3.merged.find(t => t.amount === 5000000);
assert(newIncome, 'New income transaction must exist');
assert.strictEqual(newIncome.account_id, 'acc-bca', 'Partial account match (BCA -> BCA Utama)');
assert.strictEqual(newIncome.category_id, 'cat-gaji');

// Dedup: re-merging same sheetRows3 should NOT duplicate
const res3Dedup = mergeSheetRows(res3.merged, sheetRows3, mockCategories, mockAccounts);
assert.strictEqual(res3Dedup.addedCount, 0, 'Should deduplicate fingerprint for rows without ID');
console.log('   ✓ Rows without ID and fingerprint deduplication verified');

// ================= Config Sheet v2 =================
console.log('   Testing Config sheet v2...');

assert.strictEqual(isConfigSyncEnabled(), false, 'Config sync harus opt-in');
setConfigSyncEnabled(true);
assert.strictEqual(isConfigSyncEnabled(), true, 'Flag config sync tersimpan');
setConfigSyncEnabled(false);
assert.strictEqual(isConfigSyncEnabled(), false, 'Flag config sync bisa dimatikan');

assert.strictEqual(
  normalizeConfigSnapshot({ accounts: [], categories: mockCategories }),
  null,
  'Config tanpa dompet ditolak'
);
assert.strictEqual(
  normalizeConfigSnapshot({ accounts: mockAccounts, categories: [] }),
  null,
  'Config tanpa kategori ditolak'
);
assert.strictEqual(normalizeConfigSnapshot(null), null, 'Config bukan object ditolak');

const validConfig = {
  accounts: mockAccounts,
  categories: mockCategories,
  budget: { id: 'budget-1', method: 'category', period: 'monthly', start_day: 1, is_active: true, total_limit: 1000000, lines: [] },
  recurring: [],
  goals: [],
  settings: { currency: 'IDR', start_day: 1, theme: 'pink', onboarding_completed: true },
};
const normalizedConfig = normalizeConfigSnapshot(validConfig);
assert(normalizedConfig, 'Config valid harus diterima');
assert.strictEqual(normalizedConfig.accounts.length, 2);
assert.strictEqual(normalizedConfig.categories.length, 3);
assert.strictEqual(normalizedConfig.budget.total_limit, 1000000);

assert(
  GOOGLE_APPS_SCRIPT_TEMPLATE.includes("action === 'config'"),
  'Template harus punya endpoint config'
);
assert(
  GOOGLE_APPS_SCRIPT_TEMPLATE.includes("getSheetByName('Config')"),
  'Template harus memakai sheet Config'
);

// Mock fetch untuk menguji version gate.
const originalFetch = global.fetch;
const fetchCalls = [];
global.fetch = async (url, options = {}) => {
  fetchCalls.push({ url: String(url), method: options.method || 'GET' });
  if ((options.method || 'GET') === 'GET') {
    const isV2 = String(url).includes('/v2/');
    return {
      ok: true,
      text: async () =>
        JSON.stringify(
          isV2
            ? { status: 'ok', version: 2, config: validConfig, updated_at: 123 }
            : { status: 'ok', data: [] }
        ),
    };
  }
  return { ok: true };
};

const v1Url = 'https://script.google.com/macros/s/v1/exec';
const v1Result = await pushConfigToSheet(v1Url, validConfig);
assert.strictEqual(v1Result.ok, false, 'Skrip v1 harus ditolak');
assert(v1Result.message.includes('versi lama'), 'Pesan harus memandu update skrip');
assert.strictEqual(
  fetchCalls.filter(call => call.method === 'POST').length,
  0,
  'Tidak boleh POST config ke skrip v1'
);

const v2Url = 'https://script.google.com/macros/s/v2/exec';
const v2Pull = await pullConfigFromSheet(v2Url);
assert.strictEqual(v2Pull.version, 2);
assert(v2Pull.config, 'Config v2 harus terbaca');
assert.strictEqual(v2Pull.updatedAt, 123);

const v2Result = await pushConfigToSheet(v2Url, validConfig);
assert.strictEqual(v2Result.ok, true, 'Skrip v2 harus menerima config');
assert.strictEqual(
  fetchCalls.filter(call => call.method === 'POST').length,
  1,
  'Config v2 harus dikirim lewat POST'
);

global.fetch = originalFetch;
console.log('   ✓ Config sheet v2, version gate, dan sanitasi terverifikasi');

console.log('=== SEMUA PENGUJIAN GOOGLE SHEETS LULUS ===');
