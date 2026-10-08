import assert from 'node:assert';
import {
  parseIndonesianAmount,
  guessCategory,
  parseVoiceInput,
  parseOCRText,
  parseQRISCode,
  detectDuplicate,
} from '../src/utils/parser.ts';
import { db, initDatabase } from '../server/db.ts';

initDatabase();

console.log('--- Menjalankan Golden Dataset Regression Test Suite (PRD Bagian 14) ---');

// ================= 1. Normalisasi Angka Variatif (FR-11, 8.4) =================
console.log('1. Menguji Normalisasi Angka Bahasa Indonesia...');
assert.strictEqual(parseIndonesianAmount('25rb'), 25000);
assert.strictEqual(parseIndonesianAmount('25k'), 25000);
assert.strictEqual(parseIndonesianAmount('1,5 juta'), 1500000);
assert.strictEqual(parseIndonesianAmount('setengah juta'), 500000);
assert.strictEqual(parseIndonesianAmount('Rp 1.250.000,00'), 1250000);
assert.strictEqual(parseIndonesianAmount('35.000'), 35000);
assert.strictEqual(parseIndonesianAmount('50000'), 50000);
console.log('   ✓ Normalisasi angka lulus.');

// ================= 2. Golden Speech Dataset (FR-8, FR-9, Lampiran A) =================
console.log('2. Menguji Parser Suara (Multi-Transaksi & Logat)...');
const sampleVoice1 = 'tadi siang makan soto 28 ribu pakai gopay, terus beli bensin 50 rb';
const parsedVoice1 = parseVoiceInput(sampleVoice1);
assert.strictEqual(parsedVoice1.length, 2, 'Harus memecah menjadi 2 transaksi');
assert.strictEqual(parsedVoice1[0].amount, 28000);
assert.strictEqual(parsedVoice1[0].category_id, 'cat-makan');
assert.strictEqual(parsedVoice1[1].amount, 50000);
assert.strictEqual(parsedVoice1[1].category_id, 'cat-trans');

const sampleVoice2 = 'dapat gaji kantor 10 juta';
const parsedVoice2 = parseVoiceInput(sampleVoice2);
assert.strictEqual(parsedVoice2[0].type, 'income');
assert.strictEqual(parsedVoice2[0].amount, 10000000);
assert.strictEqual(parsedVoice2[0].category_id, 'cat-gaji');
console.log('   ✓ Parser suara multi-transaksi lulus.');

// ================= 3. Golden OCR Document Dataset (FR-13, 14, 15, Lampiran A) =================
console.log('3. Menguji Template OCR (BCA, QRIS, Struk Kasir Itemized)...');
const sampleBCA = 'Transfer Berhasil Rp 1.250.000 ke Budi Santoso No. Ref 7712839 08 Okt 2026 14:32';
const parsedBCA = parseOCRText(sampleBCA);
assert.strictEqual(parsedBCA.amount, 1250000);
assert.strictEqual(parsedBCA.external_ref, '7712839');
assert(parsedBCA.confidence >= 0.9, 'Confidence BCA harus >= 0.9');

const sampleStruk = `
INDOMARET POINT
08/10/2026
1x Roti Tawar Rp 18.000
1x Susu Kotak Rp 20.500
TOTAL: Rp 38.500
REF: IND-88192
`;
const parsedStruk = parseOCRText(sampleStruk);
assert.strictEqual(parsedStruk.amount, 38500);
assert.strictEqual(parsedStruk.external_ref, 'IND-88192');
assert(parsedStruk.items && parsedStruk.items.length >= 2, 'Harus mengekstrak rincian item struk (FR-13, FR-16)');
console.log('   ✓ Template OCR & ekstraksi rincian item struk lulus.');

// ================= 4. QRIS Decoding (FR-19, 20) =================
console.log('4. Menguji Dekode QR QRIS Nasional...');
const qris = parseQRISCode('00020101021226610014ID.LINKAJA.WWW0118936009110023451000201');
assert.strictEqual(qris.merchant, 'KOPI KENANGAN GRAND INDONESIA');
assert.strictEqual(qris.nmid, 'ID102003881920');
assert.strictEqual(qris.amount, 28000);
console.log('   ✓ Dekode QRIS EMVCo lulus.');

// ================= 5. Logika Deteksi Duplikat (FR-26, 27, 28) =================
console.log('5. Menguji Deteksi Duplikat (Exact Ref & Fuzzy 10 Menit)...');
const testTxns = [
  {
    id: 't-dup-1',
    type: 'expense',
    amount: 75000,
    account_id: 'acc-bca',
    merchant: 'Superindo',
    external_ref: 'REF-EXACT-001',
    occurred_at: Date.now() - 4 * 60000,
    status: 'confirmed',
    source: 'ocr',
    created_at: Date.now(),
    updated_at: Date.now(),
  },
];

// Duplikat Kunci Pasti external_ref
const exactDup = detectDuplicate(
  { external_ref: 'REF-EXACT-001', amount: 75000 },
  testTxns
);
assert.strictEqual(exactDup.isDuplicate, true);
assert(exactDup.reason?.includes('REF-EXACT-001'));

// Duplikat Kunci Kabur (waktu 4 menit lalu, amount sama, merchant sama)
const fuzzyDup = detectDuplicate(
  { amount: 75000, account_id: 'acc-bca', merchant: 'Superindo', occurred_at: Date.now() },
  testTxns
);
assert.strictEqual(fuzzyDup.isDuplicate, true);

// Bukan Duplikat (beda nominal)
const notDup = detectDuplicate(
  { amount: 120000, account_id: 'acc-bca', merchant: 'Superindo', occurred_at: Date.now() },
  testTxns
);
assert.strictEqual(notDup.isDuplicate, false);
console.log('   ✓ Logika deteksi duplikat lulus.');

// ================= 6. Uji Database SQLite txn_item (PRD Bagian 9) =================
console.log('6. Menguji Database SQLite & Tabel Relasi txn_item...');
const testTxnId = 'txn-test-' + Date.now();
db.prepare(`
  INSERT INTO txn (id, type, amount, account_id, status, source, occurred_at, created_at, updated_at)
  VALUES (?, 'expense', 45000, 'acc-bca', 'confirmed', 'ocr', ?, ?, ?)
`).run(testTxnId, Date.now(), Date.now(), Date.now());

db.prepare(`
  INSERT INTO txn_item (id, txn_id, name, qty, total, category_id)
  VALUES (?, ?, 'Sabun Cuci', 1, 25000, 'cat-belanja'),
         (?, ?, 'Sikat Gigi', 2, 20000, 'cat-belanja')
`).run('item-t1', testTxnId, 'item-t2', testTxnId);

const itemsFromDb = db.prepare('SELECT * FROM txn_item WHERE txn_id = ?').all(testTxnId);
assert.strictEqual(itemsFromDb.length, 2);
assert.strictEqual(itemsFromDb[0].name, 'Sabun Cuci');

// Bersihkan data tes
db.prepare('DELETE FROM txn_item WHERE txn_id = ?').run(testTxnId);
db.prepare('DELETE FROM txn WHERE id = ?').run(testTxnId);
console.log('   ✓ Operasi SQLite txn_item lulus.');

console.log('=== SEMUA PENGUJIAN REGRESI GOLDEN DATASET LULUS 100% ===');
