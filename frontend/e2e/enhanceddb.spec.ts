import { test, expect } from '@playwright/test';

// E2Eサーバーがシードするデータ(e2e_server.go の seedEnhancedDBs を参照):
//   - e2e-enhanceddb-1:        表示確認・パスワード再設定シナリオ用
//   - e2e-doomed-enhanceddb:   削除シナリオ用
//   - e2e-editable-enhanceddb: 編集シナリオ用

const dbCard = (page: import('@playwright/test').Page, name: string) =>
  page.locator('.card', { has: page.locator('.card-title', { hasText: name }) });

test('シードされたエンハンスドDBが一覧表示される', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'エンハンスドDB' }).click();
  await expect(page).toHaveURL(/#\/e2e\/enhanced-db$/);

  await expect(dbCard(page, 'e2e-enhanceddb-1')).toBeVisible();
  const card = dbCard(page, 'e2e-enhanceddb-1');
  await expect(card.getByText('TiDB', { exact: true })).toBeVisible();
  await expect(card.getByText('DB名: e2edb1')).toBeVisible();
});

test('エンハンスドDBを作成すると一覧に追加される', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'エンハンスドDB' }).click();

  await page.getByRole('button', { name: '+ 作成' }).click();
  await page.getByPlaceholder('my-enhanced-db').fill('e2e-created-enhanceddb');
  await page.getByPlaceholder('mydb').fill('e2ecreated');
  await page.getByRole('button', { name: '作成する' }).click();

  await expect(dbCard(page, 'e2e-created-enhanceddb')).toBeVisible();
});

test('エンハンスドDB詳細で基本情報を編集できる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'エンハンスドDB' }).click();
  await dbCard(page, 'e2e-editable-enhanceddb').click();
  await expect(page).toHaveURL(/#\/e2e\/enhanced-db\//);
  await expect(page.getByRole('heading', { name: 'エンハンスドDB詳細: e2e-editable-enhanceddb' })).toBeVisible();

  await page.getByRole('button', { name: '編集' }).click();
  const nameInput = page.locator('.form-group', { has: page.locator('label', { hasText: '名前' }) }).locator('input');
  await nameInput.fill('e2e-editable-enhanceddb-renamed');
  await page.getByRole('button', { name: '保存する' }).click();

  await expect(page.getByText('エンハンスドDB詳細: e2e-editable-enhanceddb-renamed')).toBeVisible();
});

test('エンハンスドDB詳細でパスワードを再設定できる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'エンハンスドDB' }).click();
  await dbCard(page, 'e2e-enhanceddb-1').click();
  await expect(page).toHaveURL(/#\/e2e\/enhanced-db\//);
  await expect(page.getByRole('heading', { name: 'エンハンスドDB詳細: e2e-enhanceddb-1' })).toBeVisible();

  await page.getByPlaceholder('管理ユーザーの新しいパスワード').fill('E2eNewPassword01');
  await page.getByRole('button', { name: 'パスワードを再設定' }).click();
  await expect(page.getByText('エンハンスドDB「e2e-enhanceddb-1」のパスワードを再設定しますか？')).toBeVisible();
  await page.getByRole('button', { name: '実行する' }).click();

  await expect(page.getByText('エンハンスドDB「e2e-enhanceddb-1」のパスワードを再設定しますか？')).toHaveCount(0);
});

test('エンハンスドDBを削除すると一覧から消える', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'エンハンスドDB' }).click();

  const card = dbCard(page, 'e2e-doomed-enhanceddb');
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: '削除', exact: true }).click();

  await expect(page.getByText('エンハンスドDB「e2e-doomed-enhanceddb」を削除しますか？')).toBeVisible();
  await page.getByRole('button', { name: '削除する' }).click();

  await expect(dbCard(page, 'e2e-doomed-enhanceddb')).toHaveCount(0, { timeout: 10_000 });
  await expect(dbCard(page, 'e2e-enhanceddb-1')).toHaveCount(1);
});
