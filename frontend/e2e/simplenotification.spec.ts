import { test, expect } from '@playwright/test';

// E2Eサーバーがsakumock simplenotificationにシードするデータ(e2e_server.go の
// seedSimpleNotification を参照):
//   - e2e-destination-1/-doomed/-editable: 送信先(email)
//   - e2e-group-1/-doomed/-editable:       グループ(e2e-destination-1を含む)
//   - e2e-routing-1/-doomed/-editable:     ルーティング(e2e-group-1宛)
// History/ListSources/Reorder/GetStatusはsakumock未対応のためUI/E2E対象外
// (docs/upstream-issues.md参照)。

test('送信先一覧が表示される', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: '簡易通知' }).click();
  await expect(page).toHaveURL(/#\/e2e\/simplenotification$/);

  await expect(page.getByRole('cell', { name: 'e2e-destination-1' })).toBeVisible();
});

test('送信先を作成すると一覧に追加される', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: '簡易通知' }).click();

  await page.getByRole('button', { name: '+ 送信先作成' }).click();
  await page.getByPlaceholder('my-destination').fill('e2e-created-destination');
  await page.getByPlaceholder('alert@example.com').fill('created@example.com');
  await page.getByRole('button', { name: '作成する' }).click();

  await expect(page.getByRole('cell', { name: 'e2e-created-destination' })).toBeVisible();
});

test('送信先を編集できる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: '簡易通知' }).click();

  const row = page.locator('tr', { has: page.getByRole('cell', { name: 'e2e-destination-editable' }) });
  await row.getByRole('button', { name: '編集' }).click();

  const nameInput = page.locator('.form-group', { has: page.locator('label', { hasText: '名前' }) }).locator('input');
  await nameInput.fill('e2e-destination-editable-renamed');
  await page.getByRole('button', { name: '更新する' }).click();

  await expect(page.getByRole('cell', { name: 'e2e-destination-editable-renamed' })).toBeVisible();
});

test('送信先を削除すると一覧から消える', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: '簡易通知' }).click();

  const row = page.locator('tr', { has: page.getByRole('cell', { name: 'e2e-destination-doomed' }) });
  await row.getByRole('button', { name: '削除' }).click();

  await expect(page.getByText('「e2e-destination-doomed」を削除しますか？')).toBeVisible();
  await page.getByRole('button', { name: '削除する' }).click();

  await expect(page.getByRole('cell', { name: 'e2e-destination-doomed' })).toHaveCount(0, { timeout: 10_000 });
});

test('グループタブに切り替えると一覧表示され、メッセージ送信できる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: '簡易通知' }).click();

  await page.getByRole('button', { name: 'グループ' }).click();
  await expect(page.getByRole('cell', { name: 'e2e-group-1' })).toBeVisible();

  const row = page.locator('tr', { has: page.getByRole('cell', { name: 'e2e-group-1' }) });
  await row.getByRole('button', { name: 'メッセージ送信' }).click();
  await page.getByPlaceholder('テストメッセージ').fill('hello from e2e');
  await page.getByRole('button', { name: '送信する' }).click();

  await expect(page.getByText('送信しました')).toBeVisible();
});

test('グループを削除すると一覧から消える', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: '簡易通知' }).click();
  await page.getByRole('button', { name: 'グループ' }).click();

  const row = page.locator('tr', { has: page.getByRole('cell', { name: 'e2e-group-doomed' }) });
  await row.getByRole('button', { name: '削除' }).click();
  await page.getByRole('button', { name: '削除する' }).click();

  await expect(page.getByRole('cell', { name: 'e2e-group-doomed' })).toHaveCount(0, { timeout: 10_000 });
});

test('ルーティングタブに切り替えると一覧表示される', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: '簡易通知' }).click();

  await page.getByRole('button', { name: 'ルーティング' }).click();
  await expect(page.getByRole('cell', { name: 'e2e-routing-1' })).toBeVisible();
});

test('ルーティングを作成すると一覧に追加される', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: '簡易通知' }).click();
  await page.getByRole('button', { name: 'ルーティング' }).click();

  await page.getByRole('button', { name: '+ ルーティング作成' }).click();
  await page.getByPlaceholder('my-routing').fill('e2e-created-routing');
  await page.getByPlaceholder('101122334455').fill('101122334455');
  await page.locator('.form-group', { has: page.locator('label', { hasText: '送信先グループ' }) })
    .locator('select').selectOption({ label: 'e2e-group-1' });
  await page.getByRole('button', { name: '作成する' }).click();

  await expect(page.getByRole('cell', { name: 'e2e-created-routing' })).toBeVisible();
});

test('ルーティングを削除すると一覧から消える', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: '簡易通知' }).click();
  await page.getByRole('button', { name: 'ルーティング' }).click();

  const row = page.locator('tr', { has: page.getByRole('cell', { name: 'e2e-routing-doomed' }) });
  await row.getByRole('button', { name: '削除' }).click();
  await page.getByRole('button', { name: '削除する' }).click();

  await expect(page.getByRole('cell', { name: 'e2e-routing-doomed' })).toHaveCount(0, { timeout: 10_000 });
});
