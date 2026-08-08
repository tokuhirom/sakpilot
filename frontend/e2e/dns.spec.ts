import { test, expect } from '@playwright/test';

// E2Eサーバーがシードするデータ(e2e_server.go の seedDNS を参照):
//   - e2e-example.com: wwwレコード(A)を1件持つ(レコード操作シナリオ用)
//   - e2e-doomed.com:  レコードなし(削除シナリオ用)
// DNSではゾーン名(Name)とゾーン(Zone)列に同じ文字列が表示されるため、
// テキスト一致ではなく行(tr)単位でロケーターを組み立てる。
// モックの状態はテスト間で共有されるため、このファイル内のテストは記述順に依存する。

const dnsRow = (page: import('@playwright/test').Page, name: string) =>
  page.locator('tr', { hasText: name });

test('シードされたDNSゾーンが一覧表示される', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'DNS' }).click();
  await expect(page).toHaveURL(/#\/e2e\/dns$/);

  await expect(dnsRow(page, 'e2e-example.com')).toBeVisible();
  await expect(dnsRow(page, 'e2e-doomed.com')).toBeVisible();
});

test('DNSゾーンを新規作成すると一覧に表示される', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'DNS' }).click();

  await page.getByRole('button', { name: '+ ゾーン作成' }).click();
  await page.getByPlaceholder('example.com').fill('e2e-created.com');
  await page.getByPlaceholder('任意').fill('E2Eで作成');
  await page.getByRole('button', { name: '作成する' }).click();

  await expect(dnsRow(page, 'e2e-created.com')).toBeVisible();
});

test('DNSゾーン詳細でレコードを追加・編集・削除できる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'DNS' }).click();
  await dnsRow(page, 'e2e-example.com').click();
  await expect(page).toHaveURL(/#\/e2e\/dns\//);

  // シードされたレコードが表示される
  await expect(page.getByRole('cell', { name: 'www', exact: true })).toBeVisible();

  // レコード追加
  await page.getByRole('button', { name: '+ レコード追加' }).click();
  await page.getByPlaceholder('www (@はゾーン自身)').fill('api');
  await page.getByPlaceholder('192.0.2.1').fill('192.0.2.20');
  await page.getByRole('button', { name: '保存する' }).click();
  await expect(page.getByRole('cell', { name: 'api', exact: true })).toBeVisible();

  // レコード編集
  const apiRow = page.locator('tr', { has: page.getByRole('cell', { name: 'api', exact: true }) });
  await apiRow.getByRole('button', { name: '編集' }).click();
  await page.getByPlaceholder('192.0.2.1').fill('192.0.2.99');
  await page.getByRole('button', { name: '保存する' }).click();
  await expect(page.getByRole('cell', { name: '192.0.2.99', exact: true })).toBeVisible();

  // レコード削除
  await apiRow.getByRole('button', { name: '削除' }).click();
  await expect(page.getByText('レコード「api」(A)を削除しますか？')).toBeVisible();
  await page.getByRole('button', { name: '削除する' }).click();
  await expect(page.getByRole('cell', { name: 'api', exact: true })).toHaveCount(0, { timeout: 10_000 });
});

test('DNSゾーン詳細で説明を編集できる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'DNS' }).click();
  await dnsRow(page, 'e2e-example.com').click();
  await expect(page).toHaveURL(/#\/e2e\/dns\//);

  const descriptionRow = page.locator('tr', { hasText: '説明' });
  await descriptionRow.getByRole('button', { name: '編集', exact: true }).click();
  await descriptionRow.locator('input').fill('E2Eで編集した説明');
  await descriptionRow.getByRole('button', { name: '保存', exact: true }).click();

  await expect(page.getByText('E2Eで編集した説明')).toBeVisible();
});

test('DNSゾーンを削除すると一覧から消える', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'DNS' }).click();

  await dnsRow(page, 'e2e-doomed.com').getByRole('button', { name: '削除' }).click();

  await expect(page.getByText('DNSゾーン「e2e-doomed.com」を削除しますか？')).toBeVisible();
  await page.getByRole('button', { name: '削除する' }).click();

  await expect(dnsRow(page, 'e2e-doomed.com')).toHaveCount(0, { timeout: 10_000 });
  await expect(dnsRow(page, 'e2e-example.com')).toBeVisible();
});
