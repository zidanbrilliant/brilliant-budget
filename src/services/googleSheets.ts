// ponytail: simple Google Apps Script webhook sync with localStorage queue fallback
export interface SheetRowPayload {
  date: string;
  type: string;
  category: string;
  amount: number;
  account: string;
  note: string;
  source: string;
}

const STORAGE_URL_KEY = 'bb_gsheet_url';
const STORAGE_QUEUE_KEY = 'bb_gsheet_queue';

export function getSheetWebhookUrl(): string {
  return localStorage.getItem(STORAGE_URL_KEY) || '';
}

export function setSheetWebhookUrl(url: string): void {
  localStorage.setItem(STORAGE_URL_KEY, url.trim());
}

export function getQueue(): SheetRowPayload[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveQueue(queue: SheetRowPayload[]): void {
  localStorage.setItem(STORAGE_QUEUE_KEY, JSON.stringify(queue));
}

export async function sendToWebhook(url: string, payload: SheetRowPayload | SheetRowPayload[]): Promise<boolean> {
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

export async function syncTransactionToSheet(payload: SheetRowPayload): Promise<void> {
  const url = getSheetWebhookUrl();
  if (!url) return;

  if (!navigator.onLine) {
    const queue = getQueue();
    queue.push(payload);
    saveQueue(queue);
    return;
  }

  const success = await sendToWebhook(url, payload);
  if (!success) {
    const queue = getQueue();
    queue.push(payload);
    saveQueue(queue);
  }
}

export async function flushSheetQueue(): Promise<number> {
  const url = getSheetWebhookUrl();
  const queue = getQueue();
  if (!url || queue.length === 0 || !navigator.onLine) return 0;

  const count = queue.length;
  const success = await sendToWebhook(url, queue);
  if (success) {
    saveQueue([]);
    return count;
  }
  return 0;
}

export const GOOGLE_APPS_SCRIPT_TEMPLATE = `function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["Tanggal", "Tipe", "Kategori", "Nominal", "Dompet", "Catatan", "Sumber"]);
  }
  var data = JSON.parse(e.postData.contents);
  if (Array.isArray(data)) {
    data.forEach(function(r) {
      sheet.appendRow([r.date, r.type, r.category, r.amount, r.account, r.note, r.source]);
    });
  } else {
    sheet.appendRow([data.date, data.type, data.category, data.amount, data.account, data.note, data.source]);
  }
  return ContentService.createTextOutput("OK").setMimeType(ContentService.MimeType.TEXT);
}`;
