import { useState, useEffect, useCallback } from 'react';
import { GetGSLBDetail, UpdateGSLB, UpdateGSLBSettings } from '../../wailsjs/go/main/App';
import { sakura } from '../../wailsjs/go/models';
import { useGlobalReload } from '../hooks/useGlobalReload';

interface GSLBDetailProps {
  profile: string;
  gslbId: string;
}

const IPV4_PATTERN = '^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(\\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$';

type ServerFormRow = {
  ipAddress: string;
  enabled: boolean;
  weight: string;
};

type SettingsForm = {
  sorryServer: string;
  delayLoop: string;
  weighted: boolean;
  protocol: string;
  hostHeader: string;
  path: string;
  responseCode: string;
  port: string;
  servers: ServerFormRow[];
};

function toSettingsForm(gslb: sakura.GSLBInfo): SettingsForm {
  const hc = gslb.healthCheck;
  return {
    sorryServer: gslb.sorryServer || '',
    delayLoop: String(gslb.delayLoop || 10),
    weighted: gslb.weighted,
    protocol: hc?.protocol || 'ping',
    hostHeader: hc?.hostHeader || '',
    path: hc?.path || '',
    responseCode: hc?.responseCode ? String(hc.responseCode) : '',
    port: hc?.port ? String(hc.port) : '',
    servers: (gslb.servers || []).map((s) => ({
      ipAddress: s.ipAddress,
      enabled: s.enabled,
      weight: String(s.weight || 1),
    })),
  };
}

export function GSLBDetail({ profile, gslbId }: GSLBDetailProps) {
  const [gslb, setGslb] = useState<sakura.GSLBInfo | null>(null);
  const [loading, setLoading] = useState(false);

  const [editingBasic, setEditingBasic] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [descriptionInput, setDescriptionInput] = useState('');
  const [savingBasic, setSavingBasic] = useState(false);

  const [settingsForm, setSettingsForm] = useState<SettingsForm | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const loadGSLBDetail = useCallback(async () => {
    if (!profile || !gslbId) return;

    setLoading(true);
    try {
      const detail = await GetGSLBDetail(profile, gslbId);
      setGslb(detail);
    } catch (err) {
      console.error('[GSLBDetail] loadGSLBDetail error:', err);
    } finally {
      setLoading(false);
    }
  }, [profile, gslbId]);

  useGlobalReload(loadGSLBDetail);

  useEffect(() => {
    loadGSLBDetail();
  }, [loadGSLBDetail]);

  const handleBasicEditStart = () => {
    if (!gslb) return;
    setNameInput(gslb.name);
    setDescriptionInput(gslb.description || '');
    setEditingBasic(true);
  };

  const handleBasicEditCancel = () => {
    setEditingBasic(false);
  };

  const handleBasicSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBasic(true);
    try {
      const updated = await UpdateGSLB(profile, gslbId, nameInput, descriptionInput);
      setGslb(updated);
      setEditingBasic(false);
    } catch (e) {
      alert(`基本情報の更新に失敗しました: ${e}`);
    } finally {
      setSavingBasic(false);
    }
  };

  const handleSettingsEditOpen = () => {
    if (!gslb) return;
    setSettingsError(null);
    setSettingsForm(toSettingsForm(gslb));
  };

  const handleSettingsEditCancel = () => {
    setSettingsForm(null);
    setSettingsError(null);
  };

  const handleServerAdd = () => {
    if (!settingsForm) return;
    setSettingsForm({
      ...settingsForm,
      servers: [...settingsForm.servers, { ipAddress: '', enabled: true, weight: '1' }],
    });
  };

  const handleServerRemove = (index: number) => {
    if (!settingsForm) return;
    setSettingsForm({
      ...settingsForm,
      servers: settingsForm.servers.filter((_, i) => i !== index),
    });
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
    if (!settingsForm) return;

    const delayLoop = parseInt(settingsForm.delayLoop, 10);
    const responseCode = settingsForm.responseCode ? parseInt(settingsForm.responseCode, 10) : 0;
    const port = settingsForm.port ? parseInt(settingsForm.port, 10) : 0;
    if ([delayLoop, responseCode, port].some(isNaN)) {
      setSettingsError('数値項目を正しく入力してください');
      return;
    }
    const serverWeights = settingsForm.servers.map((s) => parseInt(s.weight, 10));
    if (serverWeights.some(isNaN)) {
      setSettingsError('サーバーの重みを正しく入力してください');
      return;
    }

    const settings = new sakura.GSLBSettingsInput({
      sorryServer: settingsForm.sorryServer,
      delayLoop,
      weighted: settingsForm.weighted,
      healthCheck: {
        protocol: settingsForm.protocol,
        hostHeader: settingsForm.hostHeader,
        path: settingsForm.path,
        responseCode,
        port,
      },
      servers: settingsForm.servers.map((s, i) => ({
        ipAddress: s.ipAddress,
        enabled: s.enabled,
        weight: serverWeights[i],
      })),
    });

    setSavingSettings(true);
    setSettingsError(null);
    try {
      const updated = await UpdateGSLBSettings(profile, gslbId, settings);
      setGslb(updated);
      setSettingsForm(null);
    } catch (e) {
      setSettingsError(String(e));
    } finally {
      setSavingSettings(false);
    }
  };

  if (loading) return <div className="loading">読み込み中...</div>;
  if (!gslb) return <div className="empty-state">GSLB情報が見つかりません</div>;

  return (
    <div className="gslb-detail">
      <div className="header">
        <h2>GSLB詳細: {gslb.name}</h2>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem', background: '#2a2a2a', borderRadius: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h4 style={{ color: '#00adb5', margin: 0 }}>基本情報</h4>
          <button className="btn btn-secondary btn-small" onClick={handleSettingsEditOpen}>監視設定を編集</button>
        </div>
        <table style={{ borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>ID</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{gslb.id}</td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>FQDN</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{gslb.fqdn}</td>
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
                      placeholder="名前"
                      required
                      autoFocus
                    />
                    <input
                      type="text"
                      value={descriptionInput}
                      onChange={(e) => setDescriptionInput(e.target.value)}
                      placeholder="説明(任意)"
                    />
                    <button type="submit" className="btn btn-primary btn-small" disabled={savingBasic}>
                      {savingBasic ? '保存中...' : '保存'}
                    </button>
                    <button type="button" className="btn btn-secondary btn-small" onClick={handleBasicEditCancel} disabled={savingBasic}>キャンセル</button>
                  </form>
                ) : (
                  <span style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {gslb.name} / {gslb.description || '-'}
                    <button className="btn btn-secondary btn-small" onClick={handleBasicEditStart}>編集</button>
                  </span>
                )}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>Sorry Server</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{gslb.sorryServer || '-'}</td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>監視間隔</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{gslb.delayLoop}秒</td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>重み付け</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{gslb.weighted ? '有効' : '無効'}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {gslb.healthCheck && (
        <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem', background: '#2a2a2a', borderRadius: '8px' }}>
          <h4 style={{ color: '#00adb5', marginTop: 0, marginBottom: '1rem' }}>ヘルスチェック設定</h4>
          <table style={{ borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>プロトコル</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{gslb.healthCheck.protocol}</td>
              </tr>
              {gslb.healthCheck.port > 0 && (
                <tr>
                  <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>ポート</td>
                  <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{gslb.healthCheck.port}</td>
                </tr>
              )}
              {gslb.healthCheck.hostHeader && (
                <tr>
                  <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>Hostヘッダー</td>
                  <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{gslb.healthCheck.hostHeader}</td>
                </tr>
              )}
              {gslb.healthCheck.path && (
                <tr>
                  <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>パス</td>
                  <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{gslb.healthCheck.path}</td>
                </tr>
              )}
              {gslb.healthCheck.responseCode > 0 && (
                <tr>
                  <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>期待レスポンス</td>
                  <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{gslb.healthCheck.responseCode}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <h3>振り分け先サーバー</h3>
      <table className="table">
        <thead>
          <tr>
            <th>IPアドレス</th>
            <th>状態</th>
            <th>重み</th>
          </tr>
        </thead>
        <tbody>
          {gslb.servers && gslb.servers.length > 0 ? (
            gslb.servers.map((server, index) => (
              <tr key={index}>
                <td style={{ textAlign: 'left', fontFamily: 'monospace' }}>{server.ipAddress}</td>
                <td style={{ textAlign: 'left' }}>
                  <span className={`status ${server.enabled ? 'up' : 'down'}`}>
                    {server.enabled ? '有効' : '無効'}
                  </span>
                </td>
                <td style={{ textAlign: 'left' }}>{server.weight}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={3} style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
                サーバーが登録されていません
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {settingsForm && (
        <div className="modal-overlay" onClick={handleSettingsEditCancel} style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
            backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
            padding: '20px', minWidth: '360px', maxWidth: '560px', maxHeight: '85vh', overflowY: 'auto',
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>監視設定を編集</h3>

            <form onSubmit={handleSettingsSave}>
            <div className="form-group">
              <label>Sorry Server(IPアドレス)</label>
              <input
                type="text"
                value={settingsForm.sorryServer}
                onChange={(e) => setSettingsForm({ ...settingsForm, sorryServer: e.target.value })}
                placeholder="任意 (例: 192.0.2.1)"
                pattern={IPV4_PATTERN}
                title="IPv4アドレスの形式で入力してください"
              />
            </div>
            <div className="form-group">
              <label>監視間隔(秒) *</label>
              <input
                type="number"
                value={settingsForm.delayLoop}
                onChange={(e) => setSettingsForm({ ...settingsForm, delayLoop: e.target.value })}
                min={10}
                step={1}
                required
              />
            </div>
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={settingsForm.weighted}
                  onChange={(e) => setSettingsForm({ ...settingsForm, weighted: e.target.checked })}
                  style={{ marginRight: '0.5rem' }}
                />
                重み付けを有効にする
              </label>
            </div>

            <h4 style={{ color: '#00adb5', margin: '1rem 0' }}>ヘルスチェック</h4>
            <div className="form-group">
              <label>プロトコル</label>
              <select
                value={settingsForm.protocol}
                onChange={(e) => setSettingsForm({ ...settingsForm, protocol: e.target.value })}
              >
                <option value="ping">ping</option>
                <option value="http">http</option>
                <option value="https">https</option>
                <option value="tcp">tcp</option>
              </select>
            </div>
            <div className="form-group">
              <label>ポート</label>
              <input
                type="number"
                value={settingsForm.port}
                onChange={(e) => setSettingsForm({ ...settingsForm, port: e.target.value })}
                placeholder="80"
                min={1}
                max={65535}
                step={1}
              />
            </div>
            <div className="form-group">
              <label>パス</label>
              <input
                type="text"
                value={settingsForm.path}
                onChange={(e) => setSettingsForm({ ...settingsForm, path: e.target.value })}
                placeholder="/"
              />
            </div>
            <div className="form-group">
              <label>Hostヘッダー</label>
              <input
                type="text"
                value={settingsForm.hostHeader}
                onChange={(e) => setSettingsForm({ ...settingsForm, hostHeader: e.target.value })}
                placeholder="example.com"
              />
            </div>
            <div className="form-group">
              <label>期待レスポンスコード</label>
              <input
                type="number"
                value={settingsForm.responseCode}
                onChange={(e) => setSettingsForm({ ...settingsForm, responseCode: e.target.value })}
                placeholder="200"
                min={100}
                max={599}
                step={1}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '1rem 0' }}>
              <h4 style={{ color: '#00adb5', margin: 0 }}>振り分け先サーバー</h4>
              <button type="button" className="btn btn-secondary btn-small" onClick={handleServerAdd}>+ サーバー追加</button>
            </div>
            {settingsForm.servers.length === 0 ? (
              <p style={{ color: '#666', fontSize: '0.85rem' }}>サーバーが登録されていません</p>
            ) : (
              settingsForm.servers.map((server, index) => (
                <div key={index} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <input
                    type="text"
                    value={server.ipAddress}
                    onChange={(e) => handleServerChange(index, 'ipAddress', e.target.value)}
                    placeholder="IPアドレス"
                    pattern={IPV4_PATTERN}
                    title="IPv4アドレスの形式で入力してください"
                    required
                    style={{ flex: 2 }}
                  />
                  <input
                    type="number"
                    value={server.weight}
                    onChange={(e) => handleServerChange(index, 'weight', e.target.value)}
                    placeholder="重み"
                    min={1}
                    step={1}
                    required
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
    </div>
  );
}
