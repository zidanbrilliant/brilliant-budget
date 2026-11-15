import type { Category, Txn, BudgetLine } from '../types/index.ts';

export const SYSTEM_CATEGORY_ID = 'cat-lainnya';

export interface BudgetPeriod {
  startDate: Date;
  endDate: Date;
  totalDays: number;
  daysElapsed: number;
  daysRemaining: number;
  formattedRange: string;
}

export interface DailyBudgetInput {
  totalBudget: number;
  spentInPeriod: number;
  todaySpent: number;
  period: BudgetPeriod;
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

  const refNoon = new Date(year, month, day, 12, 0, 0, 0).getTime();
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
 * Computes daily budget metrics, daily recommended spending, today's status,
 * and end-of-period spending projections.
 */
export function calculateDailyBudgetSummary(input: DailyBudgetInput): DailyBudgetSummary {
  const { totalBudget, spentInPeriod, todaySpent, period } = input;
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
