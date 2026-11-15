// ponytail: simple Google Apps Script 2-way sync with localStorage queue & auto-merge
import type {
  Account,
  AppSettings,
  BudgetPlan,
  Category,
  Goal,
  RecurringRule,
  Txn,
  TxnSource,
  TxnType,
} from '../types/index.ts';
import { parseDateAndTime } from '../utils/dateParsing.ts';

export interface SheetRowPayload {
  id?: string;
  date: string;
  type: string;
  category: string;
  amount: number;
  account: string;
  to_account?: string;
  note: string;
  source: string;
  action?: 'save' | 'delete';
}

export interface MergeResult {
  merged: Txn[];
  addedCount: number;
  updatedCount: number;
  newAccounts?: Account[];
}

// Dompet, kategori, budget, langganan, target, dan setelan. Transaksi tetap
// memakai sheet utama agar format lama tetap kompatibel.
export interface ConfigSnapshot {
  accounts: Account[];
  categories: Category[];
  budget?: BudgetPlan;
  recurring?: RecurringRule[];
  goals?: Goal[];
  settings?: AppSettings;
}

export interface ConfigPullResult {
  version: number;
  config: ConfigSnapshot | null;
  updatedAt: number;
}

export interface ConfigSyncResult {
  ok: boolean;
  message: string;
}

const STORAGE_URL_KEY = 'bb_gsheet_url';
const STORAGE_QUEUE_KEY = 'bb_gsheet_queue';
const STORAGE_LAST_PULL_KEY = 'bb_gsheet_last_pull';
const STORAGE_CONFIG_ENABLED_KEY = 'bb_gsheet_config_enabled';
const STORAGE_CONFIG_UPDATED_KEY = 'bb_gsheet_config_updated_at';

export function getSheetWebhookUrl(): string {
  try {
    return localStorage.getItem(STORAGE_URL_KEY) || '';
  } catch {
    return '';
  }
}

export function setSheetWebhookUrl(url: string): void {
  try {
    localStorage.setItem(STORAGE_URL_KEY, url.trim());
  } catch {}
}

export function getLastPullTime(): number {
  try {
    return Number(localStorage.getItem(STORAGE_LAST_PULL_KEY)) || 0;
  } catch {
    return 0;
  }
}

export function setLastPullTime(time: number): void {
  try {
    localStorage.setItem(STORAGE_LAST_PULL_KEY, String(time));
  } catch {}
}

export function isConfigSyncEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_CONFIG_ENABLED_KEY) === '1';
  } catch {
    return false;
  }
}

export function setConfigSyncEnabled(enabled: boolean): void {
  try {
    if (enabled) {
      localStorage.setItem(STORAGE_CONFIG_ENABLED_KEY, '1');
    } else {
      localStorage.removeItem(STORAGE_CONFIG_ENABLED_KEY);
    }
  } catch {}
}

export function clearSheetSyncState(): void {
  try {
    localStorage.removeItem(STORAGE_QUEUE_KEY);
    localStorage.removeItem(STORAGE_LAST_PULL_KEY);
    localStorage.removeItem(STORAGE_CONFIG_ENABLED_KEY);
    localStorage.removeItem(STORAGE_CONFIG_UPDATED_KEY);
  } catch {}
}

export function getLastConfigUpdatedAt(): number {
  try {
    return Number(localStorage.getItem(STORAGE_CONFIG_UPDATED_KEY)) || 0;
  } catch {
    return 0;
  }
}

export function setLastConfigUpdatedAt(time: number): void {
  try {
    localStorage.setItem(STORAGE_CONFIG_UPDATED_KEY, String(time));
  } catch {}
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Sanitasi payload Config dari Google Sheets. Minimal harus ada dompet dan
 * kategori yang valid agar restore tidak mengosongkan aplikasi.
 */
export function normalizeConfigSnapshot(raw: unknown): ConfigSnapshot | null {
  const record = asRecord(raw);
  if (!record) return null;

  const accounts = Array.isArray(record.accounts)
    ? record.accounts.filter((item): item is Account => {
        const row = asRecord(item);
        return (
          !!row &&
          typeof row.id === 'string' &&
          row.id.length > 0 &&
          typeof row.name === 'string' &&
          typeof row.type === 'string'
        );
      })
    : [];
  const categories = Array.isArray(record.categories)
    ? record.categories.filter((item): item is Category => {
        const row = asRecord(item);
        return (
          !!row &&
          typeof row.id === 'string' &&
          row.id.length > 0 &&
          typeof row.name === 'string' &&
          (row.kind === 'expense' || row.kind === 'income')
        );
      })
    : [];

  if (accounts.length === 0 || categories.length === 0) return null;

  const budget = asRecord(record.budget);
  const settings = asRecord(record.settings);
  const recurring = Array.isArray(record.recurring)
    ? (record.recurring.filter(item => asRecord(item) !== null) as RecurringRule[])
    : undefined;
  const goals = Array.isArray(record.goals)
    ? (record.goals.filter(item => asRecord(item) !== null) as Goal[])
    : undefined;

  return {
    accounts,
    categories,
    budget: budget ? (budget as unknown as BudgetPlan) : undefined,
    recurring,
    goals,
    settings: settings ? (settings as unknown as AppSettings) : undefined,
  };
}

/**
 * Versi 1 hanya punya endpoint transaksi. Versi 2 menambahkan `action=config`.
 * Jangan pernah POST config ke skrip v1 karena akan masuk ke sheet transaksi.
 */
export async function pullConfigFromSheet(url: string): Promise<ConfigPullResult> {
  if (!url) return { version: 0, config: null, updatedAt: 0 };

  try {
    const separator = url.includes('?') ? '&' : '?';
    const response = await fetch(`${url}${separator}action=config`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) return { version: 0, config: null, updatedAt: 0 };

    const text = await response.text();
    if (!text || text.trim().startsWith('<')) {
      return { version: 0, config: null, updatedAt: 0 };
    }

    const parsed = JSON.parse(text) as Record<string, unknown>;
    const version = Number(parsed.version) || 1;
    const config = normalizeConfigSnapshot(parsed.config);
    const updatedAt = Number(parsed.updated_at) || 0;

    return { version, config, updatedAt };
  } catch (err) {
    console.warn('Google Sheets config pull failed:', err);
    return { version: 0, config: null, updatedAt: 0 };
  }
}

const verifiedConfigUrls = new Set<string>();

export function resetConfigVerification(url?: string): void {
  if (url) {
    verifiedConfigUrls.delete(url);
  } else {
    verifiedConfigUrls.clear();
  }
}

export async function pushConfigToSheet(
  url: string,
  config: ConfigSnapshot
): Promise<ConfigSyncResult> {
  if (!url) {
    return { ok: false, message: 'Isi URL Webhook Google Sheets terlebih dahulu.' };
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { ok: false, message: 'Sedang offline. Sambungkan internet lalu coba lagi.' };
  }

  // Cek versi dulu supaya skrip lama tidak menerima payload config sebagai baris transaksi.
  if (!verifiedConfigUrls.has(url)) {
    const pulled = await pullConfigFromSheet(url);
    if (pulled.version < 2) {
      return {
        ok: false,
        message:
          pulled.version === 1
            ? 'Skrip Apps Script masih versi lama. Perbarui kode skrip ke v2 (ada sheet Config), lalu Deploy ulang.'
            : 'Tidak bisa memverifikasi skrip. Pastikan URL Web App benar dan akses deployment "Anyone".',
      };
    }
    verifiedConfigUrls.add(url);
  }

  try {
    const now = Date.now();
    // no-cors seperti sync transaksi: Apps Script mengembalikan redirect yang
    // tidak bisa dibaca browser, tetapi request tetap diproses.
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        action: 'config',
        config,
        updated_at: now,
      }),
    });
    setLastConfigUpdatedAt(now);
    return { ok: true, message: 'Konfigurasi tersimpan ke Google Sheets.' };
  } catch (err) {
    console.warn('Google Sheets config push failed:', err);
    verifiedConfigUrls.delete(url);
    return { ok: false, message: 'Gagal mengirim konfigurasi. Periksa koneksi dan deployment.' };
  }
}

export function getQueue(): SheetRowPayload[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveQueue(queue: SheetRowPayload[]): void {
  try {
    localStorage.setItem(STORAGE_QUEUE_KEY, JSON.stringify(queue));
  } catch {}
}

export async function sendToWebhook(
  url: string,
  payload: SheetRowPayload | SheetRowPayload[]
): Promise<boolean> {
  if (!url) return false;
  try {
    // ponytail: no-cors mode allows posting to Google Apps Script without CORS redirect failure
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload),
    });
    return true;
  } catch (err) {
    console.warn('Google Sheets sync failed:', err);
    return false;
  }
}

export async function pullTransactionsFromSheet(url: string): Promise<SheetRowPayload[]> {
  if (!url) return [];
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return [];
    const text = await response.text();
    if (!text || text.trim().startsWith('<')) return [];
    const parsed = JSON.parse(text);
    const rows = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.data)
      ? parsed.data
      : [];
    return rows;
  } catch (err) {
    console.warn('Google Sheets pull failed:', err);
    return [];
  }
}

export async function syncTransactionToSheet(payload: SheetRowPayload): Promise<void> {
  const url = getSheetWebhookUrl();
  if (!url) return;

  const enqueue = (item: SheetRowPayload) => {
    const queue = getQueue();
    const idx = queue.findIndex(q => q.id && q.id === item.id);
    if (idx >= 0) {
      queue[idx] = item;
    } else {
      queue.push(item);
    }
    saveQueue(queue);
  };

  if (!navigator.onLine) {
    enqueue(payload);
    return;
  }

  const success = await sendToWebhook(url, payload);
  if (!success) {
    enqueue(payload);
  }
}

export async function flushSheetQueue(verify = true): Promise<number> {
  const url = getSheetWebhookUrl();
  const queue = getQueue();
  if (!url || queue.length === 0 || !navigator.onLine) return 0;

  const count = queue.length;
  const success = await sendToWebhook(url, queue);
  if (!success) return 0;

  if (verify) {
    try {
      const remote = await pullTransactionsFromSheet(url);
      const remoteIdSet = new Set((remote || []).map(r => r.id).filter(Boolean));
      const remaining = queue.filter(q => {
        if (!q.id) return false;
        if (q.action === 'delete') {
          return remoteIdSet.has(q.id);
        }
        return !remoteIdSet.has(q.id);
      });
      saveQueue(remaining);
      return count - remaining.length;
    } catch (err) {
      console.warn('Queue verification failed, retaining queue:', err);
      return 0;
    }
  }

  saveQueue([]);
  return count;
}

function resolveCategoryId(name: string, categories: Category[]): string {
  const clean = (name || '').trim().toLowerCase();
  if (!clean) return 'cat-lainnya';
  const exact = categories.find(c => c.name.toLowerCase() === clean);
  if (exact) return exact.id;
  const byId = categories.find(c => c.id.toLowerCase() === clean);
  if (byId) return byId.id;
  const partial = categories.find(
    c => c.name.toLowerCase().includes(clean) || clean.includes(c.name.toLowerCase())
  );
  if (partial) return partial.id;
  return 'cat-lainnya';
}

export function inferAccountProperties(name: string): {
  type: Account['type'];
  icon: string;
  color: string;
} {
  const clean = (name || '').toLowerCase();
  if (clean.includes('cash') || clean.includes('tunai') || clean.includes('dompet')) {
    return { type: 'cash', icon: 'Banknote', color: '#16A34A' };
  }
  if (
    clean.includes('gopay') ||
    clean.includes('ovo') ||
    clean.includes('dana') ||
    clean.includes('shopee') ||
    clean.includes('linkaja') ||
    clean.includes('wallet')
  ) {
    return { type: 'ewallet', icon: 'Smartphone', color: '#06B6D4' };
  }
  if (clean.includes('kredit') || clean.includes('cc') || clean.includes('credit')) {
    return { type: 'credit_card', icon: 'CreditCard', color: '#9333EA' };
  }
  return { type: 'bank', icon: 'Landmark', color: '#2563EB' };
}

export function resolveOrDiscoverAccountId(
  name: string,
  accounts: Account[],
  discoveredAccounts: Account[] = []
): string {
  const clean = (name || '').trim();
  if (!clean) return accounts[0]?.id || 'acc-bca';

  const lower = clean.toLowerCase();
  const exact = accounts.find(a => a.name.toLowerCase() === lower);
  if (exact) return exact.id;
  const byId = accounts.find(a => a.id.toLowerCase() === lower);
  if (byId) return byId.id;
  const partial = accounts.find(
    a => a.name.toLowerCase().includes(lower) || lower.includes(a.name.toLowerCase())
  );
  if (partial) return partial.id;

  const exactDisc = discoveredAccounts.find(a => a.name.toLowerCase() === lower);
  if (exactDisc) return exactDisc.id;

  // Auto-discover new account from sheet row
  const props = inferAccountProperties(clean);
  const slug = clean.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 15) || 'wallet';
  const newAcc: Account = {
    id: `acc-${slug}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: clean,
    type: props.type,
    currency: 'IDR',
    opening_balance: 0,
    icon: props.icon,
    color: props.color,
    is_archived: false,
    created_at: Date.now(),
    updated_at: Date.now(),
  };

  discoveredAccounts.push(newAcc);
  accounts.push(newAcc);
  return newAcc.id;
}

export function formatTxnForSheetPayload(
  txn: Txn,
  categories: Category[],
  accounts: Account[],
  action: 'save' | 'delete' = 'save'
): SheetRowPayload {
  const catName = txn.category_id
    ? (categories.find(c => c.id === txn.category_id)?.name || 'Lainnya')
    : (txn.type === 'transfer' ? 'Transfer' : 'Lainnya');
  const accName = accounts.find(a => a.id === txn.account_id)?.name || 'Dompet';
  const toAccName = txn.to_account_id
    ? (accounts.find(a => a.id === txn.to_account_id)?.name || '')
    : '';
  const dateStr = new Date(txn.occurred_at).toLocaleString('sv-SE');
  const noteStr = txn.merchant
    ? `${txn.merchant} ${txn.note ? `(${txn.note})` : ''}`.trim()
    : (txn.note || '-');

  return {
    id: txn.id,
    date: dateStr,
    type: txn.type,
    category: action === 'delete' ? '' : catName,
    amount: txn.amount,
    account: action === 'delete' ? '' : (toAccName ? `${accName} -> ${toAccName}` : accName),
    to_account: action === 'delete' ? undefined : (toAccName || undefined),
    note: action === 'delete' ? '' : noteStr,
    source: txn.source,
    action,
  };
}

export function mergeSheetRows(
  localTxns: Txn[],
  sheetRows: SheetRowPayload[],
  categories: Category[],
  accounts: Account[]
): MergeResult {
  const localMap = new Map<string, Txn>();
  const fingerprints = new Set<string>();

  for (const t of localTxns) {
    localMap.set(t.id, t);
    const minute = Math.round(t.occurred_at / 60000);
    fingerprints.add(`${minute}_${t.amount}_${t.type}_${t.account_id}`);
  }

  let addedCount = 0;
  let updatedCount = 0;
  const result: Txn[] = [...localTxns];
  const discoveredAccounts: Account[] = [];
  const currentAccounts = [...accounts];

  for (const row of sheetRows) {
    if (row.action === 'delete') continue;
    const rawAmount = Number(row.amount);
    if (!Number.isFinite(rawAmount) || rawAmount <= 0) continue;

    const rowId = (row.id || '').trim();
    const catId = resolveCategoryId(row.category, categories);
    const parsedDate = parseDateAndTime(row.date);
    const occurredAt = Number.isFinite(parsedDate) && parsedDate > 0 ? parsedDate : Date.now();
    const type: TxnType =
      row.type === 'income' ? 'income' : row.type === 'transfer' ? 'transfer' : 'expense';
    const note = (row.note || '').trim();
    const source: TxnSource = (row.source as TxnSource) || 'import';

    let accId = '';
    let toAccId: string | undefined = undefined;

    if (
      type === 'transfer' &&
      row.account &&
      (row.account.includes('->') ||
        row.account.includes('→') ||
        row.account.toLowerCase().includes(' ke '))
    ) {
      const separator = row.account.includes('->')
        ? '->'
        : row.account.includes('→')
        ? '→'
        : ' ke ';
      const parts = row.account.split(separator);
      if (parts.length >= 2) {
        accId = resolveOrDiscoverAccountId(parts[0].trim(), currentAccounts, discoveredAccounts);
        toAccId = resolveOrDiscoverAccountId(
          row.to_account || parts[1].trim(),
          currentAccounts,
          discoveredAccounts
        );
      }
    }

    if (!accId) {
      accId = resolveOrDiscoverAccountId(row.account, currentAccounts, discoveredAccounts);
    }
    if (type === 'transfer' && !toAccId && row.to_account) {
      toAccId = resolveOrDiscoverAccountId(row.to_account, currentAccounts, discoveredAccounts);
    }

    if (rowId && localMap.has(rowId)) {
      const existing = localMap.get(rowId)!;
      // Safeguard tombstone: jangan hidupkan kembali transaksi yang sudah dihapus secara lokal
      if (existing.deleted_at) {
        continue;
      }

      // Check if anything changed
      if (
        existing.amount !== rawAmount ||
        existing.type !== type ||
        existing.category_id !== catId ||
        existing.account_id !== accId ||
        existing.to_account_id !== toAccId ||
        existing.note !== note
      ) {
        const idx = result.findIndex(t => t.id === rowId);
        if (idx >= 0) {
          result[idx] = {
            ...existing,
            amount: rawAmount,
            type,
            category_id: catId,
            account_id: accId,
            to_account_id: toAccId,
            note,
            updated_at: Date.now(),
          };
          updatedCount++;
        }
      }
      continue;
    }

    // No rowId, check fingerprint
    const minute = Math.round(occurredAt / 60000);
    const fp = `${minute}_${rawAmount}_${type}_${accId}`;
    if (!rowId && fingerprints.has(fp)) {
      continue;
    }

    const newTxn: Txn = {
      id: rowId || `txn-sheet-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      amount: rawAmount,
      account_id: accId,
      to_account_id: toAccId,
      category_id: catId,
      note,
      status: 'confirmed',
      source,
      occurred_at: occurredAt,
      confidence: 1.0,
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    result.push(newTxn);
    localMap.set(newTxn.id, newTxn);
    fingerprints.add(fp);
    addedCount++;
  }

  // Sort descending by occurred_at
  result.sort((a, b) => b.occurred_at - a.occurred_at);

  return {
    merged: result,
    addedCount,
    updatedCount,
    newAccounts: discoveredAccounts.length > 0 ? discoveredAccounts : undefined,
  };
}

export const GOOGLE_APPS_SCRIPT_TEMPLATE = `function json_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function getTransactionsSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var named = ss.getSheetByName('Transaksi');
  if (named) return named;
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var sheet = sheets[i];
    if (sheet.getName() === 'Config') continue;
    var firstCell = String(sheet.getRange(1, 1).getValue() || '').trim().toLowerCase();
    if (firstCell === 'id' || firstCell === 'tanggal' || firstCell === 'date') return sheet;
  }
  for (var j = 0; j < sheets.length; j++) {
    if (sheets[j].getName() !== 'Config') return sheets[j];
  }
  return ss.insertSheet('Transaksi');
}

function doGet(e) {
  var action = e && e.parameter ? String(e.parameter.action || '') : '';
  if (action === 'config') return getConfig_();
  if (action === 'version') return json_({ status: 'ok', version: 2 });
  return getTransactions_();
}

function getConfig_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Config');
  if (!sheet || sheet.getLastRow() < 2) {
    return json_({ status: 'ok', version: 2, config: null, updated_at: 0 });
  }

  var values = sheet.getDataRange().getValues();
  var map = {};
  for (var i = 1; i < values.length; i++) {
    var key = String(values[i][0] || '').trim().toLowerCase();
    if (key) map[key] = values[i][1];
  }

  function parseKey(key, fallback) {
    try {
      var raw = map[key];
      if (raw === undefined || raw === null || String(raw).trim() === '') return fallback;
      return JSON.parse(String(raw));
    } catch (err) {
      return fallback;
    }
  }

  var config = {
    accounts: parseKey('accounts', []),
    categories: parseKey('categories', []),
    budget: parseKey('budget', null),
    recurring: parseKey('recurring', []),
    goals: parseKey('goals', []),
    settings: parseKey('settings', null)
  };

  return json_({
    status: 'ok',
    version: 2,
    config: config,
    updated_at: Number(map['updated_at']) || 0
  });
}

function getTransactions_() {
  var sheet = getTransactionsSheet_();
  var values = sheet.getDataRange().getValues();
  if (!values || values.length <= 1) {
    return json_({ status: 'ok', version: 2, data: [] });
  }
  var header = values[0].map(function(h) { return String(h || '').trim().toLowerCase(); });
  var hasId = header[0] === 'id';
  var tz = Session.getScriptTimeZone() || 'Asia/Jakarta';
  var rows = [];

  function formatCell(val) {
    if (val instanceof Date) {
      return Utilities.formatDate(val, tz, 'yyyy-MM-dd HH:mm:ss');
    }
    return val === null || val === undefined ? '' : String(val);
  }

  for (var i = 1; i < values.length; i++) {
    var r = values[i];
    if (!r || r.length === 0) continue;
    var rawDate = formatCell(r[hasId ? 1 : 0]).trim();
    if (!rawDate) continue;

    rows.push({
      id: hasId ? formatCell(r[0]).trim() : '',
      date: rawDate,
      type: formatCell(r[hasId ? 2 : 1]).trim().toLowerCase() || 'expense',
      category: formatCell(r[hasId ? 3 : 2]).trim(),
      amount: Number(r[hasId ? 4 : 3]) || 0,
      account: formatCell(r[hasId ? 5 : 4]).trim(),
      note: formatCell(r[hasId ? 6 : 5]).trim(),
      source: formatCell(r[hasId ? 7 : 6]).trim() || 'sheet'
    });
  }

  return json_({ status: 'ok', version: 2, data: rows });
}

function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  if (data && data.action === 'config') {
    return saveConfig_(data);
  }
  return saveTransactions_(data);
}

function saveConfig_(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Config');
  if (!sheet) sheet = ss.insertSheet('Config');

  var config = data.config || {};
  var rows = [
    ['Key', 'Value'],
    ['accounts', JSON.stringify(config.accounts || [])],
    ['categories', JSON.stringify(config.categories || [])],
    ['budget', JSON.stringify(config.budget || null)],
    ['recurring', JSON.stringify(config.recurring || [])],
    ['goals', JSON.stringify(config.goals || [])],
    ['settings', JSON.stringify(config.settings || null)],
    ['updated_at', String(Number(data.updated_at) || Date.now())],
    ['version', '2']
  ];

  sheet.clear();
  sheet.getRange(1, 1, rows.length, 2).setValues(rows);
  sheet.setColumnWidth(2, 480);

  return json_({ status: 'ok', version: 2, saved: true });
}

function saveTransactions_(data) {
  var sheet = getTransactionsSheet_();
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["ID", "Tanggal", "Tipe", "Kategori", "Nominal", "Dompet", "Catatan", "Sumber"]);
  }
  var items = Array.isArray(data) ? data : [data];
  var values = sheet.getDataRange().getValues();
  var header = (values[0] || []).map(function(h) { return String(h || '').trim().toLowerCase(); });
  var hasId = header[0] === 'id';

  var deletes = [];
  var upserts = [];
  items.forEach(function(r) {
    if (r && r.action === 'delete') {
      deletes.push(String(r.id || '').trim());
    } else if (r) {
      upserts.push(r);
    }
  });

  if (deletes.length > 0 && hasId && values.length > 1) {
    var deleteSet = {};
    deletes.forEach(function(id) { if (id) deleteSet[id] = true; });
    for (var i = values.length - 1; i >= 1; i--) {
      var rowId = String(values[i][0] || '').trim();
      if (deleteSet[rowId]) {
        sheet.deleteRow(i + 1);
      }
    }
    if (upserts.length > 0) {
      values = sheet.getDataRange().getValues();
    }
  }

  var idRowMap = {};
  if (hasId && values.length > 1) {
    for (var j = 1; j < values.length; j++) {
      var existingId = String(values[j][0] || '').trim();
      if (existingId) idRowMap[existingId] = j + 1;
    }
  }

  upserts.forEach(function(r) {
    var id = String(r.id || '').trim();
    var rowData = hasId
      ? [id, r.date, r.type, r.category, r.amount, r.account, r.note, r.source]
      : [r.date, r.type, r.category, r.amount, r.account, r.note, r.source];

    if (hasId && id && idRowMap[id]) {
      sheet.getRange(idRowMap[id], 1, 1, rowData.length).setValues([rowData]);
    } else {
      sheet.appendRow(rowData);
      if (hasId && id) idRowMap[id] = sheet.getLastRow();
    }
  });

  return json_({ status: 'ok', version: 2, count: items.length });
}`;
