import type { Account, Category, Txn, BudgetLine, BudgetPlan } from '../types/index.ts';

export const SYSTEM_CATEGORY_ID = 'cat-lainnya';

export const DEFAULT_SALARY_CATEGORY_ID = 'cat-gaji';
export const SALARY_DETECT_TOLERANCE_DAYS = 7;
export const CYCLE_SWEEP_REF_PREFIX = 'cycle-sweep-';
export const DAILY_SAVE_REF_PREFIX = 'daily-save-';
export const CYCLE_SWEEP_NOTE = 'Sisa anggaran siklus otomatis';
export const CYCLE_SWEEP_NOTE_MANUAL = 'Sisa anggaran siklus';
export const DAILY_SAVE_NOTE = 'Tabungan harian otomatis';

export interface BudgetPeriod {
  startDate: Date;
  endDate: Date;
  totalDays: number;
  daysElapsed: number;
  daysRemaining: number;
  formattedRange: string;
}

export interface CycleResolution extends BudgetPeriod {
  expectedStartDate: Date;   // start menurut start_day, tanpa deteksi gaji
  isSalaryDetected: boolean; // true bila siklus digeser ke tanggal transaksi gaji
}

export interface DailyBudgetInput {
  totalBudget: number;
  spentInPeriod: number;
  todaySpent: number;
  period: BudgetPeriod;
  // Mode kategori (opsional)
  categoryLabel?: string;      // nama kategori yang dilacak, untuk display
  isCategoryMode?: boolean;    // apakah mode per-kategori aktif
}

export interface DailyBudgetSummary {
  dailyLimit: number;
  dailyRecommended: number;
  todaySpent: number;
  todayRemaining: number;
  remainingBudget: number;
  daysRemaining: number;
  totalDays: number;
  daysElapsed: number;
  projectedSpending: number;
  isProjectedOverBudget: boolean;
  dailyStatus: 'safe' | 'warning' | 'exceeded';
  // Info mode kategori
  categoryLabel?: string;   // nama kategori yang dilacak
  isCategoryMode: boolean;  // true jika mode per-kategori aktif
  canSaveRemainder: boolean; // true jika todayRemaining > 0 (siap disimpan)
}

const MONTH_NAMES_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Derives period metrics (total days, elapsed, remaining, label) from
 * explicit cycle boundaries. Shared by getBudgetPeriod & resolveBudgetCycle.
 */
function buildPeriod(startDate: Date, endDate: Date, referenceDate: Date): BudgetPeriod {
  const startYear = startDate.getFullYear();
  const startMonth = startDate.getMonth();
  const startDayClamped = startDate.getDate();
  const endYear = endDate.getFullYear();
  const endMonth = endDate.getMonth();
  const endDayClamped = endDate.getDate();

  const refNoon = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
    12,
    0,
    0,
    0
  ).getTime();
  const startNoon = new Date(startYear, startMonth, startDayClamped, 12, 0, 0, 0).getTime();
  const endNoon = new Date(endYear, endMonth, endDayClamped, 12, 0, 0, 0).getTime();

  const totalDays = Math.max(1, Math.round((endNoon - startNoon) / 86400000) + 1);
  const daysElapsed = Math.min(
    totalDays,
    Math.max(1, Math.round((refNoon - startNoon) / 86400000) + 1)
  );
  const daysRemaining = Math.max(1, Math.round((endNoon - refNoon) / 86400000) + 1);

  const formattedRange =
    startMonth === endMonth && startYear === endYear
      ? `${startDayClamped} - ${endDayClamped} ${MONTH_NAMES_SHORT[startMonth]}`
      : `${startDayClamped} ${MONTH_NAMES_SHORT[startMonth]} - ${endDayClamped} ${MONTH_NAMES_SHORT[endMonth]}`;

  return {
    startDate,
    endDate,
    totalDays,
    daysElapsed,
    daysRemaining,
    formattedRange,
  };
}

/**
 * Calculates start and end boundaries for the active budget cycle,
 * taking start_day (e.g. payday) into account.
 */
export function getBudgetPeriod(
  startDay: number = 1,
  referenceDate: Date = new Date()
): BudgetPeriod {
  const clampedStart = Math.max(1, Math.min(31, Math.floor(startDay || 1)));
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const day = referenceDate.getDate();

  let startDate: Date;
  let endDate: Date;
  let startYear: number;
  let startMonth: number;
  let startDayClamped: number;
  let endYear: number;
  let endMonth: number;
  let endDayClamped: number;

  const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();

  if (clampedStart === 1) {
    startYear = year;
    startMonth = month;
    startDayClamped = 1;
    endYear = year;
    endMonth = month;
    endDayClamped = daysInCurrentMonth;
  } else {
    const effectiveStartThisMonth = Math.min(clampedStart, daysInCurrentMonth);
    if (day >= effectiveStartThisMonth) {
      startYear = year;
      startMonth = month;
      startDayClamped = effectiveStartThisMonth;
      endYear = month === 11 ? year + 1 : year;
      endMonth = (month + 1) % 12;
      const daysInEndMonth = new Date(endYear, endMonth + 1, 0).getDate();
      endDayClamped = Math.min(Math.max(1, clampedStart - 1), daysInEndMonth);
    } else {
      startYear = month === 0 ? year - 1 : year;
      startMonth = month === 0 ? 11 : month - 1;
      const daysInStartMonth = new Date(startYear, startMonth + 1, 0).getDate();
      startDayClamped = Math.min(clampedStart, daysInStartMonth);
      endYear = year;
      endMonth = month;
      endDayClamped = Math.min(Math.max(1, clampedStart - 1), daysInCurrentMonth);
    }
  }

  startDate = new Date(startYear, startMonth, startDayClamped, 0, 0, 0, 0);
  endDate = new Date(endYear, endMonth, endDayClamped, 23, 59, 59, 999);

  return buildPeriod(startDate, endDate, referenceDate);
}

/** Format tanggal lokal ke 'YYYY-MM-DD' (dipakai marker siklus & external_ref). */
export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Parse 'YYYY-MM-DD' sebagai tanggal lokal (awal hari). */
export function fromIsoDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y || 1970, (m || 1) - 1, d || 1, 0, 0, 0, 0);
}

/**
 * Menentukan siklus budget aktif: acuan start_day (tanggal gajian), tapi bila ada
 * transaksi pemasukan gaji yang dicatat dalam ±7 hari dari tanggal gajian,
 * siklus digeser mulai dari tanggal transaksi gaji tersebut.
 */
export function resolveBudgetCycle(
  budget: Pick<BudgetPlan, 'start_day' | 'salary_category_id'>,
  transactions: Txn[],
  referenceDate: Date = new Date()
): CycleResolution {
  const expected = getBudgetPeriod(budget.start_day, referenceDate);
  const expectedNext = getBudgetPeriod(
    budget.start_day,
    new Date(expected.endDate.getTime() + 86400000)
  );

  const salaryCategoryId =
    budget.salary_category_id === undefined
      ? DEFAULT_SALARY_CATEGORY_ID
      : budget.salary_category_id;

  let detected: Date | null = null;
  let detectedEndDate = expected.endDate;

  if (salaryCategoryId) {
    const toleranceMs = SALARY_DETECT_TOLERANCE_DAYS * 86400000;
    const refTs = referenceDate.getTime();
    // Dua kandidat siklus: yang sedang berjalan & yang berikutnya, supaya gaji
    // yang masuk lebih awal dari tanggal gajian tetap memulai siklus baru.
    const candidates = [
      { expectedStart: expected.startDate, expectedEnd: expected.endDate, detected: 0 },
      { expectedStart: expectedNext.startDate, expectedEnd: expectedNext.endDate, detected: 0 },
    ];

    for (const t of transactions) {
      if (t.deleted_at || t.status !== 'confirmed') continue;
      if (t.type !== 'income') continue;
      if (t.category_id !== salaryCategoryId) continue;
      if (t.occurred_at > refTs) continue;

      for (const candidate of candidates) {
        if (Math.abs(t.occurred_at - candidate.expectedStart.getTime()) > toleranceMs) continue;
        if (t.occurred_at > candidate.detected) candidate.detected = t.occurred_at;
      }
    }

    const matched = candidates
      .filter(candidate => candidate.detected > 0)
      .sort((a, b) => b.detected - a.detected)[0];

    if (matched) {
      detected = new Date(matched.detected);
      detectedEndDate = matched.expectedEnd;
    }
  }

  if (!detected) {
    return {
      ...expected,
      expectedStartDate: expected.startDate,
      isSalaryDetected: false,
    };
  }

  const period = buildPeriod(startOfDay(detected), detectedEndDate, referenceDate);
  return {
    ...period,
    expectedStartDate: expected.startDate,
    isSalaryDetected: true,
  };
}

/**
 * Sisa anggaran siklus yang layak dipindahkan ke dompet tabungan:
 * total_limit - pengeluaran siklus - yang sudah dipindah di siklus itu,
 * dibatasi saldo dompet asal agar saldo tidak minus.
 */
export function calculateCycleRemainder(input: {
  totalLimit: number;
  expensesInCycle: number;
  alreadyMovedOut: number;
  sourceBalance: number;
}): number {
  const totalLimit = Math.max(0, Number(input.totalLimit) || 0);
  const expenses = Math.max(0, Number(input.expensesInCycle) || 0);
  const movedOut = Math.max(0, Number(input.alreadyMovedOut) || 0);
  const sourceBalance = Math.max(0, Number(input.sourceBalance) || 0);

  const remaining = Math.max(0, totalLimit - expenses - movedOut);
  return Math.round(Math.min(remaining, sourceBalance));
}

/** Melengkapi budget lama dengan default field baru (load dari storage / restore). */
export function withBudgetDefaults(plan: BudgetPlan): BudgetPlan {
  return {
    ...plan,
    daily_auto_save_enabled: plan.daily_auto_save_enabled ?? true,
    cycle_auto_sweep: plan.cycle_auto_sweep ?? false,
    salary_category_id: plan.salary_category_id ?? DEFAULT_SALARY_CATEGORY_ID,
  };
}

/** Saldo dompet dari opening_balance + transaksi (PRD 9 & 10). */
export function calculateWalletBalance(
  account: Account | undefined,
  transactions: Txn[]
): number {
  if (!account) return 0;
  let balance = account.opening_balance;
  const accountId = account.id;

  for (const t of transactions) {
    if (t.deleted_at || t.status === 'draft') continue;
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

export type CycleSettlementMode = 'auto' | 'manual';

export type CycleSettlementSkipReason =
  | 'no-wallets'
  | 'same-wallet'
  | 'disabled'
  | 'invalid-marker'
  | 'already-settled'
  | 'nothing-to-move';

export interface CycleSettlement {
  mode: CycleSettlementMode;
  amount: number;
  sourceAccountId: string;
  destinationAccountId: string;
  windowStartDate: Date;
  windowEndDate: Date;
  externalRef: string;
  note: string;
}

export interface CycleSettlementInput {
  mode: CycleSettlementMode;
  budget: Pick<
    BudgetPlan,
    | 'start_day'
    | 'salary_category_id'
    | 'total_limit'
    | 'cycle_settled_start'
    | 'daily_source_account_id'
    | 'daily_savings_account_id'
    | 'cycle_auto_sweep'
  >;
  transactions: Txn[];
  accounts: Account[];
  referenceDate?: Date;
}

/**
 * Menentukan rencana pemindahan sisa anggaran siklus (murni, tanpa efek samping):
 * mode 'auto' = siklus yang baru berakhir, 'manual' = siklus berjalan.
 */
export function planCycleSettlement(
  input: CycleSettlementInput
): { ok: true; settlement: CycleSettlement } | { ok: false; reason: CycleSettlementSkipReason } {
  const { mode, budget, transactions, accounts } = input;
  const referenceDate = input.referenceDate ?? new Date();

  const sourceAccountId = budget.daily_source_account_id;
  const destinationAccountId = budget.daily_savings_account_id;
  if (!sourceAccountId || !destinationAccountId) return { ok: false, reason: 'no-wallets' };
  if (sourceAccountId === destinationAccountId) return { ok: false, reason: 'same-wallet' };
  if (mode === 'auto' && !budget.cycle_auto_sweep) return { ok: false, reason: 'disabled' };

  const resolution = resolveBudgetCycle(budget, transactions, referenceDate);
  const currentStartIso = toIsoDate(resolution.startDate);

  let windowStart: Date;
  let windowEnd: Date;
  let externalRef: string;

  if (mode === 'auto') {
    const settledIso = budget.cycle_settled_start;
    if (!settledIso || settledIso >= currentStartIso) {
      return { ok: false, reason: 'invalid-marker' };
    }
    windowStart = fromIsoDate(settledIso);
    windowEnd = new Date(resolution.startDate.getTime() - 1);
    externalRef = CYCLE_SWEEP_REF_PREFIX + settledIso;
  } else {
    windowStart = resolution.startDate;
    windowEnd = resolution.endDate;
    externalRef = CYCLE_SWEEP_REF_PREFIX + currentStartIso;
  }

  if (transactions.some(t => !t.deleted_at && t.external_ref === externalRef)) {
    return { ok: false, reason: 'already-settled' };
  }

  const startTs = windowStart.getTime();
  const endTs = windowEnd.getTime();
  // Sweep siklus lain (mis. sisa siklus sebelumnya yang tercatat di awal siklus ini)
  // tidak boleh mengurangi jatah siklus ini.
  const windowStartRef = CYCLE_SWEEP_REF_PREFIX + toIsoDate(windowStart);
  let expensesInCycle = 0;
  let alreadyMovedOut = 0;

  for (const t of transactions) {
    if (t.deleted_at || t.status === 'draft') continue;
    if (t.occurred_at < startTs || t.occurred_at > endTs) continue;

    if (t.type === 'expense') {
      expensesInCycle += t.amount;
      continue;
    }

    if (t.type !== 'transfer') continue;
    const ref = t.external_ref || '';
    const isCycleSweep = ref.startsWith(CYCLE_SWEEP_REF_PREFIX)
      ? ref === windowStartRef
      : t.note === CYCLE_SWEEP_NOTE || t.note === CYCLE_SWEEP_NOTE_MANUAL;
    const isDailySave = ref.startsWith(DAILY_SAVE_REF_PREFIX) || t.note === DAILY_SAVE_NOTE;
    if (isCycleSweep || isDailySave) alreadyMovedOut += t.amount;
  }

  const amount = calculateCycleRemainder({
    totalLimit: budget.total_limit || 0,
    expensesInCycle,
    alreadyMovedOut,
    sourceBalance: calculateWalletBalance(
      accounts.find(a => a.id === sourceAccountId),
      transactions
    ),
  });

  if (amount <= 0) return { ok: false, reason: 'nothing-to-move' };

  return {
    ok: true,
    settlement: {
      mode,
      amount,
      sourceAccountId,
      destinationAccountId,
      windowStartDate: windowStart,
      windowEndDate: windowEnd,
      externalRef,
      note: mode === 'auto' ? CYCLE_SWEEP_NOTE : CYCLE_SWEEP_NOTE_MANUAL,
    },
  };
}

/**
 * Computes daily budget metrics, daily recommended spending, today's status,
 * and end-of-period spending projections.
 */
export function calculateDailyBudgetSummary(input: DailyBudgetInput): DailyBudgetSummary {
  const {
    totalBudget,
    spentInPeriod,
    todaySpent,
    period,
    categoryLabel,
    isCategoryMode = false,
  } = input;
  const remainingBudget = Math.max(0, totalBudget - spentInPeriod);

  const dailyLimit = totalBudget > 0 ? Math.round(totalBudget / period.totalDays) : 0;
  const dailyRecommended =
    remainingBudget > 0 && period.daysRemaining > 0
      ? Math.round(remainingBudget / period.daysRemaining)
      : 0;

  const cleanTodaySpent = Math.max(0, todaySpent);
  const todayRemaining = dailyRecommended - cleanTodaySpent;

  let projectedSpending = 0;
  if (totalBudget <= 0) {
    projectedSpending = spentInPeriod;
  } else if (period.daysElapsed <= 1 && spentInPeriod === 0) {
    projectedSpending = 0;
  } else {
    projectedSpending = Math.round((spentInPeriod / period.daysElapsed) * period.totalDays);
  }

  const isProjectedOverBudget = totalBudget > 0 && projectedSpending > totalBudget;

  let dailyStatus: 'safe' | 'warning' | 'exceeded' = 'safe';
  if (dailyRecommended <= 0) {
    dailyStatus = cleanTodaySpent > 0 ? 'exceeded' : 'warning';
  } else if (cleanTodaySpent > dailyRecommended) {
    dailyStatus = 'exceeded';
  } else if (cleanTodaySpent >= dailyRecommended * 0.8) {
    dailyStatus = 'warning';
  } else {
    dailyStatus = 'safe';
  }

  return {
    dailyLimit,
    dailyRecommended,
    todaySpent: cleanTodaySpent,
    todayRemaining,
    remainingBudget,
    daysRemaining: period.daysRemaining,
    totalDays: period.totalDays,
    daysElapsed: period.daysElapsed,
    projectedSpending,
    isProjectedOverBudget,
    dailyStatus,
    categoryLabel,
    isCategoryMode,
    canSaveRemainder: todayRemaining > 0,
  };
}

/**
 * Calculates sum of active budget line amounts
 */
export function calculateTotalLimitFromLines(lines: Array<{ amount: number }>): number {
  if (!Array.isArray(lines)) return 0;
  return lines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0);
}

/**
 * Safely cascades deletion of a category:
 * - Prevents deleting system category 'cat-lainnya'
 * - Reassigns referencing transactions to 'cat-lainnya'
 * - Removes referencing budget lines
 */
export function cascadeDeleteCategory(
  categories: Category[],
  categoryIdToDelete: string,
  transactions: Txn[],
  budgetLines: BudgetLine[]
): {
  success: boolean;
  error?: string;
  updatedCategories: Category[];
  updatedTransactions: Txn[];
  updatedBudgetLines: BudgetLine[];
  reassignedTxnCount: number;
} {
  if (categoryIdToDelete === SYSTEM_CATEGORY_ID) {
    return {
      success: false,
      error: 'Kategori sistem tidak dapat dihapus',
      updatedCategories: categories,
      updatedTransactions: transactions,
      updatedBudgetLines: budgetLines,
      reassignedTxnCount: 0,
    };
  }

  const categoryExists = categories.some(c => c.id === categoryIdToDelete);
  if (!categoryExists) {
    return {
      success: false,
      error: 'Kategori tidak ditemukan',
      updatedCategories: categories,
      updatedTransactions: transactions,
      updatedBudgetLines: budgetLines,
      reassignedTxnCount: 0,
    };
  }

  // 1. Remove category
  const updatedCategories = categories.filter(c => c.id !== categoryIdToDelete);

  // 2. Reassign transactions
  let reassignedCount = 0;
  const updatedTransactions = transactions.map(t => {
    if (t.category_id === categoryIdToDelete) {
      reassignedCount++;
      return { ...t, category_id: SYSTEM_CATEGORY_ID, updated_at: Date.now() };
    }
    return t;
  });

  // 3. Remove budget lines referencing deleted category
  const updatedBudgetLines = budgetLines.filter(line => line.category_id !== categoryIdToDelete);

  return {
    success: true,
    updatedCategories,
    updatedTransactions,
    updatedBudgetLines,
    reassignedTxnCount: reassignedCount,
  };
}
