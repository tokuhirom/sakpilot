import { test, expect } from '@playwright/test';
import { shot } from './helpers';

// docs/manual/iam.md 用のスクリーンショットを撮影する。
// 通常のE2E回帰テスト(frontend/e2e/iam.spec.ts)と同じ
// シードデータ(e2e_server.go の seedIAM)・操作パターンを流用しているが、
// このファイルはCI(npm run test:e2e)には含まれず、`npm run docs:screenshots`
// (playwright.manual.config.ts、testDir: ./e2e-manual)からのみ実行される。
//
// シードデータ:
//   - e2e-user-1:  ユーザータブ表示確認用
//   - e2e-group-1: グループタブ表示確認用
// IAMロール/IDロールはsakumock側の固定定義(owner/editor/viewer/...、admin/member)を利用する。
//
// 1つのtest内で連番のスクリーンショットを撮ることで、番号どおりの操作順序を保証する。

const RESOURCE = 'iam';

test('IAMマニュアル用スクリーンショット', async ({ page }) => {
  // 01: ユーザータブ(デフォルト表示)
  await page.goto('/');
  await page.getByRole('link', { name: 'IAM', exact: true }).click();
  await expect(page).toHaveURL(/#\/e2e\/iam$/);
  await expect(page.getByRole('cell', { name: 'e2e-user-1', exact: true })).toBeVisible();
  await shot(page, RESOURCE, '01-users.png');

  // 02: グループタブ
  // タブボタンの配色は`.btn`のCSSトランジション(0.2s)で変化するため、
  // データ表示だけでなくアクティブなタブの配色が確定するのを待ってから撮影する。
  await page.getByRole('button', { name: 'グループ' }).click();
  await expect(page.getByRole('cell', { name: 'e2e-group-1' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'グループ' })).toHaveClass(/btn-primary/);
  await page.waitForTimeout(250);
  await shot(page, RESOURCE, '02-groups.png');

  // 03: IAMロールタブ
  await page.getByRole('button', { name: 'IAMロール' }).click();
  await expect(page.getByRole('cell', { name: 'オーナー' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'IAMロール' })).toHaveClass(/btn-primary/);
  await page.waitForTimeout(250);
  await shot(page, RESOURCE, '03-iam-roles.png');

  // 04: IDロールタブ
  await page.getByRole('button', { name: 'IDロール' }).click();
  await expect(page.getByRole('cell', { name: '管理者' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'IDロール' })).toHaveClass(/btn-primary/);
  await page.waitForTimeout(250);
  await shot(page, RESOURCE, '04-id-roles.png');
});
