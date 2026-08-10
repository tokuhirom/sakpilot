import { test, expect } from '@playwright/test';

// E2Eサーバーがsakumock IAMにシードするデータ(e2e_server.go の seedIAM を参照):
//   - e2e-user-1:  ユーザー表示確認用
//   - e2e-group-1: グループ表示確認用
// IAMロール/IDロールはsakumock側の固定定義(owner/editor/viewer/...、admin/member)を利用する。

test('ユーザー一覧が表示される', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'IAM', exact: true }).click();
  await expect(page).toHaveURL(/#\/e2e\/iam$/);

  await expect(page.getByRole('cell', { name: 'e2e-user-1', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'e2euser001' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'e2e-user-1@example.com' })).toBeVisible();
});

test('グループタブに切り替えると一覧表示される', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'IAM', exact: true }).click();

  await page.getByRole('button', { name: 'グループ' }).click();
  await expect(page.getByRole('cell', { name: 'e2e-group-1' })).toBeVisible();
});

test('IAMロールタブに切り替えると固定ロール一覧が表示される', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'IAM', exact: true }).click();

  await page.getByRole('button', { name: 'IAMロール' }).click();
  await expect(page.getByRole('cell', { name: 'オーナー' })).toBeVisible();
  await expect(page.getByRole('cell', { name: '編集者' })).toBeVisible();
});

test('IDロールタブに切り替えると固定ロール一覧が表示される', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'IAM', exact: true }).click();

  await page.getByRole('button', { name: 'IDロール' }).click();
  await expect(page.getByRole('cell', { name: '管理者' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'メンバー' })).toBeVisible();
});
