import { test, expect } from '@playwright/test';
import { shot } from './helpers';

// docs/manual/elb.md 用のスクリーンショットを撮影する。
// 通常のE2E回帰テスト(frontend/e2e/proxylb.spec.ts)と同じ
// シードデータ(e2e_server.go の seedProxyLBs)・操作パターンを流用しているが、
// このファイルはCI(npm run test:e2e)には含まれず、`npm run docs:screenshots`
// (playwright.manual.config.ts、testDir: ./e2e-manual)からのみ実行される。
//
// シードデータ:
//   - e2e-elb:        証明書管理シナリオ用(サーバー1台登録済み)
//   - e2e-doomed-elb: 削除シナリオ用
// ELBは一覧・詳細が同一コンポーネント内の状態切り替えで実装されており、URLは
// 常に #/e2e/elb のままのため、詳細から一覧に戻る際はサイドバーリンクではなく
// 詳細画面の「← 戻る」ボタンを使う必要がある。
//
// 1つのtest内で連番のスクリーンショットを撮ることで、番号どおりの操作順序を保証する。

const RESOURCE = 'elb';

const card = (page: import('@playwright/test').Page, name: string) =>
  page.locator('.card', { has: page.locator('.card-title', { hasText: name }) });

test('ELBマニュアル用スクリーンショット', async ({ page }) => {
  // 01: 一覧画面
  await page.goto('/');
  await page.getByRole('link', { name: 'ELB' }).click();
  await expect(page).toHaveURL(/#\/e2e\/elb$/);
  await expect(card(page, 'e2e-elb')).toBeVisible();
  await shot(page, RESOURCE, '01-list.png');

  // 02: 作成モーダル(入力途中の状態)
  await page.getByRole('button', { name: '+ ELB作成' }).click();
  await page.getByPlaceholder('my-elb').fill('e2e-manual-example');
  await shot(page, RESOURCE, '02-create-modal.png');
  await page.getByRole('button', { name: 'キャンセル' }).click();

  // 03: 詳細画面(基本情報・待ち受けポート・実サーバー)
  await card(page, 'e2e-elb').click();
  await expect(page.getByRole('heading', { name: '基本情報' })).toBeVisible();
  await shot(page, RESOURCE, '03-detail.png');

  // 04: ヘルスステータス・トラフィックグラフ
  await page.getByRole('heading', { name: 'ヘルスステータス' }).scrollIntoViewIfNeeded();
  await expect(page.getByRole('heading', { name: 'トラフィックグラフ' })).toBeVisible();
  await shot(page, RESOURCE, '04-health-traffic.png');

  // 05: プラン変更フォーム
  await page.getByRole('button', { name: 'プラン変更' }).click();
  await page.getByLabel('プラン').selectOption('500');
  await shot(page, RESOURCE, '05-change-plan.png');
  await page.getByRole('button', { name: '変更する' }).click();
  await expect(page.getByText('500 CPS')).toBeVisible();

  // 06: 名前・説明の編集フォーム(入力途中)
  await page.getByRole('button', { name: '編集', exact: true }).click();
  await page.getByPlaceholder('説明').fill('E2Eマニュアル撮影用の説明');
  await shot(page, RESOURCE, '06-edit-basic.png');
  await page.getByRole('button', { name: '保存' }).click();
  await expect(page.getByText('e2e-elb / E2Eマニュアル撮影用の説明')).toBeVisible();

  // 07: 待ち受けポート・実サーバーの編集フォーム(入力途中)
  await page.getByRole('button', { name: '設定を編集' }).click();
  await page.getByRole('button', { name: '+ ポート追加' }).click();
  await page.getByRole('button', { name: '+ サーバー追加' }).click();
  await page.getByPlaceholder('IPアドレス *').last().fill('192.0.2.50');
  await shot(page, RESOURCE, '07-edit-settings.png');
  await page.getByRole('button', { name: '保存する' }).click();
  await expect(page.getByText('192.0.2.50')).toBeVisible();

  // 08: 一覧に戻り、削除確認ダイアログ
  await page.getByRole('button', { name: '← 戻る' }).click();
  await expect(card(page, 'e2e-elb')).toBeVisible();
  await card(page, 'e2e-doomed-elb').click();
  await page.getByRole('button', { name: '削除', exact: true }).click();
  await expect(page.getByText('ELB「e2e-doomed-elb」を削除しますか？')).toBeVisible();
  await shot(page, RESOURCE, '08-delete-confirm.png');
  await page.getByRole('button', { name: '削除する' }).click();
  await expect(page.getByText('エンハンスドロードバランサ (ELB)')).toBeVisible({ timeout: 10_000 });
  await expect(card(page, 'e2e-doomed-elb')).toHaveCount(0);
});
