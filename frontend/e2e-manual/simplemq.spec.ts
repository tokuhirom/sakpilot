import { test, expect } from '@playwright/test';
import { shot } from './helpers';

// docs/manual/simplemq.md 用のスクリーンショットを撮影する。
// 通常のE2E回帰テスト(frontend/e2e/simplemq.spec.ts)と同じ
// シードデータ(e2e_server.go の seedSimpleMQQueues)・操作パターンを流用しているが、
// このファイルはCI(npm run test:e2e)には含まれず、`npm run docs:screenshots`
// (playwright.manual.config.ts、testDir: ./e2e-manual)からのみ実行される。
//
// シードデータ:
//   - e2e-queue-1:        メッセージ送受信シナリオ用
//   - e2e-doomed-queue:   削除シナリオ用
//   - e2e-editable-queue: 編集シナリオ用
//
// 1つのtest内で連番のスクリーンショットを撮ることで、番号どおりの操作順序を保証する。

const RESOURCE = 'simplemq';

const queueCard = (page: import('@playwright/test').Page, name: string) =>
  page.locator('.card', { has: page.locator('.card-title', { hasText: name }) });

test('SimpleMQマニュアル用スクリーンショット', async ({ page }) => {
  // 01: 一覧画面
  await page.goto('/');
  await page.getByRole('link', { name: 'SimpleMQ' }).click();
  await expect(page).toHaveURL(/#\/e2e\/simplemq$/);
  await expect(queueCard(page, 'e2e-queue-1')).toBeVisible();
  await shot(page, RESOURCE, '01-list.png');

  // 02: 作成モーダル(入力途中の状態)
  await page.getByRole('button', { name: '+ Queue作成' }).click();
  await page.getByPlaceholder('my-queue').fill('e2e-manual-queue');
  await page.getByPlaceholder('任意', { exact: true }).fill('マニュアル撮影用');
  await shot(page, RESOURCE, '02-create-modal.png');
  await page.getByRole('button', { name: 'キャンセル' }).click();

  // 03: 詳細画面(基本情報)
  await queueCard(page, 'e2e-queue-1').click();
  await expect(page).toHaveURL(/#\/e2e\/simplemq\//);
  await expect(page.getByRole('heading', { name: 'Queue詳細: e2e-queue-1' })).toBeVisible();
  await shot(page, RESOURCE, '03-detail.png');

  // 04: APIキー発行後
  await page.getByRole('button', { name: 'APIキーを発行(ローテーション)' }).click();
  await expect(page.getByText(/新しいAPIキーを発行しました/)).toBeVisible();
  await shot(page, RESOURCE, '04-apikey-rotated.png');

  // 05: メッセージ送信・受信
  await page.getByPlaceholder('メッセージ本文').fill('マニュアル用メッセージ');
  await page.getByRole('button', { name: '送信する' }).click();
  await page.getByRole('button', { name: '受信する' }).click();
  const messageRow = page.locator('tr', { has: page.getByText('マニュアル用メッセージ', { exact: true }) });
  await expect(messageRow).toBeVisible();
  await shot(page, RESOURCE, '05-message-received.png');
  await messageRow.getByRole('button', { name: '削除' }).click();
  await expect(page.getByText('マニュアル用メッセージ')).toHaveCount(0);

  // 06: 一覧に戻り、e2e-editable-queueで基本情報編集フォーム(入力途中)
  await page.getByRole('link', { name: 'SimpleMQ' }).click();
  await expect(page).toHaveURL(/#\/e2e\/simplemq$/);
  await queueCard(page, 'e2e-editable-queue').click();
  await expect(page.getByRole('heading', { name: 'Queue詳細: e2e-editable-queue' })).toBeVisible();
  await page.getByRole('button', { name: '編集' }).click();
  const descInput = page.locator('.form-group', { has: page.locator('label', { hasText: '説明' }) }).locator('input');
  await descInput.fill('E2Eで編集した説明');
  await shot(page, RESOURCE, '06-edit-basic.png');
  await page.getByRole('button', { name: '保存する' }).click();
  await expect(page.getByText('E2Eで編集した説明')).toBeVisible();

  // 07: 一覧に戻り、Queue削除確認ダイアログ
  await page.getByRole('link', { name: 'SimpleMQ' }).click();
  await expect(page).toHaveURL(/#\/e2e\/simplemq$/);
  const doomedCard = queueCard(page, 'e2e-doomed-queue');
  await doomedCard.getByRole('button', { name: '削除', exact: true }).click();
  await expect(page.getByText('Queue「e2e-doomed-queue」を削除しますか？')).toBeVisible();
  await shot(page, RESOURCE, '07-delete-confirm.png');
  await page.getByRole('button', { name: '削除する' }).click();
  await expect(doomedCard).toHaveCount(0, { timeout: 10_000 });
});
