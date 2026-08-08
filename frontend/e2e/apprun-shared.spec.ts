import { test, expect } from '@playwright/test';

// E2Eサーバーがシードするデータ(e2e_server.go の seedAppRunShared を参照):
//   - ユーザー作成済み、アプリケーション"e2e-shared-app"(コンポーネント1件)を1件保持
// Deleteに対応するAPI・UIがないため、削除は対象外。

test('アプリ一覧が表示され、詳細で基本情報・コンポーネントを確認できる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'AppRun共用型' }).click();
  await expect(page).toHaveURL(/#\/e2e\/apprun-shared$/);

  const appRow = page.locator('tr', { hasText: 'e2e-shared-app' });
  await expect(appRow).toBeVisible();

  // 行の中央でクリックすると公開URLリンク(stopPropagation済み)に当たることがあるため、
  // 名前セルを明示的にクリックする。
  await page.getByRole('cell', { name: 'e2e-shared-app', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'e2e-shared-app' })).toBeVisible();
  await expect(page.getByText('ポート')).toBeVisible();
  await expect(page.getByRole('cell', { name: 'web' })).toBeVisible();

  await page.getByRole('button', { name: '← 戻る' }).click();
  await expect(appRow).toBeVisible();
});

test('アプリケーションを新規作成すると一覧に表示される', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'AppRun共用型' }).click();
  await expect(page).toHaveURL(/#\/e2e\/apprun-shared$/);

  await page.getByRole('button', { name: '+ アプリ作成' }).click();
  await page.getByPlaceholder('my-app').fill('e2e-created-app');
  await page.getByPlaceholder('docker.io/library/nginx:latest').fill('docker.io/library/nginx:latest');
  await page.getByRole('button', { name: '作成する' }).click();

  await expect(page.locator('tr', { hasText: 'e2e-created-app' })).toBeVisible();
});

test('アプリ詳細でスケール・タイムアウト設定を編集できる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'AppRun共用型' }).click();
  await page.getByRole('cell', { name: 'e2e-shared-app', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'e2e-shared-app' })).toBeVisible();

  await page.getByRole('button', { name: '編集' }).click();
  await page.getByLabel('最大スケール').fill('5');
  await page.getByRole('button', { name: '保存する' }).click();

  await expect(page.getByText('0 - 5')).toBeVisible();
});
