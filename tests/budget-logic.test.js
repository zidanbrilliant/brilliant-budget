import assert from 'node:assert';
import {
  calculateTotalLimitFromLines,
  cascadeDeleteCategory,
  SYSTEM_CATEGORY_ID,
  getBudgetPeriod,
  calculateDailyBudgetSummary,
  resolveBudgetCycle,
  calculateCycleRemainder,
  planCycleSettlement,
  toIsoDate,
  fromIsoDate,
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

// 8. resolveBudgetCycle — tanpa transaksi gaji, siklus ikut start_day
const nov15Cycle = resolveBudgetCycle({ start_day: 25 }, [], nov15);
assert.strictEqual(nov15Cycle.startDate.getMonth(), 9); // Oktober
assert.strictEqual(nov15Cycle.startDate.getDate(), 25);
assert.strictEqual(nov15Cycle.endDate.getMonth(), 10); // November
assert.strictEqual(nov15Cycle.endDate.getDate(), 24);
assert.strictEqual(nov15Cycle.isSalaryDetected, false);
assert.strictEqual(nov15Cycle.formattedRange, '25 Okt - 24 Nov');
console.log('   ✓ resolveBudgetCycle fallback ke tanggal gajian verified');

// 9. resolveBudgetCycle — gaji dicatat 27 Okt (dalam ±7 hari) menggeser awal siklus
const salaryOct27 = [
  {
    id: 'txn-gaji-1',
    type: 'income',
    amount: 5000000,
    account_id: 'acc-bca',
    category_id: 'cat-gaji',
    occurred_at: new Date(2026, 9, 27, 9, 0, 0).getTime(),
    status: 'confirmed',
    source: 'manual',
    created_at: 0,
    updated_at: 0,
  },
];
const oct27Cycle = resolveBudgetCycle({ start_day: 25, salary_category_id: 'cat-gaji' }, salaryOct27, nov15);
assert.strictEqual(oct27Cycle.isSalaryDetected, true);
assert.strictEqual(oct27Cycle.startDate.getMonth(), 9);
assert.strictEqual(oct27Cycle.startDate.getDate(), 27);
assert.strictEqual(oct27Cycle.endDate.getDate(), 24);
assert.strictEqual(oct27Cycle.totalDays, 29); // 27 Okt - 24 Nov
assert.strictEqual(oct27Cycle.daysElapsed, 20);
console.log('   ✓ resolveBudgetCycle menggeser siklus ke tanggal gaji verified');

// 10. resolveBudgetCycle — gaji masuk lebih awal (23 Nov) memulai siklus baru lebih cepat
const nov24 = new Date(2026, 10, 24);
const salaryNov23 = [
  {
    id: 'txn-gaji-2',
    type: 'income',
    amount: 5000000,
    account_id: 'acc-bca',
    category_id: 'cat-gaji',
    occurred_at: new Date(2026, 10, 23, 8, 0, 0).getTime(),
    status: 'confirmed',
    source: 'manual',
    created_at: 0,
    updated_at: 0,
  },
];
const earlyCycle = resolveBudgetCycle({ start_day: 25, salary_category_id: 'cat-gaji' }, salaryNov23, nov24);
assert.strictEqual(earlyCycle.isSalaryDetected, true);
assert.strictEqual(earlyCycle.startDate.getMonth(), 10);
assert.strictEqual(earlyCycle.startDate.getDate(), 23);
assert.strictEqual(earlyCycle.endDate.getMonth(), 11); // Desember
assert.strictEqual(earlyCycle.endDate.getDate(), 24);
assert.strictEqual(earlyCycle.totalDays, 32); // 23 Nov - 24 Des
assert.strictEqual(earlyCycle.daysElapsed, 2);
console.log('   ✓ resolveBudgetCycle gaji lebih awal verified');

// 11. resolveBudgetCycle — gaji di luar ±7 hari / kategori lain / deteksi dimatikan diabaikan
const outsideTolerance = [
  { ...salaryOct27[0], id: 'txn-far', occurred_at: new Date(2026, 9, 10, 9, 0, 0).getTime() },
];
assert.strictEqual(
  resolveBudgetCycle({ start_day: 25, salary_category_id: 'cat-gaji' }, outsideTolerance, nov15).isSalaryDetected,
  false
);

const otherCategory = [{ ...salaryOct27[0], id: 'txn-bonus', category_id: 'cat-bonus' }];
assert.strictEqual(
  resolveBudgetCycle({ start_day: 25, salary_category_id: 'cat-gaji' }, otherCategory, nov15).isSalaryDetected,
  false
);

const disabledDetection = resolveBudgetCycle({ start_day: 25, salary_category_id: '' }, salaryOct27, nov15);
assert.strictEqual(disabledDetection.isSalaryDetected, false);
assert.strictEqual(disabledDetection.startDate.getDate(), 25);

const draftSalary = [{ ...salaryOct27[0], id: 'txn-draft', status: 'draft' }];
assert.strictEqual(
  resolveBudgetCycle({ start_day: 25, salary_category_id: 'cat-gaji' }, draftSalary, nov15).isSalaryDetected,
  false
);
console.log('   ✓ resolveBudgetCycle mengabaikan gaji di luar toleransi/kategori lain/draft verified');

// 12. calculateCycleRemainder
assert.strictEqual(
  calculateCycleRemainder({ totalLimit: 4000000, expensesInCycle: 3200000, alreadyMovedOut: 0, sourceBalance: 5000000 }),
  800000
);
assert.strictEqual(
  calculateCycleRemainder({ totalLimit: 4000000, expensesInCycle: 3200000, alreadyMovedOut: 800000, sourceBalance: 5000000 }),
  0
);
assert.strictEqual(
  calculateCycleRemainder({ totalLimit: 4000000, expensesInCycle: 3200000, alreadyMovedOut: 0, sourceBalance: 500000 }),
  500000
);
assert.strictEqual(
  calculateCycleRemainder({ totalLimit: 4000000, expensesInCycle: 4500000, alreadyMovedOut: 0, sourceBalance: 5000000 }),
  0
);
assert.strictEqual(
  calculateCycleRemainder({ totalLimit: 0, expensesInCycle: 0, alreadyMovedOut: 0, sourceBalance: 5000000 }),
  0
);
assert.strictEqual(
  calculateCycleRemainder({ totalLimit: -100, expensesInCycle: -50, alreadyMovedOut: -10, sourceBalance: -5 }),
  0
);
console.log('   ✓ calculateCycleRemainder (sisa, anti-dobel, cap saldo) verified');

// 13. toIsoDate / fromIsoDate roundtrip
assert.strictEqual(toIsoDate(new Date(2026, 10, 17, 23, 59, 0)), '2026-11-17');
assert.strictEqual(fromIsoDate('2026-11-17').getDate(), 17);
assert.strictEqual(fromIsoDate('2026-11-17').getMonth(), 10);
assert.strictEqual(fromIsoDate('2026-11-17').getHours(), 0);
assert.strictEqual(toIsoDate(fromIsoDate('2026-01-05')), '2026-01-05');
console.log('   ✓ toIsoDate / fromIsoDate verified');

// 14. planCycleSettlement — orkestrasi pemindahan sisa saat siklus berganti
const tsLocal = (y, m, d, h = 9) => new Date(y, m - 1, d, h, 0, 0).getTime();
const makeTxn = overrides => ({
  id: 'txn-' + Math.random().toString(36).slice(2, 7),
  type: 'expense',
  amount: 0,
  account_id: 'acc-bca',
  occurred_at: Date.now(),
  status: 'confirmed',
  source: 'manual',
  created_at: 0,
  updated_at: 0,
  ...overrides,
});
const acct = (id, opening) => ({
  id,
  name: id,
  type: 'bank',
  currency: 'IDR',
  opening_balance: opening,
  icon: '',
  color: '',
  is_archived: false,
  created_at: 0,
  updated_at: 0,
});
const nov26 = new Date(2026, 10, 26, 10, 0, 0);
const baseBudget = {
  start_day: 25,
  salary_category_id: 'cat-gaji',
  total_limit: 4000000,
  cycle_settled_start: '2026-10-25',
  daily_source_account_id: 'acc-bca',
  daily_savings_account_id: 'acc-tabungan',
  cycle_auto_sweep: true,
};
const baseAccounts = [acct('acc-bca', 10000000), acct('acc-tabungan', 0)];
const cycleTxns = [
  makeTxn({ id: 'x-okt-26', amount: 1200000, occurred_at: tsLocal(2026, 10, 26) }),
  makeTxn({ id: 'x-nov-10', amount: 2000000, occurred_at: tsLocal(2026, 11, 10) }),
  makeTxn({ id: 'x-draft', amount: 900000, status: 'draft', occurred_at: tsLocal(2026, 11, 1) }),
  makeTxn({ id: 'x-deleted', amount: 800000, deleted_at: 1, occurred_at: tsLocal(2026, 11, 2) }),
  makeTxn({ id: 'x-luar', amount: 500000, occurred_at: tsLocal(2026, 10, 20) }),
];

const autoSettle = planCycleSettlement({
  mode: 'auto',
  budget: baseBudget,
  transactions: cycleTxns,
  accounts: baseAccounts,
  referenceDate: nov26,
});
assert.strictEqual(autoSettle.ok, true);
assert.strictEqual(autoSettle.settlement.amount, 800000); // 4jt - (1.2jt + 2jt)
assert.strictEqual(autoSettle.settlement.externalRef, 'cycle-sweep-2026-10-25');
assert.strictEqual(autoSettle.settlement.note, 'Sisa anggaran siklus otomatis');
assert.strictEqual(autoSettle.settlement.windowStartDate.getTime(), fromIsoDate('2026-10-25').getTime());
assert.strictEqual(autoSettle.settlement.windowEndDate.getDate(), 24); // sehari sebelum siklus baru
assert.strictEqual(autoSettle.settlement.windowEndDate.getMonth(), 10);
console.log('   ✓ planCycleSettlement (auto, sisa siklus berakhir) verified');

// 14b. Transfer tabungan harian yang sudah jalan ikut dikurangi (anti-dobel)
const withDailySave = [
  ...cycleTxns,
  makeTxn({
    id: 'x-harian',
    type: 'transfer',
    amount: 300000,
    account_id: 'acc-bca',
    to_account_id: 'acc-tabungan',
    external_ref: 'daily-save-2026-11-02',
    occurred_at: tsLocal(2026, 11, 2),
  }),
];
const afterDaily = planCycleSettlement({
  mode: 'auto',
  budget: baseBudget,
  transactions: withDailySave,
  accounts: baseAccounts,
  referenceDate: nov26,
});
assert.strictEqual(afterDaily.ok, true);
assert.strictEqual(afterDaily.settlement.amount, 500000); // 800rb - 300rb
console.log('   ✓ planCycleSettlement mengurangi tabungan harian yang sudah dipindah verified');

// 14c. Idempotensi: siklus yang sama tidak diproses dua kali
const alreadySwept = [
  ...cycleTxns,
  makeTxn({
    id: 'x-sweep',
    type: 'transfer',
    amount: 800000,
    account_id: 'acc-bca',
    to_account_id: 'acc-tabungan',
    external_ref: 'cycle-sweep-2026-10-25',
    occurred_at: tsLocal(2026, 11, 25),
  }),
];
const resweep = planCycleSettlement({
  mode: 'auto',
  budget: baseBudget,
  transactions: alreadySwept,
  accounts: baseAccounts,
  referenceDate: nov26,
});
assert.strictEqual(resweep.ok, false);
assert.strictEqual(resweep.reason, 'already-settled');

const markerUpToDate = planCycleSettlement({
  mode: 'auto',
  budget: { ...baseBudget, cycle_settled_start: '2026-11-25' },
  transactions: cycleTxns,
  accounts: baseAccounts,
  referenceDate: nov26,
});
assert.strictEqual(markerUpToDate.reason, 'invalid-marker');

const autoDisabled = planCycleSettlement({
  mode: 'auto',
  budget: { ...baseBudget, cycle_auto_sweep: false },
  transactions: cycleTxns,
  accounts: baseAccounts,
  referenceDate: nov26,
});
assert.strictEqual(autoDisabled.reason, 'disabled');
console.log('   ✓ planCycleSettlement idempotensi & gate otomatis verified');

// 14d. Cap saldo dompet asal & kondisi tanpa sisa
const cappedSettle = planCycleSettlement({
  mode: 'auto',
  budget: { ...baseBudget, total_limit: 10000000 },
  transactions: [makeTxn({ id: 'x-cap', amount: 1000000, occurred_at: tsLocal(2026, 11, 5) })],
  accounts: [acct('acc-bca', 4000000), acct('acc-tabungan', 0)],
  referenceDate: nov26,
});
assert.strictEqual(cappedSettle.ok, true);
assert.strictEqual(cappedSettle.settlement.amount, 3000000); // saldo 4jt - 1jt, bukan 9jt

const overspent = planCycleSettlement({
  mode: 'auto',
  budget: { ...baseBudget, total_limit: 2000000 },
  transactions: [makeTxn({ id: 'x-over', amount: 2500000, occurred_at: tsLocal(2026, 11, 5) })],
  accounts: baseAccounts,
  referenceDate: nov26,
});
assert.strictEqual(overspent.ok, false);
assert.strictEqual(overspent.reason, 'nothing-to-move');

const noWallets = planCycleSettlement({
  mode: 'auto',
  budget: { ...baseBudget, daily_savings_account_id: undefined },
  transactions: cycleTxns,
  accounts: baseAccounts,
  referenceDate: nov26,
});
assert.strictEqual(noWallets.reason, 'no-wallets');

const sameWallet = planCycleSettlement({
  mode: 'auto',
  budget: { ...baseBudget, daily_savings_account_id: 'acc-bca' },
  transactions: cycleTxns,
  accounts: baseAccounts,
  referenceDate: nov26,
});
assert.strictEqual(sameWallet.reason, 'same-wallet');
console.log('   ✓ planCycleSettlement cap saldo, tanpa sisa & guard dompet verified');

// 14e. Mode manual: siklus berjalan, tetap jalan meski auto dimatikan
const manualSettle = planCycleSettlement({
  mode: 'manual',
  budget: { ...baseBudget, cycle_auto_sweep: false },
  transactions: [makeTxn({ id: 'x-now', amount: 1000000, occurred_at: tsLocal(2026, 11, 26) })],
  accounts: baseAccounts,
  referenceDate: nov26,
});
assert.strictEqual(manualSettle.ok, true);
assert.strictEqual(manualSettle.settlement.amount, 3000000); // 4jt - 1jt siklus berjalan
assert.strictEqual(manualSettle.settlement.externalRef, 'cycle-sweep-2026-11-25');
assert.strictEqual(manualSettle.settlement.note, 'Sisa anggaran siklus');

// Sweep siklus sebelumnya (tercatat di awal siklus ini) tidak mengurangi jatah siklus berjalan
const prevSweepInWindow = planCycleSettlement({
  mode: 'manual',
  budget: { ...baseBudget, cycle_auto_sweep: false },
  transactions: [
    makeTxn({ id: 'x-now', amount: 1000000, occurred_at: tsLocal(2026, 11, 26) }),
    makeTxn({
      id: 'x-sweep-lalu',
      type: 'transfer',
      amount: 2000000,
      account_id: 'acc-bca',
      to_account_id: 'acc-tabungan',
      external_ref: 'cycle-sweep-2026-10-25',
      occurred_at: tsLocal(2026, 11, 25, 0),
    }),
  ],
  accounts: baseAccounts,
  referenceDate: nov26,
});
assert.strictEqual(prevSweepInWindow.settlement.amount, 3000000);

// Siklus berjalan yang sudah di-sweep tidak dipindah dua kali (satu kali per siklus)
const currentSweepInWindow = planCycleSettlement({
  mode: 'manual',
  budget: { ...baseBudget, cycle_auto_sweep: false },
  transactions: [
    makeTxn({ id: 'x-now', amount: 1000000, occurred_at: tsLocal(2026, 11, 26) }),
    makeTxn({
      id: 'x-sweep-kini',
      type: 'transfer',
      amount: 500000,
      account_id: 'acc-bca',
      to_account_id: 'acc-tabungan',
      external_ref: 'cycle-sweep-2026-11-25',
      occurred_at: tsLocal(2026, 11, 26, 11),
    }),
  ],
  accounts: baseAccounts,
  referenceDate: nov26,
});
assert.strictEqual(currentSweepInWindow.ok, false);
assert.strictEqual(currentSweepInWindow.reason, 'already-settled');
console.log('   ✓ planCycleSettlement mode manual (siklus berjalan) verified');

// 14f. Deteksi gaji menggeser window settle otomatis
const salaryCycleTxns = [
  makeTxn({ id: 's-okt-26', amount: 1000000, occurred_at: tsLocal(2026, 10, 26) }),
  makeTxn({ id: 's-nov-20', amount: 1000000, occurred_at: tsLocal(2026, 11, 20) }),
  makeTxn({ id: 's-nov-23', amount: 2000000, occurred_at: tsLocal(2026, 11, 23) }),
  makeTxn({
    id: 's-gaji',
    type: 'income',
    amount: 5000000,
    category_id: 'cat-gaji',
    occurred_at: tsLocal(2026, 11, 23, 8),
  }),
];
const shiftedSettle = planCycleSettlement({
  mode: 'auto',
  budget: baseBudget,
  transactions: salaryCycleTxns,
  accounts: baseAccounts,
  referenceDate: nov26,
});
assert.strictEqual(shiftedSettle.ok, true);
assert.strictEqual(shiftedSettle.settlement.amount, 2000000); // hanya pengeluaran s/d 22 Nov
assert.strictEqual(shiftedSettle.settlement.windowEndDate.getDate(), 22); // sehari sebelum gaji 23 Nov
console.log('   ✓ planCycleSettlement mengikuti siklus hasil deteksi gaji verified');

console.log('=== All Budget Logic tests passed ===');
