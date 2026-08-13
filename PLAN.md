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

1. ✅ **対応済み（2026-08-10）**: `iamrole`/`user`/`group` の一覧・詳細（読み取りのみ）
2. ✅ **対応済み（2026-08-10）**: `serviceprincipal` の一覧・詳細・キー管理（発行/無効化/削除）
3. ✅ **対応済み（2026-08-10）**: `project`/`folder`/`organization` の階層表示
4. ✅ **対応済み（2026-08-10）**: `iampolicy` のポリシーバインディング表示・編集
5. ✅ **対応済み（2026-08-10、user2faを除く3リソース）**: `sso`/`scim`/`servicepolicy`(`user2fa`はsakumock未対応のためスコープ外)
6. 🔓 **未着手（2026-08-13時点でsakumock 0.8.0によりブロック解消）**: `user2fa`。sakumock PR#162でOTP無効化・信頼済みデバイス一覧/削除/全削除・セキュリティキー管理の各エンドポイントが実装され、E2E可能になった(`docs/upstream-issues.md`項目11参照)。着手時期は未定

#### タスク1完了メモ

- 認証方式の懸念は解消: `sacloud-sdk-go/api/iam/client.go` は KMS/secretmanager と同じく `saclient.WithForceAutomaticAuthentication()` を使っており、既存のAPIキー（ACCESS_TOKEN/SECRET）認証をそのまま利用できる。サービスプリンシパル固有のセットアップは不要
- `internal/iam/service.go` に User/Group/IAMRole/IDRoleの読み取り専用サービスを実装。User/GroupはSDK上Create/Update/Delete/Membershipsも揃っているが、ユーザー削除は実際のアカウント削除に相当し既存リソース削除よりブラスト半径が大きいため、このタスクでは意図的にList/Readのみに留めた（書き込み系はタスク2以降で改めて検討）
- UI設計: PLAN.mdの懸念どおり既存のゾーン/グローバル2分類とは毛色が異なるため、詳細画面を作らずタブ切り替え1画面（`IAMList.tsx`、Monitoring.tsxのタブパターンを踏襲）で完結させた。サイドバーは既存の「グローバルリソース」に「IAM」を1エントリ追加
- `idrole`(旧ロール体系)は`iamrole`と並んでsakumockが固定シードデータ(owner/editor/viewer/resource-creator/organization-admin、admin/member)を持つ読み取り専用APIのため、あわせて一覧表示に対応
- e2e_server.go/frontend/e2e/frontend/e2e-manual/docs/manual一式まで対応し、既存97件のE2E含め全件パス確認済み

#### タスク2完了メモ

- `internal/iam/service.go`に`servicePrincipalOp sdkiam.ServicePrincipalAPI`を追加し、List/Create/Read/Update/Delete + ListKeys/UploadKey/EnableKey/DisableKey/DeleteKeyを実装。`IssueToken`（JWT BearerでのOAuth2トークン発行）はサービスプリンシパル自身がプログラムから使う機能であり管理UIの操作対象ではないため対象外とした
- キーIDはSDK上`uuid.UUID`型だが、Wailsバインディング越しの往復でJSON文字列として扱えるようRPC層では`string`に統一し、Service層で`uuid.Parse`している
- `CreateParams.ProjectID`が必須（`int`）だが、IAMのプロジェクト管理（タスク3）は未実装のため、作成フォームでは「プロジェクトID」を数値入力させる暫定対応とした。sakumock側もプロジェクトの存在検証はしていないため、E2Eでは検証用に`ProjectID: 1`を決め打ちで使っている。タスク3実装時にプロジェクト選択式へ置き換える想定
- UI設計: PLAN.mdの提案どおり、`IAMList.tsx`に「サービスプリンシパル」タブ（一覧・作成・削除）を追加し、行クリックで新設の`IAMServicePrincipalDetail.tsx`（ルート`iam/serviceprincipals/:id`、KMSDetail.tsxのステータス変更UIを踏襲）に遷移してキー管理を行う構成にした。既存のIAMタブ画面はタブ切り替えのみで完結していたが、キー一覧・登録・状態変更は情報量が多くタブ内には収まらないため、このリソースだけ詳細ページに遷移する設計とした（react-router、KMSList/KMSDetailと同じ`*Wrapper`パターン）
- `internal/iam/service_test.go`にCRUD一式・キーライフサイクル一式のGoテストを追加。e2e_server.goの`seedIAM`にサービスプリンシパル3件（表示/キー管理用に登録済みキー1件を持つもの、削除シナリオ用、編集シナリオ用）を追加し、`frontend/e2e/iam.spec.ts`（一覧/作成/削除/編集/キー登録・有効化・無効化・削除）・`frontend/e2e-manual/iam.spec.ts`（スクリーンショット追加）・`docs/manual/iam.md`を更新。既存102件を含むE2Eスイート全件パス確認済み

#### タスク3完了メモ

- `internal/iam/service.go`に`projectOp sdkiam.ProjectAPI`/`folderOp sdkiam.FolderAPI`/`organizationOp sdkiam.OrganizationAPI`を追加し、Project/FolderはList/Create/Read/Update/Delete/Move、OrganizationはRead/Updateを実装(`ReadServicePolicy`/`UpdateServicePolicy`はタスク5のservicepolicy系と合わせて改めて検討することとし今回は対象外)。SDK上の階層関係フィールドはProjectが`ParentFolderID`(`NilInt`)、Folderが`ParentID`(`NilInt`)と命名が異なるが、RPC/フロント側では両方とも「0=組織ルート直下」という単純な`int`(0起点)に統一し、Wailsバインディング越しにポインタ型を扱う複雑さを避けた(実際のリソースIDは常に正の値のため0を「親なし」の番兵として使える)
- UI設計: `IAMList.tsx`に「プロジェクト/フォルダ」タブを追加し、フォルダは再帰的に子フォルダ・子プロジェクトを展開するツリー表示(テーブルではなくdiv+インデントで表現)とした。各行に「+サブフォルダ」「+プロジェクト」「編集」「移動」「削除」ボタンを持ち、移動は移動先フォルダ(または組織ルート)をセレクトボックスで選ぶモーダルとした。移動先の選択肢から自分自身とその子孫フォルダを除外することで、フォルダを自分の子孫に移動して循環参照になる操作をUI側で防いでいる(API/sakumock側の循環検証は未確認だが、UIレベルで一般的な誤操作は防止できる)
- 「組織」タブは他リソースと異なり単数リソース(常に1件、IDパラメータなしでRead/Update)のため、一覧ではなく組織ID・組織名を表示するだけの簡易なカード+編集モーダルとした
- `internal/iam/service_test.go`にFolder/Project各CRUD+Move、OrganizationのRead/UpdateのGoテストを追加。e2e_server.goの`seedIAM`にフォルダ4件(表示用の親、削除/編集/移動先シナリオ用)・プロジェクト4件(表示用は親フォルダの子として、削除/編集/移動シナリオ用)を追加し、`frontend/e2e/iam.spec.ts`(ツリー表示/フォルダ・プロジェクトの作成・削除・編集・移動/組織の表示・編集、9件追加)・`frontend/e2e-manual/iam.spec.ts`(プロジェクト/フォルダ・組織タブのスクリーンショット追加)・`docs/manual/iam.md`を更新。既存を含むE2Eスイート125件全件パス確認済み

#### タスク4完了メモ

- `sacloud-sdk-go/api/iam/apis/iampolicy`(`IAMPolicyAPI`)は組織/プロジェクト/フォルダの3スコープをそれぞれ`Read*Policy`/`Update*Policy`メソッドとして持つ単一API、`apis/idpolicy`(`IDPolicyAPI`)は組織スコープのみの`ReadOrganizationIdPolicy`/`UpdateOrganizationIdPolicy`しか提供しない(プロジェクト/フォルダへのIDロール割り当ては実API仕様として存在しない)。いずれもPUTはバインディング配列の全量置換で、差分更新APIはない
- `internal/iam/service.go`にIAM/ID共通のDTOとして`PolicyBindingInfo{RoleID string, Principals []PolicyPrincipalInfo}`を新設し、`GetIAMOrganizationPolicy`/`UpdateIAMOrganizationPolicy`/`GetIAMProjectPolicy`/`UpdateIAMProjectPolicy`/`GetIAMFolderPolicy`/`UpdateIAMFolderPolicy`/`GetIDOrganizationPolicy`/`UpdateIDOrganizationPolicy`の8メソッドを実装。SDK上の`v1.IamPolicy`/`v1.IdPolicy`はRole/Principalsの型がIAM/IDでそれぞれ別型(構造は同一)のため、変換関数もtoIAMPolicyBindingInfos/toIAMPolicies/toIDPolicyBindingInfos/toIDPoliciesと分けて実装した
- `sakumock/iam`は`handler_policy.go`でこれらのエンドポイントにフル対応しており、ロールID・プリンシパルの存在検証もしていない(サービスプリンシパル作成時のプロジェクトIDと同様、任意の文字列/数値をそのまま保存する)ため、E2E・Goテストとも問題なく書けた
- UI設計: `IAMList.tsx`に「ポリシー」タブを追加。PUTが全量置換である都合上、画面側は常にそのスコープの全バインディング配列をローカルstateとして保持し、「+バインディング追加」「+プリンシパル追加」「削除」で配列を組み立てた上で「保存する」ボタンで一括Updateする設計にした(個々の追加/削除操作のたびにAPIを呼ばない)。スコープ切り替え(組織/プロジェクト/フォルダ)用のセレクトと、組織スコープのみで有効な「ロール体系」(IAM/ID)セレクトをタブ直下に配置し、プロジェクト/フォルダ選択時は既存の`projectsFolders`タブで使っているprojects/foldersのリストを流用した
- `internal/iam/service_test.go`に組織/プロジェクト/フォルダそれぞれのIAMポリシーCRUD・組織IDポリシーCRUDのGoテストを追加。e2e_server.goの`seedIAM`に組織IAMポリシー(owner+user:1)・`e2e-project-1`のIAMポリシー(editor+group:1)・`e2e-folder-1`のIAMポリシー(viewer+service-principal:<seed済みSPのID>)・組織IDポリシー(admin+user:1)を追加し、`frontend/e2e/iam.spec.ts`(表示4件+保存1件の5件追加)・`frontend/e2e-manual/iam.spec.ts`(ポリシータブのスクリーンショット追加)・`docs/manual/iam.md`を更新。既存を含むE2Eスイート130件全件パス確認済み

#### タスク5完了メモ

- `sacloud-sdk-go/api/iam/apis/{sso,scim,servicepolicy}`はいずれも`sdkiam.NewClient`が返すのと同じ`*v1.Client`を受け取る単純なラッパーで、認証まわりの追加検証は不要だった(タスク1で解消済みの懸念のとおり)。`internal/iam/service.go`の`Service`に`ssoOp sdksso.SSOAPI`/`scimOp sdkscim.ScimAPI`/`servicePolicyOp sdkservicepolicy.ServicePolicyAPI`を追加し、SSOはList/Create/Read/Update/Delete/Link/Unlink、SCIMはList/Create/Read/Update/Delete/RegenerateToken、ServicePolicyはEnable/Disable/IsEnabled/ListRuleTemplatesを実装した
- SCIMの`SecretToken`はCreate直後・RegenerateToken直後のレスポンスにしか含まれない一度きり表示のフィールドのため(サービスプリンシパルキー・apigw証明書と同じパターン)、DTOを`ScimConfigurationInfo`(一覧・詳細用、SecretTokenなし)と`ScimConfigurationSecretInfo`(Create応答専用、SecretTokenあり)に分け、RegenerateTokenは新しいトークン文字列(`string`)のみを返す設計にした(simplemqの`RotateAPIKey`と同じ形)。SCIMのIDは`uuid.UUID`だがRPC/Service層では既存パターンどおり`string`のまま扱い、SDK内部で`uuid.Parse`される
- **sakumockの不具合を発見**: `GET /service-policy-status`はSDKが期待するフィールド名`enabled`ではなく`is_active`を返すため`ServicePolicyAPI.IsEnabled`のデコードが常に失敗する(かつ`is_active`自体もEnable/Disable呼び出しに関わらず常に`false`固定で状態を永続化していない)。また`GET /service-policy-rule-templates`はページネーション付きオブジェクトを期待するSDKに対し素のJSON配列`[]`を返すため`ListRuleTemplates`のデコードも常に失敗する。`docs/upstream-issues.md`の項目4に記録の上、`internal/iam/service.go`の`IsServicePolicyEnabled`/`ListServicePolicyRuleTemplates`でこれらのデコードエラーメッセージを検出してフォールバック(前者は無効`false`、後者は空スライス)する実装にした。Enable/Disable自体(204のみ返す)は問題なく動作する
- UI設計: `IAMList.tsx`のタブ切り替え1画面パターンを踏襲し、「SSO」「SCIM」「サービスポリシー」の3タブを追加(サービスプリンシパルのみ詳細ページ遷移という既存の例外はここでも踏襲せず、3リソースともタブ内で完結)。SSOは一覧に組織への割り当て状態を`.status`クラス(緑/赤)で表示し、行ごとに「割り当てる」/「割り当て解除」ボタンを出し分け。SCIMはCreate/トークン再発行のたびにシークレットトークンをモーダルで一度だけ表示し(コピー機能付き)、以降は取得不可であることを明示。サービスポリシーは「状態」カード+トグルボタン、その下に参照専用の「ルールテンプレート」一覧という単数リソース寄りの構成(組織タブに近い設計)にした
- `internal/iam/service_test.go`にSSO/SCIMのCRUD一式・ServicePolicyのEnable/Disable/IsEnabled/ListRuleTemplates(sakumockのフォールバック経路を通ることを確認するテスト)を追加。e2e_server.goの`seedIAM`にSSOプロファイル3件(表示/削除/編集シナリオ用)・SCIM設定3件(表示/削除/編集シナリオ用)を追加(サービスポリシーは状態を永続化しないためシード不要)し、`frontend/e2e/iam.spec.ts`(SSO一覧・作成・削除・編集・割り当て/解除、SCIM一覧・作成(シークレット表示)・削除・編集・トークン再発行、サービスポリシー状態表示+ルールテンプレート+有効化操作、計12件追加)・`IAMList.test.tsx`(同3タブ分のVitestテスト12件追加)・`frontend/e2e-manual/iam.spec.ts`(SSO/SCIM/サービスポリシータブのスクリーンショット追加)・`docs/manual/iam.md`を更新。既存を含むE2Eスイート170件全件パス確認済み

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

> **2026-08-10時点の注記**: `webaccel`は`sacloud-sdk-go`側にAPIはあるが、`sakumock`(`github.com/sacloud/sakumock`)側に対応パッケージが存在しない。SakPilotのE2Eテスト運用はsakumockのテストサーバーに依存しているため、このままではE2E(`frontend/e2e/`)・マニュアル撮影(`frontend/e2e-manual/`)が書けない。同様にsakumock未対応なのは `nosql` / `dedicated-storage` / `security-control` / `service-endpoint-gateway` / `addon`(Tier C/D相当)。着手する場合はGoテスト(sakumock無しでSDKのHTTPクライアントを直接叩くfake実装が必要)とE2Eの扱いを先に決めること。sakumockに対応が追加されるまでは優先度を下げ、Tier Bの中では`simplemq`/`simple-notification`を先に着手するのが妥当。
>
> **2026-08-13追記**: sakumock 0.8.0で`cloudhsm`パッケージが追加された(PR#158)。上記リストから`cloudhsm`を除外。E2E着手可能になったが、SakPilot側の実装(Go/RPC/フロントエンド)は未着手。

## Tier B: simplemq / simple-notification

いずれもシンプルなCRUD構造:
- `simplemq`: `queue`, `message`
- `simple-notification`: `destination`, `routing`, `history`, `group`

実装コストが低く、既存の単一リソースCRUDパターン（PacketFilter等）を踏襲しやすい。sakumockに両方とも対応パッケージ(`simplemq`/`simplenotification`)がある。

✅ **`simplemq`対応済み(2026-08-10)**: `internal/simplemq/service.go`にQueue(List/Get/Create/Config(Update)/Delete + CountMessages/RotateAPIKey/ClearMessages)とMessage(Send/Receive/ExtendTimeout/Delete)を実装。`sacloud-sdk-go/api/simplemq`は旧来型ではなくogen生成のOpenAPIクライアントで、KMS/secretmanagerと同じ`saclient.Client`+環境変数注入パターンがそのまま使える(`simplemq.NewQueueClient(&sc)`)。設計上のポイント:
- Queue管理(control plane)とMessage送受信(data plane)は別クライアント・別認証。Message側は`RotateAPIKey`で発行した専用APIキー(Bearer)が必要で、**発行後は取得する手段がない**(サービスプリンシパルキーと同様の一度きり表示パターン)。Serviceは`NewService(profileName)`がRPC呼び出しごとに使い捨てで生成される既存方針のため、APIキーはService内に保持できず、`SendMessage`等のメソッド引数として都度受け取る設計にした。フロントは発行直後のキーをコンポーネントのローカルstateに保持するのみでアプリ側には永続化しない
- メッセージ本文(`content`)はAPI仕様上base64エンコードされたASCII文字列である必要がある(sakumockのバリデーションで判明)。`SendMessage`でエンコード、受信系で自動デコードしてUIには平文を渡す
- メッセージAPIのqueue識別子はQueue作成時の`Name`(`CommonServiceItem.Status.QueueName`と同値)を使う。IDではない点に注意
- Queue名はAPI側で`^[0-9a-zA-Z]+(-[0-9a-zA-Z]+)*$`・5〜64文字の制約があり、フォームに`pattern`/`minLength`/`maxLength`を設定済み
- `internal/simplemq/service_test.go`にCRUD一式・APIキー発行〜メッセージ送受信・タイムアウト延長・削除・全削除のGoテストを追加。`frontend/src/components/SimpleMQList.tsx`(一覧・作成・削除)と`SimpleMQDetail.tsx`(基本情報編集・APIキー発行・メッセージ送受信)を新設し、サイドバーのグローバルリソースに追加。Vitestテストを追加、`e2e_server.go`にsakumock simplemqサーバー起動・シード(`seedSimpleMQQueues`)を追加し、`frontend/e2e/simplemq.spec.ts`・`frontend/e2e-manual/simplemq.spec.ts`・`docs/manual/simplemq.md`を新設。既存のE2Eスイート(107件)全件パス確認済み

✅ **`simple-notification`対応済み(2026-08-10)**: `internal/simplenotification/service.go`にDestination(送信先)・Group(グループ)・Routing(ルーティング)のList/Create/Read/Update/Delete、およびGroup.SendMessage(テスト通知送信)を実装。`sacloud-sdk-go/api/simple-notification`もsimplemq同様ogen生成のOpenAPIクライアントで、`saclient.Client`+環境変数注入パターン(`SAKURA_ENDPOINTS_SIMPLE_NOTIFICATION`)がそのまま使える。設計上のポイント:
- Destination/Group/Routingはいずれも`CommonServiceItem`という共通リソース型の上に成り立つポリモーフィックな設計(`Settings`が`DestinationSettings`/`GroupSettings`/`RoutingSettings`のunion、`Provider.Class`で種別を判別)で、SDK側の`DestinationOp`/`GroupOp`/`RoutingOp`がCreate時に`Provider.Class`/`ServiceClass`/`Settings.Type`を自動設定してくれるため、呼び出し側はペイロード部分(Name/Description/Tags/Settings本体)のみ組み立てればよい
- `History`(通知履歴)・`ListSources`(ルーティングのソース一覧)・`Routing.Reorder`(並び替え)・`GetCommonServiceItemStatus`(有効性ステータス)の4エンドポイントは`sacloud-sdk-go`にAPIはあるが`sakumock/simplenotification`が未対応(`route.go`の`routeTable()`に存在しない)と判明したため、今回はスコープ外とした(`docs/upstream-issues.md`に改善要望として記録)。ルーティング作成フォームのソースIDは選択式ではなく数値ID直接入力の暫定対応(IAMタスク2のプロジェクトID入力と同様のパターン)
- UI設計: IAMList.tsxのタブ切り替え1画面パターンを踏襲し、`SimpleNotificationList.tsx`に「送信先」「グループ」「ルーティング」の3タブを実装。詳細ページは作らず、作成・編集はモーダルフォーム、グループへのテスト通知送信も専用モーダルで完結させた。3タブとも相互参照(グループ一覧は送信先名を、ルーティング一覧はグループ名を表示)するため、タブ切り替えに関わらず3リソースをまとめて読み込む設計にした
- `internal/simplenotification/service_test.go`にDestination/Group/Routing各CRUD一式・SendMessageのGoテストを追加(`sakumock/simplenotification`使用)。`SimpleNotificationList.test.tsx`にVitestテストを追加。`e2e_server.go`にsakumock simplenotificationサーバー起動・シード(`seedSimpleNotification`、各リソース3件ずつ: 表示用/削除シナリオ用(-doomed)/編集シナリオ用(-editable))を追加し、`frontend/e2e/simplenotification.spec.ts`(9件)・`frontend/e2e-manual/simplenotification.spec.ts`・`docs/manual/simplenotification.md`を新設。既存を含むE2Eスイート116件全件パス確認済み

---

## Tier C: apigw / eventbus / workflows / nosql

比較的新しいサービスで、SakPilotユーザーの実利用状況が未知数。着手前に需要を確認する。

- `apigw`: groups/certificates/domains/routes/services/subscriptions/users — ✅ **対応済み（2026-08-10）**: sakumockが全operation(services/routes/route認可・変換/users/groups/domains/certificates/subscriptions/oidc)に対応済みと判明したため着手。`internal/apigw/service.go`にworkflows/eventbus等と同パターンのogen生成OpenAPIクライアントラッパー(`sacloud-sdk-go/api/apigw`は各リソースごとに`GroupAPI`/`ServiceAPI`等のインターフェースラッパーを持つ設計、IDは`uuid.UUID`だがRPC層ではIAMサービスプリンシパルキー同様に`string`へ統一し`uuid.Parse`で変換)でGroup/Certificate/Domain/Subscription(Plan含む)/Service/Route(サービスにネスト、`NewRouteOp(client, serviceId)`で都度生成)/UserのCRUDを実装。Update系APIはいずれも204 No Content(更新後オブジェクトを返さない)で統一されているため、Service層のUpdate*はerrorのみ返す設計にした。スコープ判断: (1)証明書/秘密鍵はAPI仕様上書き込み専用でレスポンスにエコーバックされない(sakumockの`CertificateDetails.CertPEM/KeyPEM`が`json:"-"`)ため一覧・詳細には表示されない、(2)UserのGroup所属はCreate/Update時には設定不可(sakumockが明示的に`Groups`/`GroupIDs`を無視する仕様)なため作成後に`ListUserGroups`/`SetUserGroup`(UserExtraAPI)で個別管理する2ステップUIにした、(3)RouteExtra(認可ACL・リクエスト/レスポンス変換)とOIDC設定は複雑な追加機能のため今回はスコープ外とし将来検討とした。Serviceの作成にはAPI仕様上1:1で紐づく未使用のSubscription(事前にプランへSubscribeしたもの)が必須なため、UI上もサブスクリプション未契約時はサービス作成ボタンを無効化して誘導。`ConnectTimeout`/`WriteTimeout`/`ReadTimeout`はSDKのGodocでは「秒数」とあるがsakumockの実際のデフォルト値(60000)から単位はミリ秒と判明、UIラベルを「ミリ秒」に修正して回避(`docs/upstream-issues.md`参照)。一覧APIのレスポンスにはプラン名が含まれない(詳細取得時のみ)ため、`ListSubscriptions`で`ListPlans`と突き合わせて補完。UI設計は`SimpleNotificationList.tsx`のタブ切り替えパターン(`ApigwList.tsx`に「サービス」「ユーザー」「グループ」「ドメイン」「証明書」「サブスクリプション」の6タブ)を踏襲しつつ、サービスのみ`WorkflowsList/WorkflowDetail`と同様に詳細ページ(`ApigwServiceDetail.tsx`)へ遷移してルート管理を行う構成にした。Goテスト・Vitest・E2E(`frontend/e2e/apigw.spec.ts`、11件)・マニュアル(`docs/manual/apigw.md`)まで対応し、既存E2E(148件)含め全159件パス確認済み
- `eventbus`: triggers/schedules/process_configurations/filter — ✅ **対応済み（2026-08-10）**: sakumockが全operation対応済み(カバレッジ100%)と判明したためworkflowsに続いて着手。`internal/eventbus/service.go`にogen生成OpenAPIクライアント(workflows/simplemq等と同パターン)でTrigger/Schedule/ProcessConfigurationのCRUD + ProcessConfigurationのUpdateSecret(SimpleMQ APIキー/さくらのクラウドAPIキー)を実装。TriggerSettings.ConditionsはSDK上eq/in二種類のoneOf型だが、両者とも`{Key,Op,Values}`の同一構造なので`TriggerConditionInfo{Key,Op,Values}`に単純化してフロント側で編集可能にした。SDK側`injectFilterMiddleware`(Provider.Classによる種別絞り込み)が実際にはリクエストに反映されずList APIが常に全種別を返す不具合を発見、Service層でSettings型による絞り込みにフォールバック(`docs/upstream-issues.md`参照)。UI設計は`SimpleNotificationList.tsx`のタブ切り替え1画面パターンを踏襲(`EventBusList.tsx`に「実行設定」「トリガー」「スケジュール」の3タブ、詳細ページなし)。実行設定はTrigger/Scheduleから参照されるため作成順の誘導(実行設定が無い場合はトリガー/スケジュール作成ボタンを無効化)を行った。Goテスト・Vitest・E2E(`frontend/e2e/eventbus.spec.ts`)・マニュアル(`docs/manual/eventbus.md`)まで対応し、既存E2E含め全件パス確認済み
- `workflows`: workflow/execution/revision/subscription — ✅ **対応済み（2026-08-10）**: sakumockが全operationに対応済みと判明したため優先着手。`internal/workflows/service.go`にogen生成OpenAPIクライアント(simplemq/simple-notificationと同パターン)でWorkflow(List/Create/Read/Update/Delete)・Revision(List/Create/UpdateAlias/DeleteAlias)・Execution(List/Create/Read/Cancel/Delete/ListHistory)・Subscription(ListPlans/Read/Create/Delete)を実装。Runbook(YAML DSL)はテキストエリアでの生編集のみとし専用GUIエディタは作らない方針とした(実行ステップ定義がGCP Workflows類似の複雑なDSLのため)。サブスクリプション未契約時、sakumockが仕様上non-nullableな`MonthAppliedPlan`にnullを返しSDKのデコードに失敗する不具合を発見、Service層でフォールバック実装(`docs/upstream-issues.md`参照)。UI設計はKMSList/KMSDetailの「一覧+詳細ページ」パターンを踏襲(`WorkflowsList.tsx`でサブスクリプション状況表示+ワークフローCRUD、`WorkflowDetail.tsx`でリビジョン/実行のタブ切り替え)。Goテスト・Vitest・E2E(`frontend/e2e/workflows.spec.ts`)・マニュアル(`docs/manual/workflows.md`)まで対応し、既存E2E含め全件パス確認済み
- `nosql`: instances/databases/backups/plan — sakumock未対応(2026-08-10時点調査)のためE2E不可、着手見送り。詳細は`docs/upstream-issues.md`ではなく本ファイル調査時点のメモ(sakumock@v0.7.2に`nosql`パッケージなし)を参照

---

## Tier D: dedicated-storage / cloudhsm / security-control / service-endpoint-gateway / addon

個別ドメイン知識が必要、または既存資産との親和性が低いもの。ニーズが顕在化してから着手を検討する。

- `dedicated-storage`: disk/contract
- `cloudhsm`: certificate/peer/license — sakumock 0.8.0で対応パッケージ追加済み(2026-08-13時点、着手は未定)
- `security-control`: evaluation_rules/automated_actions/activation
- `service-endpoint-gateway`: エンドポイント管理 — ✅ **対応済み（2026-08-10）**: プライベート接続からオブジェクトストレージ/コンテナレジストリ/モニタリングスイート/AppRun専有型コントロールプレーンへ到達するためのゲートウェイアプライアンス。`sacloud-sdk-go/api/service-endpoint-gateway`はogen生成のOpenAPIクライアントで、認証はKMS等と同型(`saclient`標準パターン)だが、サーバー/ディスクと同じくゾーン依存リソースである点が他の新規対応サービス(apigw/eventbus/workflows等、いずれもゾーン非依存)と異なる。`internal/serviceendpointgateway/service.go`にList/Get/Create/Update/Apply/Delete/ReadInterface/ReadPowerStatus/PowerOn/Shutdown/Resetを実装。設計上のポイント:
  - **sakumockが本サービス未対応**のため(`~/go/pkg/mod/github.com/sacloud/sakumock@v0.7.2/`に対応パッケージなし、Go Module Proxy上の最新版0.7.2でも同じ)、Goテストは`net/http/httptest`+Go1.22の`http.ServeMux`パターンマッチングで自作したfakeサーバー(`internal/serviceendpointgateway/fake_server_test.go`)を用いる方針にした。sakumock対応が追加され次第、切り替えを検討する
  - **upstreamの不具合を発見**: `sacloud-sdk-go/api/service-endpoint-gateway`の`NewClient`は、`Zone`が設定されていると`SAKURA_ENDPOINTS_SERVICE_ENDPOINT_GATEWAY`によるエンドポイント上書きを無視して常に実際のさくらのクラウドAPI(`secure.sakura.ad.jp`)へのURLを組み立ててしまう(`docs/upstream-issues.md`項目12)。自作fakeサーバーへ向けるテストがこの不具合により実際のインターネット上のAPIへリクエストしてしまうことが判明したため、`internal/serviceendpointgateway/service.go`では`seg.NewClient`を使わず、同等ロジック(エンドポイント上書き優先→ゾーンURLへフォールバック)を`buildEndpoint`として自前で再実装し、`seg.NewClientWithAPIRootURL`に直接渡す形で回避した
  - `Appliance`の作成ボディ(`ApplianceCreateBody`)にName/Description相当のフィールドが存在しない(API仕様上、名前は付けられない)。一覧・詳細ともにIDで識別する設計にした
  - 設定変更(接続先マネージドサービス/モニタリングスイート連携/DNSフォワーディング)は`Update`だけでは反映されず、別途`Apply`の呼び出しが必要という2段階API。UIでは`ServiceEndpointGatewayDetail.tsx`の「保存して適用する」ボタンでUpdate→Applyを一括実行する設計にした
  - UI設計: NFSList.tsx/NFSDetail.tsxの「一覧+詳細ページ」パターン(ゾーン依存リソース、Switch選択によるNFS作成フォームが最も近い)を踏襲。`ServiceEndpointGatewayList.tsx`(一覧・作成・削除・電源操作、NFSList.tsxのポーリングパターンを流用)と`ServiceEndpointGatewayDetail.tsx`(基本情報+電源操作、接続先マネージドサービス設定の編集フォーム)を新設し、サイドバーのゾーン依存リソースに追加
  - sakumock未対応のため**E2E(`frontend/e2e/`)・マニュアル(`docs/manual/`)は今回のスコープ外**とした(webaccel/nosqlと同じ制約)。Go側はfakeサーバーでのユニットテスト、フロントエンドはVitestのみで検証している(`internal/serviceendpointgateway/service_test.go`、`ServiceEndpointGatewayList.test.tsx`、`ServiceEndpointGatewayDetail.test.tsx`)
- `addon`: WAF/CDN/DDoS/ETL/DWH/AI/Datalake/Streaming/Vulnerability等（既存IaaSリソースへの機能追加群、対象リソースごとに個別調査が必要）

---

## 進め方の所感

- Tier A（IAM・secretmanager）から着手するのが自然。特にIAMはサービスプリンシパルキー管理という具体的な要望があるため、まずはそこにスコープを絞った最小実装（読み取り + キー管理のみ）から始めるのが現実的
- IAMは組織横断的な機能でUI設計が既存画面と異質になりうるため、実装前に画面構成（サイドバーへの追加方法、プロファイルとの関係）を軽く設計レビューしてから着手する
- Tier B以降は1サービスずつ、PLAN-old.mdで確立した「Go実装→app.go RPC公開→フロントエンド→FEテスト→マニュアル」のサイクルを踏襲する
