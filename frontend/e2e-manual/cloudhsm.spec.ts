import { test, expect } from '@playwright/test';
import { shot } from './helpers';

// docs/manual/cloudhsm.md 用のスクリーンショットを撮影する。
// 通常のE2E回帰テスト(frontend/e2e/cloudhsm.spec.ts)と同じ
// シードデータ(e2e_server.go の seedCloudHSM)・操作パターンを流用しているが、
// このファイルはCI(npm run test:e2e)には含まれず、`npm run docs:screenshots`
// (playwright.manual.config.ts、testDir: ./e2e-manual)からのみ実行される。
//
// シードデータ:
//   - e2e-cloudhsm-1:        表示確認用(接続クライアント e2e-client-1、ピア 112233445566 あり)
//   - e2e-cloudhsm-doomed:   削除シナリオ用
//   - e2e-cloudhsm-editable: 編集シナリオ用
//   - ソフトウェアライセンス: e2e-license-1 / e2e-doomed-license / e2e-editable-license
//
// 1つのtest内で連番のスクリーンショットを撮ることで、番号どおりの操作順序を保証する。

const RESOURCE = 'cloudhsm';

const hsmCard = (page: import('@playwright/test').Page, name: string) =>
  page.locator('.card', { has: page.locator('.card-title', { hasText: name }) });

test('CloudHSMマニュアル用スクリーンショット', async ({ page }) => {
  // 01: 一覧画面(HSM)
  await page.goto('/');
  await page.getByRole('link', { name: 'CloudHSM' }).click();
  await expect(page).toHaveURL(/#\/e2e\/cloudhsm$/);
  await expect(hsmCard(page, 'e2e-cloudhsm-1')).toBeVisible();
  await shot(page, RESOURCE, '01-list.png');

  // 02: 作成モーダル(入力途中の状態)
  await page.getByRole('button', { name: '+ HSM作成' }).click();
  await page.getByPlaceholder('my-hsm').fill('e2e-manual-hsm');
  await shot(page, RESOURCE, '02-create-modal.png');
  await page.getByRole('button', { name: 'キャンセル' }).click();

  // 03: 詳細画面(基本情報)
  await hsmCard(page, 'e2e-cloudhsm-1').click();
  await expect(page).toHaveURL(/#\/e2e\/cloudhsm\//);
  await expect(page.getByRole('heading', { name: 'CloudHSM詳細: e2e-cloudhsm-1' })).toBeVisible();
  await shot(page, RESOURCE, '03-detail.png');

  // 04: 基本情報編集フォーム(入力途中)
  const basicInfoCard = page.locator('.card', { has: page.locator('h4', { hasText: '基本情報' }) });
  await basicInfoCard.getByRole('button', { name: '編集' }).click();
  const descInput = page.locator('.form-group', { has: page.locator('label', { hasText: '説明' }) }).locator('input');
  await descInput.fill('E2Eで編集した説明');
  await shot(page, RESOURCE, '04-edit-basic.png');
  await page.getByRole('button', { name: 'キャンセル' }).click();

  // 05: 接続クライアントタブ
  await expect(page.getByRole('cell', { name: 'e2e-client-1' })).toBeVisible();
  await shot(page, RESOURCE, '05-clients.png');

  // 06: クライアント作成モーダル(入力途中)
  await page.getByRole('button', { name: '+ クライアント作成' }).click();
  await page.getByPlaceholder('app-client').fill('e2e-manual-client');
  await shot(page, RESOURCE, '06-create-client-modal.png');
  await page.getByRole('button', { name: 'キャンセル' }).click();

  // 07: ピアタブ
  await page.getByRole('button', { name: 'ピア' }).click();
  await expect(page.getByRole('cell', { name: '112233445566' })).toBeVisible();
  await shot(page, RESOURCE, '07-peers.png');

  // 08: 一覧に戻り、ソフトウェアライセンスタブ
  await page.getByRole('link', { name: 'CloudHSM' }).click();
  await expect(page).toHaveURL(/#\/e2e\/cloudhsm$/);
  await page.getByRole('button', { name: 'ソフトウェアライセンス' }).click();
  await expect(page.getByRole('cell', { name: 'e2e-license-1' })).toBeVisible();
  await shot(page, RESOURCE, '08-licenses.png');

  // 09: 削除確認ダイアログ(HSM一覧)
  await page.getByRole('button', { name: 'HSM' }).click();
  const doomedCard = hsmCard(page, 'e2e-cloudhsm-doomed');
  await doomedCard.getByRole('button', { name: '削除', exact: true }).click();
  await expect(page.getByText('CloudHSM「e2e-cloudhsm-doomed」を削除しますか？')).toBeVisible();
  await shot(page, RESOURCE, '09-delete-confirm.png');
  await page.getByRole('button', { name: '削除する' }).click();
  await expect(doomedCard).toHaveCount(0, { timeout: 10_000 });
});
