import { test, expect } from '@playwright/test';
import { shot } from './helpers';

// docs/manual/simplemonitor.md 用のスクリーンショットを撮影する。
// 通常のE2E回帰テスト(frontend/e2e/simplemonitor.spec.ts)と同じ
// シードデータ(e2e_server.go の seedSimpleMonitors)・操作パターンを流用しているが、
// このファイルはCI(npm run test:e2e)には含まれず、`npm run docs:screenshots`
// (playwright.manual.config.ts、testDir: ./e2e-manual)からのみ実行される。
//
// シードデータ:
//   - e2e-monitor-target.example.com: 設定編集シナリオ用
//   - e2e-doomed-monitor.example.com: 削除シナリオ用
//
// 1つのtest内で連番のスクリーンショットを撮ることで、番号どおりの操作順序を保証する。

const RESOURCE = 'simplemonitor';

const monitorRow = (page: import('@playwright/test').Page, name: string) =>
  page.locator('tr', { hasText: name });

test('シンプル監視マニュアル用スクリーンショット', async ({ page }) => {
  // 01: 一覧画面
  await page.goto('/');
  await page.getByRole('link', { name: 'シンプル監視' }).click();
  await expect(page).toHaveURL(/#\/e2e\/monitors$/);
  await expect(monitorRow(page, 'e2e-monitor-target.example.com')).toBeVisible();
  await shot(page, RESOURCE, '01-list.png');

  // 02: 作成モーダル(入力途中の状態)
  await page.getByRole('button', { name: '+ 監視作成' }).click();
  await page.getByPlaceholder('example.com').fill('e2e-manual-example.example.com');
  await shot(page, RESOURCE, '02-create-modal.png');
  await page.getByRole('button', { name: 'キャンセル' }).click();

  // 03: 詳細画面
  await monitorRow(page, 'e2e-monitor-target.example.com').click();
  await expect(page).toHaveURL(/#\/e2e\/monitors\//);
  await expect(page.getByRole('heading', { name: /^シンプル監視詳細: / })).toBeVisible();
  await shot(page, RESOURCE, '03-detail.png');

  // 04: 監視設定の編集フォーム(入力途中)
  await page.getByRole('button', { name: '監視設定を編集' }).click();
  await page.locator('.form-group', { hasText: 'チェック間隔(秒)' }).locator('input').fill('120');
  await shot(page, RESOURCE, '04-edit-settings.png');
  await page.getByRole('button', { name: '保存する' }).click();
  await expect(page.getByText('120秒')).toBeVisible();

  // 05: 説明の編集フォーム(入力途中)
  await page.getByRole('button', { name: '編集', exact: true }).click();
  await page.locator('tr', { hasText: '説明' }).locator('input').fill('E2Eで編集した説明');
  await shot(page, RESOURCE, '05-edit-basic.png');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByText('E2Eで編集した説明')).toBeVisible();

  // 06: 一覧に戻り、削除確認ダイアログ
  await page.getByRole('link', { name: 'シンプル監視' }).click();
  await expect(page).toHaveURL(/#\/e2e\/monitors$/);
  await monitorRow(page, 'e2e-doomed-monitor.example.com').getByRole('button', { name: '削除' }).click();
  await expect(page.getByText('シンプル監視「e2e-doomed-monitor.example.com」を削除しますか？')).toBeVisible();
  await shot(page, RESOURCE, '06-delete-confirm.png');
  await page.getByRole('button', { name: '削除する' }).click();
  await expect(monitorRow(page, 'e2e-doomed-monitor.example.com')).toHaveCount(0, { timeout: 10_000 });
});
