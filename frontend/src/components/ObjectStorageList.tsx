import { useState, useEffect, useCallback } from 'react';
import { GetObjectStorageSites, GetObjectStorageBuckets, GetObjectStorageAccessKeys } from '../../wailsjs/go/main/App';
import { sakura } from '../../wailsjs/go/models';
import { useSearch } from '../hooks/useSearch';
import { SearchBar } from './SearchBar';

interface ObjectStorageListProps {
  profile: string;
}

type ViewMode = 'sites' | 'buckets';

export function ObjectStorageList({ profile }: ObjectStorageListProps) {
  const [sites, setSites] = useState<sakura.SiteInfo[]>([]);
  const [selectedSite, setSelectedSite] = useState<sakura.SiteInfo | null>(null);
  const [buckets, setBuckets] = useState<sakura.BucketInfo[]>([]);
  const [accessKeys, setAccessKeys] = useState<sakura.AccessKeyInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('sites');
  const [accessKey, setAccessKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [bucketsError, setBucketsError] = useState<string | null>(null);

  const {
    searchQuery,
    setSearchQuery,
    isSearching,
    searchInputRef,
    filteredItems: filteredBuckets,
    closeSearch,
  } = useSearch(buckets, (bucket, query) =>
    bucket.name.toLowerCase().includes(query)
  );

  const loadSites = useCallback(async () => {
    if (!profile) return;

    setLoading(true);
    try {
      const list = await GetObjectStorageSites(profile);
      setSites(list || []);
    } catch (err) {
      console.error('[ObjectStorageList] loadSites error:', err);
      setSites([]);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  const loadAccessKeys = useCallback(async (siteId: string) => {
    if (!profile || !siteId) return;

    try {
      const keys = await GetObjectStorageAccessKeys(profile, siteId);
      setAccessKeys(keys || []);
    } catch (err) {
      console.error('[ObjectStorageList] loadAccessKeys error:', err);
      setAccessKeys([]);
    }
  }, [profile]);

  const loadBuckets = useCallback(async () => {
    if (!profile || !selectedSite || !accessKey || !secretKey) return;

    setLoading(true);
    setBucketsError(null);
    try {
      const list = await GetObjectStorageBuckets(profile, selectedSite.id, accessKey, secretKey);
      setBuckets(list || []);
    } catch (err) {
      console.error('[ObjectStorageList] loadBuckets error:', err);
      setBucketsError(err instanceof Error ? err.message : String(err));
      setBuckets([]);
    } finally {
      setLoading(false);
    }
  }, [profile, selectedSite, accessKey, secretKey]);

  useEffect(() => {
    loadSites();
  }, [loadSites]);

  const handleSiteSelect = async (site: sakura.SiteInfo) => {
    setSelectedSite(site);
    setViewMode('buckets');
    setBuckets([]);
    setBucketsError(null);
    setAccessKey('');
    setSecretKey('');
    await loadAccessKeys(site.id);
  };

  const handleBackToSites = () => {
    setViewMode('sites');
    setSelectedSite(null);
    setBuckets([]);
    setAccessKeys([]);
    setAccessKey('');
    setSecretKey('');
    setBucketsError(null);
  };

  if (viewMode === 'buckets' && selectedSite) {
    return (
      <>
        <div className="header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              className="btn btn-secondary"
              onClick={handleBackToSites}
              style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
            >
              ← 戻る
            </button>
            <h2>{selectedSite.displayName}</h2>
          </div>
          <button
            className="btn-reload"
            onClick={loadBuckets}
            disabled={loading || !accessKey || !secretKey}
            title="リロード"
          >
            ↻
          </button>
        </div>

        <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#1a1a2e', borderRadius: '8px' }}>
          <div style={{ marginBottom: '0.5rem', fontSize: '0.85rem', color: '#888' }}>
            エンドポイント: {selectedSite.endpoint}
          </div>

          <div style={{ marginBottom: '0.75rem' }}>
            <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: '0.25rem' }}>
              アクセスキー ({accessKeys.length}件)
            </div>
            {accessKeys.length > 0 && (
              <div style={{ fontSize: '0.75rem', color: '#666' }}>
                {accessKeys.map(k => k.id).join(', ')}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label style={{ fontSize: '0.75rem', color: '#888', display: 'block', marginBottom: '0.25rem' }}>
                アクセスキーID
              </label>
              <input
                type="text"
                value={accessKey}
                onChange={(e) => setAccessKey(e.target.value)}
                placeholder="Access Key ID"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: '4px',
                  border: '1px solid #444',
                  backgroundColor: '#0f0f1a',
                  color: '#fff',
                  fontSize: '0.85rem',
                }}
              />
            </div>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label style={{ fontSize: '0.75rem', color: '#888', display: 'block', marginBottom: '0.25rem' }}>
                シークレットキー
              </label>
              <input
                type="password"
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                placeholder="Secret Access Key"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: '4px',
                  border: '1px solid #444',
                  backgroundColor: '#0f0f1a',
                  color: '#fff',
                  fontSize: '0.85rem',
                }}
              />
            </div>
            <button
              className="btn btn-primary"
              onClick={loadBuckets}
              disabled={loading || !accessKey || !secretKey}
              style={{ padding: '0.5rem 1rem' }}
            >
              バケット取得
            </button>
          </div>
        </div>

        {bucketsError && (
          <div style={{
            marginBottom: '1rem',
            padding: '0.75rem',
            backgroundColor: '#3d1f1f',
            borderRadius: '4px',
            color: '#ff6b6b',
            fontSize: '0.85rem'
          }}>
            エラー: {bucketsError}
          </div>
        )}

        {buckets.length > 0 && (
          <SearchBar
            isSearching={isSearching}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            closeSearch={closeSearch}
            searchInputRef={searchInputRef}
            placeholder="バケット名で検索... (Escで閉じる)"
          />
        )}

        {loading ? (
          <div className="loading">読み込み中...</div>
        ) : buckets.length === 0 ? (
          <div className="empty-state">
            {!accessKey || !secretKey
              ? 'アクセスキーとシークレットキーを入力してバケット一覧を取得してください'
              : searchQuery
              ? `「${searchQuery}」に一致するバケットがありません`
              : 'バケットがありません'}
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>バケット名</th>
                <th>作成日時</th>
              </tr>
            </thead>
            <tbody>
              {filteredBuckets.map((bucket) => (
                <tr key={bucket.name}>
                  <td style={{ color: '#00adb5', fontWeight: 'bold' }}>{bucket.name}</td>
                  <td>{bucket.creationDate ? new Date(bucket.creationDate).toLocaleString() : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </>
    );
  }

  return (
    <>
      <div className="header">
        <h2>オブジェクトストレージ</h2>
        <button
          className="btn-reload"
          onClick={loadSites}
          disabled={loading}
          title="リロード"
        >
          ↻
        </button>
      </div>

      {loading ? (
        <div className="loading">読み込み中...</div>
      ) : sites.length === 0 ? (
        <div className="empty-state">サイトがありません</div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>サイト名</th>
              <th>エンドポイント</th>
            </tr>
          </thead>
          <tbody>
            {sites.map((site) => (
              <tr
                key={site.id}
                onClick={() => handleSiteSelect(site)}
                style={{ cursor: 'pointer' }}
              >
                <td style={{ color: '#00adb5', fontWeight: 'bold' }}>{site.displayName}</td>
                <td>{site.endpoint}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
