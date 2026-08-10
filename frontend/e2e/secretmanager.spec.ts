import { test, expect } from '@playwright/test';

// E2Eサーバーがsakumock secretmanagerにシードするデータ(e2e_server.go の
// seedSecretManagerVaults を参照):
//   - e2e-vault-1:        シークレット(e2e-secret)を1件持つ。表示確認・追加シナリオ用
//   - e2e-doomed-vault:   削除シナリオ用
//   - e2e-editable-vault: 編集シナリオ用

const vaultCard = (page: import('@playwright/test').Page, name: string) =>
  page.locator('.card', { has: page.locator('.card-title', { hasText: name }) });

test('シードされたVaultが一覧表示される', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'シークレットマネージャー' }).click();
  await expect(page).toHaveURL(/#\/e2e\/secretmanager$/);

  await expect(vaultCard(page, 'e2e-vault-1')).toBeVisible();
});

test('Vaultを作成すると一覧に追加される', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'シークレットマネージャー' }).click();

  await page.getByRole('button', { name: '+ Vault作成' }).click();
  await page.getByPlaceholder('my-vault').fill('e2e-created-vault');
  await page.getByPlaceholder('任意', { exact: true }).fill('created by e2e');
  await page.getByRole('button', { name: '作成する' }).click();

  await expect(vaultCard(page, 'e2e-created-vault')).toBeVisible();
});

test('Vault詳細で基本情報を編集できる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'シークレットマネージャー' }).click();
  await vaultCard(page, 'e2e-editable-vault').click();
  await expect(page).toHaveURL(/#\/e2e\/secretmanager\//);
  await expect(page.getByRole('heading', { name: 'Vault詳細: e2e-editable-vault' })).toBeVisible();

  await page.getByRole('button', { name: '編集' }).click();
  const nameInput = page.locator('.form-group', { has: page.locator('label', { hasText: '名前' }) }).locator('input');
  await nameInput.fill('e2e-editable-vault-renamed');
  await page.getByRole('button', { name: '保存する' }).click();

  await expect(page.getByText('Vault詳細: e2e-editable-vault-renamed')).toBeVisible();
});

test('Vaultを削除すると一覧から消える', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'シークレットマネージャー' }).click();

  const card = vaultCard(page, 'e2e-doomed-vault');
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: '削除', exact: true }).click();

  await expect(page.getByText('Vault「e2e-doomed-vault」を削除しますか？')).toBeVisible();
  await page.getByRole('button', { name: '削除する' }).click();

  await expect(vaultCard(page, 'e2e-doomed-vault')).toHaveCount(0, { timeout: 10_000 });
  await expect(vaultCard(page, 'e2e-vault-1')).toHaveCount(1);
});

test('Vault詳細でシークレットの表示・追加・削除ができる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'シークレットマネージャー' }).click();
  await vaultCard(page, 'e2e-vault-1').click();
  await expect(page).toHaveURL(/#\/e2e\/secretmanager\//);
  await expect(page.getByRole('heading', { name: 'Vault詳細: e2e-vault-1' })).toBeVisible();

  // 表示
  const secretRow = page.locator('tr', { has: page.getByText('e2e-secret', { exact: true }) });
  await expect(secretRow).toBeVisible();
  await secretRow.getByRole('button', { name: '値を表示' }).click();
  await expect(secretRow.getByText('e2e-secret-value')).toBeVisible();
  await secretRow.getByRole('button', { name: '隠す' }).click();
  await expect(secretRow.getByText('e2e-secret-value')).toHaveCount(0);

  // 追加
  await page.getByRole('button', { name: '+ シークレット追加' }).click();
  await page.getByPlaceholder('api-key').fill('e2e-secret-2');
  await page.getByPlaceholder('シークレットの値').fill('e2e-secret-2-value');
  await page.getByRole('button', { name: '保存する' }).click();
  await expect(page.getByText('e2e-secret-2')).toBeVisible();

  // 削除
  const newSecretRow = page.locator('tr', { has: page.getByText('e2e-secret-2', { exact: true }) });
  await newSecretRow.getByRole('button', { name: '削除' }).click();
  await expect(page.getByText('シークレット「e2e-secret-2」を削除しますか？')).toBeVisible();
  await page.getByRole('button', { name: '削除する' }).click();
  await expect(page.getByText('e2e-secret-2')).toHaveCount(0);
});
