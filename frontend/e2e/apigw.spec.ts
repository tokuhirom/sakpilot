import { test, expect } from '@playwright/test';

// E2Eサーバーがsakumock apigwにシードするデータ(e2e_server.go の
// seedApigw を参照):
//   - e2e-apigw-cert-1/-doomed/-editable:                証明書
//   - e2e-apigw-domain-*.example.com:                    ドメイン(-1はcert-1に紐づく)
//   - e2e-apigw-group-1/-doomed/-editable:                グループ
//   - e2e-apigw-user-1/-doomed/-editable:                 ユーザー(-1はgroup-1所属)
//   - e2e-apigw-subscription-1/-doomed:                   サブスクリプション(サービス未紐付け)
//   - e2e-apigw-subscription-for-create:                  サービス作成シナリオ用(未使用)
//   - e2e_apigw_service_1/_doomed/_editable:               サービス(それぞれ専用サブスクリプションに紐付け)
//   - e2e-apigw-route-1/-doomed/-editable:                 e2e_apigw_service_1配下のルート

test('サービス一覧が表示される', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'APIゲートウェイ' }).click();
  await expect(page).toHaveURL(/#\/e2e\/apigw$/);

  await expect(page.getByRole('cell', { name: 'e2e_apigw_service_1' })).toBeVisible();
});

test('サービスを作成すると一覧に追加される', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'APIゲートウェイ' }).click();

  await page.getByRole('button', { name: '+ サービス作成' }).click();
  await page.getByPlaceholder('my_service').fill('e2e_created_service');
  await page.locator('.form-group', { has: page.locator('label', { hasText: 'サブスクリプション' }) })
    .locator('select').selectOption({ label: 'e2e-apigw-subscription-for-create(トライアル)' });
  await page.getByPlaceholder('backend.example.com').fill('backend.e2e-created.example.com');
  await page.getByRole('button', { name: '作成する' }).click();

  await expect(page.getByRole('cell', { name: 'e2e_created_service' })).toBeVisible();
});

test('サービスを編集できる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'APIゲートウェイ' }).click();

  const row = page.locator('tr', { has: page.getByRole('cell', { name: 'e2e_apigw_service_editable' }) });
  await row.getByRole('button', { name: '編集' }).click();

  const nameInput = page.locator('.form-group', { has: page.locator('label', { hasText: '名前' }) }).locator('input');
  await nameInput.fill('e2e_apigw_service_editable_renamed');
  await page.getByRole('button', { name: '更新する' }).click();

  await expect(page.getByRole('cell', { name: 'e2e_apigw_service_editable_renamed' })).toBeVisible();
});

test('サービスを削除すると一覧から消える', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'APIゲートウェイ' }).click();

  const row = page.locator('tr', { has: page.getByRole('cell', { name: 'e2e_apigw_service_doomed' }) });
  await row.getByRole('button', { name: '削除' }).click();
  await page.getByRole('button', { name: '削除する' }).click();

  await expect(page.getByRole('cell', { name: 'e2e_apigw_service_doomed' })).toHaveCount(0, { timeout: 10_000 });
});

test('サービス詳細でルート一覧が表示され、ルートを作成・削除できる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'APIゲートウェイ' }).click();
  await page.getByRole('cell', { name: 'e2e_apigw_service_1' }).click();

  await expect(page.getByRole('heading', { name: /サービス詳細/ })).toBeVisible();
  await expect(page.getByText('e2e-apigw-route-1')).toBeVisible();

  await page.getByRole('button', { name: '+ ルート作成' }).click();
  await page.getByPlaceholder('my_route').fill('e2e-created-route');
  await page.locator('input[placeholder="/"]').fill('/e2e-created-route');
  await page.getByRole('button', { name: '作成する' }).click();
  await expect(page.getByText('/e2e-created-route')).toBeVisible();

  const row = page.locator('tr', { has: page.getByText('e2e-apigw-route-doomed') });
  await row.getByRole('button', { name: '削除' }).click();
  await page.getByRole('button', { name: '削除する' }).click();
  await expect(page.getByText('e2e-apigw-route-doomed')).toHaveCount(0, { timeout: 10_000 });
});

test('サービス詳細の基本情報を編集できる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'APIゲートウェイ' }).click();
  await page.getByRole('cell', { name: 'e2e_apigw_service_1' }).click();
  await expect(page.getByRole('heading', { name: /サービス詳細/ })).toBeVisible();

  await page.locator('.card').getByRole('button', { name: '編集' }).click();
  const hostInput = page.locator('.form-group', { has: page.locator('label', { hasText: '接続先ホスト' }) }).locator('input');
  await hostInput.fill('renamed-backend.e2e.example.com');
  await page.getByRole('button', { name: '保存する' }).click();

  await expect(page.getByText('renamed-backend.e2e.example.com')).toBeVisible();
});

test('グループタブに切り替えて作成・削除できる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'APIゲートウェイ' }).click();
  await page.getByRole('button', { name: 'グループ' }).click();

  await expect(page.getByRole('cell', { name: 'e2e-apigw-group-1' })).toBeVisible();

  await page.getByRole('button', { name: '+ グループ作成' }).click();
  await page.getByPlaceholder('my_group').fill('e2e-created-group');
  await page.getByRole('button', { name: '作成する' }).click();
  await expect(page.getByRole('cell', { name: 'e2e-created-group' })).toBeVisible();

  const row = page.locator('tr', { has: page.getByRole('cell', { name: 'e2e-apigw-group-doomed' }) });
  await row.getByRole('button', { name: '削除' }).click();
  await page.getByRole('button', { name: '削除する' }).click();
  await expect(page.getByRole('cell', { name: 'e2e-apigw-group-doomed' })).toHaveCount(0, { timeout: 10_000 });
});

test('ユーザータブでグループ管理ができる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'APIゲートウェイ' }).click();
  await page.getByRole('button', { name: 'ユーザー' }).click();

  await expect(page.getByRole('cell', { name: 'e2e-apigw-user-1' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'e2e-apigw-group-1' })).toBeVisible();

  const row = page.locator('tr', { has: page.getByRole('cell', { name: 'e2e-apigw-user-editable' }) });
  await row.getByRole('button', { name: 'グループ管理' }).click();

  const checkbox = page.getByRole('checkbox', { name: /e2e-apigw-group-editable/ });
  await expect(checkbox).toBeVisible();
  await checkbox.click();
  await expect(checkbox).toBeChecked();

  await page.getByRole('button', { name: '閉じる' }).click();
  const updatedRow = page.locator('tr', { has: page.getByRole('cell', { name: 'e2e-apigw-user-editable' }) });
  await expect(updatedRow.getByRole('cell', { name: /e2e-apigw-group-editable/ })).toBeVisible();
});

test('ドメインタブで証明書の紐付けを編集できる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'APIゲートウェイ' }).click();
  await page.getByRole('button', { name: 'ドメイン' }).click();

  await expect(page.getByRole('cell', { name: 'e2e-apigw-domain-1.example.com' })).toBeVisible();

  const row = page.locator('tr', { has: page.getByRole('cell', { name: 'e2e-apigw-domain-editable.example.com' }) });
  await row.getByRole('button', { name: '編集' }).click();
  await page.locator('.form-group', { has: page.locator('label', { hasText: '証明書' }) })
    .locator('select').selectOption({ label: 'e2e-apigw-cert-1' });
  await page.getByRole('button', { name: '更新する' }).click();

  const updatedRow = page.locator('tr', { has: page.getByRole('cell', { name: 'e2e-apigw-domain-editable.example.com' }) });
  await expect(updatedRow.getByRole('cell', { name: 'e2e-apigw-cert-1' })).toBeVisible();
});

test('証明書タブで作成・削除できる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'APIゲートウェイ' }).click();
  await page.getByRole('button', { name: '証明書' }).click();

  await expect(page.getByRole('cell', { name: 'e2e-apigw-cert-1' })).toBeVisible();

  const row = page.locator('tr', { has: page.getByRole('cell', { name: 'e2e-apigw-cert-doomed' }) });
  await row.getByRole('button', { name: '削除' }).click();
  await page.getByRole('button', { name: '削除する' }).click();
  await expect(page.getByRole('cell', { name: 'e2e-apigw-cert-doomed' })).toHaveCount(0, { timeout: 10_000 });
});

test('サブスクリプションタブで契約・編集・解約できる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'APIゲートウェイ' }).click();
  await page.getByRole('button', { name: 'サブスクリプション' }).click();

  await expect(page.getByRole('cell', { name: 'e2e-apigw-subscription-1' })).toBeVisible();

  await page.getByRole('button', { name: '+ サブスクリプション作成' }).click();
  await page.getByPlaceholder('my-subscription').fill('e2e-created-subscription');
  await page.getByRole('button', { name: '契約する' }).click();
  await expect(page.getByRole('cell', { name: 'e2e-created-subscription' })).toBeVisible();

  const editRow = page.locator('tr', { has: page.getByRole('cell', { name: 'e2e-created-subscription' }) });
  await editRow.getByRole('button', { name: '編集' }).click();
  const nameInput = page.locator('.form-group', { has: page.locator('label', { hasText: '名前' }) }).locator('input');
  await nameInput.fill('e2e-created-subscription-renamed');
  await page.getByRole('button', { name: '更新する' }).click();
  await expect(page.getByRole('cell', { name: 'e2e-created-subscription-renamed' })).toBeVisible();

  const doomedRow = page.locator('tr', { has: page.getByRole('cell', { name: 'e2e-apigw-subscription-doomed' }) });
  await doomedRow.getByRole('button', { name: '解約' }).click();
  await page.getByRole('button', { name: '削除する' }).click();
  await expect(page.getByRole('cell', { name: 'e2e-apigw-subscription-doomed' })).toHaveCount(0, { timeout: 10_000 });
});
