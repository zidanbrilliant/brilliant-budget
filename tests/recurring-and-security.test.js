import assert from 'assert';

// Test 2: Recurring Scheduler
console.log('--- Testing Recurring Scheduler ---');
function calculateNextRun(rule) {
  const current = new Date(rule.next_run_at || Date.now());
  const interval = rule.interval || 1;
  switch (rule.frequency) {
    case 'daily':
      current.setDate(current.getDate() + interval);
      break;
    case 'monthly':
      current.setMonth(current.getMonth() + interval);
      break;
  }
  return current.getTime();
}

function processDueRecurringRules(rules, onExecute) {
  const now = Date.now();
  return rules.map(rule => {
    if (!rule.is_active || !rule.next_run_at || rule.next_run_at > now) {
      return rule;
    }
    onExecute({
      type: rule.type,
      amount: rule.amount,
      account_id: rule.account_id,
      category_id: rule.category_id,
      merchant: rule.name,
    });
    const nextRun = calculateNextRun(rule);
    let remainingTenor = rule.remaining_tenor;
    let isActive = true;
    if (!rule.is_subscription && typeof remainingTenor === 'number') {
      remainingTenor -= 1;
      if (remainingTenor <= 0) isActive = false;
    }
    return {
      ...rule,
      next_run_at: nextRun,
      remaining_tenor: remainingTenor,
      is_active: isActive,
    };
  });
}

const executed = [];
const rules = [
  {
    id: 'rec-1',
    name: 'Cicilan Laptop',
    type: 'expense',
    amount: 1000000,
    account_id: 'acc-bca',
    category_id: 'cat-tagihan',
    frequency: 'monthly',
    interval: 1,
    next_run_at: Date.now() - 1000, // Due!
    mode: 'auto',
    is_active: true,
    is_subscription: false,
    remaining_tenor: 1,
  },
  {
    id: 'rec-2',
    name: 'Netflix',
    type: 'expense',
    amount: 186000,
    account_id: 'acc-gopay',
    frequency: 'monthly',
    next_run_at: Date.now() + 100000, // Not due!
    mode: 'auto',
    is_active: true,
    is_subscription: true,
  }
];

const updated = processDueRecurringRules(rules, txn => executed.push(txn));
assert.strictEqual(executed.length, 1, 'Only due rule should execute');
assert.strictEqual(executed[0].amount, 1000000);
assert.strictEqual(updated[0].remaining_tenor, 0);
assert.strictEqual(updated[0].is_active, false, 'Tenor completed rule should deactivate');
assert.strictEqual(updated[1].is_active, true, 'Non-due rule remains unchanged');
console.log('   ✓ Recurring rule execution & installment decrement verified');

console.log('=== SEMUA PENGUJIAN RECURRING LULUS ===');
