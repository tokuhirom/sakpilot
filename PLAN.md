# SakPilot リソース精査 PLAN

各リソース（コンポーネント）ごとに、以下の3観点で現状を精査した結果と、今後の対応案をまとめる。

1. **フロントエンドのテストカバレッジ**（Vitest + RTL、`CLAUDE.md` の方針に基づく）
2. **バックエンド実装状況**（`internal/sakura/` 等、List/Get/Create/Update/Delete・電源操作の有無、`app.go` でのRPC公開）
3. **sacloud-sdk-go との突き合わせ**（SDK上は存在するが未実装の機能。特に削除・電源操作系を重視）

調査時点: 2026-08-07。SDKは `github.com/sacloud/sacloud-sdk-go v0.0.1`（`api/iaas`, `api/object-storage`, `api/apprun*`, `api/kms` 等を内包する統合モジュール）。

## サマリ表

| リソース | FEテスト | 削除機能 | 電源操作 | 総評 |
|---|---|---|---|---|
| Server | ✅ あり | ✅ | ✅（Reset欠） | ほぼ完備。Resetのみ欠落 |
| Disk | ❌ なし | ✅ | (対象外) | Create/Update/接続変更が未実装 |
| Archive | ❌ なし | ✅ | (対象外) | Create/共有/FTP転送が未実装 |
| Switch | ❌ なし | ❌ **なし** | (対象外) | 完全に読み取り専用 |
| PacketFilter | ❌ なし | ❌ **なし** | (対象外) | 完全に読み取り専用 |
| KMS | ❌ なし | ❌ **なし** | (対象外) | List専用。Get/Rotate/暗号化等すべて未実装 |
| DNS | ❌ なし | ❌ **なし** | (対象外) | List/Getのみ |
| GSLB | ❌ なし | ❌ **なし** | (対象外) | List/Getのみ |
| ProxyLB | ❌ なし | ❌ **なし** | (対象外) | List/Get/Healthのみ、証明書管理も欠落 |
| SimpleMonitor | ❌ なし | ❌ **なし** | (対象外) | List専用。Get(詳細)すら未実装 |
| Database | ❌ なし | ❌ **なし** | ❌ **なし** | List専用 |
| EnhancedDB | ❌ なし | ❌ **なし** | (対象外) | List専用 |
| NFS | ❌ なし | ✅ | ✅（Reset欠） | バックエンドは充実、FEテストが穴 |
| ObjectStorage | ❌ なし | ❌ **なし** | (対象外) | 閲覧・DLのみ。バケット/キー作成削除が丸ごと未実装 |
| ContainerRegistry | ❌ なし | ❌ **なし** | (対象外) | Listのみ。イメージ/タグ取得は別実装 |
| AppRun (専有/共用) | ❌ なし | ❌ **なし** | (対象外) | 閲覧＋アクティブバージョン切替のみ |
| Bill | ❌ なし | (対象外) | (対象外) | 読み取り専用リソースなので概ね妥当 |

**全17リソース中、フロントエンドテストが存在するのは Server のみ。**

---

## 1. Compute / Network 系

### Server
- テスト: `ServerList.test.tsx` あり（確認ダイアログ・ポーリング等カバー済み）
- バックエンド: List/PowerOn(Boot)/PowerOff(Shutdown)/ForceStop/Delete/GetStatus 実装済み、app.goで全て公開
- SDK比較で不足: **Reset（再起動）**、ChangePlan、Monitor/MonitorCPU、InsertCDROM/EjectCDROM、SendKey/SendNMI、GetVNCProxy、Create、Update、DeleteWithDisks
- 備考: `server.go` に `println` デバッグ文が複数残存（要クリーンアップ）
- **TODO**: Reset（再起動）ボタンの追加を優先検討

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
- テスト: なし。読み取り専用コンポーネントで状態遷移がなく、現状は無理にテスト不要
- バックエンド: List/Get のみ。**Create/Update/Delete が丸ごと未実装**
- SDK比較で不足: Create/Update/Delete/ConnectToBridge/DisconnectFromBridge/GetServers
- **TODO**: 削除機能の追加を検討（追加時はDiskList相当のテストも必要）

### PacketFilter
- テスト: なし。読み取り専用で現状は無理にテスト不要
- バックエンド: List/Get のみ。**Create/Update/Delete が丸ごと未実装**
- SDK比較で不足: Create/Update/Delete（ルール追加・編集も不可）
- **TODO**: 削除機能の追加を検討

### KMS
- テスト: なし。現状List表示のみのため無理にテスト不要
- バックエンド: `internal/kms/service.go` に分離実装（Goテスト `service_test.go`/`helpers_test.go` は整備済み）。**List のみ**実装
- app.go: `GetKMSKeys` のみ公開
- SDK比較で不足: Read（Get）/Create/Update/**Delete**/Rotate（ローテーション）/ChangeStatus（有効化・無効化）/ScheduleDestruction（削除予約）/Encrypt/Decrypt
- **TODO**: 少なくとも詳細取得（Get）と削除（Delete/ScheduleDestruction）の実装を検討。フロントにテストがないので追加実装時にあわせて整備

---

## 2. DNS / GSLB / ProxyLB / 監視系

### DNS
- テスト: なし。読み取り専用ビューアーとして完結しており現状は無理にテスト不要
- バックエンド: List/Get のみ。**Create/Update/Delete が丸ごと未実装**
- SDK比較で不足: Create/Update/UpdateSettings/**Delete**（レコード追加・編集、ゾーン削除ができない）
- **TODO**: DNS管理はさくらのクラウドの中心機能の一つ。削除機能の追加を優先検討

### GSLB
- テスト: なし。現状は無理にテスト不要
- バックエンド: List/Get のみ。**Create/Update/Delete が丸ごと未実装**
- SDK比較で不足: Create/Update/UpdateSettings/**Delete**
- **TODO**: 削除機能の追加を検討

### ProxyLB（エンハンスドロードバランサ）
- テスト: なし。`ProxyLBList.tsx` は list/detail のビュー切り替え、ヘルス情報の非同期読み込み、`useGlobalReload` のビュー別分岐など状態遷移・分岐ロジックが多く、**テストを書く価値が高い**
- バックエンド: List/Get/GetHealth のみ。**Create/Update/Delete が丸ごと未実装**
- SDK比較で不足: Create/Update/UpdateSettings/**Delete**/ChangePlan/**証明書管理**（GetCertificates/SetCertificates/DeleteCertificates/RenewLetsEncryptCert）/MonitorConnection（トラフィックグラフ）
- **TODO**: `ProxyLBList.test.tsx` を追加。証明書管理・トラフィック監視はHTTPS運用上重要なため優先度高め

### SimpleMonitor
- テスト: なし。詳細ビュー自体が未実装で分岐も薄く、現状は無理にテスト不要
- バックエンド: **List のみ**（詳細取得＝Getすら未実装）
- SDK比較で不足: Create/Read/Update/UpdateSettings/**Delete**/MonitorResponseTime（応答時間グラフ）/HealthStatus
- **TODO**: 詳細ページ（Get）の追加を優先検討。監視対象の設定内容・応答時間グラフが見えないのは運用上の穴

### Monitoring Suite（Monitoring.tsx / MonitoringMetricDetail.tsx / MetricGraph.tsx）
- テスト: なし。`MonitoringMetricDetail.tsx` はpublisher切り替え・メトリクスのグルーピング（useMemo）・エラー分岐があり、**テストを書く価値がある候補**
- `MetricGraph.tsx` はuPlot依存が強くjsdomでの描画テストはコスト高。フォーマッタ関数（formatBytes/formatPercent/detectMetricType）を切り出せば単体テスト可能
- バックエンド: Logs/Metrics/Traces/StorageDetail/AccessKeys/Prometheusクエリ系はRead系のみ実装。ストレージ・アクセスキーの Create/Update/Destroy は未実装
- **TODO**: `MonitoringMetricDetail.test.tsx` を追加（優先度中）

---

## 3. Database / EnhancedDB / NFS / ObjectStorage

### Database（データベースアプライアンス）
- テスト: なし。表示専用のため現状は無理にテスト不要
- バックエンド: **List のみ**。Get/Create/Update/Delete/電源操作（Boot/Shutdown/Reset）すべて未実装
- SDK比較で不足: Create/Read/Update/UpdateSettings/**Delete**/Config/**Boot/Shutdown/Reset**/Monitor系/Status/GetParameter/SetParameter
- **TODO**: NFSと同水準（電源操作＋削除）の機能追加を検討。管理UIとして最も手薄なリソースの一つ

### EnhancedDB（強化版DB）
- テスト: なし。表示専用のため現状は無理にテスト不要。電源操作は仕様上そもそも不要
- バックエンド: **List のみ**
- SDK比較で不足: Create/Read/Update/**Delete**/SetPassword（パスワード変更）/GetConfig/SetConfig
- **TODO**: 削除・パスワード変更機能の追加を検討

### NFS
- テスト: なし。`NFSList.tsx` は確認ダイアログ（起動/停止/削除）、ボタン活性制御、ポーリング、`pendingNFS` による楽観的UI更新など `ServerList.tsx` と同水準のロジックを持ち、**方針が名指しする「一覧+アクション系」の典型例。最優先でテストを追加すべき**
- バックエンド: List/PowerOn/PowerOff/ForceStop/Delete/GetStatus 実装済み、app.goで全て公開
- SDK比較で不足: Create/Update/**Reset**（Serverと同様、再起動のみ欠落）
- **TODO**: `NFSList.test.tsx` を追加（最優先）。Resetボタンの追加も検討

### ObjectStorage（オブジェクトストレージ）
- テスト: なし。sites→buckets→objects の3段階遷移、パンくずナビゲーション、アクセスキー/シークレットキー管理、ページネーション、検索の遅延ロードなど**4リソース中もっともロジック濃度が高く、テストを書く価値が非常に高い**
- バックエンド: ListSites/ListAccessKeys/ListBuckets/ListObjects/DownloadObject/Preview系 実装済み。**Create/Update/Delete は丸ごと未実装**（バケット作成/削除、アクセスキー作成/削除、オブジェクトアップロード/削除なし）
- SDK比較で不足: BucketAPIのCreate/**Delete**、AccountAPIのCreate/Read/Delete、AccessKeyのCreate/Read/**Delete**、PermissionsAPI全般、暗号化/レプリケーション/クォータ設定、S3側のPutObject/DeleteObject
- **TODO**: `ObjectStorageList.test.tsx` を追加（優先度高、実装コストも高い）。バケット・アクセスキーの削除機能は次点で検討

---

## 4. ContainerRegistry / AppRun / Bill

### ContainerRegistry（コンテナレジストリ）
- テスト: なし。`ContainerRegistryList.tsx` は分岐が薄く優先度低いが、`ContainerRegistryDetail.tsx` はview切り替え・パスワード保存/削除フロー・資格情報保存後の自動アクティブ化など状態遷移が多く**テストを書く価値が高い**
- バックエンド: List（レジストリ本体・ユーザー）のみ。イメージ/タグ取得はOCI Registry APIを直叩きする別実装
- SDK比較で不足: Create/Read（単体）/Update/UpdateSettings/**Delete**/AddUser/UpdateUser/DeleteUser（レジストリ自体の作成・削除・ユーザー管理が丸ごと不可）
- **TODO**: `ContainerRegistryDetail.test.tsx` を追加。削除・ユーザー管理機能の追加を検討

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

## 優先度まとめ

### フロントエンドテスト追加（優先度順）
1. `NFSList.test.tsx` — ServerListとほぼ同構造で、方針が最も強く推奨するパターンなのに未着手
2. `ObjectStorageList.test.tsx` — ロジック濃度最大
3. `AppRunDedicatedList.test.tsx` — 分岐の複雑さが最大
4. `DiskList.test.tsx` / `ArchiveList.test.tsx` — 削除確認+ボタン活性制御
5. `ProxyLBList.test.tsx` / `ContainerRegistryDetail.test.tsx` / `AppRunSharedList.test.tsx` / `MonitoringMetricDetail.test.tsx`

### バックエンド機能追加（優先度順）
1. **削除機能が丸ごと欠落**しているリソース: Switch, PacketFilter, KMS, DNS, GSLB, ProxyLB, SimpleMonitor, Database, EnhancedDB, ObjectStorage(バケット/キー), ContainerRegistry, AppRun
2. **電源操作（Reset/再起動）**が欠落: Server, NFS
3. **電源操作が丸ごと欠落**: Database（Boot/Shutdown/Reset）
4. その他: SimpleMonitorの詳細取得（Get）、ProxyLBの証明書管理、KMSのRotate/ChangeStatus/暗号化

### その他
- `internal/sakura/server.go` の `println` デバッグ文の削除（別issueとして切り出し推奨）
