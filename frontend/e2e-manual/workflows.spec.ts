import { test, expect } from '@playwright/test';
import { shot } from './helpers';

// docs/manual/workflows.md 用のスクリーンショットを撮影する。
// 通常のE2E回帰テスト(frontend/e2e/workflows.spec.ts)と同じ
// シードデータ(e2e_server.go の seedWorkflows)・操作パターンを流用しているが、
// このファイルはCI(npm run test:e2e)には含まれず、`npm run docs:screenshots`
// (playwright.manual.config.ts、testDir: ./e2e-manual)からのみ実行される。
//
// シードデータ:
//   - サブスクリプション: プラン契約済み
//   - e2e-workflow-1:        表示確認用(リビジョンv2、実行e2e-execution-1あり)
//   - e2e-workflow-doomed:   削除シナリオ用
//   - e2e-workflow-editable: 編集シナリオ用
//
// 1つのtest内で連番のスクリーンショットを撮ることで、番号どおりの操作順序を保証する。

const RESOURCE = 'workflows';

const workflowCard = (page: import('@playwright/test').Page, name: string) =>
  page.locator('.card', { has: page.locator('.card-title', { hasText: name }) });

test('ワークフローマニュアル用スクリーンショット', async ({ page }) => {
  // 01: 一覧画面(サブスクリプション契約状況を含む)
  await page.goto('/');
  await page.getByRole('link', { name: 'ワークフロー' }).click();
  await expect(page).toHaveURL(/#\/e2e\/workflows$/);
  await expect(workflowCard(page, 'e2e-workflow-1')).toBeVisible();
  await shot(page, RESOURCE, '01-list.png');

  // 02: 作成モーダル(入力途中の状態)
  await page.getByRole('button', { name: '+ ワークフロー作成' }).click();
  await page.getByPlaceholder('my-workflow').fill('e2e-manual-workflow');
  await shot(page, RESOURCE, '02-create-modal.png');
  await page.getByRole('button', { name: 'キャンセル' }).click();

  // 03: 詳細画面(基本情報)
  await workflowCard(page, 'e2e-workflow-1').click();
  await expect(page).toHaveURL(/#\/e2e\/workflows\//);
  await expect(page.getByRole('heading', { name: 'ワークフロー詳細: e2e-workflow-1' })).toBeVisible();
  await shot(page, RESOURCE, '03-detail.png');

  // 04: 基本情報編集フォーム(入力途中)
  await page.getByRole('button', { name: '編集', exact: true }).click();
  const descInput = page.locator('.form-group', { has: page.locator('label', { hasText: '説明' }) }).locator('input');
  await descInput.fill('E2Eで編集した説明');
  await shot(page, RESOURCE, '04-edit-basic.png');
  await page.getByRole('button', { name: 'キャンセル' }).click();

  // 05: リビジョンタブ
  await expect(page.getByRole('cell', { name: 'v2' })).toBeVisible();
  await shot(page, RESOURCE, '05-revisions.png');

  // 06: 実行タブ
  await page.getByRole('button', { name: '実行' }).click();
  await expect(page.getByText('Succeeded')).toBeVisible();
  await shot(page, RESOURCE, '06-executions.png');

  // 07: 実行履歴モーダル
  await page.getByRole('button', { name: '履歴' }).click();
  await shot(page, RESOURCE, '07-execution-history.png');
  await page.getByRole('button', { name: '閉じる' }).click();

  // 08: 一覧に戻り、削除確認ダイアログ
  await page.getByRole('link', { name: 'ワークフロー' }).click();
  await expect(page).toHaveURL(/#\/e2e\/workflows$/);
  const doomedCard = workflowCard(page, 'e2e-workflow-doomed');
  await doomedCard.getByRole('button', { name: '削除', exact: true }).click();
  await expect(page.getByText('ワークフロー「e2e-workflow-doomed」を削除しますか？')).toBeVisible();
  await shot(page, RESOURCE, '08-delete-confirm.png');
  await page.getByRole('button', { name: '削除する' }).click();
  await expect(doomedCard).toHaveCount(0, { timeout: 10_000 });
});
