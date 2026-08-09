import { test, expect } from '@playwright/test';
import { shot } from './helpers';

// docs/manual/disk.md 用のスクリーンショットを撮影する。
// 通常のE2E回帰テスト(frontend/e2e/disk.spec.ts)と同じ
// シードデータ(e2e_server.go の seedDisks)・操作パターンを流用しているが、
// このファイルはCI(npm run test:e2e)には含まれず、`npm run docs:screenshots`
// (playwright.manual.config.ts、testDir: ./e2e-manual)からのみ実行される。
//
// シードデータ:
//   - e2e-disk:             編集シナリオ用
//   - e2e-unconnected-disk: 接続シナリオ用
//   - e2e-connected-disk:   切断シナリオ用(e2e-web-1に接続済み)
//   - e2e-doomed-disk:      削除シナリオ用
// サーバーはseedServersが投入する e2e-web-1 を使う。
//
// 1つのtest内で連番のスクリーンショットを撮ることで、番号どおりの操作順序を保証する。

const RESOURCE = 'disk';

const diskCard = (page: import('@playwright/test').Page, name: string) =>
  page.locator('.card', { hasText: name });

test('ディスクマニュアル用スクリーンショット', async ({ page }) => {
  // 01: 一覧画面
  await page.goto('/');
  await page.getByRole('link', { name: 'ディスク' }).click();
  await expect(page).toHaveURL(/#\/e2e\/disks$/);
  await expect(diskCard(page, 'e2e-disk')).toBeVisible();
  await shot(page, RESOURCE, '01-list.png');

  // 02: 作成モーダル(入力途中の状態)
  await page.getByRole('button', { name: '+ ディスク作成' }).click();
  await page.getByPlaceholder('my-disk').fill('e2e-manual-example');
  await page.getByPlaceholder('任意', { exact: true }).fill('マニュアル撮影用の説明');
  await shot(page, RESOURCE, '02-create-modal.png');
  await page.getByRole('button', { name: 'キャンセル' }).click();

  // 03: 詳細画面
  await diskCard(page, 'e2e-disk').click();
  await expect(page).toHaveURL(/#\/e2e\/disks\//);
  await expect(page.getByRole('heading', { name: /^ディスク詳細: / })).toBeVisible();
  await shot(page, RESOURCE, '03-detail.png');

  // 04: 名前・説明・タグの編集フォーム(入力途中)
  await page.getByRole('button', { name: '編集' }).click();
  await page.getByPlaceholder('カンマ区切り(任意)').fill('e2e-manual-tag');
  await shot(page, RESOURCE, '04-edit-basic.png');
  await page.getByRole('button', { name: '保存する' }).click();
  await expect(page.getByText('e2e-manual-tag')).toBeVisible();

  // 05: 接続先サーバーの変更(未接続ディスクへの接続、Disk特有のUI)
  await page.getByRole('link', { name: 'ディスク' }).click();
  await diskCard(page, 'e2e-unconnected-disk').click();
  await expect(page).toHaveURL(/#\/e2e\/disks\//);
  await expect(page.getByText('(未接続)')).toBeVisible();
  await page.getByRole('button', { name: '変更' }).click();
  const connectionCard = page.locator('.card', { hasText: '接続先サーバー' });
  await connectionCard.getByRole('combobox').selectOption({ label: 'e2e-web-1' });
  await shot(page, RESOURCE, '05-connect-form.png');
  await page.getByRole('button', { name: '接続する' }).click();
  await expect(page.getByText('e2e-web-1')).toBeVisible();

  // 06: 接続解除(接続済みディスクの切断フォーム、Disk特有のUI)
  await page.getByRole('link', { name: 'ディスク' }).click();
  await diskCard(page, 'e2e-connected-disk').click();
  await expect(page).toHaveURL(/#\/e2e\/disks\//);
  await expect(page.getByText('e2e-web-1')).toBeVisible();
  await page.getByRole('button', { name: '変更' }).click();
  await expect(page.getByRole('button', { name: '接続を解除する' })).toBeVisible();
  await shot(page, RESOURCE, '06-disconnect-form.png');
  await page.getByRole('button', { name: '接続を解除する' }).click();
  await expect(page.getByText('(未接続)')).toBeVisible();

  // 07: 一覧に戻り、削除確認ダイアログ
  await page.getByRole('link', { name: 'ディスク' }).click();
  await expect(page).toHaveURL(/#\/e2e\/disks$/);
  await diskCard(page, 'e2e-doomed-disk').getByRole('button', { name: '削除' }).click();
  await expect(page.getByText('ディスク「e2e-doomed-disk」を削除しますか？')).toBeVisible();
  await shot(page, RESOURCE, '07-delete-confirm.png');
  await page.getByRole('button', { name: '削除する' }).click();
  await expect(diskCard(page, 'e2e-doomed-disk')).toHaveCount(0, { timeout: 10_000 });
});
