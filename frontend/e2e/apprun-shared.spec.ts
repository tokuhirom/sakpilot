import { test, expect } from '@playwright/test';

// E2Eサーバーがシードするデータ(e2e_server.go の seedAppRunShared を参照):
//   - ユーザー作成済み、アプリケーション"e2e-shared-app"(コンポーネント1件)を1件保持
// 全テストで単一のバックエンドプロセスを共有するため、削除テストは
// シード済みの"e2e-shared-app"ではなく専用に作成したアプリを対象にする。
// バージョン削除・トラフィック分散変更は、単一バージョンの状態では
// 意味のある操作にならず(最新かつ唯一のバージョンは削除・分散変更ができない)、
// 複数バージョンを作るには編集操作を繰り返す必要があり時刻丸め起因で
// どちらが「最新版」になるか不定というsakumock側の制約があるため、
// Go側のユニットテスト(service_test.go)でのみカバーする。

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

  // 基本情報カード・トラフィック分散カードの両方に「編集」ボタンがあるため、
  // 先に表示される基本情報側を指定する。
  await page.getByRole('button', { name: '編集' }).first().click();
  await page.getByLabel('最大スケール').fill('5');
  await page.getByRole('button', { name: '保存する' }).click();

  await expect(page.getByText('0 - 5')).toBeVisible();
});

test('アプリケーションを削除すると一覧から消える', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'AppRun共用型' }).click();
  await expect(page).toHaveURL(/#\/e2e\/apprun-shared$/);

  await page.getByRole('button', { name: '+ アプリ作成' }).click();
  await page.getByPlaceholder('my-app').fill('e2e-delete-target');
  await page.getByPlaceholder('docker.io/library/nginx:latest').fill('docker.io/library/nginx:latest');
  await page.getByRole('button', { name: '作成する' }).click();

  const row = page.locator('tr', { hasText: 'e2e-delete-target' });
  await expect(row).toBeVisible();

  await row.getByRole('button', { name: '削除' }).click();
  await expect(page.getByText('「e2e-delete-target」を削除しますか？')).toBeVisible();
  await page.getByRole('button', { name: '削除する' }).click();

  await expect(row).not.toBeVisible();
});
