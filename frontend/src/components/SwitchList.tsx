import { useState, useEffect, useCallback } from 'react';
import { GetSwitches, DeleteSwitch } from '../../wailsjs/go/main/App';
import { sakura } from '../../wailsjs/go/models';
import { useSearch } from '../hooks/useSearch';
import { useGlobalReload } from '../hooks/useGlobalReload';
import { SearchBar } from './SearchBar';

interface SwitchListProps {
  profile: string;
  zone: string;
  zones: sakura.ZoneInfo[];
  onZoneChange: (zone: string) => void;
  onSelectSwitch: (id: string) => void;
}

export function SwitchList({ profile, zone, zones, onZoneChange, onSelectSwitch }: SwitchListProps) {
  const [switches, setSwitches] = useState<sakura.SwitchInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<sakura.SwitchInfo | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const {
    searchQuery,
    setSearchQuery,
    isSearching,
    searchInputRef,
    filteredItems: filteredSwitches,
    closeSearch,
  } = useSearch(switches, (sw, query) =>
    sw.name.toLowerCase().includes(query) ||
    sw.description?.toLowerCase().includes(query) ||
    sw.id.includes(query)
  );

  const loadSwitches = useCallback(async () => {
    if (!profile || !zone) return;

    setLoading(true);
    try {
      const list = await GetSwitches(profile, zone);
      setSwitches(list || []);
    } catch (err) {
      console.error('[SwitchList] loadSwitches error:', err);
      setSwitches([]);
    } finally {
      setLoading(false);
    }
  }, [profile, zone]);

  useGlobalReload(loadSwitches);

  useEffect(() => {
    loadSwitches();
  }, [loadSwitches]);

  const handleDeleteClick = (e: React.MouseEvent, sw: sakura.SwitchInfo) => {
    e.stopPropagation();
    setConfirmDelete(sw);
  };

  const handleDeleteCancel = () => {
    setConfirmDelete(null);
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return;
    const sw = confirmDelete;
    setConfirmDelete(null);
    setDeleting(sw.id);
    try {
      await DeleteSwitch(profile, zone, sw.id);
      await loadSwitches();
    } catch (e) {
      alert(`削除に失敗しました: ${e}`);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <>
      <div className="header">
        <h2>スイッチ</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <select
            className="zone-select"
            value={zone}
            onChange={(e) => onZoneChange(e.target.value)}
            disabled={loading}
          >
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <SearchBar
        isSearching={isSearching}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        closeSearch={closeSearch}
        searchInputRef={searchInputRef}
        placeholder="名前で検索... (Escで閉じる)"
      />

      {loading ? (
        <div className="loading">読み込み中...</div>
      ) : filteredSwitches.length === 0 ? (
        <div className="empty-state">
          {searchQuery ? `「${searchQuery}」に一致するスイッチがありません` : 'スイッチがありません'}
        </div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>名前</th>
              <th>接続サーバー数</th>
              <th>ネットワーク</th>
              <th>スコープ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filteredSwitches.map((sw) => (
              <tr
                key={sw.id}
                onClick={() => onSelectSwitch(sw.id)}
                style={{ cursor: 'pointer' }}
              >
                <td style={{ color: '#00adb5', fontWeight: 'bold' }}>{sw.name}</td>
                <td>{sw.serverCount}</td>
                <td>
                  {sw.networkMaskLen > 0 ? (
                    <>
                      /{sw.networkMaskLen}
                      {sw.defaultRoute && <span style={{ color: '#888', marginLeft: '0.5rem' }}>GW: {sw.defaultRoute}</span>}
                    </>
                  ) : '-'}
                </td>
                <td>
                  <span className={`status ${sw.scope === 'shared' ? 'up' : ''}`}>
                    {sw.scope === 'shared' ? '共有' : sw.scope === 'user' ? 'ユーザー' : sw.scope}
                  </span>
                </td>
                <td style={{ textAlign: 'left' }}>
                  <button
                    className="btn btn-danger btn-small"
                    onClick={(e) => handleDeleteClick(e, sw)}
                    disabled={deleting === sw.id || sw.scope === 'shared'}
                    title={sw.scope === 'shared' ? '共有スイッチは削除できません' : '削除'}
                  >
                    {deleting === sw.id ? '削除中...' : '削除'}
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
            <p>スイッチ「{confirmDelete.name}」を削除しますか？</p>
            <p className="confirm-warning">この操作は取り消せません。サーバーが接続されている場合は削除できません。</p>
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
