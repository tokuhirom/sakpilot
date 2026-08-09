import { useState, useEffect, useCallback } from 'react';
import { GetDiskDetail, UpdateDisk, ConnectDiskToServer, DisconnectDiskFromServer, GetServers } from '../../wailsjs/go/main/App';
import { sakura } from '../../wailsjs/go/models';
import { useGlobalReload } from '../hooks/useGlobalReload';

interface DiskDetailProps {
  profile: string;
  zone: string;
  diskId: string;
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

export function DiskDetail({ profile, zone, diskId }: DiskDetailProps) {
  const [diskInfo, setDiskInfo] = useState<sakura.DiskInfo | null>(null);
  const [loading, setLoading] = useState(false);

  const [editingBasic, setEditingBasic] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [descriptionInput, setDescriptionInput] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [savingBasic, setSavingBasic] = useState(false);
  const [basicError, setBasicError] = useState<string | null>(null);

  const [servers, setServers] = useState<sakura.ServerInfo[]>([]);
  const [editingConnection, setEditingConnection] = useState(false);
  const [connectServerId, setConnectServerId] = useState('');
  const [savingConnection, setSavingConnection] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const loadDiskDetail = useCallback(async () => {
    if (!profile || !zone || !diskId) return;

    setLoading(true);
    try {
      const detail = await GetDiskDetail(profile, zone, diskId);
      setDiskInfo(detail);
    } catch (err) {
      console.error('[DiskDetail] loadDiskDetail error:', err);
    } finally {
      setLoading(false);
    }
  }, [profile, zone, diskId]);

  useGlobalReload(loadDiskDetail);

  useEffect(() => {
    loadDiskDetail();
  }, [loadDiskDetail]);

  const handleBasicEditStart = () => {
    if (!diskInfo) return;
    setNameInput(diskInfo.name);
    setDescriptionInput(diskInfo.description || '');
    setTagsInput((diskInfo.tags || []).join(', '));
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
      const tags = tagsInput.split(',').map(t => t.trim()).filter(t => t.length > 0);
      const updated = await UpdateDisk(profile, zone, diskId, nameInput, descriptionInput, tags);
      setDiskInfo(updated);
      setEditingBasic(false);
    } catch (e) {
      setBasicError(String(e));
    } finally {
      setSavingBasic(false);
    }
  };

  const handleConnectionEditStart = async () => {
    setConnectionError(null);
    setConnectServerId('');
    setEditingConnection(true);
    try {
      const list = await GetServers(profile, zone);
      setServers(list || []);
    } catch (err) {
      console.error('[DiskDetail] GetServers error:', err);
      setServers([]);
    }
  };

  const handleConnectionEditCancel = () => {
    setEditingConnection(false);
    setConnectionError(null);
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConnection(true);
    setConnectionError(null);
    try {
      await ConnectDiskToServer(profile, zone, diskId, connectServerId);
      await loadDiskDetail();
      setEditingConnection(false);
    } catch (e) {
      setConnectionError(String(e));
    } finally {
      setSavingConnection(false);
    }
  };

  const handleDisconnect = async () => {
    setSavingConnection(true);
    setConnectionError(null);
    try {
      await DisconnectDiskFromServer(profile, zone, diskId);
      await loadDiskDetail();
      setEditingConnection(false);
    } catch (e) {
      setConnectionError(String(e));
    } finally {
      setSavingConnection(false);
    }
  };

  if (loading) return <div className="loading">読み込み中...</div>;
  if (!diskInfo) return <div className="empty-state">ディスク情報が見つかりません</div>;

  return (
    <div className="disk-detail">
      <div className="header">
        <h2>ディスク詳細: {diskInfo.name}</h2>
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
              <label>タグ</label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="カンマ区切り(任意)"
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
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{diskInfo.id}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>説明</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{diskInfo.description || '-'}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>タグ</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>
                  {diskInfo.tags && diskInfo.tags.length > 0 ? diskInfo.tags.join(', ') : '-'}
                </td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>サイズ</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{diskInfo.sizeGb} GB</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>プラン</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{diskInfo.diskPlanName}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>接続方式</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{diskInfo.connection}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>作成日</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{formatDate(diskInfo.createdAt)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem', background: '#2a2a2a', borderRadius: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h4 style={{ color: '#00adb5', margin: 0 }}>接続先サーバー</h4>
          {!editingConnection && (
            <button className="btn btn-secondary btn-small" onClick={handleConnectionEditStart}>変更</button>
          )}
        </div>
        {editingConnection ? (
          <form onSubmit={handleConnect}>
            <div className="form-group">
              <label>接続先サーバー<span className="required-mark">*</span></label>
              <select
                value={connectServerId}
                onChange={(e) => setConnectServerId(e.target.value)}
                required
              >
                <option value="">選択してください</option>
                {servers.map((srv) => (
                  <option key={srv.id} value={srv.id}>{srv.name}</option>
                ))}
              </select>
            </div>
            {connectionError && (
              <div style={{ marginBottom: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>
                エラー: {connectionError}
              </div>
            )}
            <div className="confirm-actions">
              <button type="button" className="btn btn-secondary" onClick={handleConnectionEditCancel} disabled={savingConnection}>キャンセル</button>
              {diskInfo.serverId && (
                <button type="button" className="btn btn-danger" onClick={handleDisconnect} disabled={savingConnection}>
                  {savingConnection ? '処理中...' : '接続を解除する'}
                </button>
              )}
              <button type="submit" className="btn btn-primary" disabled={savingConnection}>
                {savingConnection ? '処理中...' : '接続する'}
              </button>
            </div>
          </form>
        ) : (
          <p style={{ margin: 0 }}>{diskInfo.serverName || '(未接続)'}</p>
        )}
      </div>
    </div>
  );
}
