import { test, expect } from '@playwright/test';

// E2Eサーバーがシードするデータ(e2e_server.go の seedGSLBs を参照):
//   - e2e-gslb-target: 設定編集シナリオ用(振り分け先サーバー192.0.2.10を1台登録済み)
//   - e2e-doomed-gslb: 削除シナリオ用
// モックの状態はテスト間で共有されるため、このファイル内のテストは記述順に依存する。

const gslbRow = (page: import('@playwright/test').Page, name: string) =>
  page.locator('tr', { hasText: name });

test('シードされたGSLBが一覧表示される', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'GSLB' }).click();
  await expect(page).toHaveURL(/#\/e2e\/gslb$/);

  await expect(gslbRow(page, 'e2e-gslb-target')).toBeVisible();
  await expect(gslbRow(page, 'e2e-doomed-gslb')).toBeVisible();
});

test('GSLBを新規作成すると一覧に表示される', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'GSLB' }).click();

  await page.getByRole('button', { name: '+ GSLB作成' }).click();
  await page.getByPlaceholder('my-gslb').fill('e2e-created-gslb');
  await page.getByRole('button', { name: '作成する' }).click();

  await expect(gslbRow(page, 'e2e-created-gslb')).toBeVisible();
});

test('GSLB詳細で監視設定とサーバーを編集できる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'GSLB' }).click();
  await gslbRow(page, 'e2e-gslb-target').click();
  await expect(page).toHaveURL(/#\/e2e\/gslb\//);
  await expect(page.getByRole('heading', { name: /^GSLB詳細: / })).toBeVisible();

  await page.getByRole('button', { name: '監視設定を編集' }).click();
  await page.locator('.form-group', { hasText: '監視間隔(秒)' }).locator('input').fill('30');
  await page.getByRole('button', { name: '+ サーバー追加' }).click();
  await page.getByPlaceholder('IPアドレス').last().fill('192.0.2.20');
  await page.getByRole('button', { name: '保存する' }).click();

  await expect(page.getByText('30秒')).toBeVisible();
  await expect(page.getByText('192.0.2.20')).toBeVisible();
});

test('GSLB詳細で名前・説明を編集できる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'GSLB' }).click();
  await gslbRow(page, 'e2e-gslb-target').click();
  await expect(page).toHaveURL(/#\/e2e\/gslb\//);
  await expect(page.getByRole('heading', { name: /^GSLB詳細: / })).toBeVisible();

  await page.getByRole('button', { name: '編集', exact: true }).click();
  await page.getByPlaceholder('説明').fill('E2Eで編集した説明');
  await page.getByRole('button', { name: '保存', exact: true }).click();

  await expect(page.getByText('e2e-gslb-target / E2Eで編集した説明')).toBeVisible();
});

test('GSLBを削除すると一覧から消える', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'GSLB' }).click();

  await gslbRow(page, 'e2e-doomed-gslb').getByRole('button', { name: '削除' }).click();

  await expect(page.getByText('GSLB「e2e-doomed-gslb」を削除しますか？')).toBeVisible();
  await page.getByRole('button', { name: '削除する' }).click();

  await expect(gslbRow(page, 'e2e-doomed-gslb')).toHaveCount(0, { timeout: 10_000 });
  await expect(gslbRow(page, 'e2e-gslb-target')).toBeVisible();
});
