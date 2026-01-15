import { useState, useEffect, useCallback } from 'react';
import { GetSwitchDetail } from '../../wailsjs/go/main/App';
import { sakura } from '../../wailsjs/go/models';

interface SwitchDetailProps {
  profile: string;
  zone: string;
  switchId: string;
}

export function SwitchDetail({ profile, zone, switchId }: SwitchDetailProps) {
  const [switchInfo, setSwitchInfo] = useState<sakura.SwitchInfo | null>(null);
  const [loading, setLoading] = useState(false);

  const loadSwitchDetail = useCallback(async () => {
    if (!profile || !zone || !switchId) return;

    setLoading(true);
    try {
      const detail = await GetSwitchDetail(profile, zone, switchId);
      setSwitchInfo(detail);
    } catch (err) {
      console.error('[SwitchDetail] loadSwitchDetail error:', err);
    } finally {
      setLoading(false);
    }
  }, [profile, zone, switchId]);

  useEffect(() => {
    loadSwitchDetail();
  }, [loadSwitchDetail]);

  if (loading) return <div className="loading">読み込み中...</div>;
  if (!switchInfo) return <div className="empty-state">スイッチ情報が見つかりません</div>;

  return (
    <div className="switch-detail">
      <div className="header">
        <h2>スイッチ詳細: {switchInfo.name}</h2>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem', background: '#2a2a2a', borderRadius: '8px' }}>
        <h4 style={{ color: '#00adb5', marginTop: 0, marginBottom: '1rem' }}>基本情報</h4>
        <table style={{ borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>ID</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{switchInfo.id}</td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>説明</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{switchInfo.description || '-'}</td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>接続サーバー数</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{switchInfo.serverCount}</td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>スコープ</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>
                <span className={`status ${switchInfo.scope === 'shared' ? 'up' : ''}`}>
                  {switchInfo.scope === 'shared' ? '共有' : switchInfo.scope === 'user' ? 'ユーザー' : switchInfo.scope}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {switchInfo.networkMaskLen > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem', background: '#2a2a2a', borderRadius: '8px' }}>
          <h4 style={{ color: '#00adb5', marginTop: 0, marginBottom: '1rem' }}>ネットワーク設定</h4>
          <table style={{ borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>ネットワークマスク</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>/{switchInfo.networkMaskLen}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>デフォルトルート</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{switchInfo.defaultRoute || '-'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {switchInfo.subnets && switchInfo.subnets.length > 0 && (
        <>
          <h3>サブネット</h3>
          <table className="table">
            <thead>
              <tr>
                <th>ネットワークアドレス</th>
                <th>マスク長</th>
                <th>デフォルトルート</th>
                <th>Next Hop</th>
              </tr>
            </thead>
            <tbody>
              {switchInfo.subnets.map((subnet, index) => (
                <tr key={index}>
                  <td style={{ textAlign: 'left', fontFamily: 'monospace' }}>{subnet.networkAddress}</td>
                  <td style={{ textAlign: 'left' }}>/{subnet.networkMaskLen}</td>
                  <td style={{ textAlign: 'left', fontFamily: 'monospace' }}>{subnet.defaultRoute || '-'}</td>
                  <td style={{ textAlign: 'left', fontFamily: 'monospace' }}>{subnet.nextHop || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
