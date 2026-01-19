# SakPilot 未実装機能リスト

sact (CLI ツール) の実装状況と比較した、SakPilot での未実装機能一覧。

## 最優先: プロファイル管理機能

現在は usacloud のプロファイル (`~/.usacloud/`) を読み取るのみ。以下の機能が未実装:

- [ ] プロファイルの新規作成
- [ ] プロファイルの編集（API キー、シークレットの変更）
- [ ] プロファイルの削除
- [ ] デフォルトプロファイルの設定
- [ ] プロファイルの接続テスト

## sact で実装済み → SakPilot 未実装 (高優先度)

| リソース | API名 | 説明 | ゾーン依存 |
|---------|------|------|-----------|
| Internet | InternetAPI | ルーター | Yes |
| VPCRouter | VPCRouterAPI | VPCルーター | Yes |
| LoadBalancer | LoadBalancerAPI | 標準ロードバランサ | Yes |
| NFS | NFSAPI | NFSアプライアンス | Yes |
| SSHKey | SSHKeyAPI | SSH公開鍵 | No |
| AutoBackup | AutoBackupAPI | 自動バックアップ | No |
| Bridge | BridgeAPI | ブリッジ接続 | No |

## sact 未実装 (中優先度)

| リソース | API名 | 説明 | ゾーン依存 |
|---------|------|------|-----------|
| CDROM | CDROMAPI | ISOイメージ | Yes |
| LocalRouter | LocalRouterAPI | ローカルルーター | No |
| MobileGateway | MobileGatewayAPI | モバイルゲートウェイ | Yes |
| SIM | SIMAPI | SIM | No |
| PrivateHost | PrivateHostAPI | 専有ホスト | Yes |
| Note | NoteAPI | スタートアップスクリプト | No |
| Interface | InterfaceAPI | NIC | Yes |
| AutoScale | AutoScaleAPI | オートスケール | No |
| CertificateAuthority | CertificateAuthorityAPI | マネージドPKI | No |
| ESME | ESMEAPI | 2要素認証 (SMS) | No |

## sact 未実装 (低優先度)

| リソース | API名 | 説明 | ゾーン依存 |
|---------|------|------|-----------|
| IPAddress | IPAddressAPI | IPv4アドレス管理 | Yes |
| IPv6Net | IPv6NetAPI | IPv6ネットワーク | Yes |
| IPv6Addr | IPv6AddrAPI | IPv6アドレス | Yes |
| Subnet | SubnetAPI | サブネット | Yes |
| License | LicenseAPI | ライセンス (Windows等) | No |
| Icon | IconAPI | アイコン | No |
| Coupon | CouponAPI | クーポン情報 | No |
| SimpleNotificationDestination | SimpleNotificationDestinationAPI | 通知先 | No |
| SimpleNotificationGroup | SimpleNotificationGroupAPI | 通知グループ | No |

## SakPilot 独自実装 (sact 対象外)

以下は SakPilot で実装済みだが、sact では対象外のリソース:

| リソース | 説明 |
|---------|------|
| EnhancedDB | エンハンスドデータベース (TiDB) |
| Bill | 請求情報 |
| ObjectStorage | オブジェクトストレージ |
| AppRun (Dedicated) | AppRun 専用クラスター |
| AppRun (Shared) | AppRun 共有クラスター |
| KMS | 鍵管理サービス |
| Monitoring Suite | ログ・メトリクス・トレース |

## 実装済み (SakPilot)

- Server (サーバー)
- Switch (スイッチ)
- DNS
- ProxyLB (エンハンスドロードバランサ)
- GSLB (広域負荷分散)
- Database (データベースアプライアンス)
- Disk (ディスク)
- Archive (アーカイブ)
- PacketFilter (パケットフィルタ)
- SimpleMonitor (シンプル監視)
- ContainerRegistry (コンテナレジストリ)
- Certificate (証明書) ※一覧のみ
