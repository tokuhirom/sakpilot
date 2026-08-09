import { test, expect } from '@playwright/test';

// E2Eサーバーがシードするデータ(e2e_server.go の seedSwitches を参照):
//   - e2e-switch:        編集シナリオ用
//   - e2e-doomed-switch: 削除シナリオ用
// モックの状態はテスト間で共有されるため、このファイル内のテストは記述順に依存する。

const switchRow = (page: import('@playwright/test').Page, name: string) =>
  page.locator('tr', { hasText: name });

test('シードされたスイッチが一覧表示される', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'スイッチ' }).click();
  await expect(page).toHaveURL(/#\/e2e\/switches$/);

  await expect(switchRow(page, 'e2e-switch')).toBeVisible();
  await expect(switchRow(page, 'e2e-doomed-switch')).toBeVisible();
});

test('スイッチを新規作成すると一覧に表示される', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'スイッチ' }).click();

  await page.getByRole('button', { name: '+ スイッチ作成' }).click();
  await page.getByPlaceholder('my-switch').fill('e2e-created-switch');
  await page.getByPlaceholder('任意', { exact: true }).fill('E2Eで作成');
  await page.getByRole('button', { name: '作成する' }).click();

  await expect(switchRow(page, 'e2e-created-switch')).toBeVisible();
});

test('スイッチ詳細で名前・説明・ネットワーク設定を編集できる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'スイッチ' }).click();
  await switchRow(page, 'e2e-switch').click();
  await expect(page).toHaveURL(/#\/e2e\/switches\//);
  await expect(page.getByRole('heading', { name: /^スイッチ詳細: / })).toBeVisible();

  await page.getByRole('button', { name: '編集' }).click();
  await page.getByPlaceholder('任意(ルータ接続する場合のみ、26-28)').fill('28');
  await page.getByPlaceholder('任意(例: 192.168.0.1)').fill('192.168.0.1');
  await page.getByRole('button', { name: '保存する' }).click();

  await expect(page.getByText('/28')).toBeVisible();
  await expect(page.getByText('192.168.0.1')).toBeVisible();
});

test('スイッチを削除すると一覧から消える', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'スイッチ' }).click();

  await switchRow(page, 'e2e-doomed-switch').getByRole('button', { name: '削除' }).click();

  await expect(page.getByText('スイッチ「e2e-doomed-switch」を削除しますか？')).toBeVisible();
  await page.getByRole('button', { name: '削除する' }).click();

  await expect(switchRow(page, 'e2e-doomed-switch')).toHaveCount(0, { timeout: 10_000 });
  await expect(switchRow(page, 'e2e-switch')).toBeVisible();
});
