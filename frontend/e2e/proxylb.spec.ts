import { test, expect } from '@playwright/test';

// E2Eサーバーがシードするデータ(e2e_server.go の seedProxyLBs を参照):
//   - e2e-elb:        証明書管理シナリオ用(サーバー1台登録済み)
//   - e2e-doomed-elb: 削除シナリオ用
// モックの状態はテスト間で共有されるため、このファイル内のテストは記述順に依存する。

const card = (page: import('@playwright/test').Page, name: string) =>
  page.locator('.card', { has: page.locator('.card-title', { hasText: name }) });

test('シードされたELBが一覧表示される', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'ELB' }).click();
  await expect(page).toHaveURL(/#\/e2e\/elb$/);

  await expect(card(page, 'e2e-elb')).toBeVisible();
  await expect(card(page, 'e2e-doomed-elb')).toBeVisible();
});

test('ELB詳細でヘルスステータスが確認できる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'ELB' }).click();
  await card(page, 'e2e-elb').click();

  await expect(page.getByRole('heading', { name: 'ヘルスステータス' })).toBeVisible();
  await expect(page.getByText('現在のVIP:')).toBeVisible();
});

// SSL証明書の設定(SetCertificates)はIaaS fakeドライバ(sacloud-sdk-go)側のバグにより
// E2E化できない: fakeの実装が `copySameNameField` でリクエストの `PrimaryCerts`
// フィールドを結果側の `PrimaryCert` にコピーしようとするが、フィールド名の単数/複数が
// 一致せずコピーに失敗し、その後 `cert.PrimaryCert.CertificateCommonName = ...` で
// nilポインタ参照によりpanicする(sakpilot側の呼び出しコードは正しい実装で、SDKが
// 定義するフィールド名をそのまま使っている)。証明書を更新/削除するUIも
// primaryCertが存在する場合にのみ表示されるため、この経路のE2E化は現状不可能。
// Goの単体テストレベルでは影響を受けないため、`ProxyLBList.test.tsx`(vitest、
// バインディングをモック)で引き続きカバーする。

test('ELBを削除すると一覧から消える', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'ELB' }).click();
  await card(page, 'e2e-doomed-elb').click();

  await page.getByRole('button', { name: '削除', exact: true }).click();
  await expect(page.getByText('ELB「e2e-doomed-elb」を削除しますか？')).toBeVisible();
  await page.getByRole('button', { name: '削除する' }).click();

  await expect(page.getByText('エンハンスドロードバランサ (ELB)')).toBeVisible({ timeout: 10_000 });
  await expect(card(page, 'e2e-doomed-elb')).toHaveCount(0);
  await expect(card(page, 'e2e-elb')).toBeVisible();
});
