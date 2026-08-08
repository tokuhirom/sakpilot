# upstream (sacloud) への報告候補メモ

SakPilotの開発・E2Eテスト整備(2026-08-08)で見つけた、`sacloud-sdk-go` / `sakumock` 側の不具合・改善要望のメモ。まだupstreamには未報告。issue化する際はここから起こす。

対象バージョン(`go.mod`):
- `github.com/sacloud/sacloud-sdk-go v0.0.1`
- `github.com/sacloud/sakumock v0.7.2`

## 確認済みバグ

### 1. `iaas/fake` の `ProxyLBOp.SetCertificates` がnilポインタ参照でpanicする

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

## 改善要望(upstream向け)

### 2. AppRun専有型 `version.CreateParams.CPU` / SDK内の `Version.CPU` の単位がコード上どこにもドキュメント化されていない

- パッケージ: `github.com/sacloud/sacloud-sdk-go/api/apprun-dedicated/apis/version`
- 該当: `version.go` の `CreateParams.CPU int64` / `Version.CPU int64`(`json:"cpu"`)
- 内容: フィールドのコメントが無く、「vCPU」なのか「ミリvCPU(1000 = 1vCPU)」なのか型定義だけでは分からない。`version_test.go` のフィクスチャ(`CPU: 1000`, `CPU: 100` 等)から逆算してミリvCPU単位だと推測するしかなかった。
- 実害: SakPilot側でこの単位を誤解しており、デプロイフォームの「CPU (vCPU)」欄のデフォルト値 `0.1` をそのまま送信すると `json: cannot unmarshal number 0.1 into ... int64` で必ず失敗するバグになっていた(SakPilot側で修正済み: ミリvCPUに変換してから送るよう修正)。単位がコード上明記されていれば防げたクラスの不具合。
- 提案: `CPU int64` フィールドに `// CPU ミリvCPU単位のCPU割り当て(例: 1000 = 1 vCPU)` のようなdocコメントを追加してほしい。可能なら `Memory` 等の他の数値フィールドも単位を明記してほしい。

### 3. `sakumock/objectstorage` のS3データプレーン(`--enable-data-plane`)が外部バイナリ依存・control planeキー非検証で、CI/E2Eから使うにはハードルが高い

- パッケージ: `github.com/sacloud/sakumock/objectstorage`
- 参照: [README「Data plane (S3)」](https://github.com/sacloud/sakumock/tree/main/objectstorage#data-plane-s3)
- 内容(誤解のないよう正確に): sakumockはS3互換データプレーン自体は提供しており、`--enable-data-plane`(または `objectstorage.Config{EnableDataPlane: true}`)を指定すると外部プロセス [versitygw](https://github.com/versity/versitygw) を起動してPUT/GET/DELETEオブジェクト等を処理してくれる。ただし設計上意図的に以下の制約がある(README記載の理由: バイナリを同梱すると配布物が肥大化するため):
  - versitygwはsakumockに同梱されず、`PATH` 上に別途インストールしておく必要がある(無ければ明示的に起動失敗する仕様)。
  - data planeの認証は固定のルート資格情報(access key `sakumock` / secret `sakumocksecret`)のみで、control plane(`POST /{site}/v2/account/keys`)で発行したアクセスキー/シークレットはdata plane側では検証されない。
- 実害: 「(SakPilotの実UIフローである)アクセスキーを作成 → そのキーでバケット一覧/オブジェクト一覧を取得する」という一連のS3呼び出しを、外部バイナリなしのCI環境でEnd-to-Endに検証できない。SakPilotではバケット作成リクエスト自体が(control plane経由のため)成功することのみ確認し、一覧反映やオブジェクト操作はE2E対象外にした(`frontend/e2e/objectstorage.spec.ts` 参照)。これはsakumockの不具合ではなく、現状の設計を把握した上でのSakPilot側の判断。
- 提案(バグ報告ではなく機能要望): 外部バイナリを前提としない、最小限のインメモリS3互換data plane(PUT/GET/DELETE/ListObjectsV2程度でよい)を代替オプションとして用意し、かつcontrol planeで発行したアクセスキーをそのdata planeでも検証してもらえると、`versitygw` を用意できないCI環境でもアクセスキー発行〜オブジェクト操作までを一気通貫でテストできて助かる。

## その他メモ(バグではないが気づいた点)

- `fake.InitDataStore()` / `fake.SwitchFactoryFuncToFake()` はいずれも `sync.Once` でプロセス内1回しか実行されない。同一プロセス内で複数のGoテストが同じデータストアを共有することになるため、テスト間で状態がリークする(SakPilotの `internal/sakura/disk_test.go` ではID/存在ベースの検証に倒すことで対応した)。ドキュメントに明記しておいてもらえると、初見でハマる人が減りそう。
