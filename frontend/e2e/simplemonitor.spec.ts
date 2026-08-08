import { test, expect } from '@playwright/test';

// E2Eサーバーがシードするデータ(e2e_server.go の seedSimpleMonitors を参照):
//   - e2e-monitor-target.example.com: 設定編集シナリオ用
//   - e2e-doomed-monitor.example.com: 削除シナリオ用
// モックの状態はテスト間で共有されるため、このファイル内のテストは記述順に依存する。

const monitorRow = (page: import('@playwright/test').Page, name: string) =>
  page.locator('tr', { hasText: name });

test('シードされたシンプル監視が一覧表示される', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'シンプル監視' }).click();
  await expect(page).toHaveURL(/#\/e2e\/monitors$/);

  await expect(monitorRow(page, 'e2e-monitor-target.example.com')).toBeVisible();
  await expect(monitorRow(page, 'e2e-doomed-monitor.example.com')).toBeVisible();
});

test('シンプル監視を新規作成すると一覧に表示される', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'シンプル監視' }).click();

  await page.getByRole('button', { name: '+ 監視作成' }).click();
  await page.getByPlaceholder('example.com').fill('e2e-created-monitor.example.com');
  await page.getByRole('button', { name: '作成する' }).click();

  await expect(monitorRow(page, 'e2e-created-monitor.example.com')).toBeVisible();
});

test('シンプル監視詳細で監視設定を編集できる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'シンプル監視' }).click();
  await monitorRow(page, 'e2e-monitor-target.example.com').click();
  await expect(page).toHaveURL(/#\/e2e\/monitors\//);

  await page.getByRole('button', { name: '監視設定を編集' }).click();
  await page.locator('.form-group', { hasText: 'チェック間隔(秒)' }).locator('input').fill('120');
  await page.getByRole('button', { name: '保存する' }).click();

  await expect(page.getByText('120秒')).toBeVisible();
});

test('シンプル監視詳細で説明を編集できる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'シンプル監視' }).click();
  await monitorRow(page, 'e2e-monitor-target.example.com').click();
  await expect(page).toHaveURL(/#\/e2e\/monitors\//);

  await page.getByRole('button', { name: '編集', exact: true }).click();
  await page.locator('tr', { hasText: '説明' }).locator('input').fill('E2Eで編集した説明');
  await page.getByRole('button', { name: '保存', exact: true }).click();

  await expect(page.getByText('E2Eで編集した説明')).toBeVisible();
});

test('シンプル監視を削除すると一覧から消える', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'シンプル監視' }).click();

  await monitorRow(page, 'e2e-doomed-monitor.example.com').getByRole('button', { name: '削除' }).click();

  await expect(page.getByText('シンプル監視「e2e-doomed-monitor.example.com」を削除しますか？')).toBeVisible();
  await page.getByRole('button', { name: '削除する' }).click();

  await expect(monitorRow(page, 'e2e-doomed-monitor.example.com')).toHaveCount(0, { timeout: 10_000 });
  await expect(monitorRow(page, 'e2e-monitor-target.example.com')).toBeVisible();
});
