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

  // Back to menu
  await screen.getByText('Kembali ke Pengaturan').click();

  // Open Kategori
  await screen.getByText('Kategori Transaksi').click();
  await expect(screen.getByRole('button', { name: 'Tambah' })).toBeVisible();

  // Back to menu
  await screen.getByText('Kembali ke Pengaturan').click();
  await expect(screen.getByText('Pengaturan')).toBeVisible();
});
