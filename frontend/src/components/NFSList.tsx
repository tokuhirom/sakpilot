import { useState, useEffect, useCallback, useRef } from 'react';
import { GetNFSList, PowerOnNFS, PowerOffNFS, DeleteNFS, GetNFSStatus, ResetNFS, CreateNFS, GetSwitches } from '../../wailsjs/go/main/App';
import { sakura } from '../../wailsjs/go/models';
import { useSearch } from '../hooks/useSearch';
import { useGlobalReload } from '../hooks/useGlobalReload';
import { SearchBar } from './SearchBar';

interface NFSListProps {
  profile: string;
  zone: string;
  zones: sakura.ZoneInfo[];
  onZoneChange: (zone: string) => void;
  onSelectNFS: (id: string) => void;
}

const HDD_SIZES = [100, 500, 1024, 2048, 4096, 8192, 12288];
const SSD_SIZES = [20, 100, 500, 1024, 2048, 4096];

function formatSizeLabel(sizeGB: number) {
  return sizeGB >= 1024 ? `${sizeGB / 1024}TB` : `${sizeGB}GB`;
}

function emptyCreateForm() {
  return {
    name: '',
    description: '',
    tags: '',
    switchId: '',
    ipAddress: '',
    networkMaskLen: '24',
    defaultRoute: '',
    planClass: 'hdd',
    sizeGB: String(HDD_SIZES[0]),
  };
}

interface ConfirmDialog {
  show: boolean;
  nfsName: string;
  nfsId: string;
  nfsZone: string;
  action: 'powerOn' | 'powerOff' | 'reset' | 'delete';
}

export function NFSList({ profile, zone, zones, onZoneChange, onSelectNFS }: NFSListProps) {
  const [nfsList, setNfsList] = useState<sakura.NFSInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog | null>(null);
  const [pendingNFS, setPendingNFS] = useState<Map<string, 'powerOn' | 'powerOff' | 'reset'>>(new Map());
  const pollingIntervalRef = useRef<Record<string, number>>({});

  const [showCreate, setShowCreate] = useState(false);
  const [switches, setSwitches] = useState<sakura.SwitchInfo[]>([]);
  const [createForm, setCreateForm] = useState(emptyCreateForm());
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

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

  const handleCreateOpen = async () => {
    setCreateForm(emptyCreateForm());
    setCreateError(null);
    setShowCreate(true);
    try {
      const list = await GetSwitches(profile, zone);
      setSwitches(list || []);
    } catch (err) {
      console.error('[NFSList] GetSwitches error:', err);
      setSwitches([]);
    }
  };

  const handleCreateCancel = () => {
    setShowCreate(false);
  };

  const handlePlanClassChange = (planClass: string) => {
    const sizes = planClass === 'ssd' ? SSD_SIZES : HDD_SIZES;
    setCreateForm(prev => ({ ...prev, planClass, sizeGB: String(sizes[0]) }));
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      const tags = createForm.tags.split(',').map(t => t.trim()).filter(t => t.length > 0);
      const params = new sakura.NFSCreateParams({
        Name: createForm.name,
        Description: createForm.description,
        Tags: tags,
        SwitchID: createForm.switchId,
        IPAddress: createForm.ipAddress,
        NetworkMaskLen: parseInt(createForm.networkMaskLen, 10) || 0,
        DefaultRoute: createForm.defaultRoute,
        PlanClass: createForm.planClass,
        SizeGB: parseInt(createForm.sizeGB, 10) || 0,
      });
      await CreateNFS(profile, zone, params);
      setShowCreate(false);
      await loadNFSList();
    } catch (e) {
      setCreateError(String(e));
    } finally {
      setCreating(false);
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
          <button className="btn btn-primary btn-small" onClick={handleCreateOpen}>+ NFS作成</button>
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
          <div key={n.id} className="card" onClick={() => onSelectNFS(n.id)} style={{ cursor: 'pointer' }}>
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
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>NFS作成</h3>
            <form onSubmit={handleCreateSubmit}>
            <div className="form-group">
              <label>名前<span className="required-mark">*</span></label>
              <input
                type="text"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                placeholder="my-nfs"
                autoFocus
                required
              />
            </div>
            <div className="form-group">
              <label>説明</label>
              <input
                type="text"
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                placeholder="任意"
                maxLength={512}
              />
            </div>
            <div className="form-group">
              <label>タグ</label>
              <input
                type="text"
                value={createForm.tags}
                onChange={(e) => setCreateForm({ ...createForm, tags: e.target.value })}
                placeholder="任意(カンマ区切り)"
              />
            </div>
            <div className="form-group">
              <label>プラン</label>
              <select value={createForm.planClass} onChange={(e) => handlePlanClassChange(e.target.value)}>
                <option value="hdd">HDD</option>
                <option value="ssd">SSD</option>
              </select>
            </div>
            <div className="form-group">
              <label>サイズ</label>
              <select value={createForm.sizeGB} onChange={(e) => setCreateForm({ ...createForm, sizeGB: e.target.value })}>
                {(createForm.planClass === 'ssd' ? SSD_SIZES : HDD_SIZES).map((size) => (
                  <option key={size} value={size}>{formatSizeLabel(size)}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="nfs-create-switch">接続スイッチ<span className="required-mark">*</span></label>
              <select id="nfs-create-switch" value={createForm.switchId} onChange={(e) => setCreateForm({ ...createForm, switchId: e.target.value })} required>
                <option value="">選択してください</option>
                {switches.map((sw) => (
                  <option key={sw.id} value={sw.id}>{sw.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>IPアドレス<span className="required-mark">*</span></label>
              <input
                type="text"
                value={createForm.ipAddress}
                onChange={(e) => setCreateForm({ ...createForm, ipAddress: e.target.value })}
                placeholder="例: 192.168.0.11"
                pattern="^(\d{1,3}\.){3}\d{1,3}$"
                required
              />
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
              <label>デフォルトルート</label>
              <input
                type="text"
                value={createForm.defaultRoute}
                onChange={(e) => setCreateForm({ ...createForm, defaultRoute: e.target.value })}
                placeholder="任意(例: 192.168.0.1)"
                pattern="^(\d{1,3}\.){3}\d{1,3}$"
              />
            </div>
            {createError && (
              <div style={{ marginBottom: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>
                エラー: {createError}
              </div>
            )}
            <div className="confirm-actions">
              <button type="button" className="btn btn-secondary" onClick={handleCreateCancel}>キャンセル</button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={creating}
              >
                {creating ? '作成中...' : '作成する'}
              </button>
            </div>
            </form>
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
