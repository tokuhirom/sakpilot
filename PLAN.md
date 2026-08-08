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
| Disk | ✅ あり | ✅ | (対象外) | Create/Update/接続先サーバー変更（ConnectToServer/DisconnectFromServer）まで対応済み |
| Archive | ✅ あり | ✅ | (対象外) | 削除フロー・busy状態のFEテストを追加済み。Create/共有/FTP転送は引き続き未実装 |
| Switch | ✅ あり | ✅ | (対象外) | 削除機能+FEテストを追加済み（PR #82）。共有スコープは削除不可でボタン無効化 |
| PacketFilter | ✅ あり | ✅ | (対象外) | 削除機能に加えCreate/Update（ルール管理）まで対応済み。読み書き一式が完備 |
| KMS | ✅ あり | ✅（Delete） | (対象外) | 削除機能+FEテストを追加済み（PR #90）。Get/Rotate/ChangeStatus/暗号化は引き続き未実装 |
| DNS | ✅ あり | ✅ | (対象外) | Create/Update/UpdateSettings（レコード管理）まで対応済み。読み書き一式が完備 |
| GSLB | ✅ あり | ✅ | (対象外) | 削除機能に加えCreate/Update/UpdateSettings（振り分け先サーバー管理）まで対応済み。読み書き一式が完備 |
| ProxyLB | ✅ あり | ✅ | (対象外) | 削除機能+FEテストを追加済み（PR #88）。証明書管理（Get/Set/Delete/RenewLetsEncrypt）を追加済み |
| SimpleMonitor | ✅ あり | ✅ | (対象外) | 削除機能に加えCreate/Update（監視設定管理）まで対応済み。読み書き一式が完備 |
| Database | ✅ あり | ✅ | ✅ | 起動/停止/再起動+削除+Create/Update/UpdateSettings/GetParameter/SetParameter+FEテストを追加済み（PR #81、2026-08-08 Tier2 #11） |
| EnhancedDB | ✅ あり | ✅ | (対象外) | 削除機能に加えCreate/Update/SetPassword（パスワード再設定）まで対応済み（2026-08-08 Tier2 #13） |
| NFS | ✅ あり | ✅ | ✅ | 完備。FEテストとResetを追加済み（PR #80） |
| ObjectStorage | ✅ あり | ✅（バケット・アクセスキー・アカウント） | (対象外) | バケット/アクセスキー/アカウントのCreate/Delete、Permissions API、バケット暗号化/レプリケーション/クォータ、S3 Put/DeleteObjectまで対応済み |
| ContainerRegistry | ✅ あり | ✅ | (対象外) | 削除機能+FEテスト(List/Detail)に加え、Create/Update・ユーザー管理(AddUser/UpdateUser/DeleteUser)まで対応済み。読み書き一式が完備 |
| AppRun (専有/共用) | ✅ あり | 専有型は✅（Cluster/App/ASG/LB/Certificate）、共用型は✅（App/Version） | (対象外) | 専有型・共用型ともFEテスト追加済み。専有型はCluster/ASG/LoadBalancer/Certificate全リソースのCreate系まで対応済み、共用型はCreate/Update/Delete/Traffic更新/サインアップまで対応済み |
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
- テスト: `DiskList.test.tsx`（一覧表示・削除確認フロー・キャンセル・未接続表示・作成モーダルの成功/失敗・カード クリックでの詳細遷移）、`DiskDetail.test.tsx`（基本情報表示・名前説明タグの編集・接続先サーバーへの接続/切断）ともに整備済み。`frontend/e2e/disk.spec.ts` で作成〜基本情報編集〜接続〜切断〜削除までのE2Eもカバー
- バックエンド: List/**Get**/**Create**/**Update**/**ConnectToServer**/**DisconnectFromServer**/Delete 実装済み
- ✅ **対応済み（2026-08-08 Tier2 #8）**: ディスクの新規作成（サイズ/プラン[SSD・HDD]/接続方式[virtio・ide]/コピー元アーカイブ/接続先サーバーを選択可能）、名前・説明・タグの編集、接続先サーバーの変更（ConnectToServer/DisconnectFromServer、Updateとは別APIのため専用UIを用意）を追加。`DiskDetail.tsx`を新設し一覧のカードクリックで遷移する導線を追加（従来はDetail画面が存在しなかった）
- SDK比較で残る不足: CreateWithConfig/Config（OSインストール設定）/ResizePartition/Monitor系（未着手、パワーユーザー向け機能のため優先度低）

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
- テスト: `PacketFilterList.test.tsx`（一覧表示・詳細遷移・削除確認・作成フロー）、`PacketFilterDetail.test.tsx`（名前・説明編集、ルール追加/編集/削除）ともに整備済み。`frontend/e2e/packetfilter.spec.ts` で作成〜ルール操作〜削除までのE2Eもカバー
- バックエンド: List/Get/**Create**/**Update**/**Delete** 実装済み
- ✅ **対応済み（PR #83）**: 削除機能を追加
- ✅ **対応済み（2026-08-08 Tier1）**: 作成（Create）、名前・説明編集、ルール（Expression）の追加・編集・削除を追加。Update APIはExpressionHashによる楽観ロックが必須のため、`internal/sakura/packetfilter.go`のUpdateは事前Readでハッシュを取得してから呼び出す。`PacketFilterList.tsx`に作成モーダル、`PacketFilterDetail.tsx`に基本情報インライン編集とルール管理UIを実装
- SDK比較で残る不足: なし（Read/Write一式が揃った）

### KMS
- テスト: `KMSList.test.tsx`（一覧表示・詳細遷移・削除確認・作成フロー）、`KMSDetail.test.tsx`（基本情報表示・編集・ローテーション・ステータス変更・キャンセル・失敗時のalert）ともに整備済み。`frontend/e2e/kms.spec.ts` で作成〜編集〜ローテーション/ステータス変更〜削除までのE2Eもカバー
- バックエンド: `internal/kms/service.go` に分離実装。List/**Get**/**Create**/**Update**/**Delete**/**Rotate**/**ChangeStatus** 実装済み（Goテスト `service_test.go` に対応する各テスト追加済み）
- app.go: `GetKMSKeys`/`GetKMSKey`/`CreateKMSKey`/`UpdateKMSKey`/`DeleteKMSKey`/`RotateKMSKey`/`ChangeKMSKeyStatus` を公開
- ✅ **対応済み（PR #90）**: 削除機能を追加
- ✅ **対応済み**: Get（詳細取得）/Rotate（ローテーション）/ChangeStatus（active/restricted/suspended切り替え）を追加。`KMSDetail.tsx`を新設し一覧の行クリックで遷移。あわせて`KMSList.tsx`のステータス表示が実際のAPI値（active/restricted/suspended/pending_destruction）と一致していなかった表示バグを修正
- ✅ **対応済み（2026-08-08 Tier2 #10）**: Create（名前・説明・キー起源[生成/インポート]・タグ）、Update（名前・説明・タグ編集）を追加。UpdateはKeyOrigin/Statusが不変かつAPIリクエストに必須のため、事前Readで現在値を引き継いでから送信する（GSLB/ProxyLB等と同じ設計）。あわせて`getKeyOriginName`が実際のAPI値（generated/imported）ではなく架空の値（sakura_kms/external）をチェックしており常にフォールバック表示になっていた表示バグを修正
- SDK比較で残る不足: ScheduleDestruction（削除予約）/Encrypt/Decrypt（未着手、暗号化APIは利用頻度が低いためTier3相当として保留）

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
- ✅ **対応済み（2026-08-08 Tier2 #9、PR #119）**: Create/Update/UpdateSettingsを追加。作成モーダル（名前・説明・プラン・リージョン・VIPフェイルオーバー）、基本情報のインライン編集、ヘルスチェック/Sorry Server/待ち受けポート/実サーバーの設定編集モーダルを実装。Update系APIは全設定を含むリクエスト構造のため、GSLB/SimpleMonitor等と同じく事前ReadでSettingsHashと未編集項目を取得してから送信する。あわせて`ProxyLBInfo`にHealthCheck/SorryServerを追加（従来欠けており、設定編集モーダルが実データではなくデフォルト値から初期化されるバグになるところだった）。`frontend/e2e/proxylb.spec.ts`にも作成・編集シナリオを追加
- SDK比較で残る不足: ChangePlan/MonitorConnection（トラフィックグラフ、未着手）
- **TODO**: トラフィック監視（MonitorConnection）は次点で検討

### SimpleMonitor
- テスト: `MonitorList.test.tsx`（一覧表示・詳細遷移・削除確認・作成フロー）、`MonitorDetail.test.tsx`（基本情報表示・説明編集・監視設定編集）ともに整備済み。`frontend/e2e/simplemonitor.spec.ts` で作成〜設定編集〜削除までのE2Eもカバー
- バックエンド: List/Get/**Create**/**Update**/**UpdateSettings**/Delete 実装済み
- ✅ **対応済み（PR #86）**: 削除機能を追加
- ✅ **対応済み**: Get（詳細取得）と `MonitorDetail.tsx`（基本情報・ヘルスチェック設定）を追加。一覧の行クリックで詳細へ遷移
- ✅ **対応済み（2026-08-08 Tier1）**: 監視の新規作成（Create）、説明編集（Update）、監視設定編集（UpdateSettings: チェック間隔・リトライ・タイムアウト・ヘルスチェック・メール/Slack通知）を追加。DNSと同様にUpdateはDescriptionのみ・UpdateSettingsは設定一式のみを担当する分割方式とした。`MonitorList.tsx`に作成モーダル、`MonitorDetail.tsx`に説明インライン編集と監視設定編集モーダルを実装
- SDK比較で残る不足: MonitorResponseTime（応答時間グラフ）/HealthStatus（未着手）

### Monitoring Suite（Monitoring.tsx / MonitoringMetricDetail.tsx / MetricGraph.tsx）
- テスト: `MonitoringMetricDetail.test.tsx`（基本情報表示・編集・削除・アクセスキー作成/削除・publisher切り替えとメトリクスのグルーピング表示・カスタムメトリクス・エラー分岐をカバー。`MetricGraph`はuPlot/canvas依存のため`vi.mock`でスタブ化）、`Monitoring.test.tsx`（ストレージ作成/削除フロー）ともに整備済み
- `MetricGraph.tsx` はuPlot依存が強くjsdomでの描画テストはコスト高のため未着手。フォーマッタ関数（formatBytes/formatPercent/detectMetricType）を切り出せば単体テスト可能
- バックエンド: Logs/Metrics/Traces/StorageDetail/AccessKeys/Prometheusクエリ系に加え、`internal/sakura/monitoring.go`に**Logs/Metrics/Traces各ストレージのCreate/Update(PartialUpdate)/Destroy**、**MetricsストレージのアクセスキーCreate/Destroy**を追加
- ✅ **対応済み（2026-08-09、Tier3 #19）**: ストレージ作成（`Monitoring.tsx`のタブ共通で「+ ストレージ作成」モーダル）・削除（一覧行の削除ボタン+確認ダイアログ）を追加。`MonitoringMetricDetail.tsx`にはストレージ名・説明のインライン編集、ストレージ削除（削除後は一覧へ遷移）、アクセスキー作成（Secret/Tokenは作成レスポンスでしか取得できないため一度きり表示モーダル）・削除を追加。Logs/Traces StorageはAPI(Create/Update/Destroy)のみ対応し、AccessKey管理は詳細画面が存在するMetricsのみに限定（既存のRead実装スコープを踏襲）。SDKのMetrics系Update(`MetricsStoragesPartialUpdate`)はPATCH的な部分更新のため、GSLB/ProxyLB等と異なり事前Read不要だった。詳細は`docs/ui-implementation-patterns.md`

---

## 3. Database / EnhancedDB / NFS / ObjectStorage

### Database（データベースアプライアンス）
- テスト: `DatabaseList.test.tsx`（一覧表示・ボタン活性制御・起動ポーリング・再起動・削除・作成フロー・カードクリックでの詳細遷移）、`DatabaseDetail.test.tsx`（基本情報表示・編集、稼働設定の表示・編集、DBパラメータの設定・リセット）ともに整備済み。`frontend/e2e/database.spec.ts` で作成〜基本情報/稼働設定編集〜DBパラメータ操作〜削除までのE2Eもカバー
- バックエンド: `internal/sakura/database.go` に**Get**/**Create**/**Update**/**UpdateSettings**/**GetParameter**/**SetParameter**を追加。List/PowerOn(Boot)/PowerOff(Shutdown)/ForceStop/Reset/Delete/GetStatusとあわせてapp.goで全て公開
- ✅ **対応済み（PR #81）**: NFS/Server相当の電源操作（起動/停止/再起動）と削除機能、FEテストを追加
- ✅ **対応済み（2026-08-08 Tier2 #11）**: プラン（10G〜1TB）・接続先スイッチ・IPアドレス・RDBMS種別（MariaDB/PostgreSQL）・管理ユーザーを指定した作成（Create）、名前・説明・タグの編集（Update、稼働設定は事前Readで維持したまま送信）、稼働設定（管理ユーザー・レプリカユーザー・ポート番号・接続許可ネットワーク・拡張監視機能）編集（UpdateSettings、パスワードは空欄なら既存値を維持）、DBパラメータの一覧・設定・リセット（GetParameter/SetParameter）を追加。`DatabaseDetail.tsx`を新設し一覧のカードクリックで遷移する導線を追加（従来はDetail画面が存在しなかった）。冗長化構成（Proxyプラン）やマスター/スレーブのレプリケーション設定は対象外とし、非冗長化の単体構成のみサポートする
- SDK比較で残る不足: Config/Monitor系（CPU/Disk/Interface/DB）/Status（未着手、パワーユーザー向け機能のため優先度低）

### EnhancedDB（強化版DB）
- テスト: `EnhancedDBList.test.tsx`（一覧表示・削除確認・作成フロー・カードクリックでの詳細遷移）、`EnhancedDBDetail.test.tsx`（基本情報表示・編集、パスワード再設定）ともに整備済み。`frontend/e2e/enhanceddb.spec.ts` で作成〜編集〜パスワード再設定〜削除までのE2Eもカバー
- バックエンド: `internal/sakura/enhanced_db.go` に**Get**/**Create**/**Update**/**SetPassword**を追加。List/Deleteとあわせてapp.goで全て公開
- ✅ **対応済み（PR #87）**: 削除機能を追加
- ✅ **対応済み（2026-08-08 Tier2 #13）**: DB名・DB種別（TiDB/MariaDB）・リージョン（石狩/東京）を指定した作成（Create）、名前・説明・タグの編集（Update、SettingsHashによる楽観ロックのため事前Read必須）、管理パスワードの再設定（SetPassword）を追加。`EnhancedDBDetail.tsx`を新設し一覧のカードクリックで遷移する導線を追加（従来はDetail画面が存在しなかった）
- SDK比較で残る不足: GetConfig/SetConfig（最大接続数・接続許可ネットワーク、パワーユーザー向け機能のため優先度低）

### NFS
- テスト: `NFSList.test.tsx` あり（確認ダイアログ・ボタン活性制御・ポーリング・再起動・削除・作成フローをカバー）。`frontend/e2e/nfs.spec.ts` で電源操作・削除・作成・編集までのE2Eもカバー
- バックエンド: `internal/sakura/nfs.go` に**Get**/**Create**/**Update**を追加。List/PowerOn/PowerOff/ForceStop/Reset/Delete/GetStatusとあわせてapp.goで全て公開
- ✅ **対応済み（PR #80）**: `NFSList.test.tsx`（最優先項目）とResetボタンを追加
- ✅ **対応済み（2026-08-08 Tier2 #12）**: 接続スイッチ・IPアドレス・ネットワーク設定・プラン（HDD/SSD）・サイズを指定した作成（Create）、名前・説明・タグの編集（Update）を追加。PlanIDはプランクラス+サイズから`sacloud-sdk-go`の`helper/query.FindNFSPlanID`（sys-nfsノートを検索）で解決する。`NFSDetail.tsx`を新設し一覧のカードクリックで遷移する導線を追加（従来はDetail画面が存在しなかった）
- SDK比較で残る不足: ChangePlan等のパワーユーザー向け機能（優先度低）

### ObjectStorage（オブジェクトストレージ）
- テスト: `ObjectStorageList.test.tsx`（sites→bucketsビュー遷移、シークレットキー保存とバケット自動取得、バケット作成/削除、アクセスキー作成〜Secret一度きり表示〜保存、アクセスキー削除、アカウント表示/削除、バケット設定モーダル・パーミッション管理モーダルの起動、オブジェクトのアップロード/削除の各フローをカバー。objectsビューの検索/ページネーション/プレビューは対象外）、`BucketSettingsModal.test.tsx`、`ObjectStoragePermissions.test.tsx`
- バックエンド: ListSites/ListAccessKeys/ListBuckets/ListObjects/DownloadObject/Preview系に加え、CreateBucket/DeleteBucket/CreateAccessKey/DeleteAccessKey、**ReadAccount/DeleteAccount**、**Permissions API一式**（List/Create/Update/Delete + アクセスキーList/Create/Delete）、**バケット暗号化/レプリケーション/クォータ**（Read/Enable/Disable）、**S3のUploadObject/DeleteObject** を実装
- ✅ **対応済み**: バケット作成/削除（`internal/sakura/objectstorage.go`の`CreateBucket`/`DeleteBucket`、`BucketAPI`経由）、アクセスキー作成/削除（`CreateAccessKey`/`DeleteAccessKey`、`AccountAPI`経由。アカウント未作成時は`CreateAccessKey`内で自動的にアカウント作成）。アクセスキーのSecretは作成レスポンスでしか取得できないため、フロントに一度きりの表示モーダルを追加し、`SaveObjectStorageSecretKey`（既存のキーチェーン保存）へ誘導するUXとした
- ✅ **対応済み（2026-08-09、Tier3 #18）**: Account Read/Delete、Permissions API全般（バケット単位read/write制御付きの、通常のアカウントアクセスキーとは独立したアクセスキー発行機構）、バケット暗号化/レプリケーション/クォータ、S3のPutObject/DeleteObject。詳細は下記「完了（2026-08-09 追加セッション28、Tier3 #18）」を参照

---

## 4. ContainerRegistry / AppRun / Bill

### ContainerRegistry（コンテナレジストリ）
- テスト: `ContainerRegistryList.test.tsx`（一覧表示・詳細遷移・削除確認・作成フロー）、`ContainerRegistryDetail.test.tsx`（基本情報表示・編集、ユーザー一覧・追加/編集/削除、パスワード保存/削除フロー・自動アクティブ化・イメージ/タグ一覧遷移）ともに整備済み。`frontend/e2e/containerregistry.spec.ts` で作成〜基本情報編集〜ユーザー管理〜削除までのE2Eもカバー
- バックエンド: List/**Create**/**Update**/**Delete**（レジストリ本体）、List/**AddUser**/**UpdateUser**/**DeleteUser**（ユーザー）実装済み。イメージ/タグ取得はOCI Registry APIを直叩きする別実装
- ✅ **対応済み（PR #89）**: レジストリ削除機能とListのFEテストを追加
- ✅ **対応済み（PR #95）**: `ContainerRegistryDetail.test.tsx` を追加
- ✅ **対応済み（2026-08-08 Tier1 #5）**: レジストリ作成（Create）、名前・説明・アクセスレベル・仮想ドメインの編集（Update、SettingsHashによる楽観ロックのため事前Read必須）、ユーザー管理（AddUser/UpdateUser/DeleteUser）を追加。`ContainerRegistryList.tsx`に作成モーダル、`ContainerRegistryDetail.tsx`に基本情報インライン編集とユーザー追加/編集/削除UIを実装。あわせて`ListContainerRegistryUsers`がユーザー0件のレジストリでnilポインタ参照を起こすバグ（fakeドライバがユーザー無しの場合`(nil, nil)`を返すことが原因）をE2Eテストで発見し修正
- SDK比較で残る不足: なし（Read/Write一式が揃った。AccessLevelは`readonly`/`none`のみが有効値でSDK上deprecated扱いのため`readwrite`は選択不可）

### AppRun（専有型 / 共用型）
- テスト: `AppRunSharedList.test.tsx` あり（ユーザー未設定時の案内・一覧表示・エラー表示・詳細遷移とコンポーネント/トラフィック/バージョン履歴表示・戻る操作をカバー）。`AppRunDedicatedList.test.tsx` も整備済み（cluster→app→version遷移とアクティブバージョン設定・ASGのLB/ワーカーノード表示・非アクティブ化/アクティブ化の成功・失敗フロー・Cluster/Application/ASG/LoadBalancerの削除確認〜成功・失敗フローをカバー。`lb` view単体はUI上到達経路が無く未カバー）
- バックエンド: `internal/apprun/`（専有型）・`internal/apprunshared/`（共用型）に分離実装。List/Read/`SetActiveVersion`/`ClearActiveVersion`/**CreateApplicationVersion**に加え、専有型はCluster/Application/ASG/LoadBalancerの**Delete**を実装
- ✅ **対応済み（2026-08-08 追加セッション6）**: AppRun専有型の削除機能一式を実装。`internal/apprun/service.go`に`DeleteCluster`/`DeleteApplication`/`DeleteAutoScalingGroup`/`DeleteLoadBalancer`を追加し、`app.go`に対応するRPCを公開。`AppRunDedicatedList.tsx`のクラスタ一覧・アプリ一覧・ASG一覧・LB一覧の各行に削除ボタンと確認ダイアログを追加
- ✅ **対応済み（2026-08-08 追加セッション11、Tier1 #6）**: AppRun専有型のVersion Create（デプロイ）を実装。`internal/apprun/service.go`にSDKの`version.CreateParams`を薄くラップした`CreateAppVersionParams`（CPU/Memory/ScalingMode+FixedScale or MinScale・MaxScale・閾値/Image/Cmd/RegistryUsername・Password/ExposedPorts(TargetPort/LoadBalancerPort/UseLetsEncrypt/Host/HealthCheck)/EnvVars(Key/Value/Secret)）と`CreateApplicationVersion`を追加、`app.go`に`CreateAppRunApplicationVersion`のRPCを公開。`AppRunDedicatedList.tsx`のバージョン一覧に「+ デプロイ」ボタンとフルデプロイフォーム（イメージ/コマンド/CPU・メモリ/スケーリングモード切替/公開ポート・ヘルスチェックの追加編集削除/環境変数の追加編集削除）を実装。`internal/apprun/service_test.go`に`sakumock/apprundedicated`のテストサーバーを使った`TestService_CreateApplicationVersion`を追加（実際のAPIリクエスト/レスポンスを検証）
- ✅ **対応済み（2026-08-08 追加セッション22、Tier2 #14一部）**: Version Delete（バージョン削除）を実装。`internal/apprun/service.go`に`DeleteApplicationVersion`を追加（SDKの`VersionOp.Delete`をラップ）、`app.go`に`DeleteAppRunApplicationVersion`のRPCを公開。`AppRunDedicatedList.tsx`のバージョン一覧テーブルに削除ボタンの列を追加し、バージョン詳細画面の「⋯」ドロップダウンにも削除項目を追加（削除後は自動でアプリ詳細画面に戻る）。アクティブバージョンは削除できないためボタンを無効化。`internal/apprun/service_test.go`に`TestService_DeleteApplicationVersion`、`AppRunDedicatedList.test.tsx`に一覧からの削除・アクティブバージョンのボタン無効化・詳細画面からの削除の3テストを追加
- ✅ **対応済み（2026-08-08 追加セッション23、Tier2 #14一部）**: Application Create・WorkerNode Update（draining）を実装。4つの残タスク（Cluster/Application/ASG/LoadBalancerのCreate、WorkerNode Update、Certificate系）のうち依存関係が最も単純（`Name`+`ClusterID`のみ）なApplication CreateとWorkerNode Updateを先行実装。`internal/apprun/service.go`に`CreateApplication`（SDKの`ApplicationOp.Create(ctx, name, clusterID)`をラップ）と`UpdateWorkerNodeDraining`（`WorkerNodeOp.Update(ctx, id, draining)`をラップ）を追加、`app.go`に`CreateAppRunApplication`/`UpdateAppRunWorkerNodeDraining`のRPCを公開。`AppRunDedicatedList.tsx`のクラスタ詳細画面に「+ アプリ作成」ボタンと作成モーダル（アプリ名のみ）、ASG詳細画面のワーカーノード一覧に「Draining開始/解除」トグルボタンを追加。`internal/apprun/service_test.go`に`TestService_CreateApplication`/`TestService_UpdateWorkerNodeDraining`を追加（sakumockはASG作成時にMinNodes分のワーカーノードを自動生成するため、既存の`TestService_DeleteAutoScalingGroup`と同じ`CreateAutoScalingGroup`シードで検証可能）
- ✅ **対応済み（2026-08-08 追加セッション24、Tier2 #15一部）**: 共用型のApplication Create・Update（スケール・タイムアウト設定）を実装。`internal/apprunshared/service.go`に`CreateApplication`/`UpdateApplication`を追加（SDKの`apprun.NewApplicationOp`が既に`Create`/`Update`を実装済みだった。コンポーネントは1件のみ（sakumockの`maxComponents=1`制約と一致）、MaxCPU/MaxMemoryは組み合わせ制約があるため任意の値の組ではなく`0.5`/`1`/`2`vCPUと`1Gi`/`2Gi`/`4Gi`から選択させるUIとした。Nameは作成時のみ指定可能でUpdate非対応）、`app.go`に`CreateAppRunSharedApplication`/`UpdateAppRunSharedApplication`のRPCを公開。`AppRunSharedList.tsx`に作成モーダル（アプリ名/ポート/スケール/タイムアウト/コンポーネント名/イメージ/CPU・メモリ/環境変数）と基本情報カードの「編集」ボタン（ポート/スケール/タイムアウトの編集モーダル）を追加。`internal/apprunshared/service_test.go`に`github.com/sacloud/sakumock/apprun`のテストサーバーを使った`TestService_CreateApplication`/`TestService_UpdateApplication`を追加、`frontend/e2e/apprun-shared.spec.ts`に作成・編集シナリオを追加
- ✅ **対応済み（2026-08-08 追加セッション25、Tier2 #15完了）**: 共用型の残りタスク（Application Delete・Version Delete・Traffic Update・User Create）を実装。SDKの`ApplicationOp.Delete`/`VersionOp.Delete`/`TrafficOp.Update`/`UserOp.Create`はいずれも既存実装済みだった。`internal/apprunshared/service.go`に`DeleteApplication`/`DeleteVersion`/`UpdateTraffics`/`CreateUser`を追加、`app.go`に対応する4つのRPCを公開。`AppRunSharedList.tsx`の一覧行に削除ボタン、バージョン履歴テーブルに削除ボタン、トラフィック分散カードに分散比率編集モーダル（合計100%のバリデーション付き）、ユーザー未設定時の案内画面に「AppRun共用型を利用開始する」サインアップボタンを追加。sakumockでは`UpdateApplication`(PATCH)を呼ぶたびに新しいバージョンが暗黙生成される仕様のため、`internal/apprunshared/service_test.go`の`TestService_DeleteVersion`ではCreate＋Update×2で3バージョンを作った上で「トラフィック分散対象でも最新版でもない」バージョンを実際に削除できるか試行して検証（作成時刻が同一秒に丸められうるため「最新版」の判定順に依存しない設計とした）。`frontend/e2e/apprun-shared.spec.ts`にアプリ削除シナリオを追加（バージョン削除・トラフィック変更のE2Eは、単一バージョンの状態では意味のある操作にならずsakumockの時刻丸め起因の不確実性もあるため対象外とし、Go側ユニットテストでのみカバー）
- ✅ **対応済み（2026-08-08 追加セッション26、Tier2 #14一部）**: 専有型のCluster Createを実装。`internal/apprun/service.go`に`CreateClusterParams`（Name/LetsEncryptEmail(任意)/Ports([]{Port,Protocol})/ServicePrincipalID）と`CreateCluster`（SDKの`ClusterOp.Create`をラップ）を追加、`app.go`に`CreateAppRunCluster`のRPCを公開。`AppRunDedicatedList.tsx`のクラスタ一覧に「+ クラスタ作成」ボタンと作成モーダル（クラスタ名/サービスプリンシパルID/Let's Encryptメール(任意)/待ち受けポートの追加編集削除）を実装。`internal/apprun/service_test.go`に`sakumock/apprundedicated`テストサーバーを使った`TestService_CreateCluster`、`AppRunDedicatedList.test.tsx`に作成・バリデーション・キャンセル・エラー表示の4テストを追加
- ✅ **対応済み（2026-08-08 追加セッション27、Tier2 #14一部）**: 専有型のASG(AutoScalingGroup) Createを実装。`internal/apprun/service.go`に`CreateASGParams`(Name/Zone/NameServers/WorkerServiceClassPath/MinNodes/MaxNodes/Interfaces([]{InterfaceIndex,Upstream,IPPool,NetmaskLen,DefaultGateway,PacketFilterID,ConnectsToLB}))と`CreateAutoScalingGroup`(SDKの`AutoScalingGroupOp.Create`をラップ)を追加、`app.go`に`CreateAppRunASG`のRPCを公開。`AppRunDedicatedList.tsx`のクラスタ詳細のASG一覧に「+ ASG作成」ボタンと作成モーダル(ASG名/ゾーン/ワーカープラン選択/最小・最大ノード数/ネームサーバー(1〜3件)/ネットワークインターフェース(1〜5件、`upstream`が`shared`の場合はIPプール等のネットワーク設定を隠し、それ以外の場合のみIPプール/ネットマスク長/デフォルトゲートウェイ/パケットフィルタIDを入力可能)を実装。ワーカープランはsakumockが許可する4種類の固定`workerServiceClassPath`(1vCPU/2GB〜8vCPU/8GB)からの選択式とした
- ✅ **対応済み（2026-08-08 追加セッション28、Tier2 #14一部）**: 専有型のLoadBalancer Createを実装。`internal/apprun/service.go`に`CreateLBParams`(Name/ServiceClassPath/NameServers/Interfaces([]{InterfaceIndex,Upstream,IPPool,NetmaskLen,DefaultGateway,Vip,VirtualRouterID,PacketFilterID}))と`CreateLoadBalancer`(SDKの`LoadBalancerOp.Create`をラップ)を追加、`app.go`に`CreateAppRunLoadBalancer`のRPCを公開。`AppRunDedicatedList.tsx`のASG詳細のLB一覧に「+ LB作成」ボタンと作成モーダル(LB名/プラン選択/ネームサーバー(1〜3件)/ネットワークインターフェース(1〜5件、ASG Createと同じく`upstream`が`shared`以外の場合のみIPプール/ネットマスク長/デフォルトゲートウェイ/VIP/仮想ルータID/パケットフィルタIDを入力可能)を実装。プランはsakumockが許可する4種類の固定`serviceClassPath`(1vCPU/2GB〜2vCPU/2GB、通常/冗長構成)からの選択式とした。これで専有型のCreate系(Cluster/ASG/LoadBalancer)は全て完了
- ✅ **対応済み（2026-08-08 追加セッション29、Tier2 #14完了）**: 専有型のCertificate系（List/Create/Update/Delete）を実装。`internal/apprun/service.go`に`CreateCertificateParams`(Name/CertificatePEM/PrivateKeyPEM/IntermediateCertificatePEM(任意))と`ListCertificates`/`CreateCertificate`/`UpdateCertificate`/`DeleteCertificate`（SDKの`CertificateOp`をラップ）を追加、`app.go`に4つのRPCを公開。新規Viewは追加せず、クラスタ詳細画面（`view.type === 'cluster'`）にアプリケーション/ASGと並ぶ「証明書」セクションを新設し、作成/編集/削除モーダルを実装。**設計ポイント**: SDKの`UpdateParams`は`CreateParams`の型エイリアス（`type UpdateParams CreateParams`）で部分更新に対応しておらず、`Read`レスポンスにもPEM本体は含まれない（証明書メタデータ`CommonName`/`SubjectAlternativeNames`/有効期限のみ）ため、更新時も証明書・秘密鍵PEMを毎回再入力する必要がある設計とし、編集モーダルにその旨の注記を表示した
- SDK比較で残る不足:
  - 専有型: なし（Read/Write一式が揃った。**これでTier2 #14は全項目完了**）
  - 共用型: なし（Read/Write一式が揃った）
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

### ✅ 完了（2026-08-08 追加セッション7、Tier1 #2）
- PacketFilterのCreate/Update（ルール管理）を実装。`internal/sakura/packetfilter.go`に`Create`/`Update`を追加（UpdateはExpressionHashによる楽観ロックのため事前Read必須）、`app.go`に`CreatePacketFilter`/`UpdatePacketFilter`のRPCを公開。`PacketFilterList.tsx`に作成モーダル、`PacketFilterDetail.tsx`に名前・説明のインライン編集とルール（プロトコル/送信元/ポート/アクション/説明）の追加・編集・削除UIを実装。`PacketFilterDetail.test.tsx`を新規作成し、`frontend/e2e/packetfilter.spec.ts`でE2Eシナリオも追加

### ✅ 完了（2026-08-08 追加セッション9、Tier1 #4）
- GSLBのCreate/Update/UpdateSettings（振り分け先サーバー・ヘルスチェック管理）を実装。`internal/sakura/global.go`に`CreateGSLB`/`UpdateGSLB`/`UpdateGSLBSettings`を追加（SettingsHashによる楽観ロックのため事前Read必須、`toGSLBInfo`ヘルパーでList/Get/Create/Update間の変換ロジックを共通化）、`app.go`に対応するRPCを公開。`GSLBList.tsx`に作成モーダル、`GSLBDetail.tsx`に名前・説明のインライン編集と監視設定編集モーダル（Sorry Server/監視間隔/重み付け/ヘルスチェック/振り分け先サーバーの追加・編集・削除、UpdateSettings APIが全件置換のためサーバー一覧もフォーム内で一括編集）を実装。`GSLBDetail.test.tsx`を新規作成し、`frontend/e2e/gslb.spec.ts`でE2Eシナリオも追加

### ✅ 完了（2026-08-08 追加セッション10、Tier1 #5）
- ContainerRegistryのCreate/Update・ユーザー管理（AddUser/UpdateUser/DeleteUser）を実装。`internal/sakura/global.go`に`CreateContainerRegistry`/`UpdateContainerRegistry`（SettingsHashによる楽観ロックのため事前Read必須、`toContainerRegistryInfo`ヘルパーで変換ロジックを共通化）と`AddContainerRegistryUser`/`UpdateContainerRegistryUser`/`DeleteContainerRegistryUser`を追加、`app.go`に対応するRPCを公開。`ContainerRegistryList.tsx`に作成モーダル（名前/説明/アクセスレベル/仮想ドメイン）、`ContainerRegistryDetail.tsx`に基本情報インライン編集とユーザー追加/編集（権限変更・パスワードリセット）/削除UIを実装。`frontend/e2e/containerregistry.spec.ts`でE2Eシナリオを追加した際、ユーザー0件のレジストリで`ListContainerRegistryUsers`がnilポインタ参照を起こす既存バグ（fakeドライバが`(nil, nil)`を返すケースを未考慮）を発見・修正

### ✅ 完了（2026-08-08 追加セッション11、Tier1 #6）
- AppRun専有型のVersion Create（デプロイ）を実装。フルデプロイフォーム（イメージ/コマンド/CPU・メモリ/スケーリングモード[固定 or CPU使用率]/公開ポート・ヘルスチェック/環境変数）で対応。バックエンド・フロント双方の実装詳細は上記「AppRun（専有型 / 共用型）」節を参照。`internal/apprun/service_test.go`に`sakumock/apprundedicated`テストサーバーを使った実APIリクエストの検証テストを追加

### ✅ 完了（2026-08-08 追加セッション12、Tier2 #8）
- DiskのCreate/Update/ConnectToServer/DisconnectFromServerを実装。`internal/sakura/disk.go`にGet/Create/Update/ConnectToServer/DisconnectFromServerを追加（DiskUpdateRequestに楽観ロック用フィールドはないため事前Read不要）、`app.go`に対応する5つのRPCを公開。`DiskDetail.tsx`を新設（従来Detail画面が存在しなかった）し、`DiskList.tsx`に作成モーダル（サイズ/プラン/接続方式/コピー元アーカイブ/接続先サーバー）とカードクリックでの詳細遷移を追加。接続先サーバー変更はUpdate APIではなくConnectToServer/DisconnectFromServerという別APIのため、Detail画面に専用の「接続先サーバー」編集UIを実装。`internal/sakura/disk_test.go`（fakeドライバ、`fake.InitDataStore`がプロセス内で一度しか初期化されない点に注意しテスト間で共有されるデータストアを前提に記述）、`DiskList.test.tsx`/`DiskDetail.test.tsx`、`frontend/e2e/disk.spec.ts`を追加

### ✅ 完了（2026-08-08 追加セッション13、Tier2 #11）
- DatabaseのCreate/Update/UpdateSettings/GetParameter/SetParameterを実装。`internal/sakura/database.go`にGet/Create/Update/UpdateSettings/GetParameter/SetParameterを追加（Update/UpdateSettingsはGSLB等と同じく事前Readで既存の稼働設定を維持したまま送信、UpdateSettingsのパスワード欄は空欄なら既存値を維持するフォールバックを実装）、`app.go`に対応する6つのRPCを公開。`DatabaseDetail.tsx`を新設（従来Detail画面が存在しなかった）し、`DatabaseList.tsx`に作成モーダル（プラン/接続先スイッチ/IPアドレス/RDBMS種別/管理ユーザー等）とカードクリックでの詳細遷移を追加。冗長化構成（Proxyプラン）・マスター/スレーブのレプリケーション設定は対象外とした。`internal/sakura/database_test.go`、`DatabaseList.test.tsx`/`DatabaseDetail.test.tsx`、`frontend/e2e/database.spec.ts`を追加。あわせてE2Eシード投入時に`Database.Conf`が未設定だとfakeドライバの`GetParameter`がnilポインタ参照でpanicするSDK側バグを発見し、シードデータに`Conf`/`CommonSetting`を設定して回避（詳細は`docs/upstream-issues.md`参照）

### ✅ 完了（2026-08-08 追加セッション24、Tier2 #15一部）
- AppRun共用型のApplication Create・Update（スケール・タイムアウト設定）を実装。詳細は上記「AppRun（専有型 / 共用型）」節を参照

### ✅ 完了（2026-08-08 追加セッション25、Tier2 #15完了）
- AppRun共用型の残りタスク（Application Delete・Version Delete・Traffic Update・User Create）を実装。詳細は上記「AppRun（専有型 / 共用型）」節を参照

### ✅ 完了（2026-08-08 追加セッション21、Tier2 #13）
- EnhancedDBのCreate/Update/SetPasswordを実装。`internal/sakura/enhanced_db.go`にGet/Create/Update/SetPasswordを追加（UpdateはSettingsHashによる楽観ロックが必要なため事前Read、GSLB/ProxyLB等と同じパターン）、`app.go`に対応する4つのRPCを公開。`EnhancedDBDetail.tsx`を新設（従来Detail画面が存在しなかった）し、`EnhancedDBList.tsx`に作成モーダル（名前/説明/DB名/DB種別[TiDB・MariaDB]/リージョン[石狩・東京]/タグ）とカードクリックでの詳細遷移を追加。パスワード再設定は詳細画面に専用フォーム+確認ダイアログを実装。`EnhancedDBList.test.tsx`拡充、`EnhancedDBDetail.test.tsx`新規追加、`frontend/e2e/enhanceddb.spec.ts`を追加

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
2. ✅ PacketFilter: Create/Update（ルール追加・編集） — 2026-08-08対応済み
3. ✅ SimpleMonitor: Create/Update/UpdateSettings（監視対象の追加・設定変更） — 2026-08-08対応済み
4. ✅ GSLB: Create/Update/UpdateSettings — 2026-08-08対応済み
5. ✅ ContainerRegistry: Create、Update、ユーザー管理（AddUser/UpdateUser/DeleteUser） — 2026-08-08対応済み
6. ✅ AppRun専有型: Version Create（デプロイ） — 2026-08-08対応済み

### ✅ 完了（2026-08-08 追加セッション22、Tier2 #14一部）
- AppRun専有型のVersion Delete（バージョン削除）を実装。詳細は上記「AppRun（専有型 / 共用型）」節を参照

**Tier 2: リソース新規作成系（入力項目・依存関係が多くフォーム設計コストが高い、または実インフラ作成を伴い課金・削除確認等の設計が必要）**
7. ✅ Switch: Create/Update — 2026-08-08対応済み
8. ✅ Disk: Create/Update/ConnectToServer/DisconnectFromServer — 2026-08-08対応済み（CreateWithConfigは対象外、Tier3相当として保留）
9. ✅ ProxyLB: Create/Update/UpdateSettings — 2026-08-08対応済み
10. ✅ KMS: Create/Update — 2026-08-08対応済み
11. ✅ Database: Create/Update/UpdateSettings/GetParameter/SetParameter — 2026-08-08対応済み
12. ✅ NFS: Create/Update — 2026-08-08対応済み
13. ✅ EnhancedDB: Create/Update/SetPassword — 2026-08-08対応済み
14. ✅ AppRun専有型: 全項目対応済み（VersionのDelete、Application Create、WorkerNodeのUpdate（draining）、Cluster Create、ASG Create、LoadBalancer Create、Certificate系、いずれも2026-08-08対応済み）
15. ✅ AppRun共用型: ApplicationのDelete、VersionのDelete、TrafficのUpdate、UserのCreate — 2026-08-08対応済み（ApplicationのCreate/Updateも2026-08-08対応済み、Tier2 #15完了）

**Tier 3: 低優先度・ニッチ or 複雑度が高い機能**
16. ✅ Server: ChangePlan/InsertCDROM/EjectCDROM/SendKey/SendNMI/GetVNCProxy等パワーユーザー向け機能 — 2026-08-08対応済み
17. ✅ Archive: Create/CreateBlank/CreateFromShared/Share/OpenFTP/CloseFTP — 2026-08-08対応済み
18. ✅ ObjectStorage: AccountのRead/Delete、PermissionsAPI全般、暗号化/レプリケーション/クォータ設定、S3側のPutObject/DeleteObject — 2026-08-09対応済み
19. ✅ Monitoring Suite: ストレージ・アクセスキーのCreate/Update/Destroy — 2026-08-09対応済み
20. ProxyLB: ChangePlan/MonitorConnection（トラフィックグラフ）
21. Bill: ByContractYear/ByContractYearMonth（期間絞り込み）/DetailsCSV

**Tier 4: ドキュメント整備（機能追加ではないが、書き込み系機能が一通り揃った段階でユーザーから提案。2026-08-09追加）**

22. スクショ付きユーザーマニュアルの整備（Playwrightベース）— 各リソースの主要な操作フロー（作成・編集・削除等）をスクリーンショット付きで説明するユーザー向けドキュメントが現状無い。[[sakpilot-e2e-testing]]で整備済みのE2Eテスト基盤（`frontend/e2e/*.spec.ts`、`go run -tags e2e .`）を流用してスクリーンショットを撮る運用を想定。未着手。着手時は「既存のE2E specにスクショ撮影ステップを追記する形」か「専用のドキュメント生成スクリプトを別途書く形」かをユーザーに相談してからスコープを決めること

### ✅ 完了（2026-08-08 追加セッション26、Tier3 #16）
- ServerのChangePlan/InsertCDROM/EjectCDROM/SendKey/SendNMI/GetVNCProxyを実装。`internal/sakura/server.go`に各メソッドを追加（ChangePlanはAPI仕様上サーバーIDが再採番されるため戻り値のIDが変わる点に注意、CD-ROM一覧取得用に`internal/sakura/cdrom.go`を新設）、`app.go`に対応する7つのRPCを公開。`ServerDetail.tsx`を新設（従来Detail画面が存在しなかった）し、`ServerList.tsx`のカードクリックで遷移するようにした。プラン変更フォーム、CD-ROM挿入/排出、コンソールキー送信（プリセット+NMI確認ダイアログ）、VNC接続情報取得UIを実装。あわせて`internal/sakura/server.go`に残っていた`println`デバッグ文を削除。`internal/sakura/server_test.go`、`ServerDetail.test.tsx`、`frontend/e2e/server-detail.spec.ts`を追加

### ✅ 完了（2026-08-08 追加セッション27、Tier3 #17）
- ArchiveのCreate（ディスク/既存アーカイブからのコピー）、CreateBlank（空のアーカイブ作成、アップロード用FTP接続情報を返す）、OpenFTP/CloseFTP、Share（共有キー発行）、CreateFromShared（共有キーを使ったゾーン間複製）を実装。`internal/sakura/archive.go`に各メソッドを追加し、`app.go`に対応する6つのRPCを公開。
- WailsのTS変換は「戻り値がerror以外に2つ以上ある場合の型付けが正しく生成されない」ことが判明したため（`.d.ts`上は最初の戻り値の型しか出ない）、CreateBlankは`*ArchiveInfo, *FTPServerInfo, error`ではなく`ArchiveWithFTP{Archive, FTPServer}`という単一構造体を返す形に設計。他のGo→TS RPCを増やす際もこの制約に注意すること（upstream-issues.md行き案件ではなくWails自体の制約）。
- 共有キーの形式は`ゾーン名:元アーカイブID:トークン`（`types.ArchiveShareKey`）。CreateFromShared時の複製先ゾーンはゾーン名からSDKの`types.ZoneIDs`で数値IDに変換して渡す。
- `ArchiveList.tsx`に「+ アーカイブ作成」（空/ディスクから/既存アーカイブからの3方式）、「共有キーから複製」ボタン、行ごとの「共有」「FTP」ボタンを追加。`internal/sakura/archive_test.go`（Goテスト5件）、`ArchiveList.test.tsx`への追加テスト5件で検証

### ✅ 完了（2026-08-09 追加セッション28、Tier3 #18）
- ObjectStorageのAccount Read/Delete、PermissionsAPI全般（Permission自体のList/Create/Update/Delete、およびPermission配下のアクセスキーList/Create/Delete）、バケットの暗号化（Read/Enable/Disable）・レプリケーション（Read/Enable/Disable）・クォータ（Read）、S3側のPutObject/DeleteObjectを実装。`internal/sakura/objectstorage.go`に各メソッドを追加し、`app.go`に対応する18個のRPCを公開。既存の`ListObjects`/`DownloadObject`等5箇所に重複していたS3クライアント構築処理を`newS3Client`ヘルパーに集約。
- Permissionは通常のアカウントアクセスキー（token/secret）とは独立した、バケット単位read/write制御付きの別系統のアクセスキー発行機構。SDK上の`PermissionID`はint64のため、フロント向けDTOでは`strconv.FormatInt`で文字列化している。
- バケットの暗号化・レプリケーションはsakumockでは未設定時に404を返す仕様のため、`saclient.IsNotFoundError`で判定して`Enabled: false`として返すようにした（エラーではなく正常系として扱う）。
- フロントに`BucketSettingsModal.tsx`（暗号化/レプリケーション/クォータの表示・切り替え）、`ObjectStoragePermissions.tsx`（パーミッションCRUD＋アクセスキー発行管理）を新設し、`ObjectStorageList.tsx`のバケット一覧に「設定」ボタン、サイトヘッダーに「パーミッション管理」ボタン、アカウントコード表示＋削除ボタンを追加。オブジェクト一覧にはアップロード（ファイル選択ダイアログ）・削除ボタンを追加。
- S3のPutObject/DeleteObjectはsakumockのS3データプレーンが外部`versitygw`バイナリ依存のオプトイン機能のため、既存の`ListObjects`/`DownloadObject`同様ユニットテスト対象外とした（E2Eでも同じ理由で従来から対象外）。`internal/sakura/objectstorage_test.go`にAccount/Permissions/暗号化/レプリケーション/クォータのGoテスト8件、`BucketSettingsModal.test.tsx`/`ObjectStoragePermissions.test.tsx`/`ObjectStorageList.test.tsx`にフロントテストを追加して検証

### ✅ 完了（2026-08-09 追加セッション29、Tier3 #19）
- Monitoring SuiteのLogs/Metrics/Traces各ストレージのCreate/Update/Destroy、MetricsストレージのアクセスキーCreate/Destroyを実装。`internal/sakura/monitoring.go`に各メソッドを追加し、`app.go`に対応する11個のRPCを公開。SDKの`monitoring-suite/apis/v1`は3種のストレージ全てに対称的なCreate/Destroy/PartialUpdate APIが揃っており（`LogsStoragesCreate`/`MetricsStoragesCreate`/`TracesStoragesCreate`等）、他リソースと異なりUpdateはPATCH的な部分更新（`PartialUpdate`）のため事前Read不要だった。
- アクセスキーのSecretは作成レスポンス（`WrappedMetricsStorageAccessKey.Secret`）でしか取得できないため、ObjectStorageと同様に一覧用DTO（`MSMetricsAccessKey`）とは別に作成専用DTO（`MSMetricsAccessKeyCreated`）を用意し、フロントで一度きり表示モーダルを実装（キーチェーン保存導線は無し、表示のみ）。
- `Monitoring.tsx`にタブ（ログ/メトリクス/トレース）共通の「+ ストレージ作成」モーダルと行削除ボタンを追加。`MonitoringMetricDetail.tsx`にはストレージ名・説明のインライン編集（`editingBasic`パターン）、ストレージ削除（削除後は一覧へ`navigate`）、アクセスキーの作成・削除を追加。AccessKey管理はDetail画面が存在するMetricsストレージのみに限定し、Logs/Tracesはストレージ自体のCRUDのみ対応（既存のRead実装スコープの非対称性を踏襲した意図的な判断）
- `MonitoringMetricDetail.test.tsx`にuseNavigateのための`MemoryRouter`ラップを追加（既存7テストが`useNavigate() may be used only in the context of a <Router>`で全滅していたのを機に修正）、編集・削除・アクセスキー作成/削除の4テストを追加。`Monitoring.test.tsx`を新規作成（作成/削除/キャンセルフロー5テスト）
- ユーザーの要望を受け、各サービスで積み重ねてきたUI実装パターン（editingBasic単一フォーム編集、SettingsHash事前Read+楽観ロック、一度きりSecret表示モーダル等）を`docs/ui-implementation-patterns.md`に整理して追加
- `golangci-lint run`（0 issues）/`go build`/`go vet`/`go test ./...`/`tsc --noEmit`/`npm run test`（264件全パス）/`wails build -tags webkit2_41`を確認してから作成
