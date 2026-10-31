import type { RecurringRule, Txn } from '../types/index.ts';

export function calculateNextRun(rule: RecurringRule): number {
  const current = new Date(rule.next_run_at || Date.now());
  const interval = Math.max(1, rule.interval || 1);
  const anchorDay = rule.day_of_month || current.getDate();

  switch (rule.frequency) {
    case 'daily': {
      current.setDate(current.getDate() + interval);
      return current.getTime();
    }
    case 'weekly': {
      current.setDate(current.getDate() + 7 * interval);
      return current.getTime();
    }
    case 'monthly': {
      // ponytail: clamp to target month end to prevent 31st -> 3rd drift
      const targetMonthIndex = current.getMonth() + interval;
      const targetYear = current.getFullYear() + Math.floor(targetMonthIndex / 12);
      const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
      const maxDays = new Date(targetYear, targetMonth + 1, 0).getDate();
      const targetDay = Math.min(anchorDay, maxDays);
      current.setFullYear(targetYear, targetMonth, targetDay);
      return current.getTime();
    }
    case 'yearly': {
      // ponytail: clamp leap day Feb 29 on non-leap years
      const targetYear = current.getFullYear() + interval;
      const targetMonth = current.getMonth();
      const maxDays = new Date(targetYear, targetMonth + 1, 0).getDate();
      const targetDay = Math.min(anchorDay, maxDays);
      current.setFullYear(targetYear, targetMonth, targetDay);
      return current.getTime();
    }
    default: {
      const targetMonthIndex = current.getMonth() + 1;
      const targetYear = current.getFullYear() + Math.floor(targetMonthIndex / 12);
      const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
      const maxDays = new Date(targetYear, targetMonth + 1, 0).getDate();
      const targetDay = Math.min(anchorDay, maxDays);
      current.setFullYear(targetYear, targetMonth, targetDay);
      return current.getTime();
    }
  }
}

export function processDueRecurringRules(
  rules: RecurringRule[],
  onExecute: (txn: Partial<Txn>) => void,
  existingTxns?: Array<{ external_ref?: string }>
): RecurringRule[] {
  const now = Date.now();
  let hasChanges = false;

  const updatedRules = rules.map((rule) => {
    if (!rule.is_active || !rule.next_run_at || rule.next_run_at > now) {
      return rule;
    }

    hasChanges = true;
    let currentRun = rule.next_run_at;
    let remainingTenor = rule.remaining_tenor;
    let isActive: boolean = true;
    let iterations = 0;
    const anchorDay = rule.day_of_month || new Date(rule.next_run_at).getDate();
    // Batas aman maksimal 12 iterasi catch-up per aturan untuk mencegah pembentukan transaksi berlebihan
    const MAX_CATCHUP_ITERATIONS = 12;

    while (currentRun <= now && isActive && iterations < MAX_CATCHUP_ITERATIONS) {
      iterations += 1;
      const externalRef = `recurring-${rule.id}-${currentRun}`;

      // Idempotency: lewati eksekusi jika external_ref sudah pernah tercatat
      const alreadyProcessed = existingTxns?.some(
        (t) => t.external_ref === externalRef
      );

      if (!alreadyProcessed) {
        onExecute({
          type: rule.type,
          amount: rule.amount,
          account_id: rule.account_id,
          category_id: rule.category_id || 'cat-tagihan',
          merchant: rule.name,
          note: `Otomatis: ${rule.name}`,
          source: 'recurring',
          status: rule.mode === 'auto' ? 'confirmed' : 'draft',
          occurred_at: currentRun,
          external_ref: externalRef,
        });
      }

      const nextRun = calculateNextRun({
        ...rule,
        day_of_month: anchorDay,
        next_run_at: currentRun,
      });

      if (!rule.is_subscription && typeof remainingTenor === 'number') {
        remainingTenor -= 1;
        if (remainingTenor <= 0) {
          isActive = false;
        }
      }

      currentRun = nextRun;
    }

    return {
      ...rule,
      day_of_month: anchorDay,
      next_run_at: currentRun,
      remaining_tenor: remainingTenor,
      is_active: isActive,
    };
  });

  return hasChanges ? updatedRules : rules;
}
