import { useState, useEffect, useCallback } from 'react';
import {
  GetWorkflows,
  CreateWorkflow,
  DeleteWorkflow,
  GetWorkflowsSubscription,
  GetWorkflowsPlans,
  CreateWorkflowsSubscription,
  DeleteWorkflowsSubscription,
} from '../../wailsjs/go/main/App';
import { workflows } from '../../wailsjs/go/models';
import { useSearch } from '../hooks/useSearch';
import { useGlobalReload } from '../hooks/useGlobalReload';
import { SearchBar } from './SearchBar';

interface WorkflowsListProps {
  profile: string;
  onSelectWorkflow: (id: string) => void;
}

const DEFAULT_RUNBOOK = `meta:
  description: sample workflow
steps:
  done:
    return: "hello"
`;

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

export function WorkflowsList({ profile, onSelectWorkflow }: WorkflowsListProps) {
  const [items, setItems] = useState<workflows.WorkflowInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<workflows.WorkflowInfo | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [subscription, setSubscription] = useState<workflows.SubscriptionInfo | null>(null);
  const [plans, setPlans] = useState<workflows.PlanInfo[]>([]);
  const [showSubscribe, setShowSubscribe] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [subscribing, setSubscribing] = useState(false);
  const [subscribeError, setSubscribeError] = useState<string | null>(null);
  const [unsubscribing, setUnsubscribing] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newRunbook, setNewRunbook] = useState(DEFAULT_RUNBOOK);
  const [newPublish, setNewPublish] = useState(true);
  const [newLogging, setNewLogging] = useState(true);
  const [newConcurrencyMode, setNewConcurrencyMode] = useState('');
  const [newTags, setNewTags] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const {
    searchQuery,
    setSearchQuery,
    isSearching,
    searchInputRef,
    filteredItems: filteredWorkflows,
    closeSearch,
  } = useSearch(items, (wf, query) =>
    wf.name.toLowerCase().includes(query) ||
    wf.description?.toLowerCase().includes(query) ||
    wf.tags?.some(tag => tag.toLowerCase().includes(query)) ||
    wf.id.includes(query)
  );

  const loadData = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const [list, sub] = await Promise.all([
        GetWorkflows(profile),
        GetWorkflowsSubscription(profile),
      ]);
      setItems(list || []);
      setSubscription(sub);
    } catch (err) {
      console.error('[WorkflowsList] loadData error:', err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useGlobalReload(loadData);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return;
    const target = confirmDelete;
    setConfirmDelete(null);
    setDeleting(target.id);
    try {
      await DeleteWorkflow(profile, target.id);
      await loadData();
    } catch (e) {
      alert(`削除に失敗しました: ${e}`);
    } finally {
      setDeleting(null);
    }
  };

  const handleCreateOpen = () => {
    setNewName('');
    setNewDescription('');
    setNewRunbook(DEFAULT_RUNBOOK);
    setNewPublish(true);
    setNewLogging(true);
    setNewConcurrencyMode('');
    setNewTags('');
    setCreateError(null);
    setShowCreate(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      const tags = newTags.split(',').map(t => t.trim()).filter(t => t);
      await CreateWorkflow(profile, newName, newDescription, newRunbook, newPublish, newLogging, newConcurrencyMode, tags);
      setShowCreate(false);
      await loadData();
    } catch (e) {
      setCreateError(String(e));
    } finally {
      setCreating(false);
    }
  };

  const handleSubscribeOpen = async () => {
    setSubscribeError(null);
    setSelectedPlanId(null);
    try {
      const list = await GetWorkflowsPlans(profile);
      setPlans(list || []);
      if (list && list.length > 0) setSelectedPlanId(list[0].id);
    } catch (e) {
      setSubscribeError(String(e));
    }
    setShowSubscribe(true);
  };

  const handleSubscribeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedPlanId === null) return;
    setSubscribing(true);
    setSubscribeError(null);
    try {
      await CreateWorkflowsSubscription(profile, selectedPlanId);
      setShowSubscribe(false);
      await loadData();
    } catch (e) {
      setSubscribeError(String(e));
    } finally {
      setSubscribing(false);
    }
  };

  const handleUnsubscribe = async () => {
    if (!confirm('サブスクリプションを解約しますか? ワークフローの実行ができなくなります。')) return;
    setUnsubscribing(true);
    try {
      await DeleteWorkflowsSubscription(profile);
      await loadData();
    } catch (e) {
      alert(`解約に失敗しました: ${e}`);
    } finally {
      setUnsubscribing(false);
    }
  };

  return (
    <>
      <div className="header">
        <h2>ワークフロー</h2>
        <button className="btn btn-primary btn-small" onClick={handleCreateOpen} disabled={!subscription?.subscribed}>+ ワークフロー作成</button>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem', background: '#2a2a2a', borderRadius: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h4 style={{ color: '#00adb5', margin: '0 0 0.5rem 0' }}>サブスクリプション</h4>
            {subscription?.subscribed ? (
              <div style={{ fontSize: '0.85rem' }}>
                プラン: {subscription.planName}(契約開始: {formatDate(subscription.activateFrom)})
              </div>
            ) : (
              <div style={{ fontSize: '0.85rem', color: '#888' }}>未契約です。ワークフローを作成するにはプランの契約が必要です</div>
            )}
          </div>
          {subscription?.subscribed ? (
            <button className="btn btn-danger btn-small" onClick={handleUnsubscribe} disabled={unsubscribing}>
              {unsubscribing ? '解約中...' : '解約する'}
            </button>
          ) : (
            <button className="btn btn-secondary btn-small" onClick={handleSubscribeOpen}>契約する</button>
          )}
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
      ) : filteredWorkflows.length === 0 ? (
        <div className="empty-state">
          {searchQuery ? `「${searchQuery}」に一致するワークフローがありません` : 'ワークフローがありません'}
        </div>
      ) : (
        filteredWorkflows.map((wf) => (
          <div key={wf.id} className="card" onClick={() => onSelectWorkflow(wf.id)} style={{ cursor: 'pointer' }}>
            <div className="card-header">
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div className="card-title">{wf.name}</div>
                  <span className={`status ${wf.publish ? 'up' : 'down'}`} style={{ padding: '2px 6px', fontSize: '0.65rem' }}>
                    {wf.publish ? '公開' : '非公開'}
                  </span>
                </div>
                <div className="card-subtitle" style={{ marginTop: '2px' }}>
                  作成日: {formatDate(wf.createdAt)}
                </div>
                {wf.description && (
                  <div style={{ marginTop: '0.25rem', fontSize: '0.8rem', color: '#888' }}>
                    {wf.description}
                  </div>
                )}
                {wf.tags && wf.tags.length > 0 && (
                  <div className="tags" style={{ marginTop: '0.25rem', display: 'flex', gap: '0.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    {wf.tags.map(tag => (
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
                ID: {wf.id}
                <button
                  className="btn btn-danger btn-small"
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmDelete(wf);
                  }}
                  disabled={deleting === wf.id}
                  title="削除"
                >
                  {deleting === wf.id ? '削除中...' : '削除'}
                </button>
              </div>
            </div>
          </div>
        ))
      )}

      {confirmDelete && (
        <div className="confirm-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <p>ワークフロー「{confirmDelete.name}」を削除しますか？</p>
            <p className="confirm-warning">この操作は取り消せません。</p>
            <div className="confirm-actions">
              <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>キャンセル</button>
              <button className="btn btn-danger" onClick={handleDeleteConfirm}>削除する</button>
            </div>
          </div>
        </div>
      )}

      {showSubscribe && (
        <div className="modal-overlay" onClick={() => setShowSubscribe(false)} style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
            backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
            padding: '20px', minWidth: '320px', maxWidth: '420px',
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>プランを契約する</h3>
            <form onSubmit={handleSubscribeSubmit}>
              <div className="form-group">
                <label>プラン<span className="required-mark">*</span></label>
                <select
                  value={selectedPlanId ?? ''}
                  onChange={(e) => setSelectedPlanId(Number(e.target.value))}
                  required
                >
                  {plans.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}(月額 {p.basePrice}円、含まれるステップ数 {p.includedSteps})
                    </option>
                  ))}
                </select>
              </div>
              {subscribeError && (
                <div style={{ marginBottom: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>
                  エラー: {subscribeError}
                </div>
              )}
              <div className="confirm-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowSubscribe(false)}>キャンセル</button>
                <button type="submit" className="btn btn-primary" disabled={subscribing || selectedPlanId === null}>
                  {subscribing ? '契約中...' : '契約する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)} style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
            backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
            padding: '20px', minWidth: '320px', maxWidth: '560px',
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>ワークフロー作成</h3>
            <form onSubmit={handleCreateSubmit}>
              <div className="form-group">
                <label>名前<span className="required-mark">*</span></label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="my-workflow"
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
                />
              </div>
              <div className="form-group">
                <label>Runbook(YAML)<span className="required-mark">*</span></label>
                <textarea
                  value={newRunbook}
                  onChange={(e) => setNewRunbook(e.target.value)}
                  rows={10}
                  style={{ fontFamily: 'monospace', fontSize: '0.8rem', width: '100%' }}
                  required
                />
              </div>
              <div className="form-group">
                <label>並行実行モード</label>
                <select
                  value={newConcurrencyMode}
                  onChange={(e) => setNewConcurrencyMode(e.target.value)}
                >
                  <option value="">既定値</option>
                  <option value="parallel">parallel(並列実行を許可)</option>
                  <option value="lock">lock(実行中は新規実行を拒否)</option>
                  <option value="queue">queue(実行中は新規実行をキューイング)</option>
                </select>
              </div>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'normal' }}>
                  <input type="checkbox" checked={newPublish} onChange={(e) => setNewPublish(e.target.checked)} />
                  公開する
                </label>
              </div>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'normal' }}>
                  <input type="checkbox" checked={newLogging} onChange={(e) => setNewLogging(e.target.checked)} />
                  ログを有効にする
                </label>
              </div>
              <div className="form-group">
                <label>タグ</label>
                <input
                  type="text"
                  value={newTags}
                  onChange={(e) => setNewTags(e.target.value)}
                  placeholder="任意(カンマ区切り)"
                />
              </div>
              {createError && (
                <div style={{ marginBottom: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>
                  エラー: {createError}
                </div>
              )}
              <div className="confirm-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>キャンセル</button>
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
