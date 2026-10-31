import type { Txn, TxnType, TxnSource, TxnItem, TxnTemplate } from '../types/index.ts';
import { parseDateAndTime } from './dateParsing.ts';

export const DEFAULT_TEMPLATES: TxnTemplate[] = [
  { id: 'tmpl-1', name: 'Kopi Kenangan', amount: 25000, category_id: 'cat-makan', account_id: 'acc-gopay', merchant: 'Kopi Kenangan' },
  { id: 'tmpl-2', name: 'Bensin Pertalite', amount: 30000, category_id: 'cat-trans', account_id: 'acc-cash', merchant: 'SPBU Pertamina' },
  { id: 'tmpl-3', name: 'Makan Siang', amount: 35000, category_id: 'cat-makan', account_id: 'acc-gopay', merchant: 'Warung Nasi' },
  { id: 'tmpl-4', name: 'Tap MRT Jakarta', amount: 14000, category_id: 'cat-trans', account_id: 'acc-bca', merchant: 'MRT Jakarta' },
  { id: 'tmpl-5', name: 'Belanja Indomaret', amount: 50000, category_id: 'cat-belanja', account_id: 'acc-bca', merchant: 'Indomaret' },
];

// Normalisasi angka Indonesia (FR-11, 8.4)
// "25rb", "25k", "25.000", "Rp 25.000,00", "dua puluh lima ribu", "setengah juta", "1,5 juta"
const SPOKEN_UNITS: Record<string, number> = {
  nol: 0,
  satu: 1,
  dua: 2,
  tiga: 3,
  empat: 4,
  lima: 5,
  enam: 6,
  tujuh: 7,
  delapan: 8,
  sembilan: 9,
  sepuluh: 10,
  sebelas: 11,
  seratus: 100,
  seribu: 1000,
  sejuta: 1000000,
  semiliar: 1000000000,
};

function parseSpokenNumber(text: string): number | null {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length === 0) return null;

  let total = 0;
  let current = 0;
  let hasNumberWord = false;

  const addScale = (scale: number) => {
    total += (current || 1) * scale;
    current = 0;
  };

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (token === 'setengah') {
      // "setengah juta" = 500 ribu
      if (tokens[i + 1] === 'juta') {
        total += 500000;
        i++;
        hasNumberWord = true;
        continue;
      }
      if (tokens[i + 1] === 'ribu') {
        total += 500;
        i++;
        hasNumberWord = true;
        continue;
      }
    }

    if (token === 'seratus') {
      current += 100;
      hasNumberWord = true;
      continue;
    }
    if (token === 'seribu') {
      total += 1000;
      hasNumberWord = true;
      continue;
    }
    if (token === 'sejuta') {
      total += 1000000;
      hasNumberWord = true;
      continue;
    }
    if (token === 'semiliar') {
      total += 1000000000;
      hasNumberWord = true;
      continue;
    }

    if (token === 'puluh') {
      current = (current || 1) * 10;
      hasNumberWord = true;
      continue;
    }
    if (token === 'ratus') {
      current = (current || 1) * 100;
      hasNumberWord = true;
      continue;
    }
    if (token === 'ribu') {
      addScale(1000);
      hasNumberWord = true;
      continue;
    }
    if (token === 'juta') {
      addScale(1000000);
      hasNumberWord = true;
      continue;
    }
    if (token === 'miliar') {
      addScale(1000000000);
      hasNumberWord = true;
      continue;
    }

    const unit = SPOKEN_UNITS[token];
    if (unit !== undefined) {
      hasNumberWord = true;
      const next = tokens[i + 1];
      if (next === 'belas') {
        current += unit + 10;
        i++;
      } else if (next === 'puluh') {
        current += unit * 10;
        i++;
      } else if (next === 'ratus') {
        current += unit * 100;
        i++;
      } else if (next === 'ribu') {
        current += unit;
        total += current * 1000;
        current = 0;
        i++;
      } else if (next === 'juta') {
        current += unit;
        total += current * 1000000;
        current = 0;
        i++;
      } else if (next === 'miliar') {
        current += unit;
        total += current * 1000000000;
        current = 0;
        i++;
      } else {
        current += unit;
      }
    }
  }

  if (!hasNumberWord) return null;
  return total + current;
}

export function parseIndonesianAmount(text: string): number | null {
  if (!text) return null;
  const clean = text.toLowerCase().trim();

  // Pola kata: setengah juta
  if (clean.includes('setengah juta')) return 500000;
  if (clean.includes('satu setengah juta') || clean.includes('1,5 juta') || clean.includes('1.5 juta') || clean.includes('1,5jt')) return 1500000;

  // Angka yang diucapkan penuh: "dua puluh lima ribu", "seratus dua puluh ribu"
  if (!/\d/.test(clean)) {
    const spoken = parseSpokenNumber(clean);
    if (spoken && spoken > 0) return spoken;
  }

  // Pola juta: "2,5 juta", "3 juta", "2.5 jt"
  const jtMatch = clean.match(/([\d.,]+)\s*(juta|jt)/i);
  if (jtMatch) {
    const num = parseFloat(jtMatch[1].replace(',', '.'));
    if (!isNaN(num)) return Math.round(num * 1000000);
  }

  // Pola ribu / rb / k: "35rb", "35 k", "35 ribu", "35k"
  const rbMatch = clean.match(/([\d.,]+)\s*(ribu|rb|k)\b/i);
  if (rbMatch) {
    const num = parseFloat(rbMatch[1].replace(',', '.'));
    if (!isNaN(num)) return Math.round(num * 1000);
  }

  // Standar currency regex: "Rp 125.000", "125.000", "50000"
  const numMatches = clean.match(/(?:rp\.?|idr)?\s*(\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+)/i);
  if (numMatches) {
    const rawDigits = numMatches[1].replace(/\./g, '').replace(/,/g, '.');
    const val = parseFloat(rawDigits);
    if (!isNaN(val) && val > 0) return Math.round(val);
  }

  return null;
}

export interface ParsedItem {
  type: TxnType;
  amount: number;
  merchant?: string;
  category_id?: string;
  account_id?: string;
  to_account_id?: string;
  note?: string;
  confidence: number;
  external_ref?: string;
  occurred_at?: number;
  source: TxnSource;
  raw_source_text: string;
  items?: TxnItem[];
}

// Deteksi tipe transaksi dari kata kerja/kata benda yang paling awal muncul.
// "bayar gaji karyawan" tetap pengeluaran karena "bayar" disebut lebih dulu,
// sedangkan "dapat gaji kantor" adalah pemasukan karena "dapat" disebut lebih dulu.
type TxnTypeMarker = { type: TxnType; regex: RegExp };

const OWN_WALLET = 'gopay|bca|shopee(?:pay)?|ovo|dana|linkaja|tunai|cash';

const TXN_TYPE_MARKERS: TxnTypeMarker[] = [
  // Frasa pemasukan (lebih spesifik daripada kata tunggal "kirim"/"transfer").
  { type: 'income', regex: /\b(?:terima|menerima|dapat|dapet|mendapat)\s+(?:transfer|kiriman|uang)\b/i },
  { type: 'income', regex: /\b(?:transfer|uang)\s+(?:masuk|diterima)\b/i },
  { type: 'income', regex: /\bdikirim(?:kan)?\s+uang\b/i },
  { type: 'income', regex: /\b(?:ada\s+)?uang\s+masuk\b/i },
  { type: 'income', regex: /\b(?:dapat|dapet|mendapat|terima|menerima|diterima|ditransfer|transferan|dikasih|diberi|masuk|pemasukan|pendapatan)\b/i },
  { type: 'income', regex: /\b(?:gaji|gajian|salary|payroll|upah|honor|bonus|thr|komisi|cashback|hadiah|undian|untung|laba|jual|refund|dividen|bunga)\b/i },

  // Transfer hanya antar dompet sendiri (top up / isi saldo / pindah antar dompet).
  { type: 'transfer', regex: /\b(?:top\s*up|topup|isi\s+saldo|pindah\s+(?:dana|saldo)|transfer\s+antar\s+dompet)\b/i },
  { type: 'transfer', regex: new RegExp(`\\btransfer\\b[^,.]{0,30}?\\bke\\s+(?:${OWN_WALLET})\\b`, 'i') },

  // Frasa pengeluaran.
  { type: 'expense', regex: /\bkirim(?:kan)?\s+uang(?:\s+ke)?\b/i },
  { type: 'expense', regex: /\btransfer\s+(?:ke|keluar)\b/i },
  { type: 'expense', regex: /\b(?:bayar|membayar|pembayaran|beli|membeli|pembelian|belanja|jajan|keluar|pengeluaran|sewa|tagihan|utang|hutang|cicilan|donasi|sumbang)\b/i },
];

export function detectTxnType(text: string): TxnType {
  const lower = text.toLowerCase();
  let best: { type: TxnType; index: number; length: number } | null = null;

  for (const marker of TXN_TYPE_MARKERS) {
    const match = marker.regex.exec(lower);
    if (!match) continue;

    // Predikat paling awal menang. Jika mulai di posisi yang sama, frasa yang
    // lebih panjang menang ("transfer ke gopay" = transfer, bukan pengeluaran).
    if (
      !best ||
      match.index < best.index ||
      (match.index === best.index && match[0].length > best.length)
    ) {
      best = { type: marker.type, index: match.index, length: match[0].length };
    }
  }

  return best?.type ?? 'expense';
}

// Deteksi kategori otomatis berdasarkan kata kunci (FR-36, 8.4).
// `type` wajib diperhatikan agar pemasukan tidak pernah jatuh ke kategori
// pengeluaran (dan sebaliknya).
export function guessCategory(text: string, type: TxnType = 'expense'): string {
  const t = text.toLowerCase();

  if (type === 'income') {
    if (/gaji|gajian|salary|payroll|upah|honor/i.test(t)) {
      return 'cat-gaji';
    }
    if (/invest|dividen|saham|reksadana|deposito|bunga|cuan|profit/i.test(t)) {
      return 'cat-invest';
    }
    if (/hadiah|undian|doorprize|angpao|gift/i.test(t)) {
      return 'cat-hadiah';
    }
    if (/bonus|thr|tunjangan|komisi|freelance|proyek|cashback|refund|jual/i.test(t)) {
      return 'cat-bonus';
    }
    // Fallback pemasukan generik: "Uang Jajan & Hadiah".
    return 'cat-hadiah';
  }

  if (/makan|minum|kopi|soto|bakso|nasi|resto|warung|cafe|food|snack|gofood|grabfood|mcd|kfc/i.test(t)) {
    return 'cat-makan';
  }
  if (/bensin|pertalite|pertamax|grab|gojek|goride|gocar|mrt|krl|transjakarta|parkir|tol|ojek|taxi/i.test(t)) {
    return 'cat-trans';
  }
  if (/indomaret|alfamart|belanja|superindo|hypermart|sayur|pasar|shopee|tokopedia|lazada/i.test(t)) {
    return 'cat-belanja';
  }
  if (/pln|listrik|pdam|air|wifi|indihome|pulsa|paket data|bpjs|asuransi|sewa|kontrakan|kos/i.test(t)) {
    return 'cat-tagihan';
  }
  if (/nonton|cinema|xxi|game|steam|spotify|netflix|disney|karaoke|liburan/i.test(t)) {
    return 'cat-hiburan';
  }
  if (/obat|apotek|dokter|klinik|kimia farma|k24|vitamin|rumah sakit/i.test(t)) {
    return 'cat-kesehatan';
  }
  return 'cat-lainnya';
}

// Deteksi dompet tujuan transfer dari frasa "ke gopay", "top up bca", dst.
export function guessTransferTarget(text: string): string | undefined {
  const t = text.toLowerCase();
  const explicit = t.match(
    new RegExp(`\\bke\\s+(${OWN_WALLET})\\b`, 'i')
  );
  if (explicit) return guessAccount(explicit[1]);

  const topup = t.match(
    new RegExp(`\\b(?:top\\s*up|topup|isi(?:\\s+saldo)?)\\s+(${OWN_WALLET})\\b`, 'i')
  );
  if (topup) return guessAccount(topup[1]);

  return undefined;
}

// Deteksi dompet otomatis dari kata kunci
export function guessAccount(text: string): string {
  const t = text.toLowerCase();
  if (/\bgopay\b/i.test(t)) return 'acc-gopay';
  if (/\bbca\b/i.test(t)) return 'acc-bca';
  if (/\bshopee(?:pay)?\b/i.test(t)) return 'acc-shopeepay';
  if (/\btunai\b|\bcash\b/i.test(t)) return 'acc-cash';
  return 'acc-bca';
}

// Kata yang tidak perlu masuk judul transaksi hasil dikte
const VOICE_FILLER_WORDS = new Set([
  'beli', 'belanja', 'bayar', 'pake', 'pakai', 'dengan', 'via', 'dari', 'di', 'ke',
  'untuk', 'buat', 'sebesar', 'senilai', 'rp', 'rupiah', 'idr', 'tunai', 'cash',
  'gopay', 'bca', 'shopee', 'shopeepay', 'ovo', 'dana', 'linkaja', 'terus', 'lalu',
  'kemudian', 'dan', 'sama', 'juga', 'aku', 'saya', 'tadi', 'barusan', 'habis',
  'top', 'up', 'isi', 'transfer', 'masukkan', 'catat', 'pengeluaran', 'pemasukan',
  'nominal', 'uang', 'sebanyak',
  // Kata kerja yang menjelaskan arah uang, bukan nama transaksi.
  'dapat', 'dapet', 'mendapat', 'terima', 'menerima', 'diterima', 'masuk', 'keluar',
  'dikirim', 'dikirimkan', 'kirim', 'kirimkan', 'jual', 'menjual', 'membayar',
]);

const NUMBER_WORDS = new Set([
  ...Object.keys(SPOKEN_UNITS),
  'puluh', 'ratus', 'ribu', 'juta', 'miliar', 'belas', 'setengah', 'rb', 'jt', 'k',
]);

function extractVoiceMerchant(clause: string, type: TxnType): string {
  const cleaned = clause
    .toLowerCase()
    .replace(/\b\d[\d.,]*\b/g, ' ')
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(token => token && !VOICE_FILLER_WORDS.has(token) && !NUMBER_WORDS.has(token))
    .join(' ')
    .trim();

  if (!cleaned) {
    return type === 'income' ? 'Pemasukan' : type === 'transfer' ? 'Transfer' : 'Pengeluaran';
  }

  return cleaned
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Parser Voice / Natural Language Indonesia (FR-8, FR-9)
// Mendukung pemisahan multi transaksi ("beli bensin 50 ribu terus makan siang 30 ribu")
export function parseVoiceInput(speech: string): ParsedItem[] {
  const trimmed = speech.trim();
  if (!trimmed) return [];

  // Pecah transaksi jika ada pemisah kata penghubung ("terus", "lalu", "dan", "kemudian")
  const clauses = trimmed.split(/\s+(?:terus|kemudian|lalu|sama juga|dan)\s+/i);

  const results: ParsedItem[] = [];

  for (const clause of clauses) {
    const lower = clause.toLowerCase();
    if (!lower.trim()) continue;

    // Tipe transaksi: predikat paling awal menang.
    const type = detectTxnType(clause);

    const amount = parseIndonesianAmount(clause) ?? 0;
    const catId = guessCategory(clause, type);
    const merchant = extractVoiceMerchant(clause, type);

    let accId = guessAccount(clause);
    let toAccountId: string | undefined;
    if (type === 'transfer') {
      // Untuk transfer, dompet yang disebut adalah tujuan; sumbernya dompet lain.
      toAccountId = guessTransferTarget(clause) || guessAccount(clause);
      accId = toAccountId === 'acc-bca' ? 'acc-gopay' : 'acc-bca';
    }

    results.push({
      type,
      amount,
      merchant,
      category_id: type === 'transfer' ? undefined : catId,
      account_id: accId,
      to_account_id: toAccountId,
      note: clause.trim(),
      confidence: amount > 0 ? 0.92 : 0.45,
      source: 'voice',
      raw_source_text: `"${clause.trim()}"`,
    });
  }

  return results;
}

// Parser Bukti Transfer Bank / QRIS / Struk OCR (FR-13, FR-14, FR-15)
export function parseOCRText(text: string): ParsedItem {
  const lower = text.toLowerCase();
  let type: TxnType = 'expense';
  let confidence = 0.85;
  let merchant = 'Toko / Rekening';
  let externalRef: string | undefined;

  // Cek nomor referensi
  const refMatch = text.match(/(?:ref|referensi|no\.?\s*transaksi|id\s*transaksi)[\s:]*([a-zA-Z0-9_-]{5,20})/i);
  if (refMatch) {
    externalRef = refMatch[1].trim();
    confidence += 0.08;
  }

  // Template BCA
  if (lower.includes('bca') || lower.includes('m-bca') || lower.includes('transfer berhasil')) {
    const nameMatch = text.match(/(?:ke|penerima|tujuan)[\s:]*([A-Za-z\s]{3,30})/i);
    if (nameMatch) merchant = nameMatch[1].trim();
    else merchant = 'Transfer BCA';
  }
  // Template GoPay / QRIS
  else if (lower.includes('gopay') || lower.includes('qris')) {
    const qrisMatch = text.match(/(?:merchant|kepada|pembayaran ke)[\s:]*([A-Za-z0-9\s]{3,30})/i);
    if (qrisMatch) merchant = qrisMatch[1].trim();
    else merchant = 'Merchant QRIS';
  }
  // Struk Minimarket
  else if (lower.includes('indomaret') || lower.includes('alfamart')) {
    merchant = lower.includes('indomaret') ? 'Indomaret' : 'Alfamart';
  }

  // Cari nominal total: prioritaskan baris TOTAL / JUMLAH daripada item individual
  let amount = 0;
  const explicitTotalMatch =
    text.match(/(?:total|grand\s*total|jumlah)[\s.:]*(?:rp\.?|idr)?[\s.:]*([\d.,]+)/i);
  if (explicitTotalMatch) {
    const parsed = parseIndonesianAmount(explicitTotalMatch[1]);
    if (parsed) amount = parsed;
  }
  if (!amount) {
    const totalMatch = text.match(/(?:nominal|sebesar|rp)[\s.:]*([\d.,]+)/i);
    if (totalMatch) {
      const parsed = parseIndonesianAmount(totalMatch[1]);
      if (parsed) amount = parsed;
    }
  }
  if (!amount) {
    const fallback = parseIndonesianAmount(text);
    amount = fallback || 50000;
  }

  // Ekstraksi rincian item struk (FR-13, FR-16)
  const items: TxnItem[] = [];
  const lines = text.split('\n');
  for (const line of lines) {
    const itemMatch = line.match(/(?:(\d+)x?\s+)?([A-Za-z\s]+?)\s+(?:rp\.?|idr)?\s*([\d.,]+)/i);
    if (itemMatch && !/total|subtotal|tunai|kembalian|ref|tanggal/i.test(itemMatch[2])) {
      const qty = itemMatch[1] ? parseInt(itemMatch[1], 10) : 1;
      const itemName = itemMatch[2].trim();
      const itemAmount = parseIndonesianAmount(itemMatch[3]);
      if (itemName.length > 2 && itemAmount && itemAmount > 0 && itemAmount < amount * 1.5) {
        items.push({
          id: 'item-' + Math.random().toString(36).slice(2, 7),
          name: itemName,
          qty: qty || 1,
          total: itemAmount,
          category_id: guessCategory(itemName),
        });
      }
    }
  }

  // Ekstraksi tanggal/jam transaksi untuk struk dan bukti transfer.
  const dateMatch =
    text.match(/\b\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}\b/) ||
    text.match(/\b\d{1,2}\s+(?:jan|feb|mar|apr|mei|jun|jul|agu|agt|sep|okt|nov|des)[a-z]*\s+\d{2,4}\b/i) ||
    text.match(/\b\d{4}-\d{2}-\d{2}\b/);
  const timeMatch = text.match(/\b\d{1,2}[:.]\d{2}(?::\d{2})?\b(?!\d)/);
  const occurredAt = dateMatch ? parseDateAndTime(dateMatch[0], timeMatch?.[0]) : undefined;

  return {
    type,
    amount,
    merchant,
    category_id: guessCategory(merchant + ' ' + text),
    account_id: guessAccount(text),
    note: `Hasil OCR: ${merchant}`,
    confidence: Math.min(0.98, confidence),
    external_ref: externalRef,
    occurred_at: occurredAt,
    source: 'ocr',
    raw_source_text: text.slice(0, 160),
    items: items.length > 0 ? items : undefined,
  };
}

// Deteksi Duplikat (FR-26, FR-27, FR-28)
// Kunci pasti: external_ref
// Kunci kabur: rentang waktu ±10 menit + amount sama + account_id / merchant mirip
export function detectDuplicate(candidate: Partial<Txn>, existingTxns: Txn[]): { isDuplicate: boolean; match?: Txn; reason?: string } {
  if (!candidate.amount) return { isDuplicate: false };

  // Kunci pasti external_ref
  if (candidate.external_ref) {
    const exact = existingTxns.find(
      t => !t.deleted_at && t.external_ref && t.external_ref.toLowerCase() === candidate.external_ref?.toLowerCase()
    );
    if (exact) {
      return {
        isDuplicate: true,
        match: exact,
        reason: `Nomor referensi sama (${candidate.external_ref})`,
      };
    }
  }

  // Kunci kabur waktu ±10 menit & amount sama
  const candTime = candidate.occurred_at || Date.now();
  const tenMins = 10 * 60 * 1000;

  const fuzzy = existingTxns.find(t => {
    if (t.deleted_at) return false;
    if (t.amount !== candidate.amount) return false;
    const diff = Math.abs(t.occurred_at - candTime);
    if (diff > tenMins) return false;
    
    // Periksa kesamaan merchant atau dompet
    const sameAcc = t.account_id === candidate.account_id;
    const sameMerchant = candidate.merchant && t.merchant &&
      candidate.merchant.toLowerCase().includes(t.merchant.toLowerCase());
    return sameAcc || sameMerchant;
  });

  if (fuzzy) {
    return {
      isDuplicate: true,
      match: fuzzy,
      reason: `Transaksi serupa dengan nominal Rp ${candidate.amount?.toLocaleString('id-ID')} ditemukan dalam rentang 10 menit`,
    };
  }

  return { isDuplicate: false };
}
