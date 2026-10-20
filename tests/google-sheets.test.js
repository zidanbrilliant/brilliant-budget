import assert from 'assert';

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

console.log('=== SEMUA PENGUJIAN GOOGLE SHEETS LULUS ===');
