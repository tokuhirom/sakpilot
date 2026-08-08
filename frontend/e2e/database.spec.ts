import { test, expect } from '@playwright/test';

// E2Eサーバーがシードするデータ(e2e_server.go の seedDatabases を参照):
//   - e2e-db-1:      status=up   (電源操作シナリオ用)
//   - e2e-doomed-db: status=down (削除シナリオ用)
// モックの状態はテスト間で共有されるため、このファイル内のテストは記述順に依存する。

const dbCard = (page: import('@playwright/test').Page, name: string) =>
  page.locator('.card', { has: page.locator('.card-title', { hasText: name }) });

test('シードされたデータベースが一覧表示される', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'データベース' }).click();
  await expect(page).toHaveURL(/#\/e2e\/databases$/);

  await expect(dbCard(page, 'e2e-db-1').locator('.status')).toHaveText('up');
  await expect(dbCard(page, 'e2e-doomed-db').locator('.status')).toHaveText('down');
});

test('起動中のデータベースを停止すると、ポーリング後にステータスがdownになる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'データベース' }).click();
  const card = dbCard(page, 'e2e-db-1');
  await expect(card.locator('.status')).toHaveText('up');

  await card.getByRole('button', { name: '⋮' }).click();
  await card.getByRole('button', { name: '停止', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'データベース停止' })).toBeVisible();
  await page.getByRole('button', { name: '停止する' }).click();

  await expect(card.locator('.status')).toHaveText('down', { timeout: 15_000 });
});

test('停止中のデータベースを起動すると、ポーリング後にステータスがupになる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'データベース' }).click();
  // 直前のテストでe2e-db-1はdownになっている
  const card = dbCard(page, 'e2e-db-1');
  await expect(card.locator('.status')).toHaveText('down');

  await card.getByRole('button', { name: '⋮' }).click();
  await card.getByRole('button', { name: '起動', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'データベース起動' })).toBeVisible();
  await page.getByRole('button', { name: '起動する' }).click();

  await expect(card.locator('.status')).toHaveText('up', { timeout: 15_000 });
});

test('起動中のデータベースを再起動できる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'データベース' }).click();
  // 直前のテストでe2e-db-1はupになっている
  const card = dbCard(page, 'e2e-db-1');
  await expect(card.locator('.status')).toHaveText('up');

  await card.getByRole('button', { name: '⋮' }).click();
  await card.getByRole('button', { name: '再起動', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'データベース再起動' })).toBeVisible();
  await page.getByRole('button', { name: '再起動する' }).click();

  await expect(card.locator('.status')).toHaveText('up', { timeout: 15_000 });
});

test('停止中のデータベースを削除すると一覧から消える', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'データベース' }).click();
  const card = dbCard(page, 'e2e-doomed-db');
  await expect(card.locator('.status')).toHaveText('down');

  await card.getByRole('button', { name: '⋮' }).click();
  await card.getByRole('button', { name: '削除', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'データベース削除' })).toBeVisible();
  await expect(page.getByText('この操作は取り消せません')).toBeVisible();
  await page.getByRole('button', { name: '削除する' }).click();

  await expect(dbCard(page, 'e2e-doomed-db')).toHaveCount(0, { timeout: 10_000 });
  await expect(dbCard(page, 'e2e-db-1')).toHaveCount(1);
});
