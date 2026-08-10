import { test, expect } from '@playwright/test';

// E2Eサーバーがsakumock eventbusにシードするデータ(e2e_server.go の
// seedEventBus を参照):
//   - e2e-eventbus-pc-1/-doomed/-editable:           実行設定(destination=simplemq)
//   - e2e-eventbus-trigger-1/-doomed/-editable:       トリガー(e2e-eventbus-pc-1宛)
//   - e2e-eventbus-schedule-1/-doomed/-editable:      スケジュール(e2e-eventbus-pc-1宛)

test('実行設定一覧が表示される', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'イベントバス' }).click();
  await expect(page).toHaveURL(/#\/e2e\/eventbus$/);

  await expect(page.getByRole('cell', { name: 'e2e-eventbus-pc-1' })).toBeVisible();
});

test('実行設定を作成すると一覧に追加される', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'イベントバス' }).click();

  await page.getByRole('button', { name: '+ 実行設定作成' }).click();
  await page.getByPlaceholder('my-process-configuration').fill('e2e-created-pc');
  await page.getByPlaceholder('SimpleMQのキュー名').fill('e2e-created-queue');
  await page.getByPlaceholder('送信するメッセージ本文').fill('hello');
  await page.getByRole('button', { name: '作成する' }).click();

  await expect(page.getByRole('cell', { name: 'e2e-created-pc' })).toBeVisible();
});

test('実行設定を編集できる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'イベントバス' }).click();

  const row = page.locator('tr', { has: page.getByRole('cell', { name: 'e2e-eventbus-pc-editable' }) });
  await row.getByRole('button', { name: '編集' }).click();

  const nameInput = page.locator('.form-group', { has: page.locator('label', { hasText: '名前' }) }).locator('input');
  await nameInput.fill('e2e-eventbus-pc-editable-renamed');
  await page.getByRole('button', { name: '更新する' }).click();

  await expect(page.getByRole('cell', { name: 'e2e-eventbus-pc-editable-renamed' })).toBeVisible();
});

test('実行設定にSimpleMQシークレットを設定できる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'イベントバス' }).click();

  const row = page.locator('tr', { has: page.getByRole('cell', { name: 'e2e-eventbus-pc-1' }) });
  await row.getByRole('button', { name: 'シークレット設定' }).click();
  await page.getByPlaceholder('SimpleMQのAPIキー').fill('e2e-test-api-key');
  await page.getByRole('button', { name: '設定する' }).click();

  await expect(page.getByText('設定しました')).toBeVisible();
});

test('実行設定を削除すると一覧から消える', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'イベントバス' }).click();

  const row = page.locator('tr', { has: page.getByRole('cell', { name: 'e2e-eventbus-pc-doomed' }) });
  await row.getByRole('button', { name: '削除' }).click();

  await expect(page.getByText('「e2e-eventbus-pc-doomed」を削除しますか？')).toBeVisible();
  await page.getByRole('button', { name: '削除する' }).click();

  await expect(page.getByRole('cell', { name: 'e2e-eventbus-pc-doomed' })).toHaveCount(0, { timeout: 10_000 });
});

test('トリガータブに切り替えると一覧表示される', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'イベントバス' }).click();

  await page.getByRole('button', { name: 'トリガー' }).click();
  await expect(page.getByRole('cell', { name: 'e2e-eventbus-trigger-1' })).toBeVisible();
});

test('トリガーを作成すると一覧に追加される', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'イベントバス' }).click();
  await page.getByRole('button', { name: 'トリガー' }).click();

  await page.getByRole('button', { name: '+ トリガー作成' }).click();
  await page.getByPlaceholder('my-trigger').fill('e2e-created-trigger');
  await page.getByPlaceholder('sakuracloud').fill('sakuracloud');
  await page.locator('.form-group', { has: page.locator('label', { hasText: '実行設定' }) })
    .locator('select').selectOption({ label: 'e2e-eventbus-pc-1' });
  await page.getByRole('button', { name: '作成する' }).click();

  await expect(page.getByRole('cell', { name: 'e2e-created-trigger' })).toBeVisible();
});

test('トリガーを削除すると一覧から消える', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'イベントバス' }).click();
  await page.getByRole('button', { name: 'トリガー' }).click();

  const row = page.locator('tr', { has: page.getByRole('cell', { name: 'e2e-eventbus-trigger-doomed' }) });
  await row.getByRole('button', { name: '削除' }).click();
  await page.getByRole('button', { name: '削除する' }).click();

  await expect(page.getByRole('cell', { name: 'e2e-eventbus-trigger-doomed' })).toHaveCount(0, { timeout: 10_000 });
});

test('スケジュールタブに切り替えると一覧表示される', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'イベントバス' }).click();

  await page.getByRole('button', { name: 'スケジュール' }).click();
  await expect(page.getByRole('cell', { name: 'e2e-eventbus-schedule-1' })).toBeVisible();
});

test('スケジュールを作成すると一覧に追加される', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'イベントバス' }).click();
  await page.getByRole('button', { name: 'スケジュール' }).click();

  await page.getByRole('button', { name: '+ スケジュール作成' }).click();
  await page.getByPlaceholder('my-schedule').fill('e2e-created-schedule');
  await page.locator('input[type="datetime-local"]').fill('2030-01-01T00:00');
  await page.getByRole('button', { name: '作成する' }).click();

  await expect(page.getByRole('cell', { name: 'e2e-created-schedule' })).toBeVisible();
});

test('スケジュールを削除すると一覧から消える', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'イベントバス' }).click();
  await page.getByRole('button', { name: 'スケジュール' }).click();

  const row = page.locator('tr', { has: page.getByRole('cell', { name: 'e2e-eventbus-schedule-doomed' }) });
  await row.getByRole('button', { name: '削除' }).click();
  await page.getByRole('button', { name: '削除する' }).click();

  await expect(page.getByRole('cell', { name: 'e2e-eventbus-schedule-doomed' })).toHaveCount(0, { timeout: 10_000 });
});
