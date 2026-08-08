import { defineConfig, devices } from '@playwright/test';

// E2Eテストは `go run -tags e2e .` で起動するE2Eサーバー(HTTP JSON-RPCブリッジ +
// frontend/dist配信 + IaaS fake/sakumockモック)に対してheadless Chromiumで実行する。
// 詳細は docs/adr/0001-e2e-testing-strategy.md を参照。
//
// サーバープロセスは1回のテスト実行で共有され、シードデータへの破壊的操作
// (削除など)はテスト間で残る。シナリオごとに専用のシードリソースを使うこと。
//
// E2E_COVERAGE=1 を設定すると、Goバックエンド(app.go/internal/sakura等)の
// カバレッジ計装ビルドでE2Eサーバーを起動する(`npm run test:e2e:coverage` 参照)。
// リポジトリルート直下の `covdata/` にプロファイルが出力される。
const coverage = !!process.env.E2E_COVERAGE;

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  // モックの状態(削除・電源操作)を共有するため直列実行する
  workers: 1,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:34199',
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: coverage
      ? 'cd .. && rm -rf covdata && mkdir -p covdata && GOCOVERDIR=covdata go run -cover -covermode=atomic -tags e2e .'
      : 'cd .. && go run -tags e2e .',
    url: 'http://127.0.0.1:34199',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // デフォルトはプロセスグループへ即SIGKILLするため、カバレッジ計装ビルド
    // (e2e_server.goのSIGTERMハンドラでカバレッジをフラッシュしてから終了する)
    // が確実に動くようSIGTERMでの正常終了を待つ。
    gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 },
  },
});
