# Brilliant Budget (PWA + Google Sheets Sync)

Aplikasi pencatatan keuangan pribadi 100% offline-first, cepat, dan otomatis tersinkronisasi ke Google Sheets tanpa biaya server.

---

## 1. Deploy ke Vercel (Gratis)
1. Buka [vercel.com](https://vercel.com) dan login dengan akun GitHub.
2. Klik **Add New... > Project**, lalu pilih repositori `zidanbrilliant/brilliant-budget`.
3. Biarkan konfigurasi default (Framework Preset: **Vite**, Build Command: `npm run build`, Output Directory: `dist`).
4. Klik **Deploy**. Selesai! Web app Anda langsung aktif di URL `https://brilliant-budget-xxx.vercel.app`.

---

## 2. Setup Auto-Sync Google Sheets (1 Menit)
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

## 3. Pasang di iPhone (Full-Screen Tanpa Safari Bar)
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
