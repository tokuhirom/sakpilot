import { test, expect } from '@playwright/test';

// E2Eサーバーがシードするデータ(e2e_server.go の seedNFS を参照):
//   - e2e-nfs-1:      status=up   (電源操作シナリオ用)
//   - e2e-doomed-nfs: status=down (削除シナリオ用)
//   - e2e-edit-nfs:   status=up   (編集シナリオ用)
// スイッチはseedSwitchesが投入するe2e-switch/e2e-doomed-switchを利用する。
// モックの状態はテスト間で共有されるため、このファイル内のテストは記述順に依存する。

const nfsCard = (page: import('@playwright/test').Page, name: string) =>
  page.locator('.card', { has: page.locator('.card-title', { hasText: name }) });

test('シードされたNFSが一覧表示される', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'NFS' }).click();
  await expect(page).toHaveURL(/#\/e2e\/nfs$/);

  await expect(nfsCard(page, 'e2e-nfs-1').locator('.status')).toHaveText('up');
  await expect(nfsCard(page, 'e2e-doomed-nfs').locator('.status')).toHaveText('down');
});

test('起動中のNFSを停止すると、ポーリング後にステータスがdownになる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'NFS' }).click();
  const card = nfsCard(page, 'e2e-nfs-1');
  await expect(card.locator('.status')).toHaveText('up');

  await card.getByRole('button', { name: '⋮' }).click();
  await card.getByRole('button', { name: '停止', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'NFS停止' })).toBeVisible();
  await page.getByRole('button', { name: '停止する' }).click();

  await expect(card.locator('.status')).toHaveText('down', { timeout: 15_000 });
});

test('停止中のNFSを起動すると、ポーリング後にステータスがupになる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'NFS' }).click();
  // 直前のテストでe2e-nfs-1はdownになっている
  const card = nfsCard(page, 'e2e-nfs-1');
  await expect(card.locator('.status')).toHaveText('down');

  await card.getByRole('button', { name: '⋮' }).click();
  await card.getByRole('button', { name: '起動', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'NFS起動' })).toBeVisible();
  await page.getByRole('button', { name: '起動する' }).click();

  await expect(card.locator('.status')).toHaveText('up', { timeout: 15_000 });
});

test('起動中のNFSを再起動できる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'NFS' }).click();
  // 直前のテストでe2e-nfs-1はupになっている
  const card = nfsCard(page, 'e2e-nfs-1');
  await expect(card.locator('.status')).toHaveText('up');

  await card.getByRole('button', { name: '⋮' }).click();
  await card.getByRole('button', { name: '再起動', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'NFS再起動' })).toBeVisible();
  await page.getByRole('button', { name: '再起動する' }).click();

  await expect(card.locator('.status')).toHaveText('up', { timeout: 15_000 });
});

test('停止中のNFSを削除すると一覧から消える', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'NFS' }).click();
  const card = nfsCard(page, 'e2e-doomed-nfs');
  await expect(card.locator('.status')).toHaveText('down');

  await card.getByRole('button', { name: '⋮' }).click();
  await card.getByRole('button', { name: '削除', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'NFS削除' })).toBeVisible();
  await expect(page.getByText('この操作は取り消せません')).toBeVisible();
  await page.getByRole('button', { name: '削除する' }).click();

  await expect(nfsCard(page, 'e2e-doomed-nfs')).toHaveCount(0, { timeout: 10_000 });
  await expect(nfsCard(page, 'e2e-nfs-1')).toHaveCount(1);
});

test('NFSを新規作成すると一覧に表示される', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'NFS' }).click();

  await page.getByRole('button', { name: '+ NFS作成' }).click();
  await page.getByPlaceholder('my-nfs').fill('e2e-created-nfs');
  await page.getByLabel('接続スイッチ').selectOption({ label: 'e2e-switch' });
  await page.getByPlaceholder('例: 192.168.0.11').fill('192.168.0.99');
  await page.getByRole('button', { name: '作成する' }).click();

  await expect(nfsCard(page, 'e2e-created-nfs')).toBeVisible();
});

test('NFS詳細で名前・説明・タグを編集できる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'NFS' }).click();
  await nfsCard(page, 'e2e-edit-nfs').click();
  await expect(page).toHaveURL(/#\/e2e\/nfs\//);
  await expect(page.getByRole('heading', { name: /^NFS詳細: / })).toBeVisible();

  await page.getByRole('button', { name: '編集' }).click();
  await page.getByPlaceholder('任意', { exact: true }).fill('E2Eで編集した説明');
  await page.getByPlaceholder('任意(カンマ区切り、例: env:prod,team:sre)').fill('env:e2e-edited');
  await page.getByRole('button', { name: '保存する' }).click();

  await expect(page.getByText('E2Eで編集した説明')).toBeVisible();
  await expect(page.getByText('env:e2e-edited')).toBeVisible();
});
