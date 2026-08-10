import { useState, useEffect, useCallback } from 'react';
import { GetSecretManagerVaults, DeleteSecretManagerVault, CreateSecretManagerVault, GetKMSKeys } from '../../wailsjs/go/main/App';
import { secretmanager, kms } from '../../wailsjs/go/models';
import { useSearch } from '../hooks/useSearch';
import { useGlobalReload } from '../hooks/useGlobalReload';
import { SearchBar } from './SearchBar';

interface SecretManagerListProps {
  profile: string;
  onSelectVault: (id: string) => void;
}

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

export function SecretManagerList({ profile, onSelectVault }: SecretManagerListProps) {
  const [vaults, setVaults] = useState<secretmanager.VaultInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<secretmanager.VaultInfo | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [kmsKeys, setKmsKeys] = useState<kms.KeyInfo[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newKmsKeyId, setNewKmsKeyId] = useState('');
  const [newTags, setNewTags] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const {
    searchQuery,
    setSearchQuery,
    isSearching,
    searchInputRef,
    filteredItems: filteredVaults,
    closeSearch,
  } = useSearch(vaults, (vault, query) =>
    vault.name.toLowerCase().includes(query) ||
    vault.description?.toLowerCase().includes(query) ||
    vault.tags?.some(tag => tag.toLowerCase().includes(query)) ||
    vault.id.includes(query)
  );

  const loadVaults = useCallback(async () => {
    if (!profile) return;

    setLoading(true);
    try {
      const list = await GetSecretManagerVaults(profile);
      setVaults(list || []);
    } catch (err) {
      console.error('[SecretManagerList] loadVaults error:', err);
      setVaults([]);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useGlobalReload(loadVaults);

  useEffect(() => {
    loadVaults();
  }, [loadVaults]);

  const handleDeleteClick = (vault: secretmanager.VaultInfo) => {
    setConfirmDelete(vault);
  };

  const handleDeleteCancel = () => {
    setConfirmDelete(null);
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return;
    const vault = confirmDelete;
    setConfirmDelete(null);
    setDeleting(vault.id);
    try {
      await DeleteSecretManagerVault(profile, vault.id);
      await loadVaults();
    } catch (e) {
      alert(`削除に失敗しました: ${e}`);
    } finally {
      setDeleting(null);
    }
  };

  const handleCreateOpen = async () => {
    setNewName('');
    setNewDescription('');
    setNewTags('');
    setCreateError(null);
    try {
      const keys = await GetKMSKeys(profile);
      setKmsKeys(keys || []);
      setNewKmsKeyId(keys && keys.length > 0 ? keys[0].id : '');
    } catch (err) {
      console.error('[SecretManagerList] GetKMSKeys error:', err);
      setKmsKeys([]);
      setNewKmsKeyId('');
    }
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
      await CreateSecretManagerVault(profile, newName, newDescription, newKmsKeyId, tags);
      setShowCreate(false);
      await loadVaults();
    } catch (e) {
      setCreateError(String(e));
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <div className="header">
        <h2>シークレットマネージャー</h2>
        <button className="btn btn-primary btn-small" onClick={handleCreateOpen}>+ Vault作成</button>
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
      ) : filteredVaults.length === 0 ? (
        <div className="empty-state">
          {searchQuery ? `「${searchQuery}」に一致するVaultがありません` : 'Vaultがありません'}
        </div>
      ) : (
        filteredVaults.map((vault) => (
          <div key={vault.id} className="card" onClick={() => onSelectVault(vault.id)} style={{ cursor: 'pointer' }}>
            <div className="card-header">
              <div style={{ flex: 1 }}>
                <div className="card-title">{vault.name}</div>
                <div className="card-subtitle" style={{ marginTop: '2px', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span>KMSキー: {vault.kmsKeyId}</span>
                  <span style={{ color: '#555' }}>|</span>
                  <span title={`作成日: ${formatDate(vault.createdAt)}`}>
                    作成日: {formatDate(vault.createdAt)}
                  </span>
                </div>
                {vault.description && (
                  <div style={{ marginTop: '0.25rem', fontSize: '0.8rem', color: '#888' }}>
                    {vault.description}
                  </div>
                )}
                {vault.tags && vault.tags.length > 0 && (
                  <div className="tags" style={{ marginTop: '0.25rem', display: 'flex', gap: '0.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    {vault.tags.map(tag => (
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
                ID: {vault.id}
                <button
                  className="btn btn-danger btn-small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteClick(vault);
                  }}
                  disabled={deleting === vault.id}
                  title="削除"
                >
                  {deleting === vault.id ? '削除中...' : '削除'}
                </button>
              </div>
            </div>
          </div>
        ))
      )}

      {confirmDelete && (
        <div className="confirm-overlay" onClick={handleDeleteCancel}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <p>Vault「{confirmDelete.name}」を削除しますか？</p>
            <p className="confirm-warning">この操作は取り消せません。Vault内の全てのシークレットも削除されます。</p>
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
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>Vault作成</h3>
            <form onSubmit={handleCreateSubmit}>
              <div className="form-group">
                <label>名前<span className="required-mark">*</span></label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="my-vault"
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
                <label>KMSキー<span className="required-mark">*</span></label>
                {kmsKeys.length === 0 ? (
                  <div style={{ fontSize: '0.8rem', color: '#ff6b6b' }}>
                    利用可能なKMSキーがありません。先にKMSキーを作成してください。
                  </div>
                ) : (
                  <select
                    value={newKmsKeyId}
                    onChange={(e) => setNewKmsKeyId(e.target.value)}
                    required
                  >
                    {kmsKeys.map(key => (
                      <option key={key.id} value={key.id}>{key.name} ({key.id})</option>
                    ))}
                  </select>
                )}
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
                <button type="button" className="btn btn-secondary" onClick={handleCreateCancel}>キャンセル</button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={creating || kmsKeys.length === 0}
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
