import type { Category, Txn, BudgetLine } from '../types/index.ts';

export const SYSTEM_CATEGORY_ID = 'cat-lainnya';

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
