import { useState, useEffect, useCallback } from 'react';
import {
  GetServiceEndpointGateway,
  UpdateServiceEndpointGateway,
  ApplyServiceEndpointGateway,
  PowerOnServiceEndpointGateway,
  ShutdownServiceEndpointGateway,
  ResetServiceEndpointGateway,
} from '../../wailsjs/go/main/App';
import { serviceendpointgateway } from '../../wailsjs/go/models';
import { useGlobalReload } from '../hooks/useGlobalReload';

interface ServiceEndpointGatewayDetailProps {
  profile: string;
  zone: string;
  id: string;
}

const SERVICE_TYPES = ['ObjectStorage', 'ContainerRegistry', 'MonitoringSuite', 'AIEngine', 'AppRunDedicatedControlPlane'];

interface EnabledServiceForm {
  type: string;
  endpoints: string;
  mode: string;
}

export function ServiceEndpointGatewayDetail({ profile, zone, id }: ServiceEndpointGatewayDetailProps) {
  const [appliance, setAppliance] = useState<serviceendpointgateway.ApplianceInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [powerBusy, setPowerBusy] = useState(false);

  const [editingSettings, setEditingSettings] = useState(false);
  const [enabledServices, setEnabledServices] = useState<EnabledServiceForm[]>([]);
  const [monitoringSuite, setMonitoringSuite] = useState(false);
  const [dnsForwardingEnabled, setDnsForwardingEnabled] = useState(false);
  const [dnsPrivateHostedZone, setDnsPrivateHostedZone] = useState('');
  const [dnsUpstream1, setDnsUpstream1] = useState('');
  const [dnsUpstream2, setDnsUpstream2] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const loadAppliance = useCallback(async () => {
    if (!profile || !zone || !id) return;

    setLoading(true);
    try {
      const detail = await GetServiceEndpointGateway(profile, zone, id);
      setAppliance(detail);
    } catch (err) {
      console.error('[ServiceEndpointGatewayDetail] loadAppliance error:', err);
    } finally {
      setLoading(false);
    }
  }, [profile, zone, id]);

  useGlobalReload(loadAppliance);

  useEffect(() => {
    loadAppliance();
  }, [loadAppliance]);

  const handleSettingsEditStart = () => {
    if (!appliance) return;
    setEnabledServices((appliance.enabledServices || []).map(s => ({
      type: s.type,
      endpoints: (s.endpoints || []).join(', '),
      mode: s.mode || '',
    })));
    setMonitoringSuite(appliance.monitoringSuite);
    setDnsForwardingEnabled(appliance.dnsForwarding?.enabled || false);
    setDnsPrivateHostedZone(appliance.dnsForwarding?.privateHostedZone || '');
    setDnsUpstream1(appliance.dnsForwarding?.upstreamDNS1 || '');
    setDnsUpstream2(appliance.dnsForwarding?.upstreamDNS2 || '');
    setSettingsError(null);
    setEditingSettings(true);
  };

  const handleSettingsEditCancel = () => {
    setEditingSettings(false);
    setSettingsError(null);
  };

  const handleAddEnabledService = () => {
    setEnabledServices(prev => [...prev, { type: SERVICE_TYPES[0], endpoints: '', mode: '' }]);
  };

  const handleRemoveEnabledService = (index: number) => {
    setEnabledServices(prev => prev.filter((_, i) => i !== index));
  };

  const handleSettingsSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsError(null);
    try {
      const params = new serviceendpointgateway.UpdateParams({
        enabledServices: enabledServices.map(s => ({
          type: s.type,
          endpoints: s.endpoints.split(',').map(ep => ep.trim()).filter(ep => ep.length > 0),
          mode: s.mode,
        })),
        monitoringSuite,
        dnsForwarding: {
          enabled: dnsForwardingEnabled,
          privateHostedZone: dnsPrivateHostedZone,
          upstreamDNS1: dnsUpstream1,
          upstreamDNS2: dnsUpstream2,
        },
      });
      const updated = await UpdateServiceEndpointGateway(profile, zone, id, params);
      await ApplyServiceEndpointGateway(profile, zone, id);
      setAppliance(updated);
      setEditingSettings(false);
    } catch (err) {
      setSettingsError(String(err));
    } finally {
      setSavingSettings(false);
    }
  };

  const handlePower = async (action: 'powerOn' | 'powerOff' | 'reset') => {
    setPowerBusy(true);
    try {
      if (action === 'powerOn') {
        await PowerOnServiceEndpointGateway(profile, zone, id);
      } else if (action === 'powerOff') {
        await ShutdownServiceEndpointGateway(profile, zone, id);
      } else {
        await ResetServiceEndpointGateway(profile, zone, id);
      }
      await loadAppliance();
    } catch (err) {
      console.error('[ServiceEndpointGatewayDetail] power action error:', err);
    } finally {
      setPowerBusy(false);
    }
  };

  if (loading) return <div className="loading">読み込み中...</div>;
  if (!appliance) return <div className="empty-state">サービスエンドポイントゲートウェイ情報が見つかりません</div>;

  return (
    <div className="seg-detail">
      <div className="header">
        <h2>サービスエンドポイントゲートウェイ詳細: {appliance.id}</h2>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem', background: '#2a2a2a', borderRadius: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h4 style={{ color: '#00adb5', margin: 0 }}>基本情報</h4>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-secondary btn-small" onClick={() => handlePower('powerOn')} disabled={powerBusy || appliance.powerStatus === 'up'}>起動</button>
            <button className="btn btn-secondary btn-small" onClick={() => handlePower('powerOff')} disabled={powerBusy || appliance.powerStatus === 'down'}>停止</button>
            <button className="btn btn-secondary btn-small" onClick={() => handlePower('reset')} disabled={powerBusy || appliance.powerStatus.toLowerCase() !== 'up'}>再起動</button>
          </div>
        </div>
        <table style={{ borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>ID</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{appliance.id}</td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>可用性</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{appliance.availability}</td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>起動状態</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>
                <span className={`status ${appliance.powerStatus.toLowerCase() === 'up' ? 'up' : 'down'}`}>{appliance.powerStatus || 'unknown'}</span>
              </td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>接続スイッチ</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{appliance.switchName || '-'}</td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>インターフェース</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>
                {appliance.interfaces?.length ? appliance.interfaces.map(i => i.ipAddress).filter(Boolean).join(', ') : '-'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="card" style={{ padding: '1rem', background: '#2a2a2a', borderRadius: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h4 style={{ color: '#00adb5', margin: 0 }}>接続先マネージドサービス設定</h4>
          {!editingSettings && (
            <button className="btn btn-secondary btn-small" onClick={handleSettingsEditStart}>編集</button>
          )}
        </div>

        {editingSettings ? (
          <form onSubmit={handleSettingsSave}>
            {enabledServices.map((s, index) => (
              <div key={index} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <select
                  value={s.type}
                  onChange={(e) => setEnabledServices(prev => prev.map((item, i) => i === index ? { ...item, type: e.target.value } : item))}
                  style={{ flex: '0 0 auto' }}
                >
                  {SERVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <input
                  type="text"
                  value={s.endpoints}
                  onChange={(e) => setEnabledServices(prev => prev.map((item, i) => i === index ? { ...item, endpoints: e.target.value } : item))}
                  placeholder="エンドポイント(カンマ区切り)"
                  style={{ flex: 1 }}
                />
                <button type="button" className="btn btn-secondary btn-small" onClick={() => handleRemoveEnabledService(index)}>削除</button>
              </div>
            ))}
            <button type="button" className="btn btn-secondary btn-small" onClick={handleAddEnabledService} style={{ marginBottom: '1rem' }}>
              + 接続先サービスを追加
            </button>

            <div className="form-group">
              <label>
                <input type="checkbox" checked={monitoringSuite} onChange={(e) => setMonitoringSuite(e.target.checked)} />
                {' '}モニタリングスイート連携を有効にする
              </label>
            </div>

            <div className="form-group">
              <label>
                <input type="checkbox" checked={dnsForwardingEnabled} onChange={(e) => setDnsForwardingEnabled(e.target.checked)} />
                {' '}DNSプライベートホストゾーン連携を有効にする
              </label>
            </div>
            {dnsForwardingEnabled && (
              <>
                <div className="form-group">
                  <label>ゾーン名</label>
                  <input type="text" value={dnsPrivateHostedZone} onChange={(e) => setDnsPrivateHostedZone(e.target.value)} placeholder="例: internal.example.com" />
                </div>
                <div className="form-group">
                  <label>フォワード先DNSサーバ(1)</label>
                  <input type="text" value={dnsUpstream1} onChange={(e) => setDnsUpstream1(e.target.value)} placeholder="例: 10.0.0.1" />
                </div>
                <div className="form-group">
                  <label>フォワード先DNSサーバ(2)</label>
                  <input type="text" value={dnsUpstream2} onChange={(e) => setDnsUpstream2(e.target.value)} placeholder="例: 10.0.0.2" />
                </div>
              </>
            )}

            {settingsError && (
              <div style={{ marginBottom: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>
                エラー: {settingsError}
              </div>
            )}
            <div className="confirm-actions">
              <button type="button" className="btn btn-secondary" onClick={handleSettingsEditCancel} disabled={savingSettings}>キャンセル</button>
              <button type="submit" className="btn btn-primary" disabled={savingSettings}>
                {savingSettings ? '保存・適用中...' : '保存して適用する'}
              </button>
            </div>
          </form>
        ) : (
          <table style={{ borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left', verticalAlign: 'top' }}>接続先サービス</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>
                  {appliance.enabledServices?.length ? (
                    appliance.enabledServices.map((s, i) => (
                      <div key={i}>{s.type}: {s.endpoints?.join(', ') || '-'}</div>
                    ))
                  ) : '-'}
                </td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>モニタリングスイート連携</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{appliance.monitoringSuite ? '有効' : '無効'}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>DNSフォワーディング</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>
                  {appliance.dnsForwarding?.enabled
                    ? `有効 (${appliance.dnsForwarding.privateHostedZone || '-'})`
                    : '無効'}
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
