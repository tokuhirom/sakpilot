import { useState, useEffect, useCallback } from 'react';
import { GetSwitchDetail, UpdateSwitch } from '../../wailsjs/go/main/App';
import { sakura } from '../../wailsjs/go/models';
import { useGlobalReload } from '../hooks/useGlobalReload';

const IPV4_PATTERN = '^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(\\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$';

interface SwitchDetailProps {
  profile: string;
  zone: string;
  switchId: string;
}

export function SwitchDetail({ profile, zone, switchId }: SwitchDetailProps) {
  const [switchInfo, setSwitchInfo] = useState<sakura.SwitchInfo | null>(null);
  const [loading, setLoading] = useState(false);

  const [editingBasic, setEditingBasic] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [descriptionInput, setDescriptionInput] = useState('');
  const [networkMaskLenInput, setNetworkMaskLenInput] = useState('');
  const [defaultRouteInput, setDefaultRouteInput] = useState('');
  const [savingBasic, setSavingBasic] = useState(false);
  const [basicError, setBasicError] = useState<string | null>(null);

  const loadSwitchDetail = useCallback(async () => {
    if (!profile || !zone || !switchId) return;

    setLoading(true);
    try {
      const detail = await GetSwitchDetail(profile, zone, switchId);
      setSwitchInfo(detail);
    } catch (err) {
      console.error('[SwitchDetail] loadSwitchDetail error:', err);
    } finally {
      setLoading(false);
    }
  }, [profile, zone, switchId]);

  useGlobalReload(loadSwitchDetail);

  useEffect(() => {
    loadSwitchDetail();
  }, [loadSwitchDetail]);

  const handleBasicEditStart = () => {
    if (!switchInfo) return;
    setNameInput(switchInfo.name);
    setDescriptionInput(switchInfo.description || '');
    setNetworkMaskLenInput(switchInfo.networkMaskLen > 0 ? String(switchInfo.networkMaskLen) : '');
    setDefaultRouteInput(switchInfo.defaultRoute || '');
    setBasicError(null);
    setEditingBasic(true);
  };

  const handleBasicEditCancel = () => {
    setEditingBasic(false);
    setBasicError(null);
  };

  const handleBasicSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBasic(true);
    setBasicError(null);
    try {
      const maskLen = networkMaskLenInput ? parseInt(networkMaskLenInput, 10) : 0;
      const updated = await UpdateSwitch(profile, zone, switchId, nameInput, descriptionInput, maskLen, defaultRouteInput);
      setSwitchInfo(updated);
      setEditingBasic(false);
    } catch (e) {
      setBasicError(String(e));
    } finally {
      setSavingBasic(false);
    }
  };

  if (loading) return <div className="loading">読み込み中...</div>;
  if (!switchInfo) return <div className="empty-state">スイッチ情報が見つかりません</div>;

  return (
    <div className="switch-detail">
      <div className="header">
        <h2>スイッチ詳細: {switchInfo.name}</h2>
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
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>説明</label>
              <input
                type="text"
                value={descriptionInput}
                onChange={(e) => setDescriptionInput(e.target.value)}
                placeholder="任意"
                maxLength={512}
              />
            </div>
            <div className="form-group">
              <label>ネットワークマスク長</label>
              <input
                type="number"
                value={networkMaskLenInput}
                onChange={(e) => setNetworkMaskLenInput(e.target.value)}
                placeholder="任意(ルータ接続する場合のみ、26-28)"
                min={26}
                max={28}
              />
            </div>
            <div className="form-group">
              <label>デフォルトルート</label>
              <input
                type="text"
                value={defaultRouteInput}
                onChange={(e) => setDefaultRouteInput(e.target.value)}
                placeholder="任意(例: 192.168.0.1)"
                pattern={IPV4_PATTERN}
              />
            </div>
            {basicError && (
              <div style={{ marginBottom: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>
                エラー: {basicError}
              </div>
            )}
            <div className="confirm-actions">
              <button type="button" className="btn btn-secondary" onClick={handleBasicEditCancel} disabled={savingBasic}>キャンセル</button>
              <button type="submit" className="btn btn-primary" disabled={savingBasic}>
                {savingBasic ? '保存中...' : '保存する'}
              </button>
            </div>
          </form>
        ) : (
          <table style={{ borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>ID</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{switchInfo.id}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>説明</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{switchInfo.description || '-'}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>接続サーバー数</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{switchInfo.serverCount}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>スコープ</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>
                  <span className={`status ${switchInfo.scope === 'shared' ? 'up' : ''}`}>
                    {switchInfo.scope === 'shared' ? '共有' : switchInfo.scope === 'user' ? 'ユーザー' : switchInfo.scope}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      {switchInfo.networkMaskLen > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem', background: '#2a2a2a', borderRadius: '8px' }}>
          <h4 style={{ color: '#00adb5', marginTop: 0, marginBottom: '1rem' }}>ネットワーク設定</h4>
          <table style={{ borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>ネットワークマスク</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>/{switchInfo.networkMaskLen}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>デフォルトルート</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{switchInfo.defaultRoute || '-'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {switchInfo.subnets && switchInfo.subnets.length > 0 && (
        <>
          <h3>サブネット</h3>
          <table className="table">
            <thead>
              <tr>
                <th>ネットワークアドレス</th>
                <th>マスク長</th>
                <th>デフォルトルート</th>
                <th>Next Hop</th>
              </tr>
            </thead>
            <tbody>
              {switchInfo.subnets.map((subnet, index) => (
                <tr key={index}>
                  <td style={{ textAlign: 'left', fontFamily: 'monospace' }}>{subnet.networkAddress}</td>
                  <td style={{ textAlign: 'left' }}>/{subnet.networkMaskLen}</td>
                  <td style={{ textAlign: 'left', fontFamily: 'monospace' }}>{subnet.defaultRoute || '-'}</td>
                  <td style={{ textAlign: 'left', fontFamily: 'monospace' }}>{subnet.nextHop || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
