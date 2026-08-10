import { useState, useEffect, useCallback } from 'react';
import {
  GetIAMServicePrincipal,
  UpdateIAMServicePrincipal,
  GetIAMServicePrincipalKeys,
  UploadIAMServicePrincipalKey,
  EnableIAMServicePrincipalKey,
  DisableIAMServicePrincipalKey,
  DeleteIAMServicePrincipalKey,
} from '../../wailsjs/go/main/App';
import { iam } from '../../wailsjs/go/models';
import { useGlobalReload } from '../hooks/useGlobalReload';

interface IAMServicePrincipalDetailProps {
  profile: string;
  servicePrincipalId: number;
}

type PendingKeyAction = { type: 'enable' | 'disable' | 'delete'; key: iam.ServicePrincipalKeyInfo };

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString || '-';

  const Y = date.getFullYear();
  const M = String(date.getMonth() + 1).padStart(2, '0');
  const D = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');

  return `${Y}/${M}/${D} ${h}:${m}:${s}`;
};

const getKeyStatusColor = (status: string) => (status.toLowerCase() === 'enabled' ? 'up' : 'down');
const getKeyStatusName = (status: string) => (status.toLowerCase() === 'enabled' ? '有効' : '無効');

export function IAMServicePrincipalDetail({ profile, servicePrincipalId }: IAMServicePrincipalDetailProps) {
  const [sp, setSp] = useState<iam.ServicePrincipalInfo | null>(null);
  const [keys, setKeys] = useState<iam.ServicePrincipalKeyInfo[]>([]);
  const [loading, setLoading] = useState(false);

  const [editingBasic, setEditingBasic] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [descriptionInput, setDescriptionInput] = useState('');
  const [savingBasic, setSavingBasic] = useState(false);
  const [basicError, setBasicError] = useState<string | null>(null);

  const [showUpload, setShowUpload] = useState(false);
  const [publicKeyInput, setPublicKeyInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [pendingKeyAction, setPendingKeyAction] = useState<PendingKeyAction | null>(null);
  const [runningKeyAction, setRunningKeyAction] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!profile || !servicePrincipalId) return;
    setLoading(true);
    try {
      const [detail, keyList] = await Promise.all([
        GetIAMServicePrincipal(profile, servicePrincipalId),
        GetIAMServicePrincipalKeys(profile, servicePrincipalId),
      ]);
      setSp(detail);
      setKeys(keyList || []);
    } catch (err) {
      console.error('[IAMServicePrincipalDetail] loadData error:', err);
    } finally {
      setLoading(false);
    }
  }, [profile, servicePrincipalId]);

  useGlobalReload(loadData);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleBasicEditStart = () => {
    if (!sp) return;
    setNameInput(sp.name);
    setDescriptionInput(sp.description || '');
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
      const updated = await UpdateIAMServicePrincipal(profile, servicePrincipalId, nameInput, descriptionInput);
      setSp(updated);
      setEditingBasic(false);
    } catch (e) {
      setBasicError(String(e));
    } finally {
      setSavingBasic(false);
    }
  };

  const handleUploadOpen = () => {
    setPublicKeyInput('');
    setUploadError(null);
    setShowUpload(true);
  };

  const handleUploadCancel = () => setShowUpload(false);

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);
    setUploadError(null);
    try {
      await UploadIAMServicePrincipalKey(profile, servicePrincipalId, publicKeyInput);
      setShowUpload(false);
      await loadData();
    } catch (e) {
      setUploadError(String(e));
    } finally {
      setUploading(false);
    }
  };

  const handleKeyActionCancel = () => setPendingKeyAction(null);

  const handleKeyActionConfirm = async () => {
    if (!pendingKeyAction) return;
    const action = pendingKeyAction;
    setPendingKeyAction(null);
    setRunningKeyAction(action.key.id);
    try {
      if (action.type === 'enable') {
        await EnableIAMServicePrincipalKey(profile, servicePrincipalId, action.key.id);
      } else if (action.type === 'disable') {
        await DisableIAMServicePrincipalKey(profile, servicePrincipalId, action.key.id);
      } else {
        await DeleteIAMServicePrincipalKey(profile, servicePrincipalId, action.key.id);
      }
      await loadData();
    } catch (e) {
      alert(`キー操作に失敗しました: ${e}`);
    } finally {
      setRunningKeyAction(null);
    }
  };

  if (loading && !sp) return <div className="loading">読み込み中...</div>;
  if (!sp) return <div className="empty-state">サービスプリンシパル情報が見つかりません</div>;

  return (
    <div className="iam-serviceprincipal-detail">
      <div className="header">
        <h2>サービスプリンシパル詳細: {sp.name}</h2>
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
                autoFocus
                required
              />
            </div>
            <div className="form-group">
              <label>説明</label>
              <input
                type="text"
                value={descriptionInput}
                onChange={(e) => setDescriptionInput(e.target.value)}
                placeholder="任意"
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
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{sp.id}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>プロジェクトID</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{sp.projectId}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>説明</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{sp.description || '-'}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>作成日</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{formatDate(sp.createdAt)}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>更新日</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{formatDate(sp.updatedAt)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      <div className="card" style={{ padding: '1rem', background: '#2a2a2a', borderRadius: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h4 style={{ color: '#00adb5', margin: 0 }}>キー</h4>
          <button className="btn btn-primary btn-small" onClick={handleUploadOpen}>+ キー登録</button>
        </div>

        {keys.length === 0 ? (
          <div className="empty-state">キーがありません</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Kid</th>
                <th>状態</th>
                <th>鍵の生成元</th>
                <th>作成日</th>
                <th>有効期限</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {keys.map(key => (
                <tr key={key.id}>
                  <td>{key.id}</td>
                  <td>{key.kid}</td>
                  <td>
                    <span className={`status ${getKeyStatusColor(key.status)}`}>
                      {getKeyStatusName(key.status)}
                    </span>
                  </td>
                  <td>{key.keyOrigin}</td>
                  <td>{formatDate(key.createdAt)}</td>
                  <td>{key.keyExpiresAt ? formatDate(key.keyExpiresAt) : '-'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {key.status.toLowerCase() === 'enabled' ? (
                        <button
                          className="btn btn-secondary btn-small"
                          onClick={() => setPendingKeyAction({ type: 'disable', key })}
                          disabled={runningKeyAction !== null}
                        >
                          無効化
                        </button>
                      ) : (
                        <button
                          className="btn btn-secondary btn-small"
                          onClick={() => setPendingKeyAction({ type: 'enable', key })}
                          disabled={runningKeyAction !== null}
                        >
                          有効化
                        </button>
                      )}
                      <button
                        className="btn btn-danger btn-small"
                        onClick={() => setPendingKeyAction({ type: 'delete', key })}
                        disabled={runningKeyAction !== null}
                      >
                        削除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pendingKeyAction && (
        <div className="confirm-overlay" onClick={handleKeyActionCancel}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            {pendingKeyAction.type === 'enable' && <p>キー「{pendingKeyAction.key.kid}」を有効化しますか？</p>}
            {pendingKeyAction.type === 'disable' && <p>キー「{pendingKeyAction.key.kid}」を無効化しますか？</p>}
            {pendingKeyAction.type === 'delete' && (
              <>
                <p>キー「{pendingKeyAction.key.kid}」を削除しますか？</p>
                <p className="confirm-warning">この操作は取り消せません。このキーで発行されたトークンは無効になります。</p>
              </>
            )}
            <div className="confirm-actions">
              <button className="btn btn-secondary" onClick={handleKeyActionCancel}>キャンセル</button>
              <button className="btn btn-primary" onClick={handleKeyActionConfirm}>実行する</button>
            </div>
          </div>
        </div>
      )}

      {showUpload && (
        <div className="modal-overlay" onClick={handleUploadCancel} style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
            backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
            padding: '20px', minWidth: '320px', maxWidth: '480px',
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>キー登録</h3>
            <form onSubmit={handleUploadSubmit}>
              <div className="form-group">
                <label>公開鍵(PEM)<span className="required-mark">*</span></label>
                <textarea
                  value={publicKeyInput}
                  onChange={(e) => setPublicKeyInput(e.target.value)}
                  placeholder="-----BEGIN PUBLIC KEY-----..."
                  rows={6}
                  autoFocus
                  required
                />
              </div>
              {uploadError && (
                <div style={{ marginBottom: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>
                  エラー: {uploadError}
                </div>
              )}
              <div className="confirm-actions">
                <button type="button" className="btn btn-secondary" onClick={handleUploadCancel}>キャンセル</button>
                <button type="submit" className="btn btn-primary" disabled={uploading}>
                  {uploading ? '登録中...' : '登録する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
