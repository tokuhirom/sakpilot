import { test, expect } from '@playwright/test';
import { shot } from './helpers';

// docs/manual/kms.md 用のスクリーンショットを撮影する。
// 通常のE2E回帰テスト(frontend/e2e/kms.spec.ts)と同じ
// シードデータ(e2e_server.go の seedKMSKeys)・操作パターンを流用しているが、
// このファイルはCI(npm run test:e2e)には含まれず、`npm run docs:screenshots`
// (playwright.manual.config.ts、testDir: ./e2e-manual)からのみ実行される。
//
// シードデータ:
//   - e2e-key-1:        表示確認・ローテーション/ステータス変更シナリオ用
//   - e2e-doomed-key:   削除シナリオ用
//   - e2e-editable-key: 編集シナリオ用
//
// 1つのtest内で連番のスクリーンショットを撮ることで、番号どおりの操作順序を保証する。

const RESOURCE = 'kms';

const keyCard = (page: import('@playwright/test').Page, name: string) =>
  page.locator('.card', { has: page.locator('.card-title', { hasText: name }) });

test('KMSマニュアル用スクリーンショット', async ({ page }) => {
  // 01: 一覧画面
  await page.goto('/');
  await page.getByRole('link', { name: 'KMS' }).click();
  await expect(page).toHaveURL(/#\/e2e\/kms$/);
  await expect(keyCard(page, 'e2e-key-1')).toBeVisible();
  await shot(page, RESOURCE, '01-list.png');

  // 02: 作成モーダル(入力途中の状態)
  await page.getByRole('button', { name: '+ キー作成' }).click();
  await page.getByPlaceholder('my-key').fill('e2e-manual-key');
  await page.getByPlaceholder('任意', { exact: true }).fill('マニュアル撮影用');
  await shot(page, RESOURCE, '02-create-modal.png');
  await page.getByRole('button', { name: 'キャンセル' }).click();

  // 03: 詳細画面
  await keyCard(page, 'e2e-editable-key').click();
  await expect(page).toHaveURL(/#\/e2e\/kms\//);
  await expect(page.getByRole('heading', { name: 'KMSキー詳細: e2e-editable-key' })).toBeVisible();
  await shot(page, RESOURCE, '03-detail.png');

  // 04: 基本情報編集フォーム(入力途中)
  await page.getByRole('button', { name: '編集' }).click();
  const descInput = page.locator('.form-group', { has: page.locator('label', { hasText: '説明' }) }).locator('input');
  await descInput.fill('E2Eで編集した説明');
  await shot(page, RESOURCE, '04-edit-basic.png');
  await page.getByRole('button', { name: '保存する' }).click();
  await expect(page.getByText('E2Eで編集した説明')).toBeVisible();

  // 05: 一覧に戻り、e2e-key-1でローテーション確認ダイアログ
  await page.getByRole('link', { name: 'KMS' }).click();
  await expect(page).toHaveURL(/#\/e2e\/kms$/);
  await keyCard(page, 'e2e-key-1').click();
  await expect(page.getByRole('heading', { name: 'KMSキー詳細: e2e-key-1' })).toBeVisible();
  await page.getByRole('button', { name: 'ローテーション' }).click();
  await expect(page.getByText('KMSキー「e2e-key-1」をローテーションしますか？')).toBeVisible();
  await shot(page, RESOURCE, '05-rotate-confirm.png');
  await page.getByRole('button', { name: '実行する' }).click();
  await expect(page.getByText('KMSキー「e2e-key-1」をローテーションしますか？')).toHaveCount(0);

  // 06: ステータス変更確認ダイアログ
  await page.getByRole('button', { name: '制限' }).click();
  await expect(page.getByText('のステータスを')).toBeVisible();
  await shot(page, RESOURCE, '06-status-confirm.png');
  await page.getByRole('button', { name: '実行する' }).click();
  await expect(page.getByText('制限中')).toBeVisible();

  // 07: 一覧に戻り、削除確認ダイアログ
  await page.getByRole('link', { name: 'KMS' }).click();
  await expect(page).toHaveURL(/#\/e2e\/kms$/);
  const doomedCard = keyCard(page, 'e2e-doomed-key');
  await doomedCard.getByRole('button', { name: '削除', exact: true }).click();
  await expect(page.getByText('KMSキー「e2e-doomed-key」を削除しますか？')).toBeVisible();
  await shot(page, RESOURCE, '07-delete-confirm.png');
  await page.getByRole('button', { name: '削除する' }).click();
  await expect(doomedCard).toHaveCount(0, { timeout: 10_000 });
});
