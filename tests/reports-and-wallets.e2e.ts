import { test } from '@e2e-dev/web';
import { expect } from 'e2e';

test('delete wallet and reassign its data', async ({ app, screen }) => {
  await app.open('/');
  await expect(screen.getByText('On-Device')).toBeVisible();

  await screen.getByRole('button', { name: 'Lainnya', exact: true }).click();
  await screen.getByText('Dompet & Rekening').click();

  const walletName = `Dompet Hapus ${Date.now().toString().slice(-4)}`;

  await screen.getByRole('button', { name: '+ Dompet' }).click();
  await expect(screen.getByText('Tambah Dompet Baru')).toBeVisible();
  await screen.getByRole('textbox').fill(walletName);
  await screen.getByRole('button', { name: 'Tambah', exact: true }).click();
  await expect(screen.getByText(walletName)).toBeVisible();

  await screen.getByRole('button', { name: `Hapus dompet ${walletName}` }).click();
  await expect(screen.getByRole('heading', { name: 'Hapus Dompet?' })).toBeVisible();
  await expect(screen.getByText('Pindahkan ke Dompet')).toBeVisible();

  await screen.getByRole('button', { name: 'Hapus Dompet', exact: true }).click();

  await expect(screen.getByText(walletName)).not.toBeVisible();
  await expect(screen.getByText('Dompet & Rekening')).toBeVisible();
});

test('financial report shows monthly and yearly pie charts', async ({ app, screen }) => {
  await app.open('/');
  await expect(screen.getByText('On-Device')).toBeVisible();

  // Create a confirmed expense in the current month.
  await screen.getByRole('button', { name: 'Catat Transaksi' }).click();
  await expect(screen.getByRole('heading', { name: /Catat Pengeluaran/i })).toBeVisible();
  await screen.getByRole('button', { name: '5', exact: true }).click();
  await screen.getByRole('button', { name: '000', exact: true }).click();
  await screen.getByRole('textbox', { name: 'Toko / Merchant' }).fill('Tes Laporan');
  await screen.getByRole('button', { name: /Simpan Transaksi/i }).click();

  await screen.getByRole('button', { name: 'Lainnya', exact: true }).click();
  await screen.getByText('Laporan Keuangan & Wawasan').click();

  await expect(screen.getByText('Diagram Pengeluaran')).toBeVisible();
  await expect(screen.getByText('Total Pengeluaran')).toBeVisible();

  const foodLegend = screen.getByRole('button', { name: /Jajan & Kuliner Lucu Rp/ });
  await expect(foodLegend).toBeVisible();
  await expect(foodLegend).toContainText('100%');

  // Yearly mode shows the whole year.
  await screen.getByRole('button', { name: 'Tahunan', exact: true }).click();
  await expect(
    screen.getByRole('group', {
      name: `Diagram pengeluaran Tahun ${new Date().getFullYear()}`,
    })
  ).toBeVisible();
  await expect(screen.getByText('Diagram Pengeluaran')).toBeVisible();

  // The previous month has no transactions.
  await screen.getByRole('button', { name: 'Bulanan', exact: true }).click();
  await screen.getByRole('button', { name: 'Periode sebelumnya' }).click();
  await expect(screen.getByText('Belum ada pengeluaran pada periode ini.')).toBeVisible();

  // Returning to the current month brings the chart back.
  await screen.getByRole('button', { name: 'Periode berikutnya' }).click();
  await expect(screen.getByText('Diagram Pengeluaran')).toBeVisible();
  await expect(screen.getByRole('button', { name: /Jajan & Kuliner Lucu Rp/ })).toBeVisible();
});
