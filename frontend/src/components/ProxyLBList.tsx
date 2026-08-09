import { useState, useEffect, useCallback } from 'react';
import {
  GetProxyLBs,
  GetProxyLBDetail,
  GetProxyLBHealth,
  DeleteProxyLB,
  GetProxyLBCertificates,
  SetProxyLBCertificates,
  DeleteProxyLBCertificates,
  RenewProxyLBLetsEncryptCert,
  CreateProxyLB,
  UpdateProxyLB,
  UpdateProxyLBSettings,
  ChangeProxyLBPlan,
} from '../../wailsjs/go/main/App';
import { sakura } from '../../wailsjs/go/models';
import { useSearch } from '../hooks/useSearch';
import { useGlobalReload } from '../hooks/useGlobalReload';
import { SearchBar } from './SearchBar';
import { ProxyLBConnectionGraph } from './ProxyLBConnectionGraph';

interface ProxyLBListProps {
  profile: string;
}

type ViewMode = 'list' | 'detail';

interface CertFormEntry {
  serverCertificate: string;
  intermediateCertificate: string;
  privateKey: string;
}

interface CertForm {
  primaryCert: CertFormEntry;
  additionalCerts: CertFormEntry[];
}

const emptyCertEntry = (): CertFormEntry => ({
  serverCertificate: '',
  intermediateCertificate: '',
  privateKey: '',
});

const emptyCertForm = (): CertForm => ({
  primaryCert: emptyCertEntry(),
  additionalCerts: [],
});

const PLAN_OPTIONS = [100, 500, 1000, 5000, 10000, 50000, 100000, 400000];

const IPV4_PATTERN = '^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(\\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$';

interface CreateForm {
  name: string;
  description: string;
  plan: number;
  region: string;
  useVipFailover: boolean;
}

const emptyCreateForm = (): CreateForm => ({
  name: '',
  description: '',
  plan: 100,
  region: 'is1',
  useVipFailover: false,
});

interface BindPortFormRow {
  proxyMode: string;
  port: string;
  redirectToHttps: boolean;
  supportHttp2: boolean;
}

interface ServerFormRow {
  ipAddress: string;
  port: string;
  serverGroup: string;
  enabled: boolean;
}

interface SettingsForm {
  healthCheckProtocol: string;
  healthCheckPath: string;
  healthCheckHost: string;
  healthCheckDelayLoop: string;
  sorryServerIpAddress: string;
  sorryServerPort: string;
  bindPorts: BindPortFormRow[];
  servers: ServerFormRow[];
}

function toSettingsForm(lb: sakura.ProxyLBInfo): SettingsForm {
  return {
    healthCheckProtocol: lb.healthCheck?.protocol || 'http',
    healthCheckPath: lb.healthCheck?.path || '/',
    healthCheckHost: lb.healthCheck?.host || '',
    healthCheckDelayLoop: String(lb.healthCheck?.delayLoop || 10),
    sorryServerIpAddress: lb.sorryServer?.ipAddress || '',
    sorryServerPort: lb.sorryServer?.port ? String(lb.sorryServer.port) : '',
    bindPorts: (lb.bindPorts || []).map((bp) => ({
      proxyMode: bp.proxyMode,
      port: String(bp.port),
      redirectToHttps: bp.redirectToHttps,
      supportHttp2: bp.supportHttp2,
    })),
    servers: (lb.servers || []).map((srv) => ({
      ipAddress: srv.ipAddress,
      port: String(srv.port),
      serverGroup: srv.serverGroup,
      enabled: srv.enabled,
    })),
  };
}

export function ProxyLBList({ profile }: ProxyLBListProps) {
  const [proxyLBs, setProxyLBs] = useState<sakura.ProxyLBInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedProxyLB, setSelectedProxyLB] = useState<sakura.ProxyLBInfo | null>(null);
  const [health, setHealth] = useState<sakura.ProxyLBHealthInfo | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [certificates, setCertificates] = useState<sakura.ProxyLBCertificatesInfo | null>(null);
  const [loadingCertificates, setLoadingCertificates] = useState(false);
  const [showCertForm, setShowCertForm] = useState(false);
  const [certForm, setCertForm] = useState<CertForm>(emptyCertForm());
  const [savingCert, setSavingCert] = useState(false);
  const [confirmDeleteCert, setConfirmDeleteCert] = useState(false);
  const [deletingCert, setDeletingCert] = useState(false);
  const [confirmRenewCert, setConfirmRenewCert] = useState(false);
  const [renewingCert, setRenewingCert] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>(emptyCreateForm());
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editingBasic, setEditingBasic] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [descriptionInput, setDescriptionInput] = useState('');
  const [savingBasic, setSavingBasic] = useState(false);
  const [settingsForm, setSettingsForm] = useState<SettingsForm | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [showChangePlan, setShowChangePlan] = useState(false);
  const [changePlanValue, setChangePlanValue] = useState(100);
  const [changingPlan, setChangingPlan] = useState(false);
  const [changePlanError, setChangePlanError] = useState<string | null>(null);

  const {
    searchQuery,
    setSearchQuery,
    isSearching,
    searchInputRef,
    filteredItems: filteredProxyLBs,
    closeSearch,
  } = useSearch(proxyLBs, (lb, query) =>
    lb.name.toLowerCase().includes(query) ||
    lb.fqdn?.toLowerCase().includes(query) ||
    lb.virtualIPAddress?.toLowerCase().includes(query) ||
    lb.tags?.some(tag => tag.toLowerCase().includes(query)) ||
    lb.id.includes(query)
  );

  const loadProxyLBs = useCallback(async () => {
    if (!profile) return;

    setLoading(true);
    try {
      const list = await GetProxyLBs(profile);
      setProxyLBs(list || []);
    } catch (err) {
      console.error('[ProxyLBList] loadProxyLBs error:', err);
      setProxyLBs([]);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  const loadDetail = useCallback(async (id: string) => {
    if (!profile) return;

    try {
      const detail = await GetProxyLBDetail(profile, id);
      setSelectedProxyLB(detail);
    } catch (err) {
      console.error('[ProxyLBList] loadDetail error:', err);
    }
  }, [profile]);

  const loadHealth = useCallback(async (id: string) => {
    if (!profile) return;

    setLoadingHealth(true);
    try {
      const h = await GetProxyLBHealth(profile, id);
      setHealth(h);
    } catch (err) {
      console.error('[ProxyLBList] loadHealth error:', err);
      setHealth(null);
    } finally {
      setLoadingHealth(false);
    }
  }, [profile]);

  const loadCertificates = useCallback(async (id: string) => {
    if (!profile) return;

    setLoadingCertificates(true);
    try {
      const certs = await GetProxyLBCertificates(profile, id);
      setCertificates(certs);
    } catch (err) {
      console.error('[ProxyLBList] loadCertificates error:', err);
      setCertificates(null);
    } finally {
      setLoadingCertificates(false);
    }
  }, [profile]);

  const handleGlobalReload = useCallback(() => {
    if (viewMode === 'list') {
      loadProxyLBs();
    } else if (selectedProxyLB) {
      loadDetail(selectedProxyLB.id);
      loadHealth(selectedProxyLB.id);
      loadCertificates(selectedProxyLB.id);
    }
  }, [viewMode, selectedProxyLB, loadProxyLBs, loadDetail, loadHealth, loadCertificates]);

  useGlobalReload(handleGlobalReload);

  useEffect(() => {
    loadProxyLBs();
  }, [loadProxyLBs]);

  const handleSelectProxyLB = (lb: sakura.ProxyLBInfo) => {
    setSelectedProxyLB(lb);
    setHealth(null);
    setCertificates(null);
    setShowCertForm(false);
    setViewMode('detail');
    loadDetail(lb.id);
    loadHealth(lb.id);
    loadCertificates(lb.id);
  };

  const handleBackToList = () => {
    setViewMode('list');
    setSelectedProxyLB(null);
    setHealth(null);
    setCertificates(null);
    setShowCertForm(false);
  };

  const handleDeleteClick = () => {
    setConfirmDelete(true);
  };

  const handleDeleteCancel = () => {
    setConfirmDelete(false);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedProxyLB) return;
    setConfirmDelete(false);
    setDeleting(true);
    try {
      await DeleteProxyLB(profile, selectedProxyLB.id);
      handleBackToList();
      await loadProxyLBs();
    } catch (e) {
      alert(`削除に失敗しました: ${e}`);
    } finally {
      setDeleting(false);
    }
  };

  const handleOpenCertForm = () => {
    setCertForm(
      certificates?.primaryCert
        ? {
            primaryCert: {
              serverCertificate: certificates.primaryCert.serverCertificate,
              intermediateCertificate: certificates.primaryCert.intermediateCertificate,
              privateKey: '',
            },
            additionalCerts: (certificates.additionalCerts || []).map((c) => ({
              serverCertificate: c.serverCertificate,
              intermediateCertificate: c.intermediateCertificate,
              privateKey: '',
            })),
          }
        : emptyCertForm()
    );
    setShowCertForm(true);
  };

  const handleCancelCertForm = () => {
    setShowCertForm(false);
  };

  const handleAddAdditionalCert = () => {
    setCertForm((prev) => ({ ...prev, additionalCerts: [...prev.additionalCerts, emptyCertEntry()] }));
  };

  const handleRemoveAdditionalCert = (idx: number) => {
    setCertForm((prev) => ({ ...prev, additionalCerts: prev.additionalCerts.filter((_, i) => i !== idx) }));
  };

  const updatePrimaryCertField = (field: keyof CertFormEntry, value: string) => {
    setCertForm((prev) => ({ ...prev, primaryCert: { ...prev.primaryCert, [field]: value } }));
  };

  const updateAdditionalCertField = (idx: number, field: keyof CertFormEntry, value: string) => {
    setCertForm((prev) => ({
      ...prev,
      additionalCerts: prev.additionalCerts.map((c, i) => (i === idx ? { ...c, [field]: value } : c)),
    }));
  };

  const handleSaveCertificates = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProxyLB) return;
    setSavingCert(true);
    try {
      const result = await SetProxyLBCertificates(profile, selectedProxyLB.id, certForm as sakura.ProxyLBSetCertificatesInput);
      setCertificates(result);
      setShowCertForm(false);
    } catch (e) {
      alert(`証明書の設定に失敗しました: ${e}`);
    } finally {
      setSavingCert(false);
    }
  };

  const handleDeleteCertClick = () => setConfirmDeleteCert(true);
  const handleDeleteCertCancel = () => setConfirmDeleteCert(false);

  const handleDeleteCertConfirm = async () => {
    if (!selectedProxyLB) return;
    setConfirmDeleteCert(false);
    setDeletingCert(true);
    try {
      await DeleteProxyLBCertificates(profile, selectedProxyLB.id);
      setCertificates(null);
    } catch (e) {
      alert(`証明書の削除に失敗しました: ${e}`);
    } finally {
      setDeletingCert(false);
    }
  };

  const handleRenewCertClick = () => setConfirmRenewCert(true);
  const handleRenewCertCancel = () => setConfirmRenewCert(false);

  const handleRenewCertConfirm = async () => {
    if (!selectedProxyLB) return;
    setConfirmRenewCert(false);
    setRenewingCert(true);
    try {
      await RenewProxyLBLetsEncryptCert(profile, selectedProxyLB.id);
      await loadCertificates(selectedProxyLB.id);
    } catch (e) {
      alert(`Let's Encrypt証明書の更新に失敗しました: ${e}`);
    } finally {
      setRenewingCert(false);
    }
  };

  const handleCreateOpen = () => {
    setCreateForm(emptyCreateForm());
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
      const input = new sakura.ProxyLBCreateInput({
        name: createForm.name,
        description: createForm.description,
        plan: createForm.plan,
        region: createForm.region,
        useVipFailover: createForm.useVipFailover,
      });
      await CreateProxyLB(profile, input);
      setShowCreate(false);
      await loadProxyLBs();
    } catch (e) {
      setCreateError(String(e));
    } finally {
      setCreating(false);
    }
  };

  const handleBasicEditStart = () => {
    if (!selectedProxyLB) return;
    setNameInput(selectedProxyLB.name);
    setDescriptionInput(selectedProxyLB.description || '');
    setEditingBasic(true);
  };

  const handleBasicEditCancel = () => {
    setEditingBasic(false);
  };

  const handleBasicSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProxyLB) return;
    setSavingBasic(true);
    try {
      const updated = await UpdateProxyLB(profile, selectedProxyLB.id, nameInput, descriptionInput);
      setSelectedProxyLB(updated);
      setEditingBasic(false);
    } catch (e) {
      alert(`基本情報の更新に失敗しました: ${e}`);
    } finally {
      setSavingBasic(false);
    }
  };

  const handleSettingsEditOpen = () => {
    if (!selectedProxyLB) return;
    setSettingsError(null);
    setSettingsForm(toSettingsForm(selectedProxyLB));
  };

  const handleSettingsEditCancel = () => {
    setSettingsForm(null);
    setSettingsError(null);
  };

  const handleBindPortAdd = () => {
    if (!settingsForm) return;
    setSettingsForm({
      ...settingsForm,
      bindPorts: [...settingsForm.bindPorts, { proxyMode: 'http', port: '80', redirectToHttps: false, supportHttp2: false }],
    });
  };

  const handleBindPortRemove = (index: number) => {
    if (!settingsForm) return;
    setSettingsForm({ ...settingsForm, bindPorts: settingsForm.bindPorts.filter((_, i) => i !== index) });
  };

  const handleBindPortChange = (index: number, field: keyof BindPortFormRow, value: string | boolean) => {
    if (!settingsForm) return;
    setSettingsForm({
      ...settingsForm,
      bindPorts: settingsForm.bindPorts.map((bp, i) => (i === index ? { ...bp, [field]: value } : bp)),
    });
  };

  const handleServerAdd = () => {
    if (!settingsForm) return;
    setSettingsForm({
      ...settingsForm,
      servers: [...settingsForm.servers, { ipAddress: '', port: '80', serverGroup: '', enabled: true }],
    });
  };

  const handleServerRemove = (index: number) => {
    if (!settingsForm) return;
    setSettingsForm({ ...settingsForm, servers: settingsForm.servers.filter((_, i) => i !== index) });
  };

  const handleServerChange = (index: number, field: keyof ServerFormRow, value: string | boolean) => {
    if (!settingsForm) return;
    setSettingsForm({
      ...settingsForm,
      servers: settingsForm.servers.map((s, i) => (i === index ? { ...s, [field]: value } : s)),
    });
  };

  const handleSettingsSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settingsForm || !selectedProxyLB) return;

    const delayLoop = parseInt(settingsForm.healthCheckDelayLoop, 10);
    const bindPortNumbers = settingsForm.bindPorts.map((bp) => parseInt(bp.port, 10));
    const serverPorts = settingsForm.servers.map((s) => parseInt(s.port, 10));
    if ([delayLoop, ...bindPortNumbers, ...serverPorts].some(isNaN)) {
      setSettingsError('数値項目を正しく入力してください');
      return;
    }
    let sorryServerPort = 0;
    if (settingsForm.sorryServerIpAddress && settingsForm.sorryServerPort) {
      sorryServerPort = parseInt(settingsForm.sorryServerPort, 10);
      if (isNaN(sorryServerPort)) {
        setSettingsError('Sorry Serverのポートを正しく入力してください');
        return;
      }
    }

    const input = new sakura.ProxyLBSettingsInput({
      healthCheck: {
        protocol: settingsForm.healthCheckProtocol,
        path: settingsForm.healthCheckPath,
        host: settingsForm.healthCheckHost,
        delayLoop,
      },
      sorryServer: settingsForm.sorryServerIpAddress
        ? { ipAddress: settingsForm.sorryServerIpAddress, port: sorryServerPort }
        : undefined,
      bindPorts: settingsForm.bindPorts.map((bp, i) => ({
        proxyMode: bp.proxyMode,
        port: bindPortNumbers[i],
        redirectToHttps: bp.redirectToHttps,
        supportHttp2: bp.supportHttp2,
      })),
      servers: settingsForm.servers.map((s, i) => ({
        ipAddress: s.ipAddress,
        port: serverPorts[i],
        serverGroup: s.serverGroup,
        enabled: s.enabled,
      })),
    });

    setSavingSettings(true);
    setSettingsError(null);
    try {
      const updated = await UpdateProxyLBSettings(profile, selectedProxyLB.id, input);
      setSelectedProxyLB(updated);
      setSettingsForm(null);
    } catch (e) {
      setSettingsError(String(e));
    } finally {
      setSavingSettings(false);
    }
  };

  const handleChangePlanOpen = () => {
    if (!selectedProxyLB) return;
    const current = PLAN_OPTIONS.find((p) => selectedProxyLB.plan.includes(String(p)));
    setChangePlanValue(current ?? 100);
    setChangePlanError(null);
    setShowChangePlan(true);
  };

  const handleChangePlanCancel = () => {
    setShowChangePlan(false);
  };

  const handleChangePlanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProxyLB) return;
    setChangingPlan(true);
    setChangePlanError(null);
    try {
      const updated = await ChangeProxyLBPlan(profile, selectedProxyLB.id, changePlanValue);
      setSelectedProxyLB(updated);
      setShowChangePlan(false);
    } catch (e) {
      setChangePlanError(String(e));
    } finally {
      setChangingPlan(false);
    }
  };

  const formatCertDate = (dateString?: string) => {
    if (!dateString) return '-';
    return formatDate(dateString);
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

  const getRegionName = (region: string) => {
    switch (region) {
      case 'is1': return '石狩';
      case 'tk1': return '東京';
      case 'anycast': return 'エニーキャスト';
      default: return region;
    }
  };

  const getPlanName = (plan: string) => {
    switch (plan) {
      case '100': return '100 CPS';
      case '500': return '500 CPS';
      case '1000': return '1,000 CPS';
      case '5000': return '5,000 CPS';
      case '10000': return '10,000 CPS';
      case '50000': return '50,000 CPS';
      case '100000': return '100,000 CPS';
      case '400000': return '400,000 CPS';
      default: return plan;
    }
  };

  const getProxyModeName = (mode: string) => {
    switch (mode) {
      case 'http': return 'HTTP';
      case 'https': return 'HTTPS';
      case 'tcp': return 'TCP';
      default: return mode;
    }
  };

  // Detail View
  if (viewMode === 'detail' && selectedProxyLB) {
    return (
      <>
        <div className="header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              className="btn btn-secondary"
              onClick={handleBackToList}
              style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
            >
              ← 戻る
            </button>
            <h2>{selectedProxyLB.name}</h2>
          </div>
          <button
            className="btn btn-danger btn-small"
            onClick={handleDeleteClick}
            disabled={deleting}
          >
            {deleting ? '削除中...' : '削除'}
          </button>
        </div>

        {confirmDelete && (
          <div className="confirm-overlay" onClick={handleDeleteCancel}>
            <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
              <p>ELB「{selectedProxyLB.name}」を削除しますか？</p>
              <p className="confirm-warning">この操作は取り消せません。</p>
              <div className="confirm-actions">
                <button className="btn btn-secondary" onClick={handleDeleteCancel}>キャンセル</button>
                <button className="btn btn-danger" onClick={handleDeleteConfirm}>削除する</button>
              </div>
            </div>
          </div>
        )}

        {/* Basic Info */}
        <div className="card" style={{ marginBottom: '1rem', padding: '1rem', background: '#2a2a2a', borderRadius: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h4 style={{ color: '#00adb5', margin: 0 }}>基本情報</h4>
            <button className="btn btn-secondary btn-small" onClick={handleSettingsEditOpen}>設定を編集</button>
          </div>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <tbody>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', width: '150px', textAlign: 'left' }}>ID</td>
                <td style={{ padding: '0.5rem 0', fontFamily: 'monospace', textAlign: 'left' }}>{selectedProxyLB.id}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>名前 / 説明</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>
                  {editingBasic ? (
                    <form onSubmit={handleBasicSave} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <input
                        type="text"
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        placeholder="名前 *"
                        required
                        autoFocus
                      />
                      <input
                        type="text"
                        value={descriptionInput}
                        onChange={(e) => setDescriptionInput(e.target.value)}
                        placeholder="説明"
                      />
                      <button type="submit" className="btn btn-primary btn-small" disabled={savingBasic}>
                        {savingBasic ? '保存中...' : '保存'}
                      </button>
                      <button type="button" className="btn btn-secondary btn-small" onClick={handleBasicEditCancel} disabled={savingBasic}>キャンセル</button>
                    </form>
                  ) : (
                    <span style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      {selectedProxyLB.name} / {selectedProxyLB.description || '-'}
                      <button className="btn btn-secondary btn-small" onClick={handleBasicEditStart}>編集</button>
                    </span>
                  )}
                </td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>FQDN</td>
                <td style={{ padding: '0.5rem 0', fontFamily: 'monospace', color: '#00adb5', textAlign: 'left' }}>{selectedProxyLB.fqdn}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>VIP</td>
                <td style={{ padding: '0.5rem 0', fontFamily: 'monospace', textAlign: 'left' }}>{selectedProxyLB.virtualIPAddress}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>プラン</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>
                  <span style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {getPlanName(selectedProxyLB.plan)}
                    <button className="btn btn-secondary btn-small" onClick={handleChangePlanOpen}>プラン変更</button>
                  </span>
                </td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>リージョン</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{getRegionName(selectedProxyLB.region)}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>VIPフェイルオーバー</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{selectedProxyLB.useVIPFailover ? '有効' : '無効'}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>作成日</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{formatDate(selectedProxyLB.createdAt)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Health Check / Sorry Server */}
        {(selectedProxyLB.healthCheck || selectedProxyLB.sorryServer) && (
          <div className="card" style={{ marginBottom: '1rem', padding: '1rem', background: '#2a2a2a', borderRadius: '8px' }}>
            <h4 style={{ color: '#00adb5', marginTop: 0, marginBottom: '1rem' }}>ヘルスチェック / Sorry Server</h4>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <tbody>
                {selectedProxyLB.healthCheck && (
                  <>
                    <tr>
                      <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', width: '150px', textAlign: 'left' }}>プロトコル</td>
                      <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{selectedProxyLB.healthCheck.protocol}</td>
                    </tr>
                    {selectedProxyLB.healthCheck.protocol === 'http' && (
                      <>
                        <tr>
                          <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>パス</td>
                          <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{selectedProxyLB.healthCheck.path || '-'}</td>
                        </tr>
                        <tr>
                          <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>Hostヘッダー</td>
                          <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{selectedProxyLB.healthCheck.host || '-'}</td>
                        </tr>
                      </>
                    )}
                    <tr>
                      <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>監視間隔</td>
                      <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{selectedProxyLB.healthCheck.delayLoop}秒</td>
                    </tr>
                  </>
                )}
                {selectedProxyLB.sorryServer && (
                  <tr>
                    <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>Sorry Server</td>
                    <td style={{ padding: '0.5rem 0', fontFamily: 'monospace', textAlign: 'left' }}>
                      {selectedProxyLB.sorryServer.ipAddress}{selectedProxyLB.sorryServer.port ? `:${selectedProxyLB.sorryServer.port}` : ''}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Bind Ports */}
        <div className="card" style={{ marginBottom: '1rem', padding: '1rem', background: '#2a2a2a', borderRadius: '8px' }}>
          <h4 style={{ color: '#00adb5', marginTop: 0, marginBottom: '1rem' }}>待ち受けポート</h4>
          {selectedProxyLB.bindPorts && selectedProxyLB.bindPorts.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th>ポート</th>
                  <th>モード</th>
                  <th>HTTP/2</th>
                  <th>HTTPSリダイレクト</th>
                </tr>
              </thead>
              <tbody>
                {selectedProxyLB.bindPorts.map((bp, idx) => (
                  <tr key={idx}>
                    <td style={{ fontFamily: 'monospace' }}>{bp.port}</td>
                    <td>{getProxyModeName(bp.proxyMode)}</td>
                    <td>{bp.supportHttp2 ? '有効' : '-'}</td>
                    <td>{bp.redirectToHttps ? '有効' : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ color: '#666' }}>待ち受けポートがありません</div>
          )}
        </div>

        {/* Servers */}
        <div className="card" style={{ marginBottom: '1rem', padding: '1rem', background: '#2a2a2a', borderRadius: '8px' }}>
          <h4 style={{ color: '#00adb5', marginTop: 0, marginBottom: '1rem' }}>実サーバー</h4>
          {selectedProxyLB.servers && selectedProxyLB.servers.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th>IPアドレス</th>
                  <th>ポート</th>
                  <th>グループ</th>
                  <th>状態</th>
                </tr>
              </thead>
              <tbody>
                {selectedProxyLB.servers.map((srv, idx) => (
                  <tr key={idx}>
                    <td style={{ fontFamily: 'monospace' }}>{srv.ipAddress}</td>
                    <td style={{ fontFamily: 'monospace' }}>{srv.port}</td>
                    <td>{srv.serverGroup || 'default'}</td>
                    <td>
                      <span className={`status ${srv.enabled ? 'up' : 'down'}`}>
                        {srv.enabled ? '有効' : '無効'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ color: '#666' }}>実サーバーがありません</div>
          )}
        </div>

        {/* Health Status */}
        <div className="card" style={{ marginBottom: '1rem', padding: '1rem', background: '#2a2a2a', borderRadius: '8px' }}>
          <h4 style={{ color: '#00adb5', marginTop: 0, marginBottom: '1rem' }}>ヘルスステータス</h4>
          {loadingHealth ? (
            <div className="loading">読み込み中...</div>
          ) : health ? (
            <>
              <div style={{ marginBottom: '1rem', display: 'flex', gap: '2rem' }}>
                <div>
                  <span style={{ color: '#888' }}>アクティブ接続: </span>
                  <span style={{ fontFamily: 'monospace' }}>{health.activeConn}</span>
                </div>
                <div>
                  <span style={{ color: '#888' }}>CPS: </span>
                  <span style={{ fontFamily: 'monospace' }}>{health.cps.toFixed(2)}</span>
                </div>
                <div>
                  <span style={{ color: '#888' }}>現在のVIP: </span>
                  <span style={{ fontFamily: 'monospace' }}>{health.currentVip}</span>
                </div>
              </div>
              {health.servers && health.servers.length > 0 ? (
                <table className="table">
                  <thead>
                    <tr>
                      <th>IPアドレス</th>
                      <th>ポート</th>
                      <th>ステータス</th>
                      <th>アクティブ接続</th>
                      <th>CPS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {health.servers.map((srv, idx) => (
                      <tr key={idx}>
                        <td style={{ fontFamily: 'monospace' }}>{srv.ipAddress}</td>
                        <td style={{ fontFamily: 'monospace' }}>{srv.port}</td>
                        <td>
                          <span className={`status ${srv.status.toLowerCase() === 'up' ? 'up' : 'down'}`}>
                            {srv.status.toLowerCase() === 'up' ? 'UP' : srv.status.toLowerCase() === 'down' ? 'DOWN' : srv.status}
                          </span>
                        </td>
                        <td style={{ fontFamily: 'monospace' }}>{srv.activeConn}</td>
                        <td style={{ fontFamily: 'monospace' }}>{srv.cps.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ color: '#666' }}>サーバーステータスがありません</div>
              )}
            </>
          ) : (
            <div style={{ color: '#666' }}>ヘルスステータスを取得できませんでした</div>
          )}
        </div>

        {/* Traffic Graph */}
        <div className="card" style={{ marginBottom: '1rem', padding: '1rem', background: '#2a2a2a', borderRadius: '8px' }}>
          <h4 style={{ color: '#00adb5', marginTop: 0, marginBottom: '1rem' }}>トラフィックグラフ</h4>
          <ProxyLBConnectionGraph profile={profile} proxyLBId={selectedProxyLB.id} />
        </div>

        {/* Certificates */}
        <div className="card" style={{ marginBottom: '1rem', padding: '1rem', background: '#2a2a2a', borderRadius: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h4 style={{ color: '#00adb5', margin: 0 }}>SSL証明書</h4>
            {!showCertForm && (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-secondary btn-small" onClick={handleOpenCertForm}>
                  {certificates?.primaryCert ? '証明書を更新' : '証明書を設定'}
                </button>
                {certificates?.primaryCert && (
                  <>
                    <button
                      className="btn btn-secondary btn-small"
                      onClick={handleRenewCertClick}
                      disabled={renewingCert}
                    >
                      {renewingCert ? '更新中...' : "Let's Encryptで更新"}
                    </button>
                    <button
                      className="btn btn-danger btn-small"
                      onClick={handleDeleteCertClick}
                      disabled={deletingCert}
                    >
                      {deletingCert ? '削除中...' : '証明書を削除'}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {confirmDeleteCert && (
            <div className="confirm-overlay" onClick={handleDeleteCertCancel}>
              <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
                <p>SSL証明書を削除しますか？</p>
                <p className="confirm-warning">この操作は取り消せません。</p>
                <div className="confirm-actions">
                  <button className="btn btn-secondary" onClick={handleDeleteCertCancel}>キャンセル</button>
                  <button className="btn btn-danger" onClick={handleDeleteCertConfirm}>削除する</button>
                </div>
              </div>
            </div>
          )}

          {confirmRenewCert && (
            <div className="confirm-overlay" onClick={handleRenewCertCancel}>
              <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
                <p>Let's Encrypt証明書を更新しますか？</p>
                <div className="confirm-actions">
                  <button className="btn btn-secondary" onClick={handleRenewCertCancel}>キャンセル</button>
                  <button className="btn btn-primary" onClick={handleRenewCertConfirm}>更新する</button>
                </div>
              </div>
            </div>
          )}

          {loadingCertificates ? (
            <div className="loading">読み込み中...</div>
          ) : showCertForm ? (
            <form onSubmit={handleSaveCertificates}>
              <div style={{ marginBottom: '1rem' }}>
                <h5 style={{ color: '#ccc', marginBottom: '0.5rem' }}>プライマリ証明書</h5>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#888', marginBottom: '0.25rem' }}>サーバー証明書 (PEM)<span className="required-mark">*</span></label>
                <textarea
                  aria-label="プライマリ証明書 サーバー証明書 (PEM)"
                  value={certForm.primaryCert.serverCertificate}
                  onChange={(e) => updatePrimaryCertField('serverCertificate', e.target.value)}
                  rows={4}
                  required
                  style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.75rem', marginBottom: '0.5rem' }}
                />
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#888', marginBottom: '0.25rem' }}>中間証明書 (PEM)</label>
                <textarea
                  aria-label="プライマリ証明書 中間証明書 (PEM)"
                  value={certForm.primaryCert.intermediateCertificate}
                  onChange={(e) => updatePrimaryCertField('intermediateCertificate', e.target.value)}
                  rows={4}
                  style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.75rem', marginBottom: '0.5rem' }}
                />
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#888', marginBottom: '0.25rem' }}>秘密鍵 (PEM)<span className="required-mark">*</span></label>
                <textarea
                  aria-label="プライマリ証明書 秘密鍵 (PEM)"
                  value={certForm.primaryCert.privateKey}
                  onChange={(e) => updatePrimaryCertField('privateKey', e.target.value)}
                  rows={4}
                  required
                  style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.75rem' }}
                />
              </div>

              {certForm.additionalCerts.map((cert, idx) => (
                <div key={idx} style={{ marginBottom: '1rem', paddingTop: '0.5rem', borderTop: '1px solid #444' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <h5 style={{ color: '#ccc', margin: 0 }}>追加証明書 {idx + 1}</h5>
                    <button type="button" className="btn btn-secondary btn-small" onClick={() => handleRemoveAdditionalCert(idx)}>
                      削除
                    </button>
                  </div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: '#888', marginBottom: '0.25rem' }}>サーバー証明書 (PEM)<span className="required-mark">*</span></label>
                  <textarea
                    aria-label={`追加証明書 ${idx + 1} サーバー証明書 (PEM)`}
                    value={cert.serverCertificate}
                    onChange={(e) => updateAdditionalCertField(idx, 'serverCertificate', e.target.value)}
                    rows={4}
                    required
                    style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.75rem', marginBottom: '0.5rem' }}
                  />
                  <label style={{ display: 'block', fontSize: '0.75rem', color: '#888', marginBottom: '0.25rem' }}>中間証明書 (PEM)</label>
                  <textarea
                    aria-label={`追加証明書 ${idx + 1} 中間証明書 (PEM)`}
                    value={cert.intermediateCertificate}
                    onChange={(e) => updateAdditionalCertField(idx, 'intermediateCertificate', e.target.value)}
                    rows={4}
                    style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.75rem', marginBottom: '0.5rem' }}
                  />
                  <label style={{ display: 'block', fontSize: '0.75rem', color: '#888', marginBottom: '0.25rem' }}>秘密鍵 (PEM)<span className="required-mark">*</span></label>
                  <textarea
                    aria-label={`追加証明書 ${idx + 1} 秘密鍵 (PEM)`}
                    value={cert.privateKey}
                    onChange={(e) => updateAdditionalCertField(idx, 'privateKey', e.target.value)}
                    rows={4}
                    required
                    style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.75rem' }}
                  />
                </div>
              ))}

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
                <button type="button" className="btn btn-secondary btn-small" onClick={handleAddAdditionalCert}>
                  + 追加証明書を追加
                </button>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={handleCancelCertForm} disabled={savingCert}>
                    キャンセル
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={savingCert}>
                    {savingCert ? '保存中...' : '保存'}
                  </button>
                </div>
              </div>
            </form>
          ) : certificates?.primaryCert ? (
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <tbody>
                <tr>
                  <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', width: '150px', textAlign: 'left' }}>コモンネーム</td>
                  <td style={{ padding: '0.5rem 0', fontFamily: 'monospace', textAlign: 'left' }}>{certificates.primaryCert.certificateCommonName}</td>
                </tr>
                {certificates.primaryCert.certificateAltNames && (
                  <tr>
                    <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>SAN</td>
                    <td style={{ padding: '0.5rem 0', fontFamily: 'monospace', textAlign: 'left' }}>{certificates.primaryCert.certificateAltNames}</td>
                  </tr>
                )}
                <tr>
                  <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>有効期限</td>
                  <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{formatCertDate(certificates.primaryCert.certificateEndDate)}</td>
                </tr>
              </tbody>
            </table>
          ) : (
            <div style={{ color: '#666' }}>証明書が設定されていません</div>
          )}

          {!showCertForm && certificates?.additionalCerts && certificates.additionalCerts.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <h5 style={{ color: '#ccc', marginBottom: '0.5rem' }}>追加証明書</h5>
              <table className="table">
                <thead>
                  <tr>
                    <th>コモンネーム</th>
                    <th>SAN</th>
                    <th>有効期限</th>
                  </tr>
                </thead>
                <tbody>
                  {certificates.additionalCerts.map((cert, idx) => (
                    <tr key={idx}>
                      <td style={{ fontFamily: 'monospace' }}>{cert.certificateCommonName}</td>
                      <td style={{ fontFamily: 'monospace' }}>{cert.certificateAltNames}</td>
                      <td>{formatCertDate(cert.certificateEndDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {settingsForm && (
          <div className="modal-overlay" onClick={handleSettingsEditCancel} style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
              backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
              padding: '20px', minWidth: '360px', maxWidth: '620px', maxHeight: '85vh', overflowY: 'auto',
            }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>設定を編集</h3>

              <form onSubmit={handleSettingsSave}>
              <h4 style={{ color: '#00adb5', margin: '1rem 0' }}>ヘルスチェック</h4>
              <div className="form-group">
                <label>プロトコル</label>
                <select
                  value={settingsForm.healthCheckProtocol}
                  onChange={(e) => setSettingsForm({ ...settingsForm, healthCheckProtocol: e.target.value })}
                >
                  <option value="http">http</option>
                  <option value="tcp">tcp</option>
                </select>
              </div>
              {settingsForm.healthCheckProtocol === 'http' && (
                <>
                  <div className="form-group">
                    <label>パス</label>
                    <input
                      type="text"
                      value={settingsForm.healthCheckPath}
                      onChange={(e) => setSettingsForm({ ...settingsForm, healthCheckPath: e.target.value })}
                      placeholder="/"
                    />
                  </div>
                  <div className="form-group">
                    <label>Hostヘッダー</label>
                    <input
                      type="text"
                      value={settingsForm.healthCheckHost}
                      onChange={(e) => setSettingsForm({ ...settingsForm, healthCheckHost: e.target.value })}
                    />
                  </div>
                </>
              )}
              <div className="form-group">
                <label>監視間隔(秒)<span className="required-mark">*</span></label>
                <input
                  type="number"
                  value={settingsForm.healthCheckDelayLoop}
                  onChange={(e) => setSettingsForm({ ...settingsForm, healthCheckDelayLoop: e.target.value })}
                  min={10}
                  max={60}
                  step={1}
                  required
                />
              </div>

              <h4 style={{ color: '#00adb5', margin: '1rem 0' }}>Sorry Server</h4>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <div className="form-group" style={{ flex: 2 }}>
                  <label>IPアドレス</label>
                  <input
                    type="text"
                    value={settingsForm.sorryServerIpAddress}
                    onChange={(e) => setSettingsForm({ ...settingsForm, sorryServerIpAddress: e.target.value })}
                    placeholder="任意 (例: 192.0.2.1)"
                    pattern={IPV4_PATTERN}
                    title="IPv4アドレスの形式で入力してください"
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>ポート</label>
                  <input
                    type="number"
                    value={settingsForm.sorryServerPort}
                    onChange={(e) => setSettingsForm({ ...settingsForm, sorryServerPort: e.target.value })}
                    placeholder="任意"
                    min={1}
                    max={65535}
                    step={1}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '1rem 0' }}>
                <h4 style={{ color: '#00adb5', margin: 0 }}>待ち受けポート</h4>
                <button type="button" className="btn btn-secondary btn-small" onClick={handleBindPortAdd}>+ ポート追加</button>
              </div>
              {settingsForm.bindPorts.length === 0 ? (
                <p style={{ color: '#666', fontSize: '0.85rem' }}>待ち受けポートが登録されていません</p>
              ) : (
                settingsForm.bindPorts.map((bp, index) => (
                  <div key={index} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                    <select
                      value={bp.proxyMode}
                      onChange={(e) => handleBindPortChange(index, 'proxyMode', e.target.value)}
                    >
                      <option value="http">HTTP</option>
                      <option value="https">HTTPS</option>
                      <option value="tcp">TCP</option>
                    </select>
                    <input
                      type="number"
                      value={bp.port}
                      onChange={(e) => handleBindPortChange(index, 'port', e.target.value)}
                      placeholder="ポート *"
                      min={1}
                      max={65535}
                      step={1}
                      required
                      style={{ width: '90px' }}
                    />
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', whiteSpace: 'nowrap' }}>
                      <input
                        type="checkbox"
                        checked={bp.redirectToHttps}
                        onChange={(e) => handleBindPortChange(index, 'redirectToHttps', e.target.checked)}
                      />
                      HTTPSリダイレクト
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', whiteSpace: 'nowrap' }}>
                      <input
                        type="checkbox"
                        checked={bp.supportHttp2}
                        onChange={(e) => handleBindPortChange(index, 'supportHttp2', e.target.checked)}
                      />
                      HTTP/2
                    </label>
                    <button type="button" className="btn btn-danger btn-small" onClick={() => handleBindPortRemove(index)}>削除</button>
                  </div>
                ))
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '1rem 0' }}>
                <h4 style={{ color: '#00adb5', margin: 0 }}>実サーバー</h4>
                <button type="button" className="btn btn-secondary btn-small" onClick={handleServerAdd}>+ サーバー追加</button>
              </div>
              {settingsForm.servers.length === 0 ? (
                <p style={{ color: '#666', fontSize: '0.85rem' }}>実サーバーが登録されていません</p>
              ) : (
                settingsForm.servers.map((server, index) => (
                  <div key={index} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      value={server.ipAddress}
                      onChange={(e) => handleServerChange(index, 'ipAddress', e.target.value)}
                      placeholder="IPアドレス *"
                      pattern={IPV4_PATTERN}
                      title="IPv4アドレスの形式で入力してください"
                      required
                      style={{ flex: 2 }}
                    />
                    <input
                      type="number"
                      value={server.port}
                      onChange={(e) => handleServerChange(index, 'port', e.target.value)}
                      placeholder="ポート *"
                      min={1}
                      max={65535}
                      step={1}
                      required
                      style={{ width: '90px' }}
                    />
                    <input
                      type="text"
                      value={server.serverGroup}
                      onChange={(e) => handleServerChange(index, 'serverGroup', e.target.value)}
                      placeholder="グループ(任意)"
                      maxLength={10}
                      style={{ flex: 1 }}
                    />
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', whiteSpace: 'nowrap' }}>
                      <input
                        type="checkbox"
                        checked={server.enabled}
                        onChange={(e) => handleServerChange(index, 'enabled', e.target.checked)}
                      />
                      有効
                    </label>
                    <button type="button" className="btn btn-danger btn-small" onClick={() => handleServerRemove(index)}>削除</button>
                  </div>
                ))
              )}

              {settingsError && (
                <div style={{ marginTop: '1rem', marginBottom: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>
                  エラー: {settingsError}
                </div>
              )}
              <div className="confirm-actions">
                <button type="button" className="btn btn-secondary" onClick={handleSettingsEditCancel}>キャンセル</button>
                <button type="submit" className="btn btn-primary" disabled={savingSettings}>
                  {savingSettings ? '保存中...' : '保存する'}
                </button>
              </div>
              </form>
            </div>
          </div>
        )}

        {showChangePlan && (
          <div className="modal-overlay" onClick={handleChangePlanCancel} style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
              backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
              padding: '20px', minWidth: '320px', maxWidth: '420px',
            }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>プラン変更</h3>
              <form onSubmit={handleChangePlanSubmit}>
              <div className="form-group">
                <label htmlFor="proxylb-change-plan">プラン</label>
                <select
                  id="proxylb-change-plan"
                  value={changePlanValue}
                  onChange={(e) => setChangePlanValue(parseInt(e.target.value, 10))}
                >
                  {PLAN_OPTIONS.map((p) => (
                    <option key={p} value={p}>{getPlanName(String(p))}</option>
                  ))}
                </select>
              </div>
              <p style={{ color: '#888', fontSize: '0.85rem' }}>
                プランを変更すると、実サーバーへの接続が一時的に切断される場合があります。
              </p>
              {changePlanError && (
                <div style={{ marginBottom: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>
                  エラー: {changePlanError}
                </div>
              )}
              <div className="confirm-actions">
                <button type="button" className="btn btn-secondary" onClick={handleChangePlanCancel} disabled={changingPlan}>キャンセル</button>
                <button type="submit" className="btn btn-primary" disabled={changingPlan}>
                  {changingPlan ? '変更中...' : '変更する'}
                </button>
              </div>
              </form>
            </div>
          </div>
        )}
      </>
    );
  }

  // List View
  return (
    <>
      <div className="header">
        <h2>エンハンスドロードバランサ (ELB)</h2>
        <button className="btn btn-primary btn-small" onClick={handleCreateOpen}>+ ELB作成</button>
      </div>

      <SearchBar
        isSearching={isSearching}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        closeSearch={closeSearch}
        searchInputRef={searchInputRef}
        placeholder="名前、FQDN、VIP、タグで検索... (Escで閉じる)"
      />

      {loading ? (
        <div className="loading">読み込み中...</div>
      ) : filteredProxyLBs.length === 0 ? (
        <div className="empty-state">
          {searchQuery ? `「${searchQuery}」に一致するELBがありません` : 'エンハンスドロードバランサがありません'}
        </div>
      ) : (
        filteredProxyLBs.map((lb) => (
          <div
            key={lb.id}
            className="card"
            onClick={() => handleSelectProxyLB(lb)}
            style={{ cursor: 'pointer' }}
          >
            <div className="card-header">
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div className="card-title">{lb.name}</div>
                  <span className="status up" style={{ padding: '2px 6px', fontSize: '0.65rem' }}>
                    {getPlanName(lb.plan)}
                  </span>
                  <span style={{
                    padding: '2px 6px',
                    fontSize: '0.65rem',
                    backgroundColor: '#1a1a2e',
                    borderRadius: '3px',
                    color: '#888'
                  }}>
                    {getRegionName(lb.region)}
                  </span>
                </div>
                <div className="card-subtitle" style={{ marginTop: '2px', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'monospace', color: '#00adb5' }}>{lb.fqdn}</span>
                  <span style={{ color: '#555' }}>|</span>
                  <span style={{ fontFamily: 'monospace' }}>VIP: {lb.virtualIPAddress}</span>
                  {lb.bindPorts && lb.bindPorts.length > 0 && (
                    <>
                      <span style={{ color: '#555' }}>|</span>
                      <span>
                        ポート: {lb.bindPorts.map(bp => `${bp.port}/${bp.proxyMode}`).join(', ')}
                      </span>
                    </>
                  )}
                </div>
                {lb.servers && lb.servers.length > 0 && (
                  <div style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: '#888' }}>
                    実サーバー: {lb.servers.length}台
                    ({lb.servers.filter(s => s.enabled).length}台有効)
                  </div>
                )}
                {lb.tags && lb.tags.length > 0 && (
                  <div className="tags" style={{ marginTop: '0.25rem', display: 'flex', gap: '0.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    {lb.tags.map(tag => (
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
              <div style={{ fontSize: '0.7rem', color: '#666' }}>
                ID: {lb.id}
              </div>
            </div>
          </div>
        ))
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
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>ELB作成</h3>
            <form onSubmit={handleCreateSubmit}>
            <div className="form-group">
              <label>名前<span className="required-mark">*</span></label>
              <input
                type="text"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                placeholder="my-elb"
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>説明</label>
              <input
                type="text"
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                placeholder="任意"
              />
            </div>
            <div className="form-group">
              <label>プラン</label>
              <select
                value={createForm.plan}
                onChange={(e) => setCreateForm({ ...createForm, plan: parseInt(e.target.value, 10) })}
              >
                {PLAN_OPTIONS.map((p) => (
                  <option key={p} value={p}>{getPlanName(String(p))}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>リージョン</label>
              <select
                value={createForm.region}
                onChange={(e) => setCreateForm({ ...createForm, region: e.target.value })}
              >
                <option value="is1">{getRegionName('is1')}</option>
                <option value="tk1">{getRegionName('tk1')}</option>
                <option value="anycast">{getRegionName('anycast')}</option>
              </select>
            </div>
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={createForm.useVipFailover}
                  onChange={(e) => setCreateForm({ ...createForm, useVipFailover: e.target.checked })}
                  style={{ marginRight: '0.5rem' }}
                />
                VIPフェイルオーバーを有効にする
              </label>
            </div>
            <p style={{ color: '#888', fontSize: '0.85rem' }}>
              待ち受けポートや実サーバーの設定は作成後、詳細画面から設定できます。
            </p>
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
