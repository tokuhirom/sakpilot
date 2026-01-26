import { useEffect, useRef, useState } from 'react';
import { QueryMSPrometheusRange } from '../../wailsjs/go/main/App';
import { sakura } from '../../wailsjs/go/models';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';

interface MetricGraphProps {
  profile: string;
  storageId: string;
  metricName: string;
  onClose: () => void;
  embedded?: boolean;
}

export function MetricGraph({ profile, storageId, metricName, onClose, embedded = false }: MetricGraphProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<uPlot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<string>('1h'); // 1h, 6h, 24h, 7d

  const loadData = async () => {
    if (!profile || !storageId || !metricName) return;

    setLoading(true);
    setError(null);

    try {
      const now = Math.floor(Date.now() / 1000);
      let start = now;
      let step = '15s';

      // Calculate start time and step based on time range
      switch (timeRange) {
        case '1h':
          start = now - 3600;
          step = '15s';
          break;
        case '6h':
          start = now - 6 * 3600;
          step = '1m';
          break;
        case '24h':
          start = now - 24 * 3600;
          step = '5m';
          break;
        case '7d':
          start = now - 7 * 24 * 3600;
          step = '30m';
          break;
      }

      const response: sakura.PrometheusQueryRangeResponse = await QueryMSPrometheusRange(
        profile,
        storageId,
        metricName,
        start,
        now,
        step
      );

      if (response.data.result.length === 0) {
        setError('データがありません');
        return;
      }

      // Convert Prometheus data to uPlot format
      const timestamps: number[] = [];
      const seriesData: (number | null)[][] = [];

      // Initialize series arrays
      for (let i = 0; i < response.data.result.length; i++) {
        seriesData.push([]);
      }

      // Collect all unique timestamps
      const timestampSet = new Set<number>();
      response.data.result.forEach(result => {
        result.values.forEach((v: any) => {
          timestampSet.add(v[0] as number);
        });
      });

      // Sort timestamps
      const sortedTimestamps = Array.from(timestampSet).sort((a, b) => a - b);
      timestamps.push(...sortedTimestamps);

      // Fill in data for each series
      response.data.result.forEach((result, seriesIdx) => {
        const valueMap = new Map<number, number>();
        result.values.forEach((v: any) => {
          const timestamp = v[0] as number;
          const value = parseFloat(v[1] as string);
          valueMap.set(timestamp, value);
        });

        sortedTimestamps.forEach(ts => {
          seriesData[seriesIdx].push(valueMap.get(ts) ?? null);
        });
      });

      // Create uPlot data structure
      const data: uPlot.AlignedData = [timestamps, ...seriesData];

      // Labels to hide by default
      const hiddenLabels = new Set([
        '__name__',
        'telemetry_sdk_name',
        'telemetry_sdk_version',
        'telemetry_sdk_language',
        'sakuracloud_variant',
        'sakuracloud_account',
        'sakuracloud_publisher',
      ]);

      // Create series configuration
      const series: uPlot.Series[] = [
        { label: 'Time' },
        ...response.data.result.map((result, idx) => {
          const labels = Object.entries(result.metric)
            .filter(([key]) => !hiddenLabels.has(key))
            .map(([key, value]) => `${key}="${value}"`)
            .join(', ');
          return {
            label: labels || `Series ${idx + 1}`,
            stroke: getColor(idx),
            width: 2,
          };
        }),
      ];

      // Create or update plot
      if (plotRef.current) {
        plotRef.current.setData(data);
      } else if (chartRef.current) {
        const opts: uPlot.Options = {
          width: chartRef.current.clientWidth || (embedded ? 700 : 800),
          height: embedded ? 200 : 400,
          series,
          axes: [
            {
              scale: 'x',
              values: (u, vals) => vals.map(v => new Date(v * 1000).toLocaleTimeString()),
            },
            {
              scale: 'y',
              values: (u, vals) => vals.map(v => v?.toFixed(2)),
            },
          ],
          scales: {
            x: {
              time: true,
            },
          },
        };

        plotRef.current = new uPlot(opts, data, chartRef.current);
      }
    } catch (err) {
      console.error('[MetricGraph] loadData error:', err);
      setError(`グラフの読み込みに失敗しました: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    return () => {
      if (plotRef.current) {
        plotRef.current.destroy();
        plotRef.current = null;
      }
    };
  }, [profile, storageId, metricName, timeRange]);

  const getColor = (index: number): string => {
    const colors = [
      '#00adb5',
      '#ff6b6b',
      '#4ecdc4',
      '#ffe66d',
      '#a8e6cf',
      '#ff8b94',
      '#ffaaa5',
      '#ffd3b6',
    ];
    return colors[index % colors.length];
  };

  // Embedded mode: render inline
  if (embedded) {
    return (
      <div style={{
        backgroundColor: '#2a2a2a',
        padding: '1rem',
        borderRadius: '8px',
        border: '1px solid #3a3a3a',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <h4 style={{ margin: 0, fontSize: '0.9rem' }}>{metricName}</h4>
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            {['1h', '6h', '24h', '7d'].map(range => (
              <button
                key={range}
                className={`btn btn-small ${timeRange === range ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setTimeRange(range)}
                disabled={loading}
                style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
              >
                {range}
              </button>
            ))}
          </div>
        </div>

        {loading && <div className="loading" style={{ padding: '1rem' }}>読み込み中...</div>}
        {error && <div className="error-message" style={{ padding: '0.5rem' }}>{error}</div>}

        <div ref={chartRef} />
      </div>
    );
  }

  // Modal mode: render as overlay
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        backgroundColor: '#1e1e1e',
        padding: '2rem',
        borderRadius: '8px',
        maxWidth: '90vw',
        maxHeight: '90vh',
        overflow: 'auto',
        minWidth: '800px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3>{metricName}</h3>
          <button
            className="btn btn-secondary"
            onClick={onClose}
            style={{ padding: '0.5rem 1rem' }}
          >
            閉じる
          </button>
        </div>

        <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem' }}>
          {['1h', '6h', '24h', '7d'].map(range => (
            <button
              key={range}
              className={`btn ${timeRange === range ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setTimeRange(range)}
              disabled={loading}
            >
              {range}
            </button>
          ))}
        </div>

        {loading && <div className="loading">読み込み中...</div>}
        {error && <div className="error-message">{error}</div>}

        <div ref={chartRef} style={{ marginTop: '1rem' }} />
      </div>
    </div>
  );
}
