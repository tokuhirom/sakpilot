import { useState, useEffect, useCallback } from 'react';
import { GetPacketFilterDetail } from '../../wailsjs/go/main/App';
import { sakura } from '../../wailsjs/go/models';
import { useGlobalReload } from '../hooks/useGlobalReload';

interface PacketFilterDetailProps {
  profile: string;
  zone: string;
  packetFilterId: string;
}

export function PacketFilterDetail({ profile, zone, packetFilterId }: PacketFilterDetailProps) {
  const [pfInfo, setPfInfo] = useState<sakura.PacketFilterInfo | null>(null);
  const [loading, setLoading] = useState(false);

  const loadPacketFilterDetail = useCallback(async () => {
    if (!profile || !zone || !packetFilterId) return;

    setLoading(true);
    try {
      const detail = await GetPacketFilterDetail(profile, zone, packetFilterId);
      setPfInfo(detail);
    } catch (err) {
      console.error('[PacketFilterDetail] loadPacketFilterDetail error:', err);
    } finally {
      setLoading(false);
    }
  }, [profile, zone, packetFilterId]);

  useGlobalReload(loadPacketFilterDetail);

  useEffect(() => {
    loadPacketFilterDetail();
  }, [loadPacketFilterDetail]);

  const formatAction = (action: string) => {
    switch (action) {
      case 'allow': return { label: '許可', className: 'up' };
      case 'deny': return { label: '拒否', className: 'down' };
      default: return { label: action, className: '' };
    }
  };

  const formatProtocol = (protocol: string) => {
    switch (protocol) {
      case 'tcp': return 'TCP';
      case 'udp': return 'UDP';
      case 'icmp': return 'ICMP';
      case 'ip': return 'IP';
      default: return protocol.toUpperCase();
    }
  };

  if (loading) return <div className="loading">読み込み中...</div>;
  if (!pfInfo) return <div className="empty-state">パケットフィルター情報が見つかりません</div>;

  return (
    <div className="packetfilter-detail">
      <div className="header">
        <h2>パケットフィルター詳細: {pfInfo.name}</h2>
        <button
          className="btn-reload"
          onClick={() => loadPacketFilterDetail()}
          disabled={loading}
          title="リロード"
        >
          ↻
        </button>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem', background: '#2a2a2a', borderRadius: '8px' }}>
        <h4 style={{ color: '#00adb5', marginTop: 0, marginBottom: '1rem' }}>基本情報</h4>
        <table style={{ borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>ID</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{pfInfo.id}</td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>説明</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{pfInfo.description || '-'}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3 style={{ color: '#00adb5' }}>ルール一覧</h3>
      {(!pfInfo.rules || pfInfo.rules.length === 0) ? (
        <div className="empty-state">ルールがありません</div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>アクション</th>
              <th>プロトコル</th>
              <th>送信元ネットワーク</th>
              <th>送信元ポート</th>
              <th>宛先ポート</th>
              <th>説明</th>
            </tr>
          </thead>
          <tbody>
            {pfInfo.rules.map((rule, index) => {
              const action = formatAction(rule.action);
              return (
                <tr key={index}>
                  <td style={{ textAlign: 'left', color: '#888' }}>{index + 1}</td>
                  <td style={{ textAlign: 'left' }}>
                    <span className={`status ${action.className}`}>{action.label}</span>
                  </td>
                  <td style={{ textAlign: 'left', fontFamily: 'monospace' }}>{formatProtocol(rule.protocol)}</td>
                  <td style={{ textAlign: 'left', fontFamily: 'monospace' }}>{rule.sourceNetwork || '*'}</td>
                  <td style={{ textAlign: 'left', fontFamily: 'monospace' }}>{rule.sourcePort || '*'}</td>
                  <td style={{ textAlign: 'left', fontFamily: 'monospace' }}>{rule.destinationPort || '*'}</td>
                  <td style={{ textAlign: 'left' }}>{rule.description || '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
