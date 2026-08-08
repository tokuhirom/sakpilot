import { test, expect } from '@playwright/test';

// E2Eサーバーがシードするデータ(e2e_server.go の seedPacketFilters を参照):
//   - e2e-web-filter:    TCP/80/allow のルールを1件持つ(ルール操作シナリオ用)
//   - e2e-doomed-filter: ルールなし(削除シナリオ用)
// モックの状態はテスト間で共有されるため、このファイル内のテストは記述順に依存する。

const pfRow = (page: import('@playwright/test').Page, name: string) =>
  page.locator('tr', { hasText: name });

test('シードされたパケットフィルターが一覧表示される', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'パケットフィルター' }).click();
  await expect(page).toHaveURL(/#\/e2e\/packetfilters$/);

  await expect(pfRow(page, 'e2e-web-filter')).toBeVisible();
  await expect(pfRow(page, 'e2e-doomed-filter')).toBeVisible();
});

test('パケットフィルターを新規作成すると一覧に表示される', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'パケットフィルター' }).click();

  await page.getByRole('button', { name: '+ 作成' }).click();
  await page.getByPlaceholder('my-filter').fill('e2e-created-filter');
  await page.getByPlaceholder('任意').fill('E2Eで作成');
  await page.getByRole('button', { name: '作成する' }).click();

  await expect(pfRow(page, 'e2e-created-filter')).toBeVisible();
});

test('パケットフィルター詳細でルールを追加・編集・削除できる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'パケットフィルター' }).click();
  await pfRow(page, 'e2e-web-filter').click();
  await expect(page).toHaveURL(/#\/e2e\/packetfilters\//);

  // シードされたルールが表示される
  await expect(page.getByRole('cell', { name: '80', exact: true })).toBeVisible();

  // ルール追加
  await page.getByRole('button', { name: '+ ルール追加' }).click();
  await page.getByPlaceholder('80 (空欄で全て)').fill('443');
  await page.getByRole('button', { name: '保存する' }).click();
  await expect(page.getByRole('cell', { name: '443', exact: true })).toBeVisible();

  // ルール編集
  const rule443Row = page.locator('tr', { has: page.getByRole('cell', { name: '443', exact: true }) });
  await rule443Row.getByRole('button', { name: '編集' }).click();
  await page.getByPlaceholder('80 (空欄で全て)').fill('8443');
  await page.getByRole('button', { name: '保存する' }).click();
  await expect(page.getByRole('cell', { name: '8443', exact: true })).toBeVisible();

  // ルール削除
  const rule8443Row = page.locator('tr', { has: page.getByRole('cell', { name: '8443', exact: true }) });
  await rule8443Row.getByRole('button', { name: '削除' }).click();
  await expect(page.getByText(/を削除しますか？/)).toBeVisible();
  await page.getByRole('button', { name: '削除する' }).click();
  await expect(page.getByRole('cell', { name: '8443', exact: true })).toHaveCount(0, { timeout: 10_000 });
});

test('パケットフィルターを削除すると一覧から消える', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'パケットフィルター' }).click();

  await pfRow(page, 'e2e-doomed-filter').getByRole('button', { name: '削除' }).click();

  await expect(page.getByText('パケットフィルター「e2e-doomed-filter」を削除しますか？')).toBeVisible();
  await page.getByRole('button', { name: '削除する' }).click();

  await expect(pfRow(page, 'e2e-doomed-filter')).toHaveCount(0, { timeout: 10_000 });
  await expect(pfRow(page, 'e2e-web-filter')).toBeVisible();
});
