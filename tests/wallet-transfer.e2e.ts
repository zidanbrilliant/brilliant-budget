import { test } from '@e2e-dev/web';
import { expect } from 'e2e';

test('add new wallet and adjust balance', async ({ app, screen }) => {
  await app.open('/');
  await expect(screen.getByText('On-Device')).toBeVisible();

  // Go to Lainnya -> Dompet & Rekening
  await screen.getByRole('button', { name: 'Lainnya', exact: true }).click();
  await screen.getByText('Dompet & Rekening').click();

  const walletName = `Bank Mega ${Date.now().toString().slice(-4)}`;

  // Click + Dompet
  await screen.getByRole('button', { name: '+ Dompet' }).click();
  await expect(screen.getByText('Tambah Dompet Baru')).toBeVisible();

  // Fill wallet name
  await screen.getByRole('textbox').fill(walletName);

  // Submit via "Tambah" button
  await screen.getByRole('button', { name: 'Tambah', exact: true }).click();

  // Verify wallet appears
  await expect(screen.getByText(walletName)).toBeVisible();
});

test('transfer between accounts', async ({ app, screen }) => {
  await app.open('/');
  await expect(screen.getByText('On-Device')).toBeVisible();

  // Go to Lainnya -> Dompet & Rekening
  await screen.getByRole('button', { name: 'Lainnya', exact: true }).click();
  await screen.getByText('Dompet & Rekening').click();

  // Click Transfer
  await screen.getByRole('button', { name: 'Transfer' }).click();
  await expect(screen.getByRole('heading', { name: 'Transfer Antar Dompet' })).toBeVisible();

  // Close transfer modal
  await screen.getByRole('button', { name: 'Batal' }).click();
  await expect(screen.getByRole('heading', { name: 'Transfer Antar Dompet' })).not.toBeVisible();
});
