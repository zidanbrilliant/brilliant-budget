# Brilliant Budget (PWA + Gemini AI + Google Sheets Sync)

Aplikasi pencatatan keuangan pribadi offline-first, cepat, dengan input suara & scan nota berbasis Gemini AI gratis, serta sinkronisasi otomatis ke Google Sheets tanpa biaya server.

---

## 1. Deploy ke Vercel (Gratis)
1. Buka [vercel.com](https://vercel.com) dan login dengan akun GitHub.
2. Klik **Add New... > Project**, lalu pilih repositori `zidanbrilliant/brilliant-budget`.
3. Biarkan konfigurasi default (Framework Preset: **Vite**, Build Command: `npm run build`, Output Directory: `dist`).
4. Klik **Deploy**. Selesai! Web app Anda langsung aktif di URL `https://brilliant-budget-xxx.vercel.app`.

---

## 2. Aktifkan Gemini AI (Gratis)

Fitur **input suara** dan **scan nota** memakai Gemini Flash gratis. Ada dua cara mengaktifkannya.

### Cara A — Environment variable di Vercel (disarankan)
1. Buka [Google AI Studio](https://aistudio.google.com/app/apikey), login, lalu klik **Create API key**.
2. Buka project di Vercel → **Settings > Environment Variables**.
3. Tambahkan:
   - `GEMINI_API_KEY` = kunci API Anda
   - `GEMINI_MODEL` = `gemini-3.8-flash` (opsional; model scan nota)
   - `GEMINI_VOICE_MODEL` = `gemini-3.6-flash` (opsional; model input suara)
4. Klik **Save**, lalu **Redeploy** project.

Dengan cara ini kunci tetap di server. Browser hanya memanggil `/api/ai/*`, dan kunci tidak pernah masuk ke bundle JavaScript.

### Cara B — Kunci perangkat (BYOK)
1. Buka aplikasi → **Lainnya > Gemini AI**.
2. Tempel kunci API, lalu klik **Simpan & Uji**.
3. Kunci hanya disimpan di `localStorage` perangkat dan dikirim langsung ke Google, bukan ke server aplikasi.

### Cara kerja & fallback
- **Scan nota**: model utama `gemini-3.8-flash`, fallback otomatis ke `gemini-3.6-flash` lalu `gemini-3.5-flash`.
- **Input suara**: model utama `gemini-3.6-flash` (paling responsif untuk audio), fallback ke `gemini-3.5-flash` lalu `gemini-3.8-flash`.
- **Suara**: rekaman diubah menjadi WAV mono 16 kHz, lalu ditranskripsi dan dipecah menjadi transaksi terstruktur (nominal, merchant, kategori, dompet, tanggal).
- **Nota**: foto dikecilkan ke maksimal 1600 px, lalu Gemini Vision mengekstrak total akhir, merchant, tanggal, nomor referensi, dan rincian item.
- Jika AI gagal atau kuota habis, aplikasi otomatis memakai **parser lokal** dan **OCR on-device (Tesseract)**. Input manual tetap selalu tersedia.
- Kuota gratis Gemini Flash cukup untuk pemakaian pribadi harian. Jika kuota habis, tunggu beberapa saat atau gunakan fallback lokal.

---

## 3. Setup Auto-Sync Google Sheets (Sinkronisasi 2 Arah Laptop & HP)
1. Buat Spreadsheet baru di Google Drive Anda.
2. Buka menu **Extensions (Ekstensi) > Apps Script**.
3. Hapus kode bawaan dan tempel kode berikut (mendukung simpan dan tarik data real-time):
   ```javascript
   function doGet(e) {
     var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
     var values = sheet.getDataRange().getValues();
     if (!values || values.length <= 1) {
       return ContentService.createTextOutput(JSON.stringify({ status: 'ok', data: [] }))
         .setMimeType(ContentService.MimeType.JSON);
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

     return ContentService.createTextOutput(JSON.stringify({ status: 'ok', data: rows }))
       .setMimeType(ContentService.MimeType.JSON);
   }

   function doPost(e) {
     var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
     if (sheet.getLastRow() === 0) {
       sheet.appendRow(["ID", "Tanggal", "Tipe", "Kategori", "Nominal", "Dompet", "Catatan", "Sumber"]);
     }
     var data = JSON.parse(e.postData.contents);
     var items = Array.isArray(data) ? data : [data];
     var values = sheet.getDataRange().getValues();
     var header = (values[0] || []).map(function(h) { return String(h || '').trim().toLowerCase(); });
     var hasId = header[0] === 'id';

     var idRowMap = {};
     if (hasId && values.length > 1) {
       for (var i = 1; i < values.length; i++) {
         var existingId = String(values[i][0] || '').trim();
         if (existingId) idRowMap[existingId] = i + 1;
       }
     }

     items.forEach(function(r) {
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

     return ContentService.createTextOutput(JSON.stringify({ status: 'ok', count: items.length }))
       .setMimeType(ContentService.MimeType.JSON);
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
