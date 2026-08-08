# SakPilot リソース精査 PLAN

各リソース（コンポーネント）ごとに、以下の3観点で現状を精査した結果と、今後の対応案をまとめる。

1. **フロントエンドのテストカバレッジ**（Vitest + RTL、`CLAUDE.md` の方針に基づく）
2. **バックエンド実装状況**（`internal/sakura/` 等、List/Get/Create/Update/Delete・電源操作の有無、`app.go` でのRPC公開）
3. **sacloud-sdk-go との突き合わせ**（SDK上は存在するが未実装の機能。特に削除・電源操作系を重視）

調査時点: 2026-08-07。SDKは `github.com/sacloud/sacloud-sdk-go v0.0.1`（`api/iaas`, `api/object-storage`, `api/apprun*`, `api/kms` 等を内包する統合モジュール）。

> **2026-08-07 追記**: 電源操作・削除機能の欠落解消を目的に PR #80〜#90 を実施済み（#85 のみ CI 待ちで auto-merge 設定）。以下の表・各節は実施結果を反映済み。詳細は各節の「対応状況」を参照。

> **2026-08-08 追記（方針）**: 本PLAN.mdは元々「閲覧中心」というスコープ制約を前提に書かれていたが、これは過去セッションがPLAN.md作成時に自己判断で置いた記述であり、CLAUDE.md等の正式な方針として明文化されたものではなかった。ユーザー確認の上でこの制約は撤廃し、SakPilotは削除・デプロイ等の書き込み系操作も対象に含む管理ツールとして今後の対応を判断する。

## サマリ表

| リソース | FEテスト | 削除機能 | 電源操作 | 総評 |
|---|---|---|---|---|
| Server | ✅ あり | ✅ | ✅ | 完備。Resetも追加済み（PR #80） |
| Disk | ✅ あり | ✅ | (対象外) | 削除フローのFEテストを追加済み。Create/Update/接続変更は引き続き未実装 |
| Archive | ✅ あり | ✅ | (対象外) | 削除フロー・busy状態のFEテストを追加済み。Create/共有/FTP転送は引き続き未実装 |
| Switch | ✅ あり | ✅ | (対象外) | 削除機能+FEテストを追加済み（PR #82）。共有スコープは削除不可でボタン無効化 |
| PacketFilter | ✅ あり | ✅ | (対象外) | 削除機能+FEテストを追加済み（PR #83） |
| KMS | ✅ あり | ✅（Delete） | (対象外) | 削除機能+FEテストを追加済み（PR #90）。Get/Rotate/ChangeStatus/暗号化は引き続き未実装 |
| DNS | ✅ あり | ✅ | (対象外) | Create/Update/UpdateSettings（レコード管理）まで対応済み。読み書き一式が完備 |
| GSLB | ✅ あり | ✅ | (対象外) | 削除機能+FEテストを追加済み（PR #85、CI待ちでauto-merge設定済み） |
| ProxyLB | ✅ あり | ✅ | (対象外) | 削除機能+FEテストを追加済み（PR #88）。証明書管理（Get/Set/Delete/RenewLetsEncrypt）を追加済み |
| SimpleMonitor | ✅ あり | ✅ | (対象外) | 削除機能+FEテストを追加済み（PR #86）。Get(詳細)・詳細ページを追加済み |
| Database | ✅ あり | ✅ | ✅ | 起動/停止/再起動+削除+FEテストを追加済み（PR #81） |
| EnhancedDB | ✅ あり | ✅ | (対象外) | 削除機能+FEテストを追加済み（PR #87） |
| NFS | ✅ あり | ✅ | ✅ | 完備。FEテストとResetを追加済み（PR #80） |
| ObjectStorage | ✅ あり | ✅（バケット・アクセスキー） | (対象外) | バケット作成/削除、アクセスキー作成/削除+FEテストを追加済み |
| ContainerRegistry | ✅ あり | ✅ | (対象外) | 削除機能+FEテスト(List/Detail)を追加済み（PR #89、#95） |
| AppRun (専有/共用) | ✅ あり | 専有型は✅（Cluster/App/ASG/LB） | (対象外) | 専有型・共用型ともFEテスト追加済み。専有型は削除機能を追加。デプロイ（Version Create）は次の対応対象 |
| Bill | ❌ なし | (対象外) | (対象外) | 読み取り専用リソースなので概ね妥当 |

**17リソース中、FEテストが未着手なのは Bill のみ。**

---

## 1. Compute / Network 系

### Server
- テスト: `ServerList.test.tsx` あり（確認ダイアログ・ポーリング・再起動等カバー済み）
- バックエンド: List/PowerOn(Boot)/PowerOff(Shutdown)/ForceStop/**Reset**/Delete/GetStatus 実装済み、app.goで全て公開
- ✅ **対応済み（PR #80）**: Reset（再起動）ボタンを追加
- SDK比較で残る不足: ChangePlan、Monitor/MonitorCPU、InsertCDROM/EjectCDROM、SendKey/SendNMI、GetVNCProxy、Create、Update、DeleteWithDisks（いずれもパワーユーザー向け機能で複雑さ・利用頻度の観点から未着手。読み取り専用方針による除外ではなく、個別に要否判断する）
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
- テスト: `DNSList.test.tsx`（一覧表示・詳細遷移・削除確認・ゾーン作成フロー）、`DNSDetail.test.tsx`（説明編集・レコード追加/編集/削除）ともに整備済み。`frontend/e2e/dns.spec.ts` でゾーン作成〜レコード操作〜削除までのE2Eもカバー
- バックエンド: List/Get/**Create**/**Update**/**UpdateSettings**/Delete 実装済み
- ✅ **対応済み（PR #84）**: 削除機能を追加
- ✅ **対応済み（2026-08-08 Tier1着手）**: ゾーン作成（Create）、説明編集（Update）、リソースレコードの追加・編集・削除（UpdateSettings、全置き換え方式）を追加。`DNSList.tsx`にゾーン作成モーダル、`DNSDetail.tsx`に説明インライン編集とレコード管理UIを実装
- SDK比較で残る不足: なし（Read/Write一式が揃った）

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
- テスト: `ObjectStorageList.test.tsx` あり（sites→bucketsビュー遷移、シークレットキー保存とバケット自動取得、バケット作成/削除、アクセスキー作成〜Secret一度きり表示〜保存、アクセスキー削除の各フローをカバー。objectsビューの検索/ページネーション/プレビューは対象外）
- バックエンド: ListSites/ListAccessKeys/ListBuckets/ListObjects/DownloadObject/Preview系に加え、**CreateBucket/DeleteBucket/CreateAccessKey/DeleteAccessKey** を実装
- ✅ **対応済み**: バケット作成/削除（`internal/sakura/objectstorage.go`の`CreateBucket`/`DeleteBucket`、`BucketAPI`経由）、アクセスキー作成/削除（`CreateAccessKey`/`DeleteAccessKey`、`AccountAPI`経由。アカウント未作成時は`CreateAccessKey`内で自動的にアカウント作成）。アクセスキーのSecretは作成レスポンスでしか取得できないため、フロントに一度きりの表示モーダルを追加し、`SaveObjectStorageSecretKey`（既存のキーチェーン保存）へ誘導するUXとした
- SDK比較で残る不足: AccountのRead/Delete、PermissionsAPI全般、暗号化/レプリケーション/クォータ設定、S3側のPutObject/DeleteObject（オブジェクト単位の作成/削除は未着手）

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
- テスト: `AppRunSharedList.test.tsx` あり（ユーザー未設定時の案内・一覧表示・エラー表示・詳細遷移とコンポーネント/トラフィック/バージョン履歴表示・戻る操作をカバー）。`AppRunDedicatedList.test.tsx` も整備済み（cluster→app→version遷移とアクティブバージョン設定・ASGのLB/ワーカーノード表示・非アクティブ化/アクティブ化の成功・失敗フロー・Cluster/Application/ASG/LoadBalancerの削除確認〜成功・失敗フローをカバー。`lb` view単体はUI上到達経路が無く未カバー）
- バックエンド: `internal/apprun/`（専有型）・`internal/apprunshared/`（共用型）に分離実装。List/Read/`SetActiveVersion`/`ClearActiveVersion`に加え、専有型はCluster/Application/ASG/LoadBalancerの**Delete**を実装
- ✅ **対応済み（2026-08-08 追加セッション6）**: AppRun専有型の削除機能一式を実装。`internal/apprun/service.go`に`DeleteCluster`/`DeleteApplication`/`DeleteAutoScalingGroup`/`DeleteLoadBalancer`を追加し、`app.go`に対応するRPCを公開。`AppRunDedicatedList.tsx`のクラスタ一覧・アプリ一覧・ASG一覧・LB一覧の各行に削除ボタンと確認ダイアログを追加
- SDK比較で残る不足:
  - 専有型: Cluster/Application/ASG/LoadBalancerの**Create**、**Versionの Delete**、WorkerNodeのUpdate（draining）、Certificate系全般、**Versionの Create（デプロイ）**（いずれも未着手。優先順位は後述の「実装順序」参照）
  - 共用型: ApplicationのCreate/Update/Delete、VersionのDelete、TrafficのUpdate（分散比率変更）、UserのCreate
- **TODO**: `lb` view（ロードバランサー単体詳細）への遷移導線が無い点は意図的な未実装か実装漏れか要確認

### Bill（請求）
- テスト: なし。分岐が薄く現状は無理にテスト不要
- バックエンド: `ListByContract`/`GetDetails` のみ。Create/Update/Delete概念はBillOpに存在しない（読み取り専用リソースのため妥当）
- SDK比較で不足: ByContractYear/ByContractYearMonth（期間絞り込み）、Read（単一取得）、DetailsCSV（CSVエクスポート）
- **TODO**: 優先度低。期間絞り込みは請求件数が多いユーザー向けに検討の余地あり

---

## 優先度まとめ（2026-08-08更新）

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

### ✅ 完了（2026-08-07 追加セッション4）
- `AppRunDedicatedList.test.tsx` を追加（クラスタ一覧の空状態、cluster→app→versionの遷移とパンくずでの戻り、ドロップダウンからのアクティブバージョン設定（成功/失敗）、非アクティブ化ボタン（成功/失敗）、ASG詳細でのLB・ワーカーノード表示とLBごとの`GetAppRunLBNodes`呼び出しをカバー）。`lb` view（ロードバランサー単体詳細）はUIからクリックで到達するトリガーが実装内に無く、テスト対象外とした

### ✅ 完了（2026-08-08 追加セッション5）
- ObjectStorageのバケット・アクセスキーCreate/Delete機能一式を実装。バックエンドに`CreateBucket`/`DeleteBucket`/`CreateAccessKey`/`DeleteAccessKey`（`internal/sakura/objectstorage.go`）とそれぞれのapp.go RPCを追加し、`ObjectStorageList.tsx`にバケット作成モーダル・削除確認・アクセスキー作成時のSecret一度きり表示モーダル・アクセスキー削除確認を追加。`ObjectStorageList.test.tsx`を新規作成

### ✅ 完了（2026-08-08 追加セッション6）
- AppRun専有型の削除機能（Cluster/Application/ASG/LoadBalancer）とFEテストを追加
- **方針転換**: SakPilotは「閲覧中心」に限定しない管理ツールとして、書き込み系操作（デプロイ含む）も対象に含める方針に変更。旧PLAN.mdに残っていた「閲覧中心」という自己制約の記述は撤廃した

### 実装順序（2026-08-08 方針転換後の書き込み系機能ロードマップ）

「閲覧中心」制約の撤廃を受け、各節「SDK比較で残る不足」に列挙された未実装機能（主にCreate/Update系）を、(a) 利用頻度・実用価値、(b) 実装複雑度、(c) 誤操作時のリスク（実インフラ作成・課金発生の有無）で並べ替えたロードマップ。上から順に着手することを推奨するが、各Tier内の順序はユーザーの関心に応じて入れ替えてよい。

**Tier 0: E2Eテスト基盤の整備（最優先、2026-08-08決定 → 同日 基盤実装済み）**

書き込み系機能（削除・作成・デプロイ）を今後増やしていくにあたり、「フロントエンド操作 → Goバックエンド → クラウドAPI」を貫通するE2Eテストを機能追加より先に整備する。方式は [ADR 0001](docs/adr/0001-e2e-testing-strategy.md) で決定済み: **HTTPブリッジ + Playwright(headless Chromium) + sakumock/IaaS fakeドライバ**。

✅ **基盤実装済み（2026-08-08）**。実装時にSDK同梱のIaaS fakeドライバ（`api/iaas/fake`）が使えることが判明し、自前IaaSモックとエンドポイント差し替えフックは不要になった（詳細はADR 0001の「実装時の変更」）。実装内容:
- `e2e_server.go`（`//go:build e2e`、`go run -tags e2e .` で起動）: AppメソッドのHTTP JSON-RPC公開（リフレクション）+ `frontend/dist` 配信 + `window.go`/`window.runtime` シム注入 + HOME隔離/プロファイル偽装 + `keyring.MockInit()` + IaaS fake切り替え/シード + sakumock KMS起動/シード
- `frontend/playwright.config.ts` + `frontend/e2e/`: `servers.spec.ts`（一覧表示・停止→ポーリングでdown・削除フロー）、`kms.spec.ts`（一覧表示・削除フロー）。`npm run test:e2e` で実行
- CI: `go test` / `npm run test` / `go vet -tags e2e` / Playwright E2E を追加

今後のE2E拡充（シナリオ駆動で随時）:
1. 他のIaaSリソース（Disk/DNS/GSLB等）のシナリオ追加 — fakeドライバが全リソース対応済みなのでシード追加のみで書ける
2. sakumock対応サービス（AppRun専有/共用、ObjectStorage、Monitoring Suite）のシナリオ追加
3. 書き込み系機能（Tier 1以降のCreate/Update）を実装する際は、対応するE2Eシナリオを同時に追加する

**Tier 1: 高頻度・低〜中リスクな基本操作（次に着手すべき候補）**
1. ✅ DNS: Create/Update/UpdateSettings（レコード追加・編集は最頻出の日常操作） — 2026-08-08対応済み
2. PacketFilter: Create/Update（ルール追加・編集）
3. SimpleMonitor: Create/Update/UpdateSettings（監視対象の追加・設定変更）
4. GSLB: Create/Update/UpdateSettings
5. ContainerRegistry: Create、ユーザー管理（AddUser/UpdateUser/DeleteUser）
6. AppRun専有型: Version Create（デプロイ）— 着手する場合はフルデプロイフォーム（image/CPU/メモリ/スケーリング/公開ポート/環境変数）として対応する方針（2026-08-08ユーザーに確認済み）

**Tier 2: リソース新規作成系（入力項目・依存関係が多くフォーム設計コストが高い、または実インフラ作成を伴い課金・削除確認等の設計が必要）**
7. Switch: Create/Update
8. Disk: Create/CreateWithConfig/Update/ConnectToServer/DisconnectFromServer
9. ProxyLB: Create/Update/UpdateSettings
10. KMS: Create/Update
11. Database: Create/Update/UpdateSettings/GetParameter/SetParameter
12. NFS: Create/Update
13. EnhancedDB: Create/Update/SetPassword
14. AppRun専有型: Cluster/Application/ASG/LoadBalancerのCreate、VersionのDelete、WorkerNodeのUpdate（draining）、Certificate系
15. AppRun共用型: ApplicationのCreate/Update/Delete、VersionのDelete、TrafficのUpdate、UserのCreate

**Tier 3: 低優先度・ニッチ or 複雑度が高い機能**
16. Server: ChangePlan/InsertCDROM/EjectCDROM/SendKey/SendNMI/GetVNCProxy等パワーユーザー向け機能（複雑さ・利用頻度の観点で後回し。読み取り専用方針による除外ではない）
17. Archive: Create/CreateBlank/CreateFromShared/Share/OpenFTP/CloseFTP
18. ObjectStorage: AccountのRead/Delete、PermissionsAPI全般、暗号化/レプリケーション/クォータ設定、S3側のPutObject/DeleteObject
19. Monitoring Suite: ストレージ・アクセスキーのCreate/Update/Destroy
20. ProxyLB: ChangePlan/MonitorConnection（トラフィックグラフ）
21. Bill: ByContractYear/ByContractYearMonth（期間絞り込み）/DetailsCSV

### その他
- `internal/sakura/server.go` の `println` デバッグ文の削除（別issueとして切り出し推奨、未着手）
