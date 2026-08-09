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
  DownloadObjectStorageObject,
  UploadObjectStorageObject,
  DeleteObjectStorageObject,
  CreateObjectStorageBucket,
  DeleteObjectStorageBucket,
  CreateObjectStorageAccessKey,
  DeleteObjectStorageAccessKey,
  GetObjectStorageAccount,
  DeleteObjectStorageAccount,
} from '../../wailsjs/go/main/App';
import { sakura } from '../../wailsjs/go/models';
import { useSearch } from '../hooks/useSearch';
import { useGlobalReload } from '../hooks/useGlobalReload';
import { SearchBar } from './SearchBar';
import { JSONLPreview } from './JSONLPreview';
import { TextPreview } from './TextPreview';
import { BucketSettingsModal } from './BucketSettingsModal';
import { ObjectStoragePermissions } from './ObjectStoragePermissions';

interface ObjectStorageListProps {
  profile: string;
  onBreadcrumbChange?: (siteName: string | null, bucketName: string | null) => void;
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

export function ObjectStorageList({ profile, onBreadcrumbChange }: ObjectStorageListProps) {
  const [sites, setSites] = useState<sakura.SiteInfo[]>([]);
  const [selectedSite, setSelectedSite] = useState<sakura.SiteInfo | null>(null);
  const [buckets, setBuckets] = useState<sakura.BucketInfo[]>([]);
  const [accessKeys, setAccessKeys] = useState<AccessKeyWithSaved[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingAccessKeys, setLoadingAccessKeys] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('sites');
  const [selectedAccessKeyId, setSelectedAccessKeyId] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [secretSaved, setSecretSaved] = useState(false);
  const [bucketsError, setBucketsError] = useState<string | null>(null);

  // Bucket create/delete state
  const [showCreateBucket, setShowCreateBucket] = useState(false);
  const [newBucketName, setNewBucketName] = useState('');
  const [newBucketPlan, setNewBucketPlan] = useState('');
  const [creatingBucket, setCreatingBucket] = useState(false);
  const [createBucketError, setCreateBucketError] = useState<string | null>(null);
  const [confirmDeleteBucket, setConfirmDeleteBucket] = useState<sakura.BucketInfo | null>(null);
  const [deletingBucket, setDeletingBucket] = useState<string | null>(null);

  // Access key create/delete state
  const [creatingAccessKey, setCreatingAccessKey] = useState(false);
  const [accessKeyError, setAccessKeyError] = useState<string | null>(null);
  const [newAccessKey, setNewAccessKey] = useState<sakura.AccessKeyCreated | null>(null);
  const [confirmDeleteAccessKey, setConfirmDeleteAccessKey] = useState(false);
  const [deletingAccessKey, setDeletingAccessKey] = useState(false);

  // Account state
  const [account, setAccount] = useState<sakura.AccountInfo | null>(null);
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Bucket settings / permissions modal state
  const [settingsBucket, setSettingsBucket] = useState<sakura.BucketInfo | null>(null);
  const [showPermissions, setShowPermissions] = useState(false);

  // Object list state
  const [selectedBucket, setSelectedBucket] = useState<sakura.BucketInfo | null>(null);
  const [objects, setObjects] = useState<sakura.ObjectInfo[]>([]);
  const [prefixes, setPrefixes] = useState<string[]>([]);
  const [currentPrefix, setCurrentPrefix] = useState('');
  const [objectsError, setObjectsError] = useState<string | null>(null);
  const [nextToken, setNextToken] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

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

  const {
    searchQuery: objectSearchQuery,
    setSearchQuery: setObjectSearchQuery,
    isSearching: isObjectSearching,
    searchInputRef: objectSearchInputRef,
    filteredItems: filteredObjects,
    closeSearch: closeObjectSearch,
  } = useSearch(objects, (obj, query) =>
    obj.key.toLowerCase().includes(query)
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

    setLoadingAccessKeys(true);
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

      // Auto-select first key with saved secret
      const savedKey = keysWithSaved.find(k => k.hasSavedSecret);
      if (savedKey) {
        setSelectedAccessKeyId(savedKey.id);
        const savedSecret = await GetObjectStorageSecretKey(siteId, savedKey.id);
        if (savedSecret) {
          setSecretKey(savedSecret);
          setSecretSaved(true);
        }
      }
    } catch (err) {
      console.error('[ObjectStorageList] loadAccessKeys error:', err);
      setAccessKeys([]);
    } finally {
      setLoadingAccessKeys(false);
    }
  }, [profile]);

  const loadAccount = useCallback(async (siteId: string) => {
    if (!profile || !siteId) return;
    try {
      const acc = await GetObjectStorageAccount(profile, siteId);
      setAccount(acc);
    } catch {
      // No account created for this site yet, that's fine
      setAccount(null);
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

  const handleGlobalReload = useCallback(() => {
    if (viewMode === 'sites') {
      loadSites();
    } else if (viewMode === 'buckets') {
      loadBuckets();
    } else if (viewMode === 'objects') {
      loadObjects(currentPrefix);
    }
  }, [viewMode, loadSites, loadBuckets, loadObjects, currentPrefix]);

  useGlobalReload(handleGlobalReload);

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

  // When searching, load all remaining objects with delay
  useEffect(() => {
    if (!objectSearchQuery || !hasMore || loading || searchLoading) return;

    const loadMoreForSearch = async () => {
      setSearchLoading(true);
      try {
        // Wait 300ms before loading more
        await new Promise(resolve => setTimeout(resolve, 300));
        await loadObjects(currentPrefix, true);
      } finally {
        setSearchLoading(false);
      }
    };

    loadMoreForSearch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objectSearchQuery, hasMore, objects.length]);

  const handleSiteSelect = async (site: sakura.SiteInfo) => {
    setSelectedSite(site);
    setViewMode('buckets');
    setBuckets([]);
    setBucketsError(null);
    setSelectedAccessKeyId('');
    setSecretKey('');
    setSecretSaved(false);
    onBreadcrumbChange?.(site.displayName, null);
    await Promise.all([loadAccessKeys(site.id), loadAccount(site.id)]);
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
    setAccount(null);
    onBreadcrumbChange?.(null, null);
  };

  const handleDeleteAccountConfirm = async () => {
    if (!profile || !selectedSite) return;
    setConfirmDeleteAccount(false);
    setDeletingAccount(true);
    try {
      await DeleteObjectStorageAccount(profile, selectedSite.id);
      setAccount(null);
    } catch (e) {
      alert(`削除に失敗しました: ${e}`);
    } finally {
      setDeletingAccount(false);
    }
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

  const handleSaveSecretSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSite || !selectedAccessKeyId) return;

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

  const handleCreateBucketOpen = () => {
    setNewBucketName('');
    setNewBucketPlan('');
    setCreateBucketError(null);
    setShowCreateBucket(true);
  };

  const handleCreateBucketCancel = () => {
    setShowCreateBucket(false);
  };

  const handleCreateBucketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !selectedSite) return;

    setCreatingBucket(true);
    setCreateBucketError(null);
    try {
      await CreateObjectStorageBucket(profile, selectedSite.id, newBucketName, newBucketPlan);
      setShowCreateBucket(false);
      await loadBuckets();
    } catch (err) {
      console.error('[ObjectStorageList] create bucket error:', err);
      setCreateBucketError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreatingBucket(false);
    }
  };

  const handleDeleteBucketClick = (e: React.MouseEvent, bucket: sakura.BucketInfo) => {
    e.stopPropagation();
    setConfirmDeleteBucket(bucket);
  };

  const handleDeleteBucketCancel = () => {
    setConfirmDeleteBucket(null);
  };

  const handleDeleteBucketConfirm = async () => {
    if (!profile || !selectedSite || !confirmDeleteBucket) return;
    const bucket = confirmDeleteBucket;
    setConfirmDeleteBucket(null);
    setDeletingBucket(bucket.name);
    try {
      await DeleteObjectStorageBucket(profile, selectedSite.id, bucket.name);
      await loadBuckets();
    } catch (e) {
      alert(`削除に失敗しました: ${e}`);
    } finally {
      setDeletingBucket(null);
    }
  };

  const handleCreateAccessKey = async () => {
    if (!profile || !selectedSite) return;

    setCreatingAccessKey(true);
    setAccessKeyError(null);
    try {
      const created = await CreateObjectStorageAccessKey(profile, selectedSite.id);
      setNewAccessKey(created);
      await loadAccessKeys(selectedSite.id);
    } catch (err) {
      console.error('[ObjectStorageList] create access key error:', err);
      setAccessKeyError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreatingAccessKey(false);
    }
  };

  const handleSaveNewAccessKey = async () => {
    if (!selectedSite || !newAccessKey) return;

    await SaveObjectStorageSecretKey(selectedSite.id, newAccessKey.id, newAccessKey.secret);
    setSelectedAccessKeyId(newAccessKey.id);
    setSecretKey(newAccessKey.secret);
    setSecretSaved(true);
    setNewAccessKey(null);
    await loadAccessKeys(selectedSite.id);
  };

  const handleCloseNewAccessKey = () => {
    setNewAccessKey(null);
  };

  const handleDeleteAccessKeyClick = () => {
    setConfirmDeleteAccessKey(true);
  };

  const handleDeleteAccessKeyCancel = () => {
    setConfirmDeleteAccessKey(false);
  };

  const handleDeleteAccessKeyConfirm = async () => {
    if (!profile || !selectedSite || !selectedAccessKeyId) return;
    const keyId = selectedAccessKeyId;
    setConfirmDeleteAccessKey(false);
    setDeletingAccessKey(true);
    try {
      await DeleteObjectStorageAccessKey(profile, selectedSite.id, keyId);
      try {
        await DeleteObjectStorageSecretKey(selectedSite.id, keyId);
      } catch {
        // no saved secret to clean up, that's fine
      }
      setSelectedAccessKeyId('');
      setSecretKey('');
      setSecretSaved(false);
      setBuckets([]);
      await loadAccessKeys(selectedSite.id);
    } catch (e) {
      alert(`削除に失敗しました: ${e}`);
    } finally {
      setDeletingAccessKey(false);
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
    onBreadcrumbChange?.(selectedSite?.displayName || null, bucket.name);
  };

  const handleBackToBuckets = () => {
    setViewMode('buckets');
    setSelectedBucket(null);
    setObjects([]);
    setPrefixes([]);
    setCurrentPrefix('');
    setObjectsError(null);
    onBreadcrumbChange?.(selectedSite?.displayName || null, null);
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

  const [downloading, setDownloading] = useState<string | null>(null);
  const [previewingObject, setPreviewingObject] = useState<sakura.ObjectInfo | null>(null);
  const [previewType, setPreviewType] = useState<'jsonl' | 'text' | null>(null);

  // Text file extensions that can be previewed as plain text
  const textExtensions = ['.ini', '.md', '.json', '.pem', '.txt', '.tfstate', '.yaml', '.yml', '.xml', '.html', '.css', '.js', '.ts', '.py', '.go', '.sh', '.bash', '.log', '.conf', '.cfg', '.env', '.sql'];

  const getPreviewType = (key: string): 'jsonl' | 'text' | null => {
    const lowerKey = key.toLowerCase();
    if (lowerKey.endsWith('.json.gz') || lowerKey.endsWith('.jsonl.gz')) {
      return 'jsonl';
    }
    // Check if it's a README file (no extension)
    const fileName = key.split('/').pop() || '';
    if (fileName.toUpperCase() === 'README' || fileName.toUpperCase().startsWith('README.')) {
      return 'text';
    }
    // Check text extensions
    for (const ext of textExtensions) {
      if (lowerKey.endsWith(ext)) {
        return 'text';
      }
    }
    return null;
  };

  const isPreviewable = (key: string): boolean => {
    return getPreviewType(key) !== null;
  };

  const handlePreview = (obj: sakura.ObjectInfo) => {
    const type = getPreviewType(obj.key);
    setPreviewType(type);
    setPreviewingObject(obj);
  };

  const handleDownload = async (obj: sakura.ObjectInfo) => {
    if (!selectedSite || !selectedBucket) return;

    const fileName = obj.key.split('/').pop() || obj.key;

    setDownloading(obj.key);
    try {
      await DownloadObjectStorageObject(
        selectedSite.endpoint,
        selectedAccessKeyId,
        secretKey,
        selectedBucket.name,
        obj.key,
        fileName
      );
    } catch (err) {
      console.error('[ObjectStorageList] download error:', err);
      // User cancelled is not an error
      if (err instanceof Error && !err.message.includes('cancelled')) {
        setObjectsError(`ダウンロードに失敗しました: ${err.message}`);
      }
    } finally {
      setDownloading(null);
    }
  };

  const [uploading, setUploading] = useState(false);
  const [deletingObject, setDeletingObject] = useState<string | null>(null);
  const [confirmDeleteObject, setConfirmDeleteObject] = useState<sakura.ObjectInfo | null>(null);

  const handleUpload = async () => {
    if (!selectedSite || !selectedBucket) return;

    setUploading(true);
    setObjectsError(null);
    try {
      await UploadObjectStorageObject(
        selectedSite.endpoint,
        selectedAccessKeyId,
        secretKey,
        selectedBucket.name,
        currentPrefix
      );
      await loadObjects(currentPrefix);
    } catch (err) {
      console.error('[ObjectStorageList] upload error:', err);
      if (err instanceof Error && !err.message.includes('cancelled')) {
        setObjectsError(`アップロードに失敗しました: ${err.message}`);
      }
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteObjectConfirm = async () => {
    if (!selectedSite || !selectedBucket || !confirmDeleteObject) return;
    const obj = confirmDeleteObject;
    setConfirmDeleteObject(null);
    setDeletingObject(obj.key);
    try {
      await DeleteObjectStorageObject(
        selectedSite.endpoint,
        selectedAccessKeyId,
        secretKey,
        selectedBucket.name,
        obj.key
      );
      await loadObjects(currentPrefix);
    } catch (err) {
      setObjectsError(`削除に失敗しました: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setDeletingObject(null);
    }
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
            className="btn btn-primary"
            onClick={handleUpload}
            disabled={uploading}
          >
            {uploading ? 'アップロード中...' : '+ アップロード'}
          </button>
        </div>

        <div style={{ marginBottom: '0.5rem', padding: '0.5rem', backgroundColor: '#1a1a2e', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '0.25rem', flexWrap: 'wrap' }}>
          <span
            onClick={() => handlePrefixClick('')}
            style={{
              color: currentPrefix ? '#00adb5' : '#888',
              fontSize: '0.85rem',
              cursor: currentPrefix ? 'pointer' : 'default',
            }}
          >
            /
          </span>
          {currentPrefix.split('/').filter(p => p).map((part, index, arr) => {
            const pathUpTo = arr.slice(0, index + 1).join('/') + '/';
            const isLast = index === arr.length - 1;
            return (
              <span key={pathUpTo} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span style={{ color: '#666', fontSize: '0.85rem' }}>/</span>
                <span
                  onClick={() => !isLast && handlePrefixClick(pathUpTo)}
                  style={{
                    color: isLast ? '#888' : '#00adb5',
                    fontSize: '0.85rem',
                    cursor: isLast ? 'default' : 'pointer',
                  }}
                >
                  {part}
                </span>
              </span>
            );
          })}
        </div>

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

        {objects.length > 0 && (
          <SearchBar
            isSearching={isObjectSearching}
            searchQuery={objectSearchQuery}
            setSearchQuery={setObjectSearchQuery}
            closeSearch={closeObjectSearch}
            searchInputRef={objectSearchInputRef}
            placeholder="ファイル名で検索... (Escで閉じる)"
          />
        )}

        {loading && objects.length === 0 ? (
          <div className="loading">読み込み中...</div>
        ) : (prefixes.length === 0 && objects.length === 0) ? (
          <div className="empty-state">オブジェクトがありません</div>
        ) : objectSearchQuery && filteredObjects.length === 0 ? (
          <div className="empty-state">「{objectSearchQuery}」に一致するファイルがありません</div>
        ) : (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>名前</th>
                  <th>サイズ</th>
                  <th>更新日時</th>
                  <th style={{ width: '100px' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {!objectSearchQuery && currentPrefix && (
                  <tr
                    onClick={handleNavigateUp}
                    style={{ cursor: 'pointer' }}
                  >
                    <td style={{ color: '#ffd93d' }}>📁 ..</td>
                    <td>-</td>
                    <td>-</td>
                    <td>-</td>
                  </tr>
                )}
                {!objectSearchQuery && prefixes.map((prefix) => (
                  <tr
                    key={prefix}
                    onClick={() => handlePrefixClick(prefix)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td style={{ color: '#ffd93d' }}>📁 {prefix.replace(currentPrefix, '').replace(/\/$/, '')}</td>
                    <td>-</td>
                    <td>-</td>
                    <td>-</td>
                  </tr>
                ))}
                {(objectSearchQuery ? filteredObjects : objects).map((obj) => (
                  <tr key={obj.key}>
                    <td style={{ color: '#e0e0e0' }}>📄 {getDisplayName(obj.key)}</td>
                    <td>{formatSize(obj.size)}</td>
                    <td>{obj.lastModified ? formatDate(obj.lastModified) : '-'}</td>
                    <td style={{ display: 'flex', gap: '0.25rem' }}>
                      {isPreviewable(obj.key) && (
                        <button
                          className="btn btn-secondary"
                          onClick={() => handlePreview(obj)}
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                          title="プレビュー"
                        >
                          👁
                        </button>
                      )}
                      <button
                        className="btn btn-secondary"
                        onClick={() => handleDownload(obj)}
                        disabled={downloading === obj.key}
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                        title="ダウンロード"
                      >
                        {downloading === obj.key ? '...' : '↓'}
                      </button>
                      <button
                        className="btn btn-danger"
                        onClick={() => setConfirmDeleteObject(obj)}
                        disabled={deletingObject === obj.key}
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                        title="削除"
                      >
                        {deletingObject === obj.key ? '...' : '🗑'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {hasMore && (
              <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                {objectSearchQuery ? (
                  <div style={{ color: '#888', fontSize: '0.85rem' }}>
                    {searchLoading || loading ? '検索中... さらに読み込んでいます' : ''}
                  </div>
                ) : (
                  <button
                    className="btn btn-primary"
                    onClick={() => loadObjects(currentPrefix, true)}
                    disabled={loading}
                  >
                    {loading ? '読み込み中...' : 'もっと読み込む'}
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {previewingObject && previewType === 'jsonl' && (
          <JSONLPreview
            endpoint={selectedSite.endpoint}
            accessKey={selectedAccessKeyId}
            secretKey={secretKey}
            bucketName={selectedBucket.name}
            objectKey={previewingObject.key}
            onClose={() => { setPreviewingObject(null); setPreviewType(null); }}
          />
        )}

        {previewingObject && previewType === 'text' && (
          <TextPreview
            endpoint={selectedSite.endpoint}
            accessKey={selectedAccessKeyId}
            secretKey={secretKey}
            bucketName={selectedBucket.name}
            objectKey={previewingObject.key}
            onClose={() => { setPreviewingObject(null); setPreviewType(null); }}
          />
        )}

        {confirmDeleteObject && (
          <div className="confirm-overlay" onClick={() => setConfirmDeleteObject(null)}>
            <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
              <p>オブジェクト「{getDisplayName(confirmDeleteObject.key)}」を削除しますか？</p>
              <p className="confirm-warning">この操作は取り消せません。</p>
              <div className="confirm-actions">
                <button className="btn btn-secondary" onClick={() => setConfirmDeleteObject(null)}>キャンセル</button>
                <button className="btn btn-danger" onClick={handleDeleteObjectConfirm}>削除する</button>
              </div>
            </div>
          </div>
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
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className="btn btn-secondary"
              onClick={() => setShowPermissions(true)}
            >
              パーミッション管理
            </button>
            <button
              className="btn btn-primary"
              onClick={handleCreateBucketOpen}
            >
              + バケット作成
            </button>
          </div>
        </div>

        <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#1a1a2e', borderRadius: '8px' }}>
          <div style={{ marginBottom: '0.75rem', fontSize: '0.85rem', color: '#888', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>エンドポイント: {selectedSite.endpoint}</span>
            {account && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                アカウントコード: {account.code}
                <button
                  className="btn btn-danger btn-small"
                  onClick={() => setConfirmDeleteAccount(true)}
                  disabled={deletingAccount}
                  title="アカウントを削除（バケットが残っている場合は削除できません）"
                >
                  {deletingAccount ? '削除中...' : 'アカウント削除'}
                </button>
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label style={{ fontSize: '0.75rem', color: '#888', display: 'block', marginBottom: '0.25rem' }}>
                アクセスキー
              </label>
              {loadingAccessKeys ? (
                <div style={{
                  padding: '0.5rem',
                  color: '#888',
                  fontSize: '0.85rem',
                }}>
                  読み込み中...
                </div>
              ) : (
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
              )}
            </div>

            <button
              className="btn btn-secondary"
              onClick={handleCreateAccessKey}
              disabled={creatingAccessKey}
              style={{ padding: '0.5rem 1rem' }}
            >
              {creatingAccessKey ? '作成中...' : '+ 新規作成'}
            </button>

            {selectedAccessKeyId && (
              <>
                <form onSubmit={handleSaveSecretSubmit} style={{ display: 'contents' }}>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <label style={{ fontSize: '0.75rem', color: '#888', display: 'block', marginBottom: '0.25rem' }}>
                      シークレットキー<span className="required-mark">*</span> {secretSaved && <span style={{ color: '#4ade80' }}>(保存済み)</span>}
                    </label>
                    <input
                      type="password"
                      value={secretKey}
                      onChange={(e) => {
                        setSecretKey(e.target.value);
                        setSecretSaved(false);
                      }}
                      placeholder="Secret Access Key"
                      required
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
                      type="submit"
                      className="btn btn-primary"
                      style={{ padding: '0.5rem 1rem' }}
                    >
                      保存
                    </button>
                  )}
                </form>
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
                <button
                  className="btn btn-danger"
                  onClick={handleDeleteAccessKeyClick}
                  disabled={deletingAccessKey}
                  style={{ padding: '0.5rem 0.75rem' }}
                  title="このアクセスキーを削除"
                >
                  {deletingAccessKey ? '削除中...' : 'アクセスキーを削除'}
                </button>
              </>
            )}
          </div>

          {accessKeyError && (
            <div style={{ marginTop: '0.75rem', color: '#ff6b6b', fontSize: '0.85rem' }}>
              エラー: {accessKeyError}
            </div>
          )}
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
                <th></th>
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
                  <td style={{ textAlign: 'left', display: 'flex', gap: '0.25rem' }}>
                    <button
                      className="btn btn-secondary btn-small"
                      onClick={(e) => { e.stopPropagation(); setSettingsBucket(bucket); }}
                    >
                      設定
                    </button>
                    <button
                      className="btn btn-danger btn-small"
                      onClick={(e) => handleDeleteBucketClick(e, bucket)}
                      disabled={deletingBucket === bucket.name}
                    >
                      {deletingBucket === bucket.name ? '削除中...' : '削除'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {showCreateBucket && (
          <div className="modal-overlay" onClick={handleCreateBucketCancel} style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
              backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
              padding: '20px', minWidth: '320px', maxWidth: '420px',
            }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>バケット作成</h3>
              <form onSubmit={handleCreateBucketSubmit}>
                <div className="form-group">
                  <label>バケット名<span className="required-mark">*</span></label>
                  <input
                    type="text"
                    value={newBucketName}
                    onChange={(e) => setNewBucketName(e.target.value)}
                    placeholder="my-bucket"
                    required
                    autoFocus
                  />
                </div>
                {selectedSite.id === 'arc02' && (
                  <div className="form-group">
                    <label>プラン（アーカイブサイト）</label>
                    <input
                      type="text"
                      value={newBucketPlan}
                      onChange={(e) => setNewBucketPlan(e.target.value)}
                      placeholder="プラン名"
                    />
                  </div>
                )}
                {createBucketError && (
                  <div style={{ marginBottom: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>
                    エラー: {createBucketError}
                  </div>
                )}
                <div className="confirm-actions">
                  <button type="button" className="btn btn-secondary" onClick={handleCreateBucketCancel}>キャンセル</button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={creatingBucket}
                  >
                    {creatingBucket ? '作成中...' : '作成する'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {confirmDeleteBucket && (
          <div className="confirm-overlay" onClick={handleDeleteBucketCancel}>
            <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
              <p>バケット「{confirmDeleteBucket.name}」を削除しますか？</p>
              <p className="confirm-warning">この操作は取り消せません。バケット内にオブジェクトが残っている場合は削除できません。</p>
              <div className="confirm-actions">
                <button className="btn btn-secondary" onClick={handleDeleteBucketCancel}>キャンセル</button>
                <button className="btn btn-danger" onClick={handleDeleteBucketConfirm}>削除する</button>
              </div>
            </div>
          </div>
        )}

        {newAccessKey && (
          <div className="modal-overlay" onClick={handleCloseNewAccessKey} style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
              backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
              padding: '20px', minWidth: '320px', maxWidth: '480px',
            }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>アクセスキーを作成しました</h3>
              <p style={{ color: '#ff6b6b', fontSize: '0.85rem' }}>
                シークレットキーはこの画面を閉じると二度と表示されません。必要であれば今すぐ保存してください。
              </p>
              <div className="form-group">
                <label>アクセスキーID</label>
                <input type="text" readOnly value={newAccessKey.id} />
              </div>
              <div className="form-group">
                <label>シークレットキー</label>
                <input type="text" readOnly value={newAccessKey.secret} />
              </div>
              <div className="confirm-actions">
                <button className="btn btn-secondary" onClick={handleCloseNewAccessKey}>閉じる</button>
                <button className="btn btn-primary" onClick={handleSaveNewAccessKey}>保存して選択する</button>
              </div>
            </div>
          </div>
        )}

        {confirmDeleteAccessKey && (
          <div className="confirm-overlay" onClick={handleDeleteAccessKeyCancel}>
            <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
              <p>アクセスキー「{selectedAccessKeyId}」を削除しますか？</p>
              <p className="confirm-warning">この操作は取り消せません。保存済みのシークレットキーも合わせて削除されます。</p>
              <div className="confirm-actions">
                <button className="btn btn-secondary" onClick={handleDeleteAccessKeyCancel}>キャンセル</button>
                <button className="btn btn-danger" onClick={handleDeleteAccessKeyConfirm}>削除する</button>
              </div>
            </div>
          </div>
        )}

        {confirmDeleteAccount && (
          <div className="confirm-overlay" onClick={() => setConfirmDeleteAccount(false)}>
            <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
              <p>このサイトのオブジェクトストレージアカウント（コード: {account?.code}）を削除しますか？</p>
              <p className="confirm-warning">この操作は取り消せません。発行済みのアクセスキーも合わせて削除されます。バケットが残っている場合は削除できません。</p>
              <div className="confirm-actions">
                <button className="btn btn-secondary" onClick={() => setConfirmDeleteAccount(false)}>キャンセル</button>
                <button className="btn btn-danger" onClick={handleDeleteAccountConfirm}>削除する</button>
              </div>
            </div>
          </div>
        )}

        {settingsBucket && selectedSite && (
          <BucketSettingsModal
            profile={profile}
            siteId={selectedSite.id}
            bucketName={settingsBucket.name}
            otherBuckets={buckets.filter((b) => b.name !== settingsBucket.name).map((b) => b.name)}
            onClose={() => setSettingsBucket(null)}
          />
        )}

        {showPermissions && selectedSite && (
          <ObjectStoragePermissions
            profile={profile}
            siteId={selectedSite.id}
            bucketNames={buckets.map((b) => b.name)}
            onClose={() => setShowPermissions(false)}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div className="header">
        <h2>オブジェクトストレージ</h2>
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
