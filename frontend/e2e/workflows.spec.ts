import { test, expect } from '@playwright/test';

// E2Eサーバーがsakumock workflowsにシードするデータ(e2e_server.go の seedWorkflows を参照):
//   - サブスクリプション: プラン契約済み(ListPlansの先頭プラン)
//   - e2e-workflow-1:        表示確認用(リビジョンv2、実行e2e-execution-1あり)
//   - e2e-workflow-doomed:   削除シナリオ用
//   - e2e-workflow-editable: 編集シナリオ用

const workflowCard = (page: import('@playwright/test').Page, name: string) =>
  page.locator('.card', { has: page.locator('.card-title', { hasText: name }) });

test('シードされたワークフローが一覧表示される', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'ワークフロー' }).click();
  await expect(page).toHaveURL(/#\/e2e\/workflows$/);

  await expect(workflowCard(page, 'e2e-workflow-1')).toBeVisible();
  await expect(page.getByText(/プラン: /)).toBeVisible();
});

test('ワークフローを作成すると一覧に追加される', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'ワークフロー' }).click();

  await page.getByRole('button', { name: '+ ワークフロー作成' }).click();
  await page.getByPlaceholder('my-workflow').fill('e2e-created-workflow');
  await page.getByRole('button', { name: '作成する' }).click();

  await expect(workflowCard(page, 'e2e-created-workflow')).toBeVisible();
});

test('ワークフロー詳細で基本情報を編集できる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'ワークフロー' }).click();
  await workflowCard(page, 'e2e-workflow-editable').click();
  await expect(page).toHaveURL(/#\/e2e\/workflows\//);
  await expect(page.getByRole('heading', { name: 'ワークフロー詳細: e2e-workflow-editable' })).toBeVisible();

  await page.getByRole('button', { name: '編集', exact: true }).click();
  const nameInput = page.locator('.form-group', { has: page.locator('label', { hasText: '名前' }) }).locator('input');
  await nameInput.fill('e2e-workflow-editable-renamed');
  await page.getByRole('button', { name: '保存する' }).click();

  await expect(page.getByText('ワークフロー詳細: e2e-workflow-editable-renamed')).toBeVisible();
});

test('ワークフローを削除すると一覧から消える', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'ワークフロー' }).click();

  const card = workflowCard(page, 'e2e-workflow-doomed');
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: '削除', exact: true }).click();

  await expect(page.getByText('ワークフロー「e2e-workflow-doomed」を削除しますか？')).toBeVisible();
  await page.getByRole('button', { name: '削除する' }).click();

  await expect(workflowCard(page, 'e2e-workflow-doomed')).toHaveCount(0, { timeout: 10_000 });
});

test('リビジョンタブに切り替えると一覧表示され、新規リビジョンを作成できる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'ワークフロー' }).click();
  await workflowCard(page, 'e2e-workflow-1').click();
  await expect(page.getByRole('heading', { name: 'ワークフロー詳細: e2e-workflow-1' })).toBeVisible();

  await expect(page.getByRole('cell', { name: 'v2' })).toBeVisible();

  await page.getByRole('button', { name: '+ リビジョン作成' }).click();
  await page.getByRole('button', { name: '作成する' }).click();

  await expect(page.getByRole('cell', { name: '3', exact: true })).toBeVisible();
});

test('実行タブに切り替えると一覧表示され、キャンセル・削除できる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'ワークフロー' }).click();
  await workflowCard(page, 'e2e-workflow-1').click();
  await expect(page.getByRole('heading', { name: 'ワークフロー詳細: e2e-workflow-1' })).toBeVisible();

  await page.getByRole('button', { name: '実行' }).click();
  await expect(page.getByText('Succeeded')).toBeVisible();

  const row = page.locator('tr', { has: page.getByText('Succeeded') }).first();
  await row.getByRole('button', { name: '削除' }).click();
  await expect(page.getByText(/を削除しますか？/)).toBeVisible();
  await page.getByRole('button', { name: '削除する' }).click();

  await expect(page.getByText('実行履歴がありません')).toBeVisible({ timeout: 10_000 });
});

test('実行タブから新規実行できる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'ワークフロー' }).click();
  await workflowCard(page, 'e2e-workflow-1').click();
  await expect(page.getByRole('heading', { name: 'ワークフロー詳細: e2e-workflow-1' })).toBeVisible();

  await page.getByRole('button', { name: '実行' }).click();
  await page.getByRole('button', { name: '+ 実行する' }).click();
  await page.getByRole('button', { name: '実行する', exact: true }).click();

  await expect(page.getByText('Succeeded').first()).toBeVisible();
});
