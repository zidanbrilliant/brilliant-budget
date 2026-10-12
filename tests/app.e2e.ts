import { test } from '@e2e-dev/web';
import { expect } from 'e2e';

test('beranda loads and navigates tabs', async ({ app, screen }) => {
  await app.open('/');
  await expect(screen.getByText(/Sisa Anggaran Bulan Ini/i)).toBeVisible();

  // Tab Transaksi
  await screen.getByRole('button', { name: 'Transaksi', exact: true }).click();
  await expect(screen.getByText(/Riwayat Transaksi/i)).toBeVisible();

  // Tab Budget
  await screen.getByRole('button', { name: 'Budget', exact: true }).click();
  await expect(screen.getByText(/Budget &/i)).toBeVisible();

  // Tab Lainnya
  await screen.getByRole('button', { name: 'Lainnya', exact: true }).click();
  await expect(screen.getByText(/Pengaturan/i)).toBeVisible();
});
