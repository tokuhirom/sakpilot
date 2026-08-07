# SakPilot リソース精査 PLAN

各リソース（コンポーネント）ごとに、以下の3観点で現状を精査した結果と、今後の対応案をまとめる。

1. **フロントエンドのテストカバレッジ**（Vitest + RTL、`CLAUDE.md` の方針に基づく）
2. **バックエンド実装状況**（`internal/sakura/` 等、List/Get/Create/Update/Delete・電源操作の有無、`app.go` でのRPC公開）
3. **sacloud-sdk-go との突き合わせ**（SDK上は存在するが未実装の機能。特に削除・電源操作系を重視）

調査時点: 2026-08-07。SDKは `github.com/sacloud/sacloud-sdk-go v0.0.1`（`api/iaas`, `api/object-storage`, `api/apprun*`, `api/kms` 等を内包する統合モジュール）。

> **2026-08-07 追記**: 電源操作・削除機能の欠落解消を目的に PR #80〜#90 を実施済み（#85 のみ CI 待ちで auto-merge 設定）。以下の表・各節は実施結果を反映済み。詳細は各節の「対応状況」を参照。

## サマリ表

| リソース | FEテスト | 削除機能 | 電源操作 | 総評 |
|---|---|---|---|---|
| Server | ✅ あり | ✅ | ✅ | 完備。Resetも追加済み（PR #80） |
| Disk | ✅ あり | ✅ | (対象外) | 削除フローのFEテストを追加済み。Create/Update/接続変更は引き続き未実装 |
| Archive | ✅ あり | ✅ | (対象外) | 削除フロー・busy状態のFEテストを追加済み。Create/共有/FTP転送は引き続き未実装 |
| Switch | ✅ あり | ✅ | (対象外) | 削除機能+FEテストを追加済み（PR #82）。共有スコープは削除不可でボタン無効化 |
| PacketFilter | ✅ あり | ✅ | (対象外) | 削除機能+FEテストを追加済み（PR #83） |
| KMS | ✅ あり | ✅（Delete） | (対象外) | 削除機能+FEテストを追加済み（PR #90）。Get/Rotate/ChangeStatus/暗号化は引き続き未実装 |
| DNS | ✅ あり | ✅ | (対象外) | 削除機能+FEテストを追加済み（PR #84） |
| GSLB | ✅ あり | ✅ | (対象外) | 削除機能+FEテストを追加済み（PR #85、CI待ちでauto-merge設定済み） |
| ProxyLB | ✅ あり | ✅ | (対象外) | 削除機能+FEテストを追加済み（PR #88）。証明書管理（Get/Set/Delete/RenewLetsEncrypt）を追加済み |
| SimpleMonitor | ✅ あり | ✅ | (対象外) | 削除機能+FEテストを追加済み（PR #86）。Get(詳細)・詳細ページを追加済み |
| Database | ✅ あり | ✅ | ✅ | 起動/停止/再起動+削除+FEテストを追加済み（PR #81） |
| EnhancedDB | ✅ あり | ✅ | (対象外) | 削除機能+FEテストを追加済み（PR #87） |
| NFS | ✅ あり | ✅ | ✅ | 完備。FEテストとResetを追加済み（PR #80） |
| ObjectStorage | ❌ なし | ❌ **なし** | (対象外) | 閲覧・DLのみ。バケット/キー作成削除が丸ごと未実装（未着手） |
| ContainerRegistry | ✅ あり | ✅ | (対象外) | 削除機能+FEテスト(List/Detail)を追加済み（PR #89、#95） |
| AppRun (専有/共用) | 🟡 一部あり | ❌ **なし** | (対象外) | 共用型のみFEテスト追加済み。閲覧＋アクティブバージョン切替のみ（専有型は未着手、方針判断待ち） |
| Bill | ❌ なし | (対象外) | (対象外) | 読み取り専用リソースなので概ね妥当 |

**17リソース中、FEテストが未着手なのは ObjectStorage / AppRun（専有型） / Bill。**

---

## 1. Compute / Network 系

### Server
- テスト: `ServerList.test.tsx` あり（確認ダイアログ・ポーリング・再起動等カバー済み）
- バックエンド: List/PowerOn(Boot)/PowerOff(Shutdown)/ForceStop/**Reset**/Delete/GetStatus 実装済み、app.goで全て公開
- ✅ **対応済み（PR #80）**: Reset（再起動）ボタンを追加
- SDK比較で残る不足: ChangePlan、Monitor/MonitorCPU、InsertCDROM/EjectCDROM、SendKey/SendNMI、GetVNCProxy、Create、Update、DeleteWithDisks（いずれもパワーユーザー向け機能で現状スコープ外と判断）
- 備考: `server.go` に `println` デバッグ文が複数残存（要クリーンアップ、別issue化推奨）

### Disk
- テスト: `DiskList.test.tsx` あり（一覧表示・削除確認フロー・キャンセル・未接続表示をカバー）
- バックエンド: List/Delete のみ。Get/Create/Update、サーバーへの接続/切断（ConnectToServer/DisconnectFromServer）は未実装
- ✅ **対応済み**: `DiskList.test.tsx` を追加
- SDK比較で残る不足: Create/CreateWithConfig/Update/Config（OSインストール設定）/ConnectToServer/DisconnectFromServer/ResizePartition/Monitor系（未着手）

### Archive
- テスト: `ArchiveList.test.tsx` あり（一覧表示・削除確認フロー・キャンセル・`availability`(uploading/migrating)に応じたボタン活性制御をカバー）
- バックエンド: List（ユーザースコープのみ）/Delete のみ
- ✅ **対応済み**: `ArchiveList.test.tsx` を追加
- SDK比較で残る不足: Create/CreateBlank/CreateFromShared/Update/Transfer/Share/OpenFTP/CloseFTP（未着手）

### Switch
- テスト: `SwitchList.test.tsx` あり（一覧表示・詳細遷移・削除確認フローをカバー）
- バックエンド: List/Get/**Delete** 実装済み
- ✅ **対応済み（PR #82）**: 削除機能を追加。共有スコープ（`scope === 'shared'`）は削除できないためボタンを無効化
- SDK比較で残る不足: Create/Update/ConnectToBridge/DisconnectFromBridge/GetServers（未着手）

### PacketFilter
- テスト: `PacketFilterList.test.tsx` あり（一覧表示・詳細遷移・削除確認フローをカバー）
- バックエンド: List/Get/**Delete** 実装済み
- ✅ **対応済み（PR #83）**: 削除機能を追加
- SDK比較で残る不足: Create/Update（ルール追加・編集、未着手）

### KMS
- テスト: `KMSList.test.tsx`（一覧表示・詳細遷移・削除確認フロー）、`KMSDetail.test.tsx`（基本情報表示・ローテーション・ステータス変更・キャンセル・失敗時のalert）ともに整備済み
- バックエンド: `internal/kms/service.go` に分離実装。List/**Get**/**Delete**/**Rotate**/**ChangeStatus** 実装済み（Goテスト `service_test.go` に対応する各テスト追加済み）
- app.go: `GetKMSKeys`/`GetKMSKey`/`DeleteKMSKey`/`RotateKMSKey`/`ChangeKMSKeyStatus` を公開
- ✅ **対応済み（PR #90）**: 削除機能を追加
- ✅ **対応済み**: Get（詳細取得）/Rotate（ローテーション）/ChangeStatus（active/restricted/suspended切り替え）を追加。`KMSDetail.tsx`を新設し一覧の行クリックで遷移。あわせて`KMSList.tsx`のステータス表示が実際のAPI値（active/restricted/suspended/pending_destruction）と一致していなかった表示バグを修正
- SDK比較で残る不足: Create/Update/ScheduleDestruction（削除予約）/Encrypt/Decrypt（未着手）

---

## 2. DNS / GSLB / ProxyLB / 監視系

### DNS
- テスト: `DNSList.test.tsx` あり（一覧表示・詳細遷移・削除確認フローをカバー）
- バックエンド: List/Get/**Delete** 実装済み
- ✅ **対応済み（PR #84）**: 削除機能を追加
- SDK比較で残る不足: Create/Update/UpdateSettings（レコード追加・編集、未着手）

### GSLB
- テスト: `GSLBList.test.tsx` あり（一覧表示・詳細遷移・削除確認フローをカバー）
- バックエンド: List/Get/**Delete** 実装済み
- ✅ **対応済み（PR #85、CI待ちでauto-merge設定済み）**: 削除機能を追加
- SDK比較で残る不足: Create/Update/UpdateSettings（未着手）

### ProxyLB（エンハンスドロードバランサ）
- テスト: `ProxyLBList.test.tsx` あり（一覧表示・詳細遷移・ヘルス取得・削除フロー・証明書表示/設定/削除/Let's Encrypt更新フローをカバー）
- バックエンド: List/Get/GetHealth/**Delete**/**GetCertificates**/**SetCertificates**/**DeleteCertificates**/**RenewLetsEncryptCert** 実装済み
- ✅ **対応済み（PR #88）**: 削除機能とFEテストを追加。詳細画面ヘッダーに削除ボタンを配置
- ✅ **対応済み**: 証明書管理（GetCertificates/SetCertificates/DeleteCertificates/RenewLetsEncryptCert）を追加。詳細画面に「SSL証明書」カードを新設し、プライマリ証明書＋追加証明書（複数可）の設定フォーム、削除確認、Let's Encrypt更新確認ダイアログを実装。取得したPrivateKeyはUIに表示しない（`ProxyLBCertInfo`から除外）方針とした
- SDK比較で残る不足: Create/Update/UpdateSettings/ChangePlan/MonitorConnection（トラフィックグラフ、未着手）
- **TODO**: トラフィック監視（MonitorConnection）は次点で検討

### SimpleMonitor
- テスト: `MonitorList.test.tsx` あり（一覧表示・詳細遷移・削除確認フローをカバー）
- バックエンド: List/**Get**/Delete 実装済み
- ✅ **対応済み（PR #86）**: 削除機能を追加
- ✅ **対応済み**: Get（詳細取得）と `MonitorDetail.tsx`（基本情報・ヘルスチェック設定）を追加。一覧の行クリックで詳細へ遷移
- SDK比較で残る不足: Create/Update/UpdateSettings/MonitorResponseTime（応答時間グラフ）/HealthStatus（未着手）

### Monitoring Suite（Monitoring.tsx / MonitoringMetricDetail.tsx / MetricGraph.tsx）
- テスト: `MonitoringMetricDetail.test.tsx` あり（基本情報表示・アクセスキー0件時の案内・publisher切り替えとメトリクスのグルーピング表示・カスタムメトリクス・エラー分岐をカバー。`MetricGraph`はuPlot/canvas依存のため`vi.mock`でスタブ化）
- `MetricGraph.tsx` はuPlot依存が強くjsdomでの描画テストはコスト高のため未着手。フォーマッタ関数（formatBytes/formatPercent/detectMetricType）を切り出せば単体テスト可能
- バックエンド: Logs/Metrics/Traces/StorageDetail/AccessKeys/Prometheusクエリ系はRead系のみ実装。ストレージ・アクセスキーの Create/Update/Destroy は未実装
- ✅ **対応済み**: `MonitoringMetricDetail.test.tsx` を追加

---

## 3. Database / EnhancedDB / NFS / ObjectStorage

### Database（データベースアプライアンス）
- テスト: `DatabaseList.test.tsx` あり（一覧表示・ボタン活性制御・起動ポーリング・再起動・削除フローをカバー）
- バックエンド: List/PowerOn(Boot)/PowerOff(Shutdown)/ForceStop/**Reset**/**Delete**/GetStatus 実装済み、app.goで全て公開
- ✅ **対応済み（PR #81）**: NFS/Server相当の電源操作（起動/停止/再起動）と削除機能、FEテストを追加
- SDK比較で残る不足: Create/Read（単体Get）/Update/UpdateSettings/Config/Monitor系/Status/GetParameter/SetParameter（未着手）

### EnhancedDB（強化版DB）
- テスト: `EnhancedDBList.test.tsx` あり（一覧表示・削除確認フローをカバー）
- バックエンド: List/**Delete** 実装済み。電源操作は仕様上そもそも不要
- ✅ **対応済み（PR #87）**: 削除機能を追加
- SDK比較で残る不足: Create/Read/Update/SetPassword（パスワード変更）/GetConfig/SetConfig（未着手）

### NFS
- テスト: `NFSList.test.tsx` あり（確認ダイアログ・ボタン活性制御・ポーリング・再起動・削除フローをカバー）
- バックエンド: List/PowerOn/PowerOff/ForceStop/**Reset**/Delete/GetStatus 実装済み、app.goで全て公開
- ✅ **対応済み（PR #80）**: `NFSList.test.tsx`（最優先項目）とResetボタンを追加
- SDK比較で残る不足: Create/Update（未着手）

### ObjectStorage（オブジェクトストレージ）
- テスト: なし。sites→buckets→objects の3段階遷移、パンくずナビゲーション、アクセスキー/シークレットキー管理、ページネーション、検索の遅延ロードなど**4リソース中もっともロジック濃度が高く、テストを書く価値が非常に高い**
- バックエンド: ListSites/ListAccessKeys/ListBuckets/ListObjects/DownloadObject/Preview系 実装済み。**Create/Update/Delete は丸ごと未実装**（バケット作成/削除、アクセスキー作成/削除、オブジェクトアップロード/削除なし）
- SDK比較で不足: BucketAPIのCreate/**Delete**、AccountAPIのCreate/Read/Delete、AccessKeyのCreate/Read/**Delete**、PermissionsAPI全般、暗号化/レプリケーション/クォータ設定、S3側のPutObject/DeleteObject
- **TODO**: `ObjectStorageList.test.tsx` を追加（優先度高、実装コストも高い）。バケット・アクセスキーの削除機能は次点で検討

---

## 4. ContainerRegistry / AppRun / Bill

### ContainerRegistry（コンテナレジストリ）
- テスト: `ContainerRegistryList.test.tsx`（一覧表示・詳細遷移・削除確認フロー）、`ContainerRegistryDetail.test.tsx`（基本情報表示・ユーザー一覧・パスワード保存/削除フロー・自動アクティブ化・イメージ/タグ一覧遷移）ともに整備済み
- バックエンド: List（レジストリ本体・ユーザー）/**Delete** 実装済み。イメージ/タグ取得はOCI Registry APIを直叩きする別実装
- ✅ **対応済み（PR #89）**: レジストリ削除機能とListのFEテストを追加
- ✅ **対応済み（PR #95）**: `ContainerRegistryDetail.test.tsx` を追加
- SDK比較で残る不足: Create/Read（単体）/Update/UpdateSettings/AddUser/UpdateUser/DeleteUser（ユーザー管理、未着手）
- **TODO**: ユーザー管理機能の追加を検討

### AppRun（専有型 / 共用型）
- テスト: `AppRunSharedList.test.tsx` あり（ユーザー未設定時の案内・一覧表示・エラー表示・詳細遷移とコンポーネント/トラフィック/バージョン履歴表示・戻る操作をカバー）。`AppRunDedicatedList.tsx` は6種のview＋パンくず生成＋アクティブバージョン切替と**調査対象中もっとも分岐が複雑**でテスト価値が高く、引き続き未着手
- バックエンド: `internal/apprun/`（専有型）・`internal/apprunshared/`（共用型）に分離実装。List/Read/`SetActiveVersion`/`ClearActiveVersion` のみ
- SDK比較で不足:
  - 専有型: Cluster/Application/ASG/LoadBalancerの**Create/Delete**、**Versionの Create（新バージョンのデプロイ）**/Delete、WorkerNodeのUpdate（draining）、Certificate系全般
  - 共用型: ApplicationのCreate/Update/Delete、VersionのDelete、TrafficのUpdate（分散比率変更）、UserのCreate
- **TODO**: `AppRunDedicatedList.test.tsx` を最優先で追加。デプロイ操作（Version Create）はSakPilotの現状スコープ（閲覧中心）を超えるため、実装するかは別途方針判断が必要

### Bill（請求）
- テスト: なし。分岐が薄く現状は無理にテスト不要
- バックエンド: `ListByContract`/`GetDetails` のみ。Create/Update/Delete概念はBillOpに存在しない（読み取り専用リソースのため妥当）
- SDK比較で不足: ByContractYear/ByContractYearMonth（期間絞り込み）、Read（単一取得）、DetailsCSV（CSVエクスポート）
- **TODO**: 優先度低。期間絞り込みは請求件数が多いユーザー向けに検討の余地あり

---

## 優先度まとめ（2026-08-07更新）

### ✅ 完了（PR #80〜#90）
- 電源操作: Server Reset / NFS Reset / Database 起動・停止・再起動
- 削除機能: Switch, PacketFilter, KMS(Delete), DNS, GSLB, ProxyLB, SimpleMonitor, Database, EnhancedDB, ContainerRegistry
- FEテスト新規追加: `NFSList.test.tsx`（最優先項目）, `DatabaseList.test.tsx`, `SwitchList.test.tsx`, `PacketFilterList.test.tsx`, `DNSList.test.tsx`, `GSLBList.test.tsx`, `MonitorList.test.tsx`, `EnhancedDBList.test.tsx`, `ProxyLBList.test.tsx`, `ContainerRegistryList.test.tsx`

### ✅ 完了（2026-08-07 追加セッション）
- FEテスト新規追加: `DiskList.test.tsx`（削除フロー・キャンセル・未接続表示）, `ArchiveList.test.tsx`（削除フロー・キャンセル・busy状態のボタン無効化）
- SimpleMonitorのGet（詳細取得）を実装。`internal/sakura/global.go` に `GetSimpleMonitor`、`app.go` に `GetSimpleMonitorDetail` を追加し、`MonitorDetail.tsx`（基本情報・ヘルスチェック設定表示）と一覧からの行クリック遷移を追加
- `ContainerRegistryDetail.test.tsx` を追加（基本情報表示、ユーザー一覧の権限別表示、パスワード保存/取消/削除フロー、保存済み資格情報での自動アクティブ化とイメージ一覧取得、イメージ→タグ一覧遷移と戻る操作をカバー）
- KMSの残り機能（Get/Rotate/ChangeStatus）を実装。`KMSDetail.tsx`と`KMSDetail.test.tsx`を新規追加し、`KMSList.tsx`のステータス表示バグ（実際のAPI値と不一致）も修正

### ✅ 完了（2026-08-07 追加セッション2）
- ProxyLBの証明書管理（GetCertificates/SetCertificates/DeleteCertificates/RenewLetsEncryptCert）を実装。`internal/sakura/proxylb.go`にサービスメソッドを追加、`app.go`に4つのRPCを公開、`ProxyLBList.tsx`にSSL証明書カード（表示/設定フォーム/削除確認/Let's Encrypt更新確認）を追加し`ProxyLBList.test.tsx`にテストを追加

### ✅ 完了（2026-08-07 追加セッション3）
- `AppRunSharedList.test.tsx` を追加（ユーザー未設定時の案内・HasAppRunSharedUser失敗時のフォールバック・一覧表示/空状態/エラー表示・詳細遷移とコンポーネント/トラフィック/バージョン履歴表示・戻る操作をカバー）
- `MonitoringMetricDetail.test.tsx` を追加（基本情報表示・アクセスキー0件時の案内・publisher一覧取得失敗時のエラー表示・publisher選択によるメトリクスのvariantグルーピング・カスタムメトリクス・メトリクス0件時の表示をカバー。`MetricGraph`はuPlot/canvas依存のため`vi.mock`でスタブ化）

### 次セッションの優先順位

**C. 大物・要方針決定（着手前にスコープを確認）**
1. ObjectStorage: バケット/アクセスキーのCreate/Delete、`ObjectStorageList.test.tsx`（ロジック濃度最大・実装コストも高い）
2. AppRun（専有型）: `AppRunDedicatedList.test.tsx`（6種のview＋パンくず生成＋アクティブバージョン切替、調査対象中もっとも分岐が複雑）。削除・デプロイ操作はSDK比較で不足あり。Version Create（新バージョンのデプロイ）は「閲覧中心」という現状スコープを超えるため、実装するか自体を判断してから着手

### その他
- `internal/sakura/server.go` の `println` デバッグ文の削除（別issueとして切り出し推奨、未着手）
- Server/NFSのChangePlan・CDROM・VNC・SendKey等は現状スコープ外と判断し据え置き
