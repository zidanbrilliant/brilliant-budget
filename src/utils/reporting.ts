import type { Category, Txn } from '../types/index.ts';

export type ReportPeriodMode = 'month' | 'year';

export interface ReportSlice {
  id: string;
  name: string;
  color: string;
  amount: number;
  percent: number;
}

export interface ReportSummary {
  income: number;
  expense: number;
  balance: number;
  slices: ReportSlice[];
  transactionCount: number;
}

const FALLBACK_CATEGORY = {
  id: 'uncategorized',
  name: 'Lainnya',
  color: '#94A3B8',
};

/**
 * Aggregates confirmed transactions for a selected month or year.
 * Transfers are excluded from income/expense totals, and the expense
 * breakdown is grouped by category and sorted from largest to smallest.
 */
export function buildReportSummary(
  transactions: Txn[],
  categories: Category[],
  mode: ReportPeriodMode,
  year: number,
  month: number
): ReportSummary {
  const categoryById = new Map(categories.map(category => [category.id, category]));
  const expenseByCategory = new Map<string, ReportSlice>();

  let income = 0;
  let expense = 0;
  let transactionCount = 0;

  for (const txn of transactions) {
    if (txn.deleted_at || txn.status !== 'confirmed') continue;

    const date = new Date(txn.occurred_at);
    if (date.getFullYear() !== year) continue;
    if (mode === 'month' && date.getMonth() !== month) continue;

    if (txn.type !== 'income' && txn.type !== 'expense') continue;
    transactionCount += 1;

    if (txn.type === 'income') {
      income += txn.amount;
      continue;
    }

    expense += txn.amount;
    const category = txn.category_id ? categoryById.get(txn.category_id) : undefined;
    const sliceId = category?.id || FALLBACK_CATEGORY.id;
    const existing = expenseByCategory.get(sliceId);

    if (existing) {
      existing.amount += txn.amount;
    } else {
      expenseByCategory.set(sliceId, {
        id: sliceId,
        name: category?.name || FALLBACK_CATEGORY.name,
        color: category?.color || FALLBACK_CATEGORY.color,
        amount: txn.amount,
        percent: 0,
      });
    }
  }

  const slices = Array.from(expenseByCategory.values())
    .map(slice => ({
      ...slice,
      percent: expense > 0 ? (slice.amount / expense) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  return {
    income,
    expense,
    balance: income - expense,
    slices,
    transactionCount,
  };
}
