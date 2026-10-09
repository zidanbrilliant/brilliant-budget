import assert from 'node:assert';
import {
  calculateTotalLimitFromLines,
  cascadeDeleteCategory,
  SYSTEM_CATEGORY_ID,
} from '../src/utils/budgetLogic.ts';

console.log('--- Testing Budget & Category Cascade Logic ---');

// 1. calculateTotalLimitFromLines
assert.strictEqual(calculateTotalLimitFromLines([]), 0);
assert.strictEqual(
  calculateTotalLimitFromLines([
    { amount: 500000 },
    { amount: 300000 },
    { amount: 200000 },
  ]),
  1000000
);
console.log('   ✓ calculateTotalLimitFromLines works');

// 2. cascadeDeleteCategory blocks deletion of system category
const sampleCategories = [
  { id: 'cat-makan', name: 'Makan', kind: 'expense', icon: 'Utensils', color: '#1E293B', sort_order: 1 },
  { id: SYSTEM_CATEGORY_ID, name: 'Lainnya', kind: 'expense', icon: 'CircleEllipsis', color: '#64748B', sort_order: 2 },
];
const sampleTxns = [
  { id: 't1', amount: 50000, category_id: 'cat-makan', type: 'expense', account_id: 'acc-bca', status: 'confirmed', source: 'manual', occurred_at: Date.now(), created_at: Date.now(), updated_at: Date.now() },
  { id: 't2', amount: 25000, category_id: SYSTEM_CATEGORY_ID, type: 'expense', account_id: 'acc-bca', status: 'confirmed', source: 'manual', occurred_at: Date.now(), created_at: Date.now(), updated_at: Date.now() },
];
const sampleBudgetLines = [
  { id: 'b1', category_id: 'cat-makan', amount: 500000 },
  { id: 'b2', category_id: SYSTEM_CATEGORY_ID, amount: 200000 },
];

const blocked = cascadeDeleteCategory(sampleCategories, SYSTEM_CATEGORY_ID, sampleTxns, sampleBudgetLines);
assert.strictEqual(blocked.success, false);
assert.strictEqual(blocked.error, 'Kategori sistem tidak dapat dihapus');
console.log('   ✓ Blocking system category deletion works');

// 3. cascadeDeleteCategory deletes category, reassigns transactions, and removes budget lines
const result = cascadeDeleteCategory(sampleCategories, 'cat-makan', sampleTxns, sampleBudgetLines);
assert.strictEqual(result.success, true);
assert.strictEqual(result.updatedCategories.length, 1);
assert.strictEqual(result.updatedCategories[0].id, SYSTEM_CATEGORY_ID);

// Verify transaction reassignment
assert.strictEqual(result.reassignedTxnCount, 1);
assert.strictEqual(result.updatedTransactions[0].category_id, SYSTEM_CATEGORY_ID);
assert.strictEqual(result.updatedTransactions[1].category_id, SYSTEM_CATEGORY_ID);

// Verify budget line removal
assert.strictEqual(result.updatedBudgetLines.length, 1);
assert.strictEqual(result.updatedBudgetLines[0].category_id, SYSTEM_CATEGORY_ID);
console.log('   ✓ Category cascade deletion & transaction reassignment works');

console.log('=== All Budget Logic tests passed ===');
