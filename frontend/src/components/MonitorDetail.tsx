import { useState, useEffect, useCallback } from 'react';
import { GetSimpleMonitorDetail, UpdateSimpleMonitor, UpdateSimpleMonitorSettings } from '../../wailsjs/go/main/App';
import { sakura } from '../../wailsjs/go/models';
import { useGlobalReload } from '../hooks/useGlobalReload';

interface MonitorDetailProps {
  profile: string;
  monitorId: string;
}

type SettingsForm = {
  delayLoop: string;
  maxCheckAttempts: string;
  retryInterval: string;
  timeout: string;
  enabled: boolean;
  notifyEmailEnabled: boolean;
  notifySlackEnabled: boolean;
  slackWebhooksUrl: string;
  notifyInterval: string;
  protocol: string;
  port: string;
  path: string;
  status: string;
  host: string;
  containsString: string;
};

function toSettingsForm(monitor: sakura.SimpleMonitorDetailInfo): SettingsForm {
  const hc = monitor.healthCheck;
  return {
    delayLoop: String(monitor.delayLoop),
    maxCheckAttempts: String(monitor.maxCheckAttempts),
    retryInterval: String(monitor.retryInterval),
    timeout: String(monitor.timeout || 10),
    enabled: monitor.enabled,
    notifyEmailEnabled: monitor.notifyEmailEnabled,
    notifySlackEnabled: monitor.notifySlackEnabled,
    slackWebhooksUrl: monitor.slackWebhooksUrl || '',
    notifyInterval: String(monitor.notifyInterval || 3600),
    protocol: hc?.protocol || 'ping',
    port: hc?.port || '',
    path: hc?.path || '',
    status: hc?.status || '',
    host: hc?.host || '',
    containsString: hc?.containsString || '',
  };
}

export function MonitorDetail({ profile, monitorId }: MonitorDetailProps) {
  const [monitor, setMonitor] = useState<sakura.SimpleMonitorDetailInfo | null>(null);
  const [loading, setLoading] = useState(false);

  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionInput, setDescriptionInput] = useState('');
  const [savingDescription, setSavingDescription] = useState(false);

  const [settingsForm, setSettingsForm] = useState<SettingsForm | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const loadMonitorDetail = useCallback(async () => {
    if (!profile || !monitorId) return;

    setLoading(true);
    try {
      const detail = await GetSimpleMonitorDetail(profile, monitorId);
      setMonitor(detail);
    } catch (err) {
      console.error('[MonitorDetail] loadMonitorDetail error:', err);
    } finally {
      setLoading(false);
    }
  }, [profile, monitorId]);

  useGlobalReload(loadMonitorDetail);

  useEffect(() => {
    loadMonitorDetail();
  }, [loadMonitorDetail]);

  const handleDescriptionEditStart = () => {
    setDescriptionInput(monitor?.description || '');
    setEditingDescription(true);
  };

  const handleDescriptionCancel = () => {
    setEditingDescription(false);
  };

  const handleDescriptionSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingDescription(true);
    try {
      const updated = await UpdateSimpleMonitor(profile, monitorId, descriptionInput);
      setMonitor(updated);
      setEditingDescription(false);
    } catch (e) {
      alert(`説明の更新に失敗しました: ${e}`);
    } finally {
      setSavingDescription(false);
    }
  };

  const handleSettingsEditOpen = () => {
    if (!monitor) return;
    setSettingsError(null);
    setSettingsForm(toSettingsForm(monitor));
  };

  const handleSettingsEditCancel = () => {
    setSettingsForm(null);
    setSettingsError(null);
  };

  const handleSettingsSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settingsForm) return;
    const delayLoop = parseInt(settingsForm.delayLoop, 10);
    const maxCheckAttempts = parseInt(settingsForm.maxCheckAttempts, 10);
    const retryInterval = parseInt(settingsForm.retryInterval, 10);
    const timeout = parseInt(settingsForm.timeout, 10);
    const notifyInterval = parseInt(settingsForm.notifyInterval, 10);

    const settings = new sakura.SimpleMonitorSettingsInput({
      delayLoop,
      maxCheckAttempts,
      retryInterval,
      timeout,
      enabled: settingsForm.enabled,
      notifyEmailEnabled: settingsForm.notifyEmailEnabled,
      notifySlackEnabled: settingsForm.notifySlackEnabled,
      slackWebhooksUrl: settingsForm.slackWebhooksUrl,
      notifyInterval,
      healthCheck: {
        protocol: settingsForm.protocol,
        port: settingsForm.port,
        path: settingsForm.path,
        status: settingsForm.status,
        host: settingsForm.host,
        containsString: settingsForm.containsString,
      },
    });

    setSavingSettings(true);
    setSettingsError(null);
    try {
      const updated = await UpdateSimpleMonitorSettings(profile, monitorId, settings);
      setMonitor(updated);
      setSettingsForm(null);
    } catch (e) {
      setSettingsError(String(e));
    } finally {
      setSavingSettings(false);
    }
  };

  if (loading) return <div className="loading">読み込み中...</div>;
  if (!monitor) return <div className="empty-state">シンプル監視情報が見つかりません</div>;

  return (
    <div className="monitor-detail">
      <div className="header">
        <h2>シンプル監視詳細: {monitor.name}</h2>
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
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{monitor.id}</td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>ターゲット</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{monitor.target}</td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>説明</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>
                {editingDescription ? (
                  <form onSubmit={handleDescriptionSave} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                      type="text"
                      value={descriptionInput}
                      onChange={(e) => setDescriptionInput(e.target.value)}
                      maxLength={512}
                      autoFocus
                    />
                    <button type="submit" className="btn btn-primary btn-small" disabled={savingDescription}>
                      {savingDescription ? '保存中...' : '保存'}
                    </button>
                    <button type="button" className="btn btn-secondary btn-small" onClick={handleDescriptionCancel} disabled={savingDescription}>キャンセル</button>
                  </form>
                ) : (
                  <span style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {monitor.description || '-'}
                    <button className="btn btn-secondary btn-small" onClick={handleDescriptionEditStart}>編集</button>
                  </span>
                )}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>状態</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>
                <span className={`status ${monitor.enabled ? 'up' : 'down'}`}>
                  {monitor.enabled ? '有効' : '無効'}
                </span>
              </td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>可用性</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{monitor.availability || '-'}</td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>チェック間隔</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{monitor.delayLoop}秒</td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>最大リトライ回数</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{monitor.maxCheckAttempts}</td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>リトライ間隔</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{monitor.retryInterval}秒</td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>タイムアウト</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{monitor.timeout}秒</td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>メール通知</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{monitor.notifyEmailEnabled ? '有効' : '無効'}</td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>Slack通知</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{monitor.notifySlackEnabled ? '有効' : '無効'}</td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>通知間隔</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{monitor.notifyInterval}秒</td>
            </tr>
          </tbody>
        </table>
      </div>

      {monitor.healthCheck && (
        <div className="card" style={{ padding: '1rem', background: '#2a2a2a', borderRadius: '8px' }}>
          <h4 style={{ color: '#00adb5', marginTop: 0, marginBottom: '1rem' }}>ヘルスチェック設定</h4>
          <table style={{ borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>プロトコル</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{monitor.healthCheck.protocol}</td>
              </tr>
              {monitor.healthCheck.port && (
                <tr>
                  <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>ポート</td>
                  <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{monitor.healthCheck.port}</td>
                </tr>
              )}
              {monitor.healthCheck.path && (
                <tr>
                  <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>パス</td>
                  <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{monitor.healthCheck.path}</td>
                </tr>
              )}
              {monitor.healthCheck.host && (
                <tr>
                  <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>ホスト</td>
                  <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{monitor.healthCheck.host}</td>
                </tr>
              )}
              {monitor.healthCheck.status && (
                <tr>
                  <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>期待するステータス</td>
                  <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{monitor.healthCheck.status}</td>
                </tr>
              )}
              {monitor.healthCheck.containsString && (
                <tr>
                  <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>含まれる文字列</td>
                  <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{monitor.healthCheck.containsString}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {settingsForm && (
        <div className="modal-overlay" onClick={handleSettingsEditCancel} style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
            backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
            padding: '20px', minWidth: '360px', maxWidth: '460px', maxHeight: '85vh', overflowY: 'auto',
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>監視設定を編集</h3>

            <form onSubmit={handleSettingsSave}>
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={settingsForm.enabled}
                  onChange={(e) => setSettingsForm({ ...settingsForm, enabled: e.target.checked })}
                  style={{ marginRight: '0.5rem' }}
                />
                監視を有効にする
              </label>
            </div>
            <div className="form-group">
              <label>チェック間隔(秒)<span className="required-mark">*</span></label>
              <input
                type="number"
                value={settingsForm.delayLoop}
                onChange={(e) => setSettingsForm({ ...settingsForm, delayLoop: e.target.value })}
                min={60}
                max={3600}
                step={1}
                required
              />
            </div>
            <div className="form-group">
              <label>最大リトライ回数<span className="required-mark">*</span></label>
              <input
                type="number"
                value={settingsForm.maxCheckAttempts}
                onChange={(e) => setSettingsForm({ ...settingsForm, maxCheckAttempts: e.target.value })}
                min={1}
                max={10}
                step={1}
                required
              />
            </div>
            <div className="form-group">
              <label>リトライ間隔(秒)<span className="required-mark">*</span></label>
              <input
                type="number"
                value={settingsForm.retryInterval}
                onChange={(e) => setSettingsForm({ ...settingsForm, retryInterval: e.target.value })}
                min={10}
                max={3600}
                step={1}
                required
              />
            </div>
            <div className="form-group">
              <label>タイムアウト(秒)<span className="required-mark">*</span></label>
              <input
                type="number"
                value={settingsForm.timeout}
                onChange={(e) => setSettingsForm({ ...settingsForm, timeout: e.target.value })}
                min={10}
                max={30}
                step={1}
                required
              />
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
                <option value="ssh">ssh</option>
                <option value="dns">dns</option>
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
                placeholder="/(http/httpsのみ)"
              />
            </div>
            <div className="form-group">
              <label>ホスト(Hostヘッダ)</label>
              <input
                type="text"
                value={settingsForm.host}
                onChange={(e) => setSettingsForm({ ...settingsForm, host: e.target.value })}
                placeholder="example.com"
              />
            </div>
            <div className="form-group">
              <label>期待するステータスコード</label>
              <input
                type="number"
                value={settingsForm.status}
                onChange={(e) => setSettingsForm({ ...settingsForm, status: e.target.value })}
                placeholder="200"
                min={100}
                max={599}
                step={1}
              />
            </div>
            <div className="form-group">
              <label>含まれる文字列</label>
              <input
                type="text"
                value={settingsForm.containsString}
                onChange={(e) => setSettingsForm({ ...settingsForm, containsString: e.target.value })}
                placeholder="OK(http/httpsのみ)"
              />
            </div>

            <h4 style={{ color: '#00adb5', margin: '1rem 0' }}>通知</h4>
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={settingsForm.notifyEmailEnabled}
                  onChange={(e) => setSettingsForm({ ...settingsForm, notifyEmailEnabled: e.target.checked })}
                  style={{ marginRight: '0.5rem' }}
                />
                メール通知を有効にする
              </label>
            </div>
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={settingsForm.notifySlackEnabled}
                  onChange={(e) => setSettingsForm({ ...settingsForm, notifySlackEnabled: e.target.checked })}
                  style={{ marginRight: '0.5rem' }}
                />
                Slack通知を有効にする
              </label>
            </div>
            {settingsForm.notifySlackEnabled && (
              <div className="form-group">
                <label>Slack Incoming Webhook URL<span className="required-mark">*</span></label>
                <input
                  type="url"
                  value={settingsForm.slackWebhooksUrl}
                  onChange={(e) => setSettingsForm({ ...settingsForm, slackWebhooksUrl: e.target.value })}
                  placeholder="https://hooks.slack.com/services/..."
                  required
                />
              </div>
            )}
            <div className="form-group">
              <label>通知間隔(秒)<span className="required-mark">*</span></label>
              <input
                type="number"
                value={settingsForm.notifyInterval}
                onChange={(e) => setSettingsForm({ ...settingsForm, notifyInterval: e.target.value })}
                min={1}
                step={1}
                required
              />
            </div>

            {settingsError && (
              <div style={{ marginBottom: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>
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
