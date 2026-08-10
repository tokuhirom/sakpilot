import { test, expect } from '@playwright/test';
import { shot } from './helpers';

// docs/manual/eventbus.md 用のスクリーンショットを撮影する。
// 通常のE2E回帰テスト(frontend/e2e/eventbus.spec.ts)と同じ
// シードデータ(e2e_server.go の seedEventBus)・操作パターンを流用しているが、
// このファイルはCI(npm run test:e2e)には含まれず、`npm run docs:screenshots`
// (playwright.manual.config.ts、testDir: ./e2e-manual)からのみ実行される。
//
// シードデータ:
//   - e2e-eventbus-pc-1/-doomed/-editable:      実行設定(destination=simplemq)
//   - e2e-eventbus-trigger-1/-doomed/-editable: トリガー(e2e-eventbus-pc-1宛)
//   - e2e-eventbus-schedule-1/-doomed/-editable: スケジュール(e2e-eventbus-pc-1宛)
//
// 1つのtest内で連番のスクリーンショットを撮ることで、番号どおりの操作順序を保証する。

const RESOURCE = 'eventbus';

test('イベントバスマニュアル用スクリーンショット', async ({ page }) => {
  // 01: 実行設定一覧
  await page.goto('/');
  await page.getByRole('link', { name: 'イベントバス' }).click();
  await expect(page).toHaveURL(/#\/e2e\/eventbus$/);
  await expect(page.getByRole('cell', { name: 'e2e-eventbus-pc-1' })).toBeVisible();
  await shot(page, RESOURCE, '01-process-configurations-list.png');

  // 02: 実行設定作成モーダル(入力途中の状態)
  await page.getByRole('button', { name: '+ 実行設定作成' }).click();
  await page.getByPlaceholder('my-process-configuration').fill('e2e-manual-pc');
  await page.getByPlaceholder('SimpleMQのキュー名').fill('e2e-manual-queue');
  await page.getByPlaceholder('送信するメッセージ本文').fill('マニュアル撮影用メッセージ');
  await shot(page, RESOURCE, '02-create-pc-modal.png');
  await page.getByRole('button', { name: 'キャンセル' }).click();

  // 03: シークレット設定モーダル
  const pcRow = page.locator('tr', { has: page.getByRole('cell', { name: 'e2e-eventbus-pc-1' }) });
  await pcRow.getByRole('button', { name: 'シークレット設定' }).click();
  await page.getByPlaceholder('SimpleMQのAPIキー').fill('e2e-manual-api-key');
  await shot(page, RESOURCE, '03-secret-modal.png');
  await page.getByRole('button', { name: '閉じる' }).click();

  // 04: トリガー一覧
  await page.getByRole('button', { name: 'トリガー' }).click();
  await expect(page.getByRole('cell', { name: 'e2e-eventbus-trigger-1' })).toBeVisible();
  await shot(page, RESOURCE, '04-triggers-list.png');

  // 05: トリガー作成モーダル(発火条件込みの入力途中)
  await page.getByRole('button', { name: '+ トリガー作成' }).click();
  await page.getByPlaceholder('my-trigger').fill('e2e-manual-trigger');
  await page.getByPlaceholder('sakuracloud').fill('sakuracloud');
  await page.locator('.form-group', { has: page.locator('label', { hasText: '実行設定' }) })
    .locator('select').selectOption({ label: 'e2e-eventbus-pc-1' });
  await page.getByRole('button', { name: '+ 条件追加' }).click();
  await page.getByPlaceholder('キー').fill('region');
  await page.getByPlaceholder('値').fill('tk1a');
  await shot(page, RESOURCE, '05-create-trigger-modal.png');
  await page.getByRole('button', { name: 'キャンセル' }).click();

  // 06: スケジュール一覧
  await page.getByRole('button', { name: 'スケジュール' }).click();
  await expect(page.getByRole('cell', { name: 'e2e-eventbus-schedule-1' })).toBeVisible();
  await shot(page, RESOURCE, '06-schedules-list.png');

  // 07: スケジュール作成モーダル(入力途中)
  await page.getByRole('button', { name: '+ スケジュール作成' }).click();
  await page.getByPlaceholder('my-schedule').fill('e2e-manual-schedule');
  await page.locator('input[type="datetime-local"]').fill('2030-01-01T00:00');
  await shot(page, RESOURCE, '07-create-schedule-modal.png');
  await page.getByRole('button', { name: 'キャンセル' }).click();

  // 08: 削除確認ダイアログ
  const doomedRow = page.locator('tr', { has: page.getByRole('cell', { name: 'e2e-eventbus-schedule-doomed' }) });
  await doomedRow.getByRole('button', { name: '削除' }).click();
  await expect(page.getByText('「e2e-eventbus-schedule-doomed」を削除しますか？')).toBeVisible();
  await shot(page, RESOURCE, '08-delete-confirm.png');
  await page.getByRole('button', { name: '削除する' }).click();
  await expect(doomedRow).toHaveCount(0, { timeout: 10_000 });
});
