import { test, expect } from '@playwright/test';
import { shot } from './helpers';

// docs/manual/enhanceddb.md 用のスクリーンショットを撮影する。
// 通常のE2E回帰テスト(frontend/e2e/enhanceddb.spec.ts)と同じ
// シードデータ(e2e_server.go の seedEnhancedDBs)・操作パターンを流用しているが、
// このファイルはCI(npm run test:e2e)には含まれず、`npm run docs:screenshots`
// (playwright.manual.config.ts、testDir: ./e2e-manual)からのみ実行される。
//
// シードデータ:
//   - e2e-enhanceddb-1:        表示確認・パスワード再設定シナリオ用
//   - e2e-doomed-enhanceddb:   削除シナリオ用
//   - e2e-editable-enhanceddb: 編集シナリオ用
//
// 1つのtest内で連番のスクリーンショットを撮ることで、番号どおりの操作順序を保証する。

const RESOURCE = 'enhanceddb';

const dbCard = (page: import('@playwright/test').Page, name: string) =>
  page.locator('.card', { has: page.locator('.card-title', { hasText: name }) });

test('エンハンスドDBマニュアル用スクリーンショット', async ({ page }) => {
  // 01: 一覧画面
  await page.goto('/');
  await page.getByRole('link', { name: 'エンハンスドDB' }).click();
  await expect(page).toHaveURL(/#\/e2e\/enhanced-db$/);
  await expect(dbCard(page, 'e2e-enhanceddb-1')).toBeVisible();
  await shot(page, RESOURCE, '01-list.png');

  // 02: 作成モーダル(入力途中の状態、名前・DB名まで入力)
  await page.getByRole('button', { name: '+ 作成' }).click();
  await page.getByPlaceholder('my-enhanced-db').fill('e2e-manual-enhanceddb');
  await page.getByPlaceholder('mydb').fill('e2emanual');
  await shot(page, RESOURCE, '02-create-modal.png');
  await page.getByRole('button', { name: 'キャンセル' }).click();

  // 03: 詳細画面
  await dbCard(page, 'e2e-editable-enhanceddb').click();
  await expect(page).toHaveURL(/#\/e2e\/enhanced-db\//);
  await expect(page.getByRole('heading', { name: 'エンハンスドDB詳細: e2e-editable-enhanceddb' })).toBeVisible();
  await shot(page, RESOURCE, '03-detail.png');

  // 04: 基本情報の編集フォーム(入力途中)
  await page.getByRole('button', { name: '編集' }).click();
  const nameInput = page.locator('.form-group', { has: page.locator('label', { hasText: '名前' }) }).locator('input');
  await nameInput.fill('e2e-editable-enhanceddb-renamed');
  await shot(page, RESOURCE, '04-edit-basic.png');
  await page.getByRole('button', { name: '保存する' }).click();
  await expect(page.getByText('エンハンスドDB詳細: e2e-editable-enhanceddb-renamed')).toBeVisible();

  // 05: パスワード再設定確認ダイアログ
  await page.getByRole('link', { name: 'エンハンスドDB' }).click();
  await expect(page).toHaveURL(/#\/e2e\/enhanced-db$/);
  await dbCard(page, 'e2e-enhanceddb-1').click();
  await expect(page.getByRole('heading', { name: 'エンハンスドDB詳細: e2e-enhanceddb-1' })).toBeVisible();
  await page.getByPlaceholder('管理ユーザーの新しいパスワード').fill('E2eManualPassword01');
  await page.getByRole('button', { name: 'パスワードを再設定' }).click();
  await expect(page.getByText('エンハンスドDB「e2e-enhanceddb-1」のパスワードを再設定しますか？')).toBeVisible();
  await shot(page, RESOURCE, '05-password-confirm.png');
  await page.getByRole('button', { name: '実行する' }).click();
  await expect(page.getByText('エンハンスドDB「e2e-enhanceddb-1」のパスワードを再設定しますか？')).toHaveCount(0);

  // 06: 一覧に戻り、削除確認ダイアログ
  await page.getByRole('link', { name: 'エンハンスドDB' }).click();
  await expect(page).toHaveURL(/#\/e2e\/enhanced-db$/);
  const doomedCard = dbCard(page, 'e2e-doomed-enhanceddb');
  await doomedCard.getByRole('button', { name: '削除', exact: true }).click();
  await expect(page.getByText('エンハンスドDB「e2e-doomed-enhanceddb」を削除しますか？')).toBeVisible();
  await shot(page, RESOURCE, '06-delete-confirm.png');
  await page.getByRole('button', { name: '削除する' }).click();
  await expect(doomedCard).toHaveCount(0, { timeout: 10_000 });
});
