import { useState, useEffect, useCallback } from 'react';
import { GetServers, PowerOnServer, PowerOffServer } from '../../wailsjs/go/main/App';
import { sakura } from '../../wailsjs/go/models';

interface ServerListProps {
  profile: string;
  zone: string;
  zones: sakura.ZoneInfo[];
  onZoneChange: (zone: string) => void;
}

export function ServerList({ profile, zone, zones, onZoneChange }: ServerListProps) {
  const [servers, setServers] = useState<sakura.ServerInfo[]>([]);
  const [loading, setLoading] = useState(false);

  const loadServers = useCallback(async () => {
    if (!profile || !zone) {
      console.log('[ServerList] loadServers skipped: profile or zone is empty', { profile, zone });
      return;
    }

    console.log('[ServerList] loadServers called:', { profile, zone });
    setLoading(true);
    try {
      const list = await GetServers(profile, zone);
      console.log('[ServerList] servers loaded:', list?.length ?? 0, 'servers');
      setServers(list || []);
    } catch (err) {
      console.error('[ServerList] loadServers error:', err);
      setServers([]);
    } finally {
      setLoading(false);
    }
  }, [profile, zone]);

  // profile または zone が変更されたらサーバー一覧を再取得
  useEffect(() => {
    console.log('[ServerList] useEffect triggered:', { profile, zone });
    loadServers();
  }, [loadServers]);

  const handlePowerOn = async (serverZone: string, id: string) => {
    console.log('[ServerList] PowerOn:', { profile, serverZone, id });
    await PowerOnServer(profile, serverZone, id);
    loadServers();
  };

  const handlePowerOff = async (serverZone: string, id: string) => {
    console.log('[ServerList] PowerOff:', { profile, serverZone, id });
    await PowerOffServer(profile, serverZone, id);
    loadServers();
  };

  return (
    <>
      <div className="header">
        <h2>サーバー</h2>
        <select
          className="zone-select"
          value={zone}
          onChange={(e) => onZoneChange(e.target.value)}
        >
          {zones.map((z) => (
            <option key={z.id} value={z.id}>
              {z.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="loading">読み込み中...</div>
      ) : servers.length === 0 ? (
        <div className="empty-state">サーバーがありません</div>
      ) : (
        servers.map((server) => (
          <div key={server.id} className="card">
            <div className="card-header">
              <div>
                <div className="card-title">{server.name}</div>
                <div className="card-subtitle">
                  {server.cpu} vCPU / {server.memory} GB | ID: {server.id}
                </div>
                {server.tags && server.tags.length > 0 && (
                  <div className="tags" style={{ marginTop: '0.5rem', display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                    {server.tags.map(tag => (
                      <span key={tag} className="tag" style={{
                        backgroundColor: '#e2e8f0',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        color: '#4a5568'
                      }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <span className={`status ${server.status === 'up' ? 'up' : 'down'}`}>
                {server.status}
              </span>
            </div>
            <div className="card-subtitle">
              {server.ipAddresses?.join(', ') || 'No IP'}
            </div>
            <div className="btn-group" style={{ marginTop: '0.75rem' }}>
              <button
                className="btn btn-primary"
                onClick={() => handlePowerOn(server.zone, server.id)}
                disabled={server.status === 'up'}
              >
                起動
              </button>
              <button
                className="btn btn-danger"
                onClick={() => handlePowerOff(server.zone, server.id)}
                disabled={server.status === 'down'}
              >
                停止
              </button>
            </div>
          </div>
        ))
      )}
    </>
  );
}
