import { test, expect } from '@playwright/test';

// E2Eサーバーがシードするデータ(e2e_server.go の seedDisks を参照):
//   - e2e-disk:             編集シナリオ用
//   - e2e-unconnected-disk: 接続シナリオ用
//   - e2e-connected-disk:   切断シナリオ用(e2e-web-1に接続済み)
//   - e2e-doomed-disk:      削除シナリオ用
// サーバーはseedServersが投入する e2e-web-1 を使う。
// モックの状態はテスト間で共有されるため、このファイル内のテストは記述順に依存する。

const diskCard = (page: import('@playwright/test').Page, name: string) =>
  page.locator('.card', { hasText: name });

test('シードされたディスクが一覧表示される', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'ディスク' }).click();
  await expect(page).toHaveURL(/#\/e2e\/disks$/);

  await expect(diskCard(page, 'e2e-disk')).toBeVisible();
  await expect(diskCard(page, 'e2e-connected-disk')).toBeVisible();
  await expect(diskCard(page, 'e2e-doomed-disk')).toBeVisible();
});

test('ディスクを新規作成すると一覧に表示される', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'ディスク' }).click();

  await page.getByRole('button', { name: '+ ディスク作成' }).click();
  await page.getByPlaceholder('my-disk').fill('e2e-created-disk');
  await page.getByPlaceholder('任意', { exact: true }).fill('E2Eで作成');
  await page.getByRole('button', { name: '作成する' }).click();

  await expect(diskCard(page, 'e2e-created-disk')).toBeVisible();
});

test('ディスク詳細で名前・説明・タグを編集できる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'ディスク' }).click();
  await diskCard(page, 'e2e-disk').click();
  await expect(page).toHaveURL(/#\/e2e\/disks\//);

  await page.getByRole('button', { name: '編集' }).click();
  await page.getByPlaceholder('カンマ区切り(任意)').fill('e2e-edited-tag');
  await page.getByRole('button', { name: '保存する' }).click();

  await expect(page.getByText('e2e-edited-tag')).toBeVisible();
});

test('ディスクを接続先サーバーに接続できる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'ディスク' }).click();
  await diskCard(page, 'e2e-unconnected-disk').click();
  await expect(page).toHaveURL(/#\/e2e\/disks\//);

  await expect(page.getByText('(未接続)')).toBeVisible();

  await page.getByRole('button', { name: '変更' }).click();
  const connectionCard = page.locator('.card', { hasText: '接続先サーバー' });
  await connectionCard.getByRole('combobox').selectOption({ label: 'e2e-web-1' });
  await page.getByRole('button', { name: '接続する' }).click();

  await expect(page.getByText('e2e-web-1')).toBeVisible();
});

test('ディスクをサーバーから切断できる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'ディスク' }).click();
  await diskCard(page, 'e2e-connected-disk').click();
  await expect(page).toHaveURL(/#\/e2e\/disks\//);

  await expect(page.getByText('e2e-web-1')).toBeVisible();

  await page.getByRole('button', { name: '変更' }).click();
  await page.getByRole('button', { name: '接続を解除する' }).click();

  await expect(page.getByText('(未接続)')).toBeVisible();
});

test('ディスクを削除すると一覧から消える', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'ディスク' }).click();

  await diskCard(page, 'e2e-doomed-disk').getByRole('button', { name: '削除' }).click();

  await expect(page.getByText('ディスク「e2e-doomed-disk」を削除しますか？')).toBeVisible();
  await page.getByRole('button', { name: '削除する' }).click();

  await expect(diskCard(page, 'e2e-doomed-disk')).toHaveCount(0, { timeout: 10_000 });
  await expect(diskCard(page, 'e2e-disk')).toBeVisible();
});
