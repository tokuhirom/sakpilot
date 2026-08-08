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

test('ELB詳細でプランを変更できる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'ELB' }).click();
  await card(page, 'e2e-elb').click();

  await expect(page.getByText('100 CPS')).toBeVisible();
  await page.getByRole('button', { name: 'プラン変更' }).click();
  await page.getByLabel('プラン').selectOption('500');
  await page.getByRole('button', { name: '変更する' }).click();

  await expect(page.getByText('500 CPS')).toBeVisible();
});

test('ELB詳細でトラフィックグラフが表示される', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'ELB' }).click();
  await card(page, 'e2e-elb').click();

  const trafficCard = page.locator('.card', { has: page.getByRole('heading', { name: 'トラフィックグラフ' }) });
  await expect(trafficCard).toBeVisible();
  await expect(trafficCard.locator('.u-legend')).toContainText('アクティブ接続');
});

test('ELBを新規作成すると一覧に表示される', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'ELB' }).click();

  await page.getByRole('button', { name: '+ ELB作成' }).click();
  await page.getByPlaceholder('my-elb').fill('e2e-created-elb');
  await page.getByRole('button', { name: '作成する' }).click();

  await expect(card(page, 'e2e-created-elb')).toBeVisible();
});

test('ELB詳細で名前・説明を編集できる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'ELB' }).click();
  await card(page, 'e2e-elb').click();

  await page.getByRole('button', { name: '編集', exact: true }).click();
  await page.getByPlaceholder('名前').fill('e2e-elb-renamed');
  await page.getByPlaceholder('説明').fill('E2Eで編集');
  await page.getByRole('button', { name: '保存' }).click();

  await expect(page.getByText('e2e-elb-renamed / E2Eで編集')).toBeVisible();
});

test('ELB詳細で待ち受けポート・実サーバーを編集できる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'ELB' }).click();
  await card(page, 'e2e-created-elb').click();

  await page.getByRole('button', { name: '設定を編集' }).click();
  await page.getByRole('button', { name: '+ ポート追加' }).click();
  await page.getByRole('button', { name: '+ サーバー追加' }).click();
  await page.getByPlaceholder('IPアドレス').fill('192.0.2.50');
  await page.getByRole('button', { name: '保存する' }).click();

  await expect(page.getByText('192.0.2.50')).toBeVisible();
  await expect(page.getByText('HTTP', { exact: true })).toBeVisible();
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
