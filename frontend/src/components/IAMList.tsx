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
  GetIAMOrganizationPolicy,
  UpdateIAMOrganizationPolicy,
  GetIAMProjectPolicy,
  UpdateIAMProjectPolicy,
  GetIAMFolderPolicy,
  UpdateIAMFolderPolicy,
  GetIDOrganizationPolicy,
  UpdateIDOrganizationPolicy,
  GetIAMSSOProfiles,
  CreateIAMSSOProfile,
  UpdateIAMSSOProfile,
  DeleteIAMSSOProfile,
  LinkIAMSSOProfile,
  UnlinkIAMSSOProfile,
  GetIAMScimConfigurations,
  CreateIAMScimConfiguration,
  UpdateIAMScimConfiguration,
  DeleteIAMScimConfiguration,
  RegenerateIAMScimConfigurationToken,
  GetIAMServicePolicyStatus,
  EnableIAMServicePolicy,
  DisableIAMServicePolicy,
  GetIAMServicePolicyRuleTemplates,
} from '../../wailsjs/go/main/App';
import { iam } from '../../wailsjs/go/models';
import { useGlobalReload } from '../hooks/useGlobalReload';

interface IAMListProps {
  profile: string;
  onSelectServicePrincipal: (id: number) => void;
}

type SubPage = 'users' | 'groups' | 'iamRoles' | 'idRoles' | 'servicePrincipals' | 'projectsFolders' | 'organization' | 'policies' | 'sso' | 'scim' | 'servicePolicy';

const TAB_LABEL: Record<SubPage, string> = {
  users: 'ユーザー',
  groups: 'グループ',
  iamRoles: 'IAMロール',
  idRoles: 'IDロール',
  servicePrincipals: 'サービスプリンシパル',
  projectsFolders: 'プロジェクト/フォルダ',
  organization: '組織',
  policies: 'ポリシー',
  sso: 'SSO',
  scim: 'SCIM',
  servicePolicy: 'サービスポリシー',
};

type PolicyScope = 'organization' | 'project' | 'folder';
type PolicyRoleSystem = 'iam' | 'id';

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

  const [policyScope, setPolicyScope] = useState<PolicyScope>('organization');
  const [policyRoleSystem, setPolicyRoleSystem] = useState<PolicyRoleSystem>('iam');
  const [policyScopeId, setPolicyScopeId] = useState<number | null>(null);
  const [policyBindings, setPolicyBindings] = useState<iam.PolicyBindingInfo[]>([]);
  const [policySaving, setPolicySaving] = useState(false);
  const [policySaveError, setPolicySaveError] = useState<string | null>(null);

  const [ssoProfiles, setSsoProfiles] = useState<iam.SSOProfileInfo[]>([]);
  const [showCreateSso, setShowCreateSso] = useState(false);
  const [ssoForm, setSsoForm] = useState<{
    name: string; description: string; idpEntityId: string; idpLoginUrl: string; idpLogoutUrl: string; idpCertificate: string;
  }>({ name: '', description: '', idpEntityId: '', idpLoginUrl: '', idpLogoutUrl: '', idpCertificate: '' });
  const [ssoCreating, setSsoCreating] = useState(false);
  const [editSsoProfile, setEditSsoProfile] = useState<iam.SSOProfileInfo | null>(null);
  const [confirmDeleteSso, setConfirmDeleteSso] = useState<iam.SSOProfileInfo | null>(null);
  const [ssoLinking, setSsoLinking] = useState<number | null>(null);
  const [ssoFormError, setSsoFormError] = useState<string | null>(null);

  const [scimConfigs, setScimConfigs] = useState<iam.ScimConfigurationInfo[]>([]);
  const [showCreateScim, setShowCreateScim] = useState(false);
  const [newScimName, setNewScimName] = useState('');
  const [scimCreating, setScimCreating] = useState(false);
  const [scimFormError, setScimFormError] = useState<string | null>(null);
  const [editScimConfig, setEditScimConfig] = useState<iam.ScimConfigurationInfo | null>(null);
  const [editScimName, setEditScimName] = useState('');
  const [confirmDeleteScim, setConfirmDeleteScim] = useState<iam.ScimConfigurationInfo | null>(null);
  const [regeneratingScimToken, setRegeneratingScimToken] = useState<string | null>(null);
  const [scimSecretReveal, setScimSecretReveal] = useState<{ id: string; name: string; secretToken: string } | null>(null);

  const [servicePolicyEnabled, setServicePolicyEnabled] = useState(false);
  const [servicePolicyRuleTemplates, setServicePolicyRuleTemplates] = useState<iam.ServicePolicyRuleTemplateInfo[]>([]);
  const [servicePolicyToggling, setServicePolicyToggling] = useState(false);
  const [servicePolicyError, setServicePolicyError] = useState<string | null>(null);

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
      } else if (subPage === 'organization') {
        setOrganization(await GetIAMOrganization(profile));
      } else if (subPage === 'sso') {
        setSsoProfiles((await GetIAMSSOProfiles(profile)) || []);
      } else if (subPage === 'scim') {
        setScimConfigs((await GetIAMScimConfigurations(profile)) || []);
      } else if (subPage === 'servicePolicy') {
        const [enabled, templates] = await Promise.all([
          GetIAMServicePolicyStatus(profile), GetIAMServicePolicyRuleTemplates(profile),
        ]);
        setServicePolicyEnabled(enabled);
        setServicePolicyRuleTemplates(templates || []);
      } else {
        const [p, f, ir, idr] = await Promise.all([
          GetIAMProjects(profile), GetIAMFolders(profile), GetIAMRoles(profile), GetIAMIDRoles(profile),
        ]);
        setProjects(p || []);
        setFolders(f || []);
        setIamRoles(ir || []);
        setIdRoles(idr || []);
        setPolicySaveError(null);
        if (policyScope === 'organization') {
          setPolicyBindings((policyRoleSystem === 'iam'
            ? await GetIAMOrganizationPolicy(profile)
            : await GetIDOrganizationPolicy(profile)) || []);
        } else if (policyScopeId !== null) {
          setPolicyBindings((policyScope === 'project'
            ? await GetIAMProjectPolicy(profile, policyScopeId)
            : await GetIAMFolderPolicy(profile, policyScopeId)) || []);
        } else {
          setPolicyBindings([]);
        }
      }
    } catch (err) {
      console.error(`[IAMList] loadData error (${subPage}):`, err);
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [profile, subPage, policyScope, policyRoleSystem, policyScopeId]);

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

    if (subPage === 'policies') {
      return renderPolicies();
    }

    if (subPage === 'sso') {
      if (ssoProfiles.length === 0) return <div className="empty-state">SSOプロファイルがありません</div>;
      return (
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>名前</th>
              <th>説明</th>
              <th>割り当て状態</th>
              <th>作成日</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {ssoProfiles.map(p => (
              <tr key={p.id}>
                <td>{p.id}</td>
                <td>{p.name}</td>
                <td>{p.description || '-'}</td>
                <td>
                  <span className={`status ${p.assigned ? 'up' : 'down'}`}>{p.assigned ? '割り当て済み' : '未割り当て'}</span>
                </td>
                <td>{formatDate(p.createdAt)}</td>
                <td style={{ display: 'flex', gap: '0.4rem' }}>
                  <button className="btn btn-secondary btn-small" onClick={() => handleEditSsoOpen(p)}>編集</button>
                  {p.assigned ? (
                    <button
                      className="btn btn-secondary btn-small"
                      onClick={() => handleUnlinkSso(p)}
                      disabled={ssoLinking === p.id}
                    >
                      {ssoLinking === p.id ? '処理中...' : '割り当て解除'}
                    </button>
                  ) : (
                    <button
                      className="btn btn-secondary btn-small"
                      onClick={() => handleLinkSso(p)}
                      disabled={ssoLinking === p.id}
                    >
                      {ssoLinking === p.id ? '処理中...' : '割り当てる'}
                    </button>
                  )}
                  <button className="btn btn-danger btn-small" onClick={() => setConfirmDeleteSso(p)}>削除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (subPage === 'scim') {
      if (scimConfigs.length === 0) return <div className="empty-state">ユーザープロビジョニング(SCIM)設定がありません</div>;
      return (
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>名前</th>
              <th>ベースURL</th>
              <th>作成日</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {scimConfigs.map(c => (
              <tr key={c.id}>
                <td>{c.id}</td>
                <td>{c.name}</td>
                <td style={{ wordBreak: 'break-all' }}>{c.baseUrl}</td>
                <td>{formatDate(c.createdAt)}</td>
                <td style={{ display: 'flex', gap: '0.4rem' }}>
                  <button className="btn btn-secondary btn-small" onClick={() => handleEditScimOpen(c)}>編集</button>
                  <button
                    className="btn btn-secondary btn-small"
                    onClick={() => handleRegenerateScimToken(c)}
                    disabled={regeneratingScimToken === c.id}
                  >
                    {regeneratingScimToken === c.id ? '再発行中...' : 'トークン再発行'}
                  </button>
                  <button className="btn btn-danger btn-small" onClick={() => setConfirmDeleteScim(c)}>削除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (subPage === 'servicePolicy') {
      return (
        <div>
          <table className="table" style={{ maxWidth: '480px' }}>
            <tbody>
              <tr>
                <td style={{ fontWeight: 600, textAlign: 'left' }}>状態</td>
                <td style={{ textAlign: 'left' }}>
                  <span className={`status ${servicePolicyEnabled ? 'up' : 'down'}`}>{servicePolicyEnabled ? '有効' : '無効'}</span>
                </td>
              </tr>
            </tbody>
          </table>
          <button
            className="btn btn-primary btn-small"
            style={{ marginTop: '1rem' }}
            onClick={handleToggleServicePolicy}
            disabled={servicePolicyToggling}
          >
            {servicePolicyToggling ? '処理中...' : (servicePolicyEnabled ? '無効化する' : '有効化する')}
          </button>
          {servicePolicyError && (
            <div style={{ marginTop: '0.5rem', color: '#ff6b6b', fontSize: '0.85rem' }}>エラー: {servicePolicyError}</div>
          )}

          <h3 style={{ marginTop: '2rem', fontSize: '1rem' }}>ルールテンプレート(参照専用)</h3>
          {servicePolicyRuleTemplates.length === 0 ? (
            <div className="empty-state">ルールテンプレートがありません</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>コード</th>
                  <th>名前</th>
                  <th>タイプ</th>
                  <th>ドライラン対応</th>
                  <th>説明</th>
                  <th>プレフィックス</th>
                </tr>
              </thead>
              <tbody>
                {servicePolicyRuleTemplates.map((t, i) => (
                  <tr key={i}>
                    <td>{t.code || '-'}</td>
                    <td>{t.name || '-'}</td>
                    <td>{t.type || '-'}</td>
                    <td>{t.supportsDryRun ? 'はい' : 'いいえ'}</td>
                    <td>{t.description || '-'}</td>
                    <td>{(t.prefixes || []).join(', ') || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
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

  const policyRoleOptions = policyScope === 'organization' && policyRoleSystem === 'id' ? idRoles : iamRoles;

  const renderPolicies = (): ReactNode => {
    const needsScopeId = policyScope !== 'organization';
    if (needsScopeId && policyScopeId === null) {
      return <div className="empty-state">対象の{policyScope === 'project' ? 'プロジェクト' : 'フォルダ'}を選択してください</div>;
    }
    return (
      <div>
        <table className="table">
          <thead>
            <tr>
              <th>ロール</th>
              <th>プリンシパル</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {policyBindings.length === 0 && (
              <tr>
                <td colSpan={3}>バインディングがありません</td>
              </tr>
            )}
            {policyBindings.map((b, bi) => (
              <tr key={bi}>
                <td>
                  <select value={b.roleId} onChange={(e) => handleBindingRoleChange(bi, e.target.value)}>
                    <option value="">選択してください</option>
                    {policyRoleOptions.map(r => (
                      <option key={r.id} value={r.id}>{r.name} ({r.id})</option>
                    ))}
                  </select>
                </td>
                <td>
                  {b.principals.map((p, pi) => (
                    <div key={pi} style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.3rem', alignItems: 'center' }}>
                      <select value={p.type} onChange={(e) => handlePrincipalChange(bi, pi, 'type', e.target.value)}>
                        <option value="user">ユーザー</option>
                        <option value="group">グループ</option>
                        <option value="service-principal">サービスプリンシパル</option>
                      </select>
                      <input
                        type="number"
                        value={p.id}
                        onChange={(e) => handlePrincipalChange(bi, pi, 'id', e.target.value)}
                        style={{ width: '80px' }}
                      />
                      <button className="btn btn-secondary btn-small" onClick={() => handleRemovePrincipal(bi, pi)}>削除</button>
                    </div>
                  ))}
                  <button className="btn btn-secondary btn-small" onClick={() => handleAddPrincipal(bi)}>+ プリンシパル追加</button>
                </td>
                <td>
                  <button className="btn btn-danger btn-small" onClick={() => handleRemoveBinding(bi)}>削除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', alignItems: 'center' }}>
          <button className="btn btn-secondary btn-small" onClick={handleAddBinding}>+ バインディング追加</button>
          <button className="btn btn-primary btn-small" onClick={handleSavePolicy} disabled={policySaving}>
            {policySaving ? '保存中...' : '保存する'}
          </button>
          {policySaveError && (
            <span style={{ color: '#ff6b6b', fontSize: '0.85rem' }}>エラー: {policySaveError}</span>
          )}
        </div>
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

  const handlePolicyScopeChange = (scope: PolicyScope) => {
    setPolicyScope(scope);
    setPolicyScopeId(null);
    if (scope !== 'organization') {
      setPolicyRoleSystem('iam');
    }
  };

  const handleAddBinding = () => {
    setPolicyBindings(prev => [...prev, new iam.PolicyBindingInfo({ roleId: '', principals: [] })]);
  };

  const handleRemoveBinding = (bindingIndex: number) => {
    setPolicyBindings(prev => prev.filter((_, i) => i !== bindingIndex));
  };

  const handleBindingRoleChange = (bindingIndex: number, roleId: string) => {
    setPolicyBindings(prev => prev.map((b, i) => (
      i === bindingIndex ? new iam.PolicyBindingInfo({ ...b, roleId }) : b
    )));
  };

  const handleAddPrincipal = (bindingIndex: number) => {
    setPolicyBindings(prev => prev.map((b, i) => (
      i === bindingIndex
        ? new iam.PolicyBindingInfo({ ...b, principals: [...b.principals, new iam.PolicyPrincipalInfo({ type: 'user', id: 0 })] })
        : b
    )));
  };

  const handleRemovePrincipal = (bindingIndex: number, principalIndex: number) => {
    setPolicyBindings(prev => prev.map((b, i) => (
      i === bindingIndex
        ? new iam.PolicyBindingInfo({ ...b, principals: b.principals.filter((_, pi) => pi !== principalIndex) })
        : b
    )));
  };

  const handlePrincipalChange = (bindingIndex: number, principalIndex: number, field: 'type' | 'id', value: string) => {
    setPolicyBindings(prev => prev.map((b, i) => {
      if (i !== bindingIndex) return b;
      return new iam.PolicyBindingInfo({
        ...b,
        principals: b.principals.map((p, pi) => (
          pi === principalIndex ? new iam.PolicyPrincipalInfo({ ...p, [field]: field === 'id' ? Number(value) : value }) : p
        )),
      });
    }));
  };

  const handleSavePolicy = async () => {
    setPolicySaving(true);
    setPolicySaveError(null);
    try {
      let updated: iam.PolicyBindingInfo[];
      if (policyScope === 'organization') {
        updated = policyRoleSystem === 'iam'
          ? await UpdateIAMOrganizationPolicy(profile, policyBindings)
          : await UpdateIDOrganizationPolicy(profile, policyBindings);
      } else if (policyScope === 'project') {
        updated = await UpdateIAMProjectPolicy(profile, policyScopeId!, policyBindings);
      } else {
        updated = await UpdateIAMFolderPolicy(profile, policyScopeId!, policyBindings);
      }
      setPolicyBindings(updated || []);
    } catch (err) {
      setPolicySaveError(String(err));
    } finally {
      setPolicySaving(false);
    }
  };

  const handleCreateSsoOpen = () => {
    setSsoForm({ name: '', description: '', idpEntityId: '', idpLoginUrl: '', idpLogoutUrl: '', idpCertificate: '' });
    setSsoFormError(null);
    setEditSsoProfile(null);
    setShowCreateSso(true);
  };

  const handleEditSsoOpen = (p: iam.SSOProfileInfo) => {
    setSsoForm({
      name: p.name,
      description: p.description,
      idpEntityId: p.idpEntityId,
      idpLoginUrl: p.idpLoginUrl,
      idpLogoutUrl: p.idpLogoutUrl,
      idpCertificate: p.idpCertificate,
    });
    setSsoFormError(null);
    setEditSsoProfile(p);
  };

  const closeSsoForm = () => {
    setShowCreateSso(false);
    setEditSsoProfile(null);
  };

  const handleSsoFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSsoCreating(true);
    setSsoFormError(null);
    try {
      const { name, description, idpEntityId, idpLoginUrl, idpLogoutUrl, idpCertificate } = ssoForm;
      if (editSsoProfile) {
        await UpdateIAMSSOProfile(profile, editSsoProfile.id, name, description, idpEntityId, idpLoginUrl, idpLogoutUrl, idpCertificate);
      } else {
        await CreateIAMSSOProfile(profile, name, description, idpEntityId, idpLoginUrl, idpLogoutUrl, idpCertificate);
      }
      closeSsoForm();
      await loadData();
    } catch (err) {
      setSsoFormError(String(err));
    } finally {
      setSsoCreating(false);
    }
  };

  const handleDeleteSsoConfirm = async () => {
    if (!confirmDeleteSso) return;
    const target = confirmDeleteSso;
    setConfirmDeleteSso(null);
    try {
      await DeleteIAMSSOProfile(profile, target.id);
      await loadData();
    } catch (err) {
      alert(`削除に失敗しました: ${err}`);
    }
  };

  const handleLinkSso = async (p: iam.SSOProfileInfo) => {
    setSsoLinking(p.id);
    try {
      await LinkIAMSSOProfile(profile, p.id);
      await loadData();
    } catch (err) {
      alert(`割り当てに失敗しました: ${err}`);
    } finally {
      setSsoLinking(null);
    }
  };

  const handleUnlinkSso = async (p: iam.SSOProfileInfo) => {
    setSsoLinking(p.id);
    try {
      await UnlinkIAMSSOProfile(profile, p.id);
      await loadData();
    } catch (err) {
      alert(`割り当て解除に失敗しました: ${err}`);
    } finally {
      setSsoLinking(null);
    }
  };

  const handleCreateScimSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setScimCreating(true);
    setScimFormError(null);
    try {
      const created = await CreateIAMScimConfiguration(profile, newScimName);
      setShowCreateScim(false);
      setNewScimName('');
      setScimSecretReveal({ id: created.id, name: created.name, secretToken: created.secretToken });
      await loadData();
    } catch (err) {
      setScimFormError(String(err));
    } finally {
      setScimCreating(false);
    }
  };

  const handleEditScimOpen = (c: iam.ScimConfigurationInfo) => {
    setEditScimName(c.name);
    setScimFormError(null);
    setEditScimConfig(c);
  };

  const handleEditScimSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editScimConfig) return;
    setScimCreating(true);
    setScimFormError(null);
    try {
      await UpdateIAMScimConfiguration(profile, editScimConfig.id, editScimName);
      setEditScimConfig(null);
      await loadData();
    } catch (err) {
      setScimFormError(String(err));
    } finally {
      setScimCreating(false);
    }
  };

  const handleDeleteScimConfirm = async () => {
    if (!confirmDeleteScim) return;
    const target = confirmDeleteScim;
    setConfirmDeleteScim(null);
    try {
      await DeleteIAMScimConfiguration(profile, target.id);
      await loadData();
    } catch (err) {
      alert(`削除に失敗しました: ${err}`);
    }
  };

  const handleRegenerateScimToken = async (c: iam.ScimConfigurationInfo) => {
    setRegeneratingScimToken(c.id);
    try {
      const secretToken = await RegenerateIAMScimConfigurationToken(profile, c.id);
      setScimSecretReveal({ id: c.id, name: c.name, secretToken });
    } catch (err) {
      alert(`トークン再発行に失敗しました: ${err}`);
    } finally {
      setRegeneratingScimToken(null);
    }
  };

  const handleToggleServicePolicy = async () => {
    setServicePolicyToggling(true);
    setServicePolicyError(null);
    try {
      if (servicePolicyEnabled) {
        await DisableIAMServicePolicy(profile);
      } else {
        await EnableIAMServicePolicy(profile);
      }
      setServicePolicyEnabled(await GetIAMServicePolicyStatus(profile));
    } catch (err) {
      setServicePolicyError(String(err));
    } finally {
      setServicePolicyToggling(false);
    }
  };

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
        {subPage === 'sso' && (
          <button className="btn btn-primary btn-small" onClick={handleCreateSsoOpen}>+ SSOプロファイル作成</button>
        )}
        {subPage === 'scim' && (
          <button className="btn btn-primary btn-small" onClick={() => { setNewScimName(''); setScimFormError(null); setShowCreateScim(true); }}>
            + ユーザープロビジョニング作成
          </button>
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

      {subPage === 'policies' && (
        <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label>スコープ</label>
            <select value={policyScope} onChange={(e) => handlePolicyScopeChange(e.target.value as PolicyScope)}>
              <option value="organization">組織</option>
              <option value="project">プロジェクト</option>
              <option value="folder">フォルダ</option>
            </select>
          </div>
          {policyScope === 'organization' && (
            <div className="form-group" style={{ margin: 0 }}>
              <label>ロール体系</label>
              <select value={policyRoleSystem} onChange={(e) => setPolicyRoleSystem(e.target.value as PolicyRoleSystem)}>
                <option value="iam">IAMロール</option>
                <option value="id">IDロール(旧)</option>
              </select>
            </div>
          )}
          {policyScope === 'project' && (
            <div className="form-group" style={{ margin: 0 }}>
              <label>プロジェクト</label>
              <select value={policyScopeId ?? ''} onChange={(e) => setPolicyScopeId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">選択してください</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name} (ID:{p.id})</option>
                ))}
              </select>
            </div>
          )}
          {policyScope === 'folder' && (
            <div className="form-group" style={{ margin: 0 }}>
              <label>フォルダ</label>
              <select value={policyScopeId ?? ''} onChange={(e) => setPolicyScopeId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">選択してください</option>
                {folders.map(f => (
                  <option key={f.id} value={f.id}>{f.name} (ID:{f.id})</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

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

      {(showCreateSso || editSsoProfile) && (
        <div className="modal-overlay" onClick={closeSsoForm} style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
            backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
            padding: '20px', minWidth: '320px', maxWidth: '480px',
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>{editSsoProfile ? 'SSOプロファイル編集' : 'SSOプロファイル作成'}</h3>
            <form onSubmit={handleSsoFormSubmit}>
              <div className="form-group">
                <label>名前<span className="required-mark">*</span></label>
                <input
                  type="text"
                  value={ssoForm.name}
                  onChange={(e) => setSsoForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="my-sso-profile"
                  autoFocus
                  required
                />
              </div>
              <div className="form-group">
                <label>説明</label>
                <input
                  type="text"
                  value={ssoForm.description}
                  onChange={(e) => setSsoForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="任意"
                />
              </div>
              <div className="form-group">
                <label>IdPエンティティID<span className="required-mark">*</span></label>
                <input
                  type="text"
                  value={ssoForm.idpEntityId}
                  onChange={(e) => setSsoForm(prev => ({ ...prev, idpEntityId: e.target.value }))}
                  placeholder="https://idp.example.com/metadata"
                  required
                />
              </div>
              <div className="form-group">
                <label>IdPログインURL<span className="required-mark">*</span></label>
                <input
                  type="text"
                  value={ssoForm.idpLoginUrl}
                  onChange={(e) => setSsoForm(prev => ({ ...prev, idpLoginUrl: e.target.value }))}
                  placeholder="https://idp.example.com/sso"
                  required
                />
              </div>
              <div className="form-group">
                <label>IdPログアウトURL</label>
                <input
                  type="text"
                  value={ssoForm.idpLogoutUrl}
                  onChange={(e) => setSsoForm(prev => ({ ...prev, idpLogoutUrl: e.target.value }))}
                  placeholder="https://idp.example.com/slo"
                />
              </div>
              <div className="form-group">
                <label>IdP証明書(PEM)<span className="required-mark">*</span></label>
                <textarea
                  value={ssoForm.idpCertificate}
                  onChange={(e) => setSsoForm(prev => ({ ...prev, idpCertificate: e.target.value }))}
                  placeholder="-----BEGIN CERTIFICATE-----..."
                  rows={5}
                  required
                />
              </div>
              {ssoFormError && (
                <div style={{ marginBottom: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>
                  エラー: {ssoFormError}
                </div>
              )}
              <div className="confirm-actions">
                <button type="button" className="btn btn-secondary" onClick={closeSsoForm}>キャンセル</button>
                <button type="submit" className="btn btn-primary" disabled={ssoCreating}>
                  {ssoCreating ? '保存中...' : (editSsoProfile ? '更新する' : '作成する')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDeleteSso && (
        <div className="confirm-overlay" onClick={() => setConfirmDeleteSso(null)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <p>SSOプロファイル「{confirmDeleteSso.name}」を削除しますか？</p>
            <p className="confirm-warning">この操作は取り消せません。</p>
            <div className="confirm-actions">
              <button className="btn btn-secondary" onClick={() => setConfirmDeleteSso(null)}>キャンセル</button>
              <button className="btn btn-danger" onClick={handleDeleteSsoConfirm}>削除する</button>
            </div>
          </div>
        </div>
      )}

      {showCreateScim && (
        <div className="modal-overlay" onClick={() => setShowCreateScim(false)} style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
            backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
            padding: '20px', minWidth: '320px', maxWidth: '420px',
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>ユーザープロビジョニング作成</h3>
            <form onSubmit={handleCreateScimSubmit}>
              <div className="form-group">
                <label>名前<span className="required-mark">*</span></label>
                <input
                  type="text"
                  value={newScimName}
                  onChange={(e) => setNewScimName(e.target.value)}
                  placeholder="my-scim-config"
                  autoFocus
                  required
                />
              </div>
              {scimFormError && (
                <div style={{ marginBottom: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>
                  エラー: {scimFormError}
                </div>
              )}
              <div className="confirm-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateScim(false)}>キャンセル</button>
                <button type="submit" className="btn btn-primary" disabled={scimCreating}>
                  {scimCreating ? '作成中...' : '作成する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editScimConfig && (
        <div className="modal-overlay" onClick={() => setEditScimConfig(null)} style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
            backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
            padding: '20px', minWidth: '320px', maxWidth: '420px',
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>ユーザープロビジョニング編集</h3>
            <form onSubmit={handleEditScimSubmit}>
              <div className="form-group">
                <label>名前<span className="required-mark">*</span></label>
                <input
                  type="text"
                  value={editScimName}
                  onChange={(e) => setEditScimName(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              {scimFormError && (
                <div style={{ marginBottom: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>
                  エラー: {scimFormError}
                </div>
              )}
              <div className="confirm-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setEditScimConfig(null)}>キャンセル</button>
                <button type="submit" className="btn btn-primary" disabled={scimCreating}>
                  {scimCreating ? '保存中...' : '更新する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDeleteScim && (
        <div className="confirm-overlay" onClick={() => setConfirmDeleteScim(null)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <p>ユーザープロビジョニング「{confirmDeleteScim.name}」を削除しますか？</p>
            <p className="confirm-warning">この操作は取り消せません。</p>
            <div className="confirm-actions">
              <button className="btn btn-secondary" onClick={() => setConfirmDeleteScim(null)}>キャンセル</button>
              <button className="btn btn-danger" onClick={handleDeleteScimConfirm}>削除する</button>
            </div>
          </div>
        </div>
      )}

      {scimSecretReveal && (
        <div className="modal-overlay" onClick={() => setScimSecretReveal(null)} style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
            backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
            padding: '20px', minWidth: '320px', maxWidth: '480px',
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>シークレットトークン「{scimSecretReveal.name}」</h3>
            <p className="confirm-warning">このトークンは今だけ表示されます。閉じると再度確認することはできません。</p>
            <div className="form-group">
              <label>シークレットトークン</label>
              <textarea readOnly value={scimSecretReveal.secretToken} rows={3} onClick={(e) => (e.target as HTMLTextAreaElement).select()} />
            </div>
            <div className="confirm-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigator.clipboard?.writeText(scimSecretReveal.secretToken)}
              >
                コピー
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setScimSecretReveal(null)}>閉じる</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
