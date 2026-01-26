import { useState, useEffect, useCallback, useMemo } from 'react';
import { GetMSMetricsStorageDetail, GetMSMetricsAccessKeys, QueryMSPrometheusPublishers, QueryMSPrometheusMetricsByPublisher, QueryMSPrometheusMetricsWithoutPublisher } from '../../wailsjs/go/main/App';
import { sakura } from '../../wailsjs/go/models';
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
  const [detail, setDetail] = useState<sakura.MSMetricsStorageDetail | null>(null);
  const [accessKeys, setAccessKeys] = useState<sakura.MSMetricsAccessKey[]>([]);
  const [publishers, setPublishers] = useState<string[]>([]);
  const [selectedPublisher, setSelectedPublisher] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<MetricInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    loadData();
  }, [loadData]);

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
          className="btn-reload"
          onClick={() => {
            setSelectedPublisher(null);
            setMetrics([]);
            loadData();
          }}
          disabled={loading}
          title="リロード"
        >
          ↻
        </button>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h3>ストレージ情報</h3>
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
      </div>

      {accessKeys.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h3>アクセスキー</h3>
          <table className="table">
            <thead>
              <tr>
                <th>UID</th>
                <th>説明</th>
                <th>トークン（プレフィックス）</th>
              </tr>
            </thead>
            <tbody>
              {accessKeys.map((key) => (
                <tr key={key.uid}>
                  <td><code>{key.uid}</code></td>
                  <td>{key.description || '-'}</td>
                  <td><code>{key.token.substring(0, 20)}...</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
    </>
  );
}
