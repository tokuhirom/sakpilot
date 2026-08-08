import { useState, useEffect, useCallback, useRef } from 'react';
import { GetDatabases, PowerOnDatabase, PowerOffDatabase, DeleteDatabase, GetDatabaseStatus, ResetDatabase, CreateDatabase, GetSwitches } from '../../wailsjs/go/main/App';
import { sakura } from '../../wailsjs/go/models';
import { useSearch } from '../hooks/useSearch';
import { useGlobalReload } from '../hooks/useGlobalReload';
import { SearchBar } from './SearchBar';

interface DatabaseListProps {
  profile: string;
  zone: string;
  zones: sakura.ZoneInfo[];
  onZoneChange: (zone: string) => void;
  onSelectDatabase: (id: string) => void;
}

const DEFAULT_PORTS: Record<string, number> = {
  mariadb: 3306,
  postgres: 5432,
};

function emptyCreateForm() {
  return {
    name: '',
    description: '',
    tags: '',
    plan: '10g',
    switchId: '',
    ipAddress: '',
    networkMaskLen: '24',
    defaultRoute: '',
    rdbmsType: 'mariadb',
    defaultUser: '',
    userPassword: '',
    servicePort: String(DEFAULT_PORTS.mariadb),
    monitoringSuiteEnabled: false,
  };
}

interface ConfirmDialog {
  show: boolean;
  databaseName: string;
  databaseId: string;
  databaseZone: string;
  action: 'powerOn' | 'powerOff' | 'reset' | 'delete';
}

export function DatabaseList({ profile, zone, zones, onZoneChange, onSelectDatabase }: DatabaseListProps) {
  const [databases, setDatabases] = useState<sakura.DatabaseInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog | null>(null);
  const [pendingDatabases, setPendingDatabases] = useState<Map<string, 'powerOn' | 'powerOff' | 'reset'>>(new Map());
  const pollingIntervalRef = useRef<Record<string, number>>({});

  const [showCreate, setShowCreate] = useState(false);
  const [switches, setSwitches] = useState<sakura.SwitchInfo[]>([]);
  const [createForm, setCreateForm] = useState(emptyCreateForm());
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const loadDatabases = useCallback(async () => {
    if (!profile || !zone) {
      return;
    }

    setLoading(true);
    try {
      const list = await GetDatabases(profile, zone);
      setDatabases(list || []);
    } catch (err) {
      console.error('[DatabaseList] loadDatabases error:', err);
      setDatabases([]);
    } finally {
      setLoading(false);
    }
  }, [profile, zone]);

  useGlobalReload(loadDatabases);

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

  // データベースのステータスをポーリングする
  const startPolling = useCallback((databaseZone: string, databaseId: string, expectedStatus: string) => {
    if (pollingIntervalRef.current[databaseId]) {
      clearInterval(pollingIntervalRef.current[databaseId]);
    }

    const pollInterval = window.setInterval(async () => {
      try {
        const status = await GetDatabaseStatus(profile, databaseZone, databaseId);
        if (status === expectedStatus) {
          clearInterval(pollingIntervalRef.current[databaseId]);
          delete pollingIntervalRef.current[databaseId];
          setPendingDatabases(prev => {
            const next = new Map(prev);
            next.delete(databaseId);
            return next;
          });
          loadDatabases();
        }
      } catch (err) {
        console.error('[DatabaseList] Polling error:', err);
      }
    }, 2000);

    pollingIntervalRef.current[databaseId] = pollInterval;
  }, [profile, loadDatabases]);

  // 確認ダイアログを表示
  const showConfirmDialog = (e: React.MouseEvent, databaseZone: string, databaseId: string, databaseName: string, action: 'powerOn' | 'powerOff' | 'reset' | 'delete') => {
    e.stopPropagation();
    setOpenDropdown(null);
    setConfirmDialog({
      show: true,
      databaseName,
      databaseId,
      databaseZone,
      action,
    });
  };

  // 確認ダイアログでの操作実行
  const executeAction = async () => {
    if (!confirmDialog) return;

    const { databaseZone, databaseId, action } = confirmDialog;
    setConfirmDialog(null);

    if (action !== 'delete') {
      setPendingDatabases(prev => new Map(prev).set(databaseId, action));
    }

    try {
      if (action === 'powerOn') {
        await PowerOnDatabase(profile, databaseZone, databaseId);
        startPolling(databaseZone, databaseId, 'up');
      } else if (action === 'powerOff') {
        await PowerOffDatabase(profile, databaseZone, databaseId);
        startPolling(databaseZone, databaseId, 'down');
      } else if (action === 'reset') {
        await ResetDatabase(profile, databaseZone, databaseId);
        // Resetはステータスが変化しないため、一定時間後にスピナーを解除する
        window.setTimeout(() => {
          setPendingDatabases(prev => {
            const next = new Map(prev);
            next.delete(databaseId);
            return next;
          });
          loadDatabases();
        }, 5000);
      } else if (action === 'delete') {
        await DeleteDatabase(profile, databaseZone, databaseId);
        loadDatabases();
      }
    } catch (err) {
      console.error('[DatabaseList] Action error:', err);
      setPendingDatabases(prev => {
        const next = new Map(prev);
        next.delete(databaseId);
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
      console.error('[DatabaseList] GetSwitches error:', err);
      setSwitches([]);
    }
  };

  const handleCreateCancel = () => {
    setShowCreate(false);
  };

  const handleRDBMSTypeChange = (rdbmsType: string) => {
    setCreateForm(prev => ({
      ...prev,
      rdbmsType,
      servicePort: String(DEFAULT_PORTS[rdbmsType] ?? prev.servicePort),
    }));
  };

  const handleCreateSubmit = async () => {
    setCreating(true);
    setCreateError(null);
    try {
      const tags = createForm.tags.split(',').map(t => t.trim()).filter(t => t.length > 0);
      const params = new sakura.CreateDatabaseParams({
        Name: createForm.name,
        Description: createForm.description,
        Tags: tags,
        Plan: createForm.plan,
        SwitchID: createForm.switchId,
        IPAddress: createForm.ipAddress,
        NetworkMaskLen: parseInt(createForm.networkMaskLen, 10) || 0,
        DefaultRoute: createForm.defaultRoute,
        RDBMSType: createForm.rdbmsType,
        DefaultUser: createForm.defaultUser,
        UserPassword: createForm.userPassword,
        ServicePort: parseInt(createForm.servicePort, 10) || 0,
        MonitoringSuiteEnabled: createForm.monitoringSuiteEnabled,
      });
      await CreateDatabase(profile, zone, params);
      setShowCreate(false);
      await loadDatabases();
    } catch (e) {
      setCreateError(String(e));
    } finally {
      setCreating(false);
    }
  };

  const {
    searchQuery,
    setSearchQuery,
    isSearching,
    searchInputRef,
    filteredItems: filteredDatabases,
    closeSearch,
  } = useSearch(databases, (db, query) =>
    db.name.toLowerCase().includes(query) ||
    db.ipAddresses?.some(ip => ip.includes(query)) ||
    db.tags?.some(tag => tag.toLowerCase().includes(query)) ||
    db.id.includes(query)
  );

  useEffect(() => {
    loadDatabases();
  }, [loadDatabases]);

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
    // 簡略化したプラン名。実際にはもっと詳細なマッピングが必要かもしれない
    if (planId.includes('10gb')) return '10 GB';
    if (planId.includes('30gb')) return '30 GB';
    if (planId.includes('90gb')) return '90 GB';
    if (planId.includes('240gb')) return '240 GB';
    if (planId.includes('500gb')) return '500 GB';
    if (planId.includes('1tb')) return '1 TB';
    return planId;
  };

  return (
    <>
      <div className="header">
        <h2>データベース</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button className="btn btn-primary btn-small" onClick={handleCreateOpen}>+ データベース作成</button>
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
        placeholder="名前、IPアドレス、タグで検索... (Escで閉じる)"
      />

      {loading ? (
        <div className="loading">読み込み中...</div>
      ) : filteredDatabases.length === 0 ? (
        <div className="empty-state">
          {searchQuery ? `「${searchQuery}」に一致するデータベースがありません` : 'データベースがありません'}
        </div>
      ) : (
        filteredDatabases.map((db) => (
          <div key={db.id} className="card" onClick={() => onSelectDatabase(db.id)} style={{ cursor: 'pointer' }}>
            <div className="card-header">
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div className="card-title">{db.name}</div>
                  {pendingDatabases.has(db.id) ? (
                    <span className="status pending" style={{ padding: '2px 6px', fontSize: '0.65rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span className="spinner" style={{
                        width: '10px',
                        height: '10px',
                        border: '2px solid #ccc',
                        borderTop: '2px solid #666',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                      }}></span>
                      {pendingDatabases.get(db.id) === 'reset' ? '再起動中...' : db.status.toLowerCase() === 'up' ? '停止中...' : '起動中...'}
                    </span>
                  ) : (
                    <span className={`status ${db.status.toLowerCase() === 'up' ? 'up' : 'down'}`} style={{ padding: '2px 6px', fontSize: '0.65rem' }}>
                      {db.status}
                    </span>
                  )}
                </div>
                <div className="card-subtitle" style={{ marginTop: '2px', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span>プラン: {getPlanName(db.planId)}</span>
                  <span style={{ color: '#555' }}>|</span>
                  <span>{db.ipAddresses?.join(', ') || 'No IP'}</span>
                  <span style={{ color: '#555' }}>|</span>
                  <span title={`作成日: ${formatDate(db.createdAt)}`}>
                    作成日: {formatDate(db.createdAt)}
                  </span>
                </div>
                {db.tags && db.tags.length > 0 && (
                  <div className="tags" style={{ marginTop: '0.25rem', display: 'flex', gap: '0.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    {db.tags.map(tag => (
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
                  onClick={(e) => toggleDropdown(e, db.id)}
                >
                  ⋮
                </button>
                <div className={`dropdown-menu ${openDropdown === db.id ? 'show' : ''}`}>
                  <button
                    className="dropdown-item"
                    onClick={(e) => showConfirmDialog(e, db.zone, db.id, db.name, 'powerOn')}
                    disabled={db.status.toLowerCase() === 'up' || pendingDatabases.has(db.id)}
                  >
                    起動
                  </button>
                  <button
                    className="dropdown-item"
                    onClick={(e) => showConfirmDialog(e, db.zone, db.id, db.name, 'powerOff')}
                    disabled={db.status.toLowerCase() === 'down' || pendingDatabases.has(db.id)}
                  >
                    停止
                  </button>
                  <button
                    className="dropdown-item"
                    onClick={(e) => showConfirmDialog(e, db.zone, db.id, db.name, 'reset')}
                    disabled={db.status.toLowerCase() !== 'up' || pendingDatabases.has(db.id)}
                  >
                    再起動
                  </button>
                  <div style={{ borderTop: '1px solid #333', margin: '4px 0' }}></div>
                  <button
                    className="dropdown-item"
                    onClick={(e) => showConfirmDialog(e, db.zone, db.id, db.name, 'delete')}
                    disabled={pendingDatabases.has(db.id)}
                    style={{ color: '#f87171' }}
                  >
                    削除
                  </button>
                  <div style={{ borderTop: '1px solid #333', margin: '4px 0' }}></div>
                  <div className="dropdown-item" style={{ fontSize: '0.7rem', color: '#666', cursor: 'default' }}>
                    ID: {db.id}
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
              {confirmDialog.action === 'powerOn' ? 'データベース起動' : confirmDialog.action === 'powerOff' ? 'データベース停止' : confirmDialog.action === 'reset' ? 'データベース再起動' : 'データベース削除'}
            </h3>
            <p style={{ margin: '0 0 20px 0', color: '#aaa' }}>
              <strong style={{ color: '#fff' }}>{confirmDialog.databaseName}</strong> を
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
            padding: '20px', minWidth: '360px', maxWidth: '480px', maxHeight: '80vh', overflowY: 'auto',
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>データベース作成</h3>
            <div className="form-group">
              <label>名前</label>
              <input
                type="text"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                placeholder="my-database"
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>説明</label>
              <input
                type="text"
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                placeholder="任意"
              />
            </div>
            <div className="form-group">
              <label>タグ</label>
              <input
                type="text"
                value={createForm.tags}
                onChange={(e) => setCreateForm({ ...createForm, tags: e.target.value })}
                placeholder="カンマ区切り(任意)"
              />
            </div>
            <div className="form-group">
              <label>プラン</label>
              <select value={createForm.plan} onChange={(e) => setCreateForm({ ...createForm, plan: e.target.value })}>
                <option value="10g">10 GB</option>
                <option value="30g">30 GB</option>
                <option value="90g">90 GB</option>
                <option value="240g">240 GB</option>
                <option value="500g">500 GB</option>
                <option value="1t">1 TB</option>
              </select>
            </div>
            <div className="form-group">
              <label>データベース種別</label>
              <select value={createForm.rdbmsType} onChange={(e) => handleRDBMSTypeChange(e.target.value)}>
                <option value="mariadb">MariaDB</option>
                <option value="postgres">PostgreSQL</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="db-create-switch">接続先スイッチ</label>
              <select id="db-create-switch" value={createForm.switchId} onChange={(e) => setCreateForm({ ...createForm, switchId: e.target.value })}>
                <option value="">選択してください</option>
                {switches.map((sw) => (
                  <option key={sw.id} value={sw.id}>{sw.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>IPアドレス</label>
              <input
                type="text"
                value={createForm.ipAddress}
                onChange={(e) => setCreateForm({ ...createForm, ipAddress: e.target.value })}
                placeholder="192.168.0.11"
              />
            </div>
            <div className="form-group">
              <label>ネットワークマスク長</label>
              <input
                type="number"
                value={createForm.networkMaskLen}
                onChange={(e) => setCreateForm({ ...createForm, networkMaskLen: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>デフォルトルート</label>
              <input
                type="text"
                value={createForm.defaultRoute}
                onChange={(e) => setCreateForm({ ...createForm, defaultRoute: e.target.value })}
                placeholder="192.168.0.1"
              />
            </div>
            <div className="form-group">
              <label htmlFor="db-create-user">管理ユーザー名</label>
              <input
                id="db-create-user"
                type="text"
                value={createForm.defaultUser}
                onChange={(e) => setCreateForm({ ...createForm, defaultUser: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label htmlFor="db-create-password">管理ユーザーパスワード</label>
              <input
                id="db-create-password"
                type="password"
                value={createForm.userPassword}
                onChange={(e) => setCreateForm({ ...createForm, userPassword: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>ポート番号</label>
              <input
                type="number"
                value={createForm.servicePort}
                onChange={(e) => setCreateForm({ ...createForm, servicePort: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={createForm.monitoringSuiteEnabled}
                  onChange={(e) => setCreateForm({ ...createForm, monitoringSuiteEnabled: e.target.checked })}
                />
                拡張監視機能(Monitoring Suite)を有効化
              </label>
            </div>
            {createError && (
              <div style={{ marginBottom: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>
                エラー: {createError}
              </div>
            )}
            <div className="confirm-actions">
              <button className="btn btn-secondary" onClick={handleCreateCancel}>キャンセル</button>
              <button
                className="btn btn-primary"
                onClick={handleCreateSubmit}
                disabled={creating || !createForm.name || !createForm.switchId || !createForm.ipAddress || !createForm.defaultUser || !createForm.userPassword}
              >
                {creating ? '作成中...' : '作成する'}
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
