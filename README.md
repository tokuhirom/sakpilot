# SakPilot

さくらのクラウド用デスクトップクライアント

**GUI 好きのあなたへ**: このツールはデスクトップアプリです。
**ターミナル派なら**: [sact](https://github.com/tokuhirom/sact) をどうぞ！

## 機能

- usacloud プロファイルを使用した認証
- プロファイル切り替え
- サーバー一覧表示・起動・停止
- DNS ゾーン一覧表示
- シンプル監視一覧表示

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

- Go 1.21+
- Node.js 18+
- [Wails CLI](https://wails.io/docs/gettingstarted/installation)

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

### デバッグ

プロファイルの認証情報を確認するためのデバッグコマンド:

```bash
go run cmd/debug/main.go <profile-name>
```

## プロジェクト構成

```
sakpilot/
├── app.go                 # Wails バインディング
├── main.go                # エントリーポイント
├── internal/
│   └── sakura/            # さくらのクラウド API クライアント
│       ├── client.go      # プロファイル管理・認証
│       ├── server.go      # サーバー操作
│       ├── global.go      # グローバルリソース (DNS, 監視等)
│       └── zone.go        # ゾーン定義
├── frontend/
│   └── src/
│       ├── App.tsx        # メインコンポーネント
│       └── components/    # 各リソースのコンポーネント
└── cmd/
    └── debug/             # デバッグ用コマンド
```
