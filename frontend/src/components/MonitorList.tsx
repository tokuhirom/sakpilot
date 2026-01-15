import { useState, useEffect, useCallback } from 'react';
import { GetSimpleMonitors } from '../../wailsjs/go/main/App';
import { sakura } from '../../wailsjs/go/models';

interface MonitorListProps {
  profile: string;
}

export function MonitorList({ profile }: MonitorListProps) {
  const [monitors, setMonitors] = useState<sakura.SimpleMonitorInfo[]>([]);
  const [loading, setLoading] = useState(false);

  const loadMonitors = useCallback(async () => {
    if (!profile) {
      console.log('[MonitorList] loadMonitors skipped: profile is empty');
      return;
    }

    console.log('[MonitorList] loadMonitors called:', { profile });
    setLoading(true);
    try {
      const list = await GetSimpleMonitors(profile);
      console.log('[MonitorList] monitors loaded:', list?.length ?? 0, 'monitors');
      setMonitors(list || []);
    } catch (err) {
      console.error('[MonitorList] loadMonitors error:', err);
      setMonitors([]);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  // profile が変更されたらシンプル監視一覧を再取得
  useEffect(() => {
    console.log('[MonitorList] useEffect triggered:', { profile });
    loadMonitors();
  }, [loadMonitors]);

  return (
    <>
      <div className="header">
        <h2>シンプル監視</h2>
      </div>

      {loading ? (
        <div className="loading">読み込み中...</div>
      ) : monitors.length === 0 ? (
        <div className="empty-state">シンプル監視がありません</div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>名前</th>
              <th>ターゲット</th>
              <th>状態</th>
            </tr>
          </thead>
          <tbody>
            {monitors.map((m) => (
              <tr key={m.id}>
                <td>{m.name}</td>
                <td>{m.target}</td>
                <td>
                  <span className={`status ${m.enabled ? 'up' : 'down'}`}>
                    {m.enabled ? '有効' : '無効'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
