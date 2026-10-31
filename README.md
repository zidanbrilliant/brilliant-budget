# Brilliant Budget (PWA Offline-First + Google Sheets Sync)

Aplikasi pencatatan keuangan pribadi offline-first, cepat, dengan penyimpanan data lokal di perangkat, OCR nota & dikte suara lokal on-device, serta sinkronisasi otomatis ke Google Sheets.

---

## 1. Deploy ke Vercel (Gratis)
1. Buka [vercel.com](https://vercel.com) dan login dengan akun GitHub.
2. Klik **Add New... > Project**, lalu pilih repositori `zidanbrilliant/brilliant-budget`.
3. Biarkan konfigurasi default (Framework Preset: **Vite**, Build Command: `npm run build`, Output Directory: `dist`).
4. Klik **Deploy**. Selesai! Web app Anda langsung aktif di URL `https://brilliant-budget-xxx.vercel.app`.

---

## 2. Aktifkan Gemini AI (Opsional)

Fitur **input suara** memakai Gemini Flash gratis (opsional). Scan nota diproses langsung secara lokal on-device menggunakan OCR (Tesseract.js). Ada dua cara mengaktifkan Gemini untuk suara.

### Cara A — Environment variable di Vercel (disarankan)
1. Buka [Google AI Studio](https://aistudio.google.com/app/apikey), login, lalu klik **Create API key**.
2. Buka project di Vercel → **Settings > Environment Variables**.
3. Tambahkan:
   - `GEMINI_API_KEY` = kunci API Anda
   - `GEMINI_VOICE_MODEL` = `gemini-3.6-flash` (opsional; model input suara)
4. Klik **Save**, lalu **Redeploy** project.

Dengan cara ini kunci tetap di server. Browser hanya memanggil `/api/ai/*`, dan kunci tidak pernah masuk ke bundle JavaScript.

### Cara B — Kunci perangkat (BYOK)
1. Buka aplikasi → **Lainnya > Gemini AI**.
2. Tempel kunci API, lalu klik **Simpan & Uji**.
3. Kunci hanya disimpan di `localStorage` perangkat dan dikirim langsung ke Google, bukan ke server aplikasi.

### Cara kerja & fallback
- **Input suara**: model utama `gemini-3.6-flash` (responsif untuk audio bahasa Indonesia), fallback ke `gemini-3.5-flash` lalu `gemini-3.8-flash`. Rekaman diubah menjadi audio lalu ditranskripsi dan dipetakan menjadi transaksi terstruktur.
- **Scan nota**: diproses langsung di peramban secara lokal dengan Tesseract OCR on-device tanpa mengirim foto ke cloud. Hasil pembacaan nota dapat disunting langsung sebelum disimpan.
- Jika Gemini tidak aktif atau kuota habis, input suara tetap dapat memakai Web Speech API peramban, dan input manual selalu tersedia.

---

## 3. Setup Auto-Sync Google Sheets (Sinkronisasi 2 Arah Laptop & HP)
1. Buat Spreadsheet baru di Google Drive Anda.
2. Buka menu **Extensions (Ekstensi) > Apps Script**.
3. Hapus kode bawaan dan tempel kode skrip v2 berikut (mendukung transaksi dan lembar Config):
   ```javascript
   function json_(payload) {
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
   }
   ```
4. Klik **Save (Ikon Disket)**.
5. Klik **Deploy > New deployment**, pilih jenis **Web app**.
   - **Execute as**: *Me (email Anda)*
   - **Who has access**: *Anyone (Siapa saja)*
6. Klik **Deploy**, lalu salin **Web app URL**.
7. Buka Brilliant Budget di **Laptop** dan di **HP**:
   - Masuk ke menu **Lainnya > Auto-Sync Google Sheets**.
   - Tempel **Web app URL yang sama** di kedua perangkat, lalu klik **Simpan URL**.
   - Selesai! Data transaksi akan otomatis tersinkron antara Laptop dan HP saat aplikasi dibuka, saat beralih tab, dan setiap 30 detik. Anda juga dapat menekan tombol **Tarik Data** kapan saja.

---

## 4. Pasang di iPhone (Full-Screen Tanpa Safari Bar)
1. Buka URL Vercel aplikasi di **Safari iOS**.
2. Ketuk ikon **Share (Bagikan)** di bagian bawah Safari.
3. Gulir ke bawah dan pilih **Add to Home Screen (Tambah ke Layar Utama)**.
4. Aplikasi akan muncul sebagai ikon aplikasi native di Home Screen iPhone Anda.

### Pintasan Catat Cepat di Jalan (< 2 Detik)
Buat bookmark atau shortcut di Safari dengan akhiran `/#catat`:
```text
https://brilliant-budget-xxx.vercel.app/#catat
```
Setiap kali link ini dibuka, aplikasi langsung menampilkan keypad nominal transaksi tanpa perlu ketukan tambahan.

---

## 5. Development Lokal

```bash
npm install
copy .env.example .env      # Windows
# cp .env.example .env      # macOS/Linux
npm start                   # backend :3001 + Vite :5173
```

Isi `GEMINI_API_KEY` di `.env` agar endpoint `/api/ai/*` aktif. Tanpa kunci, aplikasi tetap berjalan dengan parser lokal dan OCR on-device.

`npm run build` juga menjalankan `npm run build:api`, yang membundel handler di `server/api/` menjadi fungsi Vercel mandiri di `api/ai/*.js`. Bundel hasil build ikut di-commit agar Vercel selalu menemukan fungsinya; jangan edit file di `api/ai/` secara manual.

Perintah tes:

```bash
npm run build
npm test
npx e2e run
```
