import { useState, useEffect, useCallback } from 'react';
import { GetGSLBList, DeleteGSLB } from '../../wailsjs/go/main/App';
import { sakura } from '../../wailsjs/go/models';
import { useSearch } from '../hooks/useSearch';
import { useGlobalReload } from '../hooks/useGlobalReload';
import { SearchBar } from './SearchBar';

interface GSLBListProps {
  profile: string;
  onSelectGSLB: (id: string) => void;
}

export function GSLBList({ profile, onSelectGSLB }: GSLBListProps) {
  const [gslbList, setGslbList] = useState<sakura.GSLBInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<sakura.GSLBInfo | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

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

  return (
    <>
      <div className="header">
        <h2>GSLB</h2>
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
    </>
  );
}
