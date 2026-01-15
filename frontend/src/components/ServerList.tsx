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
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

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

  // ドロップダウンを閉じるためのクリックリスナー
  useEffect(() => {
    const handleClickOutside = () => setOpenDropdown(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  // profile または zone が変更されたらサーバー一覧を再取得
  useEffect(() => {
    console.log('[ServerList] useEffect triggered:', { profile, zone });
    loadServers();
  }, [loadServers]);

  const handlePowerOn = async (e: React.MouseEvent, serverZone: string, id: string) => {
    e.stopPropagation();
    console.log('[ServerList] PowerOn:', { profile, serverZone, id });
    setOpenDropdown(null);
    await PowerOnServer(profile, serverZone, id);
    loadServers();
  };

  const handlePowerOff = async (e: React.MouseEvent, serverZone: string, id: string) => {
    e.stopPropagation();
    console.log('[ServerList] PowerOff:', { profile, serverZone, id });
    setOpenDropdown(null);
    await PowerOffServer(profile, serverZone, id);
    loadServers();
  };

  const toggleDropdown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setOpenDropdown(openDropdown === id ? null : id);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid Date';
    
    const Y = date.getFullYear();
    const M = String(date.getMonth() + 1).padStart(2, '0');
    const D = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    
    return `${Y}/${M}/${D} ${h}:${m}`;
  };

  return (
    <>
      <div className="header">
        <h2>サーバー</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            className="btn-reload"
            onClick={() => loadServers()}
            disabled={loading}
            title="リロード"
          >
            ↻
          </button>
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
      </div>

      {loading ? (
        <div className="loading">読み込み中...</div>
      ) : servers.length === 0 ? (
        <div className="empty-state">サーバーがありません</div>
      ) : (
        servers.map((server) => (
          <div key={server.id} className="card">
            <div className="card-header">
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div className="card-title">{server.name}</div>
                  <span className={`status ${server.status === 'up' ? 'up' : 'down'}`} style={{ padding: '2px 6px', fontSize: '0.65rem' }}>
                    {server.status}
                  </span>
                </div>
                <div className="card-subtitle" style={{ marginTop: '2px', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span>{server.cpu} vCPU / {server.memory} GB</span>
                  <span style={{ color: '#555' }}>|</span>
                  <span>{server.ipAddresses?.join(', ') || 'No IP'}</span>
                  <span style={{ color: '#555' }}>|</span>
                  <span title={`作成日: ${formatDate(server.createdAt)}`}>
                    {formatDate(server.createdAt)}
                  </span>
                </div>
                {server.tags && server.tags.length > 0 && (
                  <div className="tags" style={{ marginTop: '0.25rem', display: 'flex', gap: '0.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    {server.tags.map(tag => (
                      <span key={tag} className="tag" style={{
                        backgroundColor: '#e2e8f0',
                        padding: '0px 6px',
                        borderRadius: '3px',
                        fontSize: '0.65rem',
                        color: '#4a5568',
                        border: '1px solid #cbd5e0'
                      }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="dropdown">
                <button 
                  className="btn-icon" 
                  onClick={(e) => toggleDropdown(e, server.id)}
                >
                  ⋮
                </button>
                <div className={`dropdown-menu ${openDropdown === server.id ? 'show' : ''}`}>
                  <button 
                    className="dropdown-item" 
                    onClick={(e) => handlePowerOn(e, server.zone, server.id)}
                    disabled={server.status === 'up'}
                  >
                    起動
                  </button>
                  <button 
                    className="dropdown-item" 
                    onClick={(e) => handlePowerOff(e, server.zone, server.id)}
                    disabled={server.status === 'down'}
                  >
                    停止
                  </button>
                  <div style={{ borderTop: '1px solid #333', margin: '4px 0' }}></div>
                  <div className="dropdown-item" style={{ fontSize: '0.7rem', color: '#666', cursor: 'default' }}>
                    ID: {server.id}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))
      )}
    </>
  );
}
