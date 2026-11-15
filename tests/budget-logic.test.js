import assert from 'node:assert';
import {
  calculateTotalLimitFromLines,
  cascadeDeleteCategory,
  SYSTEM_CATEGORY_ID,
  getBudgetPeriod,
  calculateDailyBudgetSummary,
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

// 4. getBudgetPeriod logic (start_day = 1, calendar month)
const nov15 = new Date(2026, 10, 15); // Nov 15, 2026
const p1 = getBudgetPeriod(1, nov15);
assert.strictEqual(p1.totalDays, 30); // November has 30 days
assert.strictEqual(p1.daysElapsed, 15);
assert.strictEqual(p1.daysRemaining, 16);
assert.strictEqual(p1.formattedRange, '1 - 30 Nov');
console.log('   ✓ getBudgetPeriod for start_day = 1 verified');

// 5. getBudgetPeriod logic (start_day = 25, mid-cycle date)
// Today is Nov 15, so cycle is Oct 25 -> Nov 24
const p25 = getBudgetPeriod(25, nov15);
assert.strictEqual(p25.startDate.getMonth(), 9); // October (0-indexed 9)
assert.strictEqual(p25.startDate.getDate(), 25);
assert.strictEqual(p25.endDate.getMonth(), 10); // November
assert.strictEqual(p25.endDate.getDate(), 24);
assert.strictEqual(p25.totalDays, 31); // 7 days in Oct + 24 in Nov
assert.strictEqual(p25.daysElapsed, 22);
assert.strictEqual(p25.daysRemaining, 10);
assert.strictEqual(p25.formattedRange, '25 Okt - 24 Nov');
console.log('   ✓ getBudgetPeriod for payday start_day = 25 verified');

// 6. calculateDailyBudgetSummary metrics
const daily = calculateDailyBudgetSummary({
  totalBudget: 3000000,
  spentInPeriod: 1500000,
  todaySpent: 50000,
  period: p1, // 16 days remaining
});
assert.strictEqual(daily.dailyLimit, 100000); // 3jt / 30 hari
assert.strictEqual(daily.remainingBudget, 1500000);
assert.strictEqual(daily.dailyRecommended, 93750); // 1.5jt / 16 hari
assert.strictEqual(daily.todaySpent, 50000);
assert.strictEqual(daily.todayRemaining, 43750);
assert.strictEqual(daily.dailyStatus, 'safe');
assert.strictEqual(daily.projectedSpending, 3000000); // (1.5jt / 15) * 30 = 3jt
assert.strictEqual(daily.isProjectedOverBudget, false);
assert.strictEqual(daily.isCategoryMode, false);
assert.strictEqual(daily.canSaveRemainder, true); // todayRemaining > 0

// Test daily overspending
const dailyOver = calculateDailyBudgetSummary({
  totalBudget: 3000000,
  spentInPeriod: 2800000,
  todaySpent: 120000,
  period: p1,
});
assert.strictEqual(dailyOver.dailyStatus, 'exceeded');
assert.strictEqual(dailyOver.isProjectedOverBudget, true);
assert.strictEqual(dailyOver.canSaveRemainder, false); // todayRemaining < 0
console.log('   ✓ calculateDailyBudgetSummary metrics, remaining & projection verified');

// 7. calculateDailyBudgetSummary mode kategori
const dailyCat = calculateDailyBudgetSummary({
  totalBudget: 1050000, // limit kategori Makan
  spentInPeriod: 420000, // sudah dipakai 14 hari
  todaySpent: 28000,
  period: p1,
  categoryLabel: 'Makan',
  isCategoryMode: true,
});
assert.strictEqual(dailyCat.dailyLimit, 35000); // 1.05jt / 30 hari
assert.strictEqual(dailyCat.isCategoryMode, true);
assert.strictEqual(dailyCat.categoryLabel, 'Makan');
// remainingBudget = 1050000 - 420000 = 630000; dailyRecommended = 630000 / 16 = 39375
assert.strictEqual(dailyCat.dailyRecommended, 39375);
assert.strictEqual(dailyCat.todaySpent, 28000);
assert.strictEqual(dailyCat.todayRemaining, 11375); // 39375 - 28000
assert.strictEqual(dailyCat.canSaveRemainder, true);
console.log('   ✓ calculateDailyBudgetSummary mode kategori (Makan) verified');

console.log('=== All Budget Logic tests passed ===');
