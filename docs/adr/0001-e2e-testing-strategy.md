# ADR 0001: E2Eテスト戦略 — HTTPブリッジ + Playwright + sakumock/自前IaaSモック

- Status: Accepted (2026-08-08 実装時追記あり — 「実装時の変更 (2026-08-08)」参照)
- Date: 2026-08-08

## Context

SakPilotはWails製デスクトップアプリ(Go backend + React frontend)であり、現状のテストは以下に限られる:

- Frontend: Vitest + React Testing Library によるコンポーネントテスト(Goバインディングは `vi.mock` で全モック)
- Go: `internal/apprun` / `internal/kms` / `internal/sakura`(objectstorage, monitoring)等の sakumock を使ったサービス層テスト

「フロントエンドの操作 → Goバックエンド → さくらのクラウドAPI」を貫通するE2Eテストが存在しない。特に app.go の124メソッドの大半を占めるIaaS系(サーバー、ディスク、DNS、GSLB等)はGo側のテストが一切ない。

E2Eの実行形態を決めるにあたり、調査で判明した制約:

1. **WailsのwebviewはE2Eツールで操作できない**。PlaywrightにWebKitGTK(Wailsのwebview)用ドライバはなく、`wails dev` をCIで動かすにはGTK/WebKit依存 + xvfb が必要で重く不安定。
2. **本アプリはほぼ「普通のSPA」である**。フロントエンドのWails依存は生成バインディング(実体は `window.go.main.App.*` 呼び出し)と `BrowserOpenURL` 1箇所のみ。`EventsOn` 等は未使用、ルーティングはHashRouter。ブラウザで動かす際の差し込みポイントは `window.go` の1箇所に集約されている。
3. **モックサーバーの状況**: `github.com/sacloud/sakumock`(導入済み)は apprun / apprundedicated / kms / objectstorage / monitoringsuite 等をカバーするが、**IaaSのモックは存在しない**。
4. **エンドポイント差し替え**: AppRun/KMS/ObjectStorage/Monitoring は `SAKURA_ENDPOINTS_*` 環境変数で差し替え可能。一方IaaSは (a) `internal/sakura/client.go` の `SetEnviron` が `os.Environ()` を含まない、(b) SDKがルートURLをパッケージグローバル `iaas.SakuraCloudAPIRoot` から読む、の2点により環境変数が届かない。
5. **ヘッドレスCIの制約**: OSキーチェーン(`internal/sakura/keyring.go`)はCI環境に存在しないため、フェイクへの差し替えが必要。

## Decision

**テスト用HTTPブリッジ + Playwright(headless Chromium)+ sakumock/自前IaaSモック** の構成でE2Eテストを実装する。

```
Playwright (headless Chromium)
        │ http
        ▼
┌──────────────────────────────┐
│ E2E用サーバー (Go)            │
│  ├ frontend/dist を静的配信   │
│  ├ /rpc/{Method} → App実体   │
│  └ keyring: フェイク差し替え  │
└──────┬───────────────────────┘
       │ SAKURA_ENDPOINTS_* / IaaSルートURL差し替え
       ▼
 sakumock (apprun / kms / objectstorage / monitoring / …)
 + 自前IaaSモック (net/http/httptest ベース)
```

構成要素:

1. **E2E用サーバー**: テスト専用のエントリポイント(`cmd/e2e-server` またはbuild tag)として、`App` のバインドメソッドをHTTP JSON-RPC(`POST /rpc/{Method}`、引数はJSON配列)で公開し、`frontend/dist` を静的配信する。
2. **`window.go` シム**: テストモードでのみ注入する小さなJSシムが `window.go.main.App.*` を実装し、各呼び出しを `/rpc/{Method}` へのfetchに変換する。生成バインディングのコードは無変更で全APIを横取りできる。`window.runtime`(`BrowserOpenURL` 等)もno-opシムを用意する。
3. **クラウドAPIモック**: sakumockがカバーするサービスは `SAKURA_ENDPOINTS_*` で差し替える。IaaSは自前モックパッケージ(`internal/testing/iaasmock` 等)をsakumockと同様のhttptestベース・インメモリ状態で実装し、**E2Eシナリオで必要になったエンドポイントから段階的に追加する**(全API網羅は目指さない)。
4. **IaaSルートURL差し替えフック**: 環境変数(例: `SAKPILOT_IAAS_API_ROOT_URL`)が設定されていれば `iaas.SakuraCloudAPIRoot` を書き換えるフックをE2Eサーバー起動時に入れる。あわせて `internal/sakura/client.go` の `SetEnviron` にプロセス環境を透過させる。
5. **環境の隔離**: 既存Goテストと同じパターンを踏襲する — `HOME` を一時ディレクトリに差し替えて `~/.usacloud/<profile>/config.json` を偽装し、キーチェーンはフェイクに差し替える。

## 実装時の変更 (2026-08-08)

実装時に `sacloud-sdk-go` の `api/iaas/fake` パッケージに **iaas-api-go由来のインメモリfakeドライバが同梱されている**ことが判明した(`fake.SwitchFactoryFuncToFake()` で全IaaSリソースのOp実装をプロセス内fakeに切り替えられる。電源操作の状態遷移や「起動中サーバーは削除不可(409)」等の挙動も再現される)。これを受けて以下を変更した:

- **自前IaaSモック(httptestベース)は作らない**。E2EサーバーはAppと同一プロセスなので、`fake.SwitchFactoryFuncToFake()` + `fake.DataStore.Put(...)` によるシードで置き換える。HTTPレイヤーを通らないため、上記4(IaaSルートURL差し替えフックと `client.go` の環境変数透過)も**不要になり実施しない**。
- **エントリポイントはbuild tag方式**(`go run -tags e2e .`)とした。`App` はルートの `package main` にあり `cmd/` 配下から参照できないため。`main.go` に `//go:build !e2e` を付与し、`e2e_server.go`(`//go:build e2e`)がE2E用の `main()` を提供する。
- キーチェーンのフェイクは `zalando/go-keyring` 標準の `keyring.MockInit()` で済み、インターフェース化は不要だった。

## Alternatives Considered

### wails dev + Playwright

`wails dev` が :34115 で配信するブラウザ版(WebSocketでGoブリッジ)にPlaywrightを接続する案。シム不要でWailsブリッジ込みの最も本物に近いE2Eになるが、CIにGTK/WebKit依存とxvfbが必要で、起動が遅く不安定になりがち。ローカル検証の補助としては使えるが、CIの主軸にはしない。

### window.go 全モック(フロントエンドのみ)

Goバックエンドを起動せず `window.go.main.App.*` をブラウザ側で全部フェイク実装する案。最速・最軽量だが、Goコード(app.go / internal)が一切テストされず、既存のVitestテスト(バインディングを `vi.mock` 済み)との差分価値が薄い。

### IaaSモックの代替案

- **sakumockへのcontribute**: sacloud/sakumockにIaaSモックをPRで追加する案。エコシステムには貢献できるが、upstream次第でリードタイムが読めず、E2E着手がブロックされる。自前モックが十分に育った段階でupstream提案するのは妨げない。
- **録画リプレイ方式(go-vcr等)**: 実装コストは低いが、書き込み系操作(削除・作成)の記録に実リソースが必要で、カセット管理が煩雑。電源ON→ステータス変化のような状態遷移の表現が苦手。

## Consequences

- CIで完全ヘッドレスに動く、フロントエンド+Goバックエンド実コードを貫通するE2Eテストが得られる。
- Wailsブリッジ(生成コード)とwebview自体はテスト対象外になる。ここは自動生成コードでありリスクは小さいと判断する。
- 自前IaaSモックの実装・保守コストが継続的に発生する。シナリオ駆動で必要な分だけ実装することでコストを抑える。
- `window.go` シムとHTTP JSON-RPCブリッジは、バインディングの呼び出し規約(メソッド名・引数順)が変わると追従が必要になる。
- 副次効果として、キーチェーンのフェイク差し替え(インターフェース化)とIaaSエンドポイントの差し替えフックが入ることで、Go単体テストでもIaaS系サービス層をテストしやすくなる。
