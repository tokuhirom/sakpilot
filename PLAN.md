# SakPilot 未実装サービス 実装計画

`sacloud-sdk-go`（`github.com/sacloud/sacloud-sdk-go v0.0.1`）は複数のさくらのクラウド関連サービスを内包するモノレポSDKであり、`api/` 配下に20個のサービスパッケージが存在する。このうちSakPilotで実装済みなのは6サービスのみで、残り14サービスは未着手。

本PLAN.mdは、この**未実装14サービスへの対応計画**を扱う。既存6サービス（IaaS/ObjectStorage/MonitoringSuite/AppRun/KMS）内の機能ギャップ（Create/Update/削除操作の欠落等）に関する調査・対応履歴は [`PLAN-old.md`](./PLAN-old.md) を参照（そちらはPR #80〜#183で全項目完了済み）。

調査時点: 2026-08-10。

> **go.mod に関する補足**: CLAUDE.mdには `iaas-api-go`/`apprun-api-go`/`object-storage-api-go`/`kms-api-go`/`webaccel-api-go` を個別モジュールとして探す旨の記載があるが、実際の `go.mod` はこれらを直接依存しておらず、統合モノレポ `sacloud-sdk-go` 経由に一本化されている。新サービス対応時は `~/go/pkg/mod/github.com/sacloud/sacloud-sdk-go@v0.0.1/api/` 配下を探すのが実態に即している（CLAUDE.mdは別途更新が必要）。

## サマリ表

| サービス | 概要 | 主なリソース/操作 | 優先度 |
|---|---|---|---|
| **iam** | ユーザー・グループ・ロール・ポリシー・サービスプリンシパル管理 | user, group, iamrole, iampolicy, serviceprincipal(+キー管理), organization, project, folder, sso, scim, user2fa, servicepolicy, auth | A |
| **secretmanager** | シークレット管理 | vault, secret（CRUD） | A（✅ 対応済み） |
| **webaccel** | ウェブアクセラレータ | サイト管理・キャッシュ制御等（CLAUDE.mdに既記載だが未着手） | B |
| **simplemq** | メッセージキュー | queue, message（CRUD） | B |
| **simple-notification** | 通知サービス | destination, routing, history, group | B |
| **apigw** | APIゲートウェイ | groups, certificates, domains, routes, services, subscriptions, users | C |
| **eventbus** | イベント駆動処理 | triggers, schedules, process_configurations, filter | C |
| **workflows** | ワークフロー | workflow, execution, revision, subscription | C |
| **nosql** | NoSQL DB | instances, databases, backups, plan | C |
| **dedicated-storage** | 専有ストレージ | disk, contract | D |
| **cloudhsm** | CloudHSM | certificate, peer, license | D |
| **security-control** | セキュリティ制御ルール | evaluation_rules, automated_actions, activation | D |
| **service-endpoint-gateway** | SEG | エンドポイント管理 | D |
| **addon** | 既存IaaSリソースへのアドオン群 | WAF/CDN/DDoS/ETL/DWH/AI/Datalake/Streaming/Vulnerability等 | D |

優先度の目安:
- **A**: 需要・親和性が高く、着手価値が明確
- **B**: CRUDがシンプルで実装コストが低い、または既にCLAUDE.mdで案内済み
- **C**: 比較的新しいサービスで需要未知数、要ヒアリング
- **D**: 個別ドメイン知識が必要、または既存資産との親和性が低い。ニーズが顕在化してから着手

---

## Tier A: IAM

さくらのクラウドの組織横断的なユーザー・権限管理機能。`api/iam/apis/` 配下に以下のサブリソースが揃っている。

### 対応範囲の検討ポイント

SakPilotは現状「単一アカウント（プロファイル）に対する各種リソース管理」という設計になっており、IAMは「組織・プロジェクト・フォルダの階層構造にまたがるアクセス制御」という性質上、既存のサイドバー（ゾーン依存/グローバルの2分類）とは毛色が異なるUIが必要になる可能性が高い。まずは読み取り系（一覧・詳細）から着手し、書き込み系（特にサービスプリンシパルキーの発行・無効化など影響の大きい操作）は確認ダイアログを厚めにする方針で進める。

### サブリソース一覧

| リソース | 操作 | 備考 |
|---|---|---|
| `user` | List/Create/Read/Update/Delete + RegisterEmail/UnregisterEmail | ユーザー管理 |
| `group` | List/Create/Read/Update/Delete + ReadMemberships/UpdateMemberships | グループ・メンバーシップ管理 |
| `iamrole` / `idrole` | List/Read | ロール定義の参照のみ（読み取り専用） |
| `iampolicy` / `idpolicy` | Organization/Project/FolderスコープでRead/Update | ポリシーバインディング |
| `serviceprincipal` | List/Create/Read/Update/Delete + **ListKeys/UploadKey/EnableKey/DisableKey/DeleteKey** + IssueToken | 下記「サービスプリンシパルキー管理」参照 |
| `projectapikey` | List/Create/Read/Update/Delete | プロジェクトAPIキー（サービスプリンシパルとは別体系） |
| `organization` | Read/Update + ServicePolicy Read/Update | 組織設定 |
| `project` / `folder` | List/Create/Read/Update/Delete + Move | 階層移動あり |
| `sso` | List/Create/Read/Update/Delete + Link/Unlink | SSO連携 |
| `scim` | List/Create/Read/Update/Delete + RegenerateToken | SCIM連携 |
| `auth` | パスワードポリシー・認証条件・AuthContextのRead/Update | 認証設定 |
| `user2fa` | OTP無効化、信頼済みデバイス一覧/削除/全削除、セキュリティキー管理 | 2FA管理 |
| `servicepolicy` | Enable/Disable/IsEnabled + ListRuleTemplates | サービスポリシー |

### サービスプリンシパルキー管理（ユーザー関心事項）

`serviceprincipal` はキーのライフサイクル管理一式を持つ:

- **発行**: `UploadKey`（公開鍵登録）
- **有効化/無効化**: `EnableKey` / `DisableKey`
- **削除**: `DeleteKey`
- **一覧**: `ListKeys`
- **トークン発行**: `IssueToken`（JWT BearerによるOAuth2アクセストークン発行）

実装イメージ: `internal/iam/service.go` を新設し、サービスプリンシパル一覧画面から各プリンシパルの詳細に遷移、詳細画面でキー一覧・アップロード・有効/無効切り替え・削除を行うUI（KMSDetail.tsxのローテーション/ステータス変更UIが近い形）。

### 認証方式の確認事項

既存の `internal/sakura/client.go` は `iaas-api-go` 系のAPIキー（ACCESS_TOKEN/SECRET）で認証しているが、IAM APIがサービスプリンシパル（鍵ペア）ベースの別認証方式を要求するか、既存のAPIキーで共通利用できるかは未検証。実装着手時に `sacloud-sdk-go/api/iam` のクライアント初期化コードを確認し、既存の認証フロー（プロファイル切り替え含む）に統合できるか最初に検証する。

### 提案タスク分割

1. `iamrole`/`user`/`group` の一覧・詳細（読み取りのみ）
2. `serviceprincipal` の一覧・詳細・キー管理（発行/無効化/削除）
3. `project`/`folder`/`organization` の階層表示
4. `iampolicy` のポリシーバインディング表示・編集
5. `sso`/`scim`/`user2fa`/`servicepolicy`（需要を見て判断）

---

## Tier A: secretmanager

既存のKMS実装（`internal/kms/`）と親和性が高い（暗号鍵管理→シークレット管理という自然な拡張）。CRUDもシンプル。

- `vault`: シークレットの保管領域（CRUD想定）
- `secret`: 個々のシークレット値（CRUD想定）

実装イメージ: `internal/secretmanager/service.go` を新設し、KMSの実装パターン（List/Get/Create/Update/Delete + Goテスト）を踏襲する。

✅ **対応済み（2026-08-10）**: `internal/secretmanager/service.go`にVault（List/Get/Create/Update/Delete）とSecret（List/Set(Create兼Update)/Delete/Unveil）を実装。`sacloud-sdk-go/api/secretmanager`の`SecretAPI`はvaultごとに`NewSecretOp(client, vaultId)`で生成する設計のため、`Service`が保持する`*v1.Client`から都度Secret用opを作る形にした。VaultのUpdateはKmsKeyID(暗号化キー)が不変のため、KMSの`UpdateKey`と同じく事前ReadでKmsKeyIDを引き継いでから送信する。SecretはRead単体APIが無く、値の取得はUnveil（バージョン指定可、省略時は最新版）のみで行う設計をそのままフロントに反映し、「値を表示」ボタンでその場でUnveilして表示・再度隠せるUIとした（一覧取得用の`SecretInfo`には値を含めない）。`app.go`に8つのRPC(`GetSecretManagerVaults`/`GetSecretManagerVault`/`CreateSecretManagerVault`/`UpdateSecretManagerVault`/`DeleteSecretManagerVault`/`GetSecretManagerSecrets`/`SetSecretManagerSecret`/`DeleteSecretManagerSecret`/`UnveilSecretManagerSecret`)を公開。フロントエンドは`SecretManagerList.tsx`（Vault一覧・作成・削除、作成時はVault必須項目のKMSキーを`GetKMSKeys`から選択させるKMS連携）と`SecretManagerDetail.tsx`（Vault基本情報のインライン編集、シークレット一覧・追加・削除・値表示/非表示）を新設し、サイドバーのグローバルリソースに追加。Goテスト（`sakumock/secretmanager`使用）とVitestテスト（`SecretManagerList.test.tsx`/`SecretManagerDetail.test.tsx`）を追加、`golangci-lint`/`tsc --noEmit`/フロントエンド全テストで確認済み。あわせて`e2e_server.go`にsakumock secretmanagerサーバーの起動・シード（`seedSecretManagerVaults`、KmsKeyIDは`seedKMSKeys`が返すよう変更した実際のKMSキーIDを流用）を追加し、`frontend/e2e/secretmanager.spec.ts`（一覧表示/作成/編集/削除/シークレット表示・追加・削除）を新設。既存93件を含むE2Eスイート全件が通ることを確認済み。マニュアル（`docs/manual/`）は新規リソースのため今回は未着手（既存ルール上、新設リソースでの必須事項ではない）

---

## Tier B: webaccel

CLAUDE.mdに既に記載があるサービスだが未着手。`sacloud-sdk-go/api/webaccel` の操作一覧を確認の上、サイト管理・キャッシュパージ等の主要機能から着手する。

## Tier B: simplemq / simple-notification

いずれもシンプルなCRUD構造:
- `simplemq`: `queue`, `message`
- `simple-notification`: `destination`, `routing`, `history`, `group`

実装コストが低く、既存の単一リソースCRUDパターン（PacketFilter等）を踏襲しやすい。

---

## Tier C: apigw / eventbus / workflows / nosql

比較的新しいサービスで、SakPilotユーザーの実利用状況が未知数。着手前に需要を確認する。

- `apigw`: groups/certificates/domains/routes/services/subscriptions/users
- `eventbus`: triggers/schedules/process_configurations/filter
- `workflows`: workflow/execution/revision/subscription
- `nosql`: instances/databases/backups/plan

---

## Tier D: dedicated-storage / cloudhsm / security-control / service-endpoint-gateway / addon

個別ドメイン知識が必要、または既存資産との親和性が低いもの。ニーズが顕在化してから着手を検討する。

- `dedicated-storage`: disk/contract
- `cloudhsm`: certificate/peer/license
- `security-control`: evaluation_rules/automated_actions/activation
- `service-endpoint-gateway`: エンドポイント管理
- `addon`: WAF/CDN/DDoS/ETL/DWH/AI/Datalake/Streaming/Vulnerability等（既存IaaSリソースへの機能追加群、対象リソースごとに個別調査が必要）

---

## 進め方の所感

- Tier A（IAM・secretmanager）から着手するのが自然。特にIAMはサービスプリンシパルキー管理という具体的な要望があるため、まずはそこにスコープを絞った最小実装（読み取り + キー管理のみ）から始めるのが現実的
- IAMは組織横断的な機能でUI設計が既存画面と異質になりうるため、実装前に画面構成（サイドバーへの追加方法、プロファイルとの関係）を軽く設計レビューしてから着手する
- Tier B以降は1サービスずつ、PLAN-old.mdで確立した「Go実装→app.go RPC公開→フロントエンド→FEテスト→マニュアル」のサイクルを踏襲する
