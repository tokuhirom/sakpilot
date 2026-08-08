import { test, expect } from '@playwright/test';

// E2Eサーバーがsakumock KMSにシードするデータ(e2e_server.go の seedKMSKeys を参照):
//   - e2e-key-1:        表示確認・ローテーション/ステータス変更シナリオ用
//   - e2e-doomed-key:   削除シナリオ用
//   - e2e-editable-key: 編集シナリオ用

const keyCard = (page: import('@playwright/test').Page, name: string) =>
  page.locator('.card', { has: page.locator('.card-title', { hasText: name }) });

test('シードされたKMSキーが一覧表示される', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'KMS' }).click();
  await expect(page).toHaveURL(/#\/e2e\/kms$/);

  await expect(keyCard(page, 'e2e-key-1')).toBeVisible();
  const card = keyCard(page, 'e2e-key-1');
  await expect(card.getByText('アクティブ')).toBeVisible();
  await expect(card.getByText('キー起源: 生成')).toBeVisible();
});

test('KMSキーを作成すると一覧に追加される', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'KMS' }).click();

  await page.getByRole('button', { name: '+ キー作成' }).click();
  await page.getByPlaceholder('my-key').fill('e2e-created-key');
  await page.getByPlaceholder('任意', { exact: true }).fill('created by e2e');
  await page.getByRole('button', { name: '作成する' }).click();

  await expect(keyCard(page, 'e2e-created-key')).toBeVisible();
});

test('KMSキー詳細で基本情報を編集できる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'KMS' }).click();
  await keyCard(page, 'e2e-editable-key').click();
  await expect(page).toHaveURL(/#\/e2e\/kms\//);
  await expect(page.getByRole('heading', { name: 'KMSキー詳細: e2e-editable-key' })).toBeVisible();

  await page.getByRole('button', { name: '編集' }).click();
  const nameInput = page.locator('.form-group', { has: page.locator('label', { hasText: '名前' }) }).locator('input');
  await nameInput.fill('e2e-editable-key-renamed');
  await page.getByRole('button', { name: '保存する' }).click();

  await expect(page.getByText('KMSキー詳細: e2e-editable-key-renamed')).toBeVisible();
});

test('KMSキーを削除すると一覧から消える', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'KMS' }).click();

  const card = keyCard(page, 'e2e-doomed-key');
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: '削除', exact: true }).click();

  // 確認ダイアログ
  await expect(page.getByText('KMSキー「e2e-doomed-key」を削除しますか？')).toBeVisible();
  await page.getByRole('button', { name: '削除する' }).click();

  await expect(keyCard(page, 'e2e-doomed-key')).toHaveCount(0, { timeout: 10_000 });
  await expect(keyCard(page, 'e2e-key-1')).toHaveCount(1);
});

test('KMSキー詳細でローテーション・ステータス変更ができる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'KMS' }).click();
  await keyCard(page, 'e2e-key-1').click();
  await expect(page).toHaveURL(/#\/e2e\/kms\//);
  await expect(page.getByRole('heading', { name: 'KMSキー詳細: e2e-key-1' })).toBeVisible();
  await expect(page.getByText('アクティブ', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'ローテーション' }).click();
  await expect(page.getByText('KMSキー「e2e-key-1」をローテーションしますか？')).toBeVisible();
  await page.getByRole('button', { name: '実行する' }).click();
  await expect(page.getByText('KMSキー「e2e-key-1」をローテーションしますか？')).toHaveCount(0);

  await page.getByRole('button', { name: '制限' }).click();
  await expect(page.getByText('のステータスを')).toBeVisible();
  await page.getByRole('button', { name: '実行する' }).click();
  await expect(page.getByText('制限中')).toBeVisible();
});
