import { useState, useEffect, useCallback } from 'react';
import { GetEnhancedDB, UpdateEnhancedDB, SetEnhancedDBPassword } from '../../wailsjs/go/main/App';
import { sakura } from '../../wailsjs/go/models';
import { useGlobalReload } from '../hooks/useGlobalReload';

interface EnhancedDBDetailProps {
  profile: string;
  enhancedDBId: string;
}

const getRegionName = (region: string) => {
  switch (region) {
    case 'is1': return '石狩';
    case 'tk1': return '東京';
    default: return region;
  }
};

const getDatabaseTypeName = (dbType: string) => {
  switch (dbType) {
    case 'tidb': return 'TiDB';
    case 'mariadb': return 'MariaDB';
    default: return dbType;
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

export function EnhancedDBDetail({ profile, enhancedDBId }: EnhancedDBDetailProps) {
  const [db, setDb] = useState<sakura.EnhancedDBInfo | null>(null);
  const [loading, setLoading] = useState(false);

  const [editingBasic, setEditingBasic] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [descriptionInput, setDescriptionInput] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [savingBasic, setSavingBasic] = useState(false);
  const [basicError, setBasicError] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [confirmSetPassword, setConfirmSetPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const loadDb = useCallback(async () => {
    if (!profile || !enhancedDBId) return;

    setLoading(true);
    try {
      const detail = await GetEnhancedDB(profile, enhancedDBId);
      setDb(detail);
    } catch (err) {
      console.error('[EnhancedDBDetail] loadDb error:', err);
    } finally {
      setLoading(false);
    }
  }, [profile, enhancedDBId]);

  useGlobalReload(loadDb);

  useEffect(() => {
    loadDb();
  }, [loadDb]);

  const handleBasicEditStart = () => {
    if (!db) return;
    setNameInput(db.name);
    setDescriptionInput(db.description || '');
    setTagsInput((db.tags || []).join(', '));
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
      const tags = tagsInput.split(',').map(t => t.trim()).filter(t => t);
      const updated = await UpdateEnhancedDB(profile, enhancedDBId, nameInput, descriptionInput, tags);
      setDb(updated);
      setEditingBasic(false);
    } catch (e) {
      setBasicError(String(e));
    } finally {
      setSavingBasic(false);
    }
  };

  const handleSetPasswordConfirm = async () => {
    setConfirmSetPassword(false);
    setSavingPassword(true);
    setPasswordError(null);
    try {
      await SetEnhancedDBPassword(profile, enhancedDBId, newPassword);
      setNewPassword('');
    } catch (e) {
      setPasswordError(String(e));
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) return <div className="loading">読み込み中...</div>;
  if (!db) return <div className="empty-state">エンハンスドDB情報が見つかりません</div>;

  return (
    <div className="enhanced-db-detail">
      <div className="header">
        <h2>エンハンスドDB詳細: {db.name}</h2>
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
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
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
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{db.id}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>説明</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{db.description || '-'}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>DB種別</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{getDatabaseTypeName(db.databaseType)}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>DB名</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{db.databaseName}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>リージョン</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{getRegionName(db.region)}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>接続先</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left', fontFamily: 'monospace' }}>{db.hostName}:{db.port}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>作成日</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{formatDate(db.createdAt)}</td>
              </tr>
              {db.tags && db.tags.length > 0 && (
                <tr>
                  <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>タグ</td>
                  <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>
                    <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                      {db.tags.map(tag => (
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
        <h4 style={{ color: '#00adb5', marginTop: 0, marginBottom: '1rem' }}>パスワード再設定</h4>
        <div className="form-group">
          <label>新しいパスワード</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="管理ユーザーの新しいパスワード"
          />
        </div>
        {passwordError && (
          <div style={{ marginBottom: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>
            エラー: {passwordError}
          </div>
        )}
        <button
          className="btn btn-secondary btn-small"
          onClick={() => setConfirmSetPassword(true)}
          disabled={savingPassword || !newPassword}
        >
          {savingPassword ? '設定中...' : 'パスワードを再設定'}
        </button>
      </div>

      {confirmSetPassword && (
        <div className="confirm-overlay" onClick={() => setConfirmSetPassword(false)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <p>エンハンスドDB「{db.name}」のパスワードを再設定しますか？</p>
            <div className="confirm-actions">
              <button className="btn btn-secondary" onClick={() => setConfirmSetPassword(false)}>キャンセル</button>
              <button className="btn btn-primary" onClick={handleSetPasswordConfirm}>実行する</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
