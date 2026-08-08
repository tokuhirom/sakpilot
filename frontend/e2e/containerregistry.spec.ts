import { test, expect } from '@playwright/test';

// E2Eサーバーがシードするデータ(e2e_server.go の seedContainerRegistries を参照):
//   - e2e-registry-target: 基本情報編集・ユーザー管理シナリオ用
//   - e2e-doomed-registry: 削除シナリオ用
// モックの状態はテスト間で共有されるため、このファイル内のテストは記述順に依存する。

const registryRow = (page: import('@playwright/test').Page, name: string) =>
  page.locator('tr', { hasText: name });

test('シードされたコンテナレジストリが一覧表示される', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'コンテナレジストリ' }).click();
  await expect(page).toHaveURL(/#\/e2e\/container-registry$/);

  await expect(registryRow(page, 'e2e-registry-target')).toBeVisible();
  await expect(registryRow(page, 'e2e-doomed-registry')).toBeVisible();
});

test('コンテナレジストリを新規作成すると一覧に表示される', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'コンテナレジストリ' }).click();

  await page.getByRole('button', { name: '+ レジストリ作成' }).click();
  await page.getByPlaceholder('my-registry').fill('e2e-created-registry');
  await page.getByRole('button', { name: '作成する' }).click();

  await expect(registryRow(page, 'e2e-created-registry')).toBeVisible();
});

test('コンテナレジストリ詳細で基本情報とユーザーを編集できる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'コンテナレジストリ' }).click();
  await registryRow(page, 'e2e-registry-target').click();
  await expect(page).toHaveURL(/#\/e2e\/container-registry\//);
  await expect(page.getByRole('heading', { name: /^コンテナレジストリ詳細: / })).toBeVisible();

  // 基本情報の編集
  await page.getByRole('button', { name: '編集' }).click();
  await page.locator('.form-group', { hasText: '説明' }).locator('input').fill('E2Eで編集済み');
  await page.getByRole('button', { name: '保存する' }).click();
  await expect(page.getByText('E2Eで編集済み')).toBeVisible();

  // ユーザー追加
  await page.getByRole('button', { name: '+ ユーザー追加' }).click();
  await page.locator('.form-group', { hasText: 'ユーザー名' }).locator('input').fill('e2e-user');
  await page.locator('.form-group', { hasText: 'パスワード' }).locator('input').fill('e2e-password');
  await page.getByRole('button', { name: '追加する' }).click();
  await expect(page.getByText('e2e-user')).toBeVisible();

  // ユーザー編集(権限変更)
  const userRow = page.locator('tr', { hasText: 'e2e-user' });
  await userRow.getByRole('button', { name: 'ユーザー編集' }).click();
  await userRow.locator('select').selectOption('readonly');
  await userRow.getByRole('button', { name: '保存' }).click();
  await expect(userRow.getByText('読み取り専用')).toBeVisible();

  // ユーザー削除
  await userRow.getByRole('button', { name: 'ユーザー削除' }).click();
  await expect(page.getByText('ユーザー「e2e-user」を削除しますか？')).toBeVisible();
  await page.getByRole('button', { name: '削除する' }).click();
  await expect(page.getByText('e2e-user')).toHaveCount(0, { timeout: 10_000 });
});

test('コンテナレジストリを削除すると一覧から消える', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'コンテナレジストリ' }).click();

  await registryRow(page, 'e2e-doomed-registry').getByRole('button', { name: '削除' }).click();

  await expect(page.getByText('コンテナレジストリ「e2e-doomed-registry」を削除しますか？')).toBeVisible();
  await page.getByRole('button', { name: '削除する' }).click();

  await expect(registryRow(page, 'e2e-doomed-registry')).toHaveCount(0, { timeout: 10_000 });
  await expect(registryRow(page, 'e2e-registry-target')).toBeVisible();
});
