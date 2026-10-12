import { test } from '@e2e-dev/web';
import { expect } from 'e2e';

test('lock screen and biometric unlock', async ({ app, screen }) => {
  await app.open('/');
  await expect(screen.getByText('Offline SQLite')).toBeVisible();

  // Click Kunci Aplikasi
  await screen.getByRole('button', { name: 'Kunci Aplikasi' }).click();
  await expect(screen.getByText(/Brilliant Budget Terkunci/i)).toBeVisible();

  // Unlock with FaceID button
  await screen.getByRole('button', { name: 'Face ID' }).click();

  // Verify unlocked
  await expect(screen.getByText(/Brilliant Budget Terkunci/i)).not.toBeVisible();
});

test('lock screen pin validation rejects wrong pin and unlocks on correct pin', async ({ app, screen }) => {
  await app.open('/');
  await expect(screen.getByText('Offline SQLite')).toBeVisible();

  // Click Kunci Aplikasi
  await screen.getByRole('button', { name: 'Kunci Aplikasi' }).click();
  await expect(screen.getByText(/Brilliant Budget Terkunci/i)).toBeVisible();

  // Enter wrong PIN: 9, 9, 9, 9
  await screen.getByRole('button', { name: '9' }).click();
  await screen.getByRole('button', { name: '9' }).click();
  await screen.getByRole('button', { name: '9' }).click();
  await screen.getByRole('button', { name: '9' }).click();

  // Error message should appear
  await expect(screen.getByText(/PIN salah/i)).toBeVisible();
  // App should remain locked
  await expect(screen.getByText(/Brilliant Budget Terkunci/i)).toBeVisible();

  // Enter correct PIN: 1, 2, 3, 4
  await screen.getByRole('button', { name: '1' }).click();
  await screen.getByRole('button', { name: '2' }).click();
  await screen.getByRole('button', { name: '3' }).click();
  await screen.getByRole('button', { name: '4' }).click();

  // Verify unlocked
  await expect(screen.getByText(/Brilliant Budget Terkunci/i)).not.toBeVisible();
});

test('sms bank simulator creates draft and confirm on home', async ({ app, screen }) => {
  await app.open('/');
  await expect(screen.getByText('Offline SQLite')).toBeVisible();

  // Go to Lainnya -> Simulator SMS
  await screen.getByRole('button', { name: 'Lainnya', exact: true }).click();
  await screen.getByText('Uji Parser SMS Shortcuts').click();
  await expect(screen.getByText('Uji Coba Otomatisasi SMS Bank (FR-22)')).toBeVisible();

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
