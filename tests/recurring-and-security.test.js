import assert from 'assert';
import { calculateNextRun, processDueRecurringRules } from '../src/services/recurringScheduler.ts';

// Test 2: Recurring Scheduler
console.log('--- Testing Recurring Scheduler ---');

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
