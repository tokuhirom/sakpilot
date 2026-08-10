import { useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import {
  GetIAMUsers,
  GetIAMGroups,
  GetIAMRoles,
  GetIAMIDRoles,
  GetIAMServicePrincipals,
  CreateIAMServicePrincipal,
  DeleteIAMServicePrincipal,
  GetIAMProjects,
  GetIAMFolders,
  CreateIAMProject,
  UpdateIAMProject,
  DeleteIAMProject,
  MoveIAMProjects,
  CreateIAMFolder,
  UpdateIAMFolder,
  DeleteIAMFolder,
  MoveIAMFolders,
  GetIAMOrganization,
  UpdateIAMOrganization,
} from '../../wailsjs/go/main/App';
import { iam } from '../../wailsjs/go/models';
import { useGlobalReload } from '../hooks/useGlobalReload';

interface IAMListProps {
  profile: string;
  onSelectServicePrincipal: (id: number) => void;
}

type SubPage = 'users' | 'groups' | 'iamRoles' | 'idRoles' | 'servicePrincipals' | 'projectsFolders' | 'organization';

const TAB_LABEL: Record<SubPage, string> = {
  users: 'ユーザー',
  groups: 'グループ',
  iamRoles: 'IAMロール',
  idRoles: 'IDロール',
  servicePrincipals: 'サービスプリンシパル',
  projectsFolders: 'プロジェクト/フォルダ',
  organization: '組織',
};

function childFolders(folders: iam.FolderInfo[], parentId: number): iam.FolderInfo[] {
  return folders.filter(f => f.parentId === parentId);
}

function childProjects(projects: iam.ProjectInfo[], parentFolderId: number): iam.ProjectInfo[] {
  return projects.filter(p => p.parentFolderId === parentFolderId);
}

function descendantFolderIds(folders: iam.FolderInfo[], id: number): number[] {
  const children = childFolders(folders, id);
  return children.flatMap(c => [c.id, ...descendantFolderIds(folders, c.id)]);
}

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
  const [projects, setProjects] = useState<iam.ProjectInfo[]>([]);
  const [folders, setFolders] = useState<iam.FolderInfo[]>([]);
  const [organization, setOrganization] = useState<iam.OrganizationInfo | null>(null);
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

  const [createFolderParentId, setCreateFolderParentId] = useState<number | null>(null);
  const [createProjectParentFolderId, setCreateProjectParentFolderId] = useState<number | null>(null);
  const [editFolder, setEditFolder] = useState<iam.FolderInfo | null>(null);
  const [editProject, setEditProject] = useState<iam.ProjectInfo | null>(null);
  const [moveTarget, setMoveTarget] = useState<{ type: 'folder' | 'project'; item: iam.FolderInfo | iam.ProjectInfo } | null>(null);
  const [confirmDeleteFolder, setConfirmDeleteFolder] = useState<iam.FolderInfo | null>(null);
  const [confirmDeleteProject, setConfirmDeleteProject] = useState<iam.ProjectInfo | null>(null);
  const [editOrganization, setEditOrganization] = useState(false);
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [moveParentId, setMoveParentId] = useState('0');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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
      } else if (subPage === 'servicePrincipals') {
        setServicePrincipals((await GetIAMServicePrincipals(profile)) || []);
      } else if (subPage === 'projectsFolders') {
        const [p, f] = await Promise.all([GetIAMProjects(profile), GetIAMFolders(profile)]);
        setProjects(p || []);
        setFolders(f || []);
      } else {
        setOrganization(await GetIAMOrganization(profile));
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

    if (subPage === 'servicePrincipals') {
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
    }

    if (subPage === 'organization') {
      if (!organization) return <div className="empty-state">組織情報を取得できませんでした</div>;
      return (
        <div>
          <table className="table" style={{ maxWidth: '480px' }}>
            <tbody>
              <tr>
                <td style={{ fontWeight: 600, textAlign: 'left' }}>組織ID</td>
                <td style={{ textAlign: 'left' }}>{organization.id}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600, textAlign: 'left' }}>組織名</td>
                <td style={{ textAlign: 'left' }}>{organization.name}</td>
              </tr>
            </tbody>
          </table>
          <button className="btn btn-secondary btn-small" style={{ marginTop: '1rem' }} onClick={handleEditOrganizationOpen}>
            組織名を編集
          </button>
        </div>
      );
    }

    // projectsFolders
    const rootFolders = childFolders(folders, 0);
    const rootProjects = childProjects(projects, 0);
    if (rootFolders.length === 0 && rootProjects.length === 0) {
      return <div className="empty-state">プロジェクト・フォルダがありません</div>;
    }
    return (
      <div className="iam-tree">
        {rootFolders.map(f => renderFolderNode(f, 0))}
        {rootProjects.map(renderProjectRow)}
      </div>
    );
  };

  const renderProjectRow = (p: iam.ProjectInfo): ReactNode => (
    <div
      key={`project-${p.id}`}
      className="iam-tree-row"
      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0', flexWrap: 'wrap' }}
    >
      <span>📄</span>
      <span style={{ fontWeight: 500 }}>{p.name}</span>
      <span style={{ color: '#888', fontSize: '0.85rem' }}>({p.code}) ID:{p.id} / {p.status}</span>
      <span style={{ flex: 1 }} />
      <button className="btn btn-secondary btn-small" onClick={() => handleEditProjectOpen(p)}>編集</button>
      <button className="btn btn-secondary btn-small" onClick={() => handleMoveOpen('project', p)}>移動</button>
      <button className="btn btn-danger btn-small" onClick={() => setConfirmDeleteProject(p)}>削除</button>
    </div>
  );

  const renderFolderNode = (folder: iam.FolderInfo, depth: number): ReactNode => {
    const subFolders = childFolders(folders, folder.id);
    const subProjects = childProjects(projects, folder.id);
    return (
      <div key={`folder-${folder.id}`} style={{ marginLeft: depth > 0 ? '1.5rem' : 0, marginTop: depth > 0 ? '0.25rem' : 0 }}>
        <div className="iam-tree-row" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0', flexWrap: 'wrap' }}>
          <span>📁</span>
          <span style={{ fontWeight: 600 }}>{folder.name}</span>
          <span style={{ color: '#888', fontSize: '0.85rem' }}>ID:{folder.id}</span>
          <span style={{ flex: 1 }} />
          <button className="btn btn-secondary btn-small" onClick={() => handleCreateFolderOpen(folder.id)}>+ サブフォルダ</button>
          <button className="btn btn-secondary btn-small" onClick={() => handleCreateProjectOpen(folder.id)}>+ プロジェクト</button>
          <button className="btn btn-secondary btn-small" onClick={() => handleEditFolderOpen(folder)}>編集</button>
          <button className="btn btn-secondary btn-small" onClick={() => handleMoveOpen('folder', folder)}>移動</button>
          <button className="btn btn-danger btn-small" onClick={() => setConfirmDeleteFolder(folder)}>削除</button>
        </div>
        <div style={{ marginLeft: '1.5rem', borderLeft: '1px solid #333', paddingLeft: '0.75rem' }}>
          {subFolders.map(f => renderFolderNode(f, depth + 1))}
          {subProjects.map(renderProjectRow)}
        </div>
      </div>
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

  const handleCreateFolderOpen = (parentId: number) => {
    setFormName('');
    setFormDescription('');
    setFormError(null);
    setCreateFolderParentId(parentId);
  };

  const handleCreateProjectOpen = (parentFolderId: number) => {
    setFormCode('');
    setFormName('');
    setFormDescription('');
    setFormError(null);
    setCreateProjectParentFolderId(parentFolderId);
  };

  const handleEditFolderOpen = (folder: iam.FolderInfo) => {
    setFormName(folder.name);
    setFormDescription(folder.description);
    setFormError(null);
    setEditFolder(folder);
  };

  const handleEditProjectOpen = (project: iam.ProjectInfo) => {
    setFormName(project.name);
    setFormDescription(project.description);
    setFormError(null);
    setEditProject(project);
  };

  const handleEditOrganizationOpen = () => {
    setFormName(organization?.name ?? '');
    setFormError(null);
    setEditOrganization(true);
  };

  const handleMoveOpen = (type: 'folder' | 'project', item: iam.FolderInfo | iam.ProjectInfo) => {
    const currentParentId = type === 'folder' ? (item as iam.FolderInfo).parentId : (item as iam.ProjectInfo).parentFolderId;
    setMoveParentId(String(currentParentId));
    setFormError(null);
    setMoveTarget({ type, item });
  };

  const closeFolderForm = () => {
    setCreateFolderParentId(null);
    setEditFolder(null);
  };

  const closeProjectForm = () => {
    setCreateProjectParentFolderId(null);
    setEditProject(null);
  };

  const handleFolderFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError(null);
    try {
      if (editFolder) {
        await UpdateIAMFolder(profile, editFolder.id, formName, formDescription);
      } else if (createFolderParentId !== null) {
        await CreateIAMFolder(profile, formName, formDescription, createFolderParentId);
      }
      closeFolderForm();
      await loadData();
    } catch (err) {
      setFormError(String(err));
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleProjectFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError(null);
    try {
      if (editProject) {
        await UpdateIAMProject(profile, editProject.id, formName, formDescription);
      } else if (createProjectParentFolderId !== null) {
        await CreateIAMProject(profile, formCode, formName, formDescription, createProjectParentFolderId);
      }
      closeProjectForm();
      await loadData();
    } catch (err) {
      setFormError(String(err));
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleMoveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moveTarget) return;
    setFormSubmitting(true);
    setFormError(null);
    try {
      const parentId = Number(moveParentId);
      if (moveTarget.type === 'folder') {
        await MoveIAMFolders(profile, [moveTarget.item.id], parentId);
      } else {
        await MoveIAMProjects(profile, [moveTarget.item.id], parentId);
      }
      setMoveTarget(null);
      await loadData();
    } catch (err) {
      setFormError(String(err));
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleOrganizationFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError(null);
    try {
      setOrganization(await UpdateIAMOrganization(profile, formName));
      setEditOrganization(false);
    } catch (err) {
      setFormError(String(err));
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeleteFolderConfirm = async () => {
    if (!confirmDeleteFolder) return;
    const target = confirmDeleteFolder;
    setConfirmDeleteFolder(null);
    try {
      await DeleteIAMFolder(profile, target.id);
      await loadData();
    } catch (err) {
      alert(`削除に失敗しました: ${err}`);
    }
  };

  const handleDeleteProjectConfirm = async () => {
    if (!confirmDeleteProject) return;
    const target = confirmDeleteProject;
    setConfirmDeleteProject(null);
    try {
      await DeleteIAMProject(profile, target.id);
      await loadData();
    } catch (err) {
      alert(`削除に失敗しました: ${err}`);
    }
  };

  const folderSelectOptions = moveTarget?.type === 'folder'
    ? folders.filter(f => f.id !== moveTarget.item.id && !descendantFolderIds(folders, moveTarget.item.id).includes(f.id))
    : folders;

  return (
    <>
      <div className="header">
        <h2>IAM</h2>
        {subPage === 'servicePrincipals' && (
          <button className="btn btn-primary btn-small" onClick={handleCreateOpen}>+ サービスプリンシパル作成</button>
        )}
        {subPage === 'projectsFolders' && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-primary btn-small" onClick={() => handleCreateFolderOpen(0)}>+ フォルダ作成</button>
            <button className="btn btn-primary btn-small" onClick={() => handleCreateProjectOpen(0)}>+ プロジェクト作成</button>
          </div>
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

      {(createFolderParentId !== null || editFolder) && (
        <div className="modal-overlay" onClick={closeFolderForm} style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
            backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
            padding: '20px', minWidth: '320px', maxWidth: '420px',
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>{editFolder ? 'フォルダ編集' : 'フォルダ作成'}</h3>
            <form onSubmit={handleFolderFormSubmit}>
              <div className="form-group">
                <label>名前<span className="required-mark">*</span></label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="my-folder"
                  autoFocus
                  required
                />
              </div>
              <div className="form-group">
                <label>説明</label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="任意"
                />
              </div>
              {formError && (
                <div style={{ marginBottom: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>
                  エラー: {formError}
                </div>
              )}
              <div className="confirm-actions">
                <button type="button" className="btn btn-secondary" onClick={closeFolderForm}>キャンセル</button>
                <button type="submit" className="btn btn-primary" disabled={formSubmitting}>
                  {formSubmitting ? '保存中...' : (editFolder ? '更新する' : '作成する')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {(createProjectParentFolderId !== null || editProject) && (
        <div className="modal-overlay" onClick={closeProjectForm} style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
            backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
            padding: '20px', minWidth: '320px', maxWidth: '420px',
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>{editProject ? 'プロジェクト編集' : 'プロジェクト作成'}</h3>
            <form onSubmit={handleProjectFormSubmit}>
              {editProject ? (
                <div className="form-group">
                  <label>プロジェクトコード</label>
                  <input type="text" value={editProject.code} disabled />
                </div>
              ) : (
                <div className="form-group">
                  <label>プロジェクトコード<span className="required-mark">*</span></label>
                  <input
                    type="text"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    placeholder="my-project-code"
                    autoFocus
                    required
                  />
                </div>
              )}
              <div className="form-group">
                <label>名前<span className="required-mark">*</span></label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="my-project"
                  required
                />
              </div>
              <div className="form-group">
                <label>説明</label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="任意"
                />
              </div>
              {formError && (
                <div style={{ marginBottom: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>
                  エラー: {formError}
                </div>
              )}
              <div className="confirm-actions">
                <button type="button" className="btn btn-secondary" onClick={closeProjectForm}>キャンセル</button>
                <button type="submit" className="btn btn-primary" disabled={formSubmitting}>
                  {formSubmitting ? '保存中...' : (editProject ? '更新する' : '作成する')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {moveTarget && (
        <div className="modal-overlay" onClick={() => setMoveTarget(null)} style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
            backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
            padding: '20px', minWidth: '320px', maxWidth: '420px',
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>
              {moveTarget.type === 'folder' ? 'フォルダの移動' : 'プロジェクトの移動'}: {moveTarget.item.name}
            </h3>
            <form onSubmit={handleMoveSubmit}>
              <div className="form-group">
                <label>移動先</label>
                <select value={moveParentId} onChange={(e) => setMoveParentId(e.target.value)}>
                  <option value="0">(組織ルート)</option>
                  {folderSelectOptions.map(f => (
                    <option key={f.id} value={f.id}>{f.name} (ID:{f.id})</option>
                  ))}
                </select>
              </div>
              {formError && (
                <div style={{ marginBottom: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>
                  エラー: {formError}
                </div>
              )}
              <div className="confirm-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setMoveTarget(null)}>キャンセル</button>
                <button type="submit" className="btn btn-primary" disabled={formSubmitting}>
                  {formSubmitting ? '移動中...' : '移動する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDeleteFolder && (
        <div className="confirm-overlay" onClick={() => setConfirmDeleteFolder(null)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <p>フォルダ「{confirmDeleteFolder.name}」を削除しますか？</p>
            <p className="confirm-warning">この操作は取り消せません。</p>
            <div className="confirm-actions">
              <button className="btn btn-secondary" onClick={() => setConfirmDeleteFolder(null)}>キャンセル</button>
              <button className="btn btn-danger" onClick={handleDeleteFolderConfirm}>削除する</button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteProject && (
        <div className="confirm-overlay" onClick={() => setConfirmDeleteProject(null)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <p>プロジェクト「{confirmDeleteProject.name}」を削除しますか？</p>
            <p className="confirm-warning">この操作は取り消せません。</p>
            <div className="confirm-actions">
              <button className="btn btn-secondary" onClick={() => setConfirmDeleteProject(null)}>キャンセル</button>
              <button className="btn btn-danger" onClick={handleDeleteProjectConfirm}>削除する</button>
            </div>
          </div>
        </div>
      )}

      {editOrganization && (
        <div className="modal-overlay" onClick={() => setEditOrganization(false)} style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
            backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
            padding: '20px', minWidth: '320px', maxWidth: '420px',
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>組織名を編集</h3>
            <form onSubmit={handleOrganizationFormSubmit}>
              <div className="form-group">
                <label>組織名<span className="required-mark">*</span></label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              {formError && (
                <div style={{ marginBottom: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>
                  エラー: {formError}
                </div>
              )}
              <div className="confirm-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setEditOrganization(false)}>キャンセル</button>
                <button type="submit" className="btn btn-primary" disabled={formSubmitting}>
                  {formSubmitting ? '保存中...' : '更新する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
