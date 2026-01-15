# SakPilot

さくらのクラウド用デスクトップクライアント

## 機能

- usacloud プロファイルを使用した認証
- プロファイル切り替え
- サーバー一覧表示・起動・停止
- DNS ゾーン一覧表示
- シンプル監視一覧表示

## 必要条件

- Go 1.21+
- Node.js 18+
- [Wails CLI](https://wails.io/docs/gettingstarted/installation)
- usacloud の設定済みプロファイル (`~/.usacloud/`)

## セットアップ

```bash
# 依存関係のインストール
go mod download
cd frontend && npm install && cd ..
```

## 開発

```bash
# 開発モードで起動（ホットリロード有効）
wails dev
```

## ビルド

```bash
# プロダクションビルド
wails build
```

ビルド成果物は `build/bin/` に出力されます。

## デバッグ

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
