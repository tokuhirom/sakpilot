import { useState, useEffect, useCallback } from 'react';
import {
  GetSecretManagerVault,
  UpdateSecretManagerVault,
  GetSecretManagerSecrets,
  SetSecretManagerSecret,
  DeleteSecretManagerSecret,
  UnveilSecretManagerSecret,
} from '../../wailsjs/go/main/App';
import { secretmanager } from '../../wailsjs/go/models';
import { useGlobalReload } from '../hooks/useGlobalReload';

interface SecretManagerDetailProps {
  profile: string;
  vaultId: string;
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

export function SecretManagerDetail({ profile, vaultId }: SecretManagerDetailProps) {
  const [vault, setVault] = useState<secretmanager.VaultInfo | null>(null);
  const [loading, setLoading] = useState(false);

  const [editingBasic, setEditingBasic] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [descriptionInput, setDescriptionInput] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [savingBasic, setSavingBasic] = useState(false);
  const [basicError, setBasicError] = useState<string | null>(null);

  const [secrets, setSecrets] = useState<secretmanager.SecretInfo[]>([]);
  const [secretsLoading, setSecretsLoading] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [revealing, setRevealing] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<secretmanager.SecretInfo | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [showSetSecret, setShowSetSecret] = useState(false);
  const [secretName, setSecretName] = useState('');
  const [secretValue, setSecretValue] = useState('');
  const [savingSecret, setSavingSecret] = useState(false);
  const [secretError, setSecretError] = useState<string | null>(null);

  const loadVault = useCallback(async () => {
    if (!profile || !vaultId) return;

    setLoading(true);
    try {
      const detail = await GetSecretManagerVault(profile, vaultId);
      setVault(detail);
    } catch (err) {
      console.error('[SecretManagerDetail] loadVault error:', err);
    } finally {
      setLoading(false);
    }
  }, [profile, vaultId]);

  const loadSecrets = useCallback(async () => {
    if (!profile || !vaultId) return;

    setSecretsLoading(true);
    try {
      const list = await GetSecretManagerSecrets(profile, vaultId);
      setSecrets(list || []);
    } catch (err) {
      console.error('[SecretManagerDetail] loadSecrets error:', err);
      setSecrets([]);
    } finally {
      setSecretsLoading(false);
    }
  }, [profile, vaultId]);

  const loadAll = useCallback(async () => {
    await Promise.all([loadVault(), loadSecrets()]);
  }, [loadVault, loadSecrets]);

  useGlobalReload(loadAll);

  useEffect(() => {
    loadAll();
    setRevealed({});
  }, [loadAll]);

  const handleBasicEditStart = () => {
    if (!vault) return;
    setNameInput(vault.name);
    setDescriptionInput(vault.description || '');
    setTagsInput((vault.tags || []).join(', '));
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
      const tags = tagsInput.split(',').map(t => t.trim()).filter(t => t);
      const updated = await UpdateSecretManagerVault(profile, vaultId, nameInput, descriptionInput, tags);
      setVault(updated);
      setEditingBasic(false);
    } catch (e) {
      setBasicError(String(e));
    } finally {
      setSavingBasic(false);
    }
  };

  const handleRevealToggle = async (secret: secretmanager.SecretInfo) => {
    if (revealed[secret.name] !== undefined) {
      setRevealed(prev => {
        const next = { ...prev };
        delete next[secret.name];
        return next;
      });
      return;
    }
    setRevealing(secret.name);
    try {
      const result = await UnveilSecretManagerSecret(profile, vaultId, secret.name, 0);
      setRevealed(prev => ({ ...prev, [secret.name]: result.value }));
    } catch (e) {
      alert(`値の取得に失敗しました: ${e}`);
    } finally {
      setRevealing(null);
    }
  };

  const handleDeleteClick = (secret: secretmanager.SecretInfo) => {
    setConfirmDelete(secret);
  };

  const handleDeleteCancel = () => {
    setConfirmDelete(null);
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return;
    const secret = confirmDelete;
    setConfirmDelete(null);
    setDeleting(secret.name);
    try {
      await DeleteSecretManagerSecret(profile, vaultId, secret.name);
      setRevealed(prev => {
        const next = { ...prev };
        delete next[secret.name];
        return next;
      });
      await loadSecrets();
    } catch (e) {
      alert(`削除に失敗しました: ${e}`);
    } finally {
      setDeleting(null);
    }
  };

  const handleSetSecretOpen = () => {
    setSecretName('');
    setSecretValue('');
    setSecretError(null);
    setShowSetSecret(true);
  };

  const handleSetSecretCancel = () => {
    setShowSetSecret(false);
  };

  const handleSetSecretSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSecret(true);
    setSecretError(null);
    try {
      await SetSecretManagerSecret(profile, vaultId, secretName, secretValue);
      setShowSetSecret(false);
      await loadSecrets();
    } catch (e) {
      setSecretError(String(e));
    } finally {
      setSavingSecret(false);
    }
  };

  if (loading) return <div className="loading">読み込み中...</div>;
  if (!vault) return <div className="empty-state">Vault情報が見つかりません</div>;

  return (
    <div className="secretmanager-detail">
      <div className="header">
        <h2>Vault詳細: {vault.name}</h2>
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
                maxLength={512}
              />
            </div>
            <div className="form-group">
              <label>タグ</label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="任意(カンマ区切り、例: env:prod,team:sre)"
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
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{vault.id}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>説明</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{vault.description || '-'}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>KMSキー</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{vault.kmsKeyId}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>作成日</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{formatDate(vault.createdAt)}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>更新日</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{formatDate(vault.modifiedAt)}</td>
              </tr>
              {vault.tags && vault.tags.length > 0 && (
                <tr>
                  <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>タグ</td>
                  <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>
                    <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                      {vault.tags.map(tag => (
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
        )}
      </div>

      <div className="card" style={{ padding: '1rem', background: '#2a2a2a', borderRadius: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h4 style={{ color: '#00adb5', margin: 0 }}>シークレット</h4>
          <button className="btn btn-primary btn-small" onClick={handleSetSecretOpen}>+ シークレット追加</button>
        </div>

        {secretsLoading ? (
          <div className="loading">読み込み中...</div>
        ) : secrets.length === 0 ? (
          <div className="empty-state">シークレットがありません</div>
        ) : (
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>名前</th>
                <th style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>バージョン</th>
                <th style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>値</th>
                <th style={{ padding: '0.5rem 0', color: '#888', textAlign: 'left' }}></th>
              </tr>
            </thead>
            <tbody>
              {secrets.map(secret => (
                <tr key={secret.name}>
                  <td style={{ padding: '0.5rem 1rem 0.5rem 0', textAlign: 'left' }}>{secret.name}</td>
                  <td style={{ padding: '0.5rem 1rem 0.5rem 0', textAlign: 'left' }}>{secret.latestVersion}</td>
                  <td style={{ padding: '0.5rem 1rem 0.5rem 0', textAlign: 'left', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                    {revealed[secret.name] !== undefined ? revealed[secret.name] : '••••••••'}
                  </td>
                  <td style={{ padding: '0.5rem 0', textAlign: 'left', whiteSpace: 'nowrap' }}>
                    <button
                      className="btn btn-secondary btn-small"
                      onClick={() => handleRevealToggle(secret)}
                      disabled={revealing === secret.name}
                      style={{ marginRight: '0.5rem' }}
                    >
                      {revealing === secret.name ? '取得中...' : revealed[secret.name] !== undefined ? '隠す' : '値を表示'}
                    </button>
                    <button
                      className="btn btn-danger btn-small"
                      onClick={() => handleDeleteClick(secret)}
                      disabled={deleting === secret.name}
                    >
                      {deleting === secret.name ? '削除中...' : '削除'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {confirmDelete && (
        <div className="confirm-overlay" onClick={handleDeleteCancel}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <p>シークレット「{confirmDelete.name}」を削除しますか？</p>
            <p className="confirm-warning">この操作は取り消せません。全バージョンが削除されます。</p>
            <div className="confirm-actions">
              <button className="btn btn-secondary" onClick={handleDeleteCancel}>キャンセル</button>
              <button className="btn btn-danger" onClick={handleDeleteConfirm}>削除する</button>
            </div>
          </div>
        </div>
      )}

      {showSetSecret && (
        <div className="modal-overlay" onClick={handleSetSecretCancel} style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
            backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
            padding: '20px', minWidth: '320px', maxWidth: '420px',
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>シークレット追加</h3>
            <form onSubmit={handleSetSecretSubmit}>
              <div className="form-group">
                <label>名前<span className="required-mark">*</span></label>
                <input
                  type="text"
                  value={secretName}
                  onChange={(e) => setSecretName(e.target.value)}
                  placeholder="api-key"
                  autoFocus
                  required
                />
              </div>
              <div className="form-group">
                <label>値<span className="required-mark">*</span></label>
                <input
                  type="text"
                  value={secretValue}
                  onChange={(e) => setSecretValue(e.target.value)}
                  placeholder="シークレットの値"
                  required
                />
              </div>
              <div style={{ marginBottom: '1rem', fontSize: '0.75rem', color: '#888' }}>
                既存の名前を指定した場合、新しいバージョンとして追加されます。
              </div>
              {secretError && (
                <div style={{ marginBottom: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>
                  エラー: {secretError}
                </div>
              )}
              <div className="confirm-actions">
                <button type="button" className="btn btn-secondary" onClick={handleSetSecretCancel}>キャンセル</button>
                <button type="submit" className="btn btn-primary" disabled={savingSecret}>
                  {savingSecret ? '保存中...' : '保存する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
