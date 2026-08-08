import { test, expect } from '@playwright/test';

// E2Eサーバーはsakumockのオブジェクトストレージテストサーバーを起動する
// (e2e_server.go を参照)。サイトは固定シード3件(isk01/tky01/arc02)。
// S3互換のデータプレーン(オブジェクト一覧・ダウンロード)は外部バイナリ(versitygw)
// 依存でモックできないため、このファイルはバケット/アクセスキー管理のみを対象とする。
// モックの状態はテスト間で共有されるため、このファイル内のテストは記述順に依存する。

test('サイト一覧が表示され、選択するとバケットビューに遷移する', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'オブジェクトストレージ' }).click();

  await expect(page.getByRole('cell', { name: '石狩第1サイト' })).toBeVisible();
  await page.getByRole('row', { name: /石狩第1サイト/ }).click();

  await expect(page.getByRole('heading', { name: '石狩第1サイト' })).toBeVisible();
});

test('アクセスキーを新規作成して保存すると、バケット一覧が取得できる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'オブジェクトストレージ' }).click();
  await page.getByRole('row', { name: /石狩第1サイト/ }).click();

  await page.getByRole('button', { name: '+ 新規作成' }).click();
  await expect(page.getByRole('heading', { name: 'アクセスキーを作成しました' })).toBeVisible();
  await page.getByRole('button', { name: '保存して選択する' }).click();

  await expect(page.getByText('バケットがありません')).toBeVisible();
});

// バケット一覧取得(GetObjectStorageBuckets)は実際のS3互換プロトコル(ListBuckets)を
// 使っており、sakumockはデータプレーンをモックしないため常に接続エラーになる
// (フロント側は空一覧として表示する)。そのため「作成したバケットが一覧に反映される」
// までは検証できず、作成リクエスト自体がエラーなく完了することのみを確認する。
test('バケットを作成できる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'オブジェクトストレージ' }).click();
  await page.getByRole('row', { name: /石狩第1サイト/ }).click();
  // 直前のテストで作成・保存したアクセスキーが選択された状態になっている
  await expect(page.getByText('バケットがありません')).toBeVisible();

  await page.getByRole('button', { name: '+ バケット作成' }).click();
  await page.getByPlaceholder('my-bucket').fill('e2e-created-bucket');
  await page.getByRole('button', { name: '作成する' }).click();

  await expect(page.getByRole('heading', { name: 'バケット作成' })).toHaveCount(0);
});

test('アクセスキーを削除すると選択が解除される', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'オブジェクトストレージ' }).click();
  await page.getByRole('row', { name: /石狩第1サイト/ }).click();
  await expect(page.getByText('バケットがありません')).toBeVisible();

  await page.getByRole('button', { name: 'アクセスキーを削除' }).click();
  await expect(page.getByText(/アクセスキー「.*」を削除しますか？/)).toBeVisible();
  await page.getByRole('button', { name: '削除する' }).click();

  await expect(page.getByRole('button', { name: 'アクセスキーを削除' })).toHaveCount(0, { timeout: 10_000 });
  await expect(page.getByText('アクセスキーを選択してください')).toBeVisible();
});
