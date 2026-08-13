import { useState, useEffect, useCallback } from 'react';
import {
  GetCloudHSM,
  UpdateCloudHSM,
  GetCloudHSMClients,
  CreateCloudHSMClient,
  UpdateCloudHSMClient,
  DeleteCloudHSMClient,
  GetCloudHSMPeers,
  CreateCloudHSMPeer,
  DeleteCloudHSMPeer,
} from '../../wailsjs/go/main/App';
import { cloudhsm } from '../../wailsjs/go/models';
import { useGlobalReload } from '../hooks/useGlobalReload';

interface CloudHSMDetailProps {
  profile: string;
  hsmId: string;
}

type SubPage = 'clients' | 'peers';

const TAB_LABEL: Record<SubPage, string> = {
  clients: '接続クライアント',
  peers: 'ピア',
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

interface ClientCreateForm {
  name: string;
  certificate: string;
}

const emptyClientCreateForm: ClientCreateForm = { name: '', certificate: '' };

interface ClientEditForm {
  id: string;
  name: string;
}

interface PeerCreateForm {
  routerId: string;
  secretKey: string;
}

const emptyPeerCreateForm: PeerCreateForm = { routerId: '', secretKey: '' };

export function CloudHSMDetail({ profile, hsmId }: CloudHSMDetailProps) {
  const [hsm, setHSM] = useState<cloudhsm.CloudHSMInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [subPage, setSubPage] = useState<SubPage>('clients');

  const [clients, setClients] = useState<cloudhsm.ClientInfo[]>([]);
  const [peers, setPeers] = useState<cloudhsm.PeerInfo[]>([]);

  const [editingBasic, setEditingBasic] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [descriptionInput, setDescriptionInput] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [savingBasic, setSavingBasic] = useState(false);
  const [basicError, setBasicError] = useState<string | null>(null);

  const [clientCreateForm, setClientCreateForm] = useState<ClientCreateForm | null>(null);
  const [savingClientCreate, setSavingClientCreate] = useState(false);
  const [clientCreateError, setClientCreateError] = useState<string | null>(null);

  const [clientEditForm, setClientEditForm] = useState<ClientEditForm | null>(null);
  const [savingClientEdit, setSavingClientEdit] = useState(false);
  const [clientEditError, setClientEditError] = useState<string | null>(null);

  const [confirmDeleteClient, setConfirmDeleteClient] = useState<cloudhsm.ClientInfo | null>(null);
  const [deletingClient, setDeletingClient] = useState<string | null>(null);

  const [peerCreateForm, setPeerCreateForm] = useState<PeerCreateForm | null>(null);
  const [savingPeerCreate, setSavingPeerCreate] = useState(false);
  const [peerCreateError, setPeerCreateError] = useState<string | null>(null);

  const [confirmDeletePeer, setConfirmDeletePeer] = useState<cloudhsm.PeerInfo | null>(null);
  const [deletingPeer, setDeletingPeer] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!profile || !hsmId) return;
    setLoading(true);
    try {
      const [h, clientList, peerList] = await Promise.all([
        GetCloudHSM(profile, hsmId),
        GetCloudHSMClients(profile, hsmId),
        GetCloudHSMPeers(profile, hsmId),
      ]);
      setHSM(h);
      setClients(clientList || []);
      setPeers(peerList || []);
    } catch (err) {
      console.error('[CloudHSMDetail] loadData error:', err);
    } finally {
      setLoading(false);
    }
  }, [profile, hsmId]);

  useGlobalReload(loadData);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleBasicEditStart = () => {
    if (!hsm) return;
    setNameInput(hsm.name);
    setDescriptionInput(hsm.description || '');
    setTagsInput((hsm.tags || []).join(', '));
    setBasicError(null);
    setEditingBasic(true);
  };

  const handleBasicSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBasic(true);
    setBasicError(null);
    try {
      const tags = tagsInput.split(',').map(t => t.trim()).filter(t => t);
      const updated = await UpdateCloudHSM(profile, hsmId, nameInput, descriptionInput, tags);
      setHSM(updated);
      setEditingBasic(false);
    } catch (e) {
      setBasicError(String(e));
    } finally {
      setSavingBasic(false);
    }
  };

  const handleClientCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientCreateForm) return;
    setSavingClientCreate(true);
    setClientCreateError(null);
    try {
      await CreateCloudHSMClient(profile, hsmId, clientCreateForm.name, clientCreateForm.certificate);
      setClientCreateForm(null);
      await loadData();
    } catch (e) {
      setClientCreateError(String(e));
    } finally {
      setSavingClientCreate(false);
    }
  };

  const handleClientEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientEditForm) return;
    setSavingClientEdit(true);
    setClientEditError(null);
    try {
      await UpdateCloudHSMClient(profile, hsmId, clientEditForm.id, clientEditForm.name);
      setClientEditForm(null);
      await loadData();
    } catch (e) {
      setClientEditError(String(e));
    } finally {
      setSavingClientEdit(false);
    }
  };

  const handleDeleteClientConfirm = async () => {
    if (!confirmDeleteClient) return;
    const target = confirmDeleteClient;
    setConfirmDeleteClient(null);
    setDeletingClient(target.id);
    try {
      await DeleteCloudHSMClient(profile, hsmId, target.id);
      await loadData();
    } catch (e) {
      alert(`削除に失敗しました: ${e}`);
    } finally {
      setDeletingClient(null);
    }
  };

  const handlePeerCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!peerCreateForm) return;
    setSavingPeerCreate(true);
    setPeerCreateError(null);
    try {
      await CreateCloudHSMPeer(profile, hsmId, peerCreateForm.routerId, peerCreateForm.secretKey);
      setPeerCreateForm(null);
      await loadData();
    } catch (e) {
      setPeerCreateError(String(e));
    } finally {
      setSavingPeerCreate(false);
    }
  };

  const handleDeletePeerConfirm = async () => {
    if (!confirmDeletePeer) return;
    const target = confirmDeletePeer;
    setConfirmDeletePeer(null);
    setDeletingPeer(target.id);
    try {
      await DeleteCloudHSMPeer(profile, hsmId, target.id);
      await loadData();
    } catch (e) {
      alert(`削除に失敗しました: ${e}`);
    } finally {
      setDeletingPeer(null);
    }
  };

  if (loading && !hsm) return <div className="loading">読み込み中...</div>;
  if (!hsm) return <div className="empty-state">CloudHSM情報が見つかりません</div>;

  return (
    <div className="cloudhsm-detail">
      <div className="header">
        <h2>CloudHSM詳細: {hsm.name}</h2>
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
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{hsm.id}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>説明</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{hsm.description || '-'}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>状態</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>
                  <span className={`status ${hsm.availability.toLowerCase() === 'available' ? 'up' : 'down'}`}>{hsm.availability}</span>
                </td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>IPv4ネットワーク</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{hsm.ipv4NetworkAddress}/{hsm.ipv4PrefixLength}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>HSM自身のIPv4アドレス</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{hsm.ipv4Address || '-'}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>作成日</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{formatDate(hsm.createdAt)}</td>
              </tr>
              {hsm.tags && hsm.tags.length > 0 && (
                <tr>
                  <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>タグ</td>
                  <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>
                    <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                      {hsm.tags.map(tag => (
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

      {subPage === 'clients' && (
        <>
          <div className="header">
            <h3 style={{ margin: 0 }}>接続クライアント一覧</h3>
            <button
              className="btn btn-primary btn-small"
              onClick={() => { setClientCreateError(null); setClientCreateForm({ ...emptyClientCreateForm }); }}
            >
              + クライアント作成
            </button>
          </div>
          {clients.length === 0 ? (
            <div className="empty-state">接続クライアントがありません</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>名前</th>
                  <th>状態</th>
                  <th>作成日</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {clients.map(c => (
                  <tr key={c.id}>
                    <td style={{ textAlign: 'left' }}>{c.name}</td>
                    <td style={{ textAlign: 'left' }}>
                      <span className={`status ${c.availability.toLowerCase() === 'available' ? 'up' : 'down'}`}>{c.availability}</span>
                    </td>
                    <td style={{ textAlign: 'left' }}>{formatDate(c.createdAt)}</td>
                    <td>
                      <button
                        className="btn btn-secondary btn-small"
                        style={{ marginRight: '0.5rem' }}
                        onClick={() => { setClientEditError(null); setClientEditForm({ id: c.id, name: c.name }); }}
                      >
                        編集
                      </button>
                      <button
                        className="btn btn-danger btn-small"
                        onClick={() => setConfirmDeleteClient(c)}
                        disabled={deletingClient === c.id}
                      >
                        {deletingClient === c.id ? '削除中...' : '削除'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {subPage === 'peers' && (
        <>
          <div className="header">
            <h3 style={{ margin: 0 }}>ピア一覧</h3>
            <button
              className="btn btn-primary btn-small"
              onClick={() => { setPeerCreateError(null); setPeerCreateForm({ ...emptyPeerCreateForm }); }}
            >
              + ピア作成
            </button>
          </div>
          {peers.length === 0 ? (
            <div className="empty-state">ピアがありません</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>ルーターID</th>
                  <th>状態</th>
                  <th>ルート</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {peers.map(p => (
                  <tr key={p.id}>
                    <td style={{ textAlign: 'left' }}>{p.id}</td>
                    <td style={{ textAlign: 'left' }}>
                      <span className={`status ${p.status.toLowerCase() === 'up' ? 'up' : 'down'}`}>{p.status || '-'}</span>
                    </td>
                    <td style={{ textAlign: 'left' }}>{p.routes && p.routes.length > 0 ? p.routes.join(', ') : '-'}</td>
                    <td>
                      <button
                        className="btn btn-danger btn-small"
                        onClick={() => setConfirmDeletePeer(p)}
                        disabled={deletingPeer === p.id}
                      >
                        {deletingPeer === p.id ? '削除中...' : '削除'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {clientCreateForm && (
        <div className="modal-overlay" onClick={() => setClientCreateForm(null)} style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
            backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
            padding: '20px', minWidth: '320px', maxWidth: '560px',
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>接続クライアント作成</h3>
            <form onSubmit={handleClientCreateSubmit}>
              <div className="form-group">
                <label>名前<span className="required-mark">*</span></label>
                <input
                  type="text"
                  value={clientCreateForm.name}
                  onChange={(e) => setClientCreateForm({ ...clientCreateForm, name: e.target.value })}
                  placeholder="app-client"
                  autoFocus
                  required
                />
              </div>
              <div className="form-group">
                <label>証明書(PEM)<span className="required-mark">*</span></label>
                <textarea
                  value={clientCreateForm.certificate}
                  onChange={(e) => setClientCreateForm({ ...clientCreateForm, certificate: e.target.value })}
                  rows={10}
                  style={{ fontFamily: 'monospace', fontSize: '0.8rem', width: '100%' }}
                  placeholder="-----BEGIN CERTIFICATE-----..."
                  required
                />
              </div>
              {clientCreateError && (
                <div style={{ marginBottom: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>エラー: {clientCreateError}</div>
              )}
              <div className="confirm-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setClientCreateForm(null)}>キャンセル</button>
                <button type="submit" className="btn btn-primary" disabled={savingClientCreate}>
                  {savingClientCreate ? '作成中...' : '作成する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {clientEditForm && (
        <div className="modal-overlay" onClick={() => setClientEditForm(null)} style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
            backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
            padding: '20px', minWidth: '320px', maxWidth: '420px',
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>接続クライアント編集</h3>
            <form onSubmit={handleClientEditSubmit}>
              <div className="form-group">
                <label>名前<span className="required-mark">*</span></label>
                <input
                  type="text"
                  value={clientEditForm.name}
                  onChange={(e) => setClientEditForm({ ...clientEditForm, name: e.target.value })}
                  autoFocus
                  required
                />
              </div>
              {clientEditError && (
                <div style={{ marginBottom: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>エラー: {clientEditError}</div>
              )}
              <div className="confirm-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setClientEditForm(null)}>キャンセル</button>
                <button type="submit" className="btn btn-primary" disabled={savingClientEdit}>
                  {savingClientEdit ? '保存中...' : '保存する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {peerCreateForm && (
        <div className="modal-overlay" onClick={() => setPeerCreateForm(null)} style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
            backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
            padding: '20px', minWidth: '320px', maxWidth: '420px',
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>ピア作成</h3>
            <form onSubmit={handlePeerCreateSubmit}>
              <div className="form-group">
                <label>ルーターID<span className="required-mark">*</span></label>
                <input
                  type="text"
                  value={peerCreateForm.routerId}
                  onChange={(e) => setPeerCreateForm({ ...peerCreateForm, routerId: e.target.value })}
                  placeholder="対向ルーターのID"
                  autoFocus
                  required
                />
              </div>
              <div className="form-group">
                <label>シークレットキー<span className="required-mark">*</span></label>
                <input
                  type="password"
                  value={peerCreateForm.secretKey}
                  onChange={(e) => setPeerCreateForm({ ...peerCreateForm, secretKey: e.target.value })}
                  placeholder="対向ルーターと共有するシークレットキー"
                  required
                />
              </div>
              {peerCreateError && (
                <div style={{ marginBottom: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>エラー: {peerCreateError}</div>
              )}
              <div className="confirm-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setPeerCreateForm(null)}>キャンセル</button>
                <button type="submit" className="btn btn-primary" disabled={savingPeerCreate}>
                  {savingPeerCreate ? '作成中...' : '作成する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDeleteClient && (
        <div className="confirm-overlay" onClick={() => setConfirmDeleteClient(null)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <p>接続クライアント「{confirmDeleteClient.name}」を削除しますか？</p>
            <p className="confirm-warning">この操作は取り消せません。</p>
            <div className="confirm-actions">
              <button className="btn btn-secondary" onClick={() => setConfirmDeleteClient(null)}>キャンセル</button>
              <button className="btn btn-danger" onClick={handleDeleteClientConfirm}>削除する</button>
            </div>
          </div>
        </div>
      )}

      {confirmDeletePeer && (
        <div className="confirm-overlay" onClick={() => setConfirmDeletePeer(null)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <p>ピア「{confirmDeletePeer.id}」を削除しますか？</p>
            <p className="confirm-warning">この操作は取り消せません。</p>
            <div className="confirm-actions">
              <button className="btn btn-secondary" onClick={() => setConfirmDeletePeer(null)}>キャンセル</button>
              <button className="btn btn-danger" onClick={handleDeletePeerConfirm}>削除する</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
