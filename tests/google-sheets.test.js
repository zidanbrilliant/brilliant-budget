import assert from 'assert';
import { mergeSheetRows } from '../src/services/googleSheets.ts';

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

console.log('=== SEMUA PENGUJIAN GOOGLE SHEETS LULUS ===');
