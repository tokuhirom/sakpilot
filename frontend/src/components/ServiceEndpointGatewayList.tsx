import { useState, useEffect, useCallback, useRef } from 'react';
import {
  GetServiceEndpointGateways,
  CreateServiceEndpointGateway,
  DeleteServiceEndpointGateway,
  PowerOnServiceEndpointGateway,
  ShutdownServiceEndpointGateway,
  ResetServiceEndpointGateway,
  GetServiceEndpointGatewayPowerStatus,
  GetSwitches,
} from '../../wailsjs/go/main/App';
import { sakura, serviceendpointgateway } from '../../wailsjs/go/models';
import { useSearch } from '../hooks/useSearch';
import { useGlobalReload } from '../hooks/useGlobalReload';
import { SearchBar } from './SearchBar';

interface ServiceEndpointGatewayListProps {
  profile: string;
  zone: string;
  zones: sakura.ZoneInfo[];
  onZoneChange: (zone: string) => void;
  onSelect: (id: string) => void;
}

function emptyCreateForm() {
  return {
    switchId: '',
    networkMaskLen: '24',
    serverIPAddresses: '',
  };
}

interface ConfirmDialog {
  show: boolean;
  id: string;
  action: 'powerOn' | 'powerOff' | 'reset' | 'delete';
}

export function ServiceEndpointGatewayList({ profile, zone, zones, onZoneChange, onSelect }: ServiceEndpointGatewayListProps) {
  const [list, setList] = useState<serviceendpointgateway.ApplianceInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog | null>(null);
  const [pendingItems, setPendingItems] = useState<Map<string, 'powerOn' | 'powerOff' | 'reset'>>(new Map());
  const pollingIntervalRef = useRef<Record<string, number>>({});

  const [showCreate, setShowCreate] = useState(false);
  const [switches, setSwitches] = useState<sakura.SwitchInfo[]>([]);
  const [createForm, setCreateForm] = useState(emptyCreateForm());
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    if (!profile || !zone) return;

    setLoading(true);
    try {
      const result = await GetServiceEndpointGateways(profile, zone);
      setList(result || []);
    } catch (err) {
      console.error('[ServiceEndpointGatewayList] loadList error:', err);
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [profile, zone]);

  useGlobalReload(loadList);

  useEffect(() => {
    const handleClickOutside = () => setOpenDropdown(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      Object.values(pollingIntervalRef.current).forEach(clearInterval);
    };
  }, []);

  const startPolling = useCallback((id: string, expectedStatus: string) => {
    if (pollingIntervalRef.current[id]) {
      clearInterval(pollingIntervalRef.current[id]);
    }

    const pollInterval = window.setInterval(async () => {
      try {
        const status = await GetServiceEndpointGatewayPowerStatus(profile, zone, id);
        if (status === expectedStatus) {
          clearInterval(pollingIntervalRef.current[id]);
          delete pollingIntervalRef.current[id];
          setPendingItems(prev => {
            const next = new Map(prev);
            next.delete(id);
            return next;
          });
          loadList();
        }
      } catch (err) {
        console.error('[ServiceEndpointGatewayList] Polling error:', err);
      }
    }, 2000);

    pollingIntervalRef.current[id] = pollInterval;
  }, [profile, zone, loadList]);

  const showConfirmDialog = (e: React.MouseEvent, id: string, action: 'powerOn' | 'powerOff' | 'reset' | 'delete') => {
    e.stopPropagation();
    setOpenDropdown(null);
    setConfirmDialog({ show: true, id, action });
  };

  const executeAction = async () => {
    if (!confirmDialog) return;

    const { id, action } = confirmDialog;
    setConfirmDialog(null);

    if (action !== 'delete') {
      setPendingItems(prev => new Map(prev).set(id, action));
    }

    try {
      if (action === 'powerOn') {
        await PowerOnServiceEndpointGateway(profile, zone, id);
        startPolling(id, 'up');
      } else if (action === 'powerOff') {
        await ShutdownServiceEndpointGateway(profile, zone, id);
        startPolling(id, 'down');
      } else if (action === 'reset') {
        await ResetServiceEndpointGateway(profile, zone, id);
        window.setTimeout(() => {
          setPendingItems(prev => {
            const next = new Map(prev);
            next.delete(id);
            return next;
          });
          loadList();
        }, 5000);
      } else if (action === 'delete') {
        await DeleteServiceEndpointGateway(profile, zone, id);
        loadList();
      }
    } catch (err) {
      console.error('[ServiceEndpointGatewayList] Action error:', err);
      setPendingItems(prev => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleCreateOpen = async () => {
    setCreateForm(emptyCreateForm());
    setCreateError(null);
    setShowCreate(true);
    try {
      const result = await GetSwitches(profile, zone);
      setSwitches(result || []);
    } catch (err) {
      console.error('[ServiceEndpointGatewayList] GetSwitches error:', err);
      setSwitches([]);
    }
  };

  const handleCreateCancel = () => {
    setShowCreate(false);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      const serverIPAddresses = createForm.serverIPAddresses
        .split(',')
        .map(ip => ip.trim())
        .filter(ip => ip.length > 0);
      await CreateServiceEndpointGateway(
        profile,
        zone,
        createForm.switchId,
        parseInt(createForm.networkMaskLen, 10) || 0,
        serverIPAddresses
      );
      setShowCreate(false);
      await loadList();
    } catch (err) {
      setCreateError(String(err));
    } finally {
      setCreating(false);
    }
  };

  const {
    searchQuery,
    setSearchQuery,
    isSearching,
    searchInputRef,
    filteredItems: filteredList,
    closeSearch,
  } = useSearch(list, (a, query) =>
    a.id.includes(query) ||
    a.switchName.toLowerCase().includes(query)
  );

  useEffect(() => {
    loadList();
  }, [loadList]);

  const toggleDropdown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setOpenDropdown(openDropdown === id ? null : id);
  };

  return (
    <>
      <div className="header">
        <h2>サービスエンドポイントゲートウェイ</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button className="btn btn-primary btn-small" onClick={handleCreateOpen}>+ 作成</button>
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
        placeholder="ID、スイッチ名で検索... (Escで閉じる)"
      />

      {loading ? (
        <div className="loading">読み込み中...</div>
      ) : filteredList.length === 0 ? (
        <div className="empty-state">
          {searchQuery ? `「${searchQuery}」に一致するリソースがありません` : 'サービスエンドポイントゲートウェイがありません'}
        </div>
      ) : (
        filteredList.map((a) => (
          <div key={a.id} className="card" onClick={() => onSelect(a.id)} style={{ cursor: 'pointer' }}>
            <div className="card-header">
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div className="card-title">{a.id}</div>
                  {pendingItems.has(a.id) ? (
                    <span className="status pending" style={{ padding: '2px 6px', fontSize: '0.65rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span className="spinner" style={{
                        width: '10px',
                        height: '10px',
                        border: '2px solid #ccc',
                        borderTop: '2px solid #666',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                      }}></span>
                      {pendingItems.get(a.id) === 'reset' ? '再起動中...' : a.powerStatus === 'up' ? '停止中...' : '起動中...'}
                    </span>
                  ) : (
                    <span className={`status ${a.powerStatus.toLowerCase() === 'up' ? 'up' : 'down'}`} style={{ padding: '2px 6px', fontSize: '0.65rem' }}>
                      {a.powerStatus || 'unknown'}
                    </span>
                  )}
                </div>
                <div className="card-subtitle" style={{ marginTop: '2px', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span>可用性: {a.availability}</span>
                  <span style={{ color: '#555' }}>|</span>
                  <span>スイッチ: {a.switchName || '-'}</span>
                  <span style={{ color: '#555' }}>|</span>
                  <span>接続先サービス: {a.enabledServices?.length ? a.enabledServices.map(s => s.type).join(', ') : 'なし'}</span>
                </div>
              </div>

              <div className="dropdown">
                <button
                  className="btn-icon"
                  onClick={(e) => toggleDropdown(e, a.id)}
                >
                  ⋮
                </button>
                <div className={`dropdown-menu ${openDropdown === a.id ? 'show' : ''}`}>
                  <button
                    className="dropdown-item"
                    onClick={(e) => showConfirmDialog(e, a.id, 'powerOn')}
                    disabled={a.powerStatus === 'up' || pendingItems.has(a.id)}
                  >
                    起動
                  </button>
                  <button
                    className="dropdown-item"
                    onClick={(e) => showConfirmDialog(e, a.id, 'powerOff')}
                    disabled={a.powerStatus === 'down' || pendingItems.has(a.id)}
                  >
                    停止
                  </button>
                  <button
                    className="dropdown-item"
                    onClick={(e) => showConfirmDialog(e, a.id, 'reset')}
                    disabled={a.powerStatus.toLowerCase() !== 'up' || pendingItems.has(a.id)}
                  >
                    再起動
                  </button>
                  <div style={{ borderTop: '1px solid #333', margin: '4px 0' }}></div>
                  <button
                    className="dropdown-item"
                    onClick={(e) => showConfirmDialog(e, a.id, 'delete')}
                    disabled={pendingItems.has(a.id)}
                    style={{ color: '#f87171' }}
                  >
                    削除
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))
      )}

      {confirmDialog && (
        <div className="modal-overlay" onClick={() => setConfirmDialog(null)} style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
            backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
            padding: '20px', minWidth: '300px', maxWidth: '400px',
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>
              {confirmDialog.action === 'powerOn' ? '起動' : confirmDialog.action === 'powerOff' ? '停止' : confirmDialog.action === 'reset' ? '再起動' : '削除'}
            </h3>
            <p style={{ margin: '0 0 20px 0', color: '#aaa' }}>
              <strong style={{ color: '#fff' }}>{confirmDialog.id}</strong> を
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
                style={{ padding: '8px 16px', backgroundColor: '#333', border: '1px solid #444', borderRadius: '4px', color: '#fff', cursor: 'pointer' }}
              >
                キャンセル
              </button>
              <button
                onClick={executeAction}
                style={{
                  padding: '8px 16px',
                  backgroundColor: confirmDialog.action === 'powerOn' ? '#22c55e' : confirmDialog.action === 'powerOff' ? '#ef4444' : confirmDialog.action === 'reset' ? '#f59e0b' : '#c62828',
                  border: 'none', borderRadius: '4px', color: '#fff', cursor: 'pointer',
                }}
              >
                {confirmDialog.action === 'powerOn' ? '起動する' : confirmDialog.action === 'powerOff' ? '停止する' : confirmDialog.action === 'reset' ? '再起動する' : '削除する'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="modal-overlay" onClick={handleCreateCancel} style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
            backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
            padding: '20px', minWidth: '320px', maxWidth: '420px', maxHeight: '80vh', overflowY: 'auto',
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>サービスエンドポイントゲートウェイ作成</h3>
            <form onSubmit={handleCreateSubmit}>
              <div className="form-group">
                <label htmlFor="seg-create-switch">接続スイッチ<span className="required-mark">*</span></label>
                <select id="seg-create-switch" value={createForm.switchId} onChange={(e) => setCreateForm({ ...createForm, switchId: e.target.value })} required>
                  <option value="">選択してください</option>
                  {switches.map((sw) => (
                    <option key={sw.id} value={sw.id}>{sw.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>ネットワークマスク長<span className="required-mark">*</span></label>
                <input
                  type="number"
                  value={createForm.networkMaskLen}
                  onChange={(e) => setCreateForm({ ...createForm, networkMaskLen: e.target.value })}
                  placeholder="例: 24"
                  min={8}
                  max={29}
                  required
                />
              </div>
              <div className="form-group">
                <label>接続元サーバーIPアドレス</label>
                <input
                  type="text"
                  value={createForm.serverIPAddresses}
                  onChange={(e) => setCreateForm({ ...createForm, serverIPAddresses: e.target.value })}
                  placeholder="任意(カンマ区切り、例: 192.168.0.11,192.168.0.12)"
                />
              </div>
              {createError && (
                <div style={{ marginBottom: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>
                  エラー: {createError}
                </div>
              )}
              <div className="confirm-actions">
                <button type="button" className="btn btn-secondary" onClick={handleCreateCancel}>キャンセル</button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? '作成中...' : '作成する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
