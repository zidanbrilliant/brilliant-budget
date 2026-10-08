import assert from 'node:assert';
import { app } from '../server/app.ts';

// Start test server on port 3099
const server = app.listen(3099, async () => {
  try {
    const baseUrl = 'http://localhost:3099';

    // 1. Health check
    const healthRes = await fetch(`${baseUrl}/api/health`);
    const healthData = await healthRes.json();
    assert.strictEqual(healthData.status, 'ok');

    // 2. Accounts list with calculated balance
    const accRes = await fetch(`${baseUrl}/api/accounts`);
    const accData = await accRes.json();
    assert(Array.isArray(accData));
    assert(accData.length >= 4);
    assert(typeof accData[0].balance === 'number');

    // 3. Transactions list
    const txnRes = await fetch(`${baseUrl}/api/transactions`);
    const txnData = await txnRes.json();
    assert(Array.isArray(txnData));
    assert(txnData.length >= 7);

    // 4. Create a new transaction
    const createTxnRes = await fetch(`${baseUrl}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'expense',
        amount: 25000,
        account_id: 'acc-gopay',
        category_id: 'cat-makan',
        merchant: 'Kopi Kenangan Test',
        note: 'Testing backend API integration',
        status: 'confirmed',
        source: 'manual',
      }),
    });
    assert.strictEqual(createTxnRes.status, 201);
    const createdTxn = await createTxnRes.json();
    assert.strictEqual(createdTxn.amount, 25000);

    // 5. Ingestion voice parser endpoint
    const voiceRes = await fetch(`${baseUrl}/api/parse/voice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'makan siang 35 ribu pakai gopay' }),
    });
    const voiceData = await voiceRes.json();
    assert(Array.isArray(voiceData.parsed_items));
    assert.strictEqual(voiceData.parsed_items[0].amount, 35000);

    // 6. Ingestion OCR parser endpoint
    const ocrRes = await fetch(`${baseUrl}/api/parse/ocr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Transfer Berhasil Rp 500.000 ke Budi Ref 991283' }),
    });
    const ocrData = await ocrRes.json();
    assert.strictEqual(ocrData.amount, 500000);

    // 7. Budget endpoint
    const budgetRes = await fetch(`${baseUrl}/api/budget`);
    const budgetData = await budgetRes.json();
    assert(budgetData.method);
    assert(Array.isArray(budgetData.lines));

    console.log('All backend API tests passed successfully!');
  } catch (err) {
    console.error('Backend test failed:', err);
    process.exit(1);
  } finally {
    server.close();
  }
});
