import { Fragment, useState, useEffect, useCallback } from 'react';
import {
  GetObjectStoragePermissions,
  CreateObjectStoragePermission,
  UpdateObjectStoragePermission,
  DeleteObjectStoragePermission,
  GetObjectStoragePermissionAccessKeys,
  CreateObjectStoragePermissionAccessKey,
  DeleteObjectStoragePermissionAccessKey,
} from '../../wailsjs/go/main/App';
import { sakura } from '../../wailsjs/go/models';

interface ObjectStoragePermissionsProps {
  profile: string;
  siteId: string;
  bucketNames: string[];
  onClose: () => void;
}

type ControlDraft = { bucketName: string; canRead: boolean; canWrite: boolean };

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

export function ObjectStoragePermissions({ profile, siteId, bucketNames, onClose }: ObjectStoragePermissionsProps) {
  const [permissions, setPermissions] = useState<sakura.PermissionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [controls, setControls] = useState<ControlDraft[]>([{ bucketName: '', canRead: true, canWrite: false }]);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [confirmDelete, setConfirmDelete] = useState<sakura.PermissionInfo | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [accessKeys, setAccessKeys] = useState<sakura.PermissionAccessKeyInfo[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [creatingKey, setCreatingKey] = useState(false);
  const [newKey, setNewKey] = useState<sakura.PermissionAccessKeyCreated | null>(null);
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<sakura.PermissionAccessKeyInfo | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await GetObjectStoragePermissions(profile, siteId);
      setPermissions(list || []);
    } catch (err) {
      console.error('[ObjectStoragePermissions] load error:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [profile, siteId]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreateForm = () => {
    setEditingId(null);
    setDisplayName('');
    setControls([{ bucketName: bucketNames[0] || '', canRead: true, canWrite: false }]);
    setFormError(null);
    setShowForm(true);
  };

  const openEditForm = (p: sakura.PermissionInfo) => {
    setEditingId(p.id);
    setDisplayName(p.displayName);
    setControls(p.bucketControls.map((c) => ({ bucketName: c.bucketName, canRead: c.canRead, canWrite: c.canWrite })));
    setFormError(null);
    setShowForm(true);
  };

  const closeForm = () => setShowForm(false);

  const updateControl = (index: number, patch: Partial<ControlDraft>) => {
    setControls((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  };

  const addControlRow = () => {
    setControls((prev) => [...prev, { bucketName: bucketNames[0] || '', canRead: true, canWrite: false }]);
  };

  const removeControlRow = (index: number) => {
    setControls((prev) => prev.filter((_, i) => i !== index));
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();

    setFormBusy(true);
    setFormError(null);
    try {
      if (editingId) {
        await UpdateObjectStoragePermission(profile, siteId, editingId, displayName, controls);
      } else {
        await CreateObjectStoragePermission(profile, siteId, displayName, controls);
      }
      setShowForm(false);
      await load();
    } catch (err) {
      console.error('[ObjectStoragePermissions] submit error:', err);
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setFormBusy(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return;
    const target = confirmDelete;
    setConfirmDelete(null);
    setDeletingId(target.id);
    try {
      await DeleteObjectStoragePermission(profile, siteId, target.id);
      if (expandedId === target.id) setExpandedId(null);
      await load();
    } catch (err) {
      alert(`削除に失敗しました: ${err}`);
    } finally {
      setDeletingId(null);
    }
  };

  const loadAccessKeys = useCallback(async (permissionId: string) => {
    setLoadingKeys(true);
    try {
      const keys = await GetObjectStoragePermissionAccessKeys(profile, siteId, permissionId);
      setAccessKeys(keys || []);
    } catch (err) {
      console.error('[ObjectStoragePermissions] loadAccessKeys error:', err);
      setAccessKeys([]);
    } finally {
      setLoadingKeys(false);
    }
  }, [profile, siteId]);

  const toggleExpand = async (p: sakura.PermissionInfo) => {
    if (expandedId === p.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(p.id);
    await loadAccessKeys(p.id);
  };

  const handleCreateKey = async () => {
    if (!expandedId) return;
    setCreatingKey(true);
    try {
      const created = await CreateObjectStoragePermissionAccessKey(profile, siteId, expandedId);
      setNewKey(created);
      await loadAccessKeys(expandedId);
    } catch (err) {
      alert(`アクセスキーの作成に失敗しました: ${err}`);
    } finally {
      setCreatingKey(false);
    }
  };

  const handleDeleteKeyConfirm = async () => {
    if (!expandedId || !confirmDeleteKey) return;
    const key = confirmDeleteKey;
    setConfirmDeleteKey(null);
    try {
      await DeleteObjectStoragePermissionAccessKey(profile, siteId, expandedId, key.id);
      await loadAccessKeys(expandedId);
    } catch (err) {
      alert(`削除に失敗しました: ${err}`);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
        backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
        padding: '20px', minWidth: '520px', maxWidth: '680px', maxHeight: '80vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>パーミッション管理</h3>
          <button className="btn btn-primary btn-small" onClick={openCreateForm}>+ 作成</button>
        </div>

        {error && (
          <div style={{ marginBottom: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>
            エラー: {error}
          </div>
        )}

        {loading ? (
          <div className="loading">読み込み中...</div>
        ) : permissions.length === 0 ? (
          <div className="empty-state">パーミッションがありません</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>名前</th>
                <th>バケット制御</th>
                <th>作成日時</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {permissions.map((p) => (
                <Fragment key={p.id}>
                  <tr onClick={() => toggleExpand(p)} style={{ cursor: 'pointer' }}>
                    <td style={{ color: '#00adb5', fontWeight: 'bold' }}>{p.displayName}</td>
                    <td style={{ fontSize: '0.8rem' }}>
                      {p.bucketControls.map((c) => `${c.bucketName}(${c.canRead ? 'R' : ''}${c.canWrite ? 'W' : ''})`).join(', ')}
                    </td>
                    <td>{formatDate(p.createdAt)}</td>
                    <td style={{ textAlign: 'left', display: 'flex', gap: '0.25rem' }}>
                      <button className="btn btn-secondary btn-small" onClick={(e) => { e.stopPropagation(); openEditForm(p); }}>編集</button>
                      <button
                        className="btn btn-danger btn-small"
                        onClick={(e) => { e.stopPropagation(); setConfirmDelete(p); }}
                        disabled={deletingId === p.id}
                      >
                        {deletingId === p.id ? '削除中...' : '削除'}
                      </button>
                    </td>
                  </tr>
                  {expandedId === p.id && (
                    <tr>
                      <td colSpan={4} style={{ backgroundColor: '#0f0f1a' }}>
                        <div style={{ padding: '0.75rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <span style={{ fontSize: '0.85rem', color: '#888' }}>アクセスキー</span>
                            <button className="btn btn-secondary btn-small" onClick={handleCreateKey} disabled={creatingKey}>
                              {creatingKey ? '作成中...' : '+ 新規作成'}
                            </button>
                          </div>
                          {loadingKeys ? (
                            <div style={{ fontSize: '0.8rem', color: '#888' }}>読み込み中...</div>
                          ) : accessKeys.length === 0 ? (
                            <div style={{ fontSize: '0.8rem', color: '#888' }}>アクセスキーがありません</div>
                          ) : (
                            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                              {accessKeys.map((k) => (
                                <li key={k.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.25rem 0', fontSize: '0.8rem' }}>
                                  <span>{k.id} ({formatDate(k.createdAt)})</span>
                                  <button className="btn btn-danger btn-small" onClick={() => setConfirmDeleteKey(k)}>削除</button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}

        <div className="confirm-actions" style={{ marginTop: '1.25rem' }}>
          <button className="btn btn-secondary" onClick={onClose}>閉じる</button>
        </div>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={closeForm} style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1001,
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
            backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
            padding: '20px', minWidth: '420px', maxWidth: '520px',
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>{editingId ? 'パーミッション編集' : 'パーミッション作成'}</h3>
            <form onSubmit={submitForm}>
              <div className="form-group">
                <label>表示名<span className="required-mark">*</span></label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="読み取り専用アプリ"
                  required
                  autoFocus
                />
              </div>
              <label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '0.5rem' }}>バケット制御</label>
              {controls.map((c, i) => (
                <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <select
                    value={c.bucketName}
                    onChange={(e) => updateControl(i, { bucketName: e.target.value })}
                    required
                    style={{ flex: 1, padding: '0.4rem', fontSize: '0.85rem' }}
                  >
                    <option value="">バケットを選択 *</option>
                    {bucketNames.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                  <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <input type="checkbox" checked={c.canRead} onChange={(e) => updateControl(i, { canRead: e.target.checked })} />
                    読み取り
                  </label>
                  <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <input type="checkbox" checked={c.canWrite} onChange={(e) => updateControl(i, { canWrite: e.target.checked })} />
                    書き込み
                  </label>
                  <button type="button" className="btn btn-secondary btn-small" onClick={() => removeControlRow(i)} disabled={controls.length === 1}>×</button>
                </div>
              ))}
              <button type="button" className="btn btn-secondary btn-small" onClick={addControlRow} style={{ marginBottom: '1rem' }}>+ バケットを追加</button>

              {formError && (
                <div style={{ marginBottom: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>
                  エラー: {formError}
                </div>
              )}
              <div className="confirm-actions">
                <button type="button" className="btn btn-secondary" onClick={closeForm}>キャンセル</button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={formBusy}
                >
                  {formBusy ? '処理中...' : editingId ? '更新する' : '作成する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="confirm-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <p>パーミッション「{confirmDelete.displayName}」を削除しますか？</p>
            <p className="confirm-warning">この操作は取り消せません。発行済みのアクセスキーも合わせて削除されます。</p>
            <div className="confirm-actions">
              <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>キャンセル</button>
              <button className="btn btn-danger" onClick={handleDeleteConfirm}>削除する</button>
            </div>
          </div>
        </div>
      )}

      {newKey && (
        <div className="modal-overlay" onClick={() => setNewKey(null)} style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1001,
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
            backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
            padding: '20px', minWidth: '320px', maxWidth: '480px',
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>アクセスキーを作成しました</h3>
            <p style={{ color: '#ff6b6b', fontSize: '0.85rem' }}>
              シークレットキーはこの画面を閉じると二度と表示されません。必要であれば今すぐ控えてください。
            </p>
            <div className="form-group">
              <label>アクセスキーID</label>
              <input type="text" readOnly value={newKey.id} />
            </div>
            <div className="form-group">
              <label>シークレットキー</label>
              <input type="text" readOnly value={newKey.secret} />
            </div>
            <div className="confirm-actions">
              <button className="btn btn-primary" onClick={() => setNewKey(null)}>閉じる</button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteKey && (
        <div className="confirm-overlay" onClick={() => setConfirmDeleteKey(null)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <p>アクセスキー「{confirmDeleteKey.id}」を削除しますか？</p>
            <div className="confirm-actions">
              <button className="btn btn-secondary" onClick={() => setConfirmDeleteKey(null)}>キャンセル</button>
              <button className="btn btn-danger" onClick={handleDeleteKeyConfirm}>削除する</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
