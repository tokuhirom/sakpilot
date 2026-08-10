import { useState, useEffect, useCallback } from 'react';
import {
  GetApigwService,
  UpdateApigwService,
  GetApigwRoutes,
  CreateApigwRoute,
  UpdateApigwRoute,
  DeleteApigwRoute,
} from '../../wailsjs/go/main/App';
import { apigw } from '../../wailsjs/go/models';
import { useGlobalReload } from '../hooks/useGlobalReload';

interface ApigwServiceDetailProps {
  profile: string;
  serviceId: string;
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

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD', 'CONNECT', 'TRACE'];
const HTTPS_REDIRECT_CODES = [301, 302, 303, 307, 308, 426];

const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
  alignItems: 'center', justifyContent: 'center', zIndex: 1000,
};

const modalContentStyle: React.CSSProperties = {
  backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
  padding: '20px', minWidth: '320px', maxWidth: '560px', maxHeight: '85vh', overflowY: 'auto',
};

interface RouteFormState {
  id: string | null;
  name: string;
  protocols: string;
  path: string;
  hosts: string;
  methods: string[];
  httpsRedirectStatusCode: number;
  regexPriority: number;
  stripPath: boolean;
  preserveHost: boolean;
  tags: string;
}

const emptyRouteForm: RouteFormState = {
  id: null, name: '', protocols: 'http,https', path: '/', hosts: '', methods: [],
  httpsRedirectStatusCode: 0, regexPriority: 0, stripPath: true, preserveHost: false, tags: '',
};

const parseTags = (value: string) => value.split(',').map(t => t.trim()).filter(t => t);

export function ApigwServiceDetail({ profile, serviceId }: ApigwServiceDetailProps) {
  const [service, setService] = useState<apigw.ServiceInfo | null>(null);
  const [routes, setRoutes] = useState<apigw.RouteInfo[]>([]);
  const [loading, setLoading] = useState(false);

  const [editingBasic, setEditingBasic] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [protocolInput, setProtocolInput] = useState('https');
  const [hostInput, setHostInput] = useState('');
  const [pathInput, setPathInput] = useState('/');
  const [portInput, setPortInput] = useState(443);
  const [retriesInput, setRetriesInput] = useState(3);
  const [connectTimeoutInput, setConnectTimeoutInput] = useState(5);
  const [writeTimeoutInput, setWriteTimeoutInput] = useState(60);
  const [readTimeoutInput, setReadTimeoutInput] = useState(60);
  const [savingBasic, setSavingBasic] = useState(false);
  const [basicError, setBasicError] = useState<string | null>(null);

  const [routeForm, setRouteForm] = useState<RouteFormState | null>(null);
  const [savingRoute, setSavingRoute] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [confirmDeleteRoute, setConfirmDeleteRoute] = useState<apigw.RouteInfo | null>(null);
  const [deletingRoute, setDeletingRoute] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!profile || !serviceId) return;
    setLoading(true);
    try {
      const [svc, rts] = await Promise.all([
        GetApigwService(profile, serviceId),
        GetApigwRoutes(profile, serviceId),
      ]);
      setService(svc);
      setRoutes(rts || []);
    } catch (err) {
      console.error('[ApigwServiceDetail] loadData error:', err);
    } finally {
      setLoading(false);
    }
  }, [profile, serviceId]);

  useGlobalReload(loadData);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleBasicEditStart = () => {
    if (!service) return;
    setNameInput(service.name);
    setProtocolInput(service.protocol);
    setHostInput(service.host);
    setPathInput(service.path || '/');
    setPortInput(service.port);
    setRetriesInput(service.retries);
    setConnectTimeoutInput(service.connectTimeout);
    setWriteTimeoutInput(service.writeTimeout);
    setReadTimeoutInput(service.readTimeout);
    setBasicError(null);
    setEditingBasic(true);
  };

  const handleBasicSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBasic(true);
    setBasicError(null);
    try {
      await UpdateApigwService(
        profile, serviceId, nameInput, protocolInput, hostInput, pathInput,
        portInput, retriesInput, connectTimeoutInput, writeTimeoutInput, readTimeoutInput,
      );
      const updated = await GetApigwService(profile, serviceId);
      setService(updated);
      setEditingBasic(false);
    } catch (e) {
      setBasicError(String(e));
    } finally {
      setSavingBasic(false);
    }
  };

  const handleRouteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!routeForm) return;
    setSavingRoute(true);
    setRouteError(null);
    try {
      const hosts = parseTags(routeForm.hosts);
      const tags = parseTags(routeForm.tags);
      if (routeForm.id) {
        await UpdateApigwRoute(
          profile, serviceId, routeForm.id, routeForm.name, routeForm.protocols, routeForm.path,
          hosts, routeForm.methods, routeForm.httpsRedirectStatusCode, routeForm.regexPriority,
          routeForm.stripPath, routeForm.preserveHost, tags,
        );
      } else {
        await CreateApigwRoute(
          profile, serviceId, routeForm.name, routeForm.protocols, routeForm.path,
          hosts, routeForm.methods, routeForm.httpsRedirectStatusCode, routeForm.regexPriority,
          routeForm.stripPath, routeForm.preserveHost, tags,
        );
      }
      setRouteForm(null);
      await loadData();
    } catch (e) {
      setRouteError(String(e));
    } finally {
      setSavingRoute(false);
    }
  };

  const handleDeleteRouteConfirm = async () => {
    if (!confirmDeleteRoute) return;
    const target = confirmDeleteRoute;
    setConfirmDeleteRoute(null);
    setDeletingRoute(target.id);
    try {
      await DeleteApigwRoute(profile, serviceId, target.id);
      await loadData();
    } catch (e) {
      alert(`削除に失敗しました: ${e}`);
    } finally {
      setDeletingRoute(null);
    }
  };

  const toggleMethod = (method: string) => {
    if (!routeForm) return;
    const methods = routeForm.methods.includes(method)
      ? routeForm.methods.filter(m => m !== method)
      : [...routeForm.methods, method];
    setRouteForm({ ...routeForm, methods });
  };

  if (loading && !service) return <div className="loading">読み込み中...</div>;
  if (!service) return <div className="empty-state">サービスが見つかりません</div>;

  return (
    <div className="apigw-service-detail">
      <div className="header">
        <h2>サービス詳細: {service.name}</h2>
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
              <input type="text" value={nameInput} onChange={(e) => setNameInput(e.target.value)} pattern="^[a-zA-Z0-9_]+$" autoFocus required />
            </div>
            <div className="form-group">
              <label>プロトコル<span className="required-mark">*</span></label>
              <select value={protocolInput} onChange={(e) => setProtocolInput(e.target.value)}>
                <option value="http">http</option>
                <option value="https">https</option>
              </select>
            </div>
            <div className="form-group">
              <label>接続先ホスト<span className="required-mark">*</span></label>
              <input type="text" value={hostInput} onChange={(e) => setHostInput(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>パス</label>
              <input type="text" value={pathInput} onChange={(e) => setPathInput(e.target.value)} />
            </div>
            <div className="form-group">
              <label>ポート</label>
              <input type="number" value={portInput} onChange={(e) => setPortInput(Number(e.target.value))} min={1} max={65535} />
            </div>
            <div className="form-group">
              <label>リトライ回数</label>
              <input type="number" value={retriesInput} onChange={(e) => setRetriesInput(Number(e.target.value))} min={0} />
            </div>
            <div className="form-group">
              <label>接続/書き込み/読み込みタイムアウト(ミリ秒)</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input type="number" value={connectTimeoutInput} onChange={(e) => setConnectTimeoutInput(Number(e.target.value))} min={1} style={{ flex: 1, minWidth: 0, width: 'auto' }} />
                <input type="number" value={writeTimeoutInput} onChange={(e) => setWriteTimeoutInput(Number(e.target.value))} min={1} style={{ flex: 1, minWidth: 0, width: 'auto' }} />
                <input type="number" value={readTimeoutInput} onChange={(e) => setReadTimeoutInput(Number(e.target.value))} min={1} style={{ flex: 1, minWidth: 0, width: 'auto' }} />
              </div>
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
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{service.id}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>接続先</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{service.protocol}://{service.host}{service.port ? `:${service.port}` : ''}{service.path}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>公開ホスト</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{service.routeHost || '-'}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>サブスクリプション</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{service.subscriptionName || '-'}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>リトライ回数</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{service.retries}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>タイムアウト(接続/書込/読込、ミリ秒)</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{service.connectTimeout}ms / {service.writeTimeout}ms / {service.readTimeout}ms</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>作成日</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{formatDate(service.createdAt)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      <div className="header">
        <h3>ルート</h3>
        <button
          className="btn btn-primary btn-small"
          onClick={() => { setRouteError(null); setRouteForm({ ...emptyRouteForm }); }}
        >
          + ルート作成
        </button>
      </div>

      {routes.length === 0 ? (
        <div className="empty-state">ルートがありません</div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>名前</th>
              <th>プロトコル</th>
              <th>パス</th>
              <th>ホスト</th>
              <th>メソッド</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {routes.map(r => (
              <tr key={r.id}>
                <td style={{ textAlign: 'left' }}>{r.name || '-'}</td>
                <td style={{ textAlign: 'left' }}>{r.protocols}</td>
                <td style={{ textAlign: 'left' }}>{r.path || '-'}</td>
                <td style={{ textAlign: 'left' }}>{(r.hosts && r.hosts.length > 0) ? r.hosts.join(', ') : (r.host || service.routeHost || '-')}</td>
                <td style={{ textAlign: 'left' }}>{(r.methods || []).join(', ') || 'すべて'}</td>
                <td>
                  <button
                    className="btn btn-secondary btn-small"
                    style={{ marginRight: '0.5rem' }}
                    onClick={() => {
                      setRouteError(null);
                      setRouteForm({
                        id: r.id, name: r.name, protocols: r.protocols || 'http,https', path: r.path || '/',
                        hosts: (r.hosts || []).join(','), methods: r.methods || [],
                        httpsRedirectStatusCode: r.httpsRedirectStatusCode, regexPriority: r.regexPriority,
                        stripPath: r.stripPath, preserveHost: r.preserveHost, tags: (r.tags || []).join(','),
                      });
                    }}
                  >
                    編集
                  </button>
                  <button
                    className="btn btn-danger btn-small"
                    onClick={() => setConfirmDeleteRoute(r)}
                    disabled={deletingRoute === r.id}
                  >
                    {deletingRoute === r.id ? '削除中...' : '削除'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {confirmDeleteRoute && (
        <div className="confirm-overlay" onClick={() => setConfirmDeleteRoute(null)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <p>ルート「{confirmDeleteRoute.name || confirmDeleteRoute.path}」を削除しますか？</p>
            <p className="confirm-warning">この操作は取り消せません。</p>
            <div className="confirm-actions">
              <button className="btn btn-secondary" onClick={() => setConfirmDeleteRoute(null)}>キャンセル</button>
              <button className="btn btn-danger" onClick={handleDeleteRouteConfirm}>削除する</button>
            </div>
          </div>
        </div>
      )}

      {routeForm && (
        <div className="modal-overlay" onClick={() => setRouteForm(null)} style={modalOverlayStyle}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={modalContentStyle}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>{routeForm.id ? 'ルート編集' : 'ルート作成'}</h3>
            <form onSubmit={handleRouteSubmit}>
              <div className="form-group">
                <label>名前<span className="required-mark">*</span></label>
                <input
                  type="text"
                  value={routeForm.name}
                  onChange={(e) => setRouteForm({ ...routeForm, name: e.target.value })}
                  placeholder="my_route"
                  autoFocus
                  required
                />
              </div>
              <div className="form-group">
                <label>プロトコル</label>
                <select
                  value={routeForm.protocols}
                  onChange={(e) => setRouteForm({ ...routeForm, protocols: e.target.value })}
                >
                  <option value="http,https">http, https</option>
                  <option value="http">http</option>
                  <option value="https">https</option>
                </select>
              </div>
              <div className="form-group">
                <label>パス<span className="required-mark">*</span></label>
                <input
                  type="text"
                  value={routeForm.path}
                  onChange={(e) => setRouteForm({ ...routeForm, path: e.target.value })}
                  placeholder="/"
                  required
                />
              </div>
              <div className="form-group">
                <label>ホスト</label>
                <input
                  type="text"
                  value={routeForm.hosts}
                  onChange={(e) => setRouteForm({ ...routeForm, hosts: e.target.value })}
                  placeholder="任意(カンマ区切り、未指定時は自動発行ホストを使用)"
                />
              </div>
              <div className="form-group">
                <label>HTTPメソッド</label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {HTTP_METHODS.map(m => (
                    <label key={m} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 'normal', fontSize: '0.8rem' }}>
                      <input type="checkbox" checked={routeForm.methods.includes(m)} onChange={() => toggleMethod(m)} />
                      {m}
                    </label>
                  ))}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.25rem' }}>未選択の場合は全メソッドを許可</div>
              </div>
              <div className="form-group">
                <label>HTTPSリダイレクト</label>
                <select
                  value={routeForm.httpsRedirectStatusCode}
                  onChange={(e) => setRouteForm({ ...routeForm, httpsRedirectStatusCode: Number(e.target.value) })}
                >
                  <option value={0}>なし</option>
                  {HTTPS_REDIRECT_CODES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>正規表現優先度</label>
                <input
                  type="number"
                  value={routeForm.regexPriority}
                  onChange={(e) => setRouteForm({ ...routeForm, regexPriority: Number(e.target.value) })}
                  min={0}
                />
              </div>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'normal' }}>
                  <input type="checkbox" checked={routeForm.stripPath} onChange={(e) => setRouteForm({ ...routeForm, stripPath: e.target.checked })} />
                  リクエストパスからルートのパスを削除する(stripPath)
                </label>
              </div>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'normal' }}>
                  <input type="checkbox" checked={routeForm.preserveHost} onChange={(e) => setRouteForm({ ...routeForm, preserveHost: e.target.checked })} />
                  リクエストのHostヘッダーを保持する(preserveHost)
                </label>
              </div>
              <div className="form-group">
                <label>タグ</label>
                <input
                  type="text"
                  value={routeForm.tags}
                  onChange={(e) => setRouteForm({ ...routeForm, tags: e.target.value })}
                  placeholder="任意(カンマ区切り)"
                />
              </div>
              {routeError && (
                <div style={{ marginBottom: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>
                  エラー: {routeError}
                </div>
              )}
              <div className="confirm-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setRouteForm(null)}>キャンセル</button>
                <button type="submit" className="btn btn-primary" disabled={savingRoute}>
                  {savingRoute ? '保存中...' : (routeForm.id ? '更新する' : '作成する')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
