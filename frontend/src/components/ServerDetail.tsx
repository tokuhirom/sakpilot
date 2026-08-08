import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GetServerDetail,
  ChangeServerPlan,
  GetCDROMs,
  InsertServerCDROM,
  EjectServerCDROM,
  SendServerKey,
  SendServerNMI,
  GetServerVNCProxy,
} from '../../wailsjs/go/main/App';
import { sakura } from '../../wailsjs/go/models';
import { useGlobalReload } from '../hooks/useGlobalReload';

interface ServerDetailProps {
  profile: string;
  zone: string;
  serverId: string;
}

const KEY_PRESETS = [
  { label: 'CTRL+ALT+DELETE', value: 'CTRL+ALT+DELETE' },
  { label: 'ENTER', value: 'ENTER' },
  { label: 'ESC', value: 'ESC' },
  { label: 'TAB', value: 'TAB' },
  { label: 'F1', value: 'F1' },
  { label: 'F2', value: 'F2' },
];

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

export function ServerDetail({ profile, zone, serverId }: ServerDetailProps) {
  const navigate = useNavigate();
  const [serverInfo, setServerInfo] = useState<sakura.ServerInfo | null>(null);
  const [loading, setLoading] = useState(false);

  const [editingPlan, setEditingPlan] = useState(false);
  const [cpuInput, setCpuInput] = useState(1);
  const [memoryInput, setMemoryInput] = useState(1);
  const [savingPlan, setSavingPlan] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

  const [cdroms, setCdroms] = useState<sakura.CDROMInfo[]>([]);
  const [editingCDROM, setEditingCDROM] = useState(false);
  const [selectedCDROMId, setSelectedCDROMId] = useState('');
  const [savingCDROM, setSavingCDROM] = useState(false);
  const [cdromError, setCdromError] = useState<string | null>(null);

  const [selectedKey, setSelectedKey] = useState(KEY_PRESETS[0].value);
  const [sendingKey, setSendingKey] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [keyMessage, setKeyMessage] = useState<string | null>(null);

  const [sendingNMI, setSendingNMI] = useState(false);
  const [nmiConfirm, setNmiConfirm] = useState(false);
  const [nmiError, setNmiError] = useState<string | null>(null);

  const [vncInfo, setVncInfo] = useState<sakura.VNCProxyInfo | null>(null);
  const [loadingVNC, setLoadingVNC] = useState(false);
  const [vncError, setVncError] = useState<string | null>(null);

  const loadServerDetail = useCallback(async () => {
    if (!profile || !zone || !serverId) return;

    setLoading(true);
    try {
      const detail = await GetServerDetail(profile, zone, serverId);
      setServerInfo(detail);
    } catch (err) {
      console.error('[ServerDetail] loadServerDetail error:', err);
    } finally {
      setLoading(false);
    }
  }, [profile, zone, serverId]);

  useGlobalReload(loadServerDetail);

  useEffect(() => {
    loadServerDetail();
  }, [loadServerDetail]);

  const handlePlanEditStart = () => {
    if (!serverInfo) return;
    setCpuInput(serverInfo.cpu);
    setMemoryInput(serverInfo.memory);
    setPlanError(null);
    setEditingPlan(true);
  };

  const handlePlanEditCancel = () => {
    setEditingPlan(false);
    setPlanError(null);
  };

  const handlePlanSave = async () => {
    setSavingPlan(true);
    setPlanError(null);
    try {
      const updated = await ChangeServerPlan(profile, zone, serverId, cpuInput, memoryInput);
      setEditingPlan(false);
      // プラン変更APIはサーバーIDが変わるため、新しいIDの詳細ページへ遷移する
      if (updated.id !== serverId) {
        navigate(`/${profile}/servers/${updated.id}`, { replace: true });
      } else {
        setServerInfo(updated);
      }
    } catch (e) {
      setPlanError(String(e));
    } finally {
      setSavingPlan(false);
    }
  };

  const handleCDROMEditStart = async () => {
    setCdromError(null);
    setSelectedCDROMId('');
    setEditingCDROM(true);
    try {
      const list = await GetCDROMs(profile, zone);
      setCdroms(list || []);
    } catch (err) {
      console.error('[ServerDetail] GetCDROMs error:', err);
      setCdroms([]);
    }
  };

  const handleCDROMEditCancel = () => {
    setEditingCDROM(false);
    setCdromError(null);
  };

  const handleInsertCDROM = async () => {
    if (!selectedCDROMId) return;
    setSavingCDROM(true);
    setCdromError(null);
    try {
      await InsertServerCDROM(profile, zone, serverId, selectedCDROMId);
      await loadServerDetail();
      setEditingCDROM(false);
    } catch (e) {
      setCdromError(String(e));
    } finally {
      setSavingCDROM(false);
    }
  };

  const handleEjectCDROM = async () => {
    setSavingCDROM(true);
    setCdromError(null);
    try {
      await EjectServerCDROM(profile, zone, serverId);
      await loadServerDetail();
      setEditingCDROM(false);
    } catch (e) {
      setCdromError(String(e));
    } finally {
      setSavingCDROM(false);
    }
  };

  const handleSendKey = async () => {
    setSendingKey(true);
    setKeyError(null);
    setKeyMessage(null);
    try {
      await SendServerKey(profile, zone, serverId, selectedKey);
      setKeyMessage(`「${selectedKey}」を送信しました`);
    } catch (e) {
      setKeyError(String(e));
    } finally {
      setSendingKey(false);
    }
  };

  const handleSendNMI = async () => {
    setSendingNMI(true);
    setNmiError(null);
    try {
      await SendServerNMI(profile, zone, serverId);
      setNmiConfirm(false);
    } catch (e) {
      setNmiError(String(e));
    } finally {
      setSendingNMI(false);
    }
  };

  const handleGetVNCProxy = async () => {
    setLoadingVNC(true);
    setVncError(null);
    setVncInfo(null);
    try {
      const info = await GetServerVNCProxy(profile, zone, serverId);
      setVncInfo(info);
    } catch (e) {
      setVncError(String(e));
    } finally {
      setLoadingVNC(false);
    }
  };

  if (loading) return <div className="loading">読み込み中...</div>;
  if (!serverInfo) return <div className="empty-state">サーバー情報が見つかりません</div>;

  return (
    <div className="server-detail">
      <div className="header">
        <h2>サーバー詳細: {serverInfo.name}</h2>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem', background: '#2a2a2a', borderRadius: '8px' }}>
        <h4 style={{ color: '#00adb5', margin: '0 0 1rem 0' }}>基本情報</h4>
        <table style={{ borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>ID</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{serverInfo.id}</td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>説明</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{serverInfo.description || '-'}</td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>ステータス</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>
                <span className={`status ${serverInfo.status.toLowerCase() === 'up' ? 'up' : 'down'}`} style={{ padding: '2px 6px', fontSize: '0.75rem' }}>
                  {serverInfo.status}
                </span>
              </td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>IPアドレス</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{serverInfo.ipAddresses?.join(', ') || '-'}</td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>タグ</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>
                {serverInfo.tags && serverInfo.tags.length > 0 ? serverInfo.tags.join(', ') : '-'}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>作成日</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{formatDate(serverInfo.createdAt)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem', background: '#2a2a2a', borderRadius: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h4 style={{ color: '#00adb5', margin: 0 }}>プラン</h4>
          {!editingPlan && (
            <button className="btn btn-secondary btn-small" onClick={handlePlanEditStart} disabled={serverInfo.status.toLowerCase() === 'up'}>変更</button>
          )}
        </div>
        {editingPlan ? (
          <div>
            {serverInfo.status.toLowerCase() === 'up' && (
              <p style={{ color: '#f59e0b', fontSize: '0.85rem' }}>プラン変更にはサーバーが停止している必要があります</p>
            )}
            <div className="form-group">
              <label>CPU (コア数)</label>
              <input
                type="number"
                min={1}
                value={cpuInput}
                onChange={(e) => setCpuInput(Number(e.target.value))}
              />
            </div>
            <div className="form-group">
              <label>メモリ (GB)</label>
              <input
                type="number"
                min={1}
                value={memoryInput}
                onChange={(e) => setMemoryInput(Number(e.target.value))}
              />
            </div>
            {planError && (
              <div style={{ marginBottom: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>
                エラー: {planError}
              </div>
            )}
            <div className="confirm-actions">
              <button className="btn btn-secondary" onClick={handlePlanEditCancel} disabled={savingPlan}>キャンセル</button>
              <button className="btn btn-primary" onClick={handlePlanSave} disabled={savingPlan}>
                {savingPlan ? '保存中...' : '保存する'}
              </button>
            </div>
          </div>
        ) : (
          <p style={{ margin: 0 }}>{serverInfo.cpu} vCPU / {serverInfo.memory} GB</p>
        )}
      </div>

      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem', background: '#2a2a2a', borderRadius: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h4 style={{ color: '#00adb5', margin: 0 }}>CD-ROM</h4>
          {!editingCDROM && (
            <button className="btn btn-secondary btn-small" onClick={handleCDROMEditStart}>変更</button>
          )}
        </div>
        {editingCDROM ? (
          <div>
            <div className="form-group">
              <label>挿入するCD-ROM</label>
              <select
                value={selectedCDROMId}
                onChange={(e) => setSelectedCDROMId(e.target.value)}
              >
                <option value="">選択してください</option>
                {cdroms.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            {cdromError && (
              <div style={{ marginBottom: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>
                エラー: {cdromError}
              </div>
            )}
            <div className="confirm-actions">
              <button className="btn btn-secondary" onClick={handleCDROMEditCancel} disabled={savingCDROM}>キャンセル</button>
              {serverInfo.cdromId && (
                <button className="btn btn-danger" onClick={handleEjectCDROM} disabled={savingCDROM}>
                  {savingCDROM ? '処理中...' : '排出する'}
                </button>
              )}
              <button className="btn btn-primary" onClick={handleInsertCDROM} disabled={savingCDROM || !selectedCDROMId}>
                {savingCDROM ? '処理中...' : '挿入する'}
              </button>
            </div>
          </div>
        ) : (
          <p style={{ margin: 0 }}>{serverInfo.cdromId || '(未挿入)'}</p>
        )}
      </div>

      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem', background: '#2a2a2a', borderRadius: '8px' }}>
        <h4 style={{ color: '#00adb5', margin: '0 0 1rem 0' }}>コンソール操作</h4>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          <select value={selectedKey} onChange={(e) => setSelectedKey(e.target.value)} style={{ width: 'auto' }}>
            {KEY_PRESETS.map((k) => (
              <option key={k.value} value={k.value}>{k.label}</option>
            ))}
          </select>
          <button className="btn btn-secondary btn-small" onClick={handleSendKey} disabled={sendingKey}>
            {sendingKey ? '送信中...' : 'キーを送信'}
          </button>
        </div>
        {keyMessage && <p style={{ margin: '0 0 0.5rem 0', color: '#22c55e', fontSize: '0.85rem' }}>{keyMessage}</p>}
        {keyError && <p style={{ margin: '0 0 0.5rem 0', color: '#ff6b6b', fontSize: '0.85rem' }}>エラー: {keyError}</p>}

        <div style={{ borderTop: '1px solid #333', margin: '0.75rem 0' }}></div>

        {nmiConfirm ? (
          <div>
            <p style={{ color: '#f59e0b', fontSize: '0.85rem' }}>
              NMI(Non-Maskable Interrupt)を送信すると、カーネルパニックを誘発する可能性があります。よろしいですか？
            </p>
            {nmiError && <p style={{ margin: '0 0 0.5rem 0', color: '#ff6b6b', fontSize: '0.85rem' }}>エラー: {nmiError}</p>}
            <div className="confirm-actions">
              <button className="btn btn-secondary" onClick={() => setNmiConfirm(false)} disabled={sendingNMI}>キャンセル</button>
              <button className="btn btn-danger" onClick={handleSendNMI} disabled={sendingNMI}>
                {sendingNMI ? '送信中...' : 'NMIを送信する'}
              </button>
            </div>
          </div>
        ) : (
          <button className="btn btn-secondary btn-small" onClick={() => { setNmiError(null); setNmiConfirm(true); }}>NMIを送信</button>
        )}
      </div>

      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem', background: '#2a2a2a', borderRadius: '8px' }}>
        <h4 style={{ color: '#00adb5', margin: '0 0 1rem 0' }}>VNC接続情報</h4>
        <button className="btn btn-secondary btn-small" onClick={handleGetVNCProxy} disabled={loadingVNC}>
          {loadingVNC ? '取得中...' : '接続情報を取得'}
        </button>
        {vncError && <p style={{ margin: '0.5rem 0 0 0', color: '#ff6b6b', fontSize: '0.85rem' }}>エラー: {vncError}</p>}
        {vncInfo && (
          <table style={{ borderCollapse: 'collapse', marginTop: '0.75rem' }}>
            <tbody>
              <tr>
                <td style={{ padding: '0.25rem 1rem 0.25rem 0', color: '#888', textAlign: 'left' }}>ステータス</td>
                <td style={{ padding: '0.25rem 0', textAlign: 'left' }}>{vncInfo.status}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.25rem 1rem 0.25rem 0', color: '#888', textAlign: 'left' }}>ホスト</td>
                <td style={{ padding: '0.25rem 0', textAlign: 'left' }}>{vncInfo.host}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.25rem 1rem 0.25rem 0', color: '#888', textAlign: 'left' }}>ポート</td>
                <td style={{ padding: '0.25rem 0', textAlign: 'left' }}>{vncInfo.port}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.25rem 1rem 0.25rem 0', color: '#888', textAlign: 'left' }}>パスワード</td>
                <td style={{ padding: '0.25rem 0', textAlign: 'left' }}>{vncInfo.password}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
