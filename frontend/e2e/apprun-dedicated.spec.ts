import { test, expect } from '@playwright/test';

// E2Eサーバーがシードするデータ(e2e_server.go の seedAppRunDedicated を参照):
//   - e2e-cluster:        メインシナリオ用クラスタ
//     - e2e-app:          バージョン一覧・デプロイ・アクティブ化シナリオ用(v1を1件保持)
//     - e2e-doomed-app:   削除シナリオ用
//     - e2e-asg:          LB(e2e-lb)とワーカーノード1台を保持
//     - e2e-doomed-asg:   削除シナリオ用
//     - e2e-lb / e2e-doomed-lb: e2e-asg配下のロードバランサー
//   - e2e-doomed-cluster: 削除シナリオ用(中身は空)
// モックの状態はテスト間で共有されるため、このファイル内のテストは記述順に依存する。

const row = (page: import('@playwright/test').Page, name: string) =>
  page.locator('tr', { hasText: name });

test('クラスタ一覧からアプリ・ASG一覧に遷移できる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'AppRun専有型' }).click();
  await expect(page).toHaveURL(/#\/e2e\/apprun-dedicated$/);

  await expect(row(page, 'e2e-cluster')).toBeVisible();
  await expect(row(page, 'e2e-doomed-cluster')).toBeVisible();

  await row(page, 'e2e-cluster').click();

  await expect(row(page, 'e2e-app')).toBeVisible();
  await expect(row(page, 'e2e-doomed-app')).toBeVisible();
  await expect(row(page, 'e2e-asg')).toBeVisible();
  await expect(row(page, 'e2e-doomed-asg')).toBeVisible();
});

test('新しいバージョンをデプロイできる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'AppRun専有型' }).click();
  await row(page, 'e2e-cluster').click();
  await row(page, 'e2e-app').click();

  await expect(row(page, 'v1')).toBeVisible();

  await page.getByRole('button', { name: '+ デプロイ' }).click();
  await page.getByPlaceholder('docker.io/library/nginx:latest').fill('nginx:latest');
  await page.getByRole('button', { name: 'デプロイする' }).click();

  await expect(row(page, 'v2')).toBeVisible({ timeout: 10_000 });
});

test('バージョンをアクティブにしてから非アクティブ化できる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'AppRun専有型' }).click();
  await row(page, 'e2e-cluster').click();
  await row(page, 'e2e-app').click();
  await row(page, 'v1').click();

  await page.getByRole('button', { name: '⋯' }).click();
  await page.getByRole('button', { name: 'このバージョンをアクティブにする' }).click();

  await expect(page.getByText('Active')).toBeVisible();

  // パンくずでアプリ一覧(バージョン一覧)に戻る
  await page.locator('.breadcrumb').getByText('e2e-app').click();
  await expect(page.getByRole('button', { name: '非アクティブ化' })).toBeVisible();

  await page.getByRole('button', { name: '非アクティブ化' }).click();
  await expect(page.getByRole('button', { name: '非アクティブ化' })).toHaveCount(0, { timeout: 10_000 });
});

test('ASG詳細でロードバランサー・ワーカーノードを確認できる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'AppRun専有型' }).click();
  await row(page, 'e2e-cluster').click();
  await row(page, 'e2e-asg').click();

  await expect(page.getByText('e2e-lb', { exact: true })).toBeVisible();
  await expect(page.getByText('e2e-doomed-lb', { exact: true })).toBeVisible();
  await expect(page.getByText('ワーカーノードがありません')).toHaveCount(0);
  await expect(page.getByRole('columnheader', { name: 'Draining' })).toBeVisible();
});

test('ロードバランサー・ASG・アプリ・クラスタを削除できる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'AppRun専有型' }).click();
  await row(page, 'e2e-cluster').click();

  // LB削除(ASG詳細から)。LBはtrではなくdivで描画されるため、名前の親要素から削除ボタンを辿る。
  await row(page, 'e2e-asg').click();
  await page.getByText('e2e-doomed-lb', { exact: true }).locator('xpath=..').getByRole('button', { name: '削除' }).click();
  await expect(page.getByText('「e2e-doomed-lb」を削除しますか？')).toBeVisible();
  await page.getByRole('button', { name: '削除する' }).click();
  await expect(row(page, 'e2e-doomed-lb')).toHaveCount(0, { timeout: 10_000 });

  // ASG削除(クラスタ詳細に戻って)
  await page.locator('.breadcrumb').getByText('e2e-cluster').click();
  await row(page, 'e2e-doomed-asg').getByRole('button', { name: '削除' }).click();
  await expect(page.getByText('「e2e-doomed-asg」を削除しますか？')).toBeVisible();
  await page.getByRole('button', { name: '削除する' }).click();
  await expect(row(page, 'e2e-doomed-asg')).toHaveCount(0, { timeout: 10_000 });

  // アプリ削除
  await row(page, 'e2e-doomed-app').getByRole('button', { name: '削除' }).click();
  await expect(page.getByText('「e2e-doomed-app」を削除しますか？')).toBeVisible();
  await page.getByRole('button', { name: '削除する' }).click();
  await expect(row(page, 'e2e-doomed-app')).toHaveCount(0, { timeout: 10_000 });

  // クラスタ削除(クラスタ一覧に戻って)
  await page.locator('.breadcrumb').getByText('クラスタ').click();
  await row(page, 'e2e-doomed-cluster').getByRole('button', { name: '削除' }).click();
  await expect(page.getByText('「e2e-doomed-cluster」を削除しますか？')).toBeVisible();
  await page.getByRole('button', { name: '削除する' }).click();
  await expect(row(page, 'e2e-doomed-cluster')).toHaveCount(0, { timeout: 10_000 });
  await expect(row(page, 'e2e-cluster')).toBeVisible();
});
