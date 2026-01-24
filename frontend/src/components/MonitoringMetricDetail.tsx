import { useState, useEffect, useCallback } from 'react';
import { GetMSMetricsStorageDetail, GetMSMetricsAccessKeys, QueryMSPrometheusLabels } from '../../wailsjs/go/main/App';
import { sakura } from '../../wailsjs/go/models';
import { MetricGraph } from './MetricGraph';

interface MonitoringMetricDetailProps {
  profile: string;
  storageId: string;
}

export function MonitoringMetricDetail({ profile, storageId }: MonitoringMetricDetailProps) {
  const [detail, setDetail] = useState<sakura.MSMetricsStorageDetail | null>(null);
  const [accessKeys, setAccessKeys] = useState<sakura.MSMetricsAccessKey[]>([]);
  const [metricNames, setMetricNames] = useState<sakura.PrometheusLabel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);

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

      // Load metric names from Prometheus
      try {
        const labels = await QueryMSPrometheusLabels(profile, storageId);
        setMetricNames(labels || []);
      } catch (err) {
        console.error('[MonitoringMetricDetail] Failed to load metric names:', err);
        setError('メトリクス名の取得に失敗しました');
      }
    } catch (err) {
      console.error('[MonitoringMetricDetail] loadData error:', err);
      setError(`データの読み込みに失敗しました: ${err}`);
    } finally {
      setLoading(false);
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
          onClick={() => loadData()}
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

      <div>
        <h3>利用可能なメトリクス ({metricNames.length})</h3>
        {error && <div className="error-message" style={{ marginBottom: '1rem' }}>{error}</div>}
        {loading ? (
          <div className="loading">読み込み中...</div>
        ) : metricNames.length === 0 ? (
          <div className="empty-state">メトリクスが見つかりません</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>メトリクス名</th>
                <th style={{ width: '150px' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {metricNames.map((metric, idx) => (
                <tr key={idx}>
                  <td><code>{metric.name}</code></td>
                  <td>
                    <button
                      className="btn btn-secondary btn-small"
                      onClick={() => setSelectedMetric(metric.name)}
                    >
                      グラフ表示
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selectedMetric && (
        <MetricGraph
          profile={profile}
          storageId={storageId}
          metricName={selectedMetric}
          onClose={() => setSelectedMetric(null)}
        />
      )}
    </>
  );
}
