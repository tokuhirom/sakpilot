import { useState, useEffect, useCallback } from 'react';
import {
  GetCloudHSMs,
  CreateCloudHSM,
  DeleteCloudHSM,
  GetCloudHSMLicenses,
  CreateCloudHSMLicense,
  DeleteCloudHSMLicense,
} from '../../wailsjs/go/main/App';
import { cloudhsm } from '../../wailsjs/go/models';
import { useSearch } from '../hooks/useSearch';
import { useGlobalReload } from '../hooks/useGlobalReload';
import { SearchBar } from './SearchBar';

interface CloudHSMListProps {
  profile: string;
  onSelectCloudHSM: (id: string) => void;
}

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

type MainTab = 'hsm' | 'license';

interface NewHSMForm {
  name: string;
  description: string;
  tags: string;
  ipv4NetworkAddress: string;
  ipv4PrefixLength: number;
}

const emptyHSMForm: NewHSMForm = {
  name: '',
  description: '',
  tags: '',
  ipv4NetworkAddress: '192.168.100.0',
  ipv4PrefixLength: 24,
};

interface NewLicenseForm {
  name: string;
  description: string;
  tags: string;
}

const emptyLicenseForm: NewLicenseForm = { name: '', description: '', tags: '' };

export function CloudHSMList({ profile, onSelectCloudHSM }: CloudHSMListProps) {
  const [tab, setTab] = useState<MainTab>('hsm');

  const [hsms, setHSMs] = useState<cloudhsm.CloudHSMInfo[]>([]);
  const [licenses, setLicenses] = useState<cloudhsm.LicenseInfo[]>([]);
  const [loading, setLoading] = useState(false);

  const [confirmDeleteHSM, setConfirmDeleteHSM] = useState<cloudhsm.CloudHSMInfo | null>(null);
  const [deletingHSM, setDeletingHSM] = useState<string | null>(null);

  const [confirmDeleteLicense, setConfirmDeleteLicense] = useState<cloudhsm.LicenseInfo | null>(null);
  const [deletingLicense, setDeletingLicense] = useState<string | null>(null);

  const [showCreateHSM, setShowCreateHSM] = useState(false);
  const [hsmForm, setHSMForm] = useState<NewHSMForm>(emptyHSMForm);
  const [creatingHSM, setCreatingHSM] = useState(false);
  const [hsmCreateError, setHSMCreateError] = useState<string | null>(null);

  const [showCreateLicense, setShowCreateLicense] = useState(false);
  const [licenseForm, setLicenseForm] = useState<NewLicenseForm>(emptyLicenseForm);
  const [creatingLicense, setCreatingLicense] = useState(false);
  const [licenseCreateError, setLicenseCreateError] = useState<string | null>(null);

  const {
    searchQuery,
    setSearchQuery,
    isSearching,
    searchInputRef,
    filteredItems: filteredHSMs,
    closeSearch,
  } = useSearch(hsms, (h, query) =>
    h.name.toLowerCase().includes(query) ||
    h.description?.toLowerCase().includes(query) ||
    h.tags?.some(tag => tag.toLowerCase().includes(query)) ||
    h.id.includes(query)
  );

  const loadData = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const [hsmList, licenseList] = await Promise.all([
        GetCloudHSMs(profile),
        GetCloudHSMLicenses(profile),
      ]);
      setHSMs(hsmList || []);
      setLicenses(licenseList || []);
    } catch (err) {
      console.error('[CloudHSMList] loadData error:', err);
      setHSMs([]);
      setLicenses([]);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useGlobalReload(loadData);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDeleteHSMConfirm = async () => {
    if (!confirmDeleteHSM) return;
    const target = confirmDeleteHSM;
    setConfirmDeleteHSM(null);
    setDeletingHSM(target.id);
    try {
      await DeleteCloudHSM(profile, target.id);
      await loadData();
    } catch (e) {
      alert(`削除に失敗しました: ${e}`);
    } finally {
      setDeletingHSM(null);
    }
  };

  const handleCreateHSMOpen = () => {
    setHSMForm(emptyHSMForm);
    setHSMCreateError(null);
    setShowCreateHSM(true);
  };

  const handleCreateHSMSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingHSM(true);
    setHSMCreateError(null);
    try {
      const tags = hsmForm.tags.split(',').map(t => t.trim()).filter(t => t);
      await CreateCloudHSM(profile, hsmForm.name, hsmForm.description, tags, hsmForm.ipv4NetworkAddress, hsmForm.ipv4PrefixLength);
      setShowCreateHSM(false);
      await loadData();
    } catch (e) {
      setHSMCreateError(String(e));
    } finally {
      setCreatingHSM(false);
    }
  };

  const handleDeleteLicenseConfirm = async () => {
    if (!confirmDeleteLicense) return;
    const target = confirmDeleteLicense;
    setConfirmDeleteLicense(null);
    setDeletingLicense(target.id);
    try {
      await DeleteCloudHSMLicense(profile, target.id);
      await loadData();
    } catch (e) {
      alert(`削除に失敗しました: ${e}`);
    } finally {
      setDeletingLicense(null);
    }
  };

  const handleCreateLicenseOpen = () => {
    setLicenseForm(emptyLicenseForm);
    setLicenseCreateError(null);
    setShowCreateLicense(true);
  };

  const handleCreateLicenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingLicense(true);
    setLicenseCreateError(null);
    try {
      const tags = licenseForm.tags.split(',').map(t => t.trim()).filter(t => t);
      await CreateCloudHSMLicense(profile, licenseForm.name, licenseForm.description, tags);
      setShowCreateLicense(false);
      await loadData();
    } catch (e) {
      setLicenseCreateError(String(e));
    } finally {
      setCreatingLicense(false);
    }
  };

  return (
    <>
      <div className="header">
        <h2>CloudHSM</h2>
        {tab === 'hsm' ? (
          <button className="btn btn-primary btn-small" onClick={handleCreateHSMOpen}>+ HSM作成</button>
        ) : (
          <button className="btn btn-primary btn-small" onClick={handleCreateLicenseOpen}>+ ライセンス作成</button>
        )}
      </div>

      <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem' }}>
        <button
          className={`btn ${tab === 'hsm' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setTab('hsm')}
        >
          HSM
        </button>
        <button
          className={`btn ${tab === 'license' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setTab('license')}
        >
          ソフトウェアライセンス
        </button>
      </div>

      {tab === 'hsm' && (
        <>
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
          ) : filteredHSMs.length === 0 ? (
            <div className="empty-state">
              {searchQuery ? `「${searchQuery}」に一致するCloudHSMがありません` : 'CloudHSMがありません'}
            </div>
          ) : (
            filteredHSMs.map((h) => (
              <div key={h.id} className="card" onClick={() => onSelectCloudHSM(h.id)} style={{ cursor: 'pointer' }}>
                <div className="card-header">
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div className="card-title">{h.name}</div>
                      <span className={`status ${h.availability.toLowerCase() === 'available' ? 'up' : 'down'}`} style={{ padding: '2px 6px', fontSize: '0.65rem' }}>
                        {h.availability}
                      </span>
                    </div>
                    <div className="card-subtitle" style={{ marginTop: '2px' }}>
                      {h.ipv4NetworkAddress}/{h.ipv4PrefixLength}(自HSMアドレス: {h.ipv4Address || '-'})
                    </div>
                    <div className="card-subtitle" style={{ marginTop: '2px' }}>
                      作成日: {formatDate(h.createdAt)}
                    </div>
                    {h.description && (
                      <div style={{ marginTop: '0.25rem', fontSize: '0.8rem', color: '#888' }}>
                        {h.description}
                      </div>
                    )}
                    {h.tags && h.tags.length > 0 && (
                      <div className="tags" style={{ marginTop: '0.25rem', display: 'flex', gap: '0.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        {h.tags.map(tag => (
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
                    ID: {h.id}
                    <button
                      className="btn btn-danger btn-small"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDeleteHSM(h);
                      }}
                      disabled={deletingHSM === h.id}
                      title="削除"
                    >
                      {deletingHSM === h.id ? '削除中...' : '削除'}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </>
      )}

      {tab === 'license' && (
        <>
          {loading ? (
            <div className="loading">読み込み中...</div>
          ) : licenses.length === 0 ? (
            <div className="empty-state">ソフトウェアライセンスがありません</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>名前</th>
                  <th>説明</th>
                  <th>タグ</th>
                  <th>作成日</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {licenses.map(l => (
                  <tr key={l.id}>
                    <td style={{ textAlign: 'left' }}>{l.name}</td>
                    <td style={{ textAlign: 'left' }}>{l.description || '-'}</td>
                    <td style={{ textAlign: 'left' }}>
                      {l.tags && l.tags.length > 0 ? (
                        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                          {l.tags.map(tag => (
                            <span key={tag} className="tag" style={{
                              backgroundColor: '#e2e8f0', padding: '0px 6px', borderRadius: '3px',
                              fontSize: '0.65rem', color: '#4a5568', border: '1px solid #cbd5e0'
                            }}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : '-'}
                    </td>
                    <td style={{ textAlign: 'left' }}>{formatDate(l.createdAt)}</td>
                    <td>
                      <button
                        className="btn btn-danger btn-small"
                        onClick={() => setConfirmDeleteLicense(l)}
                        disabled={deletingLicense === l.id}
                      >
                        {deletingLicense === l.id ? '削除中...' : '削除'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {confirmDeleteHSM && (
        <div className="confirm-overlay" onClick={() => setConfirmDeleteHSM(null)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <p>CloudHSM「{confirmDeleteHSM.name}」を削除しますか？</p>
            <p className="confirm-warning">この操作は取り消せません。</p>
            <div className="confirm-actions">
              <button className="btn btn-secondary" onClick={() => setConfirmDeleteHSM(null)}>キャンセル</button>
              <button className="btn btn-danger" onClick={handleDeleteHSMConfirm}>削除する</button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteLicense && (
        <div className="confirm-overlay" onClick={() => setConfirmDeleteLicense(null)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <p>ライセンス「{confirmDeleteLicense.name}」を削除しますか？</p>
            <p className="confirm-warning">この操作は取り消せません。</p>
            <div className="confirm-actions">
              <button className="btn btn-secondary" onClick={() => setConfirmDeleteLicense(null)}>キャンセル</button>
              <button className="btn btn-danger" onClick={handleDeleteLicenseConfirm}>削除する</button>
            </div>
          </div>
        </div>
      )}

      {showCreateHSM && (
        <div className="modal-overlay" onClick={() => setShowCreateHSM(false)} style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
            backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
            padding: '20px', minWidth: '320px', maxWidth: '480px',
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>CloudHSM作成</h3>
            <form onSubmit={handleCreateHSMSubmit}>
              <div className="form-group">
                <label>名前<span className="required-mark">*</span></label>
                <input
                  type="text"
                  value={hsmForm.name}
                  onChange={(e) => setHSMForm({ ...hsmForm, name: e.target.value })}
                  placeholder="my-hsm"
                  autoFocus
                  required
                />
              </div>
              <div className="form-group">
                <label>説明</label>
                <input
                  type="text"
                  value={hsmForm.description}
                  onChange={(e) => setHSMForm({ ...hsmForm, description: e.target.value })}
                  placeholder="任意"
                />
              </div>
              <div className="form-group">
                <label>IPv4ネットワークアドレス<span className="required-mark">*</span></label>
                <input
                  type="text"
                  value={hsmForm.ipv4NetworkAddress}
                  onChange={(e) => setHSMForm({ ...hsmForm, ipv4NetworkAddress: e.target.value })}
                  placeholder="192.168.100.0"
                  pattern="^(\d{1,3}\.){3}\d{1,3}$"
                  title="例: 192.168.100.0"
                  required
                />
              </div>
              <div className="form-group">
                <label>プレフィックス長<span className="required-mark">*</span></label>
                <input
                  type="number"
                  value={hsmForm.ipv4PrefixLength}
                  onChange={(e) => setHSMForm({ ...hsmForm, ipv4PrefixLength: Number(e.target.value) })}
                  min={1}
                  max={32}
                  required
                />
              </div>
              <div className="form-group">
                <label>タグ</label>
                <input
                  type="text"
                  value={hsmForm.tags}
                  onChange={(e) => setHSMForm({ ...hsmForm, tags: e.target.value })}
                  placeholder="任意(カンマ区切り)"
                />
              </div>
              {hsmCreateError && (
                <div style={{ marginBottom: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>
                  エラー: {hsmCreateError}
                </div>
              )}
              <div className="confirm-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateHSM(false)}>キャンセル</button>
                <button type="submit" className="btn btn-primary" disabled={creatingHSM}>
                  {creatingHSM ? '作成中...' : '作成する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCreateLicense && (
        <div className="modal-overlay" onClick={() => setShowCreateLicense(false)} style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
            backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
            padding: '20px', minWidth: '320px', maxWidth: '480px',
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>ソフトウェアライセンス作成</h3>
            <form onSubmit={handleCreateLicenseSubmit}>
              <div className="form-group">
                <label>名前<span className="required-mark">*</span></label>
                <input
                  type="text"
                  value={licenseForm.name}
                  onChange={(e) => setLicenseForm({ ...licenseForm, name: e.target.value })}
                  placeholder="my-license"
                  autoFocus
                  required
                />
              </div>
              <div className="form-group">
                <label>説明</label>
                <input
                  type="text"
                  value={licenseForm.description}
                  onChange={(e) => setLicenseForm({ ...licenseForm, description: e.target.value })}
                  placeholder="任意"
                />
              </div>
              <div className="form-group">
                <label>タグ</label>
                <input
                  type="text"
                  value={licenseForm.tags}
                  onChange={(e) => setLicenseForm({ ...licenseForm, tags: e.target.value })}
                  placeholder="任意(カンマ区切り)"
                />
              </div>
              {licenseCreateError && (
                <div style={{ marginBottom: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>
                  エラー: {licenseCreateError}
                </div>
              )}
              <div className="confirm-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateLicense(false)}>キャンセル</button>
                <button type="submit" className="btn btn-primary" disabled={creatingLicense}>
                  {creatingLicense ? '作成中...' : '作成する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
