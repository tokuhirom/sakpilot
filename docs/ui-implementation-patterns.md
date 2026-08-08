# UI実装パターン集

PLAN.mdのリソースgap監査(2026-08-07〜)を通じて各リソースのCreate/Update/Delete系機能を実装する中で、繰り返し使われてきた設計パターンをまとめる。新しいリソースに書き込み系機能を追加する際は、まずここに近いパターンが無いか確認してから実装する。

具体的な参照実装ファイルは執筆時点(2026-08-09)のものなので、リネーム・削除されている場合は同種の新しいコンポーネントを探すこと。

## バックエンド(Go)

### Update / UpdateSettings 分割方式

名前・説明のような軽量なメタ情報の更新と、通知設定・ヘルスチェック・実サーバー一覧のような重量級の設定更新を、別々のAPI呼び出し(`Update` / `UpdateSettings`)に分割する。フロント側もこれに合わせて「基本情報の編集」と「監視設定の編集」を別モーダル/別フォームにする。

- 例: DNS(`UpdateDNS`/`UpdateDNSRecords`)、SimpleMonitor(`UpdateSimpleMonitor`/`UpdateSimpleMonitorSettings`)、GSLB(`UpdateGSLB`/`UpdateGSLBSettings`)、Database(`Update`/`UpdateSettings`)
- 参照: `internal/sakura/global.go`

### SettingsHash / ExpressionHashによる楽観ロック

さくらのクラウドAPIの一部のUpdate系は`SettingsHash`(または`ExpressionHash`)による楽観ロックが必須で、かつリクエストが「全設定を含む形」(部分更新ではない)になっている。この場合、素朴に変更したいフィールドだけ入れて送ると**未指定フィールドが消える**。

対策: Update前に必ず対象リソースをRead ->  現在の全設定 + SettingsHashを取得 -> 変更したいフィールドだけ上書き -> 全体を送信、という「事前Read必須」パターンを踏襲する。

- 対象: PacketFilter(ExpressionHash)、GSLB/SimpleMonitor/ContainerRegistry/ProxyLB/EnhancedDB(SettingsHash)
- ProxyLBは特に設定項目が多く(Rules/LetsEncrypt/StickySession等)、「名前だけ変更したい」Updateであっても事前Readで全項目を埋めてから送信する必要があった。詳細は`internal/sakura/proxylb.go`
- Monitoring Suite(本ドキュメント追加時点の実装)はPATCH的な部分更新(`PartialUpdate`)が用意されており、この事前Readパターンが不要な例外。API側の設計次第でどちらのパターンになるか変わるため、新しいリソースを実装する際はSDKのUpdate系メソッドが部分更新(PATCH)か全体更新(PUT)かを最初に確認すること

### 一度きりのSecret/Token表示

APIのCreateレスポンスでしか取得できない秘匿情報(ObjectStorageのアクセスキーSecret、Monitoring SuiteのアクセスキーSecret等)は、DTOを「一覧・詳細取得用」と「作成直後用」で分ける。

- 一覧/詳細用の型(例: `MSMetricsAccessKey`)にはSecretを含めない
- 作成専用の型(例: `MSMetricsAccessKeyCreated`)にのみSecretを含め、Create系メソッドの戻り値として一度だけ返す
- フロント側は作成直後にモーダルでSecretを表示し、「この画面を閉じると二度と表示されない」旨の警告を出す。ObjectStorageはさらにキーチェーンへの保存導線(`SaveObjectStorageSecretKey`)を用意しているが、そのような永続化先が無いリソース(Monitoring Suite等)は単純に表示のみで良い

### Wailsバインディング生成の制約

Goメソッドの戻り値が`(値1, 値2, error)`のように非error値を2つ以上持つ場合、`wails generate module`が生成する`.d.ts`は最初の値の型しか反映されず、2つ目以降は実質失われる。複数値を返したい場合は単一の構造体にまとめて返すこと。

- 例: Archive `CreateBlank`は`(*ArchiveInfo, *FTPServerInfo, error)`ではなく`(*ArchiveWithFTP, error)`(`ArchiveWithFTP{Archive, FTPServer}`)を返す設計にした。`internal/sakura/archive.go`参照

### Detail画面が無いリソース

古くからあるリソース(Disk/Database/EnhancedDB/NFS/Server等)は一覧画面はあっても詳細画面(`XDetail.tsx`)が無いことが多かった。Create/Update機能を追加するタイミングで新設し、一覧のカードクリック/行クリックで遷移する導線を追加するのが定石。

## フロントエンド(React)

### 作成モーダル

`modal-overlay` + `modal-content`のペアで実装する。オーバーレイクリックでキャンセル、`stopPropagation`でモーダル内クリックの伝播を止める。

```tsx
{showCreate && (
  <div className="modal-overlay" onClick={handleCreateCancel} style={{
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  }}>
    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
      backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
      padding: '20px', minWidth: '320px', maxWidth: '420px',
    }}>
      {/* form-group群、エラー表示、確認アクション */}
    </div>
  </div>
)}
```

参照実装: `DNSList.tsx`(最もシンプルな例)、`ArchiveList.tsx`(セレクトによる分岐が複雑な例)

### 必須項目のフォームバリデーション(HTML5 `required` + `<form>`化 + 視覚マーカー)

PLAN.md Tier5(フォームUX見直し)対応の一環で確立したルール。新規に作成/編集フォームを実装・改修する際は必ず以下を満たすこと。

1. **モーダル/インライン編集は`<div>`+ボタン`onClick`ではなく`<form onSubmit>`で実装する**。既存の多くのモーダルは`<div className="modal-content">`の中でボタンに`onClick`ハンドラを付けて送信処理を呼ぶ構造になっているが、これでは`required`属性を付けてもブラウザネイティブバリデーション(未入力での送信ブロック・吹き出し表示)が機能しない。送信ボタンは`type="submit"`、キャンセルボタンは`type="button"`にする(`type="button"`を忘れると意図せず送信されてしまう)。
   ```tsx
   <form onSubmit={handleSubmit}>
     {/* form-group群 */}
     <div className="confirm-actions">
       <button type="button" className="btn btn-secondary" onClick={handleCancel}>キャンセル</button>
       <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? '保存中...' : '保存する'}</button>
     </div>
   </form>
   ```
   `handleSubmit`は`(e: React.FormEvent) => { e.preventDefault(); ... }`の形にする。
2. **必須項目には`required`属性を必ず付与する。** 数値項目は`type="number"`+`min`/`max`(SDK/APIの制約に合わせる。制約が不明な場合はSDKの`DefaultValue`等から妥当な下限のみ設定し、根拠のない上限は付けない)。形式が一意な項目(IPv4アドレス等)には`pattern`を付与する。形式にバリエーションがある項目(DNSレコードのrdata等、レコードタイプによって書式が変わる)は誤って正当な入力を弾くリスクがあるため、`pattern`で縛らずplaceholderで入力例を示すに留める。
3. **必須項目は`required`属性だけでなく、必ず見た目でも分かるようにする。** アンカーの有無で付け方を使い分ける:
   - `<label>`がある項目: ラベル末尾に`<span className="required-mark">*</span>`を付与する。
     ```tsx
     <label>名前<span className="required-mark">*</span></label>
     ```
   - `<label>`が無い項目(インライン編集フォームや、サーバー一覧のような動的追加行でplaceholderのみ運用している箇所): `placeholder`の末尾に半角スペース+`*`を付与する(表記を統一するため、labelと同じ`*`を使い「(必須)」等の別表記は使わない)。
     ```tsx
     <input placeholder="IPアドレス *" required ... />
     ```
   - 任意項目には何も付けない(無印=任意という前提を崩さない)。
   - `.required-mark`は`App.css`で共通定義済み(エラーメッセージと同系色`#ff6b6b`)。
4. **HTML5属性で代替可能になった手書きバリデーションは削除する。** `required`/`pattern`/`min`/`max`がブラウザ側で送信をブロックするようになった結果、フォーム送信ハンドラ内に残っていた同趣旨のJSバリデーション分岐(例:「IPアドレスが空なら独自エラーメッセージを出す」)は実質到達不能になる。到達不能と判断したら削除し、対応するテストはカスタムエラーメッセージの表示確認ではなく、`input.validity.valid`がfalseであること・送信APIが呼ばれないことを確認する形に書き換える。
   ```tsx
   const ipInput = screen.getByPlaceholderText('IPアドレス *') as HTMLInputElement;
   await user.click(screen.getByRole('button', { name: '保存する' }));
   expect(ipInput.validity.valid).toBe(false);
   expect(UpdateXxx).not.toHaveBeenCalled();
   ```
5. Placeholderの文字列を変更した場合、`getByPlaceholderText`/`getByPlaceholder`で参照しているVitest/Playwrightテストも合わせて更新すること。

参照実装: `DNSDetail.tsx`(レコード追加/編集モーダル)、`GSLBList.tsx`(作成モーダル)、`GSLBDetail.tsx`(基本情報インライン編集・監視設定編集モーダル、ラベル無しの動的行にplaceholderマーカーを使う例)

### 削除確認ダイアログ

`confirm-overlay` + `confirm-dialog`(モーダルよりCSSクラスが異なる、軽量な確認専用)。「削除中...」のようなin-flight表示でボタンをdisabledにし、二重送信を防ぐ。

```tsx
{confirmDelete && (
  <div className="confirm-overlay" onClick={handleDeleteCancel}>
    <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
      <p>「{confirmDelete.name}」を削除しますか？</p>
      <p className="confirm-warning">この操作は取り消せません。</p>
      <div className="confirm-actions">
        <button className="btn btn-secondary" onClick={handleDeleteCancel}>キャンセル</button>
        <button className="btn btn-danger" onClick={handleDeleteConfirm}>削除する</button>
      </div>
    </div>
  </div>
)}
```

### 基本情報のインライン編集(`editingBasic`パターン)

詳細画面のカード内で「編集」ボタンを押すと、表示用テーブルがそのままフォームに切り替わる(別モーダルにしない)。名前・説明程度のシンプルな項目に向く。

- 参照: `SwitchDetail.tsx`(最小構成)、`ContainerRegistryDetail.tsx`/`EnhancedDBDetail.tsx`/`MonitoringMetricDetail.tsx`(同パターン踏襲)
- 設定項目が多い場合(サーバー一覧の追加編集削除等)は、別モーダルに分離する(GSLB/ProxyLBの監視設定編集モーダル等)

### ステータス値の比較

APIから返るステータス文字列は大文字小文字が混在しうるため、必ず`toLowerCase()`で正規化してから比較する(CLAUDE.md「Status Indicators」参照)。KMS/AppRunで実際に「架空の値をチェックしていて常にフォールバック表示になる」バグが複数回見つかっている。新しいステータス表示を実装する際はSDKの列挙型定義を実際に確認し、決め打ちしない。

## テスト(Vitest)

### `useNavigate`を使うコンポーネントは`MemoryRouter`で包む

`useNavigate()`は`<Router>`コンテキスト外だと例外を投げる。詳細画面コンポーネント(削除成功後に一覧へ戻る、等)をテストする際は`render()`を`MemoryRouter`でラップするヘルパーを用意する。

```tsx
function renderDetail(id = 'xxx') {
  return render(
    <MemoryRouter>
      <XDetail profile="default" id={id} />
    </MemoryRouter>
  );
}
```

参照: `ServerDetail.test.tsx`、`MonitoringMetricDetail.test.tsx`

### `getByLabelText`を使うには`htmlFor`/`id`が必要

`form-group`の`<label>`は`<input>`を暗黙にラップしていない(隣接するだけ)。`getByPlaceholderText`で代用できない項目(プレースホルダーが無い、複数の入力が同じプレースホルダーを持つ等)を`getByLabelText`でテストしたい場合は、実装側に`htmlFor`/`id`を明示的に付与する。

- 例: `ArchiveList.tsx`の`<label htmlFor="archive-create-source">`

### 同じラベルのボタンが複数ある場合

一覧行の「削除」ボタンと詳細ヘッダーの「削除」ボタンなど、同じテキストのボタンが複数存在しうる画面では`findByRole`が`multiple elements found`エラーになる。`findAllByRole`で全件取得し、DOM順序(先頭=ヘッダー、末尾=行内、など)で狙った要素を選ぶ。

### `setInterval`ポーリングを伴う操作

`userEvent`はfake timers下では内部delayが解決せず固まる。ポーリングを伴うフロー(起動/停止後のステータス監視等)は`fireEvent`でクリックし、待機には`vi.waitFor`(testing-libraryの`waitFor`ではない)を使う。参照: `ServerList.test.tsx`
