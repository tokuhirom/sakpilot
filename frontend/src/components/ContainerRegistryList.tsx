import { useState, useEffect, useCallback } from 'react';
import { GetContainerRegistries, DeleteContainerRegistry } from '../../wailsjs/go/main/App';
import { sakura } from '../../wailsjs/go/models';
import { useSearch } from '../hooks/useSearch';
import { useGlobalReload } from '../hooks/useGlobalReload';
import { SearchBar } from './SearchBar';

interface ContainerRegistryListProps {
  profile: string;
  onSelectRegistry: (registry: sakura.ContainerRegistryInfo) => void;
}

export function ContainerRegistryList({ profile, onSelectRegistry }: ContainerRegistryListProps) {
  const [registries, setRegistries] = useState<sakura.ContainerRegistryInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<sakura.ContainerRegistryInfo | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const {
    searchQuery,
    setSearchQuery,
    isSearching,
    searchInputRef,
    filteredItems: filteredRegistries,
    closeSearch,
  } = useSearch(registries, (r, query) =>
    r.name.toLowerCase().includes(query) ||
    r.fqdn.toLowerCase().includes(query) ||
    r.virtualDomain?.toLowerCase().includes(query) ||
    r.id.includes(query)
  );

  const loadRegistries = useCallback(async () => {
    if (!profile) return;

    setLoading(true);
    try {
      const list = await GetContainerRegistries(profile);
      setRegistries(list || []);
    } catch (err) {
      console.error('[ContainerRegistryList] loadRegistries error:', err);
      setRegistries([]);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useGlobalReload(loadRegistries);

  useEffect(() => {
    loadRegistries();
  }, [loadRegistries]);

  const handleDeleteClick = (e: React.MouseEvent, r: sakura.ContainerRegistryInfo) => {
    e.stopPropagation();
    setConfirmDelete(r);
  };

  const handleDeleteCancel = () => {
    setConfirmDelete(null);
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return;
    const r = confirmDelete;
    setConfirmDelete(null);
    setDeleting(r.id);
    try {
      await DeleteContainerRegistry(profile, r.id);
      await loadRegistries();
    } catch (e) {
      alert(`削除に失敗しました: ${e}`);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <>
      <div className="header">
        <h2>コンテナレジストリ</h2>
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
      ) : filteredRegistries.length === 0 ? (
        <div className="empty-state">
          {searchQuery ? `「${searchQuery}」に一致するコンテナレジストリがありません` : 'コンテナレジストリがありません'}
        </div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>名前</th>
              <th>FQDN</th>
              <th>アクセスレベル</th>
              <th>仮想ドメイン</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filteredRegistries.map((r) => (
              <tr
                key={r.id}
                onClick={() => onSelectRegistry(r)}
                style={{ cursor: 'pointer' }}
              >
                <td style={{ color: '#00adb5', fontWeight: 'bold' }}>{r.name}</td>
                <td>{r.fqdn}</td>
                <td>
                  <span className={`status ${r.accessLevel === 'readwrite' ? 'up' : ''}`}>
                    {r.accessLevel === 'readwrite' ? '読み書き' :
                     r.accessLevel === 'readonly' ? '読み取り専用' :
                     r.accessLevel === 'none' ? '非公開' : r.accessLevel}
                  </span>
                </td>
                <td>{r.virtualDomain || '-'}</td>
                <td style={{ textAlign: 'left' }}>
                  <button
                    className="btn btn-danger btn-small"
                    onClick={(e) => handleDeleteClick(e, r)}
                    disabled={deleting === r.id}
                    title="削除"
                  >
                    {deleting === r.id ? '削除中...' : '削除'}
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
            <p>コンテナレジストリ「{confirmDelete.name}」を削除しますか？</p>
            <p className="confirm-warning">この操作は取り消せません。登録されているイメージもすべて削除されます。</p>
            <div className="confirm-actions">
              <button className="btn btn-secondary" onClick={handleDeleteCancel}>キャンセル</button>
              <button className="btn btn-danger" onClick={handleDeleteConfirm}>削除する</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
