import { test, expect } from '@playwright/test';

// E2Eサーバーがsakumock IAMにシードするデータ(e2e_server.go の seedIAM を参照):
//   - e2e-user-1:                     ユーザー表示確認用
//   - e2e-group-1:                    グループ表示確認用
//   - e2e-service-principal-1:        表示・キー管理シナリオ用(登録済みキーを1件持つ)
//   - e2e-service-principal-doomed:   削除シナリオ用
//   - e2e-service-principal-editable: 編集シナリオ用
// IAMロール/IDロールはsakumock側の固定定義(owner/editor/viewer/...、admin/member)を利用する。

test('ユーザー一覧が表示される', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'IAM', exact: true }).click();
  await expect(page).toHaveURL(/#\/e2e\/iam$/);

  await expect(page.getByRole('cell', { name: 'e2e-user-1', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'e2euser001' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'e2e-user-1@example.com' })).toBeVisible();
});

test('グループタブに切り替えると一覧表示される', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'IAM', exact: true }).click();

  await page.getByRole('button', { name: 'グループ' }).click();
  await expect(page.getByRole('cell', { name: 'e2e-group-1' })).toBeVisible();
});

test('IAMロールタブに切り替えると固定ロール一覧が表示される', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'IAM', exact: true }).click();

  await page.getByRole('button', { name: 'IAMロール' }).click();
  await expect(page.getByRole('cell', { name: 'オーナー' })).toBeVisible();
  await expect(page.getByRole('cell', { name: '編集者' })).toBeVisible();
});

test('IDロールタブに切り替えると固定ロール一覧が表示される', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'IAM', exact: true }).click();

  await page.getByRole('button', { name: 'IDロール' }).click();
  await expect(page.getByRole('cell', { name: '管理者' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'メンバー' })).toBeVisible();
});

test('サービスプリンシパルタブに切り替えると一覧表示される', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'IAM', exact: true }).click();

  await page.getByRole('button', { name: 'サービスプリンシパル' }).click();
  await expect(page.getByRole('cell', { name: 'e2e-service-principal-1' })).toBeVisible();
});

test('サービスプリンシパルを作成すると一覧に追加される', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'IAM', exact: true }).click();
  await page.getByRole('button', { name: 'サービスプリンシパル' }).click();

  await page.getByRole('button', { name: '+ サービスプリンシパル作成' }).click();
  await page.getByPlaceholder('1').fill('1');
  await page.getByPlaceholder('my-service-principal').fill('e2e-created-sp');
  await page.getByRole('button', { name: '作成する' }).click();

  await expect(page.getByRole('cell', { name: 'e2e-created-sp' })).toBeVisible();
});

test('サービスプリンシパルを削除すると一覧から消える', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'IAM', exact: true }).click();
  await page.getByRole('button', { name: 'サービスプリンシパル' }).click();

  const row = page.locator('tr', { has: page.getByRole('cell', { name: 'e2e-service-principal-doomed' }) });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: '削除' }).click();

  await expect(page.getByText('サービスプリンシパル「e2e-service-principal-doomed」を削除しますか？')).toBeVisible();
  await page.getByRole('button', { name: '削除する' }).click();

  await expect(page.getByRole('cell', { name: 'e2e-service-principal-doomed' })).toHaveCount(0, { timeout: 10_000 });
});

test('サービスプリンシパル詳細で基本情報を編集できる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'IAM', exact: true }).click();
  await page.getByRole('button', { name: 'サービスプリンシパル' }).click();
  await page.getByRole('cell', { name: 'e2e-service-principal-editable' }).click();

  await expect(page).toHaveURL(/#\/e2e\/iam\/serviceprincipals\//);
  await expect(page.getByRole('heading', { name: 'サービスプリンシパル詳細: e2e-service-principal-editable' })).toBeVisible();

  await page.getByRole('button', { name: '編集' }).click();
  const nameInput = page.locator('.form-group', { has: page.locator('label', { hasText: '名前' }) }).locator('input');
  await nameInput.fill('e2e-service-principal-editable-renamed');
  await page.getByRole('button', { name: '保存する' }).click();

  await expect(page.getByText('サービスプリンシパル詳細: e2e-service-principal-editable-renamed')).toBeVisible();
});

test('サービスプリンシパル詳細でキーの登録・有効/無効化・削除ができる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'IAM', exact: true }).click();
  await page.getByRole('button', { name: 'サービスプリンシパル' }).click();
  await page.getByRole('cell', { name: 'e2e-service-principal-1' }).click();

  await expect(page).toHaveURL(/#\/e2e\/iam\/serviceprincipals\//);
  await expect(page.getByRole('heading', { name: 'サービスプリンシパル詳細: e2e-service-principal-1' })).toBeVisible();

  const keysCard = page.locator('.card', { has: page.getByRole('heading', { name: 'キー' }) });
  const keyRows = keysCard.locator('tbody tr');

  // シードされたキーが有効状態で表示される
  const seededKeyRow = keyRows.first();
  await expect(seededKeyRow.getByText('有効', { exact: true })).toBeVisible();

  // 無効化
  await seededKeyRow.getByRole('button', { name: '無効化' }).click();
  await page.getByRole('button', { name: '実行する' }).click();
  await expect(seededKeyRow.getByText('無効', { exact: true })).toBeVisible();

  // 有効化
  await seededKeyRow.getByRole('button', { name: '有効化' }).click();
  await page.getByRole('button', { name: '実行する' }).click();
  await expect(seededKeyRow.getByText('有効', { exact: true })).toBeVisible();

  // 新規キー登録
  await page.getByRole('button', { name: '+ キー登録' }).click();
  await page.getByPlaceholder('-----BEGIN PUBLIC KEY-----...').fill('-----BEGIN PUBLIC KEY-----e2e-new-key-----END PUBLIC KEY-----');
  await page.getByRole('button', { name: '登録する' }).click();
  await expect(keyRows).toHaveCount(2);

  // 追加したキーを削除
  const newKeyRow = keyRows.nth(1);
  await newKeyRow.getByRole('button', { name: '削除' }).click();
  await page.getByRole('button', { name: '実行する' }).click();
  await expect(keyRows).toHaveCount(1);
});
