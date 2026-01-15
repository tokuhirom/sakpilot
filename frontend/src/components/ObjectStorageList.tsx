import { useState, useEffect, useCallback } from 'react';
import {
  GetObjectStorageSites,
  GetObjectStorageBuckets,
  GetObjectStorageAccessKeys,
  GetObjectStorageSecretKey,
  SaveObjectStorageSecretKey,
  DeleteObjectStorageSecretKey,
  HasObjectStorageSecretKey,
  ListObjectStorageObjects,
} from '../../wailsjs/go/main/App';
import { sakura } from '../../wailsjs/go/models';
import { useSearch } from '../hooks/useSearch';
import { SearchBar } from './SearchBar';

interface ObjectStorageListProps {
  profile: string;
}

interface AccessKeyWithSaved extends sakura.AccessKeyInfo {
  hasSavedSecret?: boolean;
}

type ViewMode = 'sites' | 'buckets' | 'objects';

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Invalid Date';

  const Y = date.getFullYear();
  const M = String(date.getMonth() + 1).padStart(2, '0');
  const D = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');

  return `${Y}/${M}/${D} ${h}:${m}:${s}`;
};

export function ObjectStorageList({ profile }: ObjectStorageListProps) {
  const [sites, setSites] = useState<sakura.SiteInfo[]>([]);
  const [selectedSite, setSelectedSite] = useState<sakura.SiteInfo | null>(null);
  const [buckets, setBuckets] = useState<sakura.BucketInfo[]>([]);
  const [accessKeys, setAccessKeys] = useState<AccessKeyWithSaved[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('sites');
  const [selectedAccessKeyId, setSelectedAccessKeyId] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [secretSaved, setSecretSaved] = useState(false);
  const [bucketsError, setBucketsError] = useState<string | null>(null);

  // Object list state
  const [selectedBucket, setSelectedBucket] = useState<sakura.BucketInfo | null>(null);
  const [objects, setObjects] = useState<sakura.ObjectInfo[]>([]);
  const [prefixes, setPrefixes] = useState<string[]>([]);
  const [currentPrefix, setCurrentPrefix] = useState('');
  const [objectsError, setObjectsError] = useState<string | null>(null);
  const [nextToken, setNextToken] = useState('');
  const [hasMore, setHasMore] = useState(false);

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
      // Check which keys have saved secrets
      const keysWithSaved: AccessKeyWithSaved[] = await Promise.all(
        (keys || []).map(async (key) => {
          const hasSaved = await HasObjectStorageSecretKey(siteId, key.id);
          return { ...key, hasSavedSecret: hasSaved };
        })
      );
      setAccessKeys(keysWithSaved);
    } catch (err) {
      console.error('[ObjectStorageList] loadAccessKeys error:', err);
      setAccessKeys([]);
    }
  }, [profile]);

  const loadBuckets = useCallback(async () => {
    if (!profile || !selectedSite || !selectedAccessKeyId || !secretKey) return;

    setLoading(true);
    setBucketsError(null);
    try {
      const list = await GetObjectStorageBuckets(profile, selectedSite.id, selectedAccessKeyId, secretKey);
      setBuckets(list || []);
    } catch (err) {
      console.error('[ObjectStorageList] loadBuckets error:', err);
      setBucketsError(err instanceof Error ? err.message : String(err));
      setBuckets([]);
    } finally {
      setLoading(false);
    }
  }, [profile, selectedSite, selectedAccessKeyId, secretKey]);

  const loadObjects = useCallback(async (prefix: string = '', append: boolean = false) => {
    if (!selectedSite || !selectedAccessKeyId || !secretKey || !selectedBucket) return;

    setLoading(true);
    setObjectsError(null);
    try {
      const result = await ListObjectStorageObjects(
        selectedSite.endpoint,
        selectedAccessKeyId,
        secretKey,
        selectedBucket.name,
        prefix,
        append ? nextToken : '',
        100
      );
      if (append) {
        setObjects(prev => [...prev, ...(result.objects || [])]);
      } else {
        setObjects(result.objects || []);
      }
      setPrefixes(result.prefixes || []);
      setHasMore(result.isTruncated);
      setNextToken(result.nextToken || '');
    } catch (err) {
      console.error('[ObjectStorageList] loadObjects error:', err);
      setObjectsError(err instanceof Error ? err.message : String(err));
      if (!append) {
        setObjects([]);
        setPrefixes([]);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedSite, selectedAccessKeyId, secretKey, selectedBucket, nextToken]);

  useEffect(() => {
    loadSites();
  }, [loadSites]);

  // Auto-load buckets when we have both accessKey and secretKey
  useEffect(() => {
    if (selectedAccessKeyId && secretKey && secretSaved) {
      loadBuckets();
    }
  }, [selectedAccessKeyId, secretKey, secretSaved, loadBuckets]);

  // Auto-load objects when bucket is selected
  useEffect(() => {
    if (viewMode === 'objects' && selectedBucket && selectedAccessKeyId && secretKey) {
      loadObjects('');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBucket]);

  const handleSiteSelect = async (site: sakura.SiteInfo) => {
    setSelectedSite(site);
    setViewMode('buckets');
    setBuckets([]);
    setBucketsError(null);
    setSelectedAccessKeyId('');
    setSecretKey('');
    setSecretSaved(false);
    await loadAccessKeys(site.id);
  };

  const handleBackToSites = () => {
    setViewMode('sites');
    setSelectedSite(null);
    setBuckets([]);
    setAccessKeys([]);
    setSelectedAccessKeyId('');
    setSecretKey('');
    setSecretSaved(false);
    setBucketsError(null);
  };

  const handleAccessKeySelect = async (accessKeyId: string) => {
    setSelectedAccessKeyId(accessKeyId);
    setSecretKey('');
    setSecretSaved(false);
    setBuckets([]);
    setBucketsError(null);

    if (!accessKeyId || !selectedSite) return;

    // Try to load saved secret
    try {
      const savedSecret = await GetObjectStorageSecretKey(selectedSite.id, accessKeyId);
      if (savedSecret) {
        setSecretKey(savedSecret);
        setSecretSaved(true);
      }
    } catch {
      // No saved secret, that's fine
    }
  };

  const handleSaveSecret = async () => {
    if (!selectedSite || !selectedAccessKeyId || !secretKey) return;

    try {
      await SaveObjectStorageSecretKey(selectedSite.id, selectedAccessKeyId, secretKey);
      setSecretSaved(true);
      // Update the access key list to show saved status
      setAccessKeys(prev =>
        prev.map(k =>
          k.id === selectedAccessKeyId ? { ...k, hasSavedSecret: true } : k
        )
      );
      // Load buckets after saving
      loadBuckets();
    } catch (err) {
      console.error('[ObjectStorageList] save secret error:', err);
      setBucketsError('シークレットキーの保存に失敗しました');
    }
  };

  const handleDeleteSecret = async () => {
    if (!selectedSite || !selectedAccessKeyId) return;

    try {
      await DeleteObjectStorageSecretKey(selectedSite.id, selectedAccessKeyId);
      setSecretKey('');
      setSecretSaved(false);
      setBuckets([]);
      // Update the access key list
      setAccessKeys(prev =>
        prev.map(k =>
          k.id === selectedAccessKeyId ? { ...k, hasSavedSecret: false } : k
        )
      );
    } catch (err) {
      console.error('[ObjectStorageList] delete secret error:', err);
    }
  };

  const handleBucketSelect = (bucket: sakura.BucketInfo) => {
    setSelectedBucket(bucket);
    setViewMode('objects');
    setObjects([]);
    setPrefixes([]);
    setCurrentPrefix('');
    setObjectsError(null);
    setNextToken('');
    setHasMore(false);
  };

  const handleBackToBuckets = () => {
    setViewMode('buckets');
    setSelectedBucket(null);
    setObjects([]);
    setPrefixes([]);
    setCurrentPrefix('');
    setObjectsError(null);
    setNextToken('');
    setHasMore(false);
  };

  const handlePrefixClick = (prefix: string) => {
    setCurrentPrefix(prefix);
    setObjects([]);
    setPrefixes([]);
    setNextToken('');
    setHasMore(false);
    loadObjects(prefix);
  };

  const handleNavigateUp = () => {
    // Remove last folder from prefix
    const parts = currentPrefix.split('/').filter(p => p);
    parts.pop();
    const newPrefix = parts.length > 0 ? parts.join('/') + '/' : '';
    setCurrentPrefix(newPrefix);
    setObjects([]);
    setPrefixes([]);
    setNextToken('');
    setHasMore(false);
    loadObjects(newPrefix);
  };

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  };

  const getDisplayName = (key: string): string => {
    // Remove prefix from key to get just the file name
    return key.replace(currentPrefix, '');
  };

  // Object list view
  if (viewMode === 'objects' && selectedSite && selectedBucket) {
    return (
      <>
        <div className="header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              className="btn btn-secondary"
              onClick={handleBackToBuckets}
              style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
            >
              ← 戻る
            </button>
            <h2>{selectedBucket.name}</h2>
          </div>
          <button
            className="btn-reload"
            onClick={() => loadObjects(currentPrefix)}
            disabled={loading}
            title="リロード"
          >
            ↻
          </button>
        </div>

        {currentPrefix && (
          <div style={{ marginBottom: '0.5rem', padding: '0.5rem', backgroundColor: '#1a1a2e', borderRadius: '4px' }}>
            <span style={{ color: '#888', fontSize: '0.85rem' }}>パス: </span>
            <span style={{ color: '#00adb5', fontSize: '0.85rem' }}>{currentPrefix}</span>
          </div>
        )}

        {objectsError && (
          <div style={{
            marginBottom: '1rem',
            padding: '0.75rem',
            backgroundColor: '#3d1f1f',
            borderRadius: '4px',
            color: '#ff6b6b',
            fontSize: '0.85rem'
          }}>
            エラー: {objectsError}
          </div>
        )}

        {loading && objects.length === 0 ? (
          <div className="loading">読み込み中...</div>
        ) : (prefixes.length === 0 && objects.length === 0) ? (
          <div className="empty-state">オブジェクトがありません</div>
        ) : (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>名前</th>
                  <th>サイズ</th>
                  <th>更新日時</th>
                </tr>
              </thead>
              <tbody>
                {currentPrefix && (
                  <tr
                    onClick={handleNavigateUp}
                    style={{ cursor: 'pointer' }}
                  >
                    <td style={{ color: '#ffd93d' }}>📁 ..</td>
                    <td>-</td>
                    <td>-</td>
                  </tr>
                )}
                {prefixes.map((prefix) => (
                  <tr
                    key={prefix}
                    onClick={() => handlePrefixClick(prefix)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td style={{ color: '#ffd93d' }}>📁 {prefix.replace(currentPrefix, '').replace(/\/$/, '')}</td>
                    <td>-</td>
                    <td>-</td>
                  </tr>
                ))}
                {objects.map((obj) => (
                  <tr key={obj.key}>
                    <td style={{ color: '#e0e0e0' }}>📄 {getDisplayName(obj.key)}</td>
                    <td>{formatSize(obj.size)}</td>
                    <td>{obj.lastModified ? formatDate(obj.lastModified) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {hasMore && (
              <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                <button
                  className="btn btn-primary"
                  onClick={() => loadObjects(currentPrefix, true)}
                  disabled={loading}
                >
                  {loading ? '読み込み中...' : 'もっと読み込む'}
                </button>
              </div>
            )}
          </>
        )}
      </>
    );
  }

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
            disabled={loading || !selectedAccessKeyId || !secretKey}
            title="リロード"
          >
            ↻
          </button>
        </div>

        <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#1a1a2e', borderRadius: '8px' }}>
          <div style={{ marginBottom: '0.75rem', fontSize: '0.85rem', color: '#888' }}>
            エンドポイント: {selectedSite.endpoint}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label style={{ fontSize: '0.75rem', color: '#888', display: 'block', marginBottom: '0.25rem' }}>
                アクセスキー
              </label>
              <select
                value={selectedAccessKeyId}
                onChange={(e) => handleAccessKeySelect(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: '4px',
                  border: '1px solid #444',
                  backgroundColor: '#0f0f1a',
                  color: '#fff',
                  fontSize: '0.85rem',
                }}
              >
                <option value="">選択してください</option>
                {accessKeys.map((key) => (
                  <option key={key.id} value={key.id}>
                    {key.id}{key.hasSavedSecret ? ' (保存済み)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {selectedAccessKeyId && (
              <>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <label style={{ fontSize: '0.75rem', color: '#888', display: 'block', marginBottom: '0.25rem' }}>
                    シークレットキー {secretSaved && <span style={{ color: '#4ade80' }}>(保存済み)</span>}
                  </label>
                  <input
                    type="password"
                    value={secretKey}
                    onChange={(e) => {
                      setSecretKey(e.target.value);
                      setSecretSaved(false);
                    }}
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
                {!secretSaved && secretKey && (
                  <button
                    className="btn btn-primary"
                    onClick={handleSaveSecret}
                    style={{ padding: '0.5rem 1rem' }}
                  >
                    保存
                  </button>
                )}
                {secretSaved && (
                  <>
                    <button
                      className="btn btn-primary"
                      onClick={loadBuckets}
                      disabled={loading}
                      style={{ padding: '0.5rem 1rem' }}
                    >
                      取得
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={handleDeleteSecret}
                      style={{ padding: '0.5rem 0.75rem' }}
                      title="保存したシークレットを削除"
                    >
                      削除
                    </button>
                  </>
                )}
              </>
            )}
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
            {!selectedAccessKeyId
              ? 'アクセスキーを選択してください'
              : !secretKey
              ? 'シークレットキーを入力してください'
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
                <tr
                  key={bucket.name}
                  onClick={() => handleBucketSelect(bucket)}
                  style={{ cursor: 'pointer' }}
                >
                  <td style={{ color: '#00adb5', fontWeight: 'bold' }}>{bucket.name}</td>
                  <td>{bucket.creationDate ? formatDate(bucket.creationDate) : '-'}</td>
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
