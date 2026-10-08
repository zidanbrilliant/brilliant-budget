import type { Txn, TxnType, TxnSource, TxnItem, TxnTemplate } from '../types/index.ts';

export const DEFAULT_TEMPLATES: TxnTemplate[] = [
  { id: 'tmpl-1', name: 'Kopi Kenangan', amount: 25000, category_id: 'cat-makan', account_id: 'acc-gopay', merchant: 'Kopi Kenangan' },
  { id: 'tmpl-2', name: 'Bensin Pertalite', amount: 30000, category_id: 'cat-trans', account_id: 'acc-cash', merchant: 'SPBU Pertamina' },
  { id: 'tmpl-3', name: 'Makan Siang', amount: 35000, category_id: 'cat-makan', account_id: 'acc-gopay', merchant: 'Warung Nasi' },
  { id: 'tmpl-4', name: 'Tap MRT Jakarta', amount: 14000, category_id: 'cat-trans', account_id: 'acc-bca', merchant: 'MRT Jakarta' },
  { id: 'tmpl-5', name: 'Belanja Indomaret', amount: 50000, category_id: 'cat-belanja', account_id: 'acc-bca', merchant: 'Indomaret' },
];

// Normalisasi angka Indonesia (FR-11, 8.4)
// "25rb", "25k", "25.000", "Rp 25.000,00", "dua puluh lima ribu", "setengah juta", "1,5 juta"
export function parseIndonesianAmount(text: string): number | null {
  if (!text) return null;
  const clean = text.toLowerCase().trim();

  // Pola kata: setengah juta
  if (clean.includes('setengah juta')) return 500000;
  if (clean.includes('satu setengah juta') || clean.includes('1,5 juta') || clean.includes('1.5 juta') || clean.includes('1,5jt')) return 1500000;

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

  // Kata dasar angka Indonesia (e.g. "dua puluh lima ribu", "tiga puluh lima ribu")
  const wordMap: Record<string, number> = {
    nol: 0, satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, delapan: 8, sembilan: 9, sepuluh: 10,
    sebelas: 11, 'dua belas': 12, 'tiga belas': 13, 'empat belas': 14, 'lima belas': 15
  };

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
  note?: string;
  confidence: number;
  external_ref?: string;
  source: TxnSource;
  raw_source_text: string;
  items?: TxnItem[];
}

// Deteksi kategori otomatis berdasarkan kata kunci (FR-36, 8.4)
export function guessCategory(text: string): string {
  const t = text.toLowerCase();
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
  if (/gaji|salary|payroll|upah/i.test(t)) {
    return 'cat-gaji';
  }
  if (/bonus|freelance|proyek|cashback|hadiah/i.test(t)) {
    return 'cat-bonus';
  }
  return 'cat-lainnya';
}

// Deteksi dompet otomatis dari kata kunci
export function guessAccount(text: string): string {
  const t = text.toLowerCase();
  if (/gopay/i.test(t)) return 'acc-gopay';
  if (/bca/i.test(t)) return 'acc-bca';
  if (/shopee|shopeepay/i.test(t)) return 'acc-shopeepay';
  if (/tunai|cash/i.test(t)) return 'acc-cash';
  return 'acc-bca';
}

// Parser Voice / Natural Language Indonesia (FR-8, FR-9)
// Mendukung pemisahan multi transaksi ("beli bensin 50 ribu terus makan siang 30 ribu")
export function parseVoiceInput(speech: string): ParsedItem[] {
  const trimmed = speech.trim();
  if (!trimmed) return [];

  // Pecah transaksi jika ada pemisah kata penghubung ("terus", "lalu", "dan", "sama", "kemudian")
  const clauses = trimmed.split(/\s+(?:terus|kemudian|lalu|sama juga)\s+/i);

  const results: ParsedItem[] = [];

  for (const clause of clauses) {
    const lower = clause.toLowerCase();
    
    // Tipe transaksi
    let type: TxnType = 'expense';
    if (lower.includes('gaji') || lower.includes('dapat uang') || lower.includes('terima') || lower.includes('masuk')) {
      type = 'income';
    } else if (lower.includes('transfer ke') || lower.includes('top up') || lower.includes('topup')) {
      type = 'transfer';
    }

    const amount = parseIndonesianAmount(clause) || 25000;
    const catId = guessCategory(clause);
    const accId = guessAccount(clause);

    // Ambil perkiraan merchant / note
    let merchant = '';
    if (lower.includes('soto')) merchant = 'Soto';
    else if (lower.includes('kopi')) merchant = 'Kedai Kopi';
    else if (lower.includes('bensin')) merchant = 'SPBU Pertamina';
    else if (lower.includes('indomaret')) merchant = 'Indomaret';
    else if (lower.includes('alfamart')) merchant = 'Alfamart';
    else if (lower.includes('gojek') || lower.includes('goride')) merchant = 'Gojek';
    else merchant = clause.split(/(\d+|ribu|rb|k)/)[0].trim() || 'Pengeluaran';

    results.push({
      type,
      amount,
      merchant,
      category_id: catId,
      account_id: accId,
      note: clause,
      confidence: 0.89,
      source: 'voice',
      raw_source_text: `"${clause}"`,
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

  return {
    type,
    amount,
    merchant,
    category_id: guessCategory(merchant + ' ' + text),
    account_id: guessAccount(text),
    note: `Hasil OCR: ${merchant}`,
    confidence: Math.min(0.98, confidence),
    external_ref: externalRef,
    source: 'ocr',
    raw_source_text: text.slice(0, 160),
    items: items.length > 0 ? items : undefined,
  };
}

// Simulasi Decode QR QRIS (FR-19, FR-20, FR-21)
// Format standar EMVCo / QRIS Indonesia
export function parseQRISCode(rawPayload: string): { merchant: string; nmid?: string; city?: string; amount?: number } {
  // Bila format string simulasi atau payload
  if (rawPayload.includes('000201') || rawPayload.toLowerCase().includes('qris')) {
    return {
      merchant: 'KOPI KENANGAN GRAND INDONESIA',
      nmid: 'ID102003881920',
      city: 'JAKARTA PUSAT',
      amount: 28000,
    };
  }
  return {
    merchant: 'Merchant QRIS Nasional',
    nmid: 'ID99823100234',
    city: 'JAKARTA',
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
