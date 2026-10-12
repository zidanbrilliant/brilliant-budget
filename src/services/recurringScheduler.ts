import { RecurringRule, Txn } from '../types';

export function calculateNextRun(rule: RecurringRule): number {
  const current = new Date(rule.next_run_at || Date.now());
  const interval = rule.interval || 1;

  switch (rule.frequency) {
    case 'daily':
      current.setDate(current.getDate() + interval);
      break;
    case 'weekly':
      current.setDate(current.getDate() + 7 * interval);
      break;
    case 'monthly':
      current.setMonth(current.getMonth() + interval);
      break;
    case 'yearly':
      current.setFullYear(current.getFullYear() + interval);
      break;
    default:
      current.setMonth(current.getMonth() + 1);
      break;
  }
  return current.getTime();
}

export function processDueRecurringRules(
  rules: RecurringRule[],
  onExecute: (txn: Partial<Txn>) => void
): RecurringRule[] {
  const now = Date.now();
  let hasChanges = false;

  const updatedRules = rules.map((rule) => {
    if (!rule.is_active || !rule.next_run_at || rule.next_run_at > now) {
      return rule;
    }

    hasChanges = true;
    onExecute({
      type: rule.type,
      amount: rule.amount,
      account_id: rule.account_id,
      category_id: rule.category_id || 'cat-tagihan',
      merchant: rule.name,
      note: `Otomatis: ${rule.name}`,
      source: 'recurring',
      status: rule.mode === 'auto' ? 'confirmed' : 'draft',
      occurred_at: now,
    });

    const nextRun = calculateNextRun(rule);
    let remainingTenor = rule.remaining_tenor;
    let isActive: boolean = true;

    if (!rule.is_subscription && typeof remainingTenor === 'number') {
      remainingTenor -= 1;
      if (remainingTenor <= 0) {
        isActive = false;
      }
    }

    return {
      ...rule,
      next_run_at: nextRun,
      remaining_tenor: remainingTenor,
      is_active: isActive,
    };
  });

  return hasChanges ? updatedRules : rules;
}
