import { test, expect } from '@playwright/test';
import { shot } from './helpers';

// docs/manual/iam.md 用のスクリーンショットを撮影する。
// 通常のE2E回帰テスト(frontend/e2e/iam.spec.ts)と同じ
// シードデータ(e2e_server.go の seedIAM)・操作パターンを流用しているが、
// このファイルはCI(npm run test:e2e)には含まれず、`npm run docs:screenshots`
// (playwright.manual.config.ts、testDir: ./e2e-manual)からのみ実行される。
//
// シードデータ:
//   - e2e-user-1:              ユーザータブ表示確認用
//   - e2e-group-1:             グループタブ表示確認用
//   - e2e-service-principal-1: サービスプリンシパルタブ・詳細表示確認用(登録済みキーを1件持つ)
//   - e2e-folder-1:            プロジェクト/フォルダタブ表示確認用(子にe2e-project-1を持つ)
//   - e2e-project-1:           プロジェクト/フォルダタブ表示確認用(e2e-folder-1の子)
// IAMロール/IDロールはsakumock側の固定定義(owner/editor/viewer/...、admin/member)を利用する。
// 組織(organization)はsakumock側にデフォルトで1件存在する単数リソース。
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

  // 05: サービスプリンシパルタブ
  await page.getByRole('button', { name: 'サービスプリンシパル', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'e2e-service-principal-1' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'サービスプリンシパル', exact: true })).toHaveClass(/btn-primary/);
  await page.waitForTimeout(250);
  await shot(page, RESOURCE, '05-serviceprincipals.png');

  // 06: サービスプリンシパル詳細(基本情報・キー一覧)
  await page.getByRole('cell', { name: 'e2e-service-principal-1' }).click();
  await expect(page.getByRole('heading', { name: 'サービスプリンシパル詳細: e2e-service-principal-1' })).toBeVisible();
  await expect(page.getByText('有効', { exact: true })).toBeVisible();
  await shot(page, RESOURCE, '06-serviceprincipal-detail.png');

  // 07: プロジェクト/フォルダタブ(ツリー表示)
  await page.getByRole('link', { name: 'IAM', exact: true }).click();
  await page.getByRole('button', { name: 'プロジェクト/フォルダ' }).click();
  await expect(page.locator('.iam-tree-row', { hasText: 'e2e-folder-1' })).toBeVisible();
  await expect(page.locator('.iam-tree-row', { hasText: 'e2e-project-1' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'プロジェクト/フォルダ' })).toHaveClass(/btn-primary/);
  await page.waitForTimeout(250);
  await shot(page, RESOURCE, '07-projects-folders.png');

  // 08: 組織タブ
  await page.getByRole('button', { name: '組織', exact: true }).click();
  await expect(page.getByText('組織ID')).toBeVisible();
  await expect(page.getByRole('button', { name: '組織', exact: true })).toHaveClass(/btn-primary/);
  await page.waitForTimeout(250);
  await shot(page, RESOURCE, '08-organization.png');
});
