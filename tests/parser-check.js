import assert from 'node:assert';
import {
  parseIndonesianAmount,
  guessCategory,
  parseVoiceInput,
  parseOCRText,
  detectDuplicate,
} from '../src/utils/parser.ts';

// 1. Check Indonesian amount normalization
assert.strictEqual(parseIndonesianAmount('35rb'), 35000);
assert.strictEqual(parseIndonesianAmount('25k'), 25000);
assert.strictEqual(parseIndonesianAmount('1,5 juta'), 1500000);
assert.strictEqual(parseIndonesianAmount('setengah juta'), 500000);
assert.strictEqual(parseIndonesianAmount('Rp 125.000'), 125000);

// 2. Check category guessing
assert.strictEqual(guessCategory('Kopi Kenangan'), 'cat-makan');
assert.strictEqual(guessCategory('Bensin Pertalite'), 'cat-trans');
assert.strictEqual(guessCategory('Indomaret Point'), 'cat-belanja');
assert.strictEqual(guessCategory('Gaji Kantor'), 'cat-gaji');

// 3. Check multi-transaction voice parse
const voiceItems = parseVoiceInput('beli bensin 50 ribu terus makan siang 30 ribu');
assert.strictEqual(voiceItems.length, 2);
assert.strictEqual(voiceItems[0].amount, 50000);
assert.strictEqual(voiceItems[1].amount, 30000);

// 4. Check OCR text parse
const ocrRes = parseOCRText('Transfer Berhasil Rp 1.250.000 ke Budi Santoso No. Ref 7712839');
assert.strictEqual(ocrRes.amount, 1250000);
assert.strictEqual(ocrRes.external_ref, '7712839');

// 5. Check duplicate detection
const existing = [
  {
    id: 't-1',
    type: 'expense',
    amount: 50000,
    account_id: 'acc-1',
    merchant: 'Indomaret',
    occurred_at: Date.now() - 60000, // 1 min ago
    status: 'confirmed',
    source: 'manual',
    created_at: Date.now(),
    updated_at: Date.now(),
  },
];

const dup = detectDuplicate(
  {
    amount: 50000,
    account_id: 'acc-1',
    merchant: 'Indomaret',
    occurred_at: Date.now(),
  },
  existing
);
assert.strictEqual(dup.isDuplicate, true);

console.log('All parser self-checks passed successfully.');
