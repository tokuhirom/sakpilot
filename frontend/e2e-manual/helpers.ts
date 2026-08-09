import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';

// docs/manual/images/<resource>/ 配下にスクリーンショットを保存するヘルパー。
// リポジトリルート = このファイル(frontend/e2e-manual/helpers.ts)から2階層上。
// package.jsonが"type": "module"のため__dirnameが使えず、import.meta.urlから導出する。
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');

export function imagesDir(resource: string): string {
  return path.join(REPO_ROOT, 'docs', 'manual', 'images', resource);
}

// 連番+内容が分かるファイル名(例: 01-list.png)でビューポートスクリーンショットを撮る。
// フルページではなくビューポート単位(デフォルト)で撮ることでファイルサイズを抑える。
export async function shot(page: Page, resource: string, filename: string): Promise<void> {
  await page.screenshot({ path: path.join(imagesDir(resource), filename) });
}
