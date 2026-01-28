import { useState, useEffect, useCallback } from 'react';
import { GetGSLBDetail } from '../../wailsjs/go/main/App';
import { sakura } from '../../wailsjs/go/models';
import { useGlobalReload } from '../hooks/useGlobalReload';

interface GSLBDetailProps {
  profile: string;
  gslbId: string;
}

export function GSLBDetail({ profile, gslbId }: GSLBDetailProps) {
  const [gslb, setGslb] = useState<sakura.GSLBInfo | null>(null);
  const [loading, setLoading] = useState(false);

  const loadGSLBDetail = useCallback(async () => {
    if (!profile || !gslbId) return;

    setLoading(true);
    try {
      const detail = await GetGSLBDetail(profile, gslbId);
      setGslb(detail);
    } catch (err) {
      console.error('[GSLBDetail] loadGSLBDetail error:', err);
    } finally {
      setLoading(false);
    }
  }, [profile, gslbId]);

  useGlobalReload(loadGSLBDetail);

  useEffect(() => {
    loadGSLBDetail();
  }, [loadGSLBDetail]);

  if (loading) return <div className="loading">読み込み中...</div>;
  if (!gslb) return <div className="empty-state">GSLB情報が見つかりません</div>;

  return (
    <div className="gslb-detail">
      <div className="header">
        <h2>GSLB詳細: {gslb.name}</h2>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem', background: '#2a2a2a', borderRadius: '8px' }}>
        <h4 style={{ color: '#00adb5', marginTop: 0, marginBottom: '1rem' }}>基本情報</h4>
        <table style={{ borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>ID</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{gslb.id}</td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>FQDN</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{gslb.fqdn}</td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>説明</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{gslb.description || '-'}</td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>Sorry Server</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{gslb.sorryServer || '-'}</td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>監視間隔</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{gslb.delayLoop}秒</td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>重み付け</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{gslb.weighted ? '有効' : '無効'}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {gslb.healthCheck && (
        <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem', background: '#2a2a2a', borderRadius: '8px' }}>
          <h4 style={{ color: '#00adb5', marginTop: 0, marginBottom: '1rem' }}>ヘルスチェック設定</h4>
          <table style={{ borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>プロトコル</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{gslb.healthCheck.protocol}</td>
              </tr>
              {gslb.healthCheck.port > 0 && (
                <tr>
                  <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>ポート</td>
                  <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{gslb.healthCheck.port}</td>
                </tr>
              )}
              {gslb.healthCheck.hostHeader && (
                <tr>
                  <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>Hostヘッダー</td>
                  <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{gslb.healthCheck.hostHeader}</td>
                </tr>
              )}
              {gslb.healthCheck.path && (
                <tr>
                  <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>パス</td>
                  <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{gslb.healthCheck.path}</td>
                </tr>
              )}
              {gslb.healthCheck.responseCode > 0 && (
                <tr>
                  <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>期待レスポンス</td>
                  <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{gslb.healthCheck.responseCode}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <h3>振り分け先サーバー</h3>
      <table className="table">
        <thead>
          <tr>
            <th>IPアドレス</th>
            <th>状態</th>
            <th>重み</th>
          </tr>
        </thead>
        <tbody>
          {gslb.servers && gslb.servers.length > 0 ? (
            gslb.servers.map((server, index) => (
              <tr key={index}>
                <td style={{ textAlign: 'left', fontFamily: 'monospace' }}>{server.ipAddress}</td>
                <td style={{ textAlign: 'left' }}>
                  <span className={`status ${server.enabled ? 'up' : 'down'}`}>
                    {server.enabled ? '有効' : '無効'}
                  </span>
                </td>
                <td style={{ textAlign: 'left' }}>{server.weight}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={3} style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
                サーバーが登録されていません
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
