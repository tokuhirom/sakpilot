import { useState, useEffect, useCallback } from 'react';
import { GetArchives, DeleteArchive } from '../../wailsjs/go/main/App';
import { sakura } from '../../wailsjs/go/models';
import { useSearch } from '../hooks/useSearch';
import { useGlobalReload } from '../hooks/useGlobalReload';
import { SearchBar } from './SearchBar';

interface ArchiveListProps {
  profile: string;
  zone: string;
  zones: sakura.ZoneInfo[];
  onZoneChange: (zone: string) => void;
}

export function ArchiveList({ profile, zone, zones, onZoneChange }: ArchiveListProps) {
  const [archives, setArchives] = useState<sakura.ArchiveInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<sakura.ArchiveInfo | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const {
    searchQuery,
    setSearchQuery,
    isSearching,
    searchInputRef,
    filteredItems: filteredArchives,
    closeSearch,
  } = useSearch(archives, (archive, query) =>
    archive.name.toLowerCase().includes(query) ||
    archive.description?.toLowerCase().includes(query) ||
    archive.tags?.some(tag => tag.toLowerCase().includes(query)) ||
    archive.id.includes(query)
  );

  const loadArchives = useCallback(async () => {
    if (!profile || !zone) {
      return;
    }

    setLoading(true);
    try {
      const list = await GetArchives(profile, zone);
      setArchives(list || []);
    } catch (err) {
      console.error('[ArchiveList] loadArchives error:', err);
      setArchives([]);
    } finally {
      setLoading(false);
    }
  }, [profile, zone]);

  useGlobalReload(loadArchives);

  useEffect(() => {
    loadArchives();
  }, [loadArchives]);

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

  const handleDeleteClick = (archive: sakura.ArchiveInfo) => {
    setConfirmDelete(archive);
  };

  const handleDeleteCancel = () => {
    setConfirmDelete(null);
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return;
    const archive = confirmDelete;
    setConfirmDelete(null);
    setDeleting(archive.id);
    try {
      await DeleteArchive(profile, zone, archive.id);
      await loadArchives();
    } catch (e) {
      alert(`削除に失敗しました: ${e}`);
    } finally {
      setDeleting(null);
    }
  };

  const formatAvailability = (availability: string) => {
    switch (availability) {
      case 'available': return { label: '利用可能', className: 'up' };
      case 'uploading': return { label: 'アップロード中', className: 'draining' };
      case 'failed': return { label: '失敗', className: 'down' };
      case 'migrating': return { label: '移行中', className: 'draining' };
      default: return { label: availability, className: '' };
    }
  };

  return (
    <>
      <div className="header">
        <h2>アーカイブ</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <select
            className="zone-select"
            value={zone}
            onChange={(e) => onZoneChange(e.target.value)}
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
        placeholder="名前、説明、タグで検索... (Escで閉じる)"
      />

      {loading ? (
        <div className="loading">読み込み中...</div>
      ) : filteredArchives.length === 0 ? (
        <div className="empty-state">
          {searchQuery ? `「${searchQuery}」に一致するアーカイブがありません` : 'アーカイブがありません'}
        </div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>名前</th>
              <th>サイズ</th>
              <th>状態</th>
              <th>作成日時</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredArchives.map((archive) => {
              const availability = formatAvailability(archive.availability);
              const isBusy = archive.availability === 'uploading' || archive.availability === 'migrating';
              return (
                <tr key={archive.id}>
                  <td>
                    <div style={{ fontWeight: 'bold', color: '#00adb5' }}>{archive.name}</div>
                    {archive.description && (
                      <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.25rem' }}>
                        {archive.description}
                      </div>
                    )}
                    {archive.tags && archive.tags.length > 0 && (
                      <div style={{ marginTop: '0.25rem', display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                        {archive.tags.map(tag => (
                          <span key={tag} style={{
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
                  </td>
                  <td style={{ textAlign: 'left' }}>{archive.sizeGb} GB</td>
                  <td style={{ textAlign: 'left' }}>
                    <span className={`status ${availability.className}`}>{availability.label}</span>
                  </td>
                  <td style={{ textAlign: 'left' }}>{formatDate(archive.createdAt)}</td>
                  <td style={{ textAlign: 'left' }}>
                    <button
                      className="btn btn-danger btn-small"
                      onClick={() => handleDeleteClick(archive)}
                      disabled={isBusy || deleting === archive.id}
                      title={isBusy ? '処理中のアーカイブは削除できません' : '削除'}
                    >
                      {deleting === archive.id ? '削除中...' : '削除'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {confirmDelete && (
        <div className="confirm-overlay" onClick={handleDeleteCancel}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <p>アーカイブ「{confirmDelete.name}」を削除しますか？</p>
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
