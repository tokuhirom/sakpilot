import { useState, useEffect, useCallback } from 'react';
import { GetKMSKey, RotateKMSKey, ChangeKMSKeyStatus } from '../../wailsjs/go/main/App';
import { kms } from '../../wailsjs/go/models';
import { useGlobalReload } from '../hooks/useGlobalReload';

interface KMSDetailProps {
  profile: string;
  keyId: string;
}

type PendingAction = { type: 'rotate' } | { type: 'status'; status: string };

const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'active': return 'up';
    case 'restricted': return 'down';
    case 'suspended': return 'down';
    case 'pending_destruction': return 'down';
    default: return '';
  }
};

const getStatusName = (status: string) => {
  switch (status.toLowerCase()) {
    case 'active': return 'アクティブ';
    case 'restricted': return '制限中';
    case 'suspended': return '停止中';
    case 'pending_destruction': return '削除予定';
    default: return status;
  }
};

const getKeyOriginName = (origin: string) => {
  switch (origin) {
    case 'sakura_kms': return 'さくらKMS';
    case 'external': return '外部';
    default: return origin;
  }
};

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

const STATUS_OPTIONS: { status: string; label: string }[] = [
  { status: 'active', label: 'アクティブ化' },
  { status: 'restricted', label: '制限' },
  { status: 'suspended', label: '停止' },
];

export function KMSDetail({ profile, keyId }: KMSDetailProps) {
  const [key, setKey] = useState<kms.KeyInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [runningAction, setRunningAction] = useState<PendingAction['type'] | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  const loadKey = useCallback(async () => {
    if (!profile || !keyId) return;

    setLoading(true);
    try {
      const detail = await GetKMSKey(profile, keyId);
      setKey(detail);
    } catch (err) {
      console.error('[KMSDetail] loadKey error:', err);
    } finally {
      setLoading(false);
    }
  }, [profile, keyId]);

  useGlobalReload(loadKey);

  useEffect(() => {
    loadKey();
  }, [loadKey]);

  const handleActionCancel = () => setPendingAction(null);

  const handleActionConfirm = async () => {
    if (!pendingAction) return;
    const action = pendingAction;
    setPendingAction(null);
    setRunningAction(action.type);
    try {
      if (action.type === 'rotate') {
        const updated = await RotateKMSKey(profile, keyId);
        setKey(updated);
      } else {
        await ChangeKMSKeyStatus(profile, keyId, action.status);
        await loadKey();
      }
    } catch (e) {
      alert(
        action.type === 'rotate'
          ? `ローテーションに失敗しました: ${e}`
          : `ステータス変更に失敗しました: ${e}`
      );
    } finally {
      setRunningAction(null);
    }
  };

  if (loading) return <div className="loading">読み込み中...</div>;
  if (!key) return <div className="empty-state">KMSキー情報が見つかりません</div>;

  return (
    <div className="kms-detail">
      <div className="header">
        <h2>KMSキー詳細: {key.name}</h2>
        <button
          className="btn btn-secondary btn-small"
          onClick={() => setPendingAction({ type: 'rotate' })}
          disabled={runningAction !== null}
        >
          {runningAction === 'rotate' ? '処理中...' : 'ローテーション'}
        </button>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem', background: '#2a2a2a', borderRadius: '8px' }}>
        <h4 style={{ color: '#00adb5', marginTop: 0, marginBottom: '1rem' }}>基本情報</h4>
        <table style={{ borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>ID</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{key.id}</td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>説明</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{key.description || '-'}</td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>ステータス</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>
                <span className={`status ${getStatusColor(key.status)}`}>
                  {getStatusName(key.status)}
                </span>
              </td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>キー起源</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{getKeyOriginName(key.keyOrigin)}</td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>バージョン</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{key.latestVersion}</td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>作成日</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{formatDate(key.createdAt)}</td>
            </tr>
            {key.tags && key.tags.length > 0 && (
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>タグ</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>
                  <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                    {key.tags.map(tag => (
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
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ padding: '1rem', background: '#2a2a2a', borderRadius: '8px' }}>
        <h4 style={{ color: '#00adb5', marginTop: 0, marginBottom: '1rem' }}>ステータス変更</h4>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {STATUS_OPTIONS.map(({ status, label }) => (
            <button
              key={status}
              className="btn btn-secondary btn-small"
              onClick={() => setPendingAction({ type: 'status', status })}
              disabled={runningAction !== null || key.status.toLowerCase() === status}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {pendingAction && (
        <div className="confirm-overlay" onClick={handleActionCancel}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            {pendingAction.type === 'rotate' ? (
              <p>KMSキー「{key.name}」をローテーションしますか？</p>
            ) : (
              <p>
                KMSキー「{key.name}」のステータスを
                {STATUS_OPTIONS.find(o => o.status === pendingAction.status)?.label}
                しますか？
              </p>
            )}
            <div className="confirm-actions">
              <button className="btn btn-secondary" onClick={handleActionCancel}>キャンセル</button>
              <button className="btn btn-primary" onClick={handleActionConfirm}>実行する</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
