import { useState, useEffect, useCallback } from 'react';
import { GetKMSKeys } from '../../wailsjs/go/main/App';
import { kms } from '../../wailsjs/go/models';
import { useSearch } from '../hooks/useSearch';
import { SearchBar } from './SearchBar';

interface KMSListProps {
  profile: string;
}

export function KMSList({ profile }: KMSListProps) {
  const [keys, setKeys] = useState<kms.KeyInfo[]>([]);
  const [loading, setLoading] = useState(false);

  const {
    searchQuery,
    setSearchQuery,
    isSearching,
    searchInputRef,
    filteredItems: filteredKeys,
    closeSearch,
  } = useSearch(keys, (key, query) =>
    key.name.toLowerCase().includes(query) ||
    key.description?.toLowerCase().includes(query) ||
    key.tags?.some(tag => tag.toLowerCase().includes(query)) ||
    key.id.includes(query)
  );

  const loadKeys = useCallback(async () => {
    if (!profile) return;

    setLoading(true);
    try {
      const list = await GetKMSKeys(profile);
      setKeys(list || []);
    } catch (err) {
      console.error('[KMSList] loadKeys error:', err);
      setKeys([]);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    loadKeys();
  }, [loadKeys]);

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'enabled': return 'up';
      case 'disabled': return 'down';
      case 'pending_deletion': return 'down';
      default: return '';
    }
  };

  const getStatusName = (status: string) => {
    switch (status) {
      case 'enabled': return '有効';
      case 'disabled': return '無効';
      case 'pending_deletion': return '削除予定';
      default: return status;
    }
  };

  const getKeyOriginName = (origin: string) => {
    switch (origin) {
      case 'sakura_kms': return 'さくらKMS';
      case 'external': return '外部';
      default: return origin;
    }
  };

  return (
    <>
      <div className="header">
        <h2>KMS</h2>
        <button
          className="btn-reload"
          onClick={() => loadKeys()}
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
        placeholder="名前、説明、タグで検索... (Escで閉じる)"
      />

      {loading ? (
        <div className="loading">読み込み中...</div>
      ) : filteredKeys.length === 0 ? (
        <div className="empty-state">
          {searchQuery ? `「${searchQuery}」に一致するKMSキーがありません` : 'KMSキーがありません'}
        </div>
      ) : (
        filteredKeys.map((key) => (
          <div key={key.id} className="card">
            <div className="card-header">
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div className="card-title">{key.name}</div>
                  <span className={`status ${getStatusColor(key.status)}`} style={{ padding: '2px 6px', fontSize: '0.65rem' }}>
                    {getStatusName(key.status)}
                  </span>
                </div>
                <div className="card-subtitle" style={{ marginTop: '2px', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span>キー起源: {getKeyOriginName(key.keyOrigin)}</span>
                  <span style={{ color: '#555' }}>|</span>
                  <span>バージョン: {key.latestVersion}</span>
                  <span style={{ color: '#555' }}>|</span>
                  <span title={`作成日: ${formatDate(key.createdAt)}`}>
                    作成日: {formatDate(key.createdAt)}
                  </span>
                </div>
                {key.description && (
                  <div style={{ marginTop: '0.25rem', fontSize: '0.8rem', color: '#888' }}>
                    {key.description}
                  </div>
                )}
                {key.tags && key.tags.length > 0 && (
                  <div className="tags" style={{ marginTop: '0.25rem', display: 'flex', gap: '0.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    {key.tags.map(tag => (
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
                ID: {key.id}
              </div>
            </div>
          </div>
        ))
      )}
    </>
  );
}
