import { useState, useEffect, useCallback } from 'react';
import { GetContainerRegistries } from '../../wailsjs/go/main/App';
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

  return (
    <>
      <div className="header">
        <h2>コンテナレジストリ</h2>
        <button
          className="btn-reload"
          onClick={() => loadRegistries()}
          disabled={loading}
          title="リロード"
        >
          ↻
        </button>
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
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
