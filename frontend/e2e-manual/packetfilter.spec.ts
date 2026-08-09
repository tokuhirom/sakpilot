import { test, expect } from '@playwright/test';
import { shot } from './helpers';

// docs/manual/packetfilter.md 用のスクリーンショットを撮影する。
// 通常のE2E回帰テスト(frontend/e2e/packetfilter.spec.ts)と同じ
// シードデータ(e2e_server.go の seedPacketFilters)・操作パターンを流用しているが、
// このファイルはCI(npm run test:e2e)には含まれず、`npm run docs:screenshots`
// (playwright.manual.config.ts、testDir: ./e2e-manual)からのみ実行される。
//
// シードデータ:
//   - e2e-web-filter:    TCP/80/allowのルールを1件持つ(ルール操作シナリオ用)
//   - e2e-doomed-filter: ルールなし(削除シナリオ用)
//
// 1つのtest内で連番のスクリーンショットを撮ることで、番号どおりの操作順序を保証する。

const RESOURCE = 'packetfilter';

const pfRow = (page: import('@playwright/test').Page, name: string) =>
  page.locator('tr', { hasText: name });

test('パケットフィルターマニュアル用スクリーンショット', async ({ page }) => {
  // 01: 一覧画面
  await page.goto('/');
  await page.getByRole('link', { name: 'パケットフィルター' }).click();
  await expect(page).toHaveURL(/#\/e2e\/packetfilters$/);
  await expect(pfRow(page, 'e2e-web-filter')).toBeVisible();
  await expect(pfRow(page, 'e2e-doomed-filter')).toBeVisible();
  await shot(page, RESOURCE, '01-list.png');

  // 02: 作成モーダル(入力途中)
  await page.getByRole('button', { name: '+ 作成' }).click();
  await page.getByPlaceholder('my-filter').fill('e2e-manual-filter');
  await page.getByPlaceholder('任意').fill('マニュアル用に作成');
  await shot(page, RESOURCE, '02-create-form.png');
  await page.getByRole('button', { name: '作成する' }).click();
  await expect(pfRow(page, 'e2e-manual-filter')).toBeVisible();

  // 03: 詳細画面(シードされたルールを確認)
  await pfRow(page, 'e2e-web-filter').click();
  await expect(page).toHaveURL(/#\/e2e\/packetfilters\//);
  await expect(page.getByRole('heading', { name: /^パケットフィルター詳細: / })).toBeVisible();
  await expect(page.getByRole('cell', { name: '80', exact: true })).toBeVisible();
  await shot(page, RESOURCE, '03-detail.png');

  // 04: 基本情報の編集フォーム(入力途中)
  const basicInfoCard = page.locator('.card', { hasText: '基本情報' });
  await basicInfoCard.getByRole('button', { name: '編集' }).click();
  await page.getByPlaceholder('説明').fill('HTTP/HTTPS向けフィルター');
  await shot(page, RESOURCE, '04-edit-basic-form.png');
  await basicInfoCard.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByText('HTTP/HTTPS向けフィルター')).toBeVisible();

  // 05: ルール追加フォーム(入力途中)
  await page.getByRole('button', { name: '+ ルール追加' }).click();
  await page.getByPlaceholder('80 (空欄で全て)').fill('443');
  await shot(page, RESOURCE, '05-add-rule-form.png');
  await page.getByRole('button', { name: '保存する' }).click();
  await expect(page.getByRole('cell', { name: '443', exact: true })).toBeVisible();

  // 06: ルール削除確認ダイアログ
  const rule443Row = page.locator('tr', { has: page.getByRole('cell', { name: '443', exact: true }) });
  await rule443Row.getByRole('button', { name: '削除' }).click();
  await expect(page.getByText(/を削除しますか？/)).toBeVisible();
  await shot(page, RESOURCE, '06-delete-rule-confirm.png');
  await page.getByRole('button', { name: '削除する' }).click();
  await expect(page.getByRole('cell', { name: '443', exact: true })).toHaveCount(0, { timeout: 10_000 });

  // 07: 一覧に戻り、パケットフィルター自体の削除確認ダイアログ
  await page.getByRole('link', { name: 'パケットフィルター' }).click();
  await expect(page).toHaveURL(/#\/e2e\/packetfilters$/);
  await pfRow(page, 'e2e-doomed-filter').getByRole('button', { name: '削除' }).click();
  await expect(page.getByText('パケットフィルター「e2e-doomed-filter」を削除しますか？')).toBeVisible();
  await shot(page, RESOURCE, '07-delete-confirm.png');
  await page.getByRole('button', { name: '削除する' }).click();
  await expect(pfRow(page, 'e2e-doomed-filter')).toHaveCount(0, { timeout: 10_000 });
});
