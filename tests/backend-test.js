import assert from 'node:assert';
import { app } from '../server/app.ts';
import { setGeminiFetchForTests } from '../server/gemini.ts';

const originalGeminiKey = process.env.GEMINI_API_KEY;
process.env.GEMINI_API_KEY = 'test-gemini-key';

const aiContext = {
  categories: [
    { id: 'cat-makan', name: 'Makan & Minuman', kind: 'expense' },
    { id: 'cat-belanja', name: 'Belanja', kind: 'expense' },
    { id: 'cat-gaji', name: 'Gaji', kind: 'income' },
  ],
  accounts: [
    { id: 'acc-bca', name: 'BCA Utama', type: 'bank' },
    { id: 'acc-gopay', name: 'GoPay Jajan', type: 'ewallet' },
  ],
  today: '2026-10-26',
};

const receiptPayload = {
  type: 'expense',
  amount: 58200,
  merchant: 'Indomaret',
  category_id: 'cat-belanja',
  account_id: 'acc-bca',
  to_account_id: '',
  external_ref: 'IND-88192',
  date: '2026-10-24',
  time: '18:45',
  note: 'Belanja mingguan',
  confidence: 0.97,
  raw_text: 'INDOMARET\nTOTAL: Rp 58.200',
  items: [
    { name: 'Roti Tawar', qty: 2, unit_price: 15000, total: 30000, category_id: 'cat-belanja' },
    { name: 'Susu Kotak', qty: 1, unit_price: 28200, total: 28200, category_id: 'cat-belanja' },
  ],
};

const voicePayload = {
  transcript: 'Beli kopi 25 ribu pakai Gopay',
  transactions: [
    {
      type: 'expense',
      amount: 25000,
      merchant: 'Kopi',
      category_id: 'cat-makan',
      account_id: 'acc-gopay',
      to_account_id: '',
      date: '2026-10-26',
      time: '09:15',
      note: 'Beli kopi',
      confidence: 0.95,
    },
  ],
};

// Start test server on port 3099
const server = app.listen(3099, async () => {
  try {
    const baseUrl = 'http://localhost:3099';

    // 1. Health check
    const healthRes = await fetch(`${baseUrl}/api/health`);
    const healthData = await healthRes.json();
    assert.strictEqual(healthData.status, 'ok');

    // 2. Accounts list with calculated balance (default 0)
    const accRes = await fetch(`${baseUrl}/api/accounts`);
    const accData = await accRes.json();
    assert(Array.isArray(accData));
    assert(accData.length >= 4);
    assert(typeof accData[0].balance === 'number');

    // 3. Transactions list (default 0)
    const txnRes = await fetch(`${baseUrl}/api/transactions`);
    const txnData = await txnRes.json();
    assert(Array.isArray(txnData));

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

    // 8. Gemini AI status & proxy endpoints (transport Gemini dimock, tanpa panggilan internet)
    setGeminiFetchForTests(async (_url, init) => {
      const requestBody = JSON.parse(init?.body || '{}');
      const promptText = requestBody.contents?.[0]?.parts?.[0]?.text || '';
      const payload = promptText.includes('Dengarkan audio') ? voicePayload : receiptPayload;
      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            candidates: [
              {
                content: { parts: [{ text: JSON.stringify(payload) }] },
                finishReason: 'STOP',
              },
            ],
          }),
      };
    });

    const aiStatusRes = await fetch(`${baseUrl}/api/ai/status`);
    const aiStatus = await aiStatusRes.json();
    assert.strictEqual(aiStatusRes.status, 200);
    assert.strictEqual(aiStatus.available, true);
    assert.strictEqual(aiStatus.provider, 'gemini');
    assert.strictEqual(aiStatus.key_source, 'server');
    assert(Array.isArray(aiStatus.models) && aiStatus.models.length > 0);

    const image = Buffer.from('fake-receipt-image-data-'.repeat(20)).toString('base64');
    const scanRes = await fetch(`${baseUrl}/api/ai/scan-receipt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image, mimeType: 'image/jpeg', context: aiContext }),
    });
    assert.strictEqual(scanRes.status, 200);
    const scanData = await scanRes.json();
    assert.strictEqual(scanData.result.amount, 58200);
    assert.strictEqual(scanData.result.merchant, 'Indomaret');
    assert.strictEqual(scanData.result.category_id, 'cat-belanja');
    assert.strictEqual(scanData.result.account_id, 'acc-bca');
    assert.strictEqual(scanData.result.source, 'ocr');
    assert.strictEqual(scanData.result.items.length, 2);
    assert(scanData.result.occurred_at > 0);
    assert.strictEqual(typeof scanData.model, 'string');

    const audio = Buffer.from('fake-voice-audio-'.repeat(20)).toString('base64');
    const voiceAIRes = await fetch(`${baseUrl}/api/ai/voice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audio, mimeType: 'audio/wav', context: aiContext }),
    });
    assert.strictEqual(voiceAIRes.status, 200);
    const voiceAIData = await voiceAIRes.json();
    assert(voiceAIData.transcript.toLowerCase().includes('kopi'));
    assert.strictEqual(voiceAIData.items.length, 1);
    assert.strictEqual(voiceAIData.items[0].amount, 25000);
    assert.strictEqual(voiceAIData.items[0].account_id, 'acc-gopay');
    assert.strictEqual(voiceAIData.items[0].category_id, 'cat-makan');
    assert.strictEqual(voiceAIData.items[0].source, 'voice');
    assert(voiceAIData.items[0].occurred_at > 0);
    assert.strictEqual(typeof voiceAIData.model, 'string');

    const invalidScanRes = await fetch(`${baseUrl}/api/ai/scan-receipt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: 'abc', mimeType: 'image/jpeg', context: aiContext }),
    });
    assert.strictEqual(invalidScanRes.status, 400);
    const invalidScanData = await invalidScanRes.json();
    assert.strictEqual(invalidScanData.code, 'invalid_request');

    delete process.env.GEMINI_API_KEY;
    const noKeyStatusRes = await fetch(`${baseUrl}/api/ai/status`);
    const noKeyStatus = await noKeyStatusRes.json();
    assert.strictEqual(noKeyStatus.available, false);
    assert.strictEqual(noKeyStatus.key_source, 'none');

    const noKeyScanRes = await fetch(`${baseUrl}/api/ai/scan-receipt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image, mimeType: 'image/jpeg', context: aiContext }),
    });
    assert.strictEqual(noKeyScanRes.status, 503);
    const noKeyScanData = await noKeyScanRes.json();
    assert.strictEqual(noKeyScanData.code, 'not_configured');

    console.log('All backend API tests passed successfully!');
  } catch (err) {
    console.error('Backend test failed:', err);
    process.exit(1);
  } finally {
    setGeminiFetchForTests(null);
    if (originalGeminiKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalGeminiKey;
    server.close();
  }
});
