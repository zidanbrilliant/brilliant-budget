import { test } from '@e2e-dev/web';
import { expect } from 'e2e';

test('create manual expense transaction', async ({ app, screen }) => {
  await app.open('/');
  await expect(screen.getByText('On-Device')).toBeVisible();

  const uniqueMerchant = `Kopi Mantap ${Date.now()}`;

  // Open Catat Modal from tab bar
  await screen.getByRole('button', { name: 'Catat Transaksi' }).click();
  await expect(screen.getByRole('heading', { name: /Catat Pengeluaran/i })).toBeVisible();

  // Keypad: press 5, 0, 000 (50.000)
  await screen.getByRole('button', { name: '5', exact: true }).click();
  await screen.getByRole('button', { name: '0', exact: true }).click();
  await screen.getByRole('button', { name: '000', exact: true }).click();

  // Enter merchant
  const merchantInput = screen.getByRole('textbox', { name: 'Toko / Merchant' });
  await merchantInput.fill(uniqueMerchant);

  // Submit transaction
  await screen.getByRole('button', { name: /Simpan Transaksi/i }).click();

  // Verify modal closed
  await expect(screen.getByRole('heading', { name: /Catat Pengeluaran/i })).not.toBeVisible();

  // Go to Transaksi tab
  await screen.getByRole('button', { name: 'Transaksi', exact: true }).click();
  await expect(screen.getByText(uniqueMerchant)).toBeVisible();
});

test('voice and ocr shortcuts open and work', async ({ app, screen }) => {
  await app.open('/');
  await expect(screen.getByText('On-Device')).toBeVisible();
  await expect(screen.getByText('Dompet & Tabungan 👛')).toBeVisible();

  // Click shortcut Suara from Beranda
  await screen.getByRole('button', { name: 'Suara', exact: true }).click();
  await expect(screen.getByText('Ketuk untuk Bicara')).toBeVisible();

  // Try clicking preset example
  await screen.getByRole('button', { name: /"Makan siang 35rb GoPay"/i }).click();
  await expect(screen.getByText('Hasil Ekstraksi (1 Transaksi)')).toBeVisible();
  await expect(screen.getByText('Keyakinan 92%')).toBeVisible();

  // Save parsed items
  await screen.getByRole('button', { name: 'Konfirmasi Simpan', exact: true }).click();

  // Verify modal closed
  await expect(screen.getByText('Ketuk untuk Bicara')).not.toBeVisible();
});

test('income quick action opens income form', async ({ app, screen }) => {
  await app.open('/');
  await expect(screen.getByText('On-Device')).toBeVisible();

  await screen.getByRole('button', { name: 'Masuk', exact: true }).click();
  await expect(screen.getByRole('heading', { name: /Catat Pemasukan/i })).toBeVisible();
  await expect(screen.getByText('Nominal Transaksi (IDR)')).toBeVisible();
});

test('budget setup and edit modal', async ({ app, screen }) => {
  await app.open('/');
  await expect(screen.getByText('On-Device')).toBeVisible();

  // Go to Budget
  await screen.getByRole('button', { name: 'Budget', exact: true }).click();
  await expect(screen.getByRole('button', { name: 'Atur Budget' })).toBeVisible();

  // Open Atur Budget
  await screen.getByRole('button', { name: 'Atur Budget' }).click();
  await expect(screen.getByRole('heading', { name: 'Metode Anggaran' })).toBeVisible();

  // Set monthly limit then save
  await screen.getByPlaceholder('Mis. 5000000').fill('5000000');
  await screen.getByRole('button', { name: 'Simpan', exact: true }).click();
  await expect(screen.getByRole('heading', { name: 'Metode Anggaran' })).not.toBeVisible();
});

test('lainnya sub-views navigation', async ({ app, screen }) => {
  await app.open('/');
  await expect(screen.getByText('On-Device')).toBeVisible();

  // Go to Lainnya
  await screen.getByRole('button', { name: 'Lainnya', exact: true }).click();
  await expect(screen.getByText('Pengaturan')).toBeVisible();

  // Open Dompet & Rekening
  await screen.getByText('Dompet & Rekening').click();
  await expect(screen.getByRole('button', { name: '+ Dompet' })).toBeVisible();

  // Test wallet edit
  await screen.getByRole('button', { name: /Ubah nama BCA Utama/i }).click();
  await expect(screen.getByRole('heading', { name: 'Ubah Dompet' })).toBeVisible();
  await screen.getByPlaceholder('Nama Dompet').fill('BCA Bisnis');
  await screen.getByRole('button', { name: 'Simpan', exact: true }).click();
  await expect(screen.getByText('BCA Bisnis')).toBeVisible();

  // Back to menu
  await screen.getByText('Kembali ke Pengaturan').click();

  // Open Kategori
  await screen.getByText('Kategori Transaksi').click();
  await expect(screen.getByRole('button', { name: 'Tambah' })).toBeVisible();

  // Back to menu
  await screen.getByText('Kembali ke Pengaturan').click();
  await expect(screen.getByText('Pengaturan')).toBeVisible();
});

test('savings goal tab creates goal with deadline', async ({ app, screen }) => {
  await app.open('/');
  await expect(screen.getByText('On-Device')).toBeVisible();

  await screen.getByRole('button', { name: 'Budget', exact: true }).click();
  await screen.getByRole('button', { name: 'Target Tabungan', exact: true }).click();

  await expect(screen.getByText('Belum ada target tabungan')).toBeVisible();

  await screen.getByRole('button', { name: 'Buat Target Pertama' }).click();
  await expect(screen.getByRole('heading', { name: 'Target Tabungan Baru' })).toBeVisible();

  await screen.getByPlaceholder('Mis. Dana Darurat, Liburan').fill('Dana Darurat');
  await screen.getByPlaceholder('5000000').fill('12000000');

  // Calendar dropdown works and the field also accepts manual DD/MM/YYYY input.
  await screen.getByRole('button', { name: 'Buka kalender' }).click();
  await expect(screen.getByRole('dialog', { name: 'Pilih tanggal' })).toBeVisible();
  await screen.getByRole('button', { name: 'Hari ini' }).click();
  await screen.getByLabel('Tenggat waktu').fill('30/06/2027');
  await screen.getByRole('button', { name: 'Simpan Target' }).click();

  await expect(screen.getByText('Dana Darurat')).toBeVisible();
  await expect(screen.getByText('30 Jun 2027')).toBeVisible();
  await expect(screen.getByText('Kurang Rp 12.000.000')).toBeVisible();
  await expect(screen.getByText('Total terkumpul')).toBeVisible();
});

test('recurring subscription picks a day from the calendar', async ({ app, screen }) => {
  await app.open('/');
  await expect(screen.getByText('On-Device')).toBeVisible();

  await screen.getByRole('button', { name: 'Budget', exact: true }).click();
  await screen.getByRole('button', { name: 'Langganan', exact: true }).first().click();
  await screen.getByRole('button', { name: 'Langganan', exact: true }).last().click();

  await expect(
    screen.getByRole('heading', { name: 'Tambah Langganan / Rutinitas' })
  ).toBeVisible();

  const dateField = screen.getByRole('button', { name: 'Tanggal jatuh tempo' });
  await expect(dateField).toHaveText('Pilih tanggal');

  await dateField.click();
  await expect(screen.getByRole('dialog', { name: 'Pilih tanggal' })).toBeVisible();
  await screen.getByRole('button', { name: 'Tanggal 15', exact: true }).click();
  await expect(dateField).toHaveText('Tgl 15');

  await screen.getByPlaceholder('Mis. Spotify, iCloud, BPJS').fill('Netflix');
  await screen.getByPlaceholder('0').first().fill('54000');
  await screen.getByRole('button', { name: 'Simpan', exact: true }).click();

  await expect(screen.getByText(/Tiap tgl 15/)).toBeVisible();

  // Editing shows the saved day, and the field can be emptied again.
  await screen.getByRole('button', { name: 'Edit Netflix' }).click();
  await expect(dateField).toHaveText('Tgl 15');
  await screen.getByRole('button', { name: 'Hapus tanggal' }).click();
  await expect(dateField).toHaveText('Pilih tanggal');
  await screen.getByRole('button', { name: 'Simpan Perubahan' }).click();
  await expect(screen.getByText('Pilih tanggal dulu.')).toBeVisible();

  // Pick another day and save the change.
  await dateField.click();
  await screen.getByRole('button', { name: 'Tanggal 31', exact: true }).click();
  await screen.getByRole('button', { name: 'Simpan Perubahan' }).click();
  await expect(screen.getByText(/Tiap tgl 31/)).toBeVisible();
});

