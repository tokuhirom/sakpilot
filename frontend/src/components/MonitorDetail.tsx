import { useState, useEffect, useCallback } from 'react';
import { GetSimpleMonitorDetail } from '../../wailsjs/go/main/App';
import { sakura } from '../../wailsjs/go/models';
import { useGlobalReload } from '../hooks/useGlobalReload';

interface MonitorDetailProps {
  profile: string;
  monitorId: string;
}

export function MonitorDetail({ profile, monitorId }: MonitorDetailProps) {
  const [monitor, setMonitor] = useState<sakura.SimpleMonitorDetailInfo | null>(null);
  const [loading, setLoading] = useState(false);

  const loadMonitorDetail = useCallback(async () => {
    if (!profile || !monitorId) return;

    setLoading(true);
    try {
      const detail = await GetSimpleMonitorDetail(profile, monitorId);
      setMonitor(detail);
    } catch (err) {
      console.error('[MonitorDetail] loadMonitorDetail error:', err);
    } finally {
      setLoading(false);
    }
  }, [profile, monitorId]);

  useGlobalReload(loadMonitorDetail);

  useEffect(() => {
    loadMonitorDetail();
  }, [loadMonitorDetail]);

  if (loading) return <div className="loading">読み込み中...</div>;
  if (!monitor) return <div className="empty-state">シンプル監視情報が見つかりません</div>;

  return (
    <div className="monitor-detail">
      <div className="header">
        <h2>シンプル監視詳細: {monitor.name}</h2>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem', background: '#2a2a2a', borderRadius: '8px' }}>
        <h4 style={{ color: '#00adb5', marginTop: 0, marginBottom: '1rem' }}>基本情報</h4>
        <table style={{ borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>ID</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{monitor.id}</td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>ターゲット</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{monitor.target}</td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>説明</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{monitor.description || '-'}</td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>状態</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>
                <span className={`status ${monitor.enabled ? 'up' : 'down'}`}>
                  {monitor.enabled ? '有効' : '無効'}
                </span>
              </td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>可用性</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{monitor.availability || '-'}</td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>チェック間隔</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{monitor.delayLoop}秒</td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>最大リトライ回数</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{monitor.maxCheckAttempts}</td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>リトライ間隔</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{monitor.retryInterval}秒</td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>タイムアウト</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{monitor.timeout}秒</td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>メール通知</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{monitor.notifyEmailEnabled ? '有効' : '無効'}</td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>Slack通知</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{monitor.notifySlackEnabled ? '有効' : '無効'}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {monitor.healthCheck && (
        <div className="card" style={{ padding: '1rem', background: '#2a2a2a', borderRadius: '8px' }}>
          <h4 style={{ color: '#00adb5', marginTop: 0, marginBottom: '1rem' }}>ヘルスチェック設定</h4>
          <table style={{ borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>プロトコル</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{monitor.healthCheck.protocol}</td>
              </tr>
              {monitor.healthCheck.port && (
                <tr>
                  <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>ポート</td>
                  <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{monitor.healthCheck.port}</td>
                </tr>
              )}
              {monitor.healthCheck.path && (
                <tr>
                  <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>パス</td>
                  <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{monitor.healthCheck.path}</td>
                </tr>
              )}
              {monitor.healthCheck.host && (
                <tr>
                  <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>ホスト</td>
                  <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{monitor.healthCheck.host}</td>
                </tr>
              )}
              {monitor.healthCheck.status && (
                <tr>
                  <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>期待するステータス</td>
                  <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{monitor.healthCheck.status}</td>
                </tr>
              )}
              {monitor.healthCheck.containsString && (
                <tr>
                  <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>含まれる文字列</td>
                  <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{monitor.healthCheck.containsString}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
