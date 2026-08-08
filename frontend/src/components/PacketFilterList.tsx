import { useState, useEffect, useCallback } from 'react';
import { GetPacketFilters, DeletePacketFilter, CreatePacketFilter } from '../../wailsjs/go/main/App';
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
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

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

  const handleCreateOpen = () => {
    setNewName('');
    setNewDescription('');
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
      await CreatePacketFilter(profile, zone, newName, newDescription, []);
      setShowCreate(false);
      await loadPacketFilters();
    } catch (e) {
      setCreateError(String(e));
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <div className="header">
        <h2>パケットフィルター</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button className="btn btn-primary btn-small" onClick={handleCreateOpen}>+ 作成</button>
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
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>パケットフィルター作成</h3>
            <div className="form-group">
              <label>名前</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="my-filter"
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
                disabled={creating || !newName}
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
