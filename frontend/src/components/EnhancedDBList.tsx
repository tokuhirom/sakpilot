import { useState, useEffect, useCallback } from 'react';
import { GetEnhancedDBs } from '../../wailsjs/go/main/App';
import { sakura } from '../../wailsjs/go/models';
import { useSearch } from '../hooks/useSearch';
import { SearchBar } from './SearchBar';

interface EnhancedDBListProps {
  profile: string;
}

export function EnhancedDBList({ profile }: EnhancedDBListProps) {
  const [databases, setDatabases] = useState<sakura.EnhancedDBInfo[]>([]);
  const [loading, setLoading] = useState(false);

  const {
    searchQuery,
    setSearchQuery,
    isSearching,
    searchInputRef,
    filteredItems: filteredDatabases,
    closeSearch,
  } = useSearch(databases, (db, query) =>
    db.name.toLowerCase().includes(query) ||
    db.databaseName?.toLowerCase().includes(query) ||
    db.hostName?.toLowerCase().includes(query) ||
    db.tags?.some(tag => tag.toLowerCase().includes(query)) ||
    db.id.includes(query)
  );

  const loadDatabases = useCallback(async () => {
    if (!profile) return;

    setLoading(true);
    try {
      const list = await GetEnhancedDBs(profile);
      setDatabases(list || []);
    } catch (err) {
      console.error('[EnhancedDBList] loadDatabases error:', err);
      setDatabases([]);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    loadDatabases();
  }, [loadDatabases]);

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

  const getRegionName = (region: string) => {
    switch (region) {
      case 'is1': return '石狩';
      case 'tk1': return '東京';
      default: return region;
    }
  };

  const getDatabaseTypeName = (dbType: string) => {
    switch (dbType) {
      case 'tidb': return 'TiDB';
      case 'mariadb': return 'MariaDB';
      default: return dbType;
    }
  };

  return (
    <>
      <div className="header">
        <h2>エンハンスドDB</h2>
        <button
          className="btn-reload"
          onClick={() => loadDatabases()}
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
        placeholder="名前、DB名、ホスト名、タグで検索... (Escで閉じる)"
      />

      {loading ? (
        <div className="loading">読み込み中...</div>
      ) : filteredDatabases.length === 0 ? (
        <div className="empty-state">
          {searchQuery ? `「${searchQuery}」に一致するエンハンスドDBがありません` : 'エンハンスドDBがありません'}
        </div>
      ) : (
        filteredDatabases.map((db) => (
          <div key={db.id} className="card">
            <div className="card-header">
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div className="card-title">{db.name}</div>
                  <span className="status up" style={{ padding: '2px 6px', fontSize: '0.65rem' }}>
                    {getDatabaseTypeName(db.databaseType)}
                  </span>
                </div>
                <div className="card-subtitle" style={{ marginTop: '2px', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span>DB名: {db.databaseName}</span>
                  <span style={{ color: '#555' }}>|</span>
                  <span>リージョン: {getRegionName(db.region)}</span>
                  <span style={{ color: '#555' }}>|</span>
                  <span style={{ fontFamily: 'monospace' }}>{db.hostName}:{db.port}</span>
                  <span style={{ color: '#555' }}>|</span>
                  <span title={`作成日: ${formatDate(db.createdAt)}`}>
                    作成日: {formatDate(db.createdAt)}
                  </span>
                </div>
                {db.tags && db.tags.length > 0 && (
                  <div className="tags" style={{ marginTop: '0.25rem', display: 'flex', gap: '0.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    {db.tags.map(tag => (
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
                ID: {db.id}
              </div>
            </div>
          </div>
        ))
      )}
    </>
  );
}
