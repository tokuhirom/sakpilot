import { useState, useEffect, useCallback } from 'react';
import { GetGSLBList } from '../../wailsjs/go/main/App';
import { sakura } from '../../wailsjs/go/models';
import { useSearch } from '../hooks/useSearch';
import { SearchBar } from './SearchBar';

interface GSLBListProps {
  profile: string;
  onSelectGSLB: (id: string) => void;
}

export function GSLBList({ profile, onSelectGSLB }: GSLBListProps) {
  const [gslbList, setGslbList] = useState<sakura.GSLBInfo[]>([]);
  const [loading, setLoading] = useState(false);

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

  useEffect(() => {
    loadGSLBList();
  }, [loadGSLBList]);

  return (
    <>
      <div className="header">
        <h2>GSLB</h2>
        <button
          className="btn-reload"
          onClick={() => loadGSLBList()}
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
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
