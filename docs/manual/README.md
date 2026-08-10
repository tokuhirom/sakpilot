# SakPilot ユーザーマニュアル

> **注意: 本ツールは非公式(Unofficial)のサードパーティ製ツールです。**
> SakPilotは開発者個人が作成したデスクトップクライアントであり、さくらインターネット株式会社が公式に提供・サポートするものではありません。本マニュアルおよびSakPilot自体の利用は自己責任でお願いします。

## これは何か

各リソースの主要な操作フロー(一覧の見方・作成・編集・削除等)を、実際の画面のスクリーンショット付きで説明するドキュメントです。スクリーンショットは[E2Eテスト基盤](../adr/0001-e2e-testing-strategy.md)(`go run -tags e2e .`、IaaS APIはSDK同梱のfakeドライバ/sakumockでモック)上で、Playwrightの専用スクリプトを使って撮影しています。実クラウド環境やアカウントは一切必要ありません。

## リソース別マニュアル

| リソース | マニュアル |
|---|---|
| サーバー | [server.md](server.md) |
| ディスク | [disk.md](disk.md) |
| DNS | [dns.md](dns.md) |
| スイッチ | [switch.md](switch.md) |
| パケットフィルター | [packetfilter.md](packetfilter.md) |
| GSLB | [gslb.md](gslb.md) |
| ELB(ProxyLB) | [elb.md](elb.md) |
| シンプル監視 | [simplemonitor.md](simplemonitor.md) |
| データベース | [database.md](database.md) |
| エンハンスドDB | [enhanceddb.md](enhanceddb.md) |
| NFS | [nfs.md](nfs.md) |
| コンテナレジストリ | [containerregistry.md](containerregistry.md) |
| KMS | [kms.md](kms.md) |
| シークレットマネージャー | [secretmanager.md](secretmanager.md) |
| SimpleMQ | [simplemq.md](simplemq.md) |
| 簡易通知(Simple Notification) | [simplenotification.md](simplenotification.md) |
| IAM | [iam.md](iam.md) |
| ワークフロー | [workflows.md](workflows.md) |
| AppRun専有型 | [apprun-dedicated.md](apprun-dedicated.md) |
| AppRun共用型 | [apprun-shared.md](apprun-shared.md) |

これで撮影基盤整備時に予定していた対象リソースは一通り整備が完了しました。以降は新規リソース追加時に随時追加していきます。

### 今回未対応のリソース

以下のリソースはE2Eテスト基盤(`e2e_server.go`)にシードデータが投入されておらず、スクリーンショット撮影に使える状態が無いため、今回はスコープ外としています。シードの追加は別タスクとして検討します。

- アーカイブ (Archive)
- オブジェクトストレージ (Object Storage) — E2E specはあるが実データではなくUI存在確認程度のため対象外
- モニタリングスイート (Monitoring Suite)
- 請求情報 (Bill)

## スクリーンショットの再生成方法

サーバーの画面デザインが変わった場合や、他リソースのマニュアルを追加する場合は、以下のコマンドでスクリーンショットを再生成できます。

```bash
# 事前準備(初回のみ、または wailsjs/frontend/dist が無い場合)
wails generate module
cd frontend && npm install && npm run build

# スクリーンショット撮影(frontend/e2e-manual/ 配下のPlaywrightスクリプトを実行)
cd frontend && npm run docs:screenshots
```

`npm run docs:screenshots` は `playwright.manual.config.ts` (`testDir: ./e2e-manual`) を使って実行され、`go run -tags e2e .` のE2Eサーバーを自動起動し、`docs/manual/images/<resource>/*.png` に連番のPNGを書き出します。既存の `npm run test:e2e`(CI用回帰テスト、`playwright.config.ts` / `frontend/e2e/`)とはテスト対象ディレクトリ・configが分離されており、CIには含まれません。

新しいリソースのマニュアルを追加する場合は、`frontend/e2e-manual/server.spec.ts` と `frontend/e2e-manual/helpers.ts` を参考に、`frontend/e2e-manual/<resource>.spec.ts` を追加してください。既存の回帰テスト(`frontend/e2e/<resource>.spec.ts`)がセレクタ・シードデータの実例として使えます。

## 今後の公開について

`docs/`配下は将来的にGitHub Pages等で公開することを検討しています(未着手)。そのため本マニュアルは素のMarkdown+相対パス画像のみで構成しており、frontmatterの有無に依存しない単純な見出し構成にしています。
