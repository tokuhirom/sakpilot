import { useState, useEffect, useCallback } from 'react';
import {
  GetWorkflow,
  UpdateWorkflow,
  GetWorkflowRevisions,
  CreateWorkflowRevision,
  UpdateWorkflowRevisionAlias,
  DeleteWorkflowRevisionAlias,
  GetWorkflowExecutions,
  CreateWorkflowExecution,
  CancelWorkflowExecution,
  DeleteWorkflowExecution,
  GetWorkflowExecutionHistory,
} from '../../wailsjs/go/main/App';
import { workflows } from '../../wailsjs/go/models';
import { useGlobalReload } from '../hooks/useGlobalReload';

interface WorkflowDetailProps {
  profile: string;
  workflowId: string;
}

type SubPage = 'revisions' | 'executions';

const TAB_LABEL: Record<SubPage, string> = {
  revisions: 'リビジョン',
  executions: '実行',
};

const formatDate = (dateString: string) => {
  if (!dateString) return '-';
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

const getExecutionStatusColor = (status: string) => {
  switch (status) {
    case 'Succeeded': return 'up';
    case 'Failed':
    case 'Canceled': return 'down';
    default: return '';
  }
};

interface RevisionFormState {
  runbook: string;
  revisionAlias: string;
}

interface AliasFormState {
  revisionId: number;
  revisionAlias: string;
}

interface ExecutionFormState {
  revisionId: number | null;
  revisionAlias: string;
  args: string;
  name: string;
}

const emptyExecutionForm: ExecutionFormState = { revisionId: null, revisionAlias: '', args: '', name: '' };

export function WorkflowDetail({ profile, workflowId }: WorkflowDetailProps) {
  const [workflow, setWorkflow] = useState<workflows.WorkflowInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [subPage, setSubPage] = useState<SubPage>('revisions');

  const [revisions, setRevisions] = useState<workflows.RevisionInfo[]>([]);
  const [executions, setExecutions] = useState<workflows.ExecutionInfo[]>([]);

  const [editingBasic, setEditingBasic] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [descriptionInput, setDescriptionInput] = useState('');
  const [publishInput, setPublishInput] = useState(true);
  const [loggingInput, setLoggingInput] = useState(true);
  const [concurrencyModeInput, setConcurrencyModeInput] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [savingBasic, setSavingBasic] = useState(false);
  const [basicError, setBasicError] = useState<string | null>(null);

  const [revisionForm, setRevisionForm] = useState<RevisionFormState | null>(null);
  const [savingRevision, setSavingRevision] = useState(false);
  const [revisionError, setRevisionError] = useState<string | null>(null);

  const [aliasForm, setAliasForm] = useState<AliasFormState | null>(null);
  const [savingAlias, setSavingAlias] = useState(false);
  const [aliasError, setAliasError] = useState<string | null>(null);

  const [executionForm, setExecutionForm] = useState<ExecutionFormState | null>(null);
  const [savingExecution, setSavingExecution] = useState(false);
  const [executionError, setExecutionError] = useState<string | null>(null);

  const [historyTarget, setHistoryTarget] = useState<workflows.ExecutionInfo | null>(null);
  const [history, setHistory] = useState<workflows.ExecutionHistoryInfo[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [runningAction, setRunningAction] = useState<string | null>(null);
  const [confirmDeleteAlias, setConfirmDeleteAlias] = useState<number | null>(null);
  const [confirmDeleteExecution, setConfirmDeleteExecution] = useState<workflows.ExecutionInfo | null>(null);

  const loadData = useCallback(async () => {
    if (!profile || !workflowId) return;
    setLoading(true);
    try {
      const [wf, revs, execs] = await Promise.all([
        GetWorkflow(profile, workflowId),
        GetWorkflowRevisions(profile, workflowId),
        GetWorkflowExecutions(profile, workflowId),
      ]);
      setWorkflow(wf);
      setRevisions(revs || []);
      setExecutions(execs || []);
    } catch (err) {
      console.error('[WorkflowDetail] loadData error:', err);
    } finally {
      setLoading(false);
    }
  }, [profile, workflowId]);

  useGlobalReload(loadData);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleBasicEditStart = () => {
    if (!workflow) return;
    setNameInput(workflow.name);
    setDescriptionInput(workflow.description || '');
    setPublishInput(workflow.publish);
    setLoggingInput(workflow.logging);
    setConcurrencyModeInput(workflow.concurrencyMode || '');
    setTagsInput((workflow.tags || []).join(', '));
    setBasicError(null);
    setEditingBasic(true);
  };

  const handleBasicSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBasic(true);
    setBasicError(null);
    try {
      const tags = tagsInput.split(',').map(t => t.trim()).filter(t => t);
      const updated = await UpdateWorkflow(profile, workflowId, nameInput, descriptionInput, publishInput, loggingInput, concurrencyModeInput, tags);
      setWorkflow(updated);
      setEditingBasic(false);
    } catch (e) {
      setBasicError(String(e));
    } finally {
      setSavingBasic(false);
    }
  };

  const handleRevisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revisionForm) return;
    setSavingRevision(true);
    setRevisionError(null);
    try {
      await CreateWorkflowRevision(profile, workflowId, revisionForm.runbook, revisionForm.revisionAlias);
      setRevisionForm(null);
      await loadData();
    } catch (e) {
      setRevisionError(String(e));
    } finally {
      setSavingRevision(false);
    }
  };

  const handleAliasSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aliasForm) return;
    setSavingAlias(true);
    setAliasError(null);
    try {
      await UpdateWorkflowRevisionAlias(profile, workflowId, aliasForm.revisionId, aliasForm.revisionAlias);
      setAliasForm(null);
      await loadData();
    } catch (e) {
      setAliasError(String(e));
    } finally {
      setSavingAlias(false);
    }
  };

  const handleDeleteAliasConfirm = async () => {
    if (confirmDeleteAlias === null) return;
    const revisionId = confirmDeleteAlias;
    setConfirmDeleteAlias(null);
    setRunningAction(`delete-alias-${revisionId}`);
    try {
      await DeleteWorkflowRevisionAlias(profile, workflowId, revisionId);
      await loadData();
    } catch (e) {
      alert(`Alias削除に失敗しました: ${e}`);
    } finally {
      setRunningAction(null);
    }
  };

  const handleExecutionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!executionForm) return;
    setSavingExecution(true);
    setExecutionError(null);
    try {
      await CreateWorkflowExecution(
        profile, workflowId,
        executionForm.revisionId ?? 0,
        executionForm.revisionAlias,
        executionForm.args,
        executionForm.name,
      );
      setExecutionForm(null);
      await loadData();
    } catch (e) {
      setExecutionError(String(e));
    } finally {
      setSavingExecution(false);
    }
  };

  const handleCancelExecution = async (executionId: string) => {
    setRunningAction(`cancel-${executionId}`);
    try {
      await CancelWorkflowExecution(profile, workflowId, executionId);
      await loadData();
    } catch (e) {
      alert(`キャンセルに失敗しました: ${e}`);
    } finally {
      setRunningAction(null);
    }
  };

  const handleDeleteExecutionConfirm = async () => {
    if (!confirmDeleteExecution) return;
    const target = confirmDeleteExecution;
    setConfirmDeleteExecution(null);
    setRunningAction(`delete-exec-${target.executionId}`);
    try {
      await DeleteWorkflowExecution(profile, workflowId, target.executionId);
      await loadData();
    } catch (e) {
      alert(`削除に失敗しました: ${e}`);
    } finally {
      setRunningAction(null);
    }
  };

  const handleShowHistory = async (exec: workflows.ExecutionInfo) => {
    setHistoryTarget(exec);
    setHistoryLoading(true);
    try {
      const list = await GetWorkflowExecutionHistory(profile, workflowId, exec.executionId);
      setHistory(list || []);
    } catch (err) {
      console.error('[WorkflowDetail] loadHistory error:', err);
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  if (loading && !workflow) return <div className="loading">読み込み中...</div>;
  if (!workflow) return <div className="empty-state">ワークフロー情報が見つかりません</div>;

  return (
    <div className="workflow-detail">
      <div className="header">
        <h2>ワークフロー詳細: {workflow.name}</h2>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem', background: '#2a2a2a', borderRadius: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h4 style={{ color: '#00adb5', margin: 0 }}>基本情報</h4>
          {!editingBasic && (
            <button className="btn btn-secondary btn-small" onClick={handleBasicEditStart}>編集</button>
          )}
        </div>
        {editingBasic ? (
          <form onSubmit={handleBasicSave}>
            <div className="form-group">
              <label>名前<span className="required-mark">*</span></label>
              <input type="text" value={nameInput} onChange={(e) => setNameInput(e.target.value)} autoFocus required />
            </div>
            <div className="form-group">
              <label>説明</label>
              <input type="text" value={descriptionInput} onChange={(e) => setDescriptionInput(e.target.value)} placeholder="任意" />
            </div>
            <div className="form-group">
              <label>並行実行モード</label>
              <select value={concurrencyModeInput} onChange={(e) => setConcurrencyModeInput(e.target.value)}>
                <option value="">既定値</option>
                <option value="parallel">parallel(並列実行を許可)</option>
                <option value="lock">lock(実行中は新規実行を拒否)</option>
                <option value="queue">queue(実行中は新規実行をキューイング)</option>
              </select>
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'normal' }}>
                <input type="checkbox" checked={publishInput} onChange={(e) => setPublishInput(e.target.checked)} />
                公開する
              </label>
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'normal' }}>
                <input type="checkbox" checked={loggingInput} onChange={(e) => setLoggingInput(e.target.checked)} />
                ログを有効にする
              </label>
            </div>
            <div className="form-group">
              <label>タグ</label>
              <input type="text" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="任意(カンマ区切り)" />
            </div>
            {basicError && (
              <div style={{ marginBottom: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>エラー: {basicError}</div>
            )}
            <div className="confirm-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setEditingBasic(false)} disabled={savingBasic}>キャンセル</button>
              <button type="submit" className="btn btn-primary" disabled={savingBasic}>{savingBasic ? '保存中...' : '保存する'}</button>
            </div>
          </form>
        ) : (
          <table style={{ borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>ID</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{workflow.id}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>説明</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{workflow.description || '-'}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>公開状態</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>
                  <span className={`status ${workflow.publish ? 'up' : 'down'}`}>{workflow.publish ? '公開' : '非公開'}</span>
                </td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>ログ</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{workflow.logging ? '有効' : '無効'}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>並行実行モード</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{workflow.concurrencyMode || '既定値'}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>作成日</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{formatDate(workflow.createdAt)}</td>
              </tr>
              {workflow.tags && workflow.tags.length > 0 && (
                <tr>
                  <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>タグ</td>
                  <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>
                    <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                      {workflow.tags.map(tag => (
                        <span key={tag} className="tag" style={{
                          backgroundColor: '#e2e8f0', padding: '0px 6px', borderRadius: '3px',
                          fontSize: '0.65rem', color: '#4a5568', border: '1px solid #cbd5e0'
                        }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem' }}>
        {(Object.keys(TAB_LABEL) as SubPage[]).map(key => (
          <button
            key={key}
            className={`btn ${subPage === key ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setSubPage(key)}
          >
            {TAB_LABEL[key]}
          </button>
        ))}
      </div>

      {subPage === 'revisions' && (
        <>
          <div className="header">
            <h3 style={{ margin: 0 }}>リビジョン一覧</h3>
            <button
              className="btn btn-primary btn-small"
              onClick={() => { setRevisionError(null); setRevisionForm({ runbook: revisions[0]?.runbook || '', revisionAlias: '' }); }}
            >
              + リビジョン作成
            </button>
          </div>
          {revisions.length === 0 ? (
            <div className="empty-state">リビジョンがありません</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>リビジョン番号</th>
                  <th>Alias</th>
                  <th>作成日</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {revisions.map(r => (
                  <tr key={r.revisionId}>
                    <td style={{ textAlign: 'left' }}>{r.revisionId}</td>
                    <td style={{ textAlign: 'left' }}>{r.revisionAlias || '-'}</td>
                    <td style={{ textAlign: 'left' }}>{formatDate(r.createdAt)}</td>
                    <td>
                      <button
                        className="btn btn-secondary btn-small"
                        style={{ marginRight: '0.5rem' }}
                        onClick={() => { setAliasError(null); setAliasForm({ revisionId: r.revisionId, revisionAlias: r.revisionAlias }); }}
                      >
                        Alias編集
                      </button>
                      <button
                        className="btn btn-danger btn-small"
                        onClick={() => setConfirmDeleteAlias(r.revisionId)}
                        disabled={!r.revisionAlias || runningAction === `delete-alias-${r.revisionId}`}
                      >
                        {runningAction === `delete-alias-${r.revisionId}` ? '削除中...' : 'Alias削除'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {subPage === 'executions' && (
        <>
          <div className="header">
            <h3 style={{ margin: 0 }}>実行一覧</h3>
            <button
              className="btn btn-primary btn-small"
              onClick={() => { setExecutionError(null); setExecutionForm({ ...emptyExecutionForm }); }}
            >
              + 実行する
            </button>
          </div>
          {executions.length === 0 ? (
            <div className="empty-state">実行履歴がありません</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>実行ID</th>
                  <th>ステータス</th>
                  <th>リビジョン</th>
                  <th>作成日</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {executions.map(exec => (
                  <tr key={exec.executionId}>
                    <td style={{ textAlign: 'left' }}>{exec.executionId}</td>
                    <td style={{ textAlign: 'left' }}>
                      <span className={`status ${getExecutionStatusColor(exec.status)}`}>{exec.status}</span>
                    </td>
                    <td style={{ textAlign: 'left' }}>{exec.revision}{exec.revisionAlias ? `(${exec.revisionAlias})` : ''}</td>
                    <td style={{ textAlign: 'left' }}>{formatDate(exec.createdAt)}</td>
                    <td>
                      <button
                        className="btn btn-secondary btn-small"
                        style={{ marginRight: '0.5rem' }}
                        onClick={() => handleShowHistory(exec)}
                      >
                        履歴
                      </button>
                      <button
                        className="btn btn-secondary btn-small"
                        style={{ marginRight: '0.5rem' }}
                        onClick={() => handleCancelExecution(exec.executionId)}
                        disabled={(exec.status !== 'Queued' && exec.status !== 'Running') || runningAction === `cancel-${exec.executionId}`}
                      >
                        {runningAction === `cancel-${exec.executionId}` ? '処理中...' : 'キャンセル'}
                      </button>
                      <button
                        className="btn btn-danger btn-small"
                        onClick={() => setConfirmDeleteExecution(exec)}
                        disabled={runningAction === `delete-exec-${exec.executionId}`}
                      >
                        {runningAction === `delete-exec-${exec.executionId}` ? '削除中...' : '削除'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {revisionForm && (
        <div className="modal-overlay" onClick={() => setRevisionForm(null)} style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
            backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
            padding: '20px', minWidth: '320px', maxWidth: '560px',
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>リビジョン作成</h3>
            <form onSubmit={handleRevisionSubmit}>
              <div className="form-group">
                <label>Runbook(YAML)<span className="required-mark">*</span></label>
                <textarea
                  value={revisionForm.runbook}
                  onChange={(e) => setRevisionForm({ ...revisionForm, runbook: e.target.value })}
                  rows={10}
                  style={{ fontFamily: 'monospace', fontSize: '0.8rem', width: '100%' }}
                  autoFocus
                  required
                />
              </div>
              <div className="form-group">
                <label>Alias</label>
                <input
                  type="text"
                  value={revisionForm.revisionAlias}
                  onChange={(e) => setRevisionForm({ ...revisionForm, revisionAlias: e.target.value })}
                  placeholder="任意(例: v2)"
                />
              </div>
              {revisionError && (
                <div style={{ marginBottom: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>エラー: {revisionError}</div>
              )}
              <div className="confirm-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setRevisionForm(null)}>キャンセル</button>
                <button type="submit" className="btn btn-primary" disabled={savingRevision}>
                  {savingRevision ? '作成中...' : '作成する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {aliasForm && (
        <div className="modal-overlay" onClick={() => setAliasForm(null)} style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
            backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
            padding: '20px', minWidth: '320px', maxWidth: '420px',
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>リビジョン{aliasForm.revisionId}のAlias編集</h3>
            <form onSubmit={handleAliasSubmit}>
              <div className="form-group">
                <label>Alias<span className="required-mark">*</span></label>
                <input
                  type="text"
                  value={aliasForm.revisionAlias}
                  onChange={(e) => setAliasForm({ ...aliasForm, revisionAlias: e.target.value })}
                  autoFocus
                  required
                />
              </div>
              {aliasError && (
                <div style={{ marginBottom: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>エラー: {aliasError}</div>
              )}
              <div className="confirm-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setAliasForm(null)}>キャンセル</button>
                <button type="submit" className="btn btn-primary" disabled={savingAlias}>
                  {savingAlias ? '保存中...' : '保存する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {executionForm && (
        <div className="modal-overlay" onClick={() => setExecutionForm(null)} style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
            backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
            padding: '20px', minWidth: '320px', maxWidth: '480px',
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>ワークフローを実行</h3>
            <form onSubmit={handleExecutionSubmit}>
              <div className="form-group">
                <label>リビジョン</label>
                <select
                  value={executionForm.revisionId ?? ''}
                  onChange={(e) => setExecutionForm({ ...executionForm, revisionId: e.target.value ? Number(e.target.value) : null })}
                >
                  <option value="">最新リビジョン(既定)</option>
                  {revisions.map(r => (
                    <option key={r.revisionId} value={r.revisionId}>
                      #{r.revisionId}{r.revisionAlias ? `(${r.revisionAlias})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Revision Alias</label>
                <input
                  type="text"
                  value={executionForm.revisionAlias}
                  onChange={(e) => setExecutionForm({ ...executionForm, revisionAlias: e.target.value })}
                  placeholder="任意(リビジョン選択と併用不可)"
                />
              </div>
              <div className="form-group">
                <label>実行名</label>
                <input
                  type="text"
                  value={executionForm.name}
                  onChange={(e) => setExecutionForm({ ...executionForm, name: e.target.value })}
                  placeholder="任意"
                />
              </div>
              <div className="form-group">
                <label>Args(JSON)</label>
                <textarea
                  value={executionForm.args}
                  onChange={(e) => setExecutionForm({ ...executionForm, args: e.target.value })}
                  rows={4}
                  style={{ fontFamily: 'monospace', fontSize: '0.8rem', width: '100%' }}
                  placeholder='任意(例: {"key":"value"})'
                />
              </div>
              {executionError && (
                <div style={{ marginBottom: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>エラー: {executionError}</div>
              )}
              <div className="confirm-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setExecutionForm(null)}>キャンセル</button>
                <button type="submit" className="btn btn-primary" disabled={savingExecution}>
                  {savingExecution ? '実行中...' : '実行する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {historyTarget && (
        <div className="modal-overlay" onClick={() => setHistoryTarget(null)} style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
            backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
            padding: '20px', minWidth: '360px', maxWidth: '640px', maxHeight: '80vh', overflowY: 'auto',
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>実行 {historyTarget.executionId} の履歴</h3>
            {historyLoading ? (
              <div className="loading">読み込み中...</div>
            ) : history.length === 0 ? (
              <div className="empty-state">履歴がありません</div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>種別</th>
                    <th>時刻</th>
                    <th>Meta</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h, i) => (
                    <tr key={i}>
                      <td style={{ textAlign: 'left' }}>{h.type}</td>
                      <td style={{ textAlign: 'left' }}>{formatDate(h.createdAt)}</td>
                      <td style={{ textAlign: 'left', fontFamily: 'monospace', fontSize: '0.75rem' }}>{h.meta}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="confirm-actions">
              <button className="btn btn-secondary" onClick={() => setHistoryTarget(null)}>閉じる</button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteAlias !== null && (
        <div className="confirm-overlay" onClick={() => setConfirmDeleteAlias(null)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <p>リビジョン{confirmDeleteAlias}のAliasを削除しますか？</p>
            <div className="confirm-actions">
              <button className="btn btn-secondary" onClick={() => setConfirmDeleteAlias(null)}>キャンセル</button>
              <button className="btn btn-danger" onClick={handleDeleteAliasConfirm}>削除する</button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteExecution && (
        <div className="confirm-overlay" onClick={() => setConfirmDeleteExecution(null)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <p>実行「{confirmDeleteExecution.executionId}」を削除しますか？</p>
            <p className="confirm-warning">この操作は取り消せません。</p>
            <div className="confirm-actions">
              <button className="btn btn-secondary" onClick={() => setConfirmDeleteExecution(null)}>キャンセル</button>
              <button className="btn btn-danger" onClick={handleDeleteExecutionConfirm}>削除する</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
