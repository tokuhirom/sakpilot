import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GetMSLogs, GetMSMetrics, GetMSTraces,
  CreateMSLogsStorage, CreateMSMetricsStorage, CreateMSTracesStorage,
  DeleteMSLogsStorage, DeleteMSMetricsStorage, DeleteMSTracesStorage,
} from '../../wailsjs/go/main/App';
import { sakura } from '../../wailsjs/go/models';
import { useGlobalReload } from '../hooks/useGlobalReload';
import { BrowserOpenURL } from '../../wailsjs/runtime';

interface MonitoringProps {
  profile: string;
}

type SubPage = 'logs' | 'metrics' | 'traces';
type StorageItem = sakura.MSLogInfo | sakura.MSMetricInfo | sakura.MSTraceInfo;

const STORAGE_LABEL: Record<SubPage, string> = {
  logs: 'ログ',
  metrics: 'メトリクス',
  traces: 'トレース',
};

export function Monitoring({ profile }: MonitoringProps) {
  const navigate = useNavigate();
  const [subPage, setSubPage] = useState<SubPage>('logs');
  const [logs, setLogs] = useState<sakura.MSLogInfo[]>([]);
  const [metrics, setMetrics] = useState<sakura.MSMetricInfo[]>([]);
  const [traces, setTraces] = useState<sakura.MSTraceInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<StorageItem | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      if (subPage === 'logs') {
        const list = await GetMSLogs(profile);
        setLogs(list || []);
      } else if (subPage === 'metrics') {
        const list = await GetMSMetrics(profile);
        setMetrics(list || []);
      } else if (subPage === 'traces') {
        const list = await GetMSTraces(profile);
        setTraces(list || []);
      }
    } catch (err) {
      console.error(`[Monitoring] loadData error (${subPage}):`, err);
    } finally {
      setLoading(false);
    }
  }, [profile, subPage]);

  useGlobalReload(loadData);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDeleteClick = (e: React.MouseEvent, item: StorageItem) => {
    e.stopPropagation();
    setConfirmDelete(item);
  };

  const handleDeleteCancel = () => {
    setConfirmDelete(null);
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return;
    const item = confirmDelete;
    setConfirmDelete(null);
    setDeleting(item.id);
    try {
      if (subPage === 'logs') {
        await DeleteMSLogsStorage(profile, item.id);
      } else if (subPage === 'metrics') {
        await DeleteMSMetricsStorage(profile, item.id);
      } else {
        await DeleteMSTracesStorage(profile, item.id);
      }
      await loadData();
    } catch (e) {
      alert(`削除に失敗しました: ${e}`);
    } finally {
      setDeleting(null);
    }
  };

  const handleCreateOpen = () => {
    setNewName('');
    setNewDescription('');
    setCreateError(null);
    setShowCreate(true);
  };

  const handleCreateCancel = () => {
    setShowCreate(false);
  };

  const handleCreateSubmit = async () => {
    setCreating(true);
    setCreateError(null);
    try {
      if (subPage === 'logs') {
        await CreateMSLogsStorage(profile, newName, newDescription);
      } else if (subPage === 'metrics') {
        await CreateMSMetricsStorage(profile, newName, newDescription);
      } else {
        await CreateMSTracesStorage(profile, newName, newDescription);
      }
      setShowCreate(false);
      await loadData();
    } catch (e) {
      setCreateError(String(e));
    } finally {
      setCreating(false);
    }
  };

  const handleOpenBrowser = (id: string) => {
    let url = '';
    if (subPage === 'logs') {
      url = `https://secure.sakura.ad.jp/monitoring/ui/logs/explorer?storage=${id}`;
    } else if (subPage === 'metrics') {
      url = `https://secure.sakura.ad.jp/monitoring/ui/metrics/${id}`;
    } else if (subPage === 'traces') {
      url = `https://secure.sakura.ad.jp/monitoring/ui/traces/explorer?storage=${id}`;
    }

    if (url) {
      BrowserOpenURL(url);
    }
  };

  const renderContent = () => {
    if (loading) return <div className="loading">読み込み中...</div>;

    const items: StorageItem[] =
                  subPage === 'logs' ? logs :
                  subPage === 'metrics' ? metrics : traces;

    if (items.length === 0) {
      return <div className="empty-state">データがありません</div>;
    }

    return (
      <table className="table">
        <thead>
          <tr>
            <th>ID</th>
            <th>名前 / ルーティング</th>
            <th>説明</th>
            <th style={{ width: '100px' }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td style={{ verticalAlign: 'top' }}>{item.id}</td>
              <td style={{ verticalAlign: 'top' }}>
                <div style={{ fontWeight: 'bold' }}>{item.name}</div>
                {item.routings && item.routings.length > 0 && (
                  <div style={{ marginTop: '0.5rem', paddingLeft: '0.5rem', borderLeft: '2px solid #00adb5' }}>
                    <div style={{ fontSize: '0.7rem', color: '#888', marginBottom: '0.25rem' }}>ルーティング:</div>
                    {item.routings.map(r => (
                      <div key={r.id} style={{ fontSize: '0.75rem', color: '#aaa', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>• {r.name}</span>
                        <span style={{ fontSize: '0.65rem', color: '#666' }}>({r.id})</span>
                      </div>
                    ))}
                  </div>
                )}
              </td>
              <td style={{ verticalAlign: 'top' }}>{item.description || '-'}</td>
              <td style={{ verticalAlign: 'top' }}>
                <div style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column' }}>
                  {subPage === 'metrics' && (
                    <button
                      className="btn btn-primary"
                      style={{ fontSize: '0.7rem', padding: '2px 8px' }}
                      onClick={() => navigate(`/${profile}/monitoring/metrics/${item.id}`)}
                    >
                      詳細 / グラフ
                    </button>
                  )}
                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: '0.7rem', padding: '2px 8px' }}
                    onClick={() => handleOpenBrowser(item.id)}
                  >
                    ブラウザで表示
                  </button>
                  <button
                    className="btn btn-danger"
                    style={{ fontSize: '0.7rem', padding: '2px 8px' }}
                    onClick={(e) => handleDeleteClick(e, item)}
                    disabled={deleting === item.id}
                  >
                    {deleting === item.id ? '削除中...' : '削除'}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <>
      <div className="header">
        <h2>モニタリングスイート</h2>
        <button className="btn btn-primary btn-small" onClick={handleCreateOpen}>+ ストレージ作成</button>
      </div>

      <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem' }}>
        <button
          className={`btn ${subPage === 'logs' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setSubPage('logs')}
        >
          ログ
        </button>
        <button
          className={`btn ${subPage === 'metrics' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setSubPage('metrics')}
        >
          メトリクス
        </button>
        <button
          className={`btn ${subPage === 'traces' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setSubPage('traces')}
        >
          トレース
        </button>
      </div>

      {renderContent()}

      {confirmDelete && (
        <div className="confirm-overlay" onClick={handleDeleteCancel}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <p>{STORAGE_LABEL[subPage]}ストレージ「{confirmDelete.name}」を削除しますか？</p>
            <p className="confirm-warning">この操作は取り消せません。保存されているデータもすべて削除されます。</p>
            <div className="confirm-actions">
              <button className="btn btn-secondary" onClick={handleDeleteCancel}>キャンセル</button>
              <button className="btn btn-danger" onClick={handleDeleteConfirm}>削除する</button>
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="modal-overlay" onClick={handleCreateCancel} style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
            backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
            padding: '20px', minWidth: '320px', maxWidth: '420px',
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>{STORAGE_LABEL[subPage]}ストレージ作成</h3>
            <div className="form-group">
              <label htmlFor="ms-storage-create-name">名前</label>
              <input
                id="ms-storage-create-name"
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="form-group">
              <label htmlFor="ms-storage-create-description">説明</label>
              <input
                id="ms-storage-create-description"
                type="text"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="任意"
              />
            </div>
            {createError && (
              <div style={{ marginBottom: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>
                エラー: {createError}
              </div>
            )}
            <div className="confirm-actions">
              <button className="btn btn-secondary" onClick={handleCreateCancel}>キャンセル</button>
              <button
                className="btn btn-primary"
                onClick={handleCreateSubmit}
                disabled={creating || !newName}
              >
                {creating ? '作成中...' : '作成する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
