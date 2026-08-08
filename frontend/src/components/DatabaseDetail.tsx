import { useState, useEffect, useCallback } from 'react';
import { GetDatabaseDetail, UpdateDatabase, UpdateDatabaseSettings, GetDatabaseParameter, SetDatabaseParameter } from '../../wailsjs/go/main/App';
import { sakura } from '../../wailsjs/go/models';
import { useGlobalReload } from '../hooks/useGlobalReload';

interface DatabaseDetailProps {
  profile: string;
  zone: string;
  databaseId: string;
}

const formatDate = (dateString: string) => {
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

const getPlanName = (planId: string) => {
  if (planId.includes('10')) return '10 GB';
  if (planId.includes('30')) return '30 GB';
  if (planId.includes('90')) return '90 GB';
  if (planId.includes('240')) return '240 GB';
  if (planId.includes('500')) return '500 GB';
  if (planId.includes('1000') || planId.includes('1t')) return '1 TB';
  return planId;
};

type SettingsForm = {
  defaultUser: string;
  userPassword: string;
  replicaUser: string;
  replicaPassword: string;
  servicePort: string;
  sourceNetwork: string;
  monitoringSuiteEnabled: boolean;
};

function toSettingsForm(db: sakura.DatabaseInfo): SettingsForm {
  return {
    defaultUser: db.defaultUser || '',
    userPassword: '',
    replicaUser: db.replicaUser || '',
    replicaPassword: '',
    servicePort: String(db.servicePort || ''),
    sourceNetwork: (db.sourceNetwork || []).join(', '),
    monitoringSuiteEnabled: db.monitoringSuiteEnabled,
  };
}

export function DatabaseDetail({ profile, zone, databaseId }: DatabaseDetailProps) {
  const [dbInfo, setDbInfo] = useState<sakura.DatabaseInfo | null>(null);
  const [loading, setLoading] = useState(false);

  const [editingBasic, setEditingBasic] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [descriptionInput, setDescriptionInput] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [savingBasic, setSavingBasic] = useState(false);
  const [basicError, setBasicError] = useState<string | null>(null);

  const [settingsForm, setSettingsForm] = useState<SettingsForm | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const [parameter, setParameter] = useState<sakura.DatabaseParameterInfo | null>(null);
  const [newParamName, setNewParamName] = useState('');
  const [newParamValue, setNewParamValue] = useState('');
  const [savingParam, setSavingParam] = useState(false);
  const [paramError, setParamError] = useState<string | null>(null);

  const loadDatabaseDetail = useCallback(async () => {
    if (!profile || !zone || !databaseId) return;

    setLoading(true);
    try {
      const [detail, param] = await Promise.all([
        GetDatabaseDetail(profile, zone, databaseId),
        GetDatabaseParameter(profile, zone, databaseId),
      ]);
      setDbInfo(detail);
      setParameter(param);
    } catch (err) {
      console.error('[DatabaseDetail] loadDatabaseDetail error:', err);
    } finally {
      setLoading(false);
    }
  }, [profile, zone, databaseId]);

  useGlobalReload(loadDatabaseDetail);

  useEffect(() => {
    loadDatabaseDetail();
  }, [loadDatabaseDetail]);

  const handleBasicEditStart = () => {
    if (!dbInfo) return;
    setNameInput(dbInfo.name);
    setDescriptionInput(dbInfo.description || '');
    setTagsInput((dbInfo.tags || []).join(', '));
    setBasicError(null);
    setEditingBasic(true);
  };

  const handleBasicEditCancel = () => {
    setEditingBasic(false);
    setBasicError(null);
  };

  const handleBasicSave = async () => {
    setSavingBasic(true);
    setBasicError(null);
    try {
      const tags = tagsInput.split(',').map(t => t.trim()).filter(t => t.length > 0);
      const updated = await UpdateDatabase(profile, zone, databaseId, nameInput, descriptionInput, tags);
      setDbInfo(updated);
      setEditingBasic(false);
    } catch (e) {
      setBasicError(String(e));
    } finally {
      setSavingBasic(false);
    }
  };

  const handleSettingsEditOpen = () => {
    if (!dbInfo) return;
    setSettingsError(null);
    setSettingsForm(toSettingsForm(dbInfo));
  };

  const handleSettingsEditCancel = () => {
    setSettingsForm(null);
    setSettingsError(null);
  };

  const handleSettingsSave = async () => {
    if (!settingsForm) return;

    const servicePort = parseInt(settingsForm.servicePort, 10);
    if (isNaN(servicePort)) {
      setSettingsError('ポート番号を正しく入力してください');
      return;
    }
    const sourceNetwork = settingsForm.sourceNetwork.split(',').map(s => s.trim()).filter(s => s.length > 0);

    const params = new sakura.DatabaseSettingsParams({
      DefaultUser: settingsForm.defaultUser,
      UserPassword: settingsForm.userPassword,
      ReplicaUser: settingsForm.replicaUser,
      ReplicaPassword: settingsForm.replicaPassword,
      ServicePort: servicePort,
      SourceNetwork: sourceNetwork,
      MonitoringSuiteEnabled: settingsForm.monitoringSuiteEnabled,
    });

    setSavingSettings(true);
    setSettingsError(null);
    try {
      const updated = await UpdateDatabaseSettings(profile, zone, databaseId, params);
      setDbInfo(updated);
      setSettingsForm(null);
    } catch (e) {
      setSettingsError(String(e));
    } finally {
      setSavingSettings(false);
    }
  };

  const handleParamRemove = async (name: string) => {
    setSavingParam(true);
    setParamError(null);
    try {
      await SetDatabaseParameter(profile, zone, databaseId, { [name]: null });
      const param = await GetDatabaseParameter(profile, zone, databaseId);
      setParameter(param);
    } catch (e) {
      setParamError(String(e));
    } finally {
      setSavingParam(false);
    }
  };

  const handleParamAdd = async () => {
    if (!newParamName) return;
    setSavingParam(true);
    setParamError(null);
    try {
      const numeric = Number(newParamValue);
      const value = newParamValue !== '' && !isNaN(numeric) ? numeric : newParamValue;
      await SetDatabaseParameter(profile, zone, databaseId, { [newParamName]: value });
      const param = await GetDatabaseParameter(profile, zone, databaseId);
      setParameter(param);
      setNewParamName('');
      setNewParamValue('');
    } catch (e) {
      setParamError(String(e));
    } finally {
      setSavingParam(false);
    }
  };

  if (loading) return <div className="loading">読み込み中...</div>;
  if (!dbInfo) return <div className="empty-state">データベース情報が見つかりません</div>;

  const settingsKeys = parameter ? Object.keys(parameter.settings || {}) : [];
  const availableParamNames = (parameter?.meta || []).filter(m => !settingsKeys.includes(m.name));

  return (
    <div className="database-detail">
      <div className="header">
        <h2>データベース詳細: {dbInfo.name}</h2>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem', background: '#2a2a2a', borderRadius: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h4 style={{ color: '#00adb5', margin: 0 }}>基本情報</h4>
          {!editingBasic && (
            <button className="btn btn-secondary btn-small" onClick={handleBasicEditStart}>編集</button>
          )}
        </div>
        {editingBasic ? (
          <div>
            <div className="form-group">
              <label>名前</label>
              <input type="text" value={nameInput} onChange={(e) => setNameInput(e.target.value)} autoFocus />
            </div>
            <div className="form-group">
              <label>説明</label>
              <input type="text" value={descriptionInput} onChange={(e) => setDescriptionInput(e.target.value)} placeholder="任意" />
            </div>
            <div className="form-group">
              <label>タグ</label>
              <input type="text" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="カンマ区切り(任意)" />
            </div>
            {basicError && (
              <div style={{ marginBottom: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>エラー: {basicError}</div>
            )}
            <div className="confirm-actions">
              <button className="btn btn-secondary" onClick={handleBasicEditCancel} disabled={savingBasic}>キャンセル</button>
              <button className="btn btn-primary" onClick={handleBasicSave} disabled={savingBasic || !nameInput}>
                {savingBasic ? '保存中...' : '保存する'}
              </button>
            </div>
          </div>
        ) : (
          <table style={{ borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>ID</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{dbInfo.id}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>説明</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{dbInfo.description || '-'}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>タグ</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{dbInfo.tags && dbInfo.tags.length > 0 ? dbInfo.tags.join(', ') : '-'}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>ステータス</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>
                  <span className={`status ${dbInfo.status.toLowerCase() === 'up' ? 'up' : 'down'}`}>{dbInfo.status}</span>
                </td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>プラン</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{getPlanName(dbInfo.planId)}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>データベース種別</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{dbInfo.rdbmsType} {dbInfo.rdbmsVersion}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>IPアドレス</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{dbInfo.ipAddresses?.join(', ') || '-'}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>ネットワーク</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>/{dbInfo.networkMaskLen} (デフォルトルート: {dbInfo.defaultRoute || '-'})</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>作成日</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{formatDate(dbInfo.createdAt)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem', background: '#2a2a2a', borderRadius: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h4 style={{ color: '#00adb5', margin: 0 }}>稼働設定</h4>
          <button className="btn btn-secondary btn-small" onClick={handleSettingsEditOpen}>編集</button>
        </div>
        <table style={{ borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>管理ユーザー名</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{dbInfo.defaultUser || '-'}</td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>レプリカユーザー</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{dbInfo.replicaUser || '-'}</td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>ポート番号</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{dbInfo.servicePort || '-'}</td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>接続許可ネットワーク</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{dbInfo.sourceNetwork && dbInfo.sourceNetwork.length > 0 ? dbInfo.sourceNetwork.join(', ') : '(全て許可)'}</td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>拡張監視機能</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{dbInfo.monitoringSuiteEnabled ? '有効' : '無効'}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem', background: '#2a2a2a', borderRadius: '8px' }}>
        <h4 style={{ color: '#00adb5', marginTop: 0, marginBottom: '1rem' }}>DBパラメータ</h4>
        <table className="table">
          <thead>
            <tr>
              <th>項目</th>
              <th>値</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {settingsKeys.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ textAlign: 'center', padding: '1rem', color: '#666' }}>デフォルト値のまま(未設定)</td>
              </tr>
            ) : (
              settingsKeys.map((key) => (
                <tr key={key}>
                  <td style={{ textAlign: 'left' }}>{key}</td>
                  <td style={{ textAlign: 'left' }}>{String(parameter?.settings[key])}</td>
                  <td style={{ textAlign: 'left' }}>
                    <button className="btn btn-danger btn-small" onClick={() => handleParamRemove(key)} disabled={savingParam}>リセット</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '1rem' }}>
          <select value={newParamName} onChange={(e) => setNewParamName(e.target.value)} style={{ flex: 2 }}>
            <option value="">項目を選択</option>
            {availableParamNames.map((m) => (
              <option key={m.name} value={m.name} title={m.text}>{m.label || m.name}</option>
            ))}
          </select>
          <input
            type="text"
            value={newParamValue}
            onChange={(e) => setNewParamValue(e.target.value)}
            placeholder="値"
            style={{ flex: 1 }}
          />
          <button className="btn btn-primary btn-small" onClick={handleParamAdd} disabled={savingParam || !newParamName}>設定</button>
        </div>
        {paramError && (
          <div style={{ marginTop: '0.5rem', color: '#ff6b6b', fontSize: '0.85rem' }}>エラー: {paramError}</div>
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
            padding: '20px', minWidth: '360px', maxWidth: '480px', maxHeight: '85vh', overflowY: 'auto',
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>稼働設定を編集</h3>
            <div className="form-group">
              <label htmlFor="db-settings-user">管理ユーザー名</label>
              <input id="db-settings-user" type="text" value={settingsForm.defaultUser} onChange={(e) => setSettingsForm({ ...settingsForm, defaultUser: e.target.value })} />
            </div>
            <div className="form-group">
              <label htmlFor="db-settings-password">管理ユーザーパスワード</label>
              <input
                id="db-settings-password"
                type="password"
                value={settingsForm.userPassword}
                onChange={(e) => setSettingsForm({ ...settingsForm, userPassword: e.target.value })}
                placeholder="変更する場合のみ入力(空欄なら変更しない)"
              />
            </div>
            <div className="form-group">
              <label htmlFor="db-settings-replica-user">レプリカユーザー</label>
              <input id="db-settings-replica-user" type="text" value={settingsForm.replicaUser} onChange={(e) => setSettingsForm({ ...settingsForm, replicaUser: e.target.value })} placeholder="任意" />
            </div>
            <div className="form-group">
              <label htmlFor="db-settings-replica-password">レプリカユーザーパスワード</label>
              <input
                id="db-settings-replica-password"
                type="password"
                value={settingsForm.replicaPassword}
                onChange={(e) => setSettingsForm({ ...settingsForm, replicaPassword: e.target.value })}
                placeholder="変更する場合のみ入力(空欄なら変更しない)"
              />
            </div>
            <div className="form-group">
              <label htmlFor="db-settings-port">ポート番号</label>
              <input id="db-settings-port" type="number" value={settingsForm.servicePort} onChange={(e) => setSettingsForm({ ...settingsForm, servicePort: e.target.value })} />
            </div>
            <div className="form-group">
              <label htmlFor="db-settings-source-network">接続許可ネットワーク</label>
              <input
                id="db-settings-source-network"
                type="text"
                value={settingsForm.sourceNetwork}
                onChange={(e) => setSettingsForm({ ...settingsForm, sourceNetwork: e.target.value })}
                placeholder="カンマ区切り(空欄なら全て許可)"
              />
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={settingsForm.monitoringSuiteEnabled}
                  onChange={(e) => setSettingsForm({ ...settingsForm, monitoringSuiteEnabled: e.target.checked })}
                />
                拡張監視機能(Monitoring Suite)を有効化
              </label>
            </div>
            {settingsError && (
              <div style={{ marginBottom: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>エラー: {settingsError}</div>
            )}
            <div className="confirm-actions">
              <button className="btn btn-secondary" onClick={handleSettingsEditCancel} disabled={savingSettings}>キャンセル</button>
              <button className="btn btn-primary" onClick={handleSettingsSave} disabled={savingSettings}>
                {savingSettings ? '保存中...' : '保存する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
