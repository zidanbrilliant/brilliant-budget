import assert from 'node:assert';
import {
  arrayBufferToBase64,
  base64ToArrayBuffer,
  downsampleBuffer,
  encodeWavBytes,
} from '../src/utils/wav.ts';
import {
  parseDateAndTime,
  parseDateParts,
  todayInJakarta,
} from '../src/utils/dateParsing.ts';
import {
  normalizeAIContext,
  normalizeAmount,
  normalizeConfidence,
  normalizeReceiptResult,
  normalizeVoiceResult,
} from '../src/utils/aiSchemas.ts';
import {
  classifyGeminiError,
  resolveGeminiModels,
  resolveVoiceGeminiModels,
} from '../src/utils/geminiCore.ts';

console.log('1. Menguji encoder WAV 16kHz mono...');
{
  const samples = new Float32Array(16000).fill(0.25);
  const wav = encodeWavBytes(samples, 16000);
  const view = new DataView(wav);
  const header = String.fromCharCode(...new Uint8Array(wav, 0, 4));

  assert.strictEqual(header, 'RIFF');
  assert.strictEqual(view.getUint16(20, true), 1, 'format PCM');
  assert.strictEqual(view.getUint16(22, true), 1, 'mono');
  assert.strictEqual(view.getUint32(24, true), 16000, 'sample rate');
  assert.strictEqual(view.getUint16(34, true), 16, 'bit depth');
  assert.strictEqual(view.getUint32(40, true), 32000, 'panjang data PCM');
  assert.strictEqual(wav.byteLength, 44 + 32000);

  const base64 = arrayBufferToBase64(wav);
  const restored = new Uint8Array(base64ToArrayBuffer(base64));
  assert.strictEqual(restored.length, new Uint8Array(wav).length);
  assert.strictEqual(restored[0], 0x52, 'byte pertama tetap RIFF');
}

console.log('2. Menguji downsampling 48kHz ke 16kHz...');
{
  const input = new Float32Array(48000).fill(0.5);
  const output = downsampleBuffer(input, 48000, 16000);
  assert.strictEqual(output.length, 16000);
  assert(Math.abs(output[0] - 0.5) < 1e-6);
  assert(Math.abs(output[output.length - 1] - 0.5) < 1e-6);
}

console.log('3. Menguji parsing tanggal & waktu Indonesia...');
{
  assert.deepStrictEqual(parseDateParts('26/10/2026'), { year: 2026, month: 10, day: 26 });
  assert.deepStrictEqual(parseDateParts('2026-10-26'), { year: 2026, month: 10, day: 26 });
  assert.deepStrictEqual(parseDateParts('08 Okt 2026'), { year: 2026, month: 10, day: 8 });
  assert.strictEqual(parseDateParts('31/02/2026'), null);

  const timestamp = parseDateAndTime('2026-10-26', '14:30', '2026-10-26');
  const parsed = new Date(timestamp);
  assert.strictEqual(parsed.getFullYear(), 2026);
  assert.strictEqual(parsed.getMonth(), 9);
  assert.strictEqual(parsed.getDate(), 26);
  assert.strictEqual(parsed.getHours(), 14);
  assert.strictEqual(parsed.getMinutes(), 30);

  const yesterday = new Date(parseDateAndTime('kemarin', null, '2026-10-26'));
  assert.strictEqual(yesterday.getFullYear(), 2026);
  assert.strictEqual(yesterday.getMonth(), 9);
  assert.strictEqual(yesterday.getDate(), 25);

  assert(/^\d{4}-\d{2}-\d{2}$/.test(todayInJakarta()));
}

console.log('4. Menguji normalisasi nominal & keyakinan...');
{
  assert.strictEqual(normalizeAmount('Rp 58.200'), 58200);
  assert.strictEqual(normalizeAmount('Rp 1.250.000'), 1250000);
  assert.strictEqual(normalizeAmount('25rb'), 25000);
  assert.strictEqual(normalizeAmount('1,5jt'), 1500000);
  assert.strictEqual(normalizeAmount('2 juta'), 2000000);
  assert.strictEqual(normalizeAmount(35000), 35000);
  assert.strictEqual(normalizeAmount('tidak ada'), 0);

  assert.strictEqual(normalizeConfidence(0.92), 0.92);
  assert.strictEqual(normalizeConfidence(92), 0.92);
  assert.strictEqual(normalizeConfidence('97%'), 0.97);
  assert.strictEqual(normalizeConfidence(150), 1);
  assert.strictEqual(normalizeConfidence(-1), 0);

  assert.deepStrictEqual(resolveGeminiModels(), [
    'gemini-3.8-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
  ]);
  assert.deepStrictEqual(resolveVoiceGeminiModels(), [
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-3.8-flash',
  ]);
  assert.deepStrictEqual(resolveGeminiModels('gemini-3.8-flash'), [
    'gemini-3.8-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
  ]);

  const invalidKey = classifyGeminiError(
    400,
    JSON.stringify({ error: { message: 'API key not valid. Please pass a valid API key.' } }),
    'models-list'
  );
  assert.strictEqual(invalidKey.code, 'auth');
  assert.strictEqual(invalidKey.retryable, false);

  const busy = classifyGeminiError(
    503,
    JSON.stringify({ error: { message: 'This model is currently experiencing high demand.' } }),
    'gemini-3.6-flash'
  );
  assert.strictEqual(busy.code, 'unavailable');
  assert.strictEqual(busy.retryable, true);
}

const context = {
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

console.log('5. Menguji normalisasi struk & item...');
{
  const receipt = normalizeReceiptResult(
    {
      type: 'expense',
      amount: 0,
      merchant: 'Indomaret',
      category_id: 'Belanja',
      account_id: 'BCA',
      to_account_id: '',
      external_ref: 'IND-88192',
      date: '24/10/2026',
      time: '18:45',
      note: 'Belanja mingguan',
      confidence: 0.97,
      raw_text: 'INDOMARET\nTOTAL: Rp 58.200',
      items: [
        { name: 'Roti', qty: 2, unit_price: 15000, total: 30000, category_id: 'Belanja' },
        { name: 'TOTAL', qty: 1, unit_price: 58200, total: 58200, category_id: 'Belanja' },
      ],
    },
    context
  );

  assert.strictEqual(receipt.amount, 30000, 'total dihitung dari item valid');
  assert.strictEqual(receipt.items.length, 1, 'baris TOTAL tidak dianggap item');
  assert.strictEqual(receipt.merchant, 'Indomaret');
  assert.strictEqual(receipt.category_id, 'cat-belanja');
  assert.strictEqual(receipt.account_id, 'acc-bca');
  assert.strictEqual(receipt.external_ref, 'IND-88192');
  assert.strictEqual(receipt.confidence, 0.97);
  assert.strictEqual(receipt.occurred_at, new Date(2026, 9, 24, 18, 45).getTime());
  assert.strictEqual(receipt.source, 'ocr');

  const transfer = normalizeReceiptResult(
    {
      type: 'transfer',
      amount: 250000,
      merchant: 'Budi',
      account_id: 'BCA',
      to_account_id: 'GoPay',
      date: '2026-10-26',
      time: '09:00',
      confidence: 0.9,
      raw_text: 'TRANSFER BERHASIL',
      items: [],
    },
    context
  );
  assert.strictEqual(transfer.account_id, 'acc-bca');
  assert.strictEqual(transfer.to_account_id, 'acc-gopay');
  assert.strictEqual(transfer.category_id, undefined);
}

console.log('6. Menguji normalisasi suara multi-transaksi...');
{
  const voice = normalizeVoiceResult(
    {
      transcript: 'Beli kopi 25 ribu pakai Gopay, lalu gaji 5 juta masuk BCA',
      transactions: [
        {
          type: 'expense',
          amount: '25rb',
          merchant: 'Kopi',
          category_id: 'Makan & Minuman',
          account_id: 'GoPay',
          to_account_id: '',
          date: '2026-10-26',
          time: '09:15',
          note: 'Beli kopi',
          confidence: 95,
        },
        {
          type: 'income',
          amount: 5000000,
          merchant: 'Gaji',
          category_id: 'Gaji',
          account_id: 'BCA',
          to_account_id: '',
          date: '',
          time: '',
          note: 'Gaji bulanan',
          confidence: 0.99,
        },
      ],
    },
    context
  );

  assert.strictEqual(voice.items.length, 2);
  assert.strictEqual(voice.items[0].amount, 25000);
  assert.strictEqual(voice.items[0].account_id, 'acc-gopay');
  assert.strictEqual(voice.items[0].category_id, 'cat-makan');
  assert.strictEqual(voice.items[0].confidence, 0.95);
  assert.strictEqual(voice.items[1].type, 'income');
  assert.strictEqual(voice.items[1].category_id, 'cat-gaji');
  assert.strictEqual(voice.items[1].account_id, 'acc-bca');
  assert(voice.items[1].occurred_at > 0);

  const fallback = normalizeVoiceResult(
    { transcript: 'Makan siang 35 ribu pakai GoPay', transactions: [] },
    context
  );
  assert.strictEqual(fallback.items.length, 1);
  assert.strictEqual(fallback.items[0].amount, 35000);
  assert.strictEqual(fallback.items[0].account_id, 'acc-gopay');
}

console.log('7. Menguji sanitasi konteks AI...');
{
  const sanitized = normalizeAIContext(
    {
      categories: [
        { id: 'cat-x', name: 'Kategori X', kind: 'expense' },
        { id: '', name: 'Tanpa ID', kind: 'expense' },
      ],
      accounts: [
        { id: 'acc-x', name: 'Dompet X', type: 'ewallet' },
        { id: 'acc-y', name: 'Dompet Y', type: 'tidak-dikenal' },
      ],
      today: '26/10/2026',
    },
    context
  );

  assert.strictEqual(sanitized.categories.length, 1);
  assert.strictEqual(sanitized.accounts.length, 2);
  assert.strictEqual(sanitized.accounts[1].type, 'other');
  assert.strictEqual(sanitized.today, '2026-10-26');
}

console.log('All AI utility tests passed successfully!');
