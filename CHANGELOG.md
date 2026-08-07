# Changelog

## [v0.0.16](https://github.com/tokuhirom/sakpilot/compare/v0.0.15...v0.0.16) - 2026-08-07
- add disk deletion feature by @tokuhirom in https://github.com/tokuhirom/sakpilot/pull/71
- fix: サイドバーの表示崩れを修正(ウィンドウ高さを超える場合) by @tokuhirom in https://github.com/tokuhirom/sakpilot/pull/72
- add HTTP access log for Sakura Cloud API calls by @tokuhirom in https://github.com/tokuhirom/sakpilot/pull/74
- add NFS appliance support by @tokuhirom in https://github.com/tokuhirom/sakpilot/pull/75
- add Vitest + React Testing Library test framework for frontend by @tokuhirom in https://github.com/tokuhirom/sakpilot/pull/76
- docs: フロントエンドテストの方針をCLAUDE.mdに追記 by @tokuhirom in https://github.com/tokuhirom/sakpilot/pull/77
- 全リソースのテスト/機能ギャップ精査 PLAN.md を追加 by @tokuhirom in https://github.com/tokuhirom/sakpilot/pull/78
- 石狩第3ゾーン(is1c)をゾーン一覧に追加 by @tokuhirom in https://github.com/tokuhirom/sakpilot/pull/79
- feat: サーバー/NFSに再起動(Reset)機能を追加 by @tokuhirom in https://github.com/tokuhirom/sakpilot/pull/80
- feat: データベースアプライアンスに電源操作・削除機能を追加 by @tokuhirom in https://github.com/tokuhirom/sakpilot/pull/81
- feat: スイッチに削除機能を追加 by @tokuhirom in https://github.com/tokuhirom/sakpilot/pull/82
- feat: パケットフィルターに削除機能を追加 by @tokuhirom in https://github.com/tokuhirom/sakpilot/pull/83
- feat: DNSゾーンに削除機能を追加 by @tokuhirom in https://github.com/tokuhirom/sakpilot/pull/84
- feat: シンプル監視に削除機能を追加 by @tokuhirom in https://github.com/tokuhirom/sakpilot/pull/86
- feat: エンハンスドDBに削除機能を追加 by @tokuhirom in https://github.com/tokuhirom/sakpilot/pull/87
- feat: エンハンスドロードバランサに削除機能を追加 by @tokuhirom in https://github.com/tokuhirom/sakpilot/pull/88
- feat: コンテナレジストリに削除機能を追加 by @tokuhirom in https://github.com/tokuhirom/sakpilot/pull/89
- feat: KMSキーに削除機能を追加 by @tokuhirom in https://github.com/tokuhirom/sakpilot/pull/90
- docs: PLAN.mdをPR #80-90の実施結果に合わせて更新 by @tokuhirom in https://github.com/tokuhirom/sakpilot/pull/91
- feat: GSLBに削除機能を追加 by @tokuhirom in https://github.com/tokuhirom/sakpilot/pull/85

## [v0.0.15](https://github.com/tokuhirom/sakpilot/compare/v0.0.14...v0.0.15) - 2026-08-07
- オブジェクトストレージAPIをsacloud-sdk-go/api/object-storageへ移行 by @tokuhirom in https://github.com/tokuhirom/sakpilot/pull/58
- chore(deps-dev): bump vite and @vitejs/plugin-react in /frontend by @dependabot[bot] in https://github.com/tokuhirom/sakpilot/pull/57
- chore(deps): bump github.com/aws/aws-sdk-go-v2/aws/protocol/eventstream from 1.7.4 to 1.7.8 by @dependabot[bot] in https://github.com/tokuhirom/sakpilot/pull/48
- chore(deps): bump react-router and react-router-dom in /frontend by @dependabot[bot] in https://github.com/tokuhirom/sakpilot/pull/53
- chore(deps): bump postcss from 8.5.6 to 8.5.16 in /frontend by @dependabot[bot] in https://github.com/tokuhirom/sakpilot/pull/56
- chore(deps): bump github.com/docker/cli from 29.0.3+incompatible to 29.2.0+incompatible by @dependabot[bot] in https://github.com/tokuhirom/sakpilot/pull/45
- chore(deps): bump postcss from 8.5.16 to 8.5.25 in /frontend by @dependabot[bot] in https://github.com/tokuhirom/sakpilot/pull/61
- iaas-api-go等をsacloud-sdk-goへ統合移行 by @tokuhirom in https://github.com/tokuhirom/sakpilot/pull/60
- internal/apprunをsacloud-sdk-goのapprun-dedicatedへ移行 by @tokuhirom in https://github.com/tokuhirom/sakpilot/pull/62
- READMEを現在のコードベースに合わせて更新 by @tokuhirom in https://github.com/tokuhirom/sakpilot/pull/63
- devboxからmiseへ開発環境管理を移行 by @tokuhirom in https://github.com/tokuhirom/sakpilot/pull/64
- Go/npm依存関係を更新（マイナー更新+React19/TS7メジャー更新） by @tokuhirom in https://github.com/tokuhirom/sakpilot/pull/65
- CI/リリースをUbuntu 24.04ベースに更新 by @tokuhirom in https://github.com/tokuhirom/sakpilot/pull/67
- README: Ubuntu 24.04以降向けのwebkit2gtk-4.1対応を追記 by @tokuhirom in https://github.com/tokuhirom/sakpilot/pull/66
- アーカイブの削除機能を追加 by @tokuhirom in https://github.com/tokuhirom/sakpilot/pull/68
- fix: mask accessToken in logs by @tokuhirom in https://github.com/tokuhirom/sakpilot/pull/69
- feat: サーバー削除機能を追加 by @tokuhirom in https://github.com/tokuhirom/sakpilot/pull/70

## [v0.0.14](https://github.com/tokuhirom/sakpilot/compare/v0.0.13...v0.0.14) - 2026-01-28
- feat: add global reload button to top bar by @tokuhirom in https://github.com/tokuhirom/sakpilot/pull/41

## [v0.0.14](https://github.com/tokuhirom/sakpilot/compare/v0.0.13...v0.0.14) - 2026-01-28
- feat: add global reload button to top bar by @tokuhirom in https://github.com/tokuhirom/sakpilot/pull/41

## [v0.0.13](https://github.com/tokuhirom/sakpilot/compare/v0.0.12...v0.0.13) - 2026-01-27
- feat: オブジェクトストレージにJSONLプレビューと検索機能を追加 by @tokuhirom in https://github.com/tokuhirom/sakpilot/pull/39

## [v0.0.12](https://github.com/tokuhirom/sakpilot/compare/v0.0.11...v0.0.12) - 2026-01-26
- feat: モニタリングスイートのメトリクスグラフ機能強化 by @tokuhirom in https://github.com/tokuhirom/sakpilot/pull/36
- chore: AppRun専有型OpenAPIスペック更新 by @tokuhirom in https://github.com/tokuhirom/sakpilot/pull/38

## [v0.0.11](https://github.com/tokuhirom/sakpilot/compare/v0.0.10...v0.0.11) - 2026-01-26
- feat: モニタリングスイートのメトリクス詳細表示とグラフ機能 by @tokuhirom in https://github.com/tokuhirom/sakpilot/pull/32

## [v0.0.11](https://github.com/tokuhirom/sakpilot/compare/v0.0.10...v0.0.11) - 2026-01-25
- feat: モニタリングスイートのメトリクス詳細表示とグラフ機能 by @tokuhirom in https://github.com/tokuhirom/sakpilot/pull/32

## [v0.0.11](https://github.com/tokuhirom/sakpilot/compare/v0.0.10...v0.0.11) - 2026-01-25
- feat: モニタリングスイートのメトリクス詳細表示とグラフ機能 by @tokuhirom in https://github.com/tokuhirom/sakpilot/pull/32

## [v0.0.10](https://github.com/tokuhirom/sakpilot/compare/v0.0.9...v0.0.10) - 2026-01-19
- refactor: AppRunList を AppRunDedicatedList にリネーム by @tokuhirom in https://github.com/tokuhirom/sakpilot/pull/30

## [v0.0.9](https://github.com/tokuhirom/sakpilot/compare/v0.0.8...v0.0.9) - 2026-01-19
- feat: AppRun専有型のバージョン詳細画面に「アクティブにする」機能を追加 by @tokuhirom in https://github.com/tokuhirom/sakpilot/pull/28

## [v0.0.8](https://github.com/tokuhirom/sakpilot/compare/v0.0.7...v0.0.8) - 2026-01-19
- Add cross-reference to sact in README by @tokuhirom in https://github.com/tokuhirom/sakpilot/pull/22
- feat: プロファイル管理機能を追加 by @tokuhirom in https://github.com/tokuhirom/sakpilot/pull/24
- fix: 認証エラー時に右上に赤いエラーメッセージを表示 by @tokuhirom in https://github.com/tokuhirom/sakpilot/pull/25
- fix: AppRun専有型の画面タイトルを「AppRun専有型」に統一 by @tokuhirom in https://github.com/tokuhirom/sakpilot/pull/26
- feat: AppRun専有型でアクティブバージョンをクリアする機能を追加 by @tokuhirom in https://github.com/tokuhirom/sakpilot/pull/27

## [v0.0.7](https://github.com/tokuhirom/sakpilot/compare/v0.0.6...v0.0.7) - 2026-01-17
- fix: actionlint エラーを修正し CI に actionlint を追加 by @tokuhirom in https://github.com/tokuhirom/sakpilot/pull/20

## [v0.0.6](https://github.com/tokuhirom/sakpilot/compare/v0.0.5...v0.0.6) - 2026-01-17
- feat: Homebrew Cask でのインストールをサポート by @tokuhirom in https://github.com/tokuhirom/sakpilot/pull/18

## [v0.0.5](https://github.com/tokuhirom/sakpilot/compare/v0.0.4...v0.0.5) - 2026-01-16
- feat: AppRun共用型のサポートを追加 by @tokuhirom in https://github.com/tokuhirom/sakpilot/pull/15

## [v0.0.4](https://github.com/tokuhirom/sakpilot/compare/v0.0.3...v0.0.4) - 2026-01-16
- feat(frontend): react-router を導入してプロファイル切り替えをURL管理に変更 by @tokuhirom in https://github.com/tokuhirom/sakpilot/pull/13

## [v0.0.3](https://github.com/tokuhirom/sakpilot/compare/v0.0.2...v0.0.3) - 2026-01-16
- docs: READMEのファイル名を SakPilot に更新 by @tokuhirom in https://github.com/tokuhirom/sakpilot/pull/10

## [v0.0.2](https://github.com/tokuhirom/sakpilot/compare/v0.0.1...v0.0.2) - 2026-01-16
- feat: サーバー起動/停止に確認ダイアログとステータスポーリングを追加 by @tokuhirom in https://github.com/tokuhirom/sakpilot/pull/6
- docs: READMEを整理してインストール手順と開発手順を分離 by @tokuhirom in https://github.com/tokuhirom/sakpilot/pull/8
- chore: アプリケーション名を SakPilot に変更 by @tokuhirom in https://github.com/tokuhirom/sakpilot/pull/9

## [v0.0.1](https://github.com/tokuhirom/sakpilot/commits/v0.0.1) - 2026-01-16
- build(deps): bump esbuild, @vitejs/plugin-react and vite in /frontend by @dependabot[bot] in https://github.com/tokuhirom/sakpilot/pull/2
- docs: Git workflowをCLAUDE.mdに追加 by @tokuhirom in https://github.com/tokuhirom/sakpilot/pull/3
- fix: golangci-lint-action を v9 に更新 by @tokuhirom in https://github.com/tokuhirom/sakpilot/pull/4
