import { useEffect, useRef, useState } from 'react';
import { GetProxyLBMonitorConnection } from '../../wailsjs/go/main/App';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';

interface ProxyLBConnectionGraphProps {
  profile: string;
  proxyLBId: string;
}

const TIME_RANGES = ['1h', '6h', '24h', '7d'] as const;

const rangeToSeconds = (range: string): number => {
  switch (range) {
    case '6h': return 6 * 3600;
    case '24h': return 24 * 3600;
    case '7d': return 7 * 24 * 3600;
    default: return 3600;
  }
};

export function ProxyLBConnectionGraph({ profile, proxyLBId }: ProxyLBConnectionGraphProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<uPlot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<string>('1h');

  useEffect(() => {
    if (!profile || !proxyLBId) return;

    let cancelled = false;

    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const now = Math.floor(Date.now() / 1000);
        const start = now - rangeToSeconds(timeRange);
        const values = await GetProxyLBMonitorConnection(profile, proxyLBId, start, now);
        if (cancelled) return;

        if (!values || values.length === 0) {
          setError('データがありません');
          return;
        }

        const sorted = [...values].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
        const timestamps = sorted.map(v => Math.floor(new Date(v.time).getTime() / 1000));
        const activeConnections = sorted.map(v => v.activeConnections);
        const connectionsPerSec = sorted.map(v => v.connectionsPerSec);

        const data: uPlot.AlignedData = [timestamps, activeConnections, connectionsPerSec];

        const series: uPlot.Series[] = [
          { label: 'Time' },
          { label: 'アクティブ接続', stroke: '#00adb5', width: 2 },
          { label: 'CPS', stroke: '#ff6b6b', width: 2 },
        ];

        if (plotRef.current) {
          plotRef.current.setData(data);
        } else if (chartRef.current) {
          plotRef.current = new uPlot({
            width: chartRef.current.clientWidth || 700,
            height: 240,
            series,
            axes: [
              {
                scale: 'x',
                values: (_u, vals) => vals.map(v => new Date(v * 1000).toLocaleTimeString('ja-JP', { hour12: false })),
                stroke: '#aaa',
                ticks: { stroke: '#444' },
                grid: { stroke: '#333' },
                rotate: -45,
                gap: 5,
              },
              {
                scale: 'y',
                stroke: '#aaa',
                ticks: { stroke: '#444' },
                grid: { stroke: '#333' },
              },
            ],
            scales: { x: { time: true } },
            legend: { live: true },
          }, data, chartRef.current);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[ProxyLBConnectionGraph] loadData error:', err);
          setError(`グラフの読み込みに失敗しました: ${err}`);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    if (plotRef.current) {
      plotRef.current.destroy();
      plotRef.current = null;
    }
    loadData();

    return () => {
      cancelled = true;
      if (plotRef.current) {
        plotRef.current.destroy();
        plotRef.current = null;
      }
    };
  }, [profile, proxyLBId, timeRange]);

  return (
    <div>
      <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem' }}>
        {TIME_RANGES.map(range => (
          <button
            key={range}
            className={`btn btn-small ${timeRange === range ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTimeRange(range)}
            disabled={loading}
          >
            {range}
          </button>
        ))}
      </div>

      {loading && <div className="loading">読み込み中...</div>}
      {error && <div className="error-message">{error}</div>}

      <div ref={chartRef} />
    </div>
  );
}
