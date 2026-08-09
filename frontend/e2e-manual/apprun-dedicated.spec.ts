import { test, expect } from '@playwright/test';
import { shot } from './helpers';

// docs/manual/apprun-dedicated.md 用のスクリーンショットを撮影する。
// 通常のE2E回帰テスト(frontend/e2e/apprun-dedicated.spec.ts)と同じ
// シードデータ(e2e_server.go の seedAppRunDedicated)・操作パターンを流用しているが、
// このファイルはCI(npm run test:e2e)には含まれず、`npm run docs:screenshots`
// (playwright.manual.config.ts、testDir: ./e2e-manual)からのみ実行される。
//
// シードデータ:
//   - e2e-cluster:        メインシナリオ用クラスタ
//     - e2e-app:          バージョン一覧・デプロイ・アクティブ化シナリオ用(v1を1件保持)
//     - e2e-doomed-app:   削除シナリオ用
//     - e2e-asg:          LB(e2e-lb)とワーカーノード1台を保持
//     - e2e-doomed-asg:   削除シナリオ用
//     - e2e-lb / e2e-doomed-lb: e2e-asg配下のロードバランサー
//   - e2e-doomed-cluster: 削除シナリオ用(中身は空)
//
// ASGの作成にはスイッチ等の実ネットワークリソースが必要でfakeドライバでは
// 表現しづらいため、作成モーダルの撮影対象からは除外している。
//
// 1つのtest内で連番のスクリーンショットを撮ることで、番号どおりの操作順序を保証する。

const RESOURCE = 'apprun-dedicated';

const row = (page: import('@playwright/test').Page, name: string) =>
  page.locator('tr', { hasText: name });

test('AppRun専有型マニュアル用スクリーンショット', async ({ page }) => {
  // 01: クラスタ一覧
  await page.goto('/');
  await page.getByRole('link', { name: 'AppRun専有型' }).click();
  await expect(page).toHaveURL(/#\/e2e\/apprun-dedicated$/);
  await expect(row(page, 'e2e-cluster')).toBeVisible();
  await shot(page, RESOURCE, '01-clusters.png');

  // 02: クラスタ作成モーダル(入力途中)
  await page.getByRole('button', { name: '+ クラスタ作成' }).click();
  await page.getByPlaceholder('my-cluster').fill('e2e-manual-cluster');
  await shot(page, RESOURCE, '02-create-cluster-modal.png');
  await page.getByRole('button', { name: 'キャンセル' }).click();

  // 03: クラスタ詳細(アプリ一覧 + ASG一覧)
  await row(page, 'e2e-cluster').click();
  await expect(row(page, 'e2e-app')).toBeVisible();
  await expect(row(page, 'e2e-asg')).toBeVisible();
  await shot(page, RESOURCE, '03-cluster-detail.png');

  // 04: アプリのバージョン一覧
  await row(page, 'e2e-app').click();
  await expect(row(page, 'v1')).toBeVisible();
  await shot(page, RESOURCE, '04-app-versions.png');

  // 05: デプロイモーダル(入力途中)
  await page.getByRole('button', { name: '+ デプロイ' }).click();
  await page.getByPlaceholder('docker.io/library/nginx:latest').fill('nginx:latest');
  await shot(page, RESOURCE, '05-deploy-modal.png');
  await page.getByRole('button', { name: 'デプロイする' }).click();
  await expect(row(page, 'v2')).toBeVisible({ timeout: 10_000 });

  // 06: バージョン詳細 + 操作メニュー
  await row(page, 'v1').click();
  await page.getByRole('button', { name: '⋯' }).click();
  await shot(page, RESOURCE, '06-version-actions-menu.png');
  await page.getByRole('button', { name: 'このバージョンをアクティブにする' }).click();
  await expect(page.getByText('Active')).toBeVisible();

  // 07: アクティブ化後のバージョン一覧(非アクティブ化ボタンあり)
  await page.locator('.breadcrumb').getByText('e2e-app').click();
  await expect(page.getByRole('button', { name: '非アクティブ化' })).toBeVisible();
  await shot(page, RESOURCE, '07-app-versions-active.png');
  await page.getByRole('button', { name: '非アクティブ化' }).click();
  await expect(page.getByRole('button', { name: '非アクティブ化' })).toHaveCount(0, { timeout: 10_000 });

  // 08: ASG詳細(ロードバランサー・ワーカーノード)
  await page.locator('.breadcrumb').getByText('e2e-cluster').click();
  await row(page, 'e2e-asg').click();
  await expect(page.getByText('e2e-lb', { exact: true })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Draining' })).toBeVisible();
  await shot(page, RESOURCE, '08-asg-detail.png');

  // 09: ロードバランサー削除確認ダイアログ
  await page.getByText('e2e-doomed-lb', { exact: true }).locator('xpath=..').getByRole('button', { name: '削除' }).click();
  await expect(page.getByText('「e2e-doomed-lb」を削除しますか？')).toBeVisible();
  await shot(page, RESOURCE, '09-delete-lb-confirm.png');
  await page.getByRole('button', { name: '削除する' }).click();
  await expect(row(page, 'e2e-doomed-lb')).toHaveCount(0, { timeout: 10_000 });

  // 10: ASG削除確認ダイアログ(クラスタ詳細に戻って)
  await page.locator('.breadcrumb').getByText('e2e-cluster').click();
  await row(page, 'e2e-doomed-asg').getByRole('button', { name: '削除' }).click();
  await expect(page.getByText('「e2e-doomed-asg」を削除しますか？')).toBeVisible();
  await shot(page, RESOURCE, '10-delete-asg-confirm.png');
  await page.getByRole('button', { name: '削除する' }).click();
  await expect(row(page, 'e2e-doomed-asg')).toHaveCount(0, { timeout: 10_000 });

  // 11: アプリ削除確認ダイアログ
  await row(page, 'e2e-doomed-app').getByRole('button', { name: '削除' }).click();
  await expect(page.getByText('「e2e-doomed-app」を削除しますか？')).toBeVisible();
  await shot(page, RESOURCE, '11-delete-app-confirm.png');
  await page.getByRole('button', { name: '削除する' }).click();
  await expect(row(page, 'e2e-doomed-app')).toHaveCount(0, { timeout: 10_000 });

  // 12: クラスタ削除確認ダイアログ(クラスタ一覧に戻って)
  await page.locator('.breadcrumb').getByText('クラスタ').click();
  await row(page, 'e2e-doomed-cluster').getByRole('button', { name: '削除' }).click();
  await expect(page.getByText('「e2e-doomed-cluster」を削除しますか？')).toBeVisible();
  await shot(page, RESOURCE, '12-delete-cluster-confirm.png');
  await page.getByRole('button', { name: '削除する' }).click();
  await expect(row(page, 'e2e-doomed-cluster')).toHaveCount(0, { timeout: 10_000 });
});
