import { useState, useEffect, useCallback } from 'react';
import { GetEnhancedDBs, DeleteEnhancedDB, CreateEnhancedDB } from '../../wailsjs/go/main/App';
import { sakura } from '../../wailsjs/go/models';
import { useSearch } from '../hooks/useSearch';
import { useGlobalReload } from '../hooks/useGlobalReload';
import { SearchBar } from './SearchBar';

interface EnhancedDBListProps {
  profile: string;
  onSelectDB: (id: string) => void;
}

export function EnhancedDBList({ profile, onSelectDB }: EnhancedDBListProps) {
  const [databases, setDatabases] = useState<sakura.EnhancedDBInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<sakura.EnhancedDBInfo | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newDatabaseName, setNewDatabaseName] = useState('');
  const [newDatabaseType, setNewDatabaseType] = useState<'tidb' | 'mariadb'>('tidb');
  const [newRegion, setNewRegion] = useState<'is1' | 'tk1'>('is1');
  const [newTags, setNewTags] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const {
    searchQuery,
    setSearchQuery,
    isSearching,
    searchInputRef,
    filteredItems: filteredDatabases,
    closeSearch,
  } = useSearch(databases, (db, query) =>
    db.name.toLowerCase().includes(query) ||
    db.databaseName?.toLowerCase().includes(query) ||
    db.hostName?.toLowerCase().includes(query) ||
    db.tags?.some(tag => tag.toLowerCase().includes(query)) ||
    db.id.includes(query)
  );

  const loadDatabases = useCallback(async () => {
    if (!profile) return;

    setLoading(true);
    try {
      const list = await GetEnhancedDBs(profile);
      setDatabases(list || []);
    } catch (err) {
      console.error('[EnhancedDBList] loadDatabases error:', err);
      setDatabases([]);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useGlobalReload(loadDatabases);

  useEffect(() => {
    loadDatabases();
  }, [loadDatabases]);

  const handleDeleteClick = (db: sakura.EnhancedDBInfo) => {
    setConfirmDelete(db);
  };

  const handleDeleteCancel = () => {
    setConfirmDelete(null);
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return;
    const db = confirmDelete;
    setConfirmDelete(null);
    setDeleting(db.id);
    try {
      await DeleteEnhancedDB(profile, db.id);
      await loadDatabases();
    } catch (e) {
      alert(`削除に失敗しました: ${e}`);
    } finally {
      setDeleting(null);
    }
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

  const getRegionName = (region: string) => {
    switch (region) {
      case 'is1': return '石狩';
      case 'tk1': return '東京';
      default: return region;
    }
  };

  const getDatabaseTypeName = (dbType: string) => {
    switch (dbType) {
      case 'tidb': return 'TiDB';
      case 'mariadb': return 'MariaDB';
      default: return dbType;
    }
  };

  const handleCreateOpen = () => {
    setNewName('');
    setNewDescription('');
    setNewDatabaseName('');
    setNewDatabaseType('tidb');
    setNewRegion('is1');
    setNewTags('');
    setCreateError(null);
    setShowCreate(true);
  };

  const handleCreateCancel = () => {
    setShowCreate(false);
  };

  const handleCreateSubmit = async () => {
    setCreating(true);
    setCreateError(null);
    try {
      const tags = newTags.split(',').map(t => t.trim()).filter(t => t);
      await CreateEnhancedDB(profile, newName, newDescription, tags, newDatabaseName, newDatabaseType, newRegion);
      setShowCreate(false);
      await loadDatabases();
    } catch (e) {
      setCreateError(String(e));
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <div className="header">
        <h2>エンハンスドDB</h2>
        <button className="btn btn-primary btn-small" onClick={handleCreateOpen}>+ 作成</button>
      </div>

      <SearchBar
        isSearching={isSearching}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        closeSearch={closeSearch}
        searchInputRef={searchInputRef}
        placeholder="名前、DB名、ホスト名、タグで検索... (Escで閉じる)"
      />

      {loading ? (
        <div className="loading">読み込み中...</div>
      ) : filteredDatabases.length === 0 ? (
        <div className="empty-state">
          {searchQuery ? `「${searchQuery}」に一致するエンハンスドDBがありません` : 'エンハンスドDBがありません'}
        </div>
      ) : (
        filteredDatabases.map((db) => (
          <div key={db.id} className="card" onClick={() => onSelectDB(db.id)} style={{ cursor: 'pointer' }}>
            <div className="card-header">
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div className="card-title">{db.name}</div>
                  <span className="status up" style={{ padding: '2px 6px', fontSize: '0.65rem' }}>
                    {getDatabaseTypeName(db.databaseType)}
                  </span>
                </div>
                <div className="card-subtitle" style={{ marginTop: '2px', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span>DB名: {db.databaseName}</span>
                  <span style={{ color: '#555' }}>|</span>
                  <span>リージョン: {getRegionName(db.region)}</span>
                  <span style={{ color: '#555' }}>|</span>
                  <span style={{ fontFamily: 'monospace' }}>{db.hostName}:{db.port}</span>
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
              <div style={{ fontSize: '0.7rem', color: '#666', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                ID: {db.id}
                <button
                  className="btn btn-danger btn-small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteClick(db);
                  }}
                  disabled={deleting === db.id}
                  title="削除"
                >
                  {deleting === db.id ? '削除中...' : '削除'}
                </button>
              </div>
            </div>
          </div>
        ))
      )}

      {confirmDelete && (
        <div className="confirm-overlay" onClick={handleDeleteCancel}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <p>エンハンスドDB「{confirmDelete.name}」を削除しますか？</p>
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
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>エンハンスドDB作成</h3>
            <div className="form-group">
              <label>名前</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="my-enhanced-db"
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
              <label>DB名</label>
              <input
                type="text"
                value={newDatabaseName}
                onChange={(e) => setNewDatabaseName(e.target.value)}
                placeholder="mydb"
              />
            </div>
            <div className="form-group">
              <label htmlFor="enhanced-db-create-type">DB種別</label>
              <select
                id="enhanced-db-create-type"
                value={newDatabaseType}
                onChange={(e) => setNewDatabaseType(e.target.value as 'tidb' | 'mariadb')}
              >
                <option value="tidb">TiDB</option>
                <option value="mariadb">MariaDB</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="enhanced-db-create-region">リージョン</label>
              <select
                id="enhanced-db-create-region"
                value={newRegion}
                onChange={(e) => setNewRegion(e.target.value as 'is1' | 'tk1')}
              >
                <option value="is1">石狩</option>
                <option value="tk1">東京</option>
              </select>
            </div>
            <div className="form-group">
              <label>タグ</label>
              <input
                type="text"
                value={newTags}
                onChange={(e) => setNewTags(e.target.value)}
                placeholder="任意(カンマ区切り、例: env:prod,team:sre)"
              />
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
                disabled={creating || !newName || !newDatabaseName}
              >
                {creating ? '作成中...' : '作成する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
