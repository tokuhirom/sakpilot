import { test, expect, type Page } from '@playwright/test';

// E2Eサーバーがsakumock IAMにシードするデータ(e2e_server.go の seedIAM を参照):
//   - e2e-user-1:                     ユーザー表示確認用
//   - e2e-group-1:                    グループ表示確認用
//   - e2e-service-principal-1:        表示・キー管理シナリオ用(登録済みキーを1件持つ)
//   - e2e-service-principal-doomed:   削除シナリオ用
//   - e2e-service-principal-editable: 編集シナリオ用
//   - e2e-folder-1:                   フォルダ階層表示シナリオ用(子にe2e-project-1を持つ)
//   - e2e-folder-doomed:              フォルダ削除シナリオ用
//   - e2e-folder-editable:            フォルダ編集シナリオ用
//   - e2e-folder-move-target:         フォルダ・プロジェクト移動シナリオ用の移動先
//   - e2e-project-1:                  プロジェクト階層表示シナリオ用(e2e-folder-1の子)
//   - e2e-project-doomed:             プロジェクト削除シナリオ用
//   - e2e-project-editable:           プロジェクト編集シナリオ用
//   - e2e-project-movable:            プロジェクト移動シナリオ用
// IAMロール/IDロールはsakumock側の固定定義(owner/editor/viewer/...、admin/member)を利用する。
// 組織(organization)はsakumock側にデフォルトで1件のみ存在する単数リソース。
// ポリシーバインディングも以下をシード済み:
//   - 組織スコープ(IAM):  owner + user:1
//   - e2e-project-1(IAM): editor + group:1
//   - e2e-folder-1(IAM):  viewer + service-principal:<e2e-service-principal-1のID>
//   - 組織スコープ(ID):    admin + user:1

function policySelect(page: Page, labelText: string) {
  return page.locator('.form-group', { has: page.locator('label', { hasText: labelText }) }).locator('select');
}

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

test('プロジェクト/フォルダタブでフォルダ階層とプロジェクトが表示される', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'IAM', exact: true }).click();
  await page.getByRole('button', { name: 'プロジェクト/フォルダ' }).click();

  await expect(page.locator('.iam-tree-row', { hasText: 'e2e-folder-1' })).toBeVisible();
  await expect(page.locator('.iam-tree-row', { hasText: 'e2e-project-1' })).toBeVisible();
});

test('フォルダを作成すると一覧に追加される', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'IAM', exact: true }).click();
  await page.getByRole('button', { name: 'プロジェクト/フォルダ' }).click();

  await page.getByRole('button', { name: '+ フォルダ作成' }).click();
  await page.getByPlaceholder('my-folder').fill('e2e-created-folder');
  await page.getByRole('button', { name: '作成する' }).click();

  await expect(page.locator('.iam-tree-row', { hasText: 'e2e-created-folder' })).toBeVisible();
});

test('プロジェクトを作成すると一覧に追加される', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'IAM', exact: true }).click();
  await page.getByRole('button', { name: 'プロジェクト/フォルダ' }).click();

  await page.getByRole('button', { name: '+ プロジェクト作成' }).click();
  await page.getByPlaceholder('my-project-code').fill('e2e-created-project-code');
  await page.getByPlaceholder('my-project', { exact: true }).fill('e2e-created-project');
  await page.getByRole('button', { name: '作成する' }).click();

  await expect(page.locator('.iam-tree-row', { hasText: 'e2e-created-project' })).toBeVisible();
});

test('フォルダを削除すると一覧から消える', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'IAM', exact: true }).click();
  await page.getByRole('button', { name: 'プロジェクト/フォルダ' }).click();

  const row = page.locator('.iam-tree-row', { hasText: 'e2e-folder-doomed' });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: '削除' }).click();

  await expect(page.getByText('フォルダ「e2e-folder-doomed」を削除しますか？')).toBeVisible();
  await page.getByRole('button', { name: '削除する' }).click();

  await expect(page.locator('.iam-tree-row', { hasText: 'e2e-folder-doomed' })).toHaveCount(0, { timeout: 10_000 });
});

test('プロジェクトを削除すると一覧から消える', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'IAM', exact: true }).click();
  await page.getByRole('button', { name: 'プロジェクト/フォルダ' }).click();

  const row = page.locator('.iam-tree-row', { hasText: 'e2e-project-doomed' });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: '削除' }).click();

  await expect(page.getByText('プロジェクト「e2e-project-doomed」を削除しますか？')).toBeVisible();
  await page.getByRole('button', { name: '削除する' }).click();

  await expect(page.locator('.iam-tree-row', { hasText: 'e2e-project-doomed' })).toHaveCount(0, { timeout: 10_000 });
});

test('フォルダ名を編集できる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'IAM', exact: true }).click();
  await page.getByRole('button', { name: 'プロジェクト/フォルダ' }).click();

  const row = page.locator('.iam-tree-row', { hasText: 'e2e-folder-editable' });
  await row.getByRole('button', { name: '編集' }).click();
  await page.getByPlaceholder('my-folder').fill('e2e-folder-editable-renamed');
  await page.getByRole('button', { name: '更新する' }).click();

  await expect(page.locator('.iam-tree-row', { hasText: 'e2e-folder-editable-renamed' })).toBeVisible();
});

test('プロジェクトを編集できる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'IAM', exact: true }).click();
  await page.getByRole('button', { name: 'プロジェクト/フォルダ' }).click();

  const row = page.locator('.iam-tree-row', { hasText: 'e2e-project-editable' });
  await row.getByRole('button', { name: '編集' }).click();
  await page.getByPlaceholder('my-project').fill('e2e-project-editable-renamed');
  await page.getByRole('button', { name: '更新する' }).click();

  await expect(page.locator('.iam-tree-row', { hasText: 'e2e-project-editable-renamed' })).toBeVisible();
});

test('プロジェクトを別のフォルダへ移動できる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'IAM', exact: true }).click();
  await page.getByRole('button', { name: 'プロジェクト/フォルダ' }).click();

  const row = page.locator('.iam-tree-row', { hasText: 'e2e-project-movable' });
  await row.getByRole('button', { name: '移動' }).click();
  const moveSelect = page.locator('form').getByRole('combobox');
  const optionValue = await moveSelect.getByRole('option', { name: /e2e-folder-move-target/ }).getAttribute('value');
  await moveSelect.selectOption(optionValue!);
  await page.getByRole('button', { name: '移動する' }).click();

  const targetFolderRow = page.locator('.iam-tree-row', { hasText: 'e2e-folder-move-target' });
  const movedRow = targetFolderRow.locator('..').locator('.iam-tree-row', { hasText: 'e2e-project-movable' });
  await expect(movedRow).toBeVisible();
});

test('組織タブで組織情報が表示され、名前を編集できる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'IAM', exact: true }).click();
  await page.getByRole('button', { name: '組織' }).click();

  await expect(page.getByText('組織ID')).toBeVisible();
  await page.getByRole('button', { name: '組織名を編集' }).click();
  await page.locator('.form-group input[type="text"]').fill('e2e-organization-renamed');
  await page.getByRole('button', { name: '更新する' }).click();

  await expect(page.getByText('e2e-organization-renamed')).toBeVisible();
});

test('ポリシータブで組織スコープのIAMポリシーバインディングが表示される', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'IAM', exact: true }).click();
  await page.getByRole('button', { name: 'ポリシー' }).click();

  const row = page.locator('tbody tr').first();
  await expect(row.getByRole('combobox').first()).toHaveValue('owner');
});

test('ポリシータブでプロジェクトを選択するとそのIAMポリシーバインディングが表示される', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'IAM', exact: true }).click();
  await page.getByRole('button', { name: 'ポリシー' }).click();

  await policySelect(page, 'スコープ').selectOption('project');
  const projectSelect = policySelect(page, 'プロジェクト');
  const optionValue = await projectSelect.getByRole('option', { name: /e2e-project-1/ }).getAttribute('value');
  await projectSelect.selectOption(optionValue!);

  const row = page.locator('tbody tr').first();
  await expect(row.getByRole('combobox').first()).toHaveValue('editor');
});

test('ポリシータブでフォルダを選択するとそのIAMポリシーバインディングが表示される', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'IAM', exact: true }).click();
  await page.getByRole('button', { name: 'ポリシー' }).click();

  await policySelect(page, 'スコープ').selectOption('folder');
  const folderSelect = policySelect(page, 'フォルダ');
  const optionValue = await folderSelect.getByRole('option', { name: /e2e-folder-1/ }).getAttribute('value');
  await folderSelect.selectOption(optionValue!);

  const row = page.locator('tbody tr').first();
  await expect(row.getByRole('combobox').first()).toHaveValue('viewer');
});

test('ポリシータブでロール体系をIDに切り替えると組織スコープのIDポリシーバインディングが表示される', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'IAM', exact: true }).click();
  await page.getByRole('button', { name: 'ポリシー' }).click();

  await policySelect(page, 'ロール体系').selectOption('id');

  const row = page.locator('tbody tr').first();
  await expect(row.getByRole('combobox').first()).toHaveValue('admin');
});

test('ポリシータブでバインディングを追加して保存できる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'IAM', exact: true }).click();
  await page.getByRole('button', { name: 'ポリシー' }).click();

  await page.getByRole('button', { name: '+ バインディング追加' }).click();
  const newRow = page.locator('tbody tr').last();
  await newRow.getByRole('combobox').first().selectOption('viewer');
  await newRow.getByRole('button', { name: '+ プリンシパル追加' }).click();
  await newRow.getByRole('spinbutton').fill('42');

  await page.getByRole('button', { name: '保存する' }).click();

  const savedRow = page.locator('tbody tr').last();
  await expect(savedRow.getByRole('combobox').first()).toHaveValue('viewer');
  await expect(savedRow.getByRole('spinbutton')).toHaveValue('42');
});
