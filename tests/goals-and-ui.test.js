import assert from 'assert';

console.log('--- Testing Goals Management (CRUD & Custom Contribution) ---');

// Mock state
let accounts = [
  { id: 'acc-bca', name: 'BCA', balance: 5000000 },
  { id: 'acc-gopay', name: 'GoPay', balance: 500000 }
];

let goals = [
  { id: 'goal-1', name: 'Liburan ke Bali', target_amount: 10000000, saved_amount: 2000000, account_id: 'acc-bca' }
];

let txns = [];

function contributeToGoal(id, amount, accountId) {
  const target = goals.find(g => g.id === id);
  assert(target, 'Goal must exist');
  const debitAccountId = accountId || target.account_id || accounts[0].id;
  const acc = accounts.find(a => a.id === debitAccountId);
  assert(acc, 'Account must exist');

  target.saved_amount += amount;
  acc.balance -= amount;
  txns.push({
    type: 'expense',
    amount,
    account_id: debitAccountId,
    merchant: `Tabungan: ${target.name}`
  });
}

function updateGoal(id, updates) {
  goals = goals.map(g => (g.id === id ? { ...g, ...updates } : g));
}

function deleteGoal(id) {
  goals = goals.filter(g => g.id !== id);
}

// 1. Test Custom Contribution (Nominal Bebas: e.g. 350.000 dari GoPay)
contributeToGoal('goal-1', 350000, 'acc-gopay');
assert.strictEqual(goals[0].saved_amount, 2350000, 'Goal saved amount should increment by 350.000');
assert.strictEqual(accounts.find(a => a.id === 'acc-gopay').balance, 150000, 'GoPay balance should be debited');
assert.strictEqual(txns.length, 1, 'Transaction record created');
console.log('   ✓ Custom contribution & account balance debit verified');

// 2. Test Edit Goal
updateGoal('goal-1', { name: 'Liburan ke Jepang', target_amount: 25000000 });
assert.strictEqual(goals[0].name, 'Liburan ke Jepang', 'Goal name should be updated');
assert.strictEqual(goals[0].target_amount, 25000000, 'Goal target amount should be updated');
console.log('   ✓ Goal editing (name & target) verified');

// 3. Test Delete Goal
deleteGoal('goal-1');
assert.strictEqual(goals.length, 0, 'Goal should be deleted');
console.log('   ✓ Goal deletion verified');

console.log('=== SEMUA PENGUJIAN TARGET TABUNGAN LULUS ===');
