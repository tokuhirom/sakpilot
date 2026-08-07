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
| Disk | ❌ なし | ✅ | (対象外) | Create/Update/接続変更が未実装。FEテストが積み残し（未着手） |
| Archive | ❌ なし | ✅ | (対象外) | Create/共有/FTP転送が未実装。FEテストが積み残し（未着手） |
| Switch | ✅ あり | ✅ | (対象外) | 削除機能+FEテストを追加済み（PR #82）。共有スコープは削除不可でボタン無効化 |
| PacketFilter | ✅ あり | ✅ | (対象外) | 削除機能+FEテストを追加済み（PR #83） |
| KMS | ✅ あり | ✅（Delete） | (対象外) | 削除機能+FEテストを追加済み（PR #90）。Get/Rotate/ChangeStatus/暗号化は引き続き未実装 |
| DNS | ✅ あり | ✅ | (対象外) | 削除機能+FEテストを追加済み（PR #84） |
| GSLB | ✅ あり | ✅ | (対象外) | 削除機能+FEテストを追加済み（PR #85、CI待ちでauto-merge設定済み） |
| ProxyLB | ✅ あり | ✅ | (対象外) | 削除機能+FEテストを追加済み（PR #88）。証明書管理は引き続き未実装 |
| SimpleMonitor | ✅ あり | ✅ | (対象外) | 削除機能+FEテストを追加済み（PR #86）。Get(詳細)は引き続き未実装 |
| Database | ✅ あり | ✅ | ✅ | 起動/停止/再起動+削除+FEテストを追加済み（PR #81） |
| EnhancedDB | ✅ あり | ✅ | (対象外) | 削除機能+FEテストを追加済み（PR #87） |
| NFS | ✅ あり | ✅ | ✅ | 完備。FEテストとResetを追加済み（PR #80） |
| ObjectStorage | ❌ なし | ❌ **なし** | (対象外) | 閲覧・DLのみ。バケット/キー作成削除が丸ごと未実装（未着手） |
| ContainerRegistry | ✅ あり(List) | ✅ | (対象外) | 削除機能+FEテスト(List)を追加済み（PR #89）。Detail(パスワード管理等)のテストは未着手 |
| AppRun (専有/共用) | ❌ なし | ❌ **なし** | (対象外) | 閲覧＋アクティブバージョン切替のみ（未着手、方針判断待ち） |
| Bill | ❌ なし | (対象外) | (対象外) | 読み取り専用リソースなので概ね妥当 |

**17リソース中、FEテストが未着手なのは Disk / Archive / ObjectStorage / AppRun / Bill、および ContainerRegistryDetail（Listは対応済み）。**

---

## 1. Compute / Network 系

### Server
- テスト: `ServerList.test.tsx` あり（確認ダイアログ・ポーリング・再起動等カバー済み）
- バックエンド: List/PowerOn(Boot)/PowerOff(Shutdown)/ForceStop/**Reset**/Delete/GetStatus 実装済み、app.goで全て公開
- ✅ **対応済み（PR #80）**: Reset（再起動）ボタンを追加
- SDK比較で残る不足: ChangePlan、Monitor/MonitorCPU、InsertCDROM/EjectCDROM、SendKey/SendNMI、GetVNCProxy、Create、Update、DeleteWithDisks（いずれもパワーユーザー向け機能で現状スコープ外と判断）
- 備考: `server.go` に `println` デバッグ文が複数残存（要クリーンアップ、別issue化推奨）

### Disk
- テスト: なし。`DiskList.tsx` は削除確認ダイアログ＋削除中のボタン無効化という状態遷移ロジックを持ち、**テストを書く価値が高い**
- バックエンド: List/Delete のみ。Get/Create/Update、サーバーへの接続/切断（ConnectToServer/DisconnectFromServer）は未実装
- SDK比較で不足: Create/CreateWithConfig/Update/Config（OSインストール設定）/ConnectToServer/DisconnectFromServer/ResizePartition/Monitor系
- **TODO**: `DiskList.test.tsx` を追加（削除フロー）。サーバー接続変更機能は将来検討

### Archive
- テスト: なし。`ArchiveList.tsx` は削除確認ダイアログ＋`availability`(uploading/migrating)に応じたボタン活性制御があり、**テストを書く価値が高い**
- バックエンド: List（ユーザースコープのみ）/Delete のみ
- SDK比較で不足: Create/CreateBlank/CreateFromShared/Update/Transfer/Share/OpenFTP/CloseFTP
- **TODO**: `ArchiveList.test.tsx` を追加（削除フロー、busy状態でのボタン無効化）

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
- テスト: `KMSList.test.tsx` あり（一覧表示・削除確認フローをカバー）
- バックエンド: `internal/kms/service.go` に分離実装。List/**Delete** 実装済み（Goテスト `service_test.go` に `TestService_DeleteKey` 追加済み）
- app.go: `GetKMSKeys`/`DeleteKMSKey` を公開
- ✅ **対応済み（PR #90）**: 削除機能を追加
- SDK比較で残る不足: Read（Get）/Create/Update/Rotate（ローテーション）/ChangeStatus（有効化・無効化）/ScheduleDestruction（削除予約）/Encrypt/Decrypt
- **TODO**: 次点でGet（詳細取得）/Rotate/ChangeStatusの実装を検討。Delete実装（`internal/kms/service.go` + `service_test.go`）と同じパターンで追加しやすい

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
- テスト: `ProxyLBList.test.tsx` あり（一覧表示・詳細遷移・ヘルス取得・削除フローをカバー）
- バックエンド: List/Get/GetHealth/**Delete** 実装済み
- ✅ **対応済み（PR #88）**: 削除機能とFEテストを追加。詳細画面ヘッダーに削除ボタンを配置
- SDK比較で残る不足: Create/Update/UpdateSettings/ChangePlan/**証明書管理**（GetCertificates/SetCertificates/DeleteCertificates/RenewLetsEncryptCert）/MonitorConnection（トラフィックグラフ）
- **TODO**: 証明書管理・トラフィック監視はHTTPS運用上重要なため次点で優先度高め

### SimpleMonitor
- テスト: `MonitorList.test.tsx` あり（一覧表示・削除確認フローをカバー）
- バックエンド: List/**Delete** 実装済み（詳細取得＝Getは引き続き未実装）
- ✅ **対応済み（PR #86）**: 削除機能を追加
- SDK比較で残る不足: Create/Read（Get）/Update/UpdateSettings/MonitorResponseTime（応答時間グラフ）/HealthStatus
- **TODO**: 詳細ページ（Get）の追加を優先検討。監視対象の設定内容・応答時間グラフが見えないのは運用上の穴

### Monitoring Suite（Monitoring.tsx / MonitoringMetricDetail.tsx / MetricGraph.tsx）
- テスト: なし。`MonitoringMetricDetail.tsx` はpublisher切り替え・メトリクスのグルーピング（useMemo）・エラー分岐があり、**テストを書く価値がある候補**
- `MetricGraph.tsx` はuPlot依存が強くjsdomでの描画テストはコスト高。フォーマッタ関数（formatBytes/formatPercent/detectMetricType）を切り出せば単体テスト可能
- バックエンド: Logs/Metrics/Traces/StorageDetail/AccessKeys/Prometheusクエリ系はRead系のみ実装。ストレージ・アクセスキーの Create/Update/Destroy は未実装
- **TODO**: `MonitoringMetricDetail.test.tsx` を追加（優先度中）

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
- テスト: `ContainerRegistryList.test.tsx` あり（一覧表示・詳細遷移・削除確認フローをカバー）。`ContainerRegistryDetail.tsx` はview切り替え・パスワード保存/削除フロー・資格情報保存後の自動アクティブ化など状態遷移が多く**テストを書く価値が高い**が未着手のまま
- バックエンド: List（レジストリ本体・ユーザー）/**Delete** 実装済み。イメージ/タグ取得はOCI Registry APIを直叩きする別実装
- ✅ **対応済み（PR #89）**: レジストリ削除機能とListのFEテストを追加
- SDK比較で残る不足: Create/Read（単体）/Update/UpdateSettings/AddUser/UpdateUser/DeleteUser（ユーザー管理、未着手）
- **TODO**: `ContainerRegistryDetail.test.tsx` を追加。ユーザー管理機能の追加を検討

### AppRun（専有型 / 共用型）
- テスト: なし。`AppRunDedicatedList.tsx` は6種のview＋パンくず生成＋アクティブバージョン切替と**調査対象中もっとも分岐が複雑**でテスト価値が高い。`AppRunSharedList.tsx` も一定のロジックがありテスト価値がある
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

### 次セッションの優先順位

**A. 低コストですぐ着手できるもの**
1. `DiskList.test.tsx` / `ArchiveList.test.tsx` — バックエンド(削除)は実装済み。既存の削除確認ダイアログパターンをそのままテスト化するだけ
2. SimpleMonitorのGet（詳細取得）実装 — Listのみで詳細ページが作れない状態を解消
3. `ContainerRegistryDetail.test.tsx` — パスワード保存/削除フロー、資格情報自動アクティブ化のテスト

**B. 中規模（実装パターンは確立済み）**
4. KMSの残り機能: Get（詳細）/Rotate（ローテーション）/ChangeStatus（有効化・無効化）— Delete実装（`internal/kms/service.go`）と同じパターン
5. ProxyLBの証明書管理（GetCertificates/SetCertificates/DeleteCertificates/RenewLetsEncryptCert）— HTTPS運用上重要度高
6. `AppRunSharedList.test.tsx` / `MonitoringMetricDetail.test.tsx` のFEテスト

**C. 大物・要方針決定（着手前にスコープを確認）**
7. ObjectStorage: バケット/アクセスキーのCreate/Delete、`ObjectStorageList.test.tsx`（ロジック濃度最大・実装コストも高い）
8. AppRun（専有/共用）: 削除・デプロイ操作。Version Create（新バージョンのデプロイ）は「閲覧中心」という現状スコープを超えるため、実装するか自体を判断してから着手

### その他
- `internal/sakura/server.go` の `println` デバッグ文の削除（別issueとして切り出し推奨、未着手）
- Server/NFSのChangePlan・CDROM・VNC・SendKey等は現状スコープ外と判断し据え置き
