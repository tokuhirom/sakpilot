import { test, expect } from '@playwright/test';
import { shot } from './helpers';

// docs/manual/database.md 用のスクリーンショットを撮影する。
// 通常のE2E回帰テスト(frontend/e2e/database.spec.ts)と同じ
// シードデータ(e2e_server.go の seedDatabases)・操作パターンを流用しているが、
// このファイルはCI(npm run test:e2e)には含まれず、`npm run docs:screenshots`
// (playwright.manual.config.ts、testDir: ./e2e-manual)からのみ実行される。
//
// シードデータ:
//   - e2e-db-1:      status=up   (電源操作・詳細編集シナリオ用)
//   - e2e-doomed-db: status=down (削除シナリオ用)
//
// 1つのtest内で連番のスクリーンショットを撮ることで、番号どおりの操作順序を保証する。

const RESOURCE = 'database';

const dbCard = (page: import('@playwright/test').Page, name: string) =>
  page.locator('.card', { has: page.locator('.card-title', { hasText: name }) });

test('データベースマニュアル用スクリーンショット', async ({ page }) => {
  // 01: 一覧画面
  await page.goto('/');
  await page.getByRole('link', { name: 'データベース' }).click();
  await expect(page).toHaveURL(/#\/e2e\/databases$/);
  await expect(dbCard(page, 'e2e-db-1').locator('.status')).toHaveText('up');
  await shot(page, RESOURCE, '01-list.png');

  // 02: 操作メニュー(⋮)を開いた状態
  const dbCard1 = dbCard(page, 'e2e-db-1');
  await dbCard1.getByRole('button', { name: '⋮' }).click();
  await shot(page, RESOURCE, '02-actions-menu.png');

  // 03: 停止確認ダイアログ
  await dbCard1.getByRole('button', { name: '停止', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'データベース停止' })).toBeVisible();
  await shot(page, RESOURCE, '03-stop-confirm.png');
  await page.getByRole('button', { name: '停止する' }).click();
  await expect(dbCard1.locator('.status')).toHaveText('down', { timeout: 15_000 });

  // 04: 作成モーダル(入力途中の状態、名前・接続先スイッチ・IPアドレスまで入力)
  await page.getByRole('button', { name: '+ データベース作成' }).click();
  await page.getByPlaceholder('my-database').fill('e2e-manual-db');
  await page.getByLabel('接続先スイッチ').selectOption({ label: 'e2e-switch' });
  await page.getByPlaceholder('192.168.0.11').fill('192.168.0.31');
  await shot(page, RESOURCE, '04-create-modal.png');
  await page.getByRole('button', { name: 'キャンセル' }).click();

  // 05: 詳細画面
  await dbCard1.click();
  await expect(page).toHaveURL(/#\/e2e\/databases\//);
  await expect(page.getByRole('heading', { name: /^データベース詳細: / })).toBeVisible();
  await shot(page, RESOURCE, '05-detail.png');

  // 06: 基本情報の編集フォーム(入力途中)
  await page.getByRole('button', { name: '編集' }).first().click();
  await page.getByRole('textbox').nth(1).fill('E2Eで編集した説明');
  await shot(page, RESOURCE, '06-edit-basic.png');
  await page.getByRole('button', { name: '保存する' }).click();
  await expect(page.getByText('E2Eで編集した説明')).toBeVisible();

  // 07: 稼働設定の編集フォーム(入力途中)
  await page.getByRole('button', { name: '編集' }).nth(1).click();
  await page.getByLabel('管理ユーザー名').fill('e2e-admin');
  await page.getByLabel('ポート番号').fill('3307');
  await shot(page, RESOURCE, '07-edit-settings.png');
  await page.getByRole('button', { name: '保存する' }).click();
  await expect(page.getByText('e2e-admin')).toBeVisible();

  // 08: DBパラメータの設定フォーム(入力途中)
  const paramCard = page.locator('.card', { has: page.getByRole('heading', { name: 'DBパラメータ' }) });
  await paramCard.getByRole('combobox').selectOption({ index: 1 });
  await page.getByPlaceholder('値').fill('50');
  await shot(page, RESOURCE, '08-edit-param.png');
  await page.getByRole('button', { name: '設定' }).click();
  await expect(page.getByRole('button', { name: 'リセット' })).toBeVisible({ timeout: 10_000 });

  // 09: 一覧に戻り、削除確認ダイアログ
  await page.getByRole('link', { name: 'データベース' }).click();
  await expect(page).toHaveURL(/#\/e2e\/databases$/);
  const doomedCard = dbCard(page, 'e2e-doomed-db');
  await doomedCard.getByRole('button', { name: '⋮' }).click();
  await doomedCard.getByRole('button', { name: '削除', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'データベース削除' })).toBeVisible();
  await shot(page, RESOURCE, '09-delete-confirm.png');
  await page.getByRole('button', { name: '削除する' }).click();
  await expect(doomedCard).toHaveCount(0, { timeout: 10_000 });
});
