import { test, expect } from '@playwright/test';

// E2Eサーバーがシードするデータ(e2e_server.go の seedServers を参照):
//   - e2e-web-1:    status=up   (電源操作シナリオ用)
//   - e2e-doomed-1: status=down (削除シナリオ用)
// モックの状態はテスト間で共有されるため、このファイル内のテストは記述順に依存する。

const serverCard = (page: import('@playwright/test').Page, name: string) =>
  page.locator('.card', { has: page.locator('.card-title', { hasText: name }) });

test('シードされたサーバーが一覧表示される', async ({ page }) => {
  await page.goto('/');

  // プロファイル"e2e"のサーバー一覧に自動遷移する
  await expect(page).toHaveURL(/#\/e2e\/servers$/);

  await expect(serverCard(page, 'e2e-web-1').locator('.status')).toHaveText('up');
  await expect(serverCard(page, 'e2e-doomed-1').locator('.status')).toHaveText('down');
  await expect(page.getByText('192.0.2.1')).toBeVisible();
});

test('起動中のサーバーを停止すると、ポーリング後にステータスがdownになる', async ({ page }) => {
  await page.goto('/');
  const card = serverCard(page, 'e2e-web-1');
  await expect(card.locator('.status')).toHaveText('up');

  await card.getByRole('button', { name: '⋮' }).click();
  await card.getByRole('button', { name: '停止', exact: true }).click();

  // 確認ダイアログ
  await expect(page.getByRole('heading', { name: 'サーバー停止' })).toBeVisible();
  await page.getByRole('button', { name: '停止する' }).click();

  // fakeドライバが電源遷移を完了し、2秒間隔のポーリングが検知するまで待つ
  await expect(card.locator('.status')).toHaveText('down', { timeout: 15_000 });
});

test('停止中のサーバーを削除すると一覧から消える', async ({ page }) => {
  await page.goto('/');
  const card = serverCard(page, 'e2e-doomed-1');
  await expect(card.locator('.status')).toHaveText('down');

  await card.getByRole('button', { name: '⋮' }).click();
  await card.getByRole('button', { name: '削除', exact: true }).click();

  // 確認ダイアログ(取り消し不可の警告つき)
  await expect(page.getByRole('heading', { name: 'サーバー削除' })).toBeVisible();
  await expect(page.getByText('この操作は取り消せません')).toBeVisible();
  await page.getByRole('button', { name: '削除する' }).click();

  await expect(serverCard(page, 'e2e-doomed-1')).toHaveCount(0, { timeout: 10_000 });
  // 他のサーバーは残っている
  await expect(serverCard(page, 'e2e-web-1')).toHaveCount(1);
});
