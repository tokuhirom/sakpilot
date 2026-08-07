import { useState, useEffect, useCallback, useRef } from 'react';
import { GetNFSList, PowerOnNFS, PowerOffNFS, DeleteNFS, GetNFSStatus, ResetNFS } from '../../wailsjs/go/main/App';
import { sakura } from '../../wailsjs/go/models';
import { useSearch } from '../hooks/useSearch';
import { useGlobalReload } from '../hooks/useGlobalReload';
import { SearchBar } from './SearchBar';

interface NFSListProps {
  profile: string;
  zone: string;
  zones: sakura.ZoneInfo[];
  onZoneChange: (zone: string) => void;
}

interface ConfirmDialog {
  show: boolean;
  nfsName: string;
  nfsId: string;
  nfsZone: string;
  action: 'powerOn' | 'powerOff' | 'reset' | 'delete';
}

export function NFSList({ profile, zone, zones, onZoneChange }: NFSListProps) {
  const [nfsList, setNfsList] = useState<sakura.NFSInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog | null>(null);
  const [pendingNFS, setPendingNFS] = useState<Map<string, 'powerOn' | 'powerOff' | 'reset'>>(new Map());
  const pollingIntervalRef = useRef<Record<string, number>>({});

  const loadNFSList = useCallback(async () => {
    if (!profile || !zone) {
      return;
    }

    setLoading(true);
    try {
      const list = await GetNFSList(profile, zone);
      setNfsList(list || []);
    } catch (err) {
      console.error('[NFSList] loadNFSList error:', err);
      setNfsList([]);
    } finally {
      setLoading(false);
    }
  }, [profile, zone]);

  useGlobalReload(loadNFSList);

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

  // NFSのステータスをポーリングする
  const startPolling = useCallback((nfsZone: string, nfsId: string, expectedStatus: string) => {
    if (pollingIntervalRef.current[nfsId]) {
      clearInterval(pollingIntervalRef.current[nfsId]);
    }

    const pollInterval = window.setInterval(async () => {
      try {
        const status = await GetNFSStatus(profile, nfsZone, nfsId);
        if (status === expectedStatus) {
          clearInterval(pollingIntervalRef.current[nfsId]);
          delete pollingIntervalRef.current[nfsId];
          setPendingNFS(prev => {
            const next = new Map(prev);
            next.delete(nfsId);
            return next;
          });
          loadNFSList();
        }
      } catch (err) {
        console.error('[NFSList] Polling error:', err);
      }
    }, 2000);

    pollingIntervalRef.current[nfsId] = pollInterval;
  }, [profile, loadNFSList]);

  // 確認ダイアログを表示
  const showConfirmDialog = (e: React.MouseEvent, nfsZone: string, nfsId: string, nfsName: string, action: 'powerOn' | 'powerOff' | 'reset' | 'delete') => {
    e.stopPropagation();
    setOpenDropdown(null);
    setConfirmDialog({
      show: true,
      nfsName,
      nfsId,
      nfsZone,
      action,
    });
  };

  // 確認ダイアログでの操作実行
  const executeAction = async () => {
    if (!confirmDialog) return;

    const { nfsZone, nfsId, action } = confirmDialog;
    setConfirmDialog(null);

    if (action !== 'delete') {
      setPendingNFS(prev => new Map(prev).set(nfsId, action));
    }

    try {
      if (action === 'powerOn') {
        await PowerOnNFS(profile, nfsZone, nfsId);
        startPolling(nfsZone, nfsId, 'up');
      } else if (action === 'powerOff') {
        await PowerOffNFS(profile, nfsZone, nfsId);
        startPolling(nfsZone, nfsId, 'down');
      } else if (action === 'reset') {
        await ResetNFS(profile, nfsZone, nfsId);
        // Resetはステータスが変化しないため、一定時間後にスピナーを解除する
        window.setTimeout(() => {
          setPendingNFS(prev => {
            const next = new Map(prev);
            next.delete(nfsId);
            return next;
          });
          loadNFSList();
        }, 5000);
      } else if (action === 'delete') {
        await DeleteNFS(profile, nfsZone, nfsId);
        loadNFSList();
      }
    } catch (err) {
      console.error('[NFSList] Action error:', err);
      setPendingNFS(prev => {
        const next = new Map(prev);
        next.delete(nfsId);
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
    filteredItems: filteredNFS,
    closeSearch,
  } = useSearch(nfsList, (n, query) =>
    n.name.toLowerCase().includes(query) ||
    n.ipAddresses?.some(ip => ip.includes(query)) ||
    n.tags?.some(tag => tag.toLowerCase().includes(query)) ||
    n.id.includes(query)
  );

  useEffect(() => {
    loadNFSList();
  }, [loadNFSList]);

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

  const getPlanName = (planId: string) => {
    if (planId.includes('hdd') || planId === '100000021') return 'HDD';
    if (planId.includes('ssd') || planId === '100000022') return 'SSD';
    return planId;
  };

  return (
    <>
      <div className="header">
        <h2>NFS</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
        placeholder="NFS名、IP、タグで検索... (Escで閉じる)"
      />

      {loading ? (
        <div className="loading">読み込み中...</div>
      ) : filteredNFS.length === 0 ? (
        <div className="empty-state">
          {searchQuery ? `「${searchQuery}」に一致するNFSがありません` : 'NFSがありません'}
        </div>
      ) : (
        filteredNFS.map((n) => (
          <div key={n.id} className="card">
            <div className="card-header">
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div className="card-title">{n.name}</div>
                  {pendingNFS.has(n.id) ? (
                    <span className="status pending" style={{ padding: '2px 6px', fontSize: '0.65rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span className="spinner" style={{
                        width: '10px',
                        height: '10px',
                        border: '2px solid #ccc',
                        borderTop: '2px solid #666',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                      }}></span>
                      {pendingNFS.get(n.id) === 'reset' ? '再起動中...' : n.status === 'up' ? '停止中...' : '起動中...'}
                    </span>
                  ) : (
                    <span className={`status ${n.status.toLowerCase() === 'up' ? 'up' : 'down'}`} style={{ padding: '2px 6px', fontSize: '0.65rem' }}>
                      {n.status}
                    </span>
                  )}
                </div>
                <div className="card-subtitle" style={{ marginTop: '2px', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span>プラン: {getPlanName(n.planId)}</span>
                  <span style={{ color: '#555' }}>|</span>
                  <span>{n.ipAddresses?.join(', ') || 'No IP'}</span>
                  {n.switchName && (
                    <>
                      <span style={{ color: '#555' }}>|</span>
                      <span>スイッチ: {n.switchName}</span>
                    </>
                  )}
                  <span style={{ color: '#555' }}>|</span>
                  <span title={`作成日: ${formatDate(n.createdAt)}`}>
                    {formatDate(n.createdAt)}
                  </span>
                </div>
                {n.tags && n.tags.length > 0 && (
                  <div className="tags" style={{ marginTop: '0.25rem', display: 'flex', gap: '0.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    {n.tags.map(tag => (
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
                  onClick={(e) => toggleDropdown(e, n.id)}
                >
                  ⋮
                </button>
                <div className={`dropdown-menu ${openDropdown === n.id ? 'show' : ''}`}>
                  <button
                    className="dropdown-item"
                    onClick={(e) => showConfirmDialog(e, n.zone, n.id, n.name, 'powerOn')}
                    disabled={n.status === 'up' || pendingNFS.has(n.id)}
                  >
                    起動
                  </button>
                  <button
                    className="dropdown-item"
                    onClick={(e) => showConfirmDialog(e, n.zone, n.id, n.name, 'powerOff')}
                    disabled={n.status === 'down' || pendingNFS.has(n.id)}
                  >
                    停止
                  </button>
                  <button
                    className="dropdown-item"
                    onClick={(e) => showConfirmDialog(e, n.zone, n.id, n.name, 'reset')}
                    disabled={n.status.toLowerCase() !== 'up' || pendingNFS.has(n.id)}
                  >
                    再起動
                  </button>
                  <div style={{ borderTop: '1px solid #333', margin: '4px 0' }}></div>
                  <button
                    className="dropdown-item"
                    onClick={(e) => showConfirmDialog(e, n.zone, n.id, n.name, 'delete')}
                    disabled={pendingNFS.has(n.id)}
                    style={{ color: '#f87171' }}
                  >
                    削除
                  </button>
                  <div style={{ borderTop: '1px solid #333', margin: '4px 0' }}></div>
                  <div className="dropdown-item" style={{ fontSize: '0.7rem', color: '#666', cursor: 'default' }}>
                    ID: {n.id}
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
              {confirmDialog.action === 'powerOn' ? 'NFS起動' : confirmDialog.action === 'powerOff' ? 'NFS停止' : confirmDialog.action === 'reset' ? 'NFS再起動' : 'NFS削除'}
            </h3>
            <p style={{ margin: '0 0 20px 0', color: '#aaa' }}>
              <strong style={{ color: '#fff' }}>{confirmDialog.nfsName}</strong> を
              {confirmDialog.action === 'powerOn' ? '起動' : confirmDialog.action === 'powerOff' ? '停止' : confirmDialog.action === 'reset' ? '再起動' : '削除'}しますか？
              {confirmDialog.action === 'delete' && (
                <span style={{ display: 'block', marginTop: '8px', color: '#f87171', fontSize: '0.85rem' }}>
                  この操作は取り消せません。
                </span>
              )}
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
                  backgroundColor: confirmDialog.action === 'powerOn' ? '#22c55e' : confirmDialog.action === 'powerOff' ? '#ef4444' : confirmDialog.action === 'reset' ? '#f59e0b' : '#c62828',
                  border: 'none',
                  borderRadius: '4px',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                {confirmDialog.action === 'powerOn' ? '起動する' : confirmDialog.action === 'powerOff' ? '停止する' : confirmDialog.action === 'reset' ? '再起動する' : '削除する'}
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
