import { useState, useEffect, useCallback } from 'react';
import {
  GetArchives,
  DeleteArchive,
  GetDisks,
  CreateArchive,
  CreateBlankArchive,
  OpenArchiveFTP,
  CloseArchiveFTP,
  ShareArchive,
  CreateArchiveFromShared,
} from '../../wailsjs/go/main/App';
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

type CreateSource = 'blank' | 'disk' | 'archive';

export function ArchiveList({ profile, zone, zones, onZoneChange }: ArchiveListProps) {
  const [archives, setArchives] = useState<sakura.ArchiveInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<sakura.ArchiveInfo | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [disks, setDisks] = useState<sakura.DiskInfo[]>([]);
  const [newSource, setNewSource] = useState<CreateSource>('blank');
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newTags, setNewTags] = useState('');
  const [newSizeGB, setNewSizeGB] = useState('20');
  const [newSourceDiskId, setNewSourceDiskId] = useState('');
  const [newSourceArchiveId, setNewSourceArchiveId] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [ftpTarget, setFtpTarget] = useState<sakura.ArchiveInfo | null>(null);
  const [ftpInfo, setFtpInfo] = useState<sakura.FTPServerInfo | null>(null);
  const [ftpLoading, setFtpLoading] = useState(false);
  const [ftpError, setFtpError] = useState<string | null>(null);

  const [shareTarget, setShareTarget] = useState<sakura.ArchiveInfo | null>(null);
  const [shareKey, setShareKey] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  const [showFromShared, setShowFromShared] = useState(false);
  const [sharedKeyInput, setSharedKeyInput] = useState('');
  const [sharedDestZone, setSharedDestZone] = useState(zone);
  const [sharedName, setSharedName] = useState('');
  const [sharedDescription, setSharedDescription] = useState('');
  const [sharedTags, setSharedTags] = useState('');
  const [creatingFromShared, setCreatingFromShared] = useState(false);
  const [fromSharedError, setFromSharedError] = useState<string | null>(null);

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

  const handleCreateOpen = async () => {
    setNewSource('blank');
    setNewName('');
    setNewDescription('');
    setNewTags('');
    setNewSizeGB('20');
    setNewSourceDiskId('');
    setNewSourceArchiveId('');
    setCreateError(null);
    setShowCreate(true);
    try {
      const diskList = await GetDisks(profile, zone);
      setDisks(diskList || []);
    } catch (err) {
      console.error('[ArchiveList] failed to load disks:', err);
      setDisks([]);
    }
  };

  const handleCreateCancel = () => {
    setShowCreate(false);
  };

  const handleCreateSubmit = async () => {
    setCreating(true);
    setCreateError(null);
    try {
      const tags = newTags.split(',').map(t => t.trim()).filter(t => t.length > 0);
      if (newSource === 'blank') {
        const sizeGB = parseInt(newSizeGB, 10) || 0;
        const result = await CreateBlankArchive(profile, zone, newName, newDescription, tags, sizeGB);
        setShowCreate(false);
        setFtpTarget(result.archive);
        setFtpInfo(result.ftpServer);
      } else {
        await CreateArchive(
          profile, zone, newName, newDescription, tags,
          newSource === 'disk' ? newSourceDiskId : '',
          newSource === 'archive' ? newSourceArchiveId : ''
        );
        setShowCreate(false);
      }
      await loadArchives();
    } catch (e) {
      setCreateError(String(e));
    } finally {
      setCreating(false);
    }
  };

  const handleShareClick = async (archive: sakura.ArchiveInfo) => {
    setShareTarget(archive);
    setShareKey(null);
    setShareError(null);
    setShareLoading(true);
    try {
      const key = await ShareArchive(profile, zone, archive.id);
      setShareKey(key);
    } catch (e) {
      setShareError(String(e));
    } finally {
      setShareLoading(false);
    }
  };

  const handleShareClose = () => {
    setShareTarget(null);
    setShareKey(null);
    setShareError(null);
  };

  const handleFtpOpenClick = async (archive: sakura.ArchiveInfo) => {
    setFtpTarget(archive);
    setFtpInfo(null);
    setFtpError(null);
    setFtpLoading(true);
    try {
      const info = await OpenArchiveFTP(profile, zone, archive.id, false);
      setFtpInfo(info);
    } catch (e) {
      setFtpError(String(e));
    } finally {
      setFtpLoading(false);
    }
  };

  const handleFtpClose = async () => {
    if (ftpTarget && ftpInfo) {
      try {
        await CloseArchiveFTP(profile, zone, ftpTarget.id);
      } catch (e) {
        alert(`FTP終了に失敗しました: ${e}`);
      }
    }
    setFtpTarget(null);
    setFtpInfo(null);
    setFtpError(null);
    await loadArchives();
  };

  const handleFromSharedOpen = () => {
    setSharedKeyInput('');
    setSharedDestZone(zone);
    setSharedName('');
    setSharedDescription('');
    setSharedTags('');
    setFromSharedError(null);
    setShowFromShared(true);
  };

  const handleFromSharedCancel = () => {
    setShowFromShared(false);
  };

  const handleFromSharedSubmit = async () => {
    setCreatingFromShared(true);
    setFromSharedError(null);
    try {
      const tags = sharedTags.split(',').map(t => t.trim()).filter(t => t.length > 0);
      await CreateArchiveFromShared(profile, sharedDestZone, sharedKeyInput, sharedName, sharedDescription, tags);
      setShowFromShared(false);
      if (sharedDestZone === zone) {
        await loadArchives();
      }
    } catch (e) {
      setFromSharedError(String(e));
    } finally {
      setCreatingFromShared(false);
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
          <button className="btn btn-primary btn-small" onClick={handleCreateOpen}>+ アーカイブ作成</button>
          <button className="btn btn-secondary btn-small" onClick={handleFromSharedOpen}>共有キーから複製</button>
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
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button
                        className="btn btn-secondary btn-small"
                        onClick={() => handleShareClick(archive)}
                        disabled={isBusy}
                        title={isBusy ? '処理中のアーカイブは共有できません' : '共有'}
                      >
                        共有
                      </button>
                      <button
                        className="btn btn-secondary btn-small"
                        onClick={() => handleFtpOpenClick(archive)}
                        disabled={isBusy}
                        title={isBusy ? '処理中のアーカイブはFTPを開始できません' : 'FTPアップロード'}
                      >
                        FTP
                      </button>
                      <button
                        className="btn btn-danger btn-small"
                        onClick={() => handleDeleteClick(archive)}
                        disabled={isBusy || deleting === archive.id}
                        title={isBusy ? '処理中のアーカイブは削除できません' : '削除'}
                      >
                        {deleting === archive.id ? '削除中...' : '削除'}
                      </button>
                    </div>
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
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>アーカイブ作成</h3>
            <div className="form-group">
              <label htmlFor="archive-create-source">作成方法</label>
              <select id="archive-create-source" value={newSource} onChange={(e) => setNewSource(e.target.value as CreateSource)}>
                <option value="blank">空のアーカイブ（FTPアップロード用）</option>
                <option value="disk">ディスクからコピー</option>
                <option value="archive">既存アーカイブからコピー</option>
              </select>
            </div>
            <div className="form-group">
              <label>名前</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="my-archive"
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
            <div className="form-group">
              <label>タグ</label>
              <input
                type="text"
                value={newTags}
                onChange={(e) => setNewTags(e.target.value)}
                placeholder="カンマ区切り(任意)"
              />
            </div>
            {newSource === 'blank' && (
              <div className="form-group">
                <label>サイズ(GB)</label>
                <input
                  type="number"
                  value={newSizeGB}
                  onChange={(e) => setNewSizeGB(e.target.value)}
                />
              </div>
            )}
            {newSource === 'disk' && (
              <div className="form-group">
                <label htmlFor="archive-create-source-disk">コピー元ディスク</label>
                <select id="archive-create-source-disk" value={newSourceDiskId} onChange={(e) => setNewSourceDiskId(e.target.value)}>
                  <option value="">選択してください</option>
                  {disks.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            )}
            {newSource === 'archive' && (
              <div className="form-group">
                <label htmlFor="archive-create-source-archive">コピー元アーカイブ</label>
                <select id="archive-create-source-archive" value={newSourceArchiveId} onChange={(e) => setNewSourceArchiveId(e.target.value)}>
                  <option value="">選択してください</option>
                  {archives.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            )}
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
                disabled={
                  creating || !newName ||
                  (newSource === 'disk' && !newSourceDiskId) ||
                  (newSource === 'archive' && !newSourceArchiveId)
                }
              >
                {creating ? '作成中...' : '作成する'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showFromShared && (
        <div className="modal-overlay" onClick={handleFromSharedCancel} style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
            backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
            padding: '20px', minWidth: '320px', maxWidth: '420px',
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>共有キーからアーカイブ複製</h3>
            <div className="form-group">
              <label>共有キー</label>
              <input
                type="text"
                value={sharedKeyInput}
                onChange={(e) => setSharedKeyInput(e.target.value)}
                placeholder="ゾーン:アーカイブID:トークン"
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>複製先ゾーン</label>
              <select value={sharedDestZone} onChange={(e) => setSharedDestZone(e.target.value)}>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>{z.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>名前</label>
              <input
                type="text"
                value={sharedName}
                onChange={(e) => setSharedName(e.target.value)}
                placeholder="my-archive"
              />
            </div>
            <div className="form-group">
              <label>説明</label>
              <input
                type="text"
                value={sharedDescription}
                onChange={(e) => setSharedDescription(e.target.value)}
                placeholder="任意"
              />
            </div>
            <div className="form-group">
              <label>タグ</label>
              <input
                type="text"
                value={sharedTags}
                onChange={(e) => setSharedTags(e.target.value)}
                placeholder="カンマ区切り(任意)"
              />
            </div>
            {fromSharedError && (
              <div style={{ marginBottom: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>
                エラー: {fromSharedError}
              </div>
            )}
            <div className="confirm-actions">
              <button className="btn btn-secondary" onClick={handleFromSharedCancel}>キャンセル</button>
              <button
                className="btn btn-primary"
                onClick={handleFromSharedSubmit}
                disabled={creatingFromShared || !sharedKeyInput || !sharedName}
              >
                {creatingFromShared ? '複製中...' : '複製する'}
              </button>
            </div>
          </div>
        </div>
      )}

      {shareTarget && (
        <div className="confirm-overlay" onClick={handleShareClose}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <p>アーカイブ「{shareTarget.name}」の共有キー</p>
            {shareLoading ? (
              <div className="loading">発行中...</div>
            ) : shareError ? (
              <p style={{ color: '#ff6b6b', fontSize: '0.85rem' }}>エラー: {shareError}</p>
            ) : (
              <input
                type="text"
                readOnly
                value={shareKey ?? ''}
                onClick={(e) => (e.target as HTMLInputElement).select()}
                style={{ width: '100%', marginTop: '0.5rem' }}
              />
            )}
            <div className="confirm-actions">
              <button className="btn btn-secondary" onClick={handleShareClose}>閉じる</button>
            </div>
          </div>
        </div>
      )}

      {ftpTarget && (
        <div className="confirm-overlay" onClick={ftpInfo ? handleFtpClose : undefined}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <p>アーカイブ「{ftpTarget.name}」のFTPアップロード情報</p>
            {ftpLoading ? (
              <div className="loading">接続情報を取得中...</div>
            ) : ftpError ? (
              <p style={{ color: '#ff6b6b', fontSize: '0.85rem' }}>エラー: {ftpError}</p>
            ) : ftpInfo ? (
              <table style={{ borderCollapse: 'collapse', marginTop: '0.5rem' }}>
                <tbody>
                  <tr>
                    <td style={{ padding: '0.25rem 1rem 0.25rem 0', color: '#888', textAlign: 'left' }}>ホスト</td>
                    <td style={{ padding: '0.25rem 0', textAlign: 'left' }}>{ftpInfo.hostName} ({ftpInfo.ipAddress})</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.25rem 1rem 0.25rem 0', color: '#888', textAlign: 'left' }}>ユーザー</td>
                    <td style={{ padding: '0.25rem 0', textAlign: 'left' }}>{ftpInfo.user}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.25rem 1rem 0.25rem 0', color: '#888', textAlign: 'left' }}>パスワード</td>
                    <td style={{ padding: '0.25rem 0', textAlign: 'left' }}>{ftpInfo.password}</td>
                  </tr>
                </tbody>
              </table>
            ) : null}
            <div className="confirm-actions">
              <button className="btn btn-danger" onClick={handleFtpClose} disabled={ftpLoading}>FTPを終了して閉じる</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
