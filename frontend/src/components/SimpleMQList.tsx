import { useState, useEffect, useCallback } from 'react';
import { GetSimpleMQQueues, DeleteSimpleMQQueue, CreateSimpleMQQueue } from '../../wailsjs/go/main/App';
import { simplemq } from '../../wailsjs/go/models';
import { useSearch } from '../hooks/useSearch';
import { useGlobalReload } from '../hooks/useGlobalReload';
import { SearchBar } from './SearchBar';

interface SimpleMQListProps {
  profile: string;
  onSelectQueue: (id: string) => void;
}

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

export function SimpleMQList({ profile, onSelectQueue }: SimpleMQListProps) {
  const [queues, setQueues] = useState<simplemq.QueueInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<simplemq.QueueInfo | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newTags, setNewTags] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const {
    searchQuery,
    setSearchQuery,
    isSearching,
    searchInputRef,
    filteredItems: filteredQueues,
    closeSearch,
  } = useSearch(queues, (queue, query) =>
    queue.name.toLowerCase().includes(query) ||
    queue.description?.toLowerCase().includes(query) ||
    queue.tags?.some(tag => tag.toLowerCase().includes(query)) ||
    queue.id.includes(query)
  );

  const loadQueues = useCallback(async () => {
    if (!profile) return;

    setLoading(true);
    try {
      const list = await GetSimpleMQQueues(profile);
      setQueues(list || []);
    } catch (err) {
      console.error('[SimpleMQList] loadQueues error:', err);
      setQueues([]);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useGlobalReload(loadQueues);

  useEffect(() => {
    loadQueues();
  }, [loadQueues]);

  const handleDeleteClick = (queue: simplemq.QueueInfo) => {
    setConfirmDelete(queue);
  };

  const handleDeleteCancel = () => {
    setConfirmDelete(null);
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return;
    const queue = confirmDelete;
    setConfirmDelete(null);
    setDeleting(queue.id);
    try {
      await DeleteSimpleMQQueue(profile, queue.id);
      await loadQueues();
    } catch (e) {
      alert(`削除に失敗しました: ${e}`);
    } finally {
      setDeleting(null);
    }
  };

  const handleCreateOpen = () => {
    setNewName('');
    setNewDescription('');
    setNewTags('');
    setCreateError(null);
    setShowCreate(true);
  };

  const handleCreateCancel = () => {
    setShowCreate(false);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      const tags = newTags.split(',').map(t => t.trim()).filter(t => t);
      await CreateSimpleMQQueue(profile, newName, newDescription, tags);
      setShowCreate(false);
      await loadQueues();
    } catch (e) {
      setCreateError(String(e));
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <div className="header">
        <h2>SimpleMQ</h2>
        <button className="btn btn-primary btn-small" onClick={handleCreateOpen}>+ Queue作成</button>
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
      ) : filteredQueues.length === 0 ? (
        <div className="empty-state">
          {searchQuery ? `「${searchQuery}」に一致するQueueがありません` : 'Queueがありません'}
        </div>
      ) : (
        filteredQueues.map((queue) => (
          <div key={queue.id} className="card" onClick={() => onSelectQueue(queue.id)} style={{ cursor: 'pointer' }}>
            <div className="card-header">
              <div style={{ flex: 1 }}>
                <div className="card-title">{queue.name}</div>
                <div className="card-subtitle" style={{ marginTop: '2px', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span>可視性タイムアウト: {queue.visibilityTimeoutSeconds}秒</span>
                  <span style={{ color: '#555' }}>|</span>
                  <span>メッセージ保持期間: {queue.expireSeconds}秒</span>
                  <span style={{ color: '#555' }}>|</span>
                  <span title={`作成日: ${formatDate(queue.createdAt)}`}>
                    作成日: {formatDate(queue.createdAt)}
                  </span>
                </div>
                {queue.description && (
                  <div style={{ marginTop: '0.25rem', fontSize: '0.8rem', color: '#888' }}>
                    {queue.description}
                  </div>
                )}
                {queue.tags && queue.tags.length > 0 && (
                  <div className="tags" style={{ marginTop: '0.25rem', display: 'flex', gap: '0.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    {queue.tags.map(tag => (
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
                ID: {queue.id}
                <button
                  className="btn btn-danger btn-small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteClick(queue);
                  }}
                  disabled={deleting === queue.id}
                  title="削除"
                >
                  {deleting === queue.id ? '削除中...' : '削除'}
                </button>
              </div>
            </div>
          </div>
        ))
      )}

      {confirmDelete && (
        <div className="confirm-overlay" onClick={handleDeleteCancel}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <p>Queue「{confirmDelete.name}」を削除しますか？</p>
            <p className="confirm-warning">この操作は取り消せません。Queue内の全てのメッセージも削除されます。</p>
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
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>Queue作成</h3>
            <form onSubmit={handleCreateSubmit}>
              <div className="form-group">
                <label>名前<span className="required-mark">*</span></label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="my-queue"
                  pattern="[0-9a-zA-Z]+(-[0-9a-zA-Z]+)*"
                  minLength={5}
                  maxLength={64}
                  title="半角英数字とハイフンのみ使用可能(5〜64文字、ハイフンは連続不可)"
                  autoFocus
                  required
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
                  placeholder="任意(カンマ区切り、例: env:prod,team:sre)"
                />
              </div>
              {createError && (
                <div style={{ marginBottom: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>
                  エラー: {createError}
                </div>
              )}
              <div className="confirm-actions">
                <button type="button" className="btn btn-secondary" onClick={handleCreateCancel}>キャンセル</button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
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
