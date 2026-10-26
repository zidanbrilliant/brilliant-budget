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

## 3. Setup Auto-Sync Google Sheets (1 Menit)
1. Buat Spreadsheet baru di Google Drive Anda.
2. Buka menu **Extensions (Ekstensi) > Apps Script**.
3. Hapus kode bawaan dan tempel kode berikut:
   ```javascript
   function doPost(e) {
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
   }
   ```
4. Klik **Save (Ikon Disket)**.
5. Klik **Deploy > New deployment**, pilih jenis **Web app**.
   - **Execute as**: *Me (email Anda)*
   - **Who has access**: *Anyone (Siapa saja)*
6. Klik **Deploy**, lalu salin **Web app URL**.
7. Buka Brilliant Budget di browser, masuk ke menu **Lainnya > Auto-Sync Google Sheets**, tempel URL tersebut lalu klik **Simpan URL**.

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

Perintah tes:

```bash
npm run build
npm test
npx e2e run
```
