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
} from '../../wailsjs/go/main/App';
import { sakura } from '../../wailsjs/go/models';
import { useSearch } from '../hooks/useSearch';
import { useGlobalReload } from '../hooks/useGlobalReload';
import { SearchBar } from './SearchBar';

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

  const handleSaveCertificates = async () => {
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
    if (plan.includes('100')) return '100 CPS';
    if (plan.includes('500')) return '500 CPS';
    if (plan.includes('1000')) return '1,000 CPS';
    if (plan.includes('5000')) return '5,000 CPS';
    if (plan.includes('10000')) return '10,000 CPS';
    if (plan.includes('50000')) return '50,000 CPS';
    if (plan.includes('100000')) return '100,000 CPS';
    if (plan.includes('400000')) return '400,000 CPS';
    return plan;
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
          <h4 style={{ color: '#00adb5', marginTop: 0, marginBottom: '1rem' }}>基本情報</h4>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <tbody>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', width: '150px', textAlign: 'left' }}>ID</td>
                <td style={{ padding: '0.5rem 0', fontFamily: 'monospace', textAlign: 'left' }}>{selectedProxyLB.id}</td>
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
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{getPlanName(selectedProxyLB.plan)}</td>
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
            <div>
              <div style={{ marginBottom: '1rem' }}>
                <h5 style={{ color: '#ccc', marginBottom: '0.5rem' }}>プライマリ証明書</h5>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#888', marginBottom: '0.25rem' }}>サーバー証明書 (PEM)</label>
                <textarea
                  aria-label="プライマリ証明書 サーバー証明書 (PEM)"
                  value={certForm.primaryCert.serverCertificate}
                  onChange={(e) => updatePrimaryCertField('serverCertificate', e.target.value)}
                  rows={4}
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
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#888', marginBottom: '0.25rem' }}>秘密鍵 (PEM)</label>
                <textarea
                  aria-label="プライマリ証明書 秘密鍵 (PEM)"
                  value={certForm.primaryCert.privateKey}
                  onChange={(e) => updatePrimaryCertField('privateKey', e.target.value)}
                  rows={4}
                  style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.75rem' }}
                />
              </div>

              {certForm.additionalCerts.map((cert, idx) => (
                <div key={idx} style={{ marginBottom: '1rem', paddingTop: '0.5rem', borderTop: '1px solid #444' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <h5 style={{ color: '#ccc', margin: 0 }}>追加証明書 {idx + 1}</h5>
                    <button className="btn btn-secondary btn-small" onClick={() => handleRemoveAdditionalCert(idx)}>
                      削除
                    </button>
                  </div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: '#888', marginBottom: '0.25rem' }}>サーバー証明書 (PEM)</label>
                  <textarea
                    aria-label={`追加証明書 ${idx + 1} サーバー証明書 (PEM)`}
                    value={cert.serverCertificate}
                    onChange={(e) => updateAdditionalCertField(idx, 'serverCertificate', e.target.value)}
                    rows={4}
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
                  <label style={{ display: 'block', fontSize: '0.75rem', color: '#888', marginBottom: '0.25rem' }}>秘密鍵 (PEM)</label>
                  <textarea
                    aria-label={`追加証明書 ${idx + 1} 秘密鍵 (PEM)`}
                    value={cert.privateKey}
                    onChange={(e) => updateAdditionalCertField(idx, 'privateKey', e.target.value)}
                    rows={4}
                    style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.75rem' }}
                  />
                </div>
              ))}

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
                <button className="btn btn-secondary btn-small" onClick={handleAddAdditionalCert}>
                  + 追加証明書を追加
                </button>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-secondary" onClick={handleCancelCertForm} disabled={savingCert}>
                    キャンセル
                  </button>
                  <button className="btn btn-primary" onClick={handleSaveCertificates} disabled={savingCert}>
                    {savingCert ? '保存中...' : '保存'}
                  </button>
                </div>
              </div>
            </div>
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
      </>
    );
  }

  // List View
  return (
    <>
      <div className="header">
        <h2>エンハンスドロードバランサ (ELB)</h2>
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
    </>
  );
}
