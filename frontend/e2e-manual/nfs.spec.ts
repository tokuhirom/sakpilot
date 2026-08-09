import { test, expect } from '@playwright/test';
import { shot } from './helpers';

// docs/manual/nfs.md 用のスクリーンショットを撮影する。
// 通常のE2E回帰テスト(frontend/e2e/nfs.spec.ts)と同じ
// シードデータ(e2e_server.go の seedNFS)・操作パターンを流用しているが、
// このファイルはCI(npm run test:e2e)には含まれず、`npm run docs:screenshots`
// (playwright.manual.config.ts、testDir: ./e2e-manual)からのみ実行される。
//
// シードデータ:
//   - e2e-nfs-1:      status=up   (電源操作シナリオ用)
//   - e2e-doomed-nfs: status=down (削除シナリオ用)
//   - e2e-edit-nfs:   status=up   (編集シナリオ用)
// スイッチはseedSwitchesが投入するe2e-switch/e2e-doomed-switchを利用する。
//
// 1つのtest内で連番のスクリーンショットを撮ることで、番号どおりの操作順序を保証する。

const RESOURCE = 'nfs';

const nfsCard = (page: import('@playwright/test').Page, name: string) =>
  page.locator('.card', { has: page.locator('.card-title', { hasText: name }) });

test('NFSマニュアル用スクリーンショット', async ({ page }) => {
  // 01: 一覧画面
  await page.goto('/');
  await page.getByRole('link', { name: 'NFS' }).click();
  await expect(page).toHaveURL(/#\/e2e\/nfs$/);
  await expect(nfsCard(page, 'e2e-nfs-1').locator('.status')).toHaveText('up');
  await shot(page, RESOURCE, '01-list.png');

  // 02: 操作メニュー(⋮)を開いた状態
  const card1 = nfsCard(page, 'e2e-nfs-1');
  await card1.getByRole('button', { name: '⋮' }).click();
  await shot(page, RESOURCE, '02-actions-menu.png');

  // 03: 停止確認ダイアログ
  await card1.getByRole('button', { name: '停止', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'NFS停止' })).toBeVisible();
  await shot(page, RESOURCE, '03-stop-confirm.png');
  await page.getByRole('button', { name: '停止する' }).click();
  await expect(card1.locator('.status')).toHaveText('down', { timeout: 15_000 });

  // 04: 作成モーダル(入力途中の状態、名前・接続スイッチ・IPアドレスまで入力)
  await page.getByRole('button', { name: '+ NFS作成' }).click();
  await page.getByPlaceholder('my-nfs').fill('e2e-manual-nfs');
  await page.getByLabel('接続スイッチ').selectOption({ label: 'e2e-switch' });
  await page.getByPlaceholder('例: 192.168.0.11').fill('192.168.0.31');
  await shot(page, RESOURCE, '04-create-modal.png');
  await page.getByRole('button', { name: 'キャンセル' }).click();

  // 05: 詳細画面
  await nfsCard(page, 'e2e-edit-nfs').click();
  await expect(page).toHaveURL(/#\/e2e\/nfs\//);
  await expect(page.getByRole('heading', { name: /^NFS詳細: / })).toBeVisible();
  await shot(page, RESOURCE, '05-detail.png');

  // 06: 基本情報の編集フォーム(入力途中)
  await page.getByRole('button', { name: '編集' }).click();
  await page.getByPlaceholder('任意', { exact: true }).fill('E2Eで編集した説明');
  await shot(page, RESOURCE, '06-edit-basic.png');
  await page.getByRole('button', { name: '保存する' }).click();
  await expect(page.getByText('E2Eで編集した説明')).toBeVisible();

  // 07: 一覧に戻り、削除確認ダイアログ
  await page.getByRole('link', { name: 'NFS' }).click();
  await expect(page).toHaveURL(/#\/e2e\/nfs$/);
  const doomedCard = nfsCard(page, 'e2e-doomed-nfs');
  await doomedCard.getByRole('button', { name: '⋮' }).click();
  await doomedCard.getByRole('button', { name: '削除', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'NFS削除' })).toBeVisible();
  await shot(page, RESOURCE, '07-delete-confirm.png');
  await page.getByRole('button', { name: '削除する' }).click();
  await expect(doomedCard).toHaveCount(0, { timeout: 10_000 });
});
