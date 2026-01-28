import { useState, useEffect, useCallback } from 'react';
import { GetDisks } from '../../wailsjs/go/main/App';
import { sakura } from '../../wailsjs/go/models';
import { useSearch } from '../hooks/useSearch';
import { useGlobalReload } from '../hooks/useGlobalReload';
import { SearchBar } from './SearchBar';

interface DiskListProps {
  profile: string;
  zone: string;
  zones: sakura.ZoneInfo[];
  onZoneChange: (zone: string) => void;
}

export function DiskList({ profile, zone, zones, onZoneChange }: DiskListProps) {
  const [disks, setDisks] = useState<sakura.DiskInfo[]>([]);
  const [loading, setLoading] = useState(false);

  const {
    searchQuery,
    setSearchQuery,
    isSearching,
    searchInputRef,
    filteredItems: filteredDisks,
    closeSearch,
  } = useSearch(disks, (disk, query) =>
    disk.name.toLowerCase().includes(query) ||
    disk.serverName?.toLowerCase().includes(query) ||
    disk.tags?.some(tag => tag.toLowerCase().includes(query)) ||
    disk.id.includes(query)
  );

  const loadDisks = useCallback(async () => {
    if (!profile || !zone) {
      return;
    }

    setLoading(true);
    try {
      const list = await GetDisks(profile, zone);
      setDisks(list || []);
    } catch (err) {
      console.error('[DiskList] loadDisks error:', err);
      setDisks([]);
    } finally {
      setLoading(false);
    }
  }, [profile, zone]);

  useGlobalReload(loadDisks);

  useEffect(() => {
    loadDisks();
  }, [loadDisks]);

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

  return (
    <>
      <div className="header">
        <h2>ディスク</h2>
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
        placeholder="名前、接続先、タグで検索... (Escで閉じる)"
      />

      {loading ? (
        <div className="loading">読み込み中...</div>
      ) : filteredDisks.length === 0 ? (
        <div className="empty-state">
          {searchQuery ? `「${searchQuery}」に一致するディスクがありません` : 'ディスクがありません'}
        </div>
      ) : (
        filteredDisks.map((disk) => (
          <div key={disk.id} className="card">
            <div className="card-header">
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div className="card-title">{disk.name}</div>
                </div>
                <div className="card-subtitle" style={{ marginTop: '2px', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span>{disk.sizeGb} GB</span>
                  <span style={{ color: '#555' }}>|</span>
                  <span>{disk.diskPlanName}</span>
                  <span style={{ color: '#555' }}>|</span>
                  <span>接続先: {disk.serverName || '(未接続)'}</span>
                  <span style={{ color: '#555' }}>|</span>
                  <span title={`作成日: ${formatDate(disk.createdAt)}`}>
                    作成日: {formatDate(disk.createdAt)}
                  </span>
                </div>
                {disk.tags && disk.tags.length > 0 && (
                  <div className="tags" style={{ marginTop: '0.25rem', display: 'flex', gap: '0.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    {disk.tags.map(tag => (
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
              <div style={{ fontSize: '0.7rem', color: '#666' }}>
                ID: {disk.id}
              </div>
            </div>
          </div>
        ))
      )}
    </>
  );
}
