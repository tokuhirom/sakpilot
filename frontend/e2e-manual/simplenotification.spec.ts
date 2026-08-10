import { test, expect } from '@playwright/test';
import { shot } from './helpers';

// docs/manual/simplenotification.md 用のスクリーンショットを撮影する。
// 通常のE2E回帰テスト(frontend/e2e/simplenotification.spec.ts)と同じ
// シードデータ(e2e_server.go の seedSimpleNotification)・操作パターンを流用しているが、
// このファイルはCI(npm run test:e2e)には含まれず、`npm run docs:screenshots`
// (playwright.manual.config.ts、testDir: ./e2e-manual)からのみ実行される。
//
// シードデータ:
//   - e2e-destination-1/-doomed/-editable: 送信先(email)
//   - e2e-group-1/-doomed/-editable:       グループ(e2e-destination-1を含む)
//   - e2e-routing-1/-doomed/-editable:     ルーティング(e2e-group-1宛)
//
// 1つのtest内で連番のスクリーンショットを撮ることで、番号どおりの操作順序を保証する。

const RESOURCE = 'simplenotification';

test('簡易通知マニュアル用スクリーンショット', async ({ page }) => {
  // 01: 送信先一覧
  await page.goto('/');
  await page.getByRole('link', { name: '簡易通知' }).click();
  await expect(page).toHaveURL(/#\/e2e\/simplenotification$/);
  await expect(page.getByRole('cell', { name: 'e2e-destination-1' })).toBeVisible();
  await shot(page, RESOURCE, '01-destinations-list.png');

  // 02: 送信先作成モーダル(入力途中の状態)
  await page.getByRole('button', { name: '+ 送信先作成' }).click();
  await page.getByPlaceholder('my-destination').fill('e2e-manual-destination');
  await page.getByPlaceholder('alert@example.com').fill('manual@example.com');
  await shot(page, RESOURCE, '02-create-destination-modal.png');
  await page.getByRole('button', { name: 'キャンセル' }).click();

  // 03: 送信先編集フォーム(入力途中)
  const editableRow = page.locator('tr', { has: page.getByRole('cell', { name: 'e2e-destination-editable' }) });
  await editableRow.getByRole('button', { name: '編集' }).click();
  const descInput = page.locator('.form-group', { has: page.locator('label', { hasText: '説明' }) }).locator('input');
  await descInput.fill('マニュアル撮影用に編集');
  await shot(page, RESOURCE, '03-edit-destination-modal.png');
  await page.getByRole('button', { name: '更新する' }).click();
  await expect(page.getByRole('cell', { name: 'マニュアル撮影用に編集' })).toBeVisible();

  // 04: グループ一覧
  await page.getByRole('button', { name: 'グループ' }).click();
  await expect(page.getByRole('cell', { name: 'e2e-group-1' })).toBeVisible();
  await shot(page, RESOURCE, '04-groups-list.png');

  // 05: メッセージ送信モーダル(送信結果表示)
  const groupRow = page.locator('tr', { has: page.getByRole('cell', { name: 'e2e-group-1' }) });
  await groupRow.getByRole('button', { name: 'メッセージ送信' }).click();
  await page.getByPlaceholder('テストメッセージ').fill('マニュアル撮影用のテスト通知');
  await page.getByRole('button', { name: '送信する' }).click();
  await expect(page.getByText('送信しました')).toBeVisible();
  await shot(page, RESOURCE, '05-send-message-modal.png');
  await page.getByRole('button', { name: '閉じる' }).click();

  // 06: ルーティング一覧
  await page.getByRole('button', { name: 'ルーティング' }).click();
  await expect(page.getByRole('cell', { name: 'e2e-routing-1' })).toBeVisible();
  await shot(page, RESOURCE, '06-routings-list.png');

  // 07: ルーティング作成モーダル(入力途中)
  await page.getByRole('button', { name: '+ ルーティング作成' }).click();
  await page.getByPlaceholder('my-routing').fill('e2e-manual-routing');
  await page.getByPlaceholder('101122334455').fill('101122334455');
  await page.locator('.form-group', { has: page.locator('label', { hasText: '送信先グループ' }) })
    .locator('select').selectOption({ label: 'e2e-group-1' });
  await page.getByRole('button', { name: '+ ラベル追加' }).click();
  await page.getByPlaceholder('キー').fill('severity');
  await page.getByPlaceholder('値').fill('critical');
  await shot(page, RESOURCE, '07-create-routing-modal.png');
  await page.getByRole('button', { name: 'キャンセル' }).click();

  // 08: 削除確認ダイアログ
  const doomedRow = page.locator('tr', { has: page.getByRole('cell', { name: 'e2e-routing-doomed' }) });
  await doomedRow.getByRole('button', { name: '削除' }).click();
  await expect(page.getByText('「e2e-routing-doomed」を削除しますか？')).toBeVisible();
  await shot(page, RESOURCE, '08-delete-confirm.png');
  await page.getByRole('button', { name: '削除する' }).click();
  await expect(doomedRow).toHaveCount(0, { timeout: 10_000 });
});
