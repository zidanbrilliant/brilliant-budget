# PRD — Aplikasi Pencatat Keuangan Offline (Working Title: "Catat")

| | |
|---|---|
| Versi | 0.1 (Draft hasil interview) |
| Tanggal | 8 Oktober 2026 |
| Platform | iOS (MVP), Android (fase 2) |
| Target pengguna | Individu / personal, Indonesia |
| Prinsip utama | 100% offline, privasi penuh, pencatatan secepat mungkin |

---

## 1. Ringkasan

Aplikasi mobile untuk mencatat pemasukan, pengeluaran, dan budgeting yang **seluruh datanya tersimpan di perangkat**. Nilai jual utamanya adalah **kecepatan mencatat**: pengguna bisa mencatat lewat ketikan manual, suara (voice note), foto nota, screenshot bukti transfer/QRIS, scan QR, atau SMS bank, dengan sesedikit mungkin langkah. Semua pemrosesan AI (speech-to-text, OCR, parsing) berjalan **on-device**, tanpa server dan tanpa internet.

## 2. Tujuan dan Non-Tujuan

### Tujuan
1. Mencatat satu transaksi dalam **≤ 5 detik** untuk jalur tercepat (widget / suara) dan **≤ 10 detik** untuk jalur lain (OCR, share).
2. Berjalan penuh tanpa koneksi internet, tanpa akun, tanpa server.
3. Mencakup sumber transaksi modern: QRIS, transfer bank, e-wallet, struk belanja, tunai, langganan.
4. Memberi gambaran budget dan arus kas yang mudah dipahami.
5. Data aman: terkunci Face ID/PIN, bisa di-backup terenkripsi.

### Non-Tujuan (di luar scope v1)
- Integrasi langsung ke API bank / open banking (tidak offline, perlu izin regulator).
- Fitur hutang-piutang (tidak dipilih untuk v1).
- Akun pengguna, kolaborasi keluarga, dan sinkron multi-device otomatis (lihat Fase 3).
- Investasi, pajak, dan laporan akuntansi bisnis (UMKM).

## 3. Persona

**Rina, 27, karyawan swasta di Jakarta.** Bayar hampir semua pakai QRIS dan e-wallet, transfer lewat m-banking, kadang belanja di minimarket dan pasar. Pernah mencoba aplikasi keuangan tapi berhenti karena malas input manual. Butuh: catat secepat membalas chat, tidak mau data keuangannya dikirim ke cloud.

## 4. Skenario Sumber Transaksi (Real, Best, Worst Case)

| Sumber | Frekuensi di dunia nyata | Best case | Worst case | Mitigasi |
|---|---|---|---|---|
| Manual | Selalu ada (tunai, jajan) | Form cepat 3 ketukan | Pengguna malas | Widget, template, favorit |
| Voice note | Sering (saat bepergian) | "Makan siang 35 ribu pakai GoPay" langsung jadi transaksi | Bising, logat, angka ambigu ("tiga lima") | Layar konfirmasi, edit cepat |
| Foto struk | Sering (minimarket, restoran) | Total, toko, tanggal, item terbaca | Struk thermal pudar, lipatan | Deteksi kualitas, fallback manual |
| Screenshot bukti transfer/QRIS | Sangat sering | Nominal, penerima, waktu terbaca | Format baru, bahasa Inggris, tema gelap | Template per bank + parser generik |
| Scan QR QRIS | Sering | Nama merchant dan NMID terbaca, nominal diisi pengguna | QRIS statis tanpa nominal | Isi merchant otomatis, nominal manual |
| SMS bank (iOS Shortcuts) | Menengah | Otomatis masuk lewat automation | Bank tidak kirim SMS, setup sekali oleh pengguna | Panduan setup 1 layar |
| Notifikasi bank/e-wallet (Android) | Sangat sering | Otomatis 100% | Layanan dimatikan OS (Xiaomi/Oppo), format berubah | Fase 2, panduan whitelist baterai |
| Transaksi berulang | Pasti (gaji, langganan, cicilan) | Otomatis dibuat sesuai jadwal | Nominal berubah | Pengingat dan konfirmasi |
| Duplikat (notifikasi + screenshot) | Pasti terjadi | Terdeteksi dan digabung | Salah gabung | Skor kemiripan, minta konfirmasi |

## 5. Lingkup Rilis

### Fase 1 — MVP iOS
- Catat manual, multi dompet/rekening, kategori, budget fleksibel.
- Voice-to-transaction (on-device).
- Foto/screenshot ke transaksi (on-device OCR).
- Scan QR QRIS.
- Share Extension (kirim gambar, audio, teks dari aplikasi lain).
- Widget Home/Lock Screen, Control Center control, Action Button, Siri/Shortcuts (App Intents), SMS automation via Shortcuts.
- Transaksi berulang, target tabungan.
- Kunci Face ID/PIN, backup/restore file terenkripsi.
- Laporan dasar.

### Fase 2 — Android
- Semua fitur Fase 1.
- **Notification Listener** untuk membaca notifikasi bank/e-wallet otomatis.
- Home widget, Quick Settings tile, notifikasi tetap dengan tombol cepat.

### Fase 3 — Opsional
- Sinkron iCloud / Google Drive (data terenkripsi sebelum diunggah).
- Konsolidasi lintas perangkat.
- Model bisnis (belum ditentukan, lihat Bagian 17).

## 6. Fitur dan Requirement Fungsional

Prioritas: **P0** wajib MVP, **P1** penting, **P2** nanti.

### 6.1 Pencatatan Manual (P0)
- FR-1: Form transaksi: tipe (pengeluaran / pemasukan / transfer antar dompet), nominal, kategori, dompet, tanggal-waktu (default sekarang), catatan, foto lampiran (opsional).
- FR-2: Keypad nominal besar, pintasan "ribu/juta" (ketik `35` lalu ketuk `rb` menjadi 35.000).
- FR-3: Kategori terakhir dan favorit tampil sebagai chip, saran kategori otomatis dari merchant/kata kunci.
- FR-4: Template transaksi (mis. "Kopi pagi 25.000") sekali ketuk.
- FR-5: Edit dan hapus dengan undo.

### 6.2 Voice-to-Transaction (P0)
- FR-6: Tekan-tahan tombol mic atau tombol di widget untuk merekam; hasil transkripsi ditampilkan.
- FR-7: Import VN (file audio / voice note WhatsApp) lewat Share Sheet.
- FR-8: Parser bahasa Indonesia mengekstrak: nominal, tipe, kategori, dompet, tanggal relatif ("kemarin", "tadi pagi"), dan merchant.
- FR-9: Satu rekaman dapat berisi **banyak transaksi** ("beli bensin 50 ribu terus makan siang 30 ribu").
- FR-10: Layar konfirmasi dengan bidang yang dapat diedit; field berkeyakinan rendah ditandai.
- FR-11: Normalisasi angka Indonesia: "dua puluh lima ribu", "25rb", "25k", "dua lima ribu", "setengah juta", "1,5 juta".

### 6.3 Foto Nota / Screenshot ke Transaksi (P0)
- FR-12: Input dari kamera, galeri, atau Share Sheet.
- FR-13: OCR on-device mengekstrak: nama toko, tanggal, total, metode bayar, dan (P1) daftar item.
- FR-14: Deteksi jenis dokumen: struk belanja, bukti transfer bank, bukti e-wallet, bukti QRIS, tagihan.
- FR-15: Parser berbasis template untuk BCA, Mandiri, BRI, BNI, BSI, CIMB, Jago, SeaBank, GoPay, OVO, DANA, ShopeePay, LinkAja, dan parser generik sebagai cadangan.
- FR-16: Untuk struk dengan banyak item, opsi "simpan total saja" atau "pecah per kategori" (P1).
- FR-17: Gambar asli disimpan terenkripsi sebagai lampiran (bisa dimatikan di pengaturan).
- FR-18: Batch: beberapa screenshot sekaligus diproses berurutan.

### 6.4 Scan QR QRIS (P0)
- FR-19: Scan kode QRIS (standar EMVCo / QRIS Indonesia) untuk membaca nama merchant, kota, dan NMID.
- FR-20: Jika QR dinamis memuat nominal, diisi otomatis; jika tidak, pengguna mengetik nominal.
- FR-21: Alur "Bayar lalu catat": setelah scan, pengguna membayar di aplikasi bank/e-wallet pilihannya, lalu kembali ke aplikasi dengan data sudah terisi (tidak ada pemrosesan pembayaran di aplikasi ini).

### 6.5 Otomatisasi Transaksi Digital
- FR-22 (iOS, P0): Panduan setup Shortcuts Automation: pemicu "Pesan berisi teks tertentu" dari pengirim bank, lalu menjalankan App Intent "Catat dari teks". Aplikasi menyediakan App Intent `ParseTransactionText(text)`.
- FR-23 (iOS, P0): App Intent `QuickAddExpense`, `StartVoiceCapture`, `ScanReceipt`, dapat dipanggil dari Siri, Action Button, Back Tap, dan Control Center.
- FR-24 (Android, Fase 2): NotificationListenerService membaca notifikasi dari daftar paket aplikasi bank/e-wallet yang diizinkan pengguna, mengirimnya ke parser, lalu membuat transaksi **draft**.
- FR-25: Semua transaksi otomatis masuk sebagai **draft** di Inbox; pengguna konfirmasi sekali ketuk (opsi "auto-konfirmasi" untuk merchant tepercaya, P1).

### 6.6 Deteksi Duplikat (P0)
- FR-26: Sebelum menyimpan, sistem mencari transaksi dengan nominal sama, rentang waktu ±10 menit, dan dompet atau merchant mirip.
- FR-27: Jika skor kemiripan melewati ambang, tampilkan "Mungkin duplikat" dengan pilihan Gabung / Simpan keduanya.
- FR-28: Gunakan referensi unik (nomor referensi/ID transaksi dari bukti) bila tersedia sebagai kunci duplikat pasti.

### 6.7 Dompet dan Rekening (P0)
- FR-29: Tipe dompet: Tunai, Rekening Bank, E-wallet, Kartu Kredit (tercatat sebagai kewajiban), Lainnya.
- FR-30: Saldo awal, saldo berjalan, dan rekonsiliasi (penyesuaian saldo dengan transaksi "koreksi").
- FR-31: Transfer antar dompet tercatat sebagai satu transaksi bertipe transfer (tidak dihitung sebagai pengeluaran/pemasukan di laporan).
- FR-32: Biaya admin transfer dapat dicatat sebagai pengeluaran terpisah otomatis (opsional).
- FR-33: Top-up e-wallet dikenali sebagai transfer, bukan pengeluaran.

### 6.8 Kategori (P0)
- FR-34: Kategori bawaan (Makan, Transportasi, Belanja, Tagihan, Kesehatan, Hiburan, Pendidikan, Gaji, Bonus, dll.) dan subkategori.
- FR-35: Kategori kustom (nama, ikon, warna).
- FR-36: Aturan otomatis: merchant atau kata kunci → kategori. Aturan dipelajari dari koreksi pengguna (on-device).

### 6.9 Budgeting Fleksibel (P0)
- FR-37: Pengguna memilih metode: **(a)** anggaran per kategori bulanan, **(b)** amplop (envelope), **(c)** persentase (mis. 50/30/20), atau **(d)** total bulanan saja.
- FR-38: Periode: bulanan dengan tanggal mulai kustom (mis. tanggal gajian), mingguan opsional.
- FR-39: Rollover sisa budget ke bulan berikutnya (opsional per kategori).
- FR-40: Indikator terpakai/sisa, proyeksi akhir bulan, dan peringatan di 80% dan 100%.
- FR-41: Bisa berganti metode tanpa kehilangan data transaksi.

### 6.10 Transaksi Berulang (P0)
- FR-42: Jadwal: harian, mingguan, bulanan (tanggal tertentu / hari kerja terakhir), tahunan.
- FR-43: Mode pembuatan: otomatis dibuat sebagai draft atau langsung tercatat, dengan notifikasi lokal pengingat.
- FR-44: Daftar langganan dengan total biaya bulanan dan tahunan.
- FR-45: Cicilan dengan jumlah tenor dan sisa tenor.

### 6.11 Target Tabungan (P1)
- FR-46: Target: nama, nominal, tenggat (opsional), dompet terkait.
- FR-47: Kontribusi manual atau otomatis (nominal tetap per periode).
- FR-48: Progress bar dan estimasi tanggal tercapai.

### 6.12 Laporan dan Wawasan (P0 dasar, P1 lanjutan)
- FR-49: Ringkasan bulan ini: pemasukan, pengeluaran, selisih, saldo.
- FR-50: Grafik per kategori, tren harian/bulanan, perbandingan bulan lalu.
- FR-51: Pencarian dan filter (tanggal, kategori, dompet, nominal, teks, ada lampiran).
- FR-52: Ekspor CSV dan PDF.
- FR-53: Wawasan on-device (P1): kategori yang naik signifikan, hari paling boros, langganan terlupakan.

### 6.13 Keamanan dan Backup (P0)
- FR-54: Kunci aplikasi: Face ID / Touch ID / PIN, auto-lock saat ke latar belakang, sembunyikan konten di app switcher.
- FR-55: Backup manual: ekspor satu file `.catatbak` terenkripsi (AES-256-GCM) dengan kata sandi pengguna; impor untuk restore.
- FR-56: Pengingat backup berkala (notifikasi lokal), tanpa memaksa.
- FR-57 (Fase 3): Sinkron iCloud / Google Drive: file backup terenkripsi di sisi klien sebelum diunggah; Google/Apple tidak pernah melihat data mentah.

### 6.14 Onboarding dan Pengaturan (P0)
- FR-58: Onboarding ≤ 4 layar: pilih dompet awal, metode budget, aktifkan kunci, tambahkan widget.
- FR-59: Pengaturan: mata uang (default IDR), format tanggal, hari mulai bulan, kategori, aturan otomatis, bahasa (Indonesia, Inggris), tema terang/gelap.

## 7. Desain UI/UX

### 7.1 Prinsip
1. **Capture first**: layar pertama selalu siap mencatat.
2. **Draft, bukan tebakan diam-diam**: otomatis boleh, tapi pengguna tetap bisa verifikasi cepat.
3. **Satu ibu jari**: aksi utama di bagian bawah layar.
4. **Bahasa sehari-hari**: "Uang keluar", "Uang masuk", bukan istilah akuntansi.
5. **Gagal dengan anggun**: jika OCR atau suara gagal, selalu ada jalur manual dengan data terisi sebagian.

### 7.2 Navigasi (Tab Bar)
`Beranda` · `Transaksi` · **`＋ Catat`** (tombol tengah menonjol) · `Budget` · `Lainnya`

### 7.3 Layar Utama

**Beranda**
- Kartu ringkasan: sisa budget bulan ini, total pengeluaran, total pemasukan.
- Baris dompet (scroll horizontal) dengan saldo.
- Kartu **Inbox Draft**: "3 transaksi menunggu konfirmasi" dengan tombol Konfirmasi semua.
- Transaksi terbaru, progres target tabungan.

**Catat (bottom sheet dari tombol ＋)**
- Empat tombol besar: **Ketik**, **Suara**, **Foto/Scan**, **Dari Screenshot**.
- Default tombol Ketik; tombol Suara bisa ditekan-tahan langsung dari tab bar.

**Form Ketik**
- Nominal besar di atas, keypad angka kustom dengan tombol `000` dan `rb`.
- Chip kategori, chip dompet, tanggal (default sekarang), catatan.
- Tombol Simpan dan Simpan & Tambah Lagi.

**Konfirmasi Hasil (suara / OCR / otomatis)**
- Pratinjau sumber (transkrip atau gambar yang di-crop) di atas.
- Bidang hasil ekstraksi yang bisa diedit; bidang berkeyakinan rendah diberi tanda kuning.
- Tombol utama "Simpan", aksi sekunder "Edit lengkap" dan "Buang".
- Jika terdapat banyak transaksi, ditampilkan sebagai daftar kartu dengan swipe untuk buang.

**Inbox Draft**
- Daftar draft dengan sumber (ikon suara/kamera/SMS/notifikasi), swipe kanan = konfirmasi, swipe kiri = buang, ketuk = edit.

**Transaksi**
- Daftar per hari dengan subtotal, pencarian, filter, grup berdasarkan tanggal.

**Budget**
- Tampilan sesuai metode yang dipilih; bar progres per kategori berwarna (hijau, kuning, merah).
- Tombol Atur Budget dengan penjelasan singkat tiap metode.

**Dompet**
- Daftar dompet, saldo, riwayat, tombol Penyesuaian Saldo.

**Laporan**
- Tab Ringkasan / Kategori / Tren; segmen periode (Minggu, Bulan, Tahun, Kustom).

### 7.4 Titik Masuk Cepat (iOS MVP)
| Titik masuk | Perilaku |
|---|---|
| Widget Home Screen kecil | Tombol `＋` dan `🎤`; ketuk langsung membuka form / merekam |
| Widget Lock Screen | Ikon cepat Catat / Suara |
| Control Center control (iOS 18+) | Tombol "Catat" dan "Suara" |
| Action Button (iPhone 15 Pro+) | Dipetakan ke App Intent Suara |
| Back Tap | Via Shortcuts → App Intent |
| Siri | "Hei Siri, catat pengeluaran" |
| Share Sheet | Terima gambar (screenshot/struk), audio (VN), teks (SMS/pesan) |
| Shortcuts Automation | Pemicu dari SMS bank |
| Spotlight | "Catat" membuka form |

### 7.5 Titik Masuk Cepat (Android, Fase 2)
Widget Home Screen, Quick Settings Tile, notifikasi tetap dengan tombol cepat, Share Target, App Shortcuts (long-press ikon), Notification Listener.

### 7.6 Keadaan Kosong, Error, dan Aksesibilitas
- Empty state ilustratif dengan satu aksi jelas.
- Pesan error ramah dan spesifik ("Struk sulit dibaca, coba foto ulang atau isi manual").
- Dukungan Dynamic Type, VoiceOver, kontras WCAG AA, target sentuh ≥ 44pt, mode gelap.
- Haptic untuk konfirmasi simpan.

## 8. Arsitektur Teknis

### 8.1 Rekomendasi Stack
| Lapisan | Pilihan | Alasan |
|---|---|---|
| UI | **Flutter** (Dart) | Satu codebase iOS + Android, performa baik |
| State | Riverpod | Testable, reaktif |
| Database | **SQLite** via Drift | Relasional, migrasi, query laporan, offline penuh |
| Enkripsi DB | SQLCipher | Enkripsi at-rest |
| Kunci | Keychain (iOS) / Keystore (Android) | Simpan kunci enkripsi |
| OCR | Apple Vision (iOS) / Google ML Kit Text Recognition (Android) lewat platform channel | On-device, gratis, cepat |
| Speech-to-text | Apple Speech on-device (`requiresOnDeviceRecognition`) untuk `id-ID`; cadangan **whisper.cpp** (model kecil) untuk file VN panjang | Offline, dukungan bahasa Indonesia |
| NLP/Parsing | Parser berbasis aturan (Dart) + opsional model klasifikasi kecil (TFLite/CoreML) | Deterministik, cepat, mudah diuji |
| QR | `mobile_scanner` / VisionKit | Scan QR |
| Ekstensi native | Swift: WidgetKit, App Intents, Share Extension, Control Widget | Wajib native |
| Notifikasi lokal | `flutter_local_notifications` | Pengingat |
| Android | Kotlin: NotificationListenerService, Tile, Widget | Wajib native |

> Catatan: Jika tim lebih kuat di Swift, alternatif **native iOS dulu** (SwiftUI + SwiftData/GRDB) layak karena MVP iOS-first dan ekstensi native dominan. Pilihan Flutter unggul bila Android pasti menyusul.

### 8.2 Arsitektur Lapisan
```
┌────────────────────────────────────────────┐
│ Presentation (Flutter UI, Riverpod)        │
├────────────────────────────────────────────┤
│ Application / Use Cases                    │
│  CaptureTransaction, ConfirmDraft,         │
│  RunRecurring, ComputeBudget, Backup       │
├────────────────────────────────────────────┤
│ Domain (entity, aturan bisnis)             │
├──────────────┬─────────────┬───────────────┤
│ Ingestion    │ Parsing     │ Persistence   │
│ - Manual     │ - NumberNorm│ - Drift/SQLite│
│ - Voice(STT) │ - Merchant  │ - SQLCipher   │
│ - OCR        │ - Bank tmpl │ - Files (img) │
│ - QR         │ - Categorize│ - Backup      │
│ - Intent/SMS │ - Dedupe    │               │
│ - Notif(And) │             │               │
├──────────────┴─────────────┴───────────────┤
│ Platform Channels (Swift / Kotlin)         │
└────────────────────────────────────────────┘
```

### 8.3 Pipeline Ingestion (Seragam)
```
Sumber (suara / gambar / teks / QR / notifikasi)
   → Ekstraksi mentah (STT / OCR / decode QR)
   → Normalisasi teks (huruf, spasi, angka Indonesia)
   → Klasifikasi dokumen (struk / transfer / QRIS / tagihan / ucapan)
   → Parser (template bank → generik)
   → Enrichment (kategori, dompet, merchant, tanggal)
   → Deteksi duplikat
   → Draft transaksi + skor keyakinan
   → Inbox / Layar Konfirmasi
   → Simpan
```

### 8.4 Detail Parser
- **Normalisasi angka:** `25rb`, `25k`, `25.000`, `Rp 25.000,00`, `dua puluh lima ribu`, `setengah juta`, `1,5 jt` → integer rupiah. Ketidakjelasan titik/koma ditangani aturan IDR (titik = ribuan, koma = desimal).
- **Tanggal:** format `dd/MM/yyyy`, `dd MMM yyyy`, "kemarin", "tadi pagi", "Senin lalu". Zona waktu perangkat.
- **Template bank:** konfigurasi deklaratif (JSON/YAML) berisi pola regex, kata kunci pengenal, dan peta field. Dapat diperbarui lewat pembaruan aplikasi (tanpa server).
- **Skor keyakinan:** tiap field 0–1; field < 0.7 ditandai di UI.
- **Pemetaan merchant → kategori:** kamus lokal (Indomaret, Alfamart, Grab, Gojek, Tokopedia, PLN, Telkomsel, dll.) + aturan hasil belajar dari koreksi pengguna.
- **Kata kunci arah:** "terima", "masuk", "gaji", "refund" → pemasukan; "bayar", "beli", "transfer ke" → pengeluaran; "top up" → transfer.

### 8.5 Penjadwal Transaksi Berulang
- Dijalankan saat aplikasi dibuka dan lewat background task terjadwal (BGTaskScheduler); membuat transaksi yang jatuh tempo sejak terakhir dijalankan (catch-up) secara idempoten.

### 8.6 Rencana Sinkronisasi Opsional (Fase 3)
- Arsitektur siap: setiap baris memiliki `id (UUID)`, `updated_at`, `deleted_at`, `device_id`.
- Strategi awal: **sinkron berbasis file backup terenkripsi** ke iCloud Drive / Google Drive; konflik diselesaikan per-baris dengan `updated_at` (last-write-wins) dan log konflik.
- Semua enkripsi terjadi di sisi klien; kunci diturunkan dari kata sandi pengguna (Argon2id / PBKDF2).

## 9. Model Data (SQLite)

```sql
-- Dompet / rekening
CREATE TABLE account (
  id TEXT PRIMARY KEY,           -- UUID
  name TEXT NOT NULL,
  type TEXT NOT NULL,            -- cash | bank | ewallet | credit_card | other
  currency TEXT NOT NULL DEFAULT 'IDR',
  opening_balance INTEGER NOT NULL DEFAULT 0,  -- rupiah, integer
  icon TEXT, color TEXT,
  is_archived INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, deleted_at INTEGER
);

-- Kategori
CREATE TABLE category (
  id TEXT PRIMARY KEY,
  parent_id TEXT REFERENCES category(id),
  name TEXT NOT NULL,
  kind TEXT NOT NULL,            -- expense | income
  icon TEXT, color TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, deleted_at INTEGER
);

-- Transaksi
CREATE TABLE txn (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,            -- expense | income | transfer
  amount INTEGER NOT NULL,       -- selalu positif, dalam rupiah
  account_id TEXT NOT NULL REFERENCES account(id),
  to_account_id TEXT REFERENCES account(id),    -- untuk transfer
  category_id TEXT REFERENCES category(id),
  merchant_id TEXT REFERENCES merchant(id),
  occurred_at INTEGER NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'confirmed',     -- draft | confirmed
  source TEXT NOT NULL,          -- manual | voice | ocr | qr | sms | notification | recurring | import
  external_ref TEXT,             -- no. referensi bank/e-wallet (untuk dedupe)
  confidence REAL,               -- keyakinan ekstraksi keseluruhan
  recurring_id TEXT REFERENCES recurring_rule(id),
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, deleted_at INTEGER
);
CREATE INDEX idx_txn_time ON txn(occurred_at);
CREATE INDEX idx_txn_cat ON txn(category_id);
CREATE INDEX idx_txn_acc ON txn(account_id);
CREATE UNIQUE INDEX idx_txn_extref ON txn(external_ref) WHERE external_ref IS NOT NULL AND deleted_at IS NULL;

-- Rincian item struk (opsional)
CREATE TABLE txn_item (
  id TEXT PRIMARY KEY, txn_id TEXT NOT NULL REFERENCES txn(id),
  name TEXT, qty REAL, unit_price INTEGER, total INTEGER, category_id TEXT
);

-- Lampiran (path file terenkripsi)
CREATE TABLE attachment (
  id TEXT PRIMARY KEY, txn_id TEXT NOT NULL REFERENCES txn(id),
  kind TEXT, path TEXT NOT NULL, ocr_text TEXT, created_at INTEGER NOT NULL
);

-- Merchant + aturan kategori
CREATE TABLE merchant (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, nmid TEXT,
  default_category_id TEXT, aliases TEXT   -- JSON array
);

CREATE TABLE category_rule (
  id TEXT PRIMARY KEY, pattern TEXT NOT NULL, match_type TEXT,  -- contains | regex
  category_id TEXT NOT NULL, hit_count INTEGER DEFAULT 0, source TEXT  -- builtin | learned | user
);

-- Budget
CREATE TABLE budget_plan (
  id TEXT PRIMARY KEY, method TEXT NOT NULL,   -- category | envelope | percent | total
  period TEXT NOT NULL, start_day INTEGER DEFAULT 1, is_active INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE budget_line (
  id TEXT PRIMARY KEY, plan_id TEXT NOT NULL REFERENCES budget_plan(id),
  category_id TEXT, amount INTEGER, percent REAL, rollover INTEGER DEFAULT 0
);

-- Transaksi berulang
CREATE TABLE recurring_rule (
  id TEXT PRIMARY KEY, template_json TEXT NOT NULL,   -- isi txn
  frequency TEXT NOT NULL, interval INTEGER DEFAULT 1, day_of_month INTEGER, weekday INTEGER,
  next_run_at INTEGER NOT NULL, end_at INTEGER, remaining_count INTEGER,
  mode TEXT NOT NULL DEFAULT 'draft',   -- draft | auto
  is_active INTEGER DEFAULT 1
);

-- Target tabungan
CREATE TABLE goal (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, target_amount INTEGER NOT NULL,
  due_at INTEGER, account_id TEXT, saved_amount INTEGER DEFAULT 0,
  auto_amount INTEGER, auto_frequency TEXT, created_at INTEGER, updated_at INTEGER
);

-- Pengaturan & parser template versi
CREATE TABLE setting (key TEXT PRIMARY KEY, value TEXT);
```

**Aturan data penting**
- Uang disimpan sebagai **integer rupiah** (bukan float).
- Saldo dompet dihitung dari `opening_balance` + transaksi (tidak disimpan redundan), dengan cache terindeks bila perlu.
- Soft delete (`deleted_at`) agar siap sinkron.
- Migrasi skema berversi (Drift migrations).

## 10. Logika Bisnis Utama

1. **Dampak transaksi:** `expense` mengurangi saldo `account_id`; `income` menambah; `transfer` mengurangi `account_id` dan menambah `to_account_id`, tidak masuk laporan pemasukan/pengeluaran.
2. **Budget terpakai** = Σ pengeluaran terkonfirmasi di kategori pada periode budget (draft tidak dihitung).
3. **Rollover:** sisa (atau kelebihan) periode lalu ditambahkan ke anggaran periode berjalan jika diaktifkan.
4. **Dedupe:** kunci pasti = `external_ref`. Kunci kabur = `|Δ waktu| ≤ 10 menit` ∧ `amount` sama ∧ (`account` sama ∨ `merchant` mirip ≥ 0.8 [Jaro-Winkler]).
5. **Transaksi berulang:** saat `now ≥ next_run_at`, buat transaksi (draft/auto), lalu majukan `next_run_at`; ulangi sampai melewati `now` (catch-up).
6. **Pembelajaran kategori:** saat pengguna mengoreksi kategori, simpan/naikkan `category_rule` (merchant → kategori); setelah ≥ 2 koreksi konsisten, jadikan default.
7. **Draft kedaluwarsa:** draft otomatis yang tidak disentuh > 30 hari diarsipkan (pengaturan).

## 11. Privasi dan Keamanan

- **Tanpa jaringan:** tidak ada SDK analitik, iklan, atau crash reporter pihak ketiga yang mengirim data. (iOS: tidak meminta izin jaringan; opsional tidak menyertakan `NSAppTransportSecurity` apa pun.)
- **Enkripsi at-rest:** database SQLCipher; kunci di Keychain/Keystore dengan proteksi biometrik opsional.
- **Lampiran gambar** dienkripsi (AES-GCM) di sandbox aplikasi.
- **Backup** terenkripsi AES-256-GCM, kunci dari Argon2id; kata sandi tidak pernah disimpan.
- **Izin minimum:** Kamera, Mikrofon, Speech Recognition, Notifikasi (lokal), Face ID. Android Fase 2: Notification Listener (disertai penjelasan jelas dan daftar aplikasi yang dapat dipilih).
- **Notification Listener (Android):** hanya memproses notifikasi dari paket yang diizinkan pengguna, hanya teks transaksi, tidak menyimpan notifikasi mentah.
- **Kepatuhan:** selaras prinsip UU PDP; karena data tidak keluar perangkat, risiko pemrosesan pihak ketiga minimal.
- **Peringatan di UI:** jelaskan bahwa data hilang jika HP hilang dan belum di-backup.

## 12. Performa dan Kualitas (Non-Fungsional)

| Aspek | Target |
|---|---|
| Cold start | < 1,5 detik di iPhone 11 ke atas |
| Simpan transaksi manual | < 100 ms |
| OCR struk → draft | < 3 detik |
| STT 10 detik audio → draft | < 3 detik (on-device) |
| Query laporan 100 rb transaksi | < 500 ms |
| Ukuran aplikasi | < 80 MB (tanpa model Whisper), model opsional diunduh dari file/dibundel |
| Baterai | Tanpa polling latar belakang di iOS |
| Offline | 100% fitur inti berjalan tanpa jaringan |
| Aksesibilitas | VoiceOver, Dynamic Type, kontras AA |
| Crash-free | ≥ 99,5% |

## 13. Metrik Keberhasilan

- **Waktu rata-rata mencatat** ≤ 8 detik.
- **Akurasi ekstraksi nominal** ≥ 95% (OCR bukti transfer/QRIS), ≥ 90% (suara), ≥ 85% (struk belanja total).
- **Rasio draft dikonfirmasi tanpa edit** ≥ 70%.
- **Retensi hari ke-30** ≥ 40% (diukur dari perangkat uji / TestFlight, tanpa pelacakan pihak ketiga).
- **Pengguna menyalakan ≥ 1 pintasan cepat** ≥ 60%.

> Karena tanpa analitik, metrik dikumpulkan lewat uji pengguna, TestFlight feedback, dan statistik lokal opsional yang ditampilkan ke pengguna sendiri.

## 14. Strategi Pengujian

- **Unit test:** normalisasi angka, parser tanggal, template bank, dedupe, perhitungan budget, scheduler berulang.
- **Golden dataset:** kumpulan ≥ 300 gambar bukti transfer/QRIS/struk (anonim) dan ≥ 200 kalimat suara beraksen berbeda sebagai regresi akurasi parser.
- **Uji perangkat nyata:** berbagai iPhone (SE sampai Pro Max), mode gelap, Dynamic Type besar.
- **Uji migrasi database** dan uji pulih backup lintas versi.
- **Uji keamanan:** verifikasi enkripsi DB, backup tidak bocor di iCloud Backup bila tidak diinginkan (flag exclude), uji jailbreak dasar.
- **Uji aksesibilitas** manual VoiceOver.

## 15. Risiko dan Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| iOS tidak bisa baca notifikasi | Otomasi terbatas | SMS Shortcuts, share sheet, screenshot OCR; Android Fase 2 |
| Format bukti bank berubah | Parser gagal | Template deklaratif + parser generik + fallback manual; update lewat rilis |
| Akurasi STT bahasa Indonesia/logat | Salah catat | Layar konfirmasi, kamus nominal, opsi Whisper |
| Struk pudar | OCR gagal | Panduan foto (cahaya, rata), peringatan kualitas |
| Data hilang saat HP hilang | Kehilangan data | Pengingat backup, ekspor mudah, sinkron iCloud/Drive opsional |
| Pengguna kelelahan konfirmasi draft | Churn | Konfirmasi massal, auto-konfirmasi merchant tepercaya |
| Kebijakan Google Play untuk Notification Listener | Penolakan rilis | Deklarasi penggunaan jelas, fungsi inti, opsi kontrol pengguna |
| Ukuran model Whisper | Aplikasi besar | Model kecil opsional, gunakan Apple Speech sebagai default |
| Duplikat transaksi | Data kotor | Dedupe berlapis + review |

## 15b. Asumsi yang Dipakai (mohon dikonfirmasi)

1. Nama aplikasi sementara "Catat".
2. Mata uang utama IDR, bahasa utama Indonesia.
3. Versi iOS minimum 17 (Control Center control memerlukan iOS 18; fitur ini ditandai ketersediaannya).
4. Hutang-piutang tidak masuk v1.
5. Stack Flutter dipakai; keputusan akhir bisa berubah ke native iOS.
6. Model bisnis belum diputuskan; arsitektur tidak bergantung padanya.

## 16. Roadmap

| Tahap | Cakupan | Estimasi (1–2 developer) |
|---|---|---|
| 0. Fondasi | Setup proyek, skema DB, enkripsi, desain sistem UI | 2 minggu |
| 1. Inti | Manual, dompet, kategori, laporan dasar, kunci Face ID | 4 minggu |
| 2. Capture | Suara, OCR, QR, parser + template bank awal, dedupe, Inbox | 6 minggu |
| 3. Pintasan iOS | Widget, Control Center, App Intents, Share Extension, SMS automation | 3 minggu |
| 4. Budget & berulang | Budget fleksibel, berulang, target tabungan | 4 minggu |
| 5. Polish & beta | Backup/restore, aksesibilitas, TestFlight | 3 minggu |
| **MVP iOS rilis** | | **± 22 minggu** |
| 6. Android | Port + Notification Listener, widget, tile | 8–10 minggu |
| 7. Sinkron opsional | iCloud/Google Drive terenkripsi | 4–6 minggu |

## 17. Pertanyaan Terbuka

1. Model bisnis (gratis, freemium, atau beli putus) dan fitur apa yang jadi premium.
2. Bank dan e-wallet mana yang menjadi prioritas template awal (berdasarkan pengguna target Anda).
3. Apakah perlu dukungan multi-mata uang (perjalanan luar negeri)?
4. Apakah hutang-piutang dimasukkan pada versi 1.1?
5. Pilihan akhir stack: Flutter vs native iOS.
6. Nama dan identitas visual aplikasi.

---

## Lampiran A — Contoh Hasil Parsing

**Suara:** "tadi siang makan soto 28 ribu pakai gopay, terus beli bensin 50 rb"
```json
[
 {"type":"expense","amount":28000,"category":"Makan","account":"GoPay","occurred_at":"hari ini 12:00","note":"soto","confidence":0.88},
 {"type":"expense","amount":50000,"category":"Transportasi","account":null,"occurred_at":"hari ini","note":"bensin","confidence":0.82}
]
```

**Screenshot bukti transfer (teks OCR):** "Transfer Berhasil … Rp 1.250.000 … ke Budi Santoso … No. Ref 7712839 … 08 Okt 2026 14:32"
```json
{"type":"expense","amount":1250000,"merchant":"Budi Santoso","external_ref":"7712839","occurred_at":"2026-10-08T14:32","source":"ocr","confidence":0.93}
```

## Lampiran B — Alur Pengguna Utama

1. **Catat suara dari widget:** ketuk 🎤 di widget → rekam → hasil transkrip + draft → Simpan (≤ 5 detik).
2. **Screenshot bukti QRIS:** ambil screenshot di aplikasi e-wallet → Share → Catat → layar konfirmasi → Simpan.
3. **SMS bank (otomatis):** SMS masuk → Shortcuts Automation memicu App Intent → draft di Inbox → konfirmasi massal malam hari.
4. **Akhir bulan:** buka Laporan → tinjau kategori → atur ulang budget → backup file terenkripsi.
