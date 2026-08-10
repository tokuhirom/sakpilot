import { useState, useEffect, useCallback } from 'react';
import {
  GetApigwServices,
  CreateApigwService,
  UpdateApigwService,
  DeleteApigwService,
  GetApigwUsers,
  CreateApigwUser,
  UpdateApigwUser,
  DeleteApigwUser,
  GetApigwUserGroups,
  SetApigwUserGroup,
  GetApigwGroups,
  CreateApigwGroup,
  UpdateApigwGroup,
  DeleteApigwGroup,
  GetApigwDomains,
  CreateApigwDomain,
  UpdateApigwDomain,
  DeleteApigwDomain,
  GetApigwCertificates,
  CreateApigwCertificate,
  UpdateApigwCertificate,
  DeleteApigwCertificate,
  GetApigwSubscriptions,
  GetApigwPlans,
  CreateApigwSubscription,
  UpdateApigwSubscription,
  DeleteApigwSubscription,
} from '../../wailsjs/go/main/App';
import { apigw } from '../../wailsjs/go/models';
import { useGlobalReload } from '../hooks/useGlobalReload';

interface ApigwListProps {
  profile: string;
  onSelectService: (id: string) => void;
}

type SubPage = 'services' | 'users' | 'groups' | 'domains' | 'certificates' | 'subscriptions';

const TAB_LABEL: Record<SubPage, string> = {
  services: 'サービス',
  users: 'ユーザー',
  groups: 'グループ',
  domains: 'ドメイン',
  certificates: '証明書',
  subscriptions: 'サブスクリプション',
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

const parseTags = (value: string) => value.split(',').map(t => t.trim()).filter(t => t);

const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
  alignItems: 'center', justifyContent: 'center', zIndex: 1000,
};

const modalContentStyle: React.CSSProperties = {
  backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
  padding: '20px', minWidth: '320px', maxWidth: '560px', maxHeight: '85vh', overflowY: 'auto',
};

interface ServiceFormState {
  id: string | null;
  name: string;
  protocol: string;
  host: string;
  path: string;
  port: number;
  retries: number;
  connectTimeout: number;
  writeTimeout: number;
  readTimeout: number;
  subscriptionId: string;
}

const emptyServiceForm: ServiceFormState = {
  id: null, name: '', protocol: 'https', host: '', path: '/', port: 443,
  retries: 3, connectTimeout: 5000, writeTimeout: 60000, readTimeout: 60000, subscriptionId: '',
};

interface UserFormState {
  id: string | null;
  name: string;
  customId: string;
  tags: string;
}

const emptyUserForm: UserFormState = { id: null, name: '', customId: '', tags: '' };

interface GroupFormState {
  id: string | null;
  name: string;
  tags: string;
}

const emptyGroupForm: GroupFormState = { id: null, name: '', tags: '' };

interface DomainFormState {
  id: string | null;
  domainName: string;
  certificateId: string;
}

const emptyDomainForm: DomainFormState = { id: null, domainName: '', certificateId: '' };

interface CertificateFormState {
  id: string | null;
  name: string;
  rsaCert: string;
  rsaKey: string;
  ecdsaCert: string;
  ecdsaKey: string;
}

const emptyCertificateForm: CertificateFormState = {
  id: null, name: '', rsaCert: '', rsaKey: '', ecdsaCert: '', ecdsaKey: '',
};

interface SubscriptionFormState {
  id: string | null;
  name: string;
  planId: string;
}

export function ApigwList({ profile, onSelectService }: ApigwListProps) {
  const [subPage, setSubPage] = useState<SubPage>('services');
  const [services, setServices] = useState<apigw.ServiceInfo[]>([]);
  const [users, setUsers] = useState<apigw.UserInfo[]>([]);
  const [groups, setGroups] = useState<apigw.GroupInfo[]>([]);
  const [domains, setDomains] = useState<apigw.DomainInfo[]>([]);
  const [certificates, setCertificates] = useState<apigw.CertificateInfo[]>([]);
  const [subscriptions, setSubscriptions] = useState<apigw.SubscriptionInfo[]>([]);
  const [plans, setPlans] = useState<apigw.PlanInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [confirmDelete, setConfirmDelete] = useState<{ type: SubPage; id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [serviceForm, setServiceForm] = useState<ServiceFormState | null>(null);
  const [userForm, setUserForm] = useState<UserFormState | null>(null);
  const [groupForm, setGroupForm] = useState<GroupFormState | null>(null);
  const [domainForm, setDomainForm] = useState<DomainFormState | null>(null);
  const [certificateForm, setCertificateForm] = useState<CertificateFormState | null>(null);
  const [subscriptionForm, setSubscriptionForm] = useState<SubscriptionFormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [groupAssignUser, setGroupAssignUser] = useState<apigw.UserInfo | null>(null);
  const [groupAssignments, setGroupAssignments] = useState<apigw.UserGroupAssignmentInfo[]>([]);
  const [groupAssignLoading, setGroupAssignLoading] = useState(false);
  const [groupAssignError, setGroupAssignError] = useState<string | null>(null);

  // サブスクリプションタブはサービスの依存先、ドメインタブは証明書名を参照するため、
  // 開いているタブに関わらず全リソースをまとめて読み込む
  const loadData = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      const [svc, usr, grp, dom, cert, sub] = await Promise.all([
        GetApigwServices(profile),
        GetApigwUsers(profile),
        GetApigwGroups(profile),
        GetApigwDomains(profile),
        GetApigwCertificates(profile),
        GetApigwSubscriptions(profile),
      ]);
      setServices(svc || []);
      setUsers(usr || []);
      setGroups(grp || []);
      setDomains(dom || []);
      setCertificates(cert || []);
      setSubscriptions(sub || []);
    } catch (err) {
      console.error('[ApigwList] loadData error:', err);
      setError(String(err));
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
      switch (target.type) {
        case 'services':
          await DeleteApigwService(profile, target.id);
          break;
        case 'users':
          await DeleteApigwUser(profile, target.id);
          break;
        case 'groups':
          await DeleteApigwGroup(profile, target.id);
          break;
        case 'domains':
          await DeleteApigwDomain(profile, target.id);
          break;
        case 'certificates':
          await DeleteApigwCertificate(profile, target.id);
          break;
        case 'subscriptions':
          await DeleteApigwSubscription(profile, target.id);
          break;
      }
      await loadData();
    } catch (e) {
      alert(`削除に失敗しました: ${e}`);
    } finally {
      setDeleting(null);
    }
  };

  const handleServiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceForm) return;
    setSaving(true);
    setFormError(null);
    try {
      if (serviceForm.id) {
        await UpdateApigwService(
          profile, serviceForm.id, serviceForm.name, serviceForm.protocol, serviceForm.host, serviceForm.path,
          serviceForm.port, serviceForm.retries, serviceForm.connectTimeout, serviceForm.writeTimeout, serviceForm.readTimeout,
        );
      } else {
        await CreateApigwService(
          profile, serviceForm.name, serviceForm.protocol, serviceForm.host, serviceForm.path,
          serviceForm.port, serviceForm.retries, serviceForm.connectTimeout, serviceForm.writeTimeout, serviceForm.readTimeout,
          serviceForm.subscriptionId,
        );
      }
      setServiceForm(null);
      await loadData();
    } catch (e) {
      setFormError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userForm) return;
    setSaving(true);
    setFormError(null);
    try {
      const tags = parseTags(userForm.tags);
      if (userForm.id) {
        await UpdateApigwUser(profile, userForm.id, userForm.name, userForm.customId, tags);
      } else {
        await CreateApigwUser(profile, userForm.name, userForm.customId, tags);
      }
      setUserForm(null);
      await loadData();
    } catch (e) {
      setFormError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupForm) return;
    setSaving(true);
    setFormError(null);
    try {
      const tags = parseTags(groupForm.tags);
      if (groupForm.id) {
        await UpdateApigwGroup(profile, groupForm.id, groupForm.name, tags);
      } else {
        await CreateApigwGroup(profile, groupForm.name, tags);
      }
      setGroupForm(null);
      await loadData();
    } catch (e) {
      setFormError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDomainSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!domainForm) return;
    setSaving(true);
    setFormError(null);
    try {
      if (domainForm.id) {
        await UpdateApigwDomain(profile, domainForm.id, domainForm.certificateId);
      } else {
        await CreateApigwDomain(profile, domainForm.domainName, domainForm.certificateId);
      }
      setDomainForm(null);
      await loadData();
    } catch (e) {
      setFormError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleCertificateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!certificateForm) return;
    setSaving(true);
    setFormError(null);
    try {
      if (certificateForm.id) {
        await UpdateApigwCertificate(
          profile, certificateForm.id, certificateForm.name,
          certificateForm.rsaCert, certificateForm.rsaKey, certificateForm.ecdsaCert, certificateForm.ecdsaKey,
        );
      } else {
        await CreateApigwCertificate(
          profile, certificateForm.name,
          certificateForm.rsaCert, certificateForm.rsaKey, certificateForm.ecdsaCert, certificateForm.ecdsaKey,
        );
      }
      setCertificateForm(null);
      await loadData();
    } catch (e) {
      setFormError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleSubscriptionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subscriptionForm) return;
    setSaving(true);
    setFormError(null);
    try {
      if (subscriptionForm.id) {
        await UpdateApigwSubscription(profile, subscriptionForm.id, subscriptionForm.name);
      } else {
        await CreateApigwSubscription(profile, subscriptionForm.planId, subscriptionForm.name);
      }
      setSubscriptionForm(null);
      await loadData();
    } catch (e) {
      setFormError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const openGroupAssign = async (user: apigw.UserInfo) => {
    setGroupAssignUser(user);
    setGroupAssignError(null);
    setGroupAssignLoading(true);
    try {
      const list = await GetApigwUserGroups(profile, user.id);
      setGroupAssignments(list || []);
    } catch (e) {
      setGroupAssignError(String(e));
    } finally {
      setGroupAssignLoading(false);
    }
  };

  const toggleGroupAssignment = async (groupId: string, isAssigned: boolean) => {
    if (!groupAssignUser) return;
    setGroupAssignError(null);
    try {
      await SetApigwUserGroup(profile, groupAssignUser.id, groupId, isAssigned);
      const list = await GetApigwUserGroups(profile, groupAssignUser.id);
      setGroupAssignments(list || []);
    } catch (e) {
      setGroupAssignError(String(e));
    }
  };

  // Serviceは未使用のSubscriptionに1:1で紐づく(sakumockのCreateService制約)ため、
  // 既にServiceが紐づいているサブスクリプションはService作成の選択肢から除外する
  const availableSubscriptions = subscriptions.filter(s => !s.serviceId);

  const renderContent = () => {
    if (loading) return <div className="loading">読み込み中...</div>;
    if (error) return <div className="empty-state">読み込みに失敗しました: {error}</div>;

    if (subPage === 'services') {
      if (services.length === 0) return <div className="empty-state">サービスがありません</div>;
      return (
        <table className="table">
          <thead>
            <tr>
              <th>名前</th>
              <th>プロトコル</th>
              <th>接続先</th>
              <th>サブスクリプション</th>
              <th>公開ホスト</th>
              <th>作成日</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {services.map(s => (
              <tr key={s.id} onClick={() => onSelectService(s.id)} style={{ cursor: 'pointer' }}>
                <td style={{ textAlign: 'left' }}>{s.name}</td>
                <td style={{ textAlign: 'left' }}>{s.protocol}</td>
                <td style={{ textAlign: 'left' }}>{s.host}{s.port ? `:${s.port}` : ''}{s.path}</td>
                <td style={{ textAlign: 'left' }}>{s.subscriptionName || '-'}</td>
                <td style={{ textAlign: 'left' }}>{s.routeHost || '-'}</td>
                <td style={{ textAlign: 'left' }}>{formatDate(s.createdAt)}</td>
                <td onClick={(e) => e.stopPropagation()}>
                  <button
                    className="btn btn-secondary btn-small"
                    style={{ marginRight: '0.5rem' }}
                    onClick={() => {
                      setFormError(null);
                      setServiceForm({
                        id: s.id, name: s.name, protocol: s.protocol, host: s.host, path: s.path || '/',
                        port: s.port, retries: s.retries, connectTimeout: s.connectTimeout,
                        writeTimeout: s.writeTimeout, readTimeout: s.readTimeout, subscriptionId: s.subscriptionId,
                      });
                    }}
                  >
                    編集
                  </button>
                  <button
                    className="btn btn-danger btn-small"
                    onClick={() => setConfirmDelete({ type: 'services', id: s.id, name: s.name })}
                    disabled={deleting === s.id}
                  >
                    {deleting === s.id ? '削除中...' : '削除'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (subPage === 'users') {
      if (users.length === 0) return <div className="empty-state">ユーザーがありません</div>;
      return (
        <table className="table">
          <thead>
            <tr>
              <th>名前</th>
              <th>カスタムID</th>
              <th>所属グループ</th>
              <th>タグ</th>
              <th>作成日</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td style={{ textAlign: 'left' }}>{u.name}</td>
                <td style={{ textAlign: 'left' }}>{u.customId || '-'}</td>
                <td style={{ textAlign: 'left' }}>{(u.groupNames || []).join(', ') || '-'}</td>
                <td style={{ textAlign: 'left' }}>{(u.tags || []).join(', ') || '-'}</td>
                <td style={{ textAlign: 'left' }}>{formatDate(u.createdAt)}</td>
                <td>
                  <button
                    className="btn btn-secondary btn-small"
                    style={{ marginRight: '0.5rem' }}
                    onClick={() => openGroupAssign(u)}
                  >
                    グループ管理
                  </button>
                  <button
                    className="btn btn-secondary btn-small"
                    style={{ marginRight: '0.5rem' }}
                    onClick={() => {
                      setFormError(null);
                      setUserForm({ id: u.id, name: u.name, customId: u.customId, tags: (u.tags || []).join(',') });
                    }}
                  >
                    編集
                  </button>
                  <button
                    className="btn btn-danger btn-small"
                    onClick={() => setConfirmDelete({ type: 'users', id: u.id, name: u.name })}
                    disabled={deleting === u.id}
                  >
                    {deleting === u.id ? '削除中...' : '削除'}
                  </button>
                </td>
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
              <th>名前</th>
              <th>タグ</th>
              <th>作成日</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {groups.map(g => (
              <tr key={g.id}>
                <td style={{ textAlign: 'left' }}>{g.name}</td>
                <td style={{ textAlign: 'left' }}>{(g.tags || []).join(', ') || '-'}</td>
                <td style={{ textAlign: 'left' }}>{formatDate(g.createdAt)}</td>
                <td>
                  <button
                    className="btn btn-secondary btn-small"
                    style={{ marginRight: '0.5rem' }}
                    onClick={() => {
                      setFormError(null);
                      setGroupForm({ id: g.id, name: g.name, tags: (g.tags || []).join(',') });
                    }}
                  >
                    編集
                  </button>
                  <button
                    className="btn btn-danger btn-small"
                    onClick={() => setConfirmDelete({ type: 'groups', id: g.id, name: g.name })}
                    disabled={deleting === g.id}
                  >
                    {deleting === g.id ? '削除中...' : '削除'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (subPage === 'domains') {
      if (domains.length === 0) return <div className="empty-state">ドメインがありません</div>;
      return (
        <table className="table">
          <thead>
            <tr>
              <th>ドメイン名</th>
              <th>証明書</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {domains.map(d => (
              <tr key={d.id}>
                <td style={{ textAlign: 'left' }}>{d.domainName}</td>
                <td style={{ textAlign: 'left' }}>{d.certificateName || '-'}</td>
                <td>
                  <button
                    className="btn btn-secondary btn-small"
                    style={{ marginRight: '0.5rem' }}
                    onClick={() => {
                      setFormError(null);
                      setDomainForm({ id: d.id, domainName: d.domainName, certificateId: d.certificateId });
                    }}
                  >
                    編集
                  </button>
                  <button
                    className="btn btn-danger btn-small"
                    onClick={() => setConfirmDelete({ type: 'domains', id: d.id, name: d.domainName })}
                    disabled={deleting === d.id}
                  >
                    {deleting === d.id ? '削除中...' : '削除'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (subPage === 'certificates') {
      if (certificates.length === 0) return <div className="empty-state">証明書がありません</div>;
      return (
        <table className="table">
          <thead>
            <tr>
              <th>名前</th>
              <th>RSA有効期限</th>
              <th>ECDSA有効期限</th>
              <th>作成日</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {certificates.map(c => (
              <tr key={c.id}>
                <td style={{ textAlign: 'left' }}>{c.name}</td>
                <td style={{ textAlign: 'left' }}>{c.rsaExpiredAt ? formatDate(c.rsaExpiredAt) : '-'}</td>
                <td style={{ textAlign: 'left' }}>{c.ecdsaExpiredAt ? formatDate(c.ecdsaExpiredAt) : '-'}</td>
                <td style={{ textAlign: 'left' }}>{formatDate(c.createdAt)}</td>
                <td>
                  <button
                    className="btn btn-secondary btn-small"
                    style={{ marginRight: '0.5rem' }}
                    onClick={() => {
                      setFormError(null);
                      setCertificateForm({ id: c.id, name: c.name, rsaCert: '', rsaKey: '', ecdsaCert: '', ecdsaKey: '' });
                    }}
                  >
                    編集
                  </button>
                  <button
                    className="btn btn-danger btn-small"
                    onClick={() => setConfirmDelete({ type: 'certificates', id: c.id, name: c.name })}
                    disabled={deleting === c.id}
                  >
                    {deleting === c.id ? '削除中...' : '削除'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (subscriptions.length === 0) return <div className="empty-state">サブスクリプションがありません</div>;
    return (
      <table className="table">
        <thead>
          <tr>
            <th>名前</th>
            <th>プラン</th>
            <th>紐づくサービス</th>
            <th>今月のリクエスト数</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {subscriptions.map(s => (
            <tr key={s.id}>
              <td style={{ textAlign: 'left' }}>{s.name}</td>
              <td style={{ textAlign: 'left' }}>{s.planName}</td>
              <td style={{ textAlign: 'left' }}>{s.serviceName || '-'}</td>
              <td style={{ textAlign: 'left' }}>{s.monthlyRequest}</td>
              <td>
                <button
                  className="btn btn-secondary btn-small"
                  style={{ marginRight: '0.5rem' }}
                  onClick={() => {
                    setFormError(null);
                    setSubscriptionForm({ id: s.id, name: s.name, planId: s.planId });
                  }}
                >
                  編集
                </button>
                <button
                  className="btn btn-danger btn-small"
                  onClick={() => setConfirmDelete({ type: 'subscriptions', id: s.id, name: s.name })}
                  disabled={deleting === s.id}
                  title={s.serviceId ? 'サービスが紐づいているため先にサービスを削除してください' : undefined}
                >
                  {deleting === s.id ? '削除中...' : '解約'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  const openCreateForm = async () => {
    setFormError(null);
    switch (subPage) {
      case 'services':
        setServiceForm({ ...emptyServiceForm, subscriptionId: availableSubscriptions[0]?.id || '' });
        break;
      case 'users':
        setUserForm({ ...emptyUserForm });
        break;
      case 'groups':
        setGroupForm({ ...emptyGroupForm });
        break;
      case 'domains':
        setDomainForm({ ...emptyDomainForm });
        break;
      case 'certificates':
        setCertificateForm({ ...emptyCertificateForm });
        break;
      case 'subscriptions': {
        let planList = plans;
        if (planList.length === 0) {
          planList = (await GetApigwPlans(profile)) || [];
          setPlans(planList);
        }
        setSubscriptionForm({ id: null, name: '', planId: planList[0]?.id || '' });
        break;
      }
    }
  };

  const createDisabled = subPage === 'services' && availableSubscriptions.length === 0;

  return (
    <>
      <div className="header">
        <h2>APIゲートウェイ</h2>
        <button
          className="btn btn-primary btn-small"
          onClick={openCreateForm}
          disabled={createDisabled}
          title={createDisabled ? '先にサブスクリプションを契約してください' : undefined}
        >
          + {TAB_LABEL[subPage]}作成
        </button>
      </div>

      <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
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
        <div className="confirm-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <p>「{confirmDelete.name}」を削除しますか？</p>
            <p className="confirm-warning">この操作は取り消せません。</p>
            <div className="confirm-actions">
              <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>キャンセル</button>
              <button className="btn btn-danger" onClick={handleDeleteConfirm}>削除する</button>
            </div>
          </div>
        </div>
      )}

      {serviceForm && (
        <div className="modal-overlay" onClick={() => setServiceForm(null)} style={modalOverlayStyle}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={modalContentStyle}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>{serviceForm.id ? 'サービス編集' : 'サービス作成'}</h3>
            <form onSubmit={handleServiceSubmit}>
              <div className="form-group">
                <label>名前<span className="required-mark">*</span></label>
                <input
                  type="text"
                  value={serviceForm.name}
                  onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
                  placeholder="my_service"
                  pattern="^[a-zA-Z0-9_]+$"
                  autoFocus
                  required
                />
              </div>
              {!serviceForm.id && (
                <div className="form-group">
                  <label>サブスクリプション<span className="required-mark">*</span></label>
                  <select
                    value={serviceForm.subscriptionId}
                    onChange={(e) => setServiceForm({ ...serviceForm, subscriptionId: e.target.value })}
                    required
                  >
                    <option value="">選択してください</option>
                    {availableSubscriptions.map(s => (
                      <option key={s.id} value={s.id}>{s.name}({s.planName})</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="form-group">
                <label>プロトコル<span className="required-mark">*</span></label>
                <select
                  value={serviceForm.protocol}
                  onChange={(e) => setServiceForm({ ...serviceForm, protocol: e.target.value })}
                >
                  <option value="http">http</option>
                  <option value="https">https</option>
                </select>
              </div>
              <div className="form-group">
                <label>接続先ホスト<span className="required-mark">*</span></label>
                <input
                  type="text"
                  value={serviceForm.host}
                  onChange={(e) => setServiceForm({ ...serviceForm, host: e.target.value })}
                  placeholder="backend.example.com"
                  required
                />
              </div>
              <div className="form-group">
                <label>パス</label>
                <input
                  type="text"
                  value={serviceForm.path}
                  onChange={(e) => setServiceForm({ ...serviceForm, path: e.target.value })}
                  placeholder="/"
                />
              </div>
              <div className="form-group">
                <label>ポート</label>
                <input
                  type="number"
                  value={serviceForm.port}
                  onChange={(e) => setServiceForm({ ...serviceForm, port: Number(e.target.value) })}
                  min={1}
                  max={65535}
                />
              </div>
              <div className="form-group">
                <label>リトライ回数</label>
                <input
                  type="number"
                  value={serviceForm.retries}
                  onChange={(e) => setServiceForm({ ...serviceForm, retries: Number(e.target.value) })}
                  min={0}
                />
              </div>
              <div className="form-group">
                <label>接続/書き込み/読み込みタイムアウト(ミリ秒)</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="number"
                    value={serviceForm.connectTimeout}
                    onChange={(e) => setServiceForm({ ...serviceForm, connectTimeout: Number(e.target.value) })}
                    min={1}
                    style={{ flex: 1, minWidth: 0, width: 'auto' }}
                  />
                  <input
                    type="number"
                    value={serviceForm.writeTimeout}
                    onChange={(e) => setServiceForm({ ...serviceForm, writeTimeout: Number(e.target.value) })}
                    min={1}
                    style={{ flex: 1, minWidth: 0, width: 'auto' }}
                  />
                  <input
                    type="number"
                    value={serviceForm.readTimeout}
                    onChange={(e) => setServiceForm({ ...serviceForm, readTimeout: Number(e.target.value) })}
                    min={1}
                    style={{ flex: 1, minWidth: 0, width: 'auto' }}
                  />
                </div>
              </div>
              {formError && (
                <div style={{ marginBottom: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>
                  エラー: {formError}
                </div>
              )}
              <div className="confirm-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setServiceForm(null)}>キャンセル</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? '保存中...' : (serviceForm.id ? '更新する' : '作成する')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {userForm && (
        <div className="modal-overlay" onClick={() => setUserForm(null)} style={modalOverlayStyle}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={modalContentStyle}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>{userForm.id ? 'ユーザー編集' : 'ユーザー作成'}</h3>
            <form onSubmit={handleUserSubmit}>
              <div className="form-group">
                <label>名前<span className="required-mark">*</span></label>
                <input
                  type="text"
                  value={userForm.name}
                  onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                  placeholder="my_user"
                  autoFocus
                  required
                />
              </div>
              <div className="form-group">
                <label>カスタムID</label>
                <input
                  type="text"
                  value={userForm.customId}
                  onChange={(e) => setUserForm({ ...userForm, customId: e.target.value })}
                  placeholder="任意"
                />
              </div>
              <div className="form-group">
                <label>タグ</label>
                <input
                  type="text"
                  value={userForm.tags}
                  onChange={(e) => setUserForm({ ...userForm, tags: e.target.value })}
                  placeholder="任意(カンマ区切り)"
                />
              </div>
              {formError && (
                <div style={{ marginBottom: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>
                  エラー: {formError}
                </div>
              )}
              <div className="confirm-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setUserForm(null)}>キャンセル</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? '保存中...' : (userForm.id ? '更新する' : '作成する')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {groupForm && (
        <div className="modal-overlay" onClick={() => setGroupForm(null)} style={modalOverlayStyle}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={modalContentStyle}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>{groupForm.id ? 'グループ編集' : 'グループ作成'}</h3>
            <form onSubmit={handleGroupSubmit}>
              <div className="form-group">
                <label>名前<span className="required-mark">*</span></label>
                <input
                  type="text"
                  value={groupForm.name}
                  onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                  placeholder="my_group"
                  autoFocus
                  required
                />
              </div>
              <div className="form-group">
                <label>タグ</label>
                <input
                  type="text"
                  value={groupForm.tags}
                  onChange={(e) => setGroupForm({ ...groupForm, tags: e.target.value })}
                  placeholder="任意(カンマ区切り)"
                />
              </div>
              {formError && (
                <div style={{ marginBottom: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>
                  エラー: {formError}
                </div>
              )}
              <div className="confirm-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setGroupForm(null)}>キャンセル</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? '保存中...' : (groupForm.id ? '更新する' : '作成する')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {domainForm && (
        <div className="modal-overlay" onClick={() => setDomainForm(null)} style={modalOverlayStyle}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={modalContentStyle}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>{domainForm.id ? 'ドメイン編集' : 'ドメイン作成'}</h3>
            <form onSubmit={handleDomainSubmit}>
              {!domainForm.id && (
                <div className="form-group">
                  <label>ドメイン名<span className="required-mark">*</span></label>
                  <input
                    type="text"
                    value={domainForm.domainName}
                    onChange={(e) => setDomainForm({ ...domainForm, domainName: e.target.value })}
                    placeholder="example.com"
                    autoFocus
                    required
                  />
                </div>
              )}
              <div className="form-group">
                <label>証明書</label>
                <select
                  value={domainForm.certificateId}
                  onChange={(e) => setDomainForm({ ...domainForm, certificateId: e.target.value })}
                >
                  <option value="">なし</option>
                  {certificates.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              {formError && (
                <div style={{ marginBottom: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>
                  エラー: {formError}
                </div>
              )}
              <div className="confirm-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setDomainForm(null)}>キャンセル</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? '保存中...' : (domainForm.id ? '更新する' : '作成する')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {certificateForm && (
        <div className="modal-overlay" onClick={() => setCertificateForm(null)} style={modalOverlayStyle}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={modalContentStyle}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>{certificateForm.id ? '証明書編集' : '証明書作成'}</h3>
            <form onSubmit={handleCertificateSubmit}>
              <div className="form-group">
                <label>名前<span className="required-mark">*</span></label>
                <input
                  type="text"
                  value={certificateForm.name}
                  onChange={(e) => setCertificateForm({ ...certificateForm, name: e.target.value })}
                  placeholder="my_certificate"
                  autoFocus
                  required
                />
              </div>
              {certificateForm.id && (
                <div style={{ marginBottom: '1rem', fontSize: '0.8rem', color: '#888' }}>
                  証明書/秘密鍵は書き込み専用のため一覧には表示されません。更新する場合のみ入力してください。
                </div>
              )}
              <div className="form-group">
                <label>RSA証明書(PEM)</label>
                <textarea
                  value={certificateForm.rsaCert}
                  onChange={(e) => setCertificateForm({ ...certificateForm, rsaCert: e.target.value })}
                  rows={4}
                  style={{ fontFamily: 'monospace', fontSize: '0.75rem', width: '100%' }}
                  placeholder="-----BEGIN CERTIFICATE-----"
                />
              </div>
              <div className="form-group">
                <label>RSA秘密鍵(PEM)</label>
                <textarea
                  value={certificateForm.rsaKey}
                  onChange={(e) => setCertificateForm({ ...certificateForm, rsaKey: e.target.value })}
                  rows={4}
                  style={{ fontFamily: 'monospace', fontSize: '0.75rem', width: '100%' }}
                  placeholder="-----BEGIN PRIVATE KEY-----"
                />
              </div>
              <div className="form-group">
                <label>ECDSA証明書(PEM)</label>
                <textarea
                  value={certificateForm.ecdsaCert}
                  onChange={(e) => setCertificateForm({ ...certificateForm, ecdsaCert: e.target.value })}
                  rows={4}
                  style={{ fontFamily: 'monospace', fontSize: '0.75rem', width: '100%' }}
                  placeholder="任意"
                />
              </div>
              <div className="form-group">
                <label>ECDSA秘密鍵(PEM)</label>
                <textarea
                  value={certificateForm.ecdsaKey}
                  onChange={(e) => setCertificateForm({ ...certificateForm, ecdsaKey: e.target.value })}
                  rows={4}
                  style={{ fontFamily: 'monospace', fontSize: '0.75rem', width: '100%' }}
                  placeholder="任意"
                />
              </div>
              {formError && (
                <div style={{ marginBottom: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>
                  エラー: {formError}
                </div>
              )}
              <div className="confirm-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setCertificateForm(null)}>キャンセル</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? '保存中...' : (certificateForm.id ? '更新する' : '作成する')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {subscriptionForm && (
        <div className="modal-overlay" onClick={() => setSubscriptionForm(null)} style={modalOverlayStyle}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={modalContentStyle}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>{subscriptionForm.id ? 'サブスクリプション編集' : 'サブスクリプション契約'}</h3>
            <form onSubmit={handleSubscriptionSubmit}>
              <div className="form-group">
                <label>名前<span className="required-mark">*</span></label>
                <input
                  type="text"
                  value={subscriptionForm.name}
                  onChange={(e) => setSubscriptionForm({ ...subscriptionForm, name: e.target.value })}
                  placeholder="my-subscription"
                  autoFocus
                  required
                />
              </div>
              {!subscriptionForm.id && (
                <div className="form-group">
                  <label>プラン<span className="required-mark">*</span></label>
                  <select
                    value={subscriptionForm.planId}
                    onChange={(e) => setSubscriptionForm({ ...subscriptionForm, planId: e.target.value })}
                    required
                  >
                    {plans.map(p => (
                      <option key={p.id} value={p.id}>{p.name}(月額 {p.price}円)</option>
                    ))}
                  </select>
                </div>
              )}
              {formError && (
                <div style={{ marginBottom: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>
                  エラー: {formError}
                </div>
              )}
              <div className="confirm-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setSubscriptionForm(null)}>キャンセル</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? '保存中...' : (subscriptionForm.id ? '更新する' : '契約する')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {groupAssignUser && (
        <div className="modal-overlay" onClick={() => setGroupAssignUser(null)} style={modalOverlayStyle}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={modalContentStyle}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>「{groupAssignUser.name}」の所属グループ</h3>
            {groupAssignLoading ? (
              <div className="loading">読み込み中...</div>
            ) : groupAssignments.length === 0 ? (
              <div className="empty-state">グループがありません</div>
            ) : (
              <div>
                {groupAssignments.map(g => (
                  <label key={g.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'normal', marginBottom: '0.5rem' }}>
                    <input
                      type="checkbox"
                      checked={g.isAssigned}
                      onChange={(e) => toggleGroupAssignment(g.id, e.target.checked)}
                    />
                    {g.name}
                  </label>
                ))}
              </div>
            )}
            {groupAssignError && (
              <div style={{ marginBottom: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>
                エラー: {groupAssignError}
              </div>
            )}
            <div className="confirm-actions">
              <button className="btn btn-secondary" onClick={() => { setGroupAssignUser(null); loadData(); }}>閉じる</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
