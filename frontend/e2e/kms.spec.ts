import { test, expect } from '@playwright/test';

// E2Eサーバーがsakumock KMSにシードするデータ(e2e_server.go の seedKMSKeys を参照):
//   - e2e-key-1:      表示確認用
//   - e2e-doomed-key: 削除シナリオ用

const keyCard = (page: import('@playwright/test').Page, name: string) =>
  page.locator('.card', { has: page.locator('.card-title', { hasText: name }) });

test('シードされたKMSキーが一覧表示される', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'KMS' }).click();
  await expect(page).toHaveURL(/#\/e2e\/kms$/);

  await expect(keyCard(page, 'e2e-key-1')).toBeVisible();
  const card = keyCard(page, 'e2e-key-1');
  await expect(card.getByText('アクティブ')).toBeVisible();
  await expect(card.getByText('キー起源: generated')).toBeVisible();
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
