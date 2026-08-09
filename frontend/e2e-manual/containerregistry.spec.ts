import { test, expect } from '@playwright/test';
import { shot } from './helpers';

// docs/manual/containerregistry.md 用のスクリーンショットを撮影する。
// 通常のE2E回帰テスト(frontend/e2e/containerregistry.spec.ts)と同じ
// シードデータ(e2e_server.go の seedContainerRegistries)・操作パターンを流用しているが、
// このファイルはCI(npm run test:e2e)には含まれず、`npm run docs:screenshots`
// (playwright.manual.config.ts、testDir: ./e2e-manual)からのみ実行される。
//
// シードデータ:
//   - e2e-registry-target: 基本情報編集・ユーザー管理シナリオ用
//   - e2e-doomed-registry: 削除シナリオ用
//
// イメージ・タグ一覧は実際のレジストリAPI(FQDN)への接続が必要なため、
// E2Eのfakeドライバでは表示できず、本スクリプトの撮影対象からは除外している。
//
// 1つのtest内で連番のスクリーンショットを撮ることで、番号どおりの操作順序を保証する。

const RESOURCE = 'containerregistry';

const registryRow = (page: import('@playwright/test').Page, name: string) =>
  page.locator('tr', { hasText: name });

test('コンテナレジストリマニュアル用スクリーンショット', async ({ page }) => {
  // 01: 一覧画面
  await page.goto('/');
  await page.getByRole('link', { name: 'コンテナレジストリ' }).click();
  await expect(page).toHaveURL(/#\/e2e\/container-registry$/);
  await expect(registryRow(page, 'e2e-registry-target')).toBeVisible();
  await shot(page, RESOURCE, '01-list.png');

  // 02: 作成モーダル(入力途中の状態)
  await page.getByRole('button', { name: '+ レジストリ作成' }).click();
  await page.getByPlaceholder('my-registry').fill('e2e-manual-example');
  await shot(page, RESOURCE, '02-create-modal.png');
  await page.getByRole('button', { name: 'キャンセル' }).click();

  // 03: 詳細画面
  await registryRow(page, 'e2e-registry-target').click();
  await expect(page).toHaveURL(/#\/e2e\/container-registry\//);
  await expect(page.getByRole('heading', { name: /^コンテナレジストリ詳細: / })).toBeVisible();
  await shot(page, RESOURCE, '03-detail.png');

  // 04: 基本情報編集フォーム(入力途中)
  await page.getByRole('button', { name: '編集' }).click();
  await page.locator('.form-group', { hasText: '説明' }).locator('input').fill('E2Eで編集した説明');
  await shot(page, RESOURCE, '04-edit-basic.png');
  await page.getByRole('button', { name: '保存する' }).click();
  await expect(page.getByText('E2Eで編集した説明')).toBeVisible();

  // 05: ユーザー追加モーダル(入力途中)
  await page.getByRole('button', { name: '+ ユーザー追加' }).click();
  await page.locator('.form-group', { hasText: 'ユーザー名' }).locator('input').fill('e2e-manual-user');
  await page.locator('.form-group', { hasText: 'パスワード' }).locator('input').fill('e2e-password');
  await shot(page, RESOURCE, '05-add-user-modal.png');
  await page.getByRole('button', { name: '追加する' }).click();
  await expect(page.getByText('e2e-manual-user')).toBeVisible();

  // 06: ユーザー権限の編集(インライン)
  const userRow = page.locator('tr', { hasText: 'e2e-manual-user' });
  await userRow.getByRole('button', { name: 'ユーザー編集' }).click();
  await userRow.locator('select').selectOption('readonly');
  await shot(page, RESOURCE, '06-edit-user.png');
  await userRow.getByRole('button', { name: '保存' }).click();
  await expect(userRow.getByText('読み取り専用')).toBeVisible();

  // 07: ユーザー削除確認ダイアログ
  await userRow.getByRole('button', { name: 'ユーザー削除' }).click();
  await expect(page.getByText('ユーザー「e2e-manual-user」を削除しますか？')).toBeVisible();
  await shot(page, RESOURCE, '07-delete-user-confirm.png');
  await page.getByRole('button', { name: '削除する' }).click();
  await expect(page.getByText('e2e-manual-user')).toHaveCount(0, { timeout: 10_000 });

  // 08: 一覧に戻り、レジストリ削除確認ダイアログ
  await page.getByRole('link', { name: 'コンテナレジストリ' }).click();
  await expect(page).toHaveURL(/#\/e2e\/container-registry$/);
  await registryRow(page, 'e2e-doomed-registry').getByRole('button', { name: '削除' }).click();
  await expect(page.getByText('コンテナレジストリ「e2e-doomed-registry」を削除しますか？')).toBeVisible();
  await shot(page, RESOURCE, '08-delete-confirm.png');
  await page.getByRole('button', { name: '削除する' }).click();
  await expect(registryRow(page, 'e2e-doomed-registry')).toHaveCount(0, { timeout: 10_000 });
});
