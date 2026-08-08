import { useState, useEffect, useCallback } from 'react';
import { GetGSLBList, DeleteGSLB, CreateGSLB } from '../../wailsjs/go/main/App';
import { sakura } from '../../wailsjs/go/models';
import { useSearch } from '../hooks/useSearch';
import { useGlobalReload } from '../hooks/useGlobalReload';
import { SearchBar } from './SearchBar';

interface GSLBListProps {
  profile: string;
  onSelectGSLB: (id: string) => void;
}

const IPV4_PATTERN = '^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(\\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$';

export function GSLBList({ profile, onSelectGSLB }: GSLBListProps) {
  const [gslbList, setGslbList] = useState<sakura.GSLBInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<sakura.GSLBInfo | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newSorryServer, setNewSorryServer] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const {
    searchQuery,
    setSearchQuery,
    isSearching,
    searchInputRef,
    filteredItems: filteredGslbList,
    closeSearch,
  } = useSearch(gslbList, (g, query) =>
    g.name.toLowerCase().includes(query) ||
    g.fqdn.toLowerCase().includes(query) ||
    g.id.includes(query)
  );

  const loadGSLBList = useCallback(async () => {
    if (!profile) {
      return;
    }

    setLoading(true);
    try {
      const list = await GetGSLBList(profile);
      setGslbList(list || []);
    } catch (err) {
      console.error('[GSLBList] loadGSLBList error:', err);
      setGslbList([]);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useGlobalReload(loadGSLBList);

  useEffect(() => {
    loadGSLBList();
  }, [loadGSLBList]);

  const handleDeleteClick = (e: React.MouseEvent, g: sakura.GSLBInfo) => {
    e.stopPropagation();
    setConfirmDelete(g);
  };

  const handleDeleteCancel = () => {
    setConfirmDelete(null);
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return;
    const g = confirmDelete;
    setConfirmDelete(null);
    setDeleting(g.id);
    try {
      await DeleteGSLB(profile, g.id);
      await loadGSLBList();
    } catch (e) {
      alert(`削除に失敗しました: ${e}`);
    } finally {
      setDeleting(null);
    }
  };

  const handleCreateOpen = () => {
    setNewName('');
    setNewDescription('');
    setNewSorryServer('');
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
      const settings = new sakura.GSLBSettingsInput({
        sorryServer: newSorryServer,
        delayLoop: 10,
        weighted: false,
        healthCheck: {
          protocol: 'ping',
          hostHeader: '',
          path: '',
          responseCode: 0,
          port: 0,
        },
        servers: [],
      });
      await CreateGSLB(profile, newName, newDescription, settings);
      setShowCreate(false);
      await loadGSLBList();
    } catch (e) {
      setCreateError(String(e));
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <div className="header">
        <h2>GSLB</h2>
        <button className="btn btn-primary btn-small" onClick={handleCreateOpen}>+ GSLB作成</button>
      </div>

      <SearchBar
        isSearching={isSearching}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        closeSearch={closeSearch}
        searchInputRef={searchInputRef}
        placeholder="名前、FQDNで検索... (Escで閉じる)"
      />

      {loading ? (
        <div className="loading">読み込み中...</div>
      ) : filteredGslbList.length === 0 ? (
        <div className="empty-state">
          {searchQuery ? `「${searchQuery}」に一致するGSLBがありません` : 'GSLBがありません'}
        </div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>名前</th>
              <th>FQDN</th>
              <th>サーバー数</th>
              <th>Sorry Server</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filteredGslbList.map((g) => (
              <tr
                key={g.id}
                onClick={() => onSelectGSLB(g.id)}
                style={{ cursor: 'pointer' }}
              >
                <td style={{ color: '#00adb5', fontWeight: 'bold' }}>{g.name}</td>
                <td>{g.fqdn}</td>
                <td>
                  {g.servers?.length || 0}
                  {g.servers && g.servers.length > 0 && (
                    <span style={{ color: '#888', marginLeft: '0.5rem', fontSize: '0.9em' }}>
                      ({g.servers.filter(s => s.enabled).length} 有効)
                    </span>
                  )}
                </td>
                <td>{g.sorryServer || '-'}</td>
                <td style={{ textAlign: 'left' }}>
                  <button
                    className="btn btn-danger btn-small"
                    onClick={(e) => handleDeleteClick(e, g)}
                    disabled={deleting === g.id}
                    title="削除"
                  >
                    {deleting === g.id ? '削除中...' : '削除'}
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
            <p>GSLB「{confirmDelete.name}」を削除しますか？</p>
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
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>GSLB作成</h3>
            <form onSubmit={handleCreateSubmit}>
            <div className="form-group">
              <label>名前<span className="required-mark">*</span></label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="my-gslb"
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>説明</label>
              <input
                type="text"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="任意"
              />
            </div>
            <div className="form-group">
              <label>Sorry Server(IPアドレス)</label>
              <input
                type="text"
                value={newSorryServer}
                onChange={(e) => setNewSorryServer(e.target.value)}
                placeholder="任意 (例: 192.0.2.1)"
                pattern={IPV4_PATTERN}
                title="IPv4アドレスの形式で入力してください"
              />
            </div>
            <p style={{ color: '#888', fontSize: '0.85rem' }}>
              振り分け先サーバーやヘルスチェックの詳細は作成後、詳細画面から設定できます。
            </p>
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
    </>
  );
}
