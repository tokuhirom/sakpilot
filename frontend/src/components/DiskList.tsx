import { useState, useEffect, useCallback } from 'react';
import { GetDisks, DeleteDisk, CreateDisk, GetArchives, GetServers } from '../../wailsjs/go/main/App';
import { sakura } from '../../wailsjs/go/models';
import { useSearch } from '../hooks/useSearch';
import { useGlobalReload } from '../hooks/useGlobalReload';
import { SearchBar } from './SearchBar';

interface DiskListProps {
  profile: string;
  zone: string;
  zones: sakura.ZoneInfo[];
  onZoneChange: (zone: string) => void;
  onSelectDisk: (id: string) => void;
}

export function DiskList({ profile, zone, zones, onZoneChange, onSelectDisk }: DiskListProps) {
  const [disks, setDisks] = useState<sakura.DiskInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<sakura.DiskInfo | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [archives, setArchives] = useState<sakura.ArchiveInfo[]>([]);
  const [servers, setServers] = useState<sakura.ServerInfo[]>([]);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newTags, setNewTags] = useState('');
  const [newSizeGB, setNewSizeGB] = useState('20');
  const [newDiskPlan, setNewDiskPlan] = useState('ssd');
  const [newConnection, setNewConnection] = useState('virtio');
  const [newSourceArchiveId, setNewSourceArchiveId] = useState('');
  const [newServerId, setNewServerId] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

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

  const handleDeleteClick = (e: React.MouseEvent, disk: sakura.DiskInfo) => {
    e.stopPropagation();
    setConfirmDelete(disk);
  };

  const handleDeleteCancel = () => {
    setConfirmDelete(null);
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return;
    const disk = confirmDelete;
    setConfirmDelete(null);
    setDeleting(disk.id);
    try {
      await DeleteDisk(profile, zone, disk.id);
      await loadDisks();
    } catch (e) {
      alert(`削除に失敗しました: ${e}`);
    } finally {
      setDeleting(null);
    }
  };

  const handleCreateOpen = async () => {
    setNewName('');
    setNewDescription('');
    setNewTags('');
    setNewSizeGB('20');
    setNewDiskPlan('ssd');
    setNewConnection('virtio');
    setNewSourceArchiveId('');
    setNewServerId('');
    setCreateError(null);
    setShowCreate(true);
    try {
      const [archiveList, serverList] = await Promise.all([
        GetArchives(profile, zone),
        GetServers(profile, zone),
      ]);
      setArchives(archiveList || []);
      setServers(serverList || []);
    } catch (err) {
      console.error('[DiskList] failed to load archives/servers:', err);
      setArchives([]);
      setServers([]);
    }
  };

  const handleCreateCancel = () => {
    setShowCreate(false);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      const tags = newTags.split(',').map(t => t.trim()).filter(t => t.length > 0);
      const sizeGB = parseInt(newSizeGB, 10) || 0;
      await CreateDisk(profile, zone, newName, newDescription, tags, sizeGB, newDiskPlan, newConnection, newSourceArchiveId, newServerId);
      setShowCreate(false);
      await loadDisks();
    } catch (e) {
      setCreateError(String(e));
    } finally {
      setCreating(false);
    }
  };

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
          <button className="btn btn-primary btn-small" onClick={handleCreateOpen}>+ ディスク作成</button>
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
          <div key={disk.id} className="card" onClick={() => onSelectDisk(disk.id)} style={{ cursor: 'pointer' }}>
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
              <div style={{ fontSize: '0.7rem', color: '#666', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                ID: {disk.id}
                <button
                  className="btn btn-danger btn-small"
                  onClick={(e) => handleDeleteClick(e, disk)}
                  disabled={deleting === disk.id}
                  title="削除"
                >
                  {deleting === disk.id ? '削除中...' : '削除'}
                </button>
              </div>
            </div>
          </div>
        ))
      )}

      {confirmDelete && (
        <div className="confirm-overlay" onClick={handleDeleteCancel}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <p>ディスク「{confirmDelete.name}」を削除しますか？</p>
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
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>ディスク作成</h3>
            <form onSubmit={handleCreateSubmit}>
              <div className="form-group">
                <label>名前<span className="required-mark">*</span></label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="my-disk"
                  required
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
                  maxLength={512}
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
              <div className="form-group">
                <label>サイズ(GB)<span className="required-mark">*</span></label>
                <input
                  type="number"
                  value={newSizeGB}
                  onChange={(e) => setNewSizeGB(e.target.value)}
                  min={20}
                  required
                />
              </div>
              <div className="form-group">
                <label>プラン</label>
                <select value={newDiskPlan} onChange={(e) => setNewDiskPlan(e.target.value)}>
                  <option value="ssd">SSD</option>
                  <option value="hdd">HDD</option>
                </select>
              </div>
              <div className="form-group">
                <label>接続方式</label>
                <select value={newConnection} onChange={(e) => setNewConnection(e.target.value)}>
                  <option value="virtio">virtio</option>
                  <option value="ide">ide</option>
                </select>
              </div>
              <div className="form-group">
                <label>コピー元アーカイブ</label>
                <select value={newSourceArchiveId} onChange={(e) => setNewSourceArchiveId(e.target.value)}>
                  <option value="">なし(空のディスク)</option>
                  {archives.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>接続先サーバー</label>
                <select value={newServerId} onChange={(e) => setNewServerId(e.target.value)}>
                  <option value="">なし(未接続)</option>
                  {servers.map((srv) => (
                    <option key={srv.id} value={srv.id}>{srv.name}</option>
                  ))}
                </select>
              </div>
              {createError && (
                <div style={{ marginBottom: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>
                  エラー: {createError}
                </div>
              )}
              <div className="confirm-actions">
                <button type="button" className="btn btn-secondary" onClick={handleCreateCancel}>キャンセル</button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={creating}
                >
                  {creating ? '作成中...' : '作成する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
