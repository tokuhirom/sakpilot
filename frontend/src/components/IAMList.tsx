import { useState, useEffect, useCallback } from 'react';
import {
  GetIAMUsers,
  GetIAMGroups,
  GetIAMRoles,
  GetIAMIDRoles,
  GetIAMServicePrincipals,
  CreateIAMServicePrincipal,
  DeleteIAMServicePrincipal,
} from '../../wailsjs/go/main/App';
import { iam } from '../../wailsjs/go/models';
import { useGlobalReload } from '../hooks/useGlobalReload';

interface IAMListProps {
  profile: string;
  onSelectServicePrincipal: (id: number) => void;
}

type SubPage = 'users' | 'groups' | 'iamRoles' | 'idRoles' | 'servicePrincipals';

const TAB_LABEL: Record<SubPage, string> = {
  users: 'ユーザー',
  groups: 'グループ',
  iamRoles: 'IAMロール',
  idRoles: 'IDロール',
  servicePrincipals: 'サービスプリンシパル',
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString || '-';

  const Y = date.getFullYear();
  const M = String(date.getMonth() + 1).padStart(2, '0');
  const D = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');

  return `${Y}/${M}/${D} ${h}:${m}:${s}`;
};

export function IAMList({ profile, onSelectServicePrincipal }: IAMListProps) {
  const [subPage, setSubPage] = useState<SubPage>('users');
  const [users, setUsers] = useState<iam.UserInfo[]>([]);
  const [groups, setGroups] = useState<iam.GroupInfo[]>([]);
  const [iamRoles, setIamRoles] = useState<iam.IAMRoleInfo[]>([]);
  const [idRoles, setIdRoles] = useState<iam.IDRoleInfo[]>([]);
  const [servicePrincipals, setServicePrincipals] = useState<iam.ServicePrincipalInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [confirmDelete, setConfirmDelete] = useState<iam.ServicePrincipalInfo | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newProjectId, setNewProjectId] = useState('');
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      if (subPage === 'users') {
        setUsers((await GetIAMUsers(profile)) || []);
      } else if (subPage === 'groups') {
        setGroups((await GetIAMGroups(profile)) || []);
      } else if (subPage === 'iamRoles') {
        setIamRoles((await GetIAMRoles(profile)) || []);
      } else if (subPage === 'idRoles') {
        setIdRoles((await GetIAMIDRoles(profile)) || []);
      } else {
        setServicePrincipals((await GetIAMServicePrincipals(profile)) || []);
      }
    } catch (err) {
      console.error(`[IAMList] loadData error (${subPage}):`, err);
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [profile, subPage]);

  useGlobalReload(loadData);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const renderContent = () => {
    if (loading) return <div className="loading">読み込み中...</div>;
    if (error) return <div className="empty-state">読み込みに失敗しました: {error}</div>;

    if (subPage === 'users') {
      if (users.length === 0) return <div className="empty-state">ユーザーがありません</div>;
      return (
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>名前</th>
              <th>ユーザーコード</th>
              <th>メールアドレス</th>
              <th>ステータス</th>
              <th>説明</th>
              <th>作成日</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td>{u.id}</td>
                <td>{u.name}</td>
                <td>{u.code}</td>
                <td>{u.email || '-'}</td>
                <td>{u.status}</td>
                <td>{u.description || '-'}</td>
                <td>{formatDate(u.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (subPage === 'groups') {
      if (groups.length === 0) return <div className="empty-state">グループがありません</div>;
      return (
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>名前</th>
              <th>説明</th>
              <th>作成日</th>
            </tr>
          </thead>
          <tbody>
            {groups.map(g => (
              <tr key={g.id}>
                <td>{g.id}</td>
                <td>{g.name}</td>
                <td>{g.description || '-'}</td>
                <td>{formatDate(g.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (subPage === 'iamRoles') {
      if (iamRoles.length === 0) return <div className="empty-state">IAMロールがありません</div>;
      return (
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>名前</th>
              <th>カテゴリ</th>
              <th>付与可能な最低階層</th>
              <th>説明</th>
            </tr>
          </thead>
          <tbody>
            {iamRoles.map(r => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.name}</td>
                <td>{r.category}</td>
                <td>{r.lowestGrantableResource}</td>
                <td>{r.description || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (subPage === 'idRoles') {
      if (idRoles.length === 0) return <div className="empty-state">IDロールがありません</div>;
      return (
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>名前</th>
              <th>説明</th>
            </tr>
          </thead>
          <tbody>
            {idRoles.map(r => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.name}</td>
                <td>{r.description || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (servicePrincipals.length === 0) return <div className="empty-state">サービスプリンシパルがありません</div>;
    return (
      <table className="table">
        <thead>
          <tr>
            <th>ID</th>
            <th>名前</th>
            <th>プロジェクトID</th>
            <th>説明</th>
            <th>作成日</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {servicePrincipals.map(sp => (
            <tr key={sp.id} onClick={() => onSelectServicePrincipal(sp.id)} style={{ cursor: 'pointer' }}>
              <td>{sp.id}</td>
              <td>{sp.name}</td>
              <td>{sp.projectId}</td>
              <td>{sp.description || '-'}</td>
              <td>{formatDate(sp.createdAt)}</td>
              <td>
                <button
                  className="btn btn-danger btn-small"
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmDelete(sp);
                  }}
                  disabled={deleting === sp.id}
                >
                  {deleting === sp.id ? '削除中...' : '削除'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  const handleCreateOpen = () => {
    setNewProjectId('');
    setNewName('');
    setNewDescription('');
    setCreateError(null);
    setShowCreate(true);
  };

  const handleCreateCancel = () => setShowCreate(false);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      await CreateIAMServicePrincipal(profile, Number(newProjectId), newName, newDescription);
      setShowCreate(false);
      await loadData();
    } catch (e) {
      setCreateError(String(e));
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteCancel = () => setConfirmDelete(null);

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return;
    const target = confirmDelete;
    setConfirmDelete(null);
    setDeleting(target.id);
    try {
      await DeleteIAMServicePrincipal(profile, target.id);
      await loadData();
    } catch (e) {
      alert(`削除に失敗しました: ${e}`);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <>
      <div className="header">
        <h2>IAM</h2>
        {subPage === 'servicePrincipals' && (
          <button className="btn btn-primary btn-small" onClick={handleCreateOpen}>+ サービスプリンシパル作成</button>
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

      {renderContent()}

      {confirmDelete && (
        <div className="confirm-overlay" onClick={handleDeleteCancel}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <p>サービスプリンシパル「{confirmDelete.name}」を削除しますか？</p>
            <p className="confirm-warning">この操作は取り消せません。関連するキーもすべて削除されます。</p>
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
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>サービスプリンシパル作成</h3>
            <form onSubmit={handleCreateSubmit}>
              <div className="form-group">
                <label>プロジェクトID<span className="required-mark">*</span></label>
                <input
                  type="number"
                  value={newProjectId}
                  onChange={(e) => setNewProjectId(e.target.value)}
                  placeholder="1"
                  autoFocus
                  required
                />
              </div>
              <div className="form-group">
                <label>名前<span className="required-mark">*</span></label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="my-service-principal"
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
