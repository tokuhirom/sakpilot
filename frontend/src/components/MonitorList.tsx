import { useState, useEffect, useCallback } from 'react';
import { GetSimpleMonitors, DeleteSimpleMonitor } from '../../wailsjs/go/main/App';
import { sakura } from '../../wailsjs/go/models';
import { useSearch } from '../hooks/useSearch';
import { useGlobalReload } from '../hooks/useGlobalReload';
import { SearchBar } from './SearchBar';

interface MonitorListProps {
  profile: string;
}

export function MonitorList({ profile }: MonitorListProps) {
  const [monitors, setMonitors] = useState<sakura.SimpleMonitorInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<sakura.SimpleMonitorInfo | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

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

  const handleDeleteClick = (m: sakura.SimpleMonitorInfo) => {
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

  return (
    <>
      <div className="header">
        <h2>シンプル監視</h2>
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
              <tr key={m.id}>
                <td>{m.name}</td>
                <td>{m.target}</td>
                <td>
                  <span className={`status ${m.enabled ? 'up' : 'down'}`}>
                    {m.enabled ? '有効' : '無効'}
                  </span>
                </td>
                <td style={{ textAlign: 'left' }}>
                  <button
                    className="btn btn-danger btn-small"
                    onClick={() => handleDeleteClick(m)}
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
    </>
  );
}
