# SakPilot

さくらのクラウド用デスクトップクライアント

**GUI 好きのあなたへ**: このツールはデスクトップアプリです。
**ターミナル派なら**: [sact](https://github.com/tokuhirom/sact) をどうぞ！

## 機能

### 認証・プロファイル管理

- usacloud プロファイル (`~/.usacloud/`) の読み込み
- プロファイルの新規作成・編集・削除
- デフォルトプロファイルの切り替え
- 認証情報の検証

### ゾーン依存リソース

- サーバー一覧表示・起動・停止・強制停止
- ディスク一覧表示
- アーカイブ一覧表示
- データベース一覧表示
- スイッチ一覧・詳細表示
- パケットフィルタ一覧・詳細表示
- ProxyLB (エンハンスドロードバランサ) 一覧・詳細・ヘルスチェック表示
- AppRun (専有タイプ) のクラスタ・アプリケーション・バージョン・ASG・ロードバランサ・ワーカーノード表示、アクティブバージョンの切り替え

### グローバルリソース

- DNS ゾーン一覧・詳細表示
- SSL証明書一覧表示
- GSLB 一覧・詳細表示
- シンプル監視一覧表示
- エンハンスドデータベース一覧表示
- コンテナレジストリ一覧・ユーザー管理、収録イメージ・タグの参照
- KMS 鍵一覧表示
- AppRun (共有タイプ) のアプリケーション・バージョン・トラフィック表示
- 請求情報一覧表示
- オブジェクトストレージのサイト・バケット・アクセスキー管理、オブジェクト一覧・ダウンロード・プレビュー (gzip/JSONL, テキスト)

### 監視スイート (Monitoring Suite)

- ログ・メトリクス・トレース一覧表示
- Prometheus 形式でのメトリクスストレージへのクエリ (ラベル・レンジクエリ・パブリッシャー別参照)

### その他

- プロファイル/シークレット (オブジェクトストレージ・コンテナレジストリ) はOSのキーチェーン (keyring) に保存
- 各種リストページでの検索・グローバルリロード対応

## インストール

### Homebrew (macOS)

```bash
brew install tokuhirom/tap/sakpilot
```

### ダウンロード

[GitHub Releases](https://github.com/tokuhirom/sakpilot/releases) から最新版をダウンロードしてください。

| OS | ファイル |
|----|----------|
| macOS (Intel/Apple Silicon) | `SakPilot-darwin-universal.zip` |
| Windows | `SakPilot-windows-amd64.zip` |
| Linux | `SakPilot-linux-amd64.tar.gz` |

### 必要条件

- [usacloud](https://github.com/sacloud/usacloud) の設定済みプロファイル (`~/.usacloud/`)

### macOS での起動方法

このアプリは署名されていないため、初回起動時にセキュリティ警告が表示されます。

**方法1: システム設定から許可する**

1. アプリをダブルクリックして開こうとする
2. 「開発元が未確認」という警告が表示されたら、一度キャンセル
3. 「システム設定」→「プライバシーとセキュリティ」を開く
4. 「セキュリティ」セクションで「このまま開く」をクリック

**方法2: ターミナルから quarantine 属性を削除する**

```bash
xattr -cr /Applications/SakPilot.app
```

その後、通常通りアプリを起動できます。

---

## 開発

### 必要条件

- Go 1.25+
- Node.js 18+
- [Wails CLI](https://wails.io/docs/gettingstarted/installation) v2

devbox を使う場合は `devbox shell` で Go・Wails の開発環境が揃います（ただし後述の Linux 依存パッケージは別途インストールが必要です）。

#### Linux の追加依存パッケージ

Linux でビルドする場合は GTK/WebKit の開発パッケージが必要です（CI でも同様にインストールしています）。

```bash
sudo apt-get install -y libgtk-3-dev libwebkit2gtk-4.0-dev
```

### セットアップ

```bash
# 依存関係のインストール
go mod download
cd frontend && npm install && cd ..
```

### 開発モードで起動

```bash
# ホットリロード有効
wails dev
```

### ビルド

```bash
# プロダクションビルド
wails build
```

ビルド成果物は `build/bin/` に出力されます。

### Go->TypeScript バインディングの再生成

`app.go` の RPC メソッドを変更した場合は、バインディングを再生成してください。

```bash
wails generate module
```

### Lint

```bash
# Go lint
golangci-lint run

# TypeScript lint
cd frontend && npx tsc --noEmit
```

## プロジェクト構成

```
sakpilot/
├── app.go                    # Wails バインディング (フロントエンドに公開する RPC メソッド)
├── main.go                   # エントリーポイント (フロントエンド資産の埋め込み含む)
├── internal/
│   ├── sakura/                # さくらのクラウド IaaS/各種 API クライアント
│   │   ├── client.go          # プロファイル管理・認証
│   │   ├── profile_management.go  # プロファイルの作成・編集・削除
│   │   ├── keyring.go         # OS キーチェーンへのシークレット保存
│   │   ├── server.go          # サーバー操作
│   │   ├── disk.go / archive.go / database.go / switch.go / packetfilter.go
│   │   ├── proxylb.go         # ProxyLB (エンハンスドロードバランサ)
│   │   ├── enhanced_db.go     # エンハンスドデータベース
│   │   ├── registry.go        # コンテナレジストリ
│   │   ├── objectstorage.go   # オブジェクトストレージ
│   │   ├── monitoring.go      # 監視スイート (ログ/メトリクス/トレース/Prometheus)
│   │   ├── bill.go            # 請求情報
│   │   ├── global.go          # グローバルリソース (DNS, GSLB, 証明書, シンプル監視等)
│   │   └── zone.go            # ゾーン定義
│   ├── apprun/                 # AppRun (専有タイプ)
│   ├── apprunshared/           # AppRun (共有タイプ)
│   └── kms/                    # KMS
├── frontend/
│   └── src/
│       ├── App.tsx            # メインコンポーネント (ログイン・サイドバー・各ビュー)
│       ├── hooks/              # useGlobalReload, useSearch 等の共通フック
│       └── components/         # 各リソースの一覧・詳細コンポーネント
└── wailsjs/                     # 自動生成された Go->TypeScript バインディング (frontend 配下)
```

## SDK

さくらのクラウドの API アクセスには [sacloud/sacloud-sdk-go](https://github.com/sacloud/sacloud-sdk-go) を使用しています。
