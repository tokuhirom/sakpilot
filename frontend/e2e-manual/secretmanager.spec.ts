import { test, expect } from '@playwright/test';
import { shot } from './helpers';

// docs/manual/secretmanager.md 用のスクリーンショットを撮影する。
// 通常のE2E回帰テスト(frontend/e2e/secretmanager.spec.ts)と同じ
// シードデータ(e2e_server.go の seedSecretManagerVaults)・操作パターンを流用しているが、
// このファイルはCI(npm run test:e2e)には含まれず、`npm run docs:screenshots`
// (playwright.manual.config.ts、testDir: ./e2e-manual)からのみ実行される。
//
// シードデータ:
//   - e2e-vault-1:        シークレット(e2e-secret)を1件持つ。表示確認・追加シナリオ用
//   - e2e-doomed-vault:   削除シナリオ用
//   - e2e-editable-vault: 編集シナリオ用
//
// 1つのtest内で連番のスクリーンショットを撮ることで、番号どおりの操作順序を保証する。

const RESOURCE = 'secretmanager';

const vaultCard = (page: import('@playwright/test').Page, name: string) =>
  page.locator('.card', { has: page.locator('.card-title', { hasText: name }) });

test('シークレットマネージャーマニュアル用スクリーンショット', async ({ page }) => {
  // 01: 一覧画面
  await page.goto('/');
  await page.getByRole('link', { name: 'シークレットマネージャー' }).click();
  await expect(page).toHaveURL(/#\/e2e\/secretmanager$/);
  await expect(vaultCard(page, 'e2e-vault-1')).toBeVisible();
  await shot(page, RESOURCE, '01-list.png');

  // 02: 作成モーダル(入力途中の状態)
  await page.getByRole('button', { name: '+ Vault作成' }).click();
  await page.getByPlaceholder('my-vault').fill('e2e-manual-vault');
  await page.getByPlaceholder('任意', { exact: true }).fill('マニュアル撮影用');
  await shot(page, RESOURCE, '02-create-modal.png');
  await page.getByRole('button', { name: 'キャンセル' }).click();

  // 03: 詳細画面(シークレット一覧、値は隠された状態)
  await vaultCard(page, 'e2e-vault-1').click();
  await expect(page).toHaveURL(/#\/e2e\/secretmanager\//);
  await expect(page.getByRole('heading', { name: 'Vault詳細: e2e-vault-1' })).toBeVisible();
  await expect(page.getByText('e2e-secret', { exact: true })).toBeVisible();
  await shot(page, RESOURCE, '03-detail.png');

  // 04: シークレットの値を表示
  const secretRow = page.locator('tr', { has: page.getByText('e2e-secret', { exact: true }) });
  await secretRow.getByRole('button', { name: '値を表示' }).click();
  await expect(secretRow.getByText('e2e-secret-value')).toBeVisible();
  await shot(page, RESOURCE, '04-secret-revealed.png');
  await secretRow.getByRole('button', { name: '隠す' }).click();

  // 05: シークレット追加モーダル(入力途中)
  await page.getByRole('button', { name: '+ シークレット追加' }).click();
  await page.getByPlaceholder('api-key').fill('e2e-manual-secret');
  await page.getByPlaceholder('シークレットの値').fill('manual-secret-value');
  await shot(page, RESOURCE, '05-secret-add-modal.png');
  await page.getByRole('button', { name: 'キャンセル' }).click();

  // 06: 一覧に戻り、e2e-editable-vaultで基本情報編集フォーム(入力途中)
  await page.getByRole('link', { name: 'シークレットマネージャー' }).click();
  await expect(page).toHaveURL(/#\/e2e\/secretmanager$/);
  await vaultCard(page, 'e2e-editable-vault').click();
  await expect(page.getByRole('heading', { name: 'Vault詳細: e2e-editable-vault' })).toBeVisible();
  await page.getByRole('button', { name: '編集' }).click();
  const descInput = page.locator('.form-group', { has: page.locator('label', { hasText: '説明' }) }).locator('input');
  await descInput.fill('E2Eで編集した説明');
  await shot(page, RESOURCE, '06-edit-basic.png');
  await page.getByRole('button', { name: '保存する' }).click();
  await expect(page.getByText('E2Eで編集した説明')).toBeVisible();

  // 07: 一覧に戻り、Vault削除確認ダイアログ
  await page.getByRole('link', { name: 'シークレットマネージャー' }).click();
  await expect(page).toHaveURL(/#\/e2e\/secretmanager$/);
  const doomedCard = vaultCard(page, 'e2e-doomed-vault');
  await doomedCard.getByRole('button', { name: '削除', exact: true }).click();
  await expect(page.getByText('Vault「e2e-doomed-vault」を削除しますか？')).toBeVisible();
  await shot(page, RESOURCE, '07-delete-confirm.png');
  await page.getByRole('button', { name: '削除する' }).click();
  await expect(doomedCard).toHaveCount(0, { timeout: 10_000 });
});
