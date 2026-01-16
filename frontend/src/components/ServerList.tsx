import { useState, useEffect, useCallback, useRef } from 'react';
import { GetServers, PowerOnServer, PowerOffServer, GetServerStatus } from '../../wailsjs/go/main/App';
import { sakura } from '../../wailsjs/go/models';
import { useSearch } from '../hooks/useSearch';
import { SearchBar } from './SearchBar';

interface ServerListProps {
  profile: string;
  zone: string;
  zones: sakura.ZoneInfo[];
  onZoneChange: (zone: string) => void;
}

interface ConfirmDialog {
  show: boolean;
  serverName: string;
  serverId: string;
  serverZone: string;
  action: 'powerOn' | 'powerOff';
}

export function ServerList({ profile, zone, zones, onZoneChange }: ServerListProps) {
  const [servers, setServers] = useState<sakura.ServerInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog | null>(null);
  const [pendingServers, setPendingServers] = useState<Set<string>>(new Set());
  const pollingIntervalRef = useRef<Record<string, number>>({});

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

  // コンポーネントのアンマウント時にポーリングをクリア
  useEffect(() => {
    return () => {
      Object.values(pollingIntervalRef.current).forEach(clearInterval);
    };
  }, []);

  // サーバーのステータスをポーリングする
  const startPolling = useCallback((serverZone: string, serverId: string, expectedStatus: string) => {
    // 既存のポーリングをクリア
    if (pollingIntervalRef.current[serverId]) {
      clearInterval(pollingIntervalRef.current[serverId]);
    }

    const pollInterval = window.setInterval(async () => {
      try {
        const status = await GetServerStatus(profile, serverZone, serverId);
        if (status === expectedStatus) {
          clearInterval(pollingIntervalRef.current[serverId]);
          delete pollingIntervalRef.current[serverId];
          setPendingServers(prev => {
            const next = new Set(prev);
            next.delete(serverId);
            return next;
          });
          // サーバー一覧を更新
          loadServers();
        }
      } catch (err) {
        console.error('[ServerList] Polling error:', err);
      }
    }, 2000); // 2秒ごとにポーリング

    pollingIntervalRef.current[serverId] = pollInterval;
  }, [profile, loadServers]);

  // 確認ダイアログを表示
  const showConfirmDialog = (e: React.MouseEvent, serverZone: string, serverId: string, serverName: string, action: 'powerOn' | 'powerOff') => {
    e.stopPropagation();
    setOpenDropdown(null);
    setConfirmDialog({
      show: true,
      serverName,
      serverId,
      serverZone,
      action,
    });
  };

  // 確認ダイアログでの操作実行
  const executeAction = async () => {
    if (!confirmDialog) return;

    const { serverZone, serverId, action } = confirmDialog;
    setConfirmDialog(null);

    // 即座にスピナーを表示
    setPendingServers(prev => new Set(prev).add(serverId));

    try {
      if (action === 'powerOn') {
        await PowerOnServer(profile, serverZone, serverId);
        startPolling(serverZone, serverId, 'up');
      } else {
        await PowerOffServer(profile, serverZone, serverId);
        startPolling(serverZone, serverId, 'down');
      }
    } catch (err) {
      console.error('[ServerList] Action error:', err);
      setPendingServers(prev => {
        const next = new Set(prev);
        next.delete(serverId);
        return next;
      });
    }
  };

  // 検索機能
  const {
    searchQuery,
    setSearchQuery,
    isSearching,
    searchInputRef,
    filteredItems: filteredServers,
    closeSearch,
  } = useSearch(servers, (server, query) =>
    server.name.toLowerCase().includes(query) ||
    server.ipAddresses?.some(ip => ip.includes(query)) ||
    server.tags?.some(tag => tag.toLowerCase().includes(query)) ||
    server.id.includes(query)
  );

  // profile または zone が変更されたらサーバー一覧を再取得
  useEffect(() => {
    console.log('[ServerList] useEffect triggered:', { profile, zone });
    loadServers();
  }, [loadServers]);

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

      <SearchBar
        isSearching={isSearching}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        closeSearch={closeSearch}
        searchInputRef={searchInputRef}
        placeholder="サーバー名、IP、タグで検索... (Escで閉じる)"
      />

      {loading ? (
        <div className="loading">読み込み中...</div>
      ) : filteredServers.length === 0 ? (
        <div className="empty-state">
          {searchQuery ? `「${searchQuery}」に一致するサーバーがありません` : 'サーバーがありません'}
        </div>
      ) : (
        filteredServers.map((server) => (
          <div key={server.id} className="card">
            <div className="card-header">
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div className="card-title">{server.name}</div>
                  {pendingServers.has(server.id) ? (
                    <span className="status pending" style={{ padding: '2px 6px', fontSize: '0.65rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span className="spinner" style={{
                        width: '10px',
                        height: '10px',
                        border: '2px solid #ccc',
                        borderTop: '2px solid #666',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                      }}></span>
                      {server.status === 'up' ? '停止中...' : '起動中...'}
                    </span>
                  ) : (
                    <span className={`status ${server.status === 'up' ? 'up' : 'down'}`} style={{ padding: '2px 6px', fontSize: '0.65rem' }}>
                      {server.status}
                    </span>
                  )}
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
                    onClick={(e) => showConfirmDialog(e, server.zone, server.id, server.name, 'powerOn')}
                    disabled={server.status === 'up' || pendingServers.has(server.id)}
                  >
                    起動
                  </button>
                  <button
                    className="dropdown-item"
                    onClick={(e) => showConfirmDialog(e, server.zone, server.id, server.name, 'powerOff')}
                    disabled={server.status === 'down' || pendingServers.has(server.id)}
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

      {/* 確認ダイアログ */}
      {confirmDialog && (
        <div className="modal-overlay" onClick={() => setConfirmDialog(null)} style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
            backgroundColor: '#1a1a1a',
            border: '1px solid #333',
            borderRadius: '8px',
            padding: '20px',
            minWidth: '300px',
            maxWidth: '400px',
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>
              {confirmDialog.action === 'powerOn' ? 'サーバー起動' : 'サーバー停止'}
            </h3>
            <p style={{ margin: '0 0 20px 0', color: '#aaa' }}>
              <strong style={{ color: '#fff' }}>{confirmDialog.serverName}</strong> を
              {confirmDialog.action === 'powerOn' ? '起動' : '停止'}しますか？
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setConfirmDialog(null)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#333',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                キャンセル
              </button>
              <button
                onClick={executeAction}
                style={{
                  padding: '8px 16px',
                  backgroundColor: confirmDialog.action === 'powerOn' ? '#22c55e' : '#ef4444',
                  border: 'none',
                  borderRadius: '4px',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                {confirmDialog.action === 'powerOn' ? '起動する' : '停止する'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* スピナーアニメーション用CSS */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .status.pending {
          background-color: #f59e0b;
          color: #000;
        }
      `}</style>
    </>
  );
}
