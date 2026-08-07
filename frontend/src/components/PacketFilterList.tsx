import { useState, useEffect, useCallback } from 'react';
import { GetPacketFilters, DeletePacketFilter } from '../../wailsjs/go/main/App';
import { sakura } from '../../wailsjs/go/models';
import { useSearch } from '../hooks/useSearch';
import { useGlobalReload } from '../hooks/useGlobalReload';
import { SearchBar } from './SearchBar';

interface PacketFilterListProps {
  profile: string;
  zone: string;
  zones: sakura.ZoneInfo[];
  onZoneChange: (zone: string) => void;
  onSelectPacketFilter: (id: string) => void;
}

export function PacketFilterList({ profile, zone, zones, onZoneChange, onSelectPacketFilter }: PacketFilterListProps) {
  const [packetFilters, setPacketFilters] = useState<sakura.PacketFilterInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<sakura.PacketFilterInfo | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const {
    searchQuery,
    setSearchQuery,
    isSearching,
    searchInputRef,
    filteredItems: filteredPacketFilters,
    closeSearch,
  } = useSearch(packetFilters, (pf, query) =>
    pf.name.toLowerCase().includes(query) ||
    pf.description?.toLowerCase().includes(query) ||
    pf.id.includes(query)
  );

  const loadPacketFilters = useCallback(async () => {
    if (!profile || !zone) return;

    setLoading(true);
    try {
      const list = await GetPacketFilters(profile, zone);
      setPacketFilters(list || []);
    } catch (err) {
      console.error('[PacketFilterList] loadPacketFilters error:', err);
      setPacketFilters([]);
    } finally {
      setLoading(false);
    }
  }, [profile, zone]);

  useGlobalReload(loadPacketFilters);

  useEffect(() => {
    loadPacketFilters();
  }, [loadPacketFilters]);

  const handleDeleteClick = (e: React.MouseEvent, pf: sakura.PacketFilterInfo) => {
    e.stopPropagation();
    setConfirmDelete(pf);
  };

  const handleDeleteCancel = () => {
    setConfirmDelete(null);
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return;
    const pf = confirmDelete;
    setConfirmDelete(null);
    setDeleting(pf.id);
    try {
      await DeletePacketFilter(profile, zone, pf.id);
      await loadPacketFilters();
    } catch (e) {
      alert(`削除に失敗しました: ${e}`);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <>
      <div className="header">
        <h2>パケットフィルター</h2>
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
        placeholder="名前、説明で検索... (Escで閉じる)"
      />

      {loading ? (
        <div className="loading">読み込み中...</div>
      ) : filteredPacketFilters.length === 0 ? (
        <div className="empty-state">
          {searchQuery ? `「${searchQuery}」に一致するパケットフィルターがありません` : 'パケットフィルターがありません'}
        </div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>名前</th>
              <th>説明</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filteredPacketFilters.map((pf) => (
              <tr
                key={pf.id}
                onClick={() => onSelectPacketFilter(pf.id)}
                style={{ cursor: 'pointer' }}
              >
                <td style={{ color: '#00adb5', fontWeight: 'bold' }}>{pf.name}</td>
                <td>{pf.description || '-'}</td>
                <td style={{ textAlign: 'left' }}>
                  <button
                    className="btn btn-danger btn-small"
                    onClick={(e) => handleDeleteClick(e, pf)}
                    disabled={deleting === pf.id}
                    title="削除"
                  >
                    {deleting === pf.id ? '削除中...' : '削除'}
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
            <p>パケットフィルター「{confirmDelete.name}」を削除しますか？</p>
            <p className="confirm-warning">この操作は取り消せません。サーバーに接続されている場合は削除できません。</p>
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
