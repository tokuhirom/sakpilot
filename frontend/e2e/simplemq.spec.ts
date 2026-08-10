import { test, expect } from '@playwright/test';

// E2Eサーバーがsakumock simplemqにシードするデータ(e2e_server.go の
// seedSimpleMQQueues を参照):
//   - e2e-queue-1:        メッセージ送受信シナリオ用
//   - e2e-doomed-queue:   削除シナリオ用
//   - e2e-editable-queue: 編集シナリオ用

const queueCard = (page: import('@playwright/test').Page, name: string) =>
  page.locator('.card', { has: page.locator('.card-title', { hasText: name }) });

test('シードされたQueueが一覧表示される', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'SimpleMQ' }).click();
  await expect(page).toHaveURL(/#\/e2e\/simplemq$/);

  await expect(queueCard(page, 'e2e-queue-1')).toBeVisible();
});

test('Queueを作成すると一覧に追加される', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'SimpleMQ' }).click();

  await page.getByRole('button', { name: '+ Queue作成' }).click();
  await page.getByPlaceholder('my-queue').fill('e2e-created-queue');
  await page.getByPlaceholder('任意', { exact: true }).fill('created by e2e');
  await page.getByRole('button', { name: '作成する' }).click();

  await expect(queueCard(page, 'e2e-created-queue')).toBeVisible();
});

test('Queue詳細で基本情報を編集できる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'SimpleMQ' }).click();
  await queueCard(page, 'e2e-editable-queue').click();
  await expect(page).toHaveURL(/#\/e2e\/simplemq\//);
  await expect(page.getByRole('heading', { name: 'Queue詳細: e2e-editable-queue' })).toBeVisible();

  await page.getByRole('button', { name: '編集' }).click();
  const descriptionInput = page.locator('.form-group', { has: page.locator('label', { hasText: '説明' }) }).locator('input');
  await descriptionInput.fill('edited by e2e');
  await page.getByRole('button', { name: '保存する' }).click();

  await expect(page.getByText('edited by e2e')).toBeVisible();
});

test('Queueを削除すると一覧から消える', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'SimpleMQ' }).click();

  const card = queueCard(page, 'e2e-doomed-queue');
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: '削除', exact: true }).click();

  await expect(page.getByText('Queue「e2e-doomed-queue」を削除しますか？')).toBeVisible();
  await page.getByRole('button', { name: '削除する' }).click();

  await expect(queueCard(page, 'e2e-doomed-queue')).toHaveCount(0, { timeout: 10_000 });
  await expect(queueCard(page, 'e2e-queue-1')).toHaveCount(1);
});

test('Queue詳細でAPIキー発行後にメッセージの送受信・削除ができる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'SimpleMQ' }).click();
  await queueCard(page, 'e2e-queue-1').click();
  await expect(page).toHaveURL(/#\/e2e\/simplemq\//);
  await expect(page.getByRole('heading', { name: 'Queue詳細: e2e-queue-1' })).toBeVisible();

  // メッセージ送受信にはAPIキーの発行が必要
  await expect(page.getByText('APIキーを発行または入力すると、メッセージの送受信ができます')).toBeVisible();
  await page.getByRole('button', { name: 'APIキーを発行(ローテーション)' }).click();
  await expect(page.getByText(/新しいAPIキーを発行しました/)).toBeVisible();

  // 送信
  await page.getByPlaceholder('メッセージ本文').fill('hello from e2e');
  await page.getByRole('button', { name: '送信する' }).click();

  // 受信
  await page.getByRole('button', { name: '受信する' }).click();
  const messageRow = page.locator('tr', { has: page.getByText('hello from e2e', { exact: true }) });
  await expect(messageRow).toBeVisible();

  // タイムアウト延長
  await messageRow.getByRole('button', { name: 'タイムアウト延長' }).click();
  await expect(messageRow).toBeVisible();

  // 削除
  await messageRow.getByRole('button', { name: '削除' }).click();
  await expect(page.getByText('hello from e2e')).toHaveCount(0);
});
