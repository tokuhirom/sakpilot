import { test, expect } from '@playwright/test';
import { shot } from './helpers';

// docs/manual/server.md 用のスクリーンショットを撮影する。
// 通常のE2E回帰テスト(frontend/e2e/servers.spec.ts, server-detail.spec.ts)と同じ
// シードデータ(e2e_server.go の seedServers)・操作パターンを流用しているが、
// このファイルはCI(npm run test:e2e)には含まれず、`npm run docs:screenshots`
// (playwright.manual.config.ts、testDir: ./e2e-manual)からのみ実行される。
//
// シードデータ:
//   - e2e-web-1:       status=up   (電源操作シナリオ用)
//   - e2e-doomed-1:    status=down (削除シナリオ用)
//   - e2e-poweruser-1: status=down (プラン変更・CD-ROM・キー送信・NMI・VNCシナリオ用)
//   - e2e-iso-1:       CD-ROM挿入用ISOイメージ
//
// 1つのtest内で連番のスクリーンショットを撮ることで、番号どおりの操作順序を保証する。

const RESOURCE = 'server';

const serverCard = (page: import('@playwright/test').Page, name: string) =>
  page.locator('.card', { has: page.locator('.card-title', { hasText: name }) });

test('サーバーマニュアル用スクリーンショット', async ({ page }) => {
  // 01: 一覧画面
  await page.goto('/');
  await expect(page).toHaveURL(/#\/e2e\/servers$/);
  await expect(serverCard(page, 'e2e-web-1').locator('.status')).toHaveText('up');
  await shot(page, RESOURCE, '01-list.png');

  // 02: 操作メニュー(⋮)を開いた状態
  const webCard = serverCard(page, 'e2e-web-1');
  await webCard.getByRole('button', { name: '⋮' }).click();
  await shot(page, RESOURCE, '02-actions-menu.png');

  // 03: 停止確認ダイアログ
  await webCard.getByRole('button', { name: '停止', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'サーバー停止' })).toBeVisible();
  await shot(page, RESOURCE, '03-stop-confirm.png');
  await page.getByRole('button', { name: '停止する' }).click();
  await expect(webCard.locator('.status')).toHaveText('down', { timeout: 15_000 });

  // 04: 詳細画面(プラン変更・CD-ROM・コンソール操作・VNCが揃うe2e-poweruser-1を使う)
  await serverCard(page, 'e2e-poweruser-1').click();
  await expect(page).toHaveURL(/#\/e2e\/servers\//);
  await expect(page.getByRole('heading', { name: /^サーバー詳細: / })).toBeVisible();
  await shot(page, RESOURCE, '04-detail.png');

  // 05/06: プラン変更フォーム(入力途中)
  await page.getByRole('button', { name: '変更' }).first().click();
  const spinbuttons = page.getByRole('spinbutton');
  await shot(page, RESOURCE, '05-plan-edit.png');
  await spinbuttons.nth(0).fill('2');
  await spinbuttons.nth(1).fill('2');
  await shot(page, RESOURCE, '06-plan-edit-filled.png');
  await page.getByRole('button', { name: '保存する' }).click();
  await expect(page.getByText('2 vCPU / 2 GB')).toBeVisible();

  // 07/08: CD-ROM挿入フォーム(選択途中)→挿入後
  const cdromCard = page.locator('.card', { hasText: 'CD-ROM' });
  await cdromCard.getByRole('button', { name: '変更' }).click();
  await cdromCard.getByRole('combobox').selectOption({ label: 'e2e-iso-1' });
  await shot(page, RESOURCE, '07-cdrom-select.png');
  await page.getByRole('button', { name: '挿入する' }).click();
  await expect(page.getByText('(未挿入)')).toHaveCount(0);
  await shot(page, RESOURCE, '08-cdrom-inserted.png');

  // 09: コンソール操作(キー送信・NMI・VNC)の一覧
  await page.getByRole('button', { name: 'NMIを送信', exact: true }).scrollIntoViewIfNeeded();
  await shot(page, RESOURCE, '09-console-section.png');

  // 10: NMI送信の確認ダイアログ
  await page.getByRole('button', { name: 'NMIを送信', exact: true }).click();
  await expect(page.getByText('カーネルパニックを誘発する可能性')).toBeVisible();
  await shot(page, RESOURCE, '10-nmi-confirm.png');
  await page.getByRole('button', { name: 'NMIを送信する' }).click();
  await expect(page.getByText('カーネルパニックを誘発する可能性')).toHaveCount(0);

  // 11: VNC接続情報
  await page.getByRole('button', { name: '接続情報を取得' }).click();
  await expect(page.getByText('パスワード')).toBeVisible();
  await shot(page, RESOURCE, '11-vnc.png');

  // 12: 一覧に戻り、削除確認ダイアログ
  await page.getByRole('link', { name: 'サーバー' }).click();
  await expect(page).toHaveURL(/#\/e2e\/servers$/);
  const doomedCard = serverCard(page, 'e2e-doomed-1');
  await doomedCard.getByRole('button', { name: '⋮' }).click();
  await doomedCard.getByRole('button', { name: '削除', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'サーバー削除' })).toBeVisible();
  await shot(page, RESOURCE, '12-delete-confirm.png');
  await page.getByRole('button', { name: '削除する' }).click();
  await expect(doomedCard).toHaveCount(0, { timeout: 10_000 });
});
