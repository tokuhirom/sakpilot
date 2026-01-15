import { useState, useEffect, useCallback } from 'react';
import { GetSwitches } from '../../wailsjs/go/main/App';
import { sakura } from '../../wailsjs/go/models';

interface SwitchListProps {
  profile: string;
  zone: string;
  zones: sakura.ZoneInfo[];
  onZoneChange: (zone: string) => void;
  onSelectSwitch: (id: string) => void;
}

export function SwitchList({ profile, zone, zones, onZoneChange, onSelectSwitch }: SwitchListProps) {
  const [switches, setSwitches] = useState<sakura.SwitchInfo[]>([]);
  const [loading, setLoading] = useState(false);

  const loadSwitches = useCallback(async () => {
    if (!profile || !zone) return;

    setLoading(true);
    try {
      const list = await GetSwitches(profile, zone);
      setSwitches(list || []);
    } catch (err) {
      console.error('[SwitchList] loadSwitches error:', err);
      setSwitches([]);
    } finally {
      setLoading(false);
    }
  }, [profile, zone]);

  useEffect(() => {
    loadSwitches();
  }, [loadSwitches]);

  return (
    <>
      <div className="header">
        <h2>スイッチ</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            className="btn-reload"
            onClick={() => loadSwitches()}
            disabled={loading}
            title="リロード"
          >
            ↻
          </button>
          <select
            className="zone-select"
            value={zone}
            onChange={(e) => onZoneChange(e.target.value)}
            disabled={loading}
          >
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="loading">読み込み中...</div>
      ) : switches.length === 0 ? (
        <div className="empty-state">スイッチがありません</div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>名前</th>
              <th>接続サーバー数</th>
              <th>ネットワーク</th>
              <th>スコープ</th>
            </tr>
          </thead>
          <tbody>
            {switches.map((sw) => (
              <tr
                key={sw.id}
                onClick={() => onSelectSwitch(sw.id)}
                style={{ cursor: 'pointer' }}
              >
                <td style={{ color: '#00adb5', fontWeight: 'bold' }}>{sw.name}</td>
                <td>{sw.serverCount}</td>
                <td>
                  {sw.networkMaskLen > 0 ? (
                    <>
                      /{sw.networkMaskLen}
                      {sw.defaultRoute && <span style={{ color: '#888', marginLeft: '0.5rem' }}>GW: {sw.defaultRoute}</span>}
                    </>
                  ) : '-'}
                </td>
                <td>
                  <span className={`status ${sw.scope === 'shared' ? 'up' : ''}`}>
                    {sw.scope === 'shared' ? '共有' : sw.scope === 'user' ? 'ユーザー' : sw.scope}
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
