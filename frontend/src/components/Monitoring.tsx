import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { GetMSLogs, GetMSMetrics, GetMSTraces } from '../../wailsjs/go/main/App';
import { sakura } from '../../wailsjs/go/models';
import { useGlobalReload } from '../hooks/useGlobalReload';
import { BrowserOpenURL } from '../../wailsjs/runtime';

interface MonitoringProps {
  profile: string;
}

type SubPage = 'logs' | 'metrics' | 'traces';

export function Monitoring({ profile }: MonitoringProps) {
  const navigate = useNavigate();
  const [subPage, setSubPage] = useState<SubPage>('logs');
  const [logs, setLogs] = useState<sakura.MSLogInfo[]>([]);
  const [metrics, setMetrics] = useState<sakura.MSMetricInfo[]>([]);
  const [traces, setTraces] = useState<sakura.MSTraceInfo[]>([]);
  const [loading, setLoading] = useState(false);

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

    const items: (sakura.MSLogInfo | sakura.MSMetricInfo | sakura.MSTraceInfo)[] = 
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
    </>
  );
};
