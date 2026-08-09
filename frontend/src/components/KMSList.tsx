import { useState, useEffect, useCallback } from 'react';
import { GetKMSKeys, DeleteKMSKey, CreateKMSKey } from '../../wailsjs/go/main/App';
import { kms } from '../../wailsjs/go/models';
import { useSearch } from '../hooks/useSearch';
import { useGlobalReload } from '../hooks/useGlobalReload';
import { SearchBar } from './SearchBar';

interface KMSListProps {
  profile: string;
  onSelectKey: (id: string) => void;
}

export function KMSList({ profile, onSelectKey }: KMSListProps) {
  const [keys, setKeys] = useState<kms.KeyInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<kms.KeyInfo | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newKeyOrigin, setNewKeyOrigin] = useState<'generated' | 'imported'>('generated');
  const [newPlainKey, setNewPlainKey] = useState('');
  const [newTags, setNewTags] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const {
    searchQuery,
    setSearchQuery,
    isSearching,
    searchInputRef,
    filteredItems: filteredKeys,
    closeSearch,
  } = useSearch(keys, (key, query) =>
    key.name.toLowerCase().includes(query) ||
    key.description?.toLowerCase().includes(query) ||
    key.tags?.some(tag => tag.toLowerCase().includes(query)) ||
    key.id.includes(query)
  );

  const loadKeys = useCallback(async () => {
    if (!profile) return;

    setLoading(true);
    try {
      const list = await GetKMSKeys(profile);
      setKeys(list || []);
    } catch (err) {
      console.error('[KMSList] loadKeys error:', err);
      setKeys([]);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useGlobalReload(loadKeys);

  useEffect(() => {
    loadKeys();
  }, [loadKeys]);

  const handleDeleteClick = (key: kms.KeyInfo) => {
    setConfirmDelete(key);
  };

  const handleDeleteCancel = () => {
    setConfirmDelete(null);
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return;
    const key = confirmDelete;
    setConfirmDelete(null);
    setDeleting(key.id);
    try {
      await DeleteKMSKey(profile, key.id);
      await loadKeys();
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

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return 'up';
      case 'restricted': return 'down';
      case 'suspended': return 'down';
      case 'pending_destruction': return 'down';
      default: return '';
    }
  };

  const getStatusName = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return 'アクティブ';
      case 'restricted': return '制限中';
      case 'suspended': return '停止中';
      case 'pending_destruction': return '削除予定';
      default: return status;
    }
  };

  const getKeyOriginName = (origin: string) => {
    switch (origin) {
      case 'generated': return '生成';
      case 'imported': return 'インポート';
      default: return origin;
    }
  };

  const handleCreateOpen = () => {
    setNewName('');
    setNewDescription('');
    setNewKeyOrigin('generated');
    setNewPlainKey('');
    setNewTags('');
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
      const tags = newTags.split(',').map(t => t.trim()).filter(t => t);
      await CreateKMSKey(profile, newName, newDescription, newKeyOrigin, newPlainKey, tags);
      setShowCreate(false);
      await loadKeys();
    } catch (e) {
      setCreateError(String(e));
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <div className="header">
        <h2>KMS</h2>
        <button className="btn btn-primary btn-small" onClick={handleCreateOpen}>+ キー作成</button>
      </div>

      <SearchBar
        isSearching={isSearching}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        closeSearch={closeSearch}
        searchInputRef={searchInputRef}
        placeholder="名前、説明、タグで検索... (Escで閉じる)"
      />

      {loading ? (
        <div className="loading">読み込み中...</div>
      ) : filteredKeys.length === 0 ? (
        <div className="empty-state">
          {searchQuery ? `「${searchQuery}」に一致するKMSキーがありません` : 'KMSキーがありません'}
        </div>
      ) : (
        filteredKeys.map((key) => (
          <div key={key.id} className="card" onClick={() => onSelectKey(key.id)} style={{ cursor: 'pointer' }}>
            <div className="card-header">
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div className="card-title">{key.name}</div>
                  <span className={`status ${getStatusColor(key.status)}`} style={{ padding: '2px 6px', fontSize: '0.65rem' }}>
                    {getStatusName(key.status)}
                  </span>
                </div>
                <div className="card-subtitle" style={{ marginTop: '2px', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span>キー起源: {getKeyOriginName(key.keyOrigin)}</span>
                  <span style={{ color: '#555' }}>|</span>
                  <span>バージョン: {key.latestVersion}</span>
                  <span style={{ color: '#555' }}>|</span>
                  <span title={`作成日: ${formatDate(key.createdAt)}`}>
                    作成日: {formatDate(key.createdAt)}
                  </span>
                </div>
                {key.description && (
                  <div style={{ marginTop: '0.25rem', fontSize: '0.8rem', color: '#888' }}>
                    {key.description}
                  </div>
                )}
                {key.tags && key.tags.length > 0 && (
                  <div className="tags" style={{ marginTop: '0.25rem', display: 'flex', gap: '0.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    {key.tags.map(tag => (
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
                ID: {key.id}
                <button
                  className="btn btn-danger btn-small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteClick(key);
                  }}
                  disabled={deleting === key.id}
                  title="削除"
                >
                  {deleting === key.id ? '削除中...' : '削除'}
                </button>
              </div>
            </div>
          </div>
        ))
      )}

      {confirmDelete && (
        <div className="confirm-overlay" onClick={handleDeleteCancel}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <p>KMSキー「{confirmDelete.name}」を削除しますか？</p>
            <p className="confirm-warning">この操作は取り消せません。このキーで暗号化されたデータは復号できなくなります。</p>
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
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>KMSキー作成</h3>
            <form onSubmit={handleCreateSubmit}>
            <div className="form-group">
              <label>名前<span className="required-mark">*</span></label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="my-key"
                autoFocus
                required
              />
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
            <div className="form-group">
              <label>キー起源</label>
              <select
                value={newKeyOrigin}
                onChange={(e) => setNewKeyOrigin(e.target.value as 'generated' | 'imported')}
              >
                <option value="generated">生成(自動生成)</option>
                <option value="imported">インポート(既存キーを取り込む)</option>
              </select>
            </div>
            {newKeyOrigin === 'imported' && (
              <div className="form-group">
                <label>キー素材(Base64)<span className="required-mark">*</span></label>
                <input
                  type="text"
                  value={newPlainKey}
                  onChange={(e) => setNewPlainKey(e.target.value)}
                  placeholder="インポートする鍵データ"
                  required
                />
              </div>
            )}
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
