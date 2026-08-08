import { test, expect } from '@playwright/test';

// E2Eサーバーがシードするデータ(e2e_server.go の seedServers を参照):
//   - e2e-poweruser-1: 停止中サーバー(プラン変更・CD-ROM・キー送信・NMI・VNCシナリオ用)
//   - e2e-iso-1:       CD-ROM挿入シナリオ用ISOイメージ
// モックの状態はテスト間で共有されるため、このファイル内のテストは記述順に依存する。

const serverCard = (page: import('@playwright/test').Page, name: string) =>
  page.locator('.card', { has: page.locator('.card-title', { hasText: name }) });

test('サーバー詳細でプランを変更できる', async ({ page }) => {
  await page.goto('/');
  await serverCard(page, 'e2e-poweruser-1').click();
  await expect(page).toHaveURL(/#\/e2e\/servers\//);
  await expect(page.getByRole('heading', { name: /^サーバー詳細: / })).toBeVisible();

  await expect(page.getByText('1 vCPU / 1 GB')).toBeVisible();

  await page.getByRole('button', { name: '変更' }).first().click();
  const spinbuttons = page.getByRole('spinbutton');
  await spinbuttons.nth(0).fill('2');
  await spinbuttons.nth(1).fill('2');
  await page.getByRole('button', { name: '保存する' }).click();

  await expect(page.getByText('2 vCPU / 2 GB')).toBeVisible();
});

test('サーバー詳細でCD-ROMを挿入・排出できる', async ({ page }) => {
  await page.goto('/');
  await serverCard(page, 'e2e-poweruser-1').click();
  await expect(page).toHaveURL(/#\/e2e\/servers\//);
  await expect(page.getByRole('heading', { name: /^サーバー詳細: / })).toBeVisible();

  await expect(page.getByText('(未挿入)')).toBeVisible();

  const cdromCard = page.locator('.card', { hasText: 'CD-ROM' });
  await cdromCard.getByRole('button', { name: '変更' }).click();
  await cdromCard.getByRole('combobox').selectOption({ label: 'e2e-iso-1' });
  await page.getByRole('button', { name: '挿入する' }).click();

  await expect(page.getByText('(未挿入)')).toHaveCount(0);

  await cdromCard.getByRole('button', { name: '変更' }).click();
  await page.getByRole('button', { name: '排出する' }).click();

  await expect(page.getByText('(未挿入)')).toBeVisible();
});

test('サーバー詳細からコンソールキーを送信できる', async ({ page }) => {
  await page.goto('/');
  await serverCard(page, 'e2e-poweruser-1').click();
  await expect(page).toHaveURL(/#\/e2e\/servers\//);
  await expect(page.getByRole('heading', { name: /^サーバー詳細: / })).toBeVisible();

  await page.getByRole('button', { name: 'キーを送信' }).click();

  await expect(page.getByText('を送信しました')).toBeVisible();
});

test('サーバー詳細から確認のうえNMIを送信できる', async ({ page }) => {
  await page.goto('/');
  await serverCard(page, 'e2e-poweruser-1').click();
  await expect(page).toHaveURL(/#\/e2e\/servers\//);
  await expect(page.getByRole('heading', { name: /^サーバー詳細: / })).toBeVisible();

  await page.getByRole('button', { name: 'NMIを送信', exact: true }).click();
  await expect(page.getByText('カーネルパニックを誘発する可能性')).toBeVisible();
  await page.getByRole('button', { name: 'NMIを送信する' }).click();

  await expect(page.getByText('カーネルパニックを誘発する可能性')).toHaveCount(0);
});

test('サーバー詳細でVNC接続情報を取得できる', async ({ page }) => {
  await page.goto('/');
  await serverCard(page, 'e2e-poweruser-1').click();
  await expect(page).toHaveURL(/#\/e2e\/servers\//);
  await expect(page.getByRole('heading', { name: /^サーバー詳細: / })).toBeVisible();

  await page.getByRole('button', { name: '接続情報を取得' }).click();

  await expect(page.getByText('パスワード')).toBeVisible();
});
