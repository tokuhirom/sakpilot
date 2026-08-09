import { defineConfig, devices } from '@playwright/test';

// ユーザーマニュアル(docs/manual/)用のスクリーンショット撮影専用設定。
// `npm run test:e2e`(CI用回帰テスト、playwright.config.ts)とは責務を分離する:
//   - testDir が異なる(./e2e-manual)ため、CIの `playwright test` 実行には含まれない
//   - retries/trace等のCI向け設定を持たない(失敗時はコンソールログで十分)
//   - ビューポートを1280x800に固定し、マニュアル画像のサイズを揃える
//
// webServer/baseURLは playwright.config.ts と同じE2Eサーバー
// (`go run -tags e2e .`、docs/adr/0001-e2e-testing-strategy.md参照)を流用する。
//
// 実行方法: `cd frontend && npm run docs:screenshots`
export default defineConfig({
  testDir: './e2e-manual',
  timeout: 30_000,
  // シードデータの状態を共有するテストがあるため直列実行する(playwright.config.tsに合わせる)
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:34199',
    ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 800 },
  },
  webServer: {
    command: 'cd .. && go run -tags e2e .',
    url: 'http://127.0.0.1:34199',
    reuseExistingServer: true,
    timeout: 120_000,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 },
  },
});
