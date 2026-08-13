import { test, expect } from '@playwright/test';

// E2Eサーバーがsakumock CloudHSMにシードするデータ(e2e_server.go の seedCloudHSM を参照):
//   - e2e-cloudhsm-1:        表示確認用(接続クライアント e2e-client-1、ピア 112233445566 あり)
//   - e2e-cloudhsm-doomed:   削除シナリオ用
//   - e2e-cloudhsm-editable: 編集シナリオ用
//   - ソフトウェアライセンス: e2e-license-1 / e2e-doomed-license / e2e-editable-license

const hsmCard = (page: import('@playwright/test').Page, name: string) =>
  page.locator('.card', { has: page.locator('.card-title', { hasText: name }) });

test('シードされたCloudHSMが一覧表示される', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'CloudHSM' }).click();
  await expect(page).toHaveURL(/#\/e2e\/cloudhsm$/);

  await expect(hsmCard(page, 'e2e-cloudhsm-1')).toBeVisible();
  const card = hsmCard(page, 'e2e-cloudhsm-1');
  await expect(card.getByText('available')).toBeVisible();
  await expect(card.getByText(/192\.168\.101\.0\/24/)).toBeVisible();
});

test('CloudHSMを作成すると一覧に追加される', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'CloudHSM' }).click();

  await page.getByRole('button', { name: '+ HSM作成' }).click();
  await page.getByPlaceholder('my-hsm').fill('e2e-created-hsm');
  await page.getByPlaceholder('192.168.100.0').fill('192.168.200.0');
  await page.getByRole('button', { name: '作成する' }).click();

  await expect(hsmCard(page, 'e2e-created-hsm')).toBeVisible();
});

test('CloudHSM詳細で基本情報を編集できる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'CloudHSM' }).click();
  await hsmCard(page, 'e2e-cloudhsm-editable').click();
  await expect(page).toHaveURL(/#\/e2e\/cloudhsm\//);
  await expect(page.getByRole('heading', { name: 'CloudHSM詳細: e2e-cloudhsm-editable' })).toBeVisible();

  const basicInfoCard = page.locator('.card', { has: page.locator('h4', { hasText: '基本情報' }) });
  await basicInfoCard.getByRole('button', { name: '編集' }).click();
  const nameInput = page.locator('.form-group', { has: page.locator('label', { hasText: '名前' }) }).locator('input');
  await nameInput.fill('e2e-cloudhsm-editable-renamed');
  await page.getByRole('button', { name: '保存する' }).click();

  await expect(page.getByText('CloudHSM詳細: e2e-cloudhsm-editable-renamed')).toBeVisible();
});

test('CloudHSMを削除すると一覧から消える', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'CloudHSM' }).click();

  const card = hsmCard(page, 'e2e-cloudhsm-doomed');
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: '削除', exact: true }).click();

  await expect(page.getByText('CloudHSM「e2e-cloudhsm-doomed」を削除しますか？')).toBeVisible();
  await page.getByRole('button', { name: '削除する' }).click();

  await expect(hsmCard(page, 'e2e-cloudhsm-doomed')).toHaveCount(0, { timeout: 10_000 });
  await expect(hsmCard(page, 'e2e-cloudhsm-1')).toHaveCount(1);
});

test('接続クライアントタブに切り替えると一覧表示され、新規作成・削除できる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'CloudHSM' }).click();
  await hsmCard(page, 'e2e-cloudhsm-1').click();
  await expect(page.getByRole('heading', { name: 'CloudHSM詳細: e2e-cloudhsm-1' })).toBeVisible();

  await expect(page.getByRole('cell', { name: 'e2e-client-1' })).toBeVisible();

  await page.getByRole('button', { name: '+ クライアント作成' }).click();
  await page.getByPlaceholder('app-client').fill('e2e-created-client');
  await page.getByPlaceholder('-----BEGIN CERTIFICATE-----...').fill('-----BEGIN CERTIFICATE-----\ndummy\n-----END CERTIFICATE-----');
  await page.getByRole('button', { name: '作成する' }).click();

  await expect(page.getByRole('cell', { name: 'e2e-created-client' })).toBeVisible();

  const row = page.locator('tr', { has: page.getByRole('cell', { name: 'e2e-created-client' }) });
  await row.getByRole('button', { name: '削除' }).click();
  await expect(page.getByText(/を削除しますか？/)).toBeVisible();
  await page.getByRole('button', { name: '削除する' }).click();

  await expect(page.getByRole('cell', { name: 'e2e-created-client' })).toHaveCount(0, { timeout: 10_000 });
});

test('ピアタブに切り替えると一覧表示され、新規作成・削除できる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'CloudHSM' }).click();
  await hsmCard(page, 'e2e-cloudhsm-1').click();
  await expect(page.getByRole('heading', { name: 'CloudHSM詳細: e2e-cloudhsm-1' })).toBeVisible();

  await page.getByRole('button', { name: 'ピア' }).click();
  await expect(page.getByRole('cell', { name: '112233445566' })).toBeVisible();

  await page.getByRole('button', { name: '+ ピア作成' }).click();
  await page.getByPlaceholder('対向ルーターのID').fill('665544332211');
  await page.getByPlaceholder('対向ルーターと共有するシークレットキー').fill('e2e-created-peer-secret');
  await page.getByRole('button', { name: '作成する' }).click();

  await expect(page.getByRole('cell', { name: '665544332211' })).toBeVisible();

  const row = page.locator('tr', { has: page.getByRole('cell', { name: '665544332211' }) });
  await row.getByRole('button', { name: '削除' }).click();
  await expect(page.getByText(/を削除しますか？/)).toBeVisible();
  await page.getByRole('button', { name: '削除する' }).click();

  await expect(page.getByRole('cell', { name: '665544332211' })).toHaveCount(0, { timeout: 10_000 });
});

test('ソフトウェアライセンスタブに切り替えると一覧表示され、新規作成・削除できる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'CloudHSM' }).click();
  await page.getByRole('button', { name: 'ソフトウェアライセンス' }).click();

  await expect(page.getByRole('cell', { name: 'e2e-license-1' })).toBeVisible();

  await page.getByRole('button', { name: '+ ライセンス作成' }).click();
  await page.getByPlaceholder('my-license').fill('e2e-created-license');
  await page.getByRole('button', { name: '作成する' }).click();

  await expect(page.getByRole('cell', { name: 'e2e-created-license' })).toBeVisible();

  const doomedRow = page.locator('tr', { has: page.getByRole('cell', { name: 'e2e-doomed-license' }) });
  await doomedRow.getByRole('button', { name: '削除' }).click();
  await expect(page.getByText('ライセンス「e2e-doomed-license」を削除しますか？')).toBeVisible();
  await page.getByRole('button', { name: '削除する' }).click();

  await expect(page.getByRole('cell', { name: 'e2e-doomed-license' })).toHaveCount(0, { timeout: 10_000 });
});
