import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GetMSMetricsStorageDetail, GetMSMetricsAccessKeys,
  QueryMSPrometheusPublishers, QueryMSPrometheusMetricsByPublisher, QueryMSPrometheusMetricsWithoutPublisher,
  UpdateMSMetricsStorage, DeleteMSMetricsStorage,
  CreateMSMetricsAccessKey, DeleteMSMetricsAccessKey,
} from '../../wailsjs/go/main/App';
import { sakura } from '../../wailsjs/go/models';
import { useGlobalReload } from '../hooks/useGlobalReload';
import { MetricGraph } from './MetricGraph';

const CUSTOM_METRICS_KEY = '__custom__';

interface MetricInfo {
  name: string;
  variant: string;
}

interface MonitoringMetricDetailProps {
  profile: string;
  storageId: string;
}

export function MonitoringMetricDetail({ profile, storageId }: MonitoringMetricDetailProps) {
  const navigate = useNavigate();
  const [detail, setDetail] = useState<sakura.MSMetricsStorageDetail | null>(null);
  const [accessKeys, setAccessKeys] = useState<sakura.MSMetricsAccessKey[]>([]);
  const [publishers, setPublishers] = useState<string[]>([]);
  const [selectedPublisher, setSelectedPublisher] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<MetricInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingBasic, setEditingBasic] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [descriptionInput, setDescriptionInput] = useState('');
  const [savingBasic, setSavingBasic] = useState(false);
  const [basicError, setBasicError] = useState<string | null>(null);

  const [confirmDeleteStorage, setConfirmDeleteStorage] = useState(false);
  const [deletingStorage, setDeletingStorage] = useState(false);

  const [showCreateKey, setShowCreateKey] = useState(false);
  const [newKeyDescription, setNewKeyDescription] = useState('');
  const [creatingKey, setCreatingKey] = useState(false);
  const [createKeyError, setCreateKeyError] = useState<string | null>(null);
  const [newAccessKey, setNewAccessKey] = useState<sakura.MSMetricsAccessKeyCreated | null>(null);

  const [confirmDeleteKey, setConfirmDeleteKey] = useState<sakura.MSMetricsAccessKey | null>(null);
  const [deletingKeyUid, setDeletingKeyUid] = useState<string | null>(null);

  // Group metrics by variant
  const groupedMetrics = useMemo(() => {
    const groups: { [variant: string]: MetricInfo[] } = {};
    for (const metric of metrics) {
      const variant = metric.variant || '(その他)';
      if (!groups[variant]) {
        groups[variant] = [];
      }
      groups[variant].push(metric);
    }
    // Sort variants alphabetically, but put empty variant last
    const sortedVariants = Object.keys(groups).sort((a, b) => {
      if (a === '(その他)') return 1;
      if (b === '(その他)') return -1;
      return a.localeCompare(b);
    });
    return sortedVariants.map(variant => ({
      variant,
      metrics: groups[variant],
    }));
  }, [metrics]);

  const loadData = useCallback(async () => {
    if (!profile || !storageId) return;

    setLoading(true);
    setError(null);

    try {
      // Load storage detail
      const storageDetail = await GetMSMetricsStorageDetail(profile, storageId);
      setDetail(storageDetail);

      // Load access keys
      const keys = await GetMSMetricsAccessKeys(profile, storageId);
      setAccessKeys(keys || []);

      // Load publishers from Prometheus (only if access keys exist)
      if (keys && keys.length > 0) {
        try {
          const pubs = await QueryMSPrometheusPublishers(profile, storageId);
          setPublishers(pubs || []);
        } catch (err) {
          console.error('[MonitoringMetricDetail] Failed to load publishers:', err);
          setError('サービス一覧の取得に失敗しました');
        }
      } else {
        setPublishers([]);
      }
    } catch (err) {
      console.error('[MonitoringMetricDetail] loadData error:', err);
      setError(`データの読み込みに失敗しました: ${err}`);
    } finally {
      setLoading(false);
    }
  }, [profile, storageId]);

  const loadMetricsForPublisher = useCallback(async (publisher: string) => {
    if (!profile || !storageId) return;

    setLoadingMetrics(true);
    setSelectedPublisher(publisher);
    setMetrics([]);

    try {
      let metricInfos: MetricInfo[];
      if (publisher === CUSTOM_METRICS_KEY) {
        // Load metrics without sakuracloud_publisher label (returns string[])
        const metricNames = await QueryMSPrometheusMetricsWithoutPublisher(profile, storageId);
        metricInfos = (metricNames || []).map(name => ({ name, variant: '' }));
        // Sort alphabetically
        metricInfos.sort((a, b) => a.name.localeCompare(b.name));
      } else {
        // Load metrics with publisher (returns MetricInfo[])
        const result = await QueryMSPrometheusMetricsByPublisher(profile, storageId, publisher);
        metricInfos = (result || []).map(m => ({ name: m.name, variant: m.variant }));
      }
      setMetrics(metricInfos);
    } catch (err) {
      console.error('[MonitoringMetricDetail] Failed to load metrics:', err);
      setError('メトリクス一覧の取得に失敗しました');
    } finally {
      setLoadingMetrics(false);
    }
  }, [profile, storageId]);

  useGlobalReload(loadData);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleBasicEditStart = () => {
    if (!detail) return;
    setNameInput(detail.name);
    setDescriptionInput(detail.description || '');
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
      const updated = await UpdateMSMetricsStorage(profile, storageId, nameInput, descriptionInput);
      setDetail({ ...detail!, name: updated.name, description: updated.description });
      setEditingBasic(false);
    } catch (e) {
      setBasicError(String(e));
    } finally {
      setSavingBasic(false);
    }
  };

  const handleDeleteStorageConfirm = async () => {
    setConfirmDeleteStorage(false);
    setDeletingStorage(true);
    try {
      await DeleteMSMetricsStorage(profile, storageId);
      navigate(`/${profile}/monitoring`);
    } catch (e) {
      alert(`削除に失敗しました: ${e}`);
      setDeletingStorage(false);
    }
  };

  const handleCreateKeyOpen = () => {
    setNewKeyDescription('');
    setCreateKeyError(null);
    setShowCreateKey(true);
  };

  const handleCreateKeyCancel = () => {
    setShowCreateKey(false);
  };

  const handleCreateKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingKey(true);
    setCreateKeyError(null);
    try {
      const created = await CreateMSMetricsAccessKey(profile, storageId, newKeyDescription);
      setShowCreateKey(false);
      setNewAccessKey(created);
      await loadData();
    } catch (e) {
      setCreateKeyError(String(e));
    } finally {
      setCreatingKey(false);
    }
  };

  const handleDeleteKeyClick = (key: sakura.MSMetricsAccessKey) => {
    setConfirmDeleteKey(key);
  };

  const handleDeleteKeyCancel = () => {
    setConfirmDeleteKey(null);
  };

  const handleDeleteKeyConfirm = async () => {
    if (!confirmDeleteKey) return;
    const key = confirmDeleteKey;
    setConfirmDeleteKey(null);
    setDeletingKeyUid(key.uid);
    try {
      await DeleteMSMetricsAccessKey(profile, storageId, key.uid);
      await loadData();
    } catch (e) {
      alert(`削除に失敗しました: ${e}`);
    } finally {
      setDeletingKeyUid(null);
    }
  };

  if (loading && !detail) {
    return <div className="loading">読み込み中...</div>;
  }

  if (error && !detail) {
    return <div className="error-message">{error}</div>;
  }

  if (!detail) {
    return <div className="empty-state">ストレージが見つかりません</div>;
  }

  return (
    <>
      <div className="header">
        <h2>メトリクスストレージ: {detail.name}</h2>
        <button
          className="btn btn-danger btn-small"
          onClick={() => setConfirmDeleteStorage(true)}
          disabled={deletingStorage}
        >
          {deletingStorage ? '削除中...' : '削除'}
        </button>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>ストレージ情報</h3>
          {!editingBasic && (
            <button className="btn btn-secondary btn-small" onClick={handleBasicEditStart}>編集</button>
          )}
        </div>
        {editingBasic ? (
          <form onSubmit={handleBasicSave}>
            <div className="form-group">
              <label htmlFor="ms-storage-edit-name">名前<span className="required-mark">*</span></label>
              <input
                id="ms-storage-edit-name"
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                autoFocus
                required
                maxLength={64}
              />
            </div>
            <div className="form-group">
              <label htmlFor="ms-storage-edit-description">説明</label>
              <input
                id="ms-storage-edit-description"
                type="text"
                value={descriptionInput}
                onChange={(e) => setDescriptionInput(e.target.value)}
                placeholder="任意"
                maxLength={512}
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
          <table className="table">
            <tbody>
              <tr>
                <td style={{ fontWeight: 'bold', width: '200px' }}>ID</td>
                <td>{detail.id}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 'bold' }}>名前</td>
                <td>{detail.name}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 'bold' }}>説明</td>
                <td>{detail.description || '-'}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 'bold' }}>エンドポイント</td>
                <td><code>{detail.endpoint}</code></td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>アクセスキー</h3>
          <button className="btn btn-primary btn-small" onClick={handleCreateKeyOpen}>+ アクセスキー作成</button>
        </div>
        {accessKeys.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>UID</th>
                <th>説明</th>
                <th>トークン（プレフィックス）</th>
                <th style={{ width: '100px' }}></th>
              </tr>
            </thead>
            <tbody>
              {accessKeys.map((key) => (
                <tr key={key.uid}>
                  <td><code>{key.uid}</code></td>
                  <td>{key.description || '-'}</td>
                  <td><code>{key.token.substring(0, 20)}...</code></td>
                  <td>
                    <button
                      className="btn btn-danger btn-small"
                      onClick={() => handleDeleteKeyClick(key)}
                      disabled={deletingKeyUid === key.uid}
                    >
                      {deletingKeyUid === key.uid ? '削除中...' : '削除'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h3>メトリクス表示</h3>
        {error && <div className="error-message" style={{ marginBottom: '1rem' }}>{error}</div>}
        {loading ? (
          <div className="loading">読み込み中...</div>
        ) : accessKeys.length === 0 ? (
          <div className="empty-state">メトリクスを取得するには、このメトリクスストレージにアクセスキーを作成してください</div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {publishers.map((publisher) => (
              <button
                key={publisher}
                className={`btn ${selectedPublisher === publisher ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => loadMetricsForPublisher(publisher)}
                disabled={loadingMetrics}
              >
                {publisher}
              </button>
            ))}
            <button
              className={`btn ${selectedPublisher === CUSTOM_METRICS_KEY ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => loadMetricsForPublisher(CUSTOM_METRICS_KEY)}
              disabled={loadingMetrics}
            >
              カスタムメトリクス
            </button>
          </div>
        )}
      </div>

      {selectedPublisher && (
        <div>
          <h3>{selectedPublisher === CUSTOM_METRICS_KEY ? 'カスタムメトリクス' : selectedPublisher} ({metrics.length})</h3>
          {loadingMetrics ? (
            <div className="loading">読み込み中...</div>
          ) : metrics.length === 0 ? (
            <div className="empty-state">メトリクスが見つかりません</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {groupedMetrics.map(({ variant, metrics: variantMetrics }) => (
                <div key={variant}>
                  <h4 style={{
                    marginBottom: '1rem',
                    paddingBottom: '0.5rem',
                    borderBottom: '1px solid #3a3a3a',
                    color: '#aaa'
                  }}>
                    {variant} ({variantMetrics.length})
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {variantMetrics.map((metric) => (
                      <MetricGraph
                        key={metric.name}
                        profile={profile}
                        storageId={storageId}
                        metricName={metric.name}
                        onClose={() => {}}
                        embedded={true}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {confirmDeleteStorage && (
        <div className="confirm-overlay" onClick={() => setConfirmDeleteStorage(false)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <p>メトリクスストレージ「{detail.name}」を削除しますか？</p>
            <p className="confirm-warning">この操作は取り消せません。保存されているメトリクスデータもすべて削除されます。</p>
            <div className="confirm-actions">
              <button className="btn btn-secondary" onClick={() => setConfirmDeleteStorage(false)}>キャンセル</button>
              <button className="btn btn-danger" onClick={handleDeleteStorageConfirm}>削除する</button>
            </div>
          </div>
        </div>
      )}

      {showCreateKey && (
        <div className="modal-overlay" onClick={handleCreateKeyCancel} style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
            backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
            padding: '20px', minWidth: '320px', maxWidth: '420px',
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>アクセスキー作成</h3>
            <form onSubmit={handleCreateKeySubmit}>
              <div className="form-group">
                <label htmlFor="ms-key-create-description">説明</label>
                <input
                  id="ms-key-create-description"
                  type="text"
                  value={newKeyDescription}
                  onChange={(e) => setNewKeyDescription(e.target.value)}
                  placeholder="任意"
                  maxLength={512}
                  autoFocus
                />
              </div>
              {createKeyError && (
                <div style={{ marginBottom: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>
                  エラー: {createKeyError}
                </div>
              )}
              <div className="confirm-actions">
                <button type="button" className="btn btn-secondary" onClick={handleCreateKeyCancel}>キャンセル</button>
                <button type="submit" className="btn btn-primary" disabled={creatingKey}>
                  {creatingKey ? '作成中...' : '作成する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {newAccessKey && (
        <div className="modal-overlay" onClick={() => setNewAccessKey(null)} style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
            backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
            padding: '20px', minWidth: '320px', maxWidth: '480px',
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>アクセスキーを作成しました</h3>
            <p style={{ color: '#ff6b6b', fontSize: '0.85rem' }}>
              シークレットはこの画面を閉じると二度と表示されません。必要であれば今すぐ控えてください。
            </p>
            <div className="form-group">
              <label>UID</label>
              <input type="text" readOnly value={newAccessKey.uid} />
            </div>
            <div className="form-group">
              <label>トークン</label>
              <input type="text" readOnly value={newAccessKey.token} />
            </div>
            <div className="form-group">
              <label>シークレット</label>
              <input type="text" readOnly value={newAccessKey.secret} />
            </div>
            <div className="confirm-actions">
              <button className="btn btn-primary" onClick={() => setNewAccessKey(null)}>閉じる</button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteKey && (
        <div className="confirm-overlay" onClick={handleDeleteKeyCancel}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <p>アクセスキー「{confirmDeleteKey.uid}」を削除しますか？</p>
            <p className="confirm-warning">この操作は取り消せません。このキーを使用しているクライアントは認証できなくなります。</p>
            <div className="confirm-actions">
              <button className="btn btn-secondary" onClick={handleDeleteKeyCancel}>キャンセル</button>
              <button className="btn btn-danger" onClick={handleDeleteKeyConfirm}>削除する</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
