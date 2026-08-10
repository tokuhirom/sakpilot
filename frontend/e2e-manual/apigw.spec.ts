import { test, expect } from '@playwright/test';
import { shot } from './helpers';

// docs/manual/apigw.md 用のスクリーンショットを撮影する。
// 通常のE2E回帰テスト(frontend/e2e/apigw.spec.ts)と同じ
// シードデータ(e2e_server.go の seedApigw)・操作パターンを流用しているが、
// このファイルはCI(npm run test:e2e)には含まれず、`npm run docs:screenshots`
// (playwright.manual.config.ts、testDir: ./e2e-manual)からのみ実行される。
//
// 1つのtest内で連番のスクリーンショットを撮ることで、番号どおりの操作順序を保証する。

const RESOURCE = 'apigw';

test('APIゲートウェイマニュアル用スクリーンショット', async ({ page }) => {
  // 01: サービス一覧
  await page.goto('/');
  await page.getByRole('link', { name: 'APIゲートウェイ' }).click();
  await expect(page).toHaveURL(/#\/e2e\/apigw$/);
  await expect(page.getByRole('cell', { name: 'e2e_apigw_service_1' })).toBeVisible();
  await shot(page, RESOURCE, '01-services-list.png');

  // 02: サービス作成モーダル(入力途中)
  await page.getByRole('button', { name: '+ サービス作成' }).click();
  await page.getByPlaceholder('my_service').fill('e2e_manual_service');
  await page.locator('.form-group', { has: page.locator('label', { hasText: 'サブスクリプション' }) })
    .locator('select').selectOption({ label: 'e2e-apigw-subscription-for-create(トライアル)' });
  await page.getByPlaceholder('backend.example.com').fill('backend.e2e-manual.example.com');
  await shot(page, RESOURCE, '02-create-service-modal.png');
  await page.getByRole('button', { name: 'キャンセル' }).click();

  // 03: サービス詳細(基本情報+ルート一覧)
  await page.getByRole('cell', { name: 'e2e_apigw_service_1' }).click();
  await expect(page.getByRole('heading', { name: /サービス詳細/ })).toBeVisible();
  await expect(page.getByText('e2e-apigw-route-1')).toBeVisible();
  await shot(page, RESOURCE, '03-service-detail.png');

  // 04: ルート作成モーダル(入力途中)
  await page.getByRole('button', { name: '+ ルート作成' }).click();
  await page.getByPlaceholder('my_route').fill('e2e_manual_route');
  await page.locator('input[placeholder="/"]').fill('/e2e-manual');
  await shot(page, RESOURCE, '04-create-route-modal.png');
  await page.getByRole('button', { name: 'キャンセル' }).click();

  // 05: ユーザー一覧
  await page.goto('/#/e2e/apigw');
  await page.getByRole('button', { name: 'ユーザー' }).click();
  await expect(page.getByRole('cell', { name: 'e2e-apigw-user-1' })).toBeVisible();
  await shot(page, RESOURCE, '05-users-list.png');

  // 06: グループ管理モーダル
  const userRow = page.locator('tr', { has: page.getByRole('cell', { name: 'e2e-apigw-user-1' }) });
  await userRow.getByRole('button', { name: 'グループ管理' }).click();
  await expect(page.getByRole('checkbox').first()).toBeVisible();
  await shot(page, RESOURCE, '06-user-group-assign-modal.png');
  await page.getByRole('button', { name: '閉じる' }).click();

  // 07: グループ一覧
  await page.getByRole('button', { name: 'グループ' }).click();
  await expect(page.getByRole('cell', { name: 'e2e-apigw-group-1' })).toBeVisible();
  await shot(page, RESOURCE, '07-groups-list.png');

  // 08: ドメイン一覧
  await page.getByRole('button', { name: 'ドメイン' }).click();
  await expect(page.getByRole('cell', { name: 'e2e-apigw-domain-1.example.com' })).toBeVisible();
  await shot(page, RESOURCE, '08-domains-list.png');

  // 09: 証明書一覧
  await page.getByRole('button', { name: '証明書' }).click();
  await expect(page.getByRole('cell', { name: 'e2e-apigw-cert-1' })).toBeVisible();
  await shot(page, RESOURCE, '09-certificates-list.png');

  // 10: サブスクリプション一覧
  await page.getByRole('button', { name: 'サブスクリプション' }).click();
  await expect(page.getByRole('cell', { name: 'e2e-apigw-subscription-1' })).toBeVisible();
  await shot(page, RESOURCE, '10-subscriptions-list.png');

  // 11: サブスクリプション契約モーダル
  await page.getByRole('button', { name: '+ サブスクリプション作成' }).click();
  await page.getByPlaceholder('my-subscription').fill('e2e-manual-subscription');
  await shot(page, RESOURCE, '11-create-subscription-modal.png');
  await page.getByRole('button', { name: 'キャンセル' }).click();

  // 12: 削除確認ダイアログ
  const doomedRow = page.locator('tr', { has: page.getByRole('cell', { name: 'e2e-apigw-subscription-doomed' }) });
  await doomedRow.getByRole('button', { name: '解約' }).click();
  await expect(page.getByText('「e2e-apigw-subscription-doomed」を削除しますか？')).toBeVisible();
  await shot(page, RESOURCE, '12-delete-confirm.png');
  await page.getByRole('button', { name: 'キャンセル' }).click();
});
