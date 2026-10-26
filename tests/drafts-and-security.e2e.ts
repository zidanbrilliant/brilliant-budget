import { test } from '@e2e-dev/web';
import { expect } from 'e2e';

test('sms bank simulator creates draft and confirm on home', async ({ app, screen }) => {
  await app.open('/');
  await expect(screen.getByText('On-Device')).toBeVisible();

  // Go to Lainnya -> Simulator SMS
  await screen.getByRole('button', { name: 'Lainnya', exact: true }).click();
  await screen.getByText('Uji Parser SMS Shortcuts').click();
  await expect(screen.getByText('Uji Coba Otomatisasi SMS Bank')).toBeVisible();

  // Click Kirim & Ekstraksi ke Inbox Draft
  await expect(screen.getByRole('button', { name: /Tempel Clipboard/i })).toBeVisible();
  await screen.getByRole('button', { name: 'Kirim & Ekstraksi ke Inbox Draft' }).click();

  // Go to Beranda (matches "1 Beranda" or "Beranda")
  await screen.getByRole('button', { name: /Beranda/i }).click();

  // Draft banner should be visible
  await expect(screen.getByText(/Transaksi Menunggu Konfirmasi/i)).toBeVisible();

  // Click Konfirmasi Semua
  await screen.getByRole('button', { name: 'Konfirmasi Semua' }).click();

  // Draft banner should disappear
  await expect(screen.getByText(/Transaksi Menunggu Konfirmasi/i)).not.toBeVisible();
});
