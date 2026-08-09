import { useState, useEffect, useCallback } from 'react';
import { GetSimpleMonitors, DeleteSimpleMonitor, CreateSimpleMonitor } from '../../wailsjs/go/main/App';
import { sakura } from '../../wailsjs/go/models';
import { useSearch } from '../hooks/useSearch';
import { useGlobalReload } from '../hooks/useGlobalReload';
import { SearchBar } from './SearchBar';

interface MonitorListProps {
  profile: string;
  onSelectMonitor: (id: string) => void;
}

const emptyCreateSettings = new sakura.SimpleMonitorSettingsInput({
  delayLoop: 60,
  maxCheckAttempts: 3,
  retryInterval: 60,
  timeout: 10,
  enabled: true,
  notifyEmailEnabled: true,
  notifySlackEnabled: false,
  slackWebhooksUrl: '',
  notifyInterval: 3600,
  healthCheck: { protocol: 'ping', port: '', path: '', status: '', host: '', containsString: '' },
});

export function MonitorList({ profile, onSelectMonitor }: MonitorListProps) {
  const [monitors, setMonitors] = useState<sakura.SimpleMonitorInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<sakura.SimpleMonitorInfo | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newTarget, setNewTarget] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newProtocol, setNewProtocol] = useState('ping');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const {
    searchQuery,
    setSearchQuery,
    isSearching,
    searchInputRef,
    filteredItems: filteredMonitors,
    closeSearch,
  } = useSearch(monitors, (m, query) =>
    m.name.toLowerCase().includes(query) ||
    m.target.toLowerCase().includes(query) ||
    m.id.includes(query)
  );

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

  useGlobalReload(loadMonitors);

  // profile が変更されたらシンプル監視一覧を再取得
  useEffect(() => {
    console.log('[MonitorList] useEffect triggered:', { profile });
    loadMonitors();
  }, [loadMonitors]);

  const handleDeleteClick = (e: React.MouseEvent, m: sakura.SimpleMonitorInfo) => {
    e.stopPropagation();
    setConfirmDelete(m);
  };

  const handleDeleteCancel = () => {
    setConfirmDelete(null);
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return;
    const m = confirmDelete;
    setConfirmDelete(null);
    setDeleting(m.id);
    try {
      await DeleteSimpleMonitor(profile, m.id);
      await loadMonitors();
    } catch (e) {
      alert(`削除に失敗しました: ${e}`);
    } finally {
      setDeleting(null);
    }
  };

  const handleCreateOpen = () => {
    setNewTarget('');
    setNewDescription('');
    setNewProtocol('ping');
    setCreateError(null);
    setShowCreate(true);
  };

  const handleCreateCancel = () => {
    setShowCreate(false);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      const settings = new sakura.SimpleMonitorSettingsInput(emptyCreateSettings);
      settings.healthCheck = new sakura.SimpleMonitorHealthCheckInput({ ...emptyCreateSettings.healthCheck, protocol: newProtocol });
      await CreateSimpleMonitor(profile, newTarget, newDescription, settings);
      setShowCreate(false);
      await loadMonitors();
    } catch (e) {
      setCreateError(String(e));
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <div className="header">
        <h2>シンプル監視</h2>
        <button className="btn btn-primary btn-small" onClick={handleCreateOpen}>+ 監視作成</button>
      </div>

      <SearchBar
        isSearching={isSearching}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        closeSearch={closeSearch}
        searchInputRef={searchInputRef}
        placeholder="名前、ターゲットで検索... (Escで閉じる)"
      />

      {loading ? (
        <div className="loading">読み込み中...</div>
      ) : filteredMonitors.length === 0 ? (
        <div className="empty-state">
          {searchQuery ? `「${searchQuery}」に一致するシンプル監視がありません` : 'シンプル監視がありません'}
        </div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>名前</th>
              <th>ターゲット</th>
              <th>状態</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filteredMonitors.map((m) => (
              <tr key={m.id} onClick={() => onSelectMonitor(m.id)} style={{ cursor: 'pointer' }} className="row-hover">
                <td style={{ color: '#00adb5', fontWeight: 'bold' }}>{m.name}</td>
                <td>{m.target}</td>
                <td>
                  <span className={`status ${m.enabled ? 'up' : 'down'}`}>
                    {m.enabled ? '有効' : '無効'}
                  </span>
                </td>
                <td style={{ textAlign: 'left' }}>
                  <button
                    className="btn btn-danger btn-small"
                    onClick={(e) => handleDeleteClick(e, m)}
                    disabled={deleting === m.id}
                    title="削除"
                  >
                    {deleting === m.id ? '削除中...' : '削除'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {confirmDelete && (
        <div className="confirm-overlay" onClick={handleDeleteCancel}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <p>シンプル監視「{confirmDelete.name}」を削除しますか？</p>
            <p className="confirm-warning">この操作は取り消せません。</p>
            <div className="confirm-actions">
              <button className="btn btn-secondary" onClick={handleDeleteCancel}>キャンセル</button>
              <button className="btn btn-danger" onClick={handleDeleteConfirm}>削除する</button>
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
            padding: '20px', minWidth: '320px', maxWidth: '420px',
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>シンプル監視作成</h3>
            <form onSubmit={handleCreateSubmit}>
            <div className="form-group">
              <label>ターゲット(ホスト名/IPアドレス)<span className="required-mark">*</span></label>
              <input
                type="text"
                value={newTarget}
                onChange={(e) => setNewTarget(e.target.value)}
                placeholder="example.com"
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>プロトコル</label>
              <select value={newProtocol} onChange={(e) => setNewProtocol(e.target.value)}>
                <option value="ping">ping</option>
                <option value="http">http</option>
                <option value="https">https</option>
                <option value="tcp">tcp</option>
                <option value="ssh">ssh</option>
                <option value="dns">dns</option>
              </select>
            </div>
            <div className="form-group">
              <label>説明</label>
              <input
                type="text"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="任意"
                maxLength={512}
              />
            </div>
            <p style={{ color: '#888', fontSize: '0.8rem', margin: '0 0 1rem' }}>
              詳細な監視設定は作成後、詳細画面から編集できます。
            </p>
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
    </>
  );
}
