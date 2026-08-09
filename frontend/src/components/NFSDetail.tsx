import { useState, useEffect, useCallback } from 'react';
import { GetNFSDetail, UpdateNFS } from '../../wailsjs/go/main/App';
import { sakura } from '../../wailsjs/go/models';
import { useGlobalReload } from '../hooks/useGlobalReload';

interface NFSDetailProps {
  profile: string;
  zone: string;
  nfsId: string;
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

export function NFSDetail({ profile, zone, nfsId }: NFSDetailProps) {
  const [nfs, setNfs] = useState<sakura.NFSInfo | null>(null);
  const [loading, setLoading] = useState(false);

  const [editingBasic, setEditingBasic] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [descriptionInput, setDescriptionInput] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [savingBasic, setSavingBasic] = useState(false);
  const [basicError, setBasicError] = useState<string | null>(null);

  const loadNfs = useCallback(async () => {
    if (!profile || !zone || !nfsId) return;

    setLoading(true);
    try {
      const detail = await GetNFSDetail(profile, zone, nfsId);
      setNfs(detail);
    } catch (err) {
      console.error('[NFSDetail] loadNfs error:', err);
    } finally {
      setLoading(false);
    }
  }, [profile, zone, nfsId]);

  useGlobalReload(loadNfs);

  useEffect(() => {
    loadNfs();
  }, [loadNfs]);

  const handleBasicEditStart = () => {
    if (!nfs) return;
    setNameInput(nfs.name);
    setDescriptionInput(nfs.description || '');
    setTagsInput((nfs.tags || []).join(', '));
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
      const updated = await UpdateNFS(profile, zone, nfsId, nameInput, descriptionInput, tags);
      setNfs(updated);
      setEditingBasic(false);
    } catch (e) {
      setBasicError(String(e));
    } finally {
      setSavingBasic(false);
    }
  };

  if (loading) return <div className="loading">読み込み中...</div>;
  if (!nfs) return <div className="empty-state">NFS情報が見つかりません</div>;

  return (
    <div className="nfs-detail">
      <div className="header">
        <h2>NFS詳細: {nfs.name}</h2>
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
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{nfs.id}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>説明</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{nfs.description || '-'}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>ステータス</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>
                  <span className={`status ${nfs.status.toLowerCase() === 'up' ? 'up' : 'down'}`}>{nfs.status}</span>
                </td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>作成日</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{formatDate(nfs.createdAt)}</td>
              </tr>
              {nfs.tags && nfs.tags.length > 0 && (
                <tr>
                  <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>タグ</td>
                  <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>
                    <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                      {nfs.tags.map(tag => (
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
        <h4 style={{ color: '#00adb5', marginTop: 0, marginBottom: '1rem' }}>ネットワーク設定</h4>
        <table style={{ borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>IPアドレス</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{nfs.ipAddresses?.join(', ') || '-'}</td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>ネットワークマスク</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{nfs.networkMaskLen > 0 ? `/${nfs.networkMaskLen}` : '-'}</td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>デフォルトルート</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{nfs.defaultRoute || '-'}</td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>接続スイッチ</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{nfs.switchName || '-'}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
