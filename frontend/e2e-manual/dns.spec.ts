import { test, expect } from '@playwright/test';
import { shot } from './helpers';

// docs/manual/dns.md 用のスクリーンショットを撮影する。
// 通常のE2E回帰テスト(frontend/e2e/dns.spec.ts)と同じシードデータ・操作パターンを
// 流用しているが、このファイルはCI(npm run test:e2e)には含まれず、
// `npm run docs:screenshots`(playwright.manual.config.ts、testDir: ./e2e-manual)
// からのみ実行される。
//
// シードデータ(e2e_server.go の seedDNS):
//   - e2e-example.com: wwwレコード(A)を1件持つ(詳細・レコード操作シナリオ用)
//   - e2e-doomed.com:  レコードなし(一覧に複数ゾーンがある状態を見せるためだけに使用)
//
// DNSではゾーン名(Name)とゾーン(Zone)列に同じ文字列が表示されるため、
// テキスト一致ではなく行(tr)単位でロケーターを組み立てる。
//
// 1つのtest内で連番のスクリーンショットを撮ることで、番号どおりの操作順序を保証する。

const RESOURCE = 'dns';

const dnsRow = (page: import('@playwright/test').Page, name: string) =>
  page.locator('tr', { hasText: name });

test('DNSマニュアル用スクリーンショット', async ({ page }) => {
  // 01: 一覧画面
  await page.goto('/');
  await page.getByRole('link', { name: 'DNS' }).click();
  await expect(page).toHaveURL(/#\/e2e\/dns$/);
  await expect(dnsRow(page, 'e2e-example.com')).toBeVisible();
  await expect(dnsRow(page, 'e2e-doomed.com')).toBeVisible();
  await shot(page, RESOURCE, '01-list.png');

  // 02: ゾーン作成モーダル(入力途中)
  await page.getByRole('button', { name: '+ ゾーン作成' }).click();
  await page.getByPlaceholder('example.com').fill('manual-example.jp');
  await page.getByPlaceholder('任意').fill('マニュアル用サンプルゾーン');
  await shot(page, RESOURCE, '02-create-zone.png');
  await page.getByRole('button', { name: 'キャンセル' }).click();

  // 03: ゾーン詳細画面(シードされたwwwレコードを持つゾーン)
  await dnsRow(page, 'e2e-example.com').click();
  await expect(page).toHaveURL(/#\/e2e\/dns\//);
  await expect(page.getByRole('heading', { name: /^DNS詳細: / })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'www', exact: true })).toBeVisible();
  await shot(page, RESOURCE, '03-detail.png');

  // 04: レコード追加フォーム(入力途中)
  await page.getByRole('button', { name: '+ レコード追加' }).click();
  await page.getByPlaceholder('www (@はゾーン自身)').fill('api');
  await page.getByPlaceholder('192.0.2.1').fill('192.0.2.20');
  await shot(page, RESOURCE, '04-record-add.png');
  await page.getByRole('button', { name: '保存する' }).click();
  await expect(page.getByRole('cell', { name: 'api', exact: true })).toBeVisible();

  // 05: レコード編集フォーム(入力途中)
  const apiRow = page.locator('tr', { has: page.getByRole('cell', { name: 'api', exact: true }) });
  await apiRow.getByRole('button', { name: '編集' }).click();
  await page.getByPlaceholder('192.0.2.1').fill('192.0.2.99');
  await shot(page, RESOURCE, '05-record-edit.png');
  await page.getByRole('button', { name: '保存する' }).click();
  await expect(page.getByRole('cell', { name: '192.0.2.99', exact: true })).toBeVisible();

  // 06: レコード削除確認ダイアログ
  const editedRow = page.locator('tr', { has: page.getByRole('cell', { name: 'api', exact: true }) });
  await editedRow.getByRole('button', { name: '削除' }).click();
  await expect(page.getByText('レコード「api」(A)を削除しますか？')).toBeVisible();
  await shot(page, RESOURCE, '06-record-delete-confirm.png');
  await page.getByRole('button', { name: '削除する' }).click();
  await expect(page.getByRole('cell', { name: 'api', exact: true })).toHaveCount(0, { timeout: 10_000 });
});
