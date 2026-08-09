import { test, expect } from '@playwright/test';
import { shot } from './helpers';

// docs/manual/gslb.md 用のスクリーンショットを撮影する。
// 通常のE2E回帰テスト(frontend/e2e/gslb.spec.ts)と同じ
// シードデータ(e2e_server.go の seedGSLBs)・操作パターンを流用しているが、
// このファイルはCI(npm run test:e2e)には含まれず、`npm run docs:screenshots`
// (playwright.manual.config.ts、testDir: ./e2e-manual)からのみ実行される。
//
// シードデータ:
//   - e2e-gslb-target: 設定編集シナリオ用(振り分け先サーバー192.0.2.10を1台登録済み)
//   - e2e-doomed-gslb: 削除シナリオ用
//
// 1つのtest内で連番のスクリーンショットを撮ることで、番号どおりの操作順序を保証する。

const RESOURCE = 'gslb';

const gslbRow = (page: import('@playwright/test').Page, name: string) =>
  page.locator('tr', { hasText: name });

test('GSLBマニュアル用スクリーンショット', async ({ page }) => {
  // 01: 一覧画面
  await page.goto('/');
  await page.getByRole('link', { name: 'GSLB' }).click();
  await expect(page).toHaveURL(/#\/e2e\/gslb$/);
  await expect(gslbRow(page, 'e2e-gslb-target')).toBeVisible();
  await shot(page, RESOURCE, '01-list.png');

  // 02: 作成モーダル(入力途中の状態)
  await page.getByRole('button', { name: '+ GSLB作成' }).click();
  await page.getByPlaceholder('my-gslb').fill('e2e-manual-example');
  await shot(page, RESOURCE, '02-create-modal.png');
  await page.getByRole('button', { name: 'キャンセル' }).click();

  // 03: 詳細画面
  await gslbRow(page, 'e2e-gslb-target').click();
  await expect(page).toHaveURL(/#\/e2e\/gslb\//);
  await expect(page.getByRole('heading', { name: /^GSLB詳細: / })).toBeVisible();
  await shot(page, RESOURCE, '03-detail.png');

  // 04: 監視設定・振り分け先サーバーの編集フォーム(入力途中)
  await page.getByRole('button', { name: '監視設定を編集' }).click();
  await page.locator('.form-group', { hasText: '監視間隔(秒)' }).locator('input').fill('30');
  await page.getByRole('button', { name: '+ サーバー追加' }).click();
  await page.getByPlaceholder('IPアドレス *').last().fill('192.0.2.20');
  await page.locator('.modal-content').evaluate((el) => el.scrollTo(0, 0));
  await shot(page, RESOURCE, '04-edit-settings.png');
  await page.getByRole('button', { name: '保存する' }).click();
  await expect(page.getByText('30秒')).toBeVisible();
  await expect(page.getByText('192.0.2.20')).toBeVisible();

  // 05: 名前・説明の編集フォーム(入力途中)
  await page.getByRole('button', { name: '編集', exact: true }).click();
  await page.getByPlaceholder('説明').fill('E2Eで編集した説明');
  await shot(page, RESOURCE, '05-edit-basic.png');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByText('e2e-gslb-target / E2Eで編集した説明')).toBeVisible();

  // 06: 一覧に戻り、削除確認ダイアログ
  await page.getByRole('link', { name: 'GSLB' }).click();
  await expect(page).toHaveURL(/#\/e2e\/gslb$/);
  await gslbRow(page, 'e2e-doomed-gslb').getByRole('button', { name: '削除' }).click();
  await expect(page.getByText('GSLB「e2e-doomed-gslb」を削除しますか？')).toBeVisible();
  await shot(page, RESOURCE, '06-delete-confirm.png');
  await page.getByRole('button', { name: '削除する' }).click();
  await expect(gslbRow(page, 'e2e-doomed-gslb')).toHaveCount(0, { timeout: 10_000 });
});
