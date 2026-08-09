import { test, expect } from '@playwright/test';
import { shot } from './helpers';

// docs/manual/switch.md 用のスクリーンショットを撮影する。
// 通常のE2E回帰テスト(frontend/e2e/switch.spec.ts)と同じ
// シードデータ(e2e_server.go の seedSwitches)・操作パターンを流用しているが、
// このファイルはCI(npm run test:e2e)には含まれず、`npm run docs:screenshots`
// (playwright.manual.config.ts、testDir: ./e2e-manual)からのみ実行される。
//
// シードデータ:
//   - e2e-switch:        scope=user (編集シナリオ用)
//   - e2e-doomed-switch: scope=user (削除シナリオ用)
//
// 1つのtest内で連番のスクリーンショットを撮ることで、番号どおりの操作順序を保証する。

const RESOURCE = 'switch';

const switchRow = (page: import('@playwright/test').Page, name: string) =>
  page.locator('tr', { hasText: name });

test('スイッチマニュアル用スクリーンショット', async ({ page }) => {
  // 01: 一覧画面
  await page.goto('/');
  await page.getByRole('link', { name: 'スイッチ' }).click();
  await expect(page).toHaveURL(/#\/e2e\/switches$/);
  await expect(switchRow(page, 'e2e-switch')).toBeVisible();
  await expect(switchRow(page, 'e2e-doomed-switch')).toBeVisible();
  await shot(page, RESOURCE, '01-list.png');

  // 02: 作成モーダル(入力途中)
  await page.getByRole('button', { name: '+ スイッチ作成' }).click();
  await page.getByPlaceholder('my-switch').fill('e2e-manual-switch');
  await page.getByPlaceholder('任意', { exact: true }).fill('マニュアル用に作成');
  await shot(page, RESOURCE, '02-create-form.png');
  await page.getByRole('button', { name: '作成する' }).click();
  await expect(switchRow(page, 'e2e-manual-switch')).toBeVisible();

  // 03: 詳細画面
  await switchRow(page, 'e2e-switch').click();
  await expect(page).toHaveURL(/#\/e2e\/switches\//);
  await expect(page.getByRole('heading', { name: /^スイッチ詳細: / })).toBeVisible();
  await shot(page, RESOURCE, '03-detail.png');

  // 04: 名前・説明・ネットワーク設定の編集フォーム(入力途中)
  await page.getByRole('button', { name: '編集' }).click();
  await page.getByPlaceholder('任意(ルータ接続する場合のみ、26-28)').fill('28');
  await page.getByPlaceholder('任意(例: 192.168.0.1)').fill('192.168.0.1');
  await shot(page, RESOURCE, '04-edit-form.png');
  await page.getByRole('button', { name: '保存する' }).click();
  await expect(page.getByText('/28')).toBeVisible();
  await expect(page.getByText('192.168.0.1')).toBeVisible();

  // 05: 一覧に戻り、削除確認ダイアログ
  await page.getByRole('link', { name: 'スイッチ' }).click();
  await expect(page).toHaveURL(/#\/e2e\/switches$/);
  await switchRow(page, 'e2e-doomed-switch').getByRole('button', { name: '削除' }).click();
  await expect(page.getByText('スイッチ「e2e-doomed-switch」を削除しますか？')).toBeVisible();
  await shot(page, RESOURCE, '05-delete-confirm.png');
  await page.getByRole('button', { name: '削除する' }).click();
  await expect(switchRow(page, 'e2e-doomed-switch')).toHaveCount(0, { timeout: 10_000 });
});
