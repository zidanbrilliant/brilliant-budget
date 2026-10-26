import type { Account, Goal, RecurringRule, Txn } from '../types/index.ts';

export interface DeleteAccountResult {
  success: boolean;
  error?: string;
  updatedAccounts: Account[];
  updatedTransactions: Txn[];
  updatedRecurring: RecurringRule[];
  updatedGoals: Goal[];
  reassignedTo?: string;
  reassignedTxnCount: number;
}

/**
 * Removes an account while keeping its financial history intact.
 * Transactions, recurring rules, and goals are moved to another active account.
 * The deleted account's opening balance is added to the target so the total
 * net worth does not change.
 */
export function cascadeDeleteAccount(
  accounts: Account[],
  accountIdToDelete: string,
  transactions: Txn[],
  recurring: RecurringRule[],
  goals: Goal[],
  preferredTargetId?: string
): DeleteAccountResult {
  const deletedAccount = accounts.find(a => a.id === accountIdToDelete);
  const remainingAccounts = accounts.filter(a => a.id !== accountIdToDelete);

  const failure = (error: string): DeleteAccountResult => ({
    success: false,
    error,
    updatedAccounts: accounts,
    updatedTransactions: transactions,
    updatedRecurring: recurring,
    updatedGoals: goals,
    reassignedTxnCount: 0,
  });

  if (!deletedAccount) return failure('Dompet tidak ditemukan');
  if (remainingAccounts.length === 0) {
    return failure('Minimal harus ada 1 dompet aktif');
  }

  const target =
    remainingAccounts.find(a => a.id === preferredTargetId) || remainingAccounts[0];
  const now = Date.now();

  const updatedAccounts = remainingAccounts.map(account =>
    account.id === target.id
      ? {
          ...account,
          opening_balance: account.opening_balance + deletedAccount.opening_balance,
          updated_at: now,
        }
      : account
  );

  let reassignedTxnCount = 0;
  const updatedTransactions = transactions.map(txn => {
    const fromDeleted = txn.account_id === accountIdToDelete;
    const toDeleted = txn.to_account_id === accountIdToDelete;
    if (!fromDeleted && !toDeleted) return txn;

    reassignedTxnCount += 1;
    return {
      ...txn,
      account_id: fromDeleted ? target.id : txn.account_id,
      to_account_id: toDeleted ? target.id : txn.to_account_id,
      updated_at: now,
    };
  });

  const updatedRecurring = recurring.map(rule =>
    rule.account_id === accountIdToDelete ? { ...rule, account_id: target.id } : rule
  );

  const updatedGoals = goals.map(goal =>
    goal.account_id === accountIdToDelete ? { ...goal, account_id: target.id } : goal
  );

  return {
    success: true,
    updatedAccounts,
    updatedTransactions,
    updatedRecurring,
    updatedGoals,
    reassignedTo: target.id,
    reassignedTxnCount,
  };
}
