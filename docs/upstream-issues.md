# upstream (sacloud) への報告候補メモ

SakPilotの開発・E2Eテスト整備(2026-08-08)で見つけた、`sacloud-sdk-go` / `sakumock` 側の不具合・改善要望のメモ。まだupstreamには未報告。issue化する際はここから起こす。

対象バージョン(`go.mod`):
- `github.com/sacloud/sacloud-sdk-go v0.0.1`
- `github.com/sacloud/sakumock v0.8.0`

## 確認済みバグ

### 1. `iaas/fake` の `ProxyLBOp.SetCertificates` がnilポインタ参照でpanicする

- **対応済み**: https://github.com/sacloud/sacloud-sdk-go/pull/216#discussion_r3764158222

- パッケージ: `github.com/sacloud/sacloud-sdk-go/api/iaas/fake`
- ファイル: `ops_proxy_lb.go` (`SetCertificates`, 211行目付近)、`functions.go` (`copySameNameField`, 189行目)
- 再現: `iaas.NewProxyLBOp(nil).SetCertificates(ctx, id, &iaas.ProxyLBSetCertificatesRequest{PrimaryCerts: &iaas.ProxyLBPrimaryCert{ServerCertificate: "...", IntermediateCertificate: "...", PrivateKey: "..."}})` をfakeドライバ切り替え後(`fake.SwitchFactoryFuncToFake()`)に呼ぶと、100%再現する。
- 根本原因: `copySameNameField(source, dest)` は `mapconv` タグを見ておらず、`json.Marshal(source)` → `json.Unmarshal(data, dest)` というJSONラウンドトリップでコピーしている(`functions.go:189-192`)。
  - リクエスト側 `ProxyLBSetCertificatesRequest.PrimaryCerts`(複数形、`mapconv:"PrimaryCert"` タグ付き。このタグは実APIのHTTPリクエスト整形にのみ使われ、`copySameNameField` には効かない)はJSON化すると `"PrimaryCerts"` というキーになる。
  - 結果側 `ProxyLBCertificates.PrimaryCert`(単数形)はJSON化すると `"PrimaryCert"` というキーになる。
  - キー名が一致しないため `json.Unmarshal` はこのフィールドを黙って無視し、`cert.PrimaryCert` は `nil` のまま。
  - 直後の `cert.PrimaryCert.CertificateCommonName = "dummy-common-name.org"`(`ops_proxy_lb.go:222`付近)が nil ポインタ参照でpanicする。
- 影響: fakeドライバ経由でProxyLB(ELB)の証明書設定をテストしようとすると必ずクラッシュする。SakPilot側の呼び出しコード(`internal/sakura/proxylb.go`)はSDKが定義したフィールド名をそのまま使っているだけで、SakPilot側に問題はない。
- SakPilotでの回避: E2Eテストの対象から証明書設定フロー(`SetCertificates`/それに依存する`証明書を更新`・`証明書を削除`ボタン)を除外した(`frontend/e2e/proxylb.spec.ts` 参照)。Go単体テスト・vitestレベルでは影響を受けないため `ProxyLBList.test.tsx` で引き続きカバーしている。
- 報告時の提案: `copySameNameField` を `mapconv` 対応にするか、少なくとも `ProxyLBOp.SetCertificates` 内で `cert.PrimaryCert` がnilの場合はガードする(他のリクエスト/レスポンスの構造体ペアでも同種のフィールド名不一致(単数/複数、大文字小文字違い等)が無いか横断的に監査する価値がありそう)。

### 2. `iaas/fake` の `DatabaseOp.GetParameter` が `Conf` フィールドのnilチェックをしておらずpanicする

- **提案中**: https://github.com/sacloud/sacloud-sdk-go/pull/218

- パッケージ: `github.com/sacloud/sacloud-sdk-go/api/iaas/fake`
- ファイル: `ops_database.go`(`GetParameter`、314行目付近)
- 再現: fakeドライバのデータストアに `Conf` フィールドが `nil` の `*iaas.Database` を(`fake.DataStore.Put` などで直接、あるいは `Conf` を指定しない `DatabaseCreateRequest` 経由で)投入した状態で `DatabaseOp.GetParameter` を呼ぶと、`if v.Conf.DatabaseName == "postgres"` の行でnilポインタ参照によりpanicする。
- 影響: `Database.Conf` を設定し忘れた状態のデータに対して `GetParameter` を呼ぶと即クラッシュする。実際のAPIでは作成されたデータベースに `Conf` が必ず設定されるためAccTestでは表面化しにくいが、fakeドライバのデータストアへ直接データを投入するテストコード(SakPilotのE2Eシード等)では容易に踏み抜く。
- SakPilotでの回避: E2Eシード(`e2e_server.go` の `seedDatabases`)で `Conf`/`CommonSetting` を明示的に設定するよう修正した。SakPilot本体のコード(`internal/sakura/database.go`)側はSDKが返す `Conf` の有無を全てnilチェックしているため、実運用データに対しては影響を受けない。
- 報告時の提案: `GetParameter` 内で `v.Conf` がnilの場合はMariaDB用のメタ情報にフォールバックする(あるいは明確なエラーを返す)ようにしてほしい。

### 3. `sakumock/workflows` の `GET /subscriptions` が未契約時に非nullable仕様の `MonthAppliedPlan` へ `null` を返し、SDKのデコードが失敗する

- **対応済み**: https://github.com/sacloud/sakumock/pull/160 (sakumock v0.8.0)。未契約時は`MonthAppliedPlan`キー自体を省略するようになった。SakPilot側は`internal/workflows/service.go`の`GetSubscription`のフォールバックを削除した。

- パッケージ: `github.com/sacloud/sakumock/workflows`
- ファイル: `handler.go`(`handleGetSubscription`、795行目付近)
- 内容: OpenAPI仕様(`sacloud-sdk-go/api/workflows/openapi/openapi.json`)上、`GET /subscriptions` レスポンスの `MonthAppliedPlan` は(`CurrentPlan`と異なり)`nullable: true` が付いていないオブジェクト型。にもかかわらず `handleGetSubscription` は未契約(`sub == nil`)の場合に `CurrentPlan`/`MonthAppliedPlan` 双方へ素の `nil` を設定してJSONエンコードするため、`"MonthAppliedPlan": null` が返る。SDKが生成する `OptGetSubscriptionOKMonthAppliedPlan`(`OptNil`ではなく`Opt`)はnullのデコードに対応しておらず、`SubscriptionAPI.Read` が `decode field "MonthAppliedPlan": ... unexpected byte 110 'n'` のようなエラーで必ず失敗する。
- 影響: サブスクリプション未契約状態で `GetSubscription`(`Read`)を呼ぶと100%エラーになり、「契約済みかどうかを確認する」というAPIの基本的なユースケースがsakumock上では検証できない。契約後は `MonthAppliedPlan` が実体を持つため問題なくデコードできる。
- SakPilotでの回避: `internal/workflows/service.go` の `GetSubscription` で、エラーメッセージに `"MonthAppliedPlan"` が含まれる場合は未契約(`Subscribed: false`)とみなすフォールバックを実装した。`CurrentPlan`/`MonthAppliedPlan` は常にセットで存在/不在が一致する設計のため、このデコード失敗は実質的に「未契約」の代替シグナルとして安全に使える。
- 報告時の提案: `handleGetSubscription` で未契約時は `MonthAppliedPlan` キー自体を省略する(値を送らない)、またはOpenAPI仕様側で `MonthAppliedPlan` に `nullable: true` を追加してSDKを再生成するかのいずれかで解消できる。

### 4. `sakumock/iam` の `servicepolicy` 系エンドポイント2件がSDKの期待するレスポンス形式と食い違っており、デコードが常に失敗する

- **対応済み**: https://github.com/sacloud/sakumock/pull/155 (sakumock v0.8.0)。`GET /service-policy-status`は`enabled`フィールドで実際の状態を返し、Enable/Disableもストアへ反映されるようになった。`GET /service-policy-rule-templates`もページネーション付きオブジェクトを返すようになった。SakPilot側は`internal/iam/service.go`のフォールバック(`IsServicePolicyEnabled`/`ListServicePolicyRuleTemplates`)を削除し、`internal/iam/service_test.go`のアサーションを実際の状態遷移を検証する内容に更新した。

- パッケージ: `github.com/sacloud/sakumock/iam`
- ファイル: `handler_servicepolicy.go`(`handleServicePolicyStatus`、`handleServicePolicyRuleTemplates`)
- 内容: 2箇所で不一致がある。
  1. `GET /service-policy-status` は `{"is_active": false}` を返すが、SDKが生成する `ServicePolicyStatusGetOK` は `enabled`(必須フィールド)を期待しており、フィールド名が一致しないため `ServicePolicyAPI.IsEnabled` は毎回 `decode application/json: invalid: enabled (field required)` で失敗する。しかも `is_active` は常に `false` 固定で、`POST /enable-service-policy`/`POST /disable-service-policy`(いずれも204のみ返し、状態を永続化していない)を呼んでも変化しない。
  2. `GET /service-policy-rule-templates` はページネーション付きオブジェクト(`{"items": [...], "count": ..., "next": ..., "previous": ...}`)を期待するSDKの `ServicePolicyRuleTemplatesGetOK` に対し、素のJSON配列 `[]` を返すため、`ServicePolicyAPI.ListRuleTemplates` は毎回 `decode ServicePolicyRuleTemplatesGetOK: "{" expected: unexpected byte 91 '['` で失敗する。
- 実害: SDK経由で `ServicePolicyAPI.IsEnabled`/`ListRuleTemplates` を呼ぶと(Enable/Disable自体は204で成功するにもかかわらず)状態確認やルールテンプレート参照が100%エラーになり、sakumock上でこの2つのユースケースを検証できない。
- SakPilotでの回避: `internal/iam/service.go` の `IsServicePolicyEnabled`/`ListServicePolicyRuleTemplates` で、それぞれ上記のデコードエラーメッセージ(`"enabled (field required)"`/`"ServicePolicyRuleTemplatesGetOK"`)を検出した場合にフォールバック(前者は無効`false`、後者は空スライス)を返すようにした。`is_active`が状態を反映せず常に固定値である以上、いずれにせよ実際の有効/無効はsakumock上では検証しようがない。
- 報告時の提案: `handleServicePolicyStatus` のレスポンスフィールド名を `is_active` から `enabled` に修正し、Enable/Disableの呼び出しを実際にストアへ反映する。`handleServicePolicyRuleTemplates` は他の一覧系ハンドラと同じ `writePage` (ページネーション付きオブジェクト)でラップして返すようにしてほしい。

## 改善要望(upstream向け)

### 5. AppRun専有型 `version.CreateParams.CPU` / SDK内の `Version.CPU` の単位がコード上どこにもドキュメント化されていない

- **報告済み**

- パッケージ: `github.com/sacloud/sacloud-sdk-go/api/apprun-dedicated/apis/version`
- 該当: `version.go` の `CreateParams.CPU int64` / `Version.CPU int64`(`json:"cpu"`)
- 内容: フィールドのコメントが無く、「vCPU」なのか「ミリvCPU(1000 = 1vCPU)」なのか型定義だけでは分からない。`version_test.go` のフィクスチャ(`CPU: 1000`, `CPU: 100` 等)から逆算してミリvCPU単位だと推測するしかなかった。
- 実害: SakPilot側でこの単位を誤解しており、デプロイフォームの「CPU (vCPU)」欄のデフォルト値 `0.1` をそのまま送信すると `json: cannot unmarshal number 0.1 into ... int64` で必ず失敗するバグになっていた(SakPilot側で修正済み: ミリvCPUに変換してから送るよう修正)。単位がコード上明記されていれば防げたクラスの不具合。
- 提案: `CPU int64` フィールドに `// CPU ミリvCPU単位のCPU割り当て(例: 1000 = 1 vCPU)` のようなdocコメントを追加してほしい。可能なら `Memory` 等の他の数値フィールドも単位を明記してほしい。

### 6. `sakumock/objectstorage` のS3データプレーンが、control planeで発行したアクセスキーを検証しないため、キー発行込みの結合テストができない

- **対応済み**: https://github.com/sacloud/sakumock/pull/153 (sakumock v0.8.0)。control planeで発行したアクセスキー/シークレットがdata plane(versitygw)のIAMサービスへミラーされ、実際のアプリと同じ資格情報でS3操作を検証できるようになった。SakPilot側は`mise run demo`(`SAKPILOT_ENABLE_OBJECTSTORAGE_DATA_PLANE=1`)実行時に限り`--enable-data-plane`を有効化し、control planeが返す本番向けS3エンドポイントをローカルのversitygwアドレスへ`SAKURA_OBJECT_STORAGE_S3_ENDPOINT_OVERRIDE`で差し替えることで、バケット作成〜アクセスキー発行〜アップロード/一覧取得/ダウンロードまでを実際のアプリと同じ資格情報で動作確認できるようにした(`e2e_server.go`の`setupObjectStorage`、versitygwは`.mise.toml`でgo installツールとして導入、2026-08-13対応)。CI用の`go run -tags e2e .`単体実行やPlaywright E2E(`frontend/e2e/objectstorage.spec.ts`)ではこの環境変数を設定しておらず、従来通りdata plane無効・バケット/アクセスキー管理のみが対象(CI環境にversitygwが無いため)。

- パッケージ: `github.com/sacloud/sakumock/objectstorage`
- 参照: [README「Data plane (S3)」](https://github.com/sacloud/sakumock/tree/main/objectstorage#data-plane-s3)
- 内容: sakumockはS3互換データプレーンを `--enable-data-plane`(または `objectstorage.Config{EnableDataPlane: true}`)で提供しており、外部プロセス [versitygw](https://github.com/versity/versitygw) を起動してPUT/GET/DELETEオブジェクト等を処理する設計になっている。versitygwが `PATH` 上に必要な点はCI側でインストールすれば解決するだけなので、本質的なハードルではない。
  本質的な制約は認証側: data planeの認証は固定のルート資格情報(access key `sakumock` / secret `sakumocksecret`)のみで、control plane(`POST /{site}/v2/account/keys`)で発行したアクセスキー/シークレットはdata plane側では**検証されない**(README明記の仕様)。sakumockの設計としては「versitygwを使えば結合テストができる」想定だと思われるが、**「アプリがcontrol plane経由で発行したキーを使ってS3操作する」という、SDKユーザーの実際のユースケースそのものは、versitygwを用意しても検証できない**。
- 実害: SakPilotの実際のUIフロー(アクセスキーを作成 → そのキーでバケット一覧/オブジェクト一覧を取得)をEnd-to-Endに検証できない。versitygwを追加してもキーの紐付けが再現できないため意味がなく、SakPilotではバケット作成リクエスト自体が(control plane経由のため)成功することのみ確認し、一覧反映やオブジェクト操作はE2E対象外にした(`frontend/e2e/objectstorage.spec.ts` 参照)。これはsakumockの不具合ではなく、現状の設計を把握した上でのSakPilot側の判断。
- 提案(バグ報告ではなく機能要望): data planeがcontrol planeで発行したアクセスキー/シークレットも(固定ルート資格情報に加えて)受け付けるようにしてもらえると、`versitygw` を用意しさえすればキー発行〜オブジェクト操作までを実際のアプリと同じ資格情報で一気通貫にテストできるようになる。

### 7. `sakumock/apprun` のバージョン `CreatedAt` が秒単位に丸められており、短時間に複数回更新すると「最新バージョン」の判定順が不定になる

- **対応済み**: https://github.com/sacloud/sakumock/pull/161 (sakumock v0.8.0)。`ListVersions`のソートが作成シーケンス番号を考慮するようになり、同一秒内に複数バージョンを作成しても順序が決定的になった。SakPilot側は`internal/apprunshared/service_test.go`の`TestService_DeleteVersion`の「削除を試みて失敗したら次の候補を試す」フォールバックを削除し、`versions[0]`が常に最新版であることを前提にした決定的なテストへ変更した。

- パッケージ: `github.com/sacloud/sakumock/apprun`
- ファイル: `store_memory.go` の `createVersionLocked`(`time.Now().UTC().Truncate(time.Second)`)、`ListVersions`(`sort.Slice` で `CreatedAt` の降順ソート、デフォルト`SortOrder=desc`)
- 内容: `Application` を`PATCH`(`ApplicationOp.Update`)するたびに新しい `Version` が暗黙生成される仕様だが、`Version.CreatedAt` は秒未満が切り捨てられるため、同一の壁時計秒内に複数回`Update`を呼ぶと生成された複数バージョンの`CreatedAt`が完全に一致する。`ListVersions`のソートは`CreatedAt`の前後関係のみで比較しており、同値の場合の順序保証(安定ソートや採番順への フォールバック)が無いため、「どのバージョンが`ListVersions`の先頭(＝最新版)として返るか」がリクエストごとに不定になりうる。
- 実害: AppRun共用型のVersion Delete API(`handleDeleteVersion`)は「`ListVersions`の先頭要素と同じIDは削除不可(最新版のため)」というチェックを行っているため、この不定性がそのままAPIレスポンスの不定性になる。SakPilot側でVersion Delete機能のテストを書く際、「作成直後のバージョンではない、かつ削除不可能な最新版でもない、中間バージョン」を用意しようとしても`CreatedAt`だけでは判別できず、最終的に「削除を試みて失敗したら次の候補を試す」というフォールバック実装(`internal/apprunshared/service_test.go`の`TestService_DeleteVersion`)で回避する必要があった。内部的には`MemoryStore`が`versionSeq`という単調増加のシーケンス番号を持っており(`Version.Name`のサフィックスに埋め込まれている)、実際の生成順序自体は失われていないため、ソートに使えばこの問題自体は容易に解消できるはずである。
- 提案: `ListVersions`のソートキーに`CreatedAt`だけでなく`versionSeq`(または相当する単調増加ID)をタイブレーカーとして使う、あるいは`Version.CreatedAt`をより高精度(ナノ秒単位)で記録するようにしてほしい。

### 8. `sakumock/simplenotification` が通知履歴・ソース一覧・ルーティング並び替え・ステータス取得のAPIに未対応

- **対応済み**: https://github.com/sacloud/sakumock/pull/159 (sakumock v0.8.0)。`ListNotificationHistories`/`GetNotificationHistory`/`ListSources`/`ReorderRouting`/`GetCommonServiceItemStatus`が`route.go`に追加された。SakPilot側のUI実装(通知履歴閲覧、ソース選択式UI、並び替え)はまだ未着手(2026-08-13時点)。

- パッケージ: `github.com/sacloud/sakumock/simplenotification`
- ファイル: `route.go`(`routeTable`)
- 内容: `sacloud-sdk-go/api/simple-notification` のOpenAPI定義(`openapi/openapi.yaml`)には以下のエンドポイントが存在するが、sakumockの`routeTable()`には対応するハンドラが登録されていない。
  - `GET /commonserviceitem/simplenotification/histories`(`ListNotificationHistories`)・`GET /commonserviceitem/simplenotification/histories/{id}`(`GetNotificationHistory`) — 通知履歴の一覧・詳細
  - `GET /commonserviceitem/simplenotification/sources`(`ListSources`) — ルーティングの発生源(ソース)一覧
  - `PUT /commonserviceitem/routing/reorder`(`ReorderRouting`) — ルーティングの優先度並び替え
  - `GET /commonserviceitem/{id}/status`(`GetCommonServiceItemStatus`) — 送信先/グループの有効性ステータス
  - Destination/Group/Routingの基本CRUD(`POST`/`GET`/`PUT`/`DELETE` `/commonserviceitem`)とGroupへのメッセージ送信(`POST /commonserviceitem/{id}/simplenotification/message`)は実装されている。
- 実害: SakPilotの簡易通知機能(`internal/simplenotification/`)はDestination/Group/RoutingのCRUD + テストメッセージ送信のみをE2E対象にできた。通知履歴の閲覧、ルーティング作成時のソースID選択UI(現状は数値ID直接入力)、ルーティングの並び替えはUI自体を実装してもE2E検証ができないため、今回のスコープでは見送った(`docs/manual/simplenotification.md`の「未対応の機能」参照)。
- 提案: 上記4エンドポイントの対応を追加してほしい。特に`ListSources`が使えるようになれば、ルーティング作成フォームでソースIDをID直接入力ではなく選択式にでき、UXが大きく改善する。

### 9. `sacloud-sdk-go/api/eventbus` の `Provider.Class` クエリ注入ミドルウェアが実際のリクエストに反映されず、`Trigger`/`Schedule`/`ProcessConfiguration`のList APIが常に全件を返す

- パッケージ: `github.com/sacloud/sacloud-sdk-go/api/eventbus`
- ファイル: `filter.go`(`injectFilterMiddleware`/`injectFilterToRequest`)、`triggers.go`/`schedules.go`/`process_configurations.go`(各`List`メソッド)
- 内容: Trigger/Schedule/ProcessConfigurationは同一の`GET /commonserviceitem`エンドポイントを共有しており、種別ごとの絞り込みは`injectFilterMiddleware`が生成する`saclient.Middleware`が`req.URL.RawQuery`に`{"Filter":{"Provider.Class":"eventbustrigger"}}`のようなJSONクエリを注入する仕組みで実現される設計になっている(sakumock側は`providerClassFilter`でこの形式を正しくパースでき、直接HTTPリクエストを組み立てて検証した限りではフィルタは機能する)。しかし実際にSDKの`TriggerOp.List`/`ScheduleOp.List`/`ProcessConfigurationOp.List`経由で呼び出すと、ミドルウェアが呼ばれていないのか`RawQuery`が最終的なリクエストに反映されず、常に空文字列のまま送信される(プロキシを挟んでリクエストを観測して確認)。結果として`GET /commonserviceitem`は種別を問わず全件を返し、SDK単体では`ScheduleAPI.List`を呼んでもTrigger/ProcessConfigurationを含む全アイテムが返ってくる。
- 影響: 複数種別のリソースを1つのeventbusサーバーに作成した状態でいずれかの`List`を呼ぶと、意図しない他種別のアイテムが混入する。`sacloud-sdk-go/api/eventbus`のテスト(`client_test.go`の`TestNewClient_WithCustomEndpoint`)はリクエストが1件飛んだことしか検証しておらず、`RawQuery`の中身は未検証のためこのバグはCIをすり抜けている。
- SakPilotでの回避: `internal/eventbus/service.go`の`ListTriggers`/`ListSchedules`/`ListProcessConfigurations`で、レスポンスの各アイテムを`item.Settings.IsTriggerSettings()`等のSettings型判定でクライアント側フィルタしてから返すようにした。
- 報告時の提案: `injectFilterMiddleware`が生成するミドルウェアが実際に`saclient`のミドルウェアチェーンに乗っているか(`WithMiddleware`オプションの適用順序、複数回の`DupWith`呼び出しでの上書き等)を調査してほしい。可能であれば`client_test.go`に「`RawQuery`が期待通り設定されているか」を検証するテストケースを追加すると再発を防げる。

### 10. `sacloud-sdk-go/api/apigw` の `Service.ConnectTimeout`/`WriteTimeout`/`ReadTimeout` のGodocが「秒数」だが、実際の単位はミリ秒

- **報告済み**

- パッケージ: `github.com/sacloud/sacloud-sdk-go/api/apigw`
- ファイル: `apis/v1/oas_schemas_gen.go`(`ServiceDetailRequest`/`ServiceDetail`/`ServiceDetailResponse`の`ConnectTimeout`/`WriteTimeout`/`ReadTimeout`フィールド、コメントはそれぞれ「接続タイムアウト秒数」「書き込みタイムアウト秒数」「読み込みタイムアウト秒数」)
- 内容: `sakumock/apigw`の`applyServiceDefaults`(`store_memory.go`)は未指定時のデフォルト値として`ConnectTimeout`/`WriteTimeout`/`ReadTimeout`にいずれも`60000`を設定している。仮に単位が秒であれば60000秒(≒16.6時間)というタイムアウト値は非現実的であり、Kong等の一般的なAPIゲートウェイの慣習(ミリ秒単位、デフォルト60000ms=60秒)から見てもミリ秒単位と考えるのが自然。実際にsakumockに`ConnectTimeout: 5`(秒のつもりで指定)を送信してもバリデーションエラーにならず素通りする(=5ミリ秒として保存される)ため、Godocの「秒数」を信じて実装すると気づかないまま極端に短いタイムアウトを設定してしまう。
- 実害: SakPilotの初期実装では`internal/apigw/service.go`のフィールド名・フロントエンドのフォームラベルをGodoc通り「秒」として実装してしまい、E2Eマニュアル用スクリーンショット撮影時にサービス詳細画面の表示値(デフォルト適用後の`60000s`)を見て初めて単位の誤りに気づいた。`docs/manual/apigw.md`用のスクリーンショットで実際の表示を確認する工程が無ければ本番相当のデータでも気づきにくいバグだった。
- 対応: SakPilot側はUIラベルを「(ミリ秒)」に修正し、フォームのデフォルト値もミリ秒基準(5000/60000/60000)に変更して回避した。SDK・sakumock側の修正は行っていない。
- 提案: Godocのコメントを「ミリ秒」に修正するか、可能であればOpenAPI定義(`openapi/openapi.json`)のフィールド説明・`example`値を実態に合わせてほしい。

### 11. `sakumock/iam` が `user2fa`(2要素認証管理)のAPIに未対応

- **対応済み**: https://github.com/sacloud/sakumock/pull/162 (sakumock v0.8.0)。OTP無効化・信頼済みデバイス一覧/削除/全削除・セキュリティキー管理の各エンドポイントが実装され、`route.go`に登録されている。SakPilot側のuser2fa実装(Go/RPC/フロントエンド)は本コミット時点では未着手。着手を検討する。

- パッケージ: `github.com/sacloud/sakumock/iam`
- ファイル: `route.go`(`routeTable`)
- 内容: `sacloud-sdk-go/api/iam/apis/user2fa`にはOTP無効化・信頼済みデバイス一覧/削除/全削除・セキュリティキー管理のAPIが定義されているが、sakumockの`routeTable()`には対応するハンドラが1件も登録されていない(`sso`/`scim`/`servicepolicy`は同じPLAN.mdタスクで対応確認済み)。
- 実害: `user2fa`はSakPilot側でGo実装・RPC・フロントエンドを作ってもE2E検証ができないため、PLAN.mdのIAMタスク5では対象外とした(sso/scim/servicepolicyの3つのみ実装)。
- 提案: 上記エンドポイント群への対応を追加してほしい。追加された場合はSakPilot側でも改めて着手を検討する。

### 12. `sacloud-sdk-go/api/service-endpoint-gateway` の `NewClient` が、`Zone`設定時に`SAKURA_ENDPOINTS_SERVICE_ENDPOINT_GATEWAY`によるエンドポイント上書きを無視する

- パッケージ: `github.com/sacloud/sacloud-sdk-go/api/service-endpoint-gateway`
- ファイル: `client.go`(`NewClient`)
- 内容: `NewClient`は`endpointConfig.Endpoints["service_endpoint_gateway"]`(環境変数`SAKURA_ENDPOINTS_SERVICE_ENDPOINT_GATEWAY`由来)がセットされていれば`endpoint`変数に採用するが、直後に`if endpointConfig.Zone != ""`のブロックで無条件に`endpoint`をゾーンベースの既定URL(`https://secure.sakura.ad.jp/cloud/zone/<zone>/api/cloud/1.1/`)で上書きしてしまう。KMS/secretmanager等の他サービスは元々ゾーン非依存のためこの分岐自体が無く問題にならないが、SEGはゾーン依存リソースであり、通常利用では`Zone`を必ず指定する。結果として、`SAKURA_ENDPOINTS_SERVICE_ENDPOINT_GATEWAY`でエンドポイントをテスト用サーバー等に差し替えたいケースで、`Zone`を同時に指定すると常に無視されて実際のさくらのクラウドAPIへリクエストが飛んでしまう(実際に`httptest.Server`を指すよう環境変数を設定した状態でGoテストを実行したところ、本物の`secure.sakura.ad.jp`から401 Unauthorizedが返り気づいた)。
- 実害: SakPilotはsakumockがSEG未対応のため自作のfakeサーバーでGoテストを書く方針を取ったが、上記の優先順位のせいで`seg.NewClient`をそのまま使うテストコードは(意図せず)実際のインターネット上のさくらのクラウドAPIにリクエストしてしまう。`internal/serviceendpointgateway/service.go`では回避のため`seg.NewClient`を呼ばず、同等のロジック(エンドポイント上書き優先→ゾーンURLへフォールバック)を`buildEndpoint`として自前で再実装し、`seg.NewClientWithAPIRootURL`に直接渡す形にした。
- 提案: `NewClient`内の優先順位を「明示的なエンドポイント上書き→Zoneベースの既定URL」の順に入れ替えてほしい(他の多くのSDKでの一般的な優先順位と合わせる形)。合わせて、`Zone`指定時にテスト用サーバーへの向き先を差し替える手段(`WithTestServer`は`http_request_doer.go`を見る限りルーティングには使われず`*http.Client`の差し替えのみに留まっており、この用途には使えない)をドキュメント化してもらえると助かる。

## その他メモ(バグではないが気づいた点)

- `fake.InitDataStore()` / `fake.SwitchFactoryFuncToFake()` はいずれも `sync.Once` でプロセス内1回しか実行されない。同一プロセス内で複数のGoテストが同じデータストアを共有することになるため、テスト間で状態がリークする(SakPilotの `internal/sakura/disk_test.go` ではID/存在ベースの検証に倒すことで対応した)。ドキュメントに明記しておいてもらえると、初見でハマる人が減りそう。
- `iaas-api-go` の `SimpleMonitor` オブジェクトは `GetDelayLoop`/`GetMaxCheckAttempts`/`GetRetryInterval`/`GetNotifyInterval` が未設定(ゼロ値)時にドキュメント記載のデフォルト値へフォールバックする一方、`GetTimeout` だけは同様のフォールバックが無く未設定時に `0` をそのまま返す(`zz_models.go`)。`terraform-provider-sakura` のドキュメント(`docs/resources/simple_monitor.md`)では `timeout` は範囲`[10-30]`のOptional項目とされておりゼロは想定外の値のはずだが、SDKの型からはこの非対称性が読み取れない。SakPilotの監視設定編集フォーム(`MonitorDetail.tsx`)にHTML5の`required`+`min=10`を追加した際、`Timeout`が未設定のまま作成された(＝アプリ外で作られた、あるいは古いE2Eシードのような)`SimpleMonitor`を開くと初期値が`0`になり編集自体がブロックされることが判明した。SakPilot側は`toSettingsForm`で`monitor.timeout || 10`のフォールバックを入れて回避した(E2Eシード`seedSimpleMonitors`にも`Timeout: 10`を明示)。他のフィールドと同様に`GetTimeout`にもデフォルト値へのフォールバックを入れてもらえると、この非対称性に起因する呼び出し側の考慮漏れを防げる。
