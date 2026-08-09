import { test, expect } from '@playwright/test';
import { shot } from './helpers';

// docs/manual/apprun-shared.md 用のスクリーンショットを撮影する。
// 通常のE2E回帰テスト(frontend/e2e/apprun-shared.spec.ts)と同じ
// シードデータ(e2e_server.go の seedAppRunShared)・操作パターンを流用しているが、
// このファイルはCI(npm run test:e2e)には含まれず、`npm run docs:screenshots`
// (playwright.manual.config.ts、testDir: ./e2e-manual)からのみ実行される。
//
// シードデータ:
//   - e2e-shared-app: ユーザー作成済み、コンポーネント1件を保持するアプリケーション
//
// バージョン削除・トラフィック分散変更は、単一バージョンの状態では意味のある
// 操作にならない(最新かつ唯一のバージョンは削除・分散変更ができない)という
// sakumock側の制約があるため、既存の回帰E2Eと同様に撮影対象からは除外している。
//
// 1つのtest内で連番のスクリーンショットを撮ることで、番号どおりの操作順序を保証する。

const RESOURCE = 'apprun-shared';

test('AppRun共用型マニュアル用スクリーンショット', async ({ page }) => {
  // 01: 一覧画面
  await page.goto('/');
  await page.getByRole('link', { name: 'AppRun共用型' }).click();
  await expect(page).toHaveURL(/#\/e2e\/apprun-shared$/);
  await expect(page.locator('tr', { hasText: 'e2e-shared-app' })).toBeVisible();
  await shot(page, RESOURCE, '01-list.png');

  // 02: 作成モーダル(入力途中)
  await page.getByRole('button', { name: '+ アプリ作成' }).click();
  await page.getByPlaceholder('my-app').fill('e2e-manual-app');
  await page.getByPlaceholder('docker.io/library/nginx:latest').fill('docker.io/library/nginx:latest');
  await shot(page, RESOURCE, '02-create-modal.png');
  await page.getByRole('button', { name: 'キャンセル' }).click();

  // 03: 詳細画面(基本情報・コンポーネント・バージョン履歴)
  await page.getByRole('cell', { name: 'e2e-shared-app', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'e2e-shared-app' })).toBeVisible();
  await shot(page, RESOURCE, '03-detail.png');

  // 04: 基本情報編集フォーム(入力途中)
  await page.getByRole('button', { name: '編集' }).first().click();
  await page.getByLabel('最大スケール').fill('5');
  await shot(page, RESOURCE, '04-edit-basic.png');
  await page.getByRole('button', { name: '保存する' }).click();
  await expect(page.getByText('0 - 5')).toBeVisible();

  // 05: 一覧に戻り、削除確認ダイアログ(専用に作成したアプリを削除)
  await page.getByRole('button', { name: '← 戻る' }).click();
  await expect(page).toHaveURL(/#\/e2e\/apprun-shared$/);
  await page.getByRole('button', { name: '+ アプリ作成' }).click();
  await page.getByPlaceholder('my-app').fill('e2e-manual-delete-target');
  await page.getByPlaceholder('docker.io/library/nginx:latest').fill('docker.io/library/nginx:latest');
  await page.getByRole('button', { name: '作成する' }).click();
  const doomedRow = page.locator('tr', { hasText: 'e2e-manual-delete-target' });
  await expect(doomedRow).toBeVisible();
  await doomedRow.getByRole('button', { name: '削除' }).click();
  await expect(page.getByText('「e2e-manual-delete-target」を削除しますか？')).toBeVisible();
  await shot(page, RESOURCE, '05-delete-confirm.png');
  await page.getByRole('button', { name: '削除する' }).click();
  await expect(doomedRow).not.toBeVisible();
});
