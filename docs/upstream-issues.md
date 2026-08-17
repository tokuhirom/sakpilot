# upstream (sacloud) への報告候補メモ

SakPilotの開発・E2Eテスト整備(2026-08-08)で見つけた、`sacloud-sdk-go` / `sakumock` 側の不具合・改善要望のメモ。まだupstreamには未報告。issue化する際はここから起こす。

対象バージョン(`go.mod`):
- `github.com/sacloud/sacloud-sdk-go v0.0.2-0.20260814002005-eb1580006797`(2026-08-17時点で新しいタグが未リリースのためpseudo-version。`v0.0.1`タグから64コミット先行)
- `github.com/sacloud/sakumock v0.8.1-0.20260814053102-2d61a37ed29e`(同上、`v0.8.0`タグから5コミット先行)

## 改善要望(upstream向け)

### 5. AppRun専有型 `version.CreateParams.CPU` / SDK内の `Version.CPU` の単位がコード上どこにもドキュメント化されていない

- **報告済み**

- パッケージ: `github.com/sacloud/sacloud-sdk-go/api/apprun-dedicated/apis/version`
- 該当: `version.go` の `CreateParams.CPU int64` / `Version.CPU int64`(`json:"cpu"`)
- 内容: フィールドのコメントが無く、「vCPU」なのか「ミリvCPU(1000 = 1vCPU)」なのか型定義だけでは分からない。`version_test.go` のフィクスチャ(`CPU: 1000`, `CPU: 100` 等)から逆算してミリvCPU単位だと推測するしかなかった。
- 実害: SakPilot側でこの単位を誤解しており、デプロイフォームの「CPU (vCPU)」欄のデフォルト値 `0.1` をそのまま送信すると `json: cannot unmarshal number 0.1 into ... int64` で必ず失敗するバグになっていた(SakPilot側で修正済み: ミリvCPUに変換してから送るよう修正)。単位がコード上明記されていれば防げたクラスの不具合。
- 提案: `CPU int64` フィールドに `// CPU ミリvCPU単位のCPU割り当て(例: 1000 = 1 vCPU)` のようなdocコメントを追加してほしい。可能なら `Memory` 等の他の数値フィールドも単位を明記してほしい。

### 9. `sacloud-sdk-go/api/eventbus` の `Provider.Class` クエリ注入ミドルウェアが実際のリクエストに反映されず、`Trigger`/`Schedule`/`ProcessConfiguration`のList APIが常に全件を返す

- **報告済み**([sacloud/sacloud-sdk-go#222](https://github.com/sacloud/sacloud-sdk-go/pull/222))

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

### 12. `sacloud-sdk-go/api/service-endpoint-gateway` の `NewClient` が、`Zone`設定時に`SAKURA_ENDPOINTS_SERVICE_ENDPOINT_GATEWAY`によるエンドポイント上書きを無視する

- パッケージ: `github.com/sacloud/sacloud-sdk-go/api/service-endpoint-gateway`
- ファイル: `client.go`(`NewClient`)
- 内容: `NewClient`は`endpointConfig.Endpoints["service_endpoint_gateway"]`(環境変数`SAKURA_ENDPOINTS_SERVICE_ENDPOINT_GATEWAY`由来)がセットされていれば`endpoint`変数に採用するが、直後に`if endpointConfig.Zone != ""`のブロックで無条件に`endpoint`をゾーンベースの既定URL(`https://secure.sakura.ad.jp/cloud/zone/<zone>/api/cloud/1.1/`)で上書きしてしまう。KMS/secretmanager等の他サービスは元々ゾーン非依存のためこの分岐自体が無く問題にならないが、SEGはゾーン依存リソースであり、通常利用では`Zone`を必ず指定する。結果として、`SAKURA_ENDPOINTS_SERVICE_ENDPOINT_GATEWAY`でエンドポイントをテスト用サーバー等に差し替えたいケースで、`Zone`を同時に指定すると常に無視されて実際のさくらのクラウドAPIへリクエストが飛んでしまう(実際に`httptest.Server`を指すよう環境変数を設定した状態でGoテストを実行したところ、本物の`secure.sakura.ad.jp`から401 Unauthorizedが返り気づいた)。
- 実害: SakPilotはsakumockがSEG未対応のため自作のfakeサーバーでGoテストを書く方針を取ったが、上記の優先順位のせいで`seg.NewClient`をそのまま使うテストコードは(意図せず)実際のインターネット上のさくらのクラウドAPIにリクエストしてしまう。`internal/serviceendpointgateway/service.go`では回避のため`seg.NewClient`を呼ばず、同等のロジック(エンドポイント上書き優先→ゾーンURLへフォールバック)を`buildEndpoint`として自前で再実装し、`seg.NewClientWithAPIRootURL`に直接渡す形にした。
- 提案: `NewClient`内の優先順位を「明示的なエンドポイント上書き→Zoneベースの既定URL」の順に入れ替えてほしい(他の多くのSDKでの一般的な優先順位と合わせる形)。合わせて、`Zone`指定時にテスト用サーバーへの向き先を差し替える手段(`WithTestServer`は`http_request_doer.go`を見る限りルーティングには使われず`*http.Client`の差し替えのみに留まっており、この用途には使えない)をドキュメント化してもらえると助かる。

## その他メモ(バグではないが気づいた点)

- `fake.InitDataStore()` / `fake.SwitchFactoryFuncToFake()` はいずれも `sync.Once` でプロセス内1回しか実行されない。同一プロセス内で複数のGoテストが同じデータストアを共有することになるため、テスト間で状態がリークする(SakPilotの `internal/sakura/disk_test.go` ではID/存在ベースの検証に倒すことで対応した)。ドキュメントに明記しておいてもらえると、初見でハマる人が減りそう。
- `iaas-api-go` の `SimpleMonitor` オブジェクトは `GetDelayLoop`/`GetMaxCheckAttempts`/`GetRetryInterval`/`GetNotifyInterval` が未設定(ゼロ値)時にドキュメント記載のデフォルト値へフォールバックする一方、`GetTimeout` だけは同様のフォールバックが無く未設定時に `0` をそのまま返す(`zz_models.go`)。`terraform-provider-sakura` のドキュメント(`docs/resources/simple_monitor.md`)では `timeout` は範囲`[10-30]`のOptional項目とされておりゼロは想定外の値のはずだが、SDKの型からはこの非対称性が読み取れない。SakPilotの監視設定編集フォーム(`MonitorDetail.tsx`)にHTML5の`required`+`min=10`を追加した際、`Timeout`が未設定のまま作成された(＝アプリ外で作られた、あるいは古いE2Eシードのような)`SimpleMonitor`を開くと初期値が`0`になり編集自体がブロックされることが判明した。SakPilot側は`toSettingsForm`で`monitor.timeout || 10`のフォールバックを入れて回避した(E2Eシード`seedSimpleMonitors`にも`Timeout: 10`を明示)。他のフィールドと同様に`GetTimeout`にもデフォルト値へのフォールバックを入れてもらえると、この非対称性に起因する呼び出し側の考慮漏れを防げる。
- `sacloud-sdk-go/api/cloudhsm` の `ClientOp.Update`(`certificate.go`)は更新リクエストに `Certificate` を含めない(SDK内のコメントで「これは更新できないフィールドだがゼロ値は不正」と明記されており、実APIでは送らなければサーバー側で既存値が保持される想定と読める)。ところが `sakumock/cloudhsm` はリクエストで受け取った(空の)`Certificate` をそのままレコードに上書き保存するため、`ClientOp.Update`で名前だけ変更したつもりでも、sakumockを相手にすると証明書が空文字になって返ってくる。実APIでの挙動は未検証(検証環境が無いため)だが、SDK側のコメントと矛盾する挙動なのでsakumock側の実装ミスの可能性が高い。SakPilotでは`internal/cloudhsm/service_test.go`の`TestService_ClientCRUD`でこの挙動をそのまま期待値として固定した(コメントでこのメモへの参照を残している)。実API相手に確認できたら、sakumockのUpdate時は空の`Certificate`を無視して既存値を保持するように修正を提案したい。
