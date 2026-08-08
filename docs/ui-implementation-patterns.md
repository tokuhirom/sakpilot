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
