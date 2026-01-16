import { useState, useEffect, useCallback } from 'react';
import { GetProxyLBs, GetProxyLBDetail, GetProxyLBHealth } from '../../wailsjs/go/main/App';
import { sakura } from '../../wailsjs/go/models';
import { useSearch } from '../hooks/useSearch';
import { SearchBar } from './SearchBar';

interface ProxyLBListProps {
  profile: string;
}

type ViewMode = 'list' | 'detail';

export function ProxyLBList({ profile }: ProxyLBListProps) {
  const [proxyLBs, setProxyLBs] = useState<sakura.ProxyLBInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedProxyLB, setSelectedProxyLB] = useState<sakura.ProxyLBInfo | null>(null);
  const [health, setHealth] = useState<sakura.ProxyLBHealthInfo | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(false);

  const {
    searchQuery,
    setSearchQuery,
    isSearching,
    searchInputRef,
    filteredItems: filteredProxyLBs,
    closeSearch,
  } = useSearch(proxyLBs, (lb, query) =>
    lb.name.toLowerCase().includes(query) ||
    lb.fqdn?.toLowerCase().includes(query) ||
    lb.virtualIPAddress?.toLowerCase().includes(query) ||
    lb.tags?.some(tag => tag.toLowerCase().includes(query)) ||
    lb.id.includes(query)
  );

  const loadProxyLBs = useCallback(async () => {
    if (!profile) return;

    setLoading(true);
    try {
      const list = await GetProxyLBs(profile);
      setProxyLBs(list || []);
    } catch (err) {
      console.error('[ProxyLBList] loadProxyLBs error:', err);
      setProxyLBs([]);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  const loadDetail = useCallback(async (id: string) => {
    if (!profile) return;

    try {
      const detail = await GetProxyLBDetail(profile, id);
      setSelectedProxyLB(detail);
    } catch (err) {
      console.error('[ProxyLBList] loadDetail error:', err);
    }
  }, [profile]);

  const loadHealth = useCallback(async (id: string) => {
    if (!profile) return;

    setLoadingHealth(true);
    try {
      const h = await GetProxyLBHealth(profile, id);
      setHealth(h);
    } catch (err) {
      console.error('[ProxyLBList] loadHealth error:', err);
      setHealth(null);
    } finally {
      setLoadingHealth(false);
    }
  }, [profile]);

  useEffect(() => {
    loadProxyLBs();
  }, [loadProxyLBs]);

  const handleSelectProxyLB = (lb: sakura.ProxyLBInfo) => {
    setSelectedProxyLB(lb);
    setHealth(null);
    setViewMode('detail');
    loadDetail(lb.id);
    loadHealth(lb.id);
  };

  const handleBackToList = () => {
    setViewMode('list');
    setSelectedProxyLB(null);
    setHealth(null);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid Date';

    const Y = date.getFullYear();
    const M = String(date.getMonth() + 1).padStart(2, '0');
    const D = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');

    return `${Y}/${M}/${D} ${h}:${m}`;
  };

  const getRegionName = (region: string) => {
    switch (region) {
      case 'is1': return '石狩';
      case 'tk1': return '東京';
      case 'anycast': return 'エニーキャスト';
      default: return region;
    }
  };

  const getPlanName = (plan: string) => {
    if (plan.includes('100')) return '100 CPS';
    if (plan.includes('500')) return '500 CPS';
    if (plan.includes('1000')) return '1,000 CPS';
    if (plan.includes('5000')) return '5,000 CPS';
    if (plan.includes('10000')) return '10,000 CPS';
    if (plan.includes('50000')) return '50,000 CPS';
    if (plan.includes('100000')) return '100,000 CPS';
    if (plan.includes('400000')) return '400,000 CPS';
    return plan;
  };

  const getProxyModeName = (mode: string) => {
    switch (mode) {
      case 'http': return 'HTTP';
      case 'https': return 'HTTPS';
      case 'tcp': return 'TCP';
      default: return mode;
    }
  };

  // Detail View
  if (viewMode === 'detail' && selectedProxyLB) {
    return (
      <>
        <div className="header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              className="btn btn-secondary"
              onClick={handleBackToList}
              style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
            >
              ← 戻る
            </button>
            <h2>{selectedProxyLB.name}</h2>
          </div>
          <button
            className="btn-reload"
            onClick={() => {
              loadDetail(selectedProxyLB.id);
              loadHealth(selectedProxyLB.id);
            }}
            disabled={loadingHealth}
            title="リロード"
          >
            ↻
          </button>
        </div>

        {/* Basic Info */}
        <div className="card" style={{ marginBottom: '1rem', padding: '1rem', background: '#2a2a2a', borderRadius: '8px' }}>
          <h4 style={{ color: '#00adb5', marginTop: 0, marginBottom: '1rem' }}>基本情報</h4>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <tbody>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', width: '150px' }}>ID</td>
                <td style={{ padding: '0.5rem 0', fontFamily: 'monospace' }}>{selectedProxyLB.id}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888' }}>FQDN</td>
                <td style={{ padding: '0.5rem 0', fontFamily: 'monospace', color: '#00adb5' }}>{selectedProxyLB.fqdn}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888' }}>VIP</td>
                <td style={{ padding: '0.5rem 0', fontFamily: 'monospace' }}>{selectedProxyLB.virtualIPAddress}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888' }}>プラン</td>
                <td style={{ padding: '0.5rem 0' }}>{getPlanName(selectedProxyLB.plan)}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888' }}>リージョン</td>
                <td style={{ padding: '0.5rem 0' }}>{getRegionName(selectedProxyLB.region)}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888' }}>VIPフェイルオーバー</td>
                <td style={{ padding: '0.5rem 0' }}>{selectedProxyLB.useVIPFailover ? '有効' : '無効'}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888' }}>作成日</td>
                <td style={{ padding: '0.5rem 0' }}>{formatDate(selectedProxyLB.createdAt)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Bind Ports */}
        <div className="card" style={{ marginBottom: '1rem', padding: '1rem', background: '#2a2a2a', borderRadius: '8px' }}>
          <h4 style={{ color: '#00adb5', marginTop: 0, marginBottom: '1rem' }}>待ち受けポート</h4>
          {selectedProxyLB.bindPorts && selectedProxyLB.bindPorts.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th>ポート</th>
                  <th>モード</th>
                  <th>HTTP/2</th>
                  <th>HTTPSリダイレクト</th>
                </tr>
              </thead>
              <tbody>
                {selectedProxyLB.bindPorts.map((bp, idx) => (
                  <tr key={idx}>
                    <td style={{ fontFamily: 'monospace' }}>{bp.port}</td>
                    <td>{getProxyModeName(bp.proxyMode)}</td>
                    <td>{bp.supportHttp2 ? '有効' : '-'}</td>
                    <td>{bp.redirectToHttps ? '有効' : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ color: '#666' }}>待ち受けポートがありません</div>
          )}
        </div>

        {/* Servers */}
        <div className="card" style={{ marginBottom: '1rem', padding: '1rem', background: '#2a2a2a', borderRadius: '8px' }}>
          <h4 style={{ color: '#00adb5', marginTop: 0, marginBottom: '1rem' }}>実サーバー</h4>
          {selectedProxyLB.servers && selectedProxyLB.servers.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th>IPアドレス</th>
                  <th>ポート</th>
                  <th>グループ</th>
                  <th>状態</th>
                </tr>
              </thead>
              <tbody>
                {selectedProxyLB.servers.map((srv, idx) => (
                  <tr key={idx}>
                    <td style={{ fontFamily: 'monospace' }}>{srv.ipAddress}</td>
                    <td style={{ fontFamily: 'monospace' }}>{srv.port}</td>
                    <td>{srv.serverGroup || 'default'}</td>
                    <td>
                      <span className={`status ${srv.enabled ? 'up' : 'down'}`}>
                        {srv.enabled ? '有効' : '無効'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ color: '#666' }}>実サーバーがありません</div>
          )}
        </div>

        {/* Health Status */}
        <div className="card" style={{ marginBottom: '1rem', padding: '1rem', background: '#2a2a2a', borderRadius: '8px' }}>
          <h4 style={{ color: '#00adb5', marginTop: 0, marginBottom: '1rem' }}>ヘルスステータス</h4>
          {loadingHealth ? (
            <div className="loading">読み込み中...</div>
          ) : health ? (
            <>
              <div style={{ marginBottom: '1rem', display: 'flex', gap: '2rem' }}>
                <div>
                  <span style={{ color: '#888' }}>アクティブ接続: </span>
                  <span style={{ fontFamily: 'monospace' }}>{health.activeConn}</span>
                </div>
                <div>
                  <span style={{ color: '#888' }}>CPS: </span>
                  <span style={{ fontFamily: 'monospace' }}>{health.cps.toFixed(2)}</span>
                </div>
                <div>
                  <span style={{ color: '#888' }}>現在のVIP: </span>
                  <span style={{ fontFamily: 'monospace' }}>{health.currentVip}</span>
                </div>
              </div>
              {health.servers && health.servers.length > 0 ? (
                <table className="table">
                  <thead>
                    <tr>
                      <th>IPアドレス</th>
                      <th>ポート</th>
                      <th>ステータス</th>
                      <th>アクティブ接続</th>
                      <th>CPS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {health.servers.map((srv, idx) => (
                      <tr key={idx}>
                        <td style={{ fontFamily: 'monospace' }}>{srv.ipAddress}</td>
                        <td style={{ fontFamily: 'monospace' }}>{srv.port}</td>
                        <td>
                          <span className={`status ${srv.status === 'up' ? 'up' : 'down'}`}>
                            {srv.status === 'up' ? 'UP' : srv.status === 'down' ? 'DOWN' : srv.status}
                          </span>
                        </td>
                        <td style={{ fontFamily: 'monospace' }}>{srv.activeConn}</td>
                        <td style={{ fontFamily: 'monospace' }}>{srv.cps.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ color: '#666' }}>サーバーステータスがありません</div>
              )}
            </>
          ) : (
            <div style={{ color: '#666' }}>ヘルスステータスを取得できませんでした</div>
          )}
        </div>
      </>
    );
  }

  // List View
  return (
    <>
      <div className="header">
        <h2>エンハンスドロードバランサ (ELB)</h2>
        <button
          className="btn-reload"
          onClick={() => loadProxyLBs()}
          disabled={loading}
          title="リロード"
        >
          ↻
        </button>
      </div>

      <SearchBar
        isSearching={isSearching}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        closeSearch={closeSearch}
        searchInputRef={searchInputRef}
        placeholder="名前、FQDN、VIP、タグで検索... (Escで閉じる)"
      />

      {loading ? (
        <div className="loading">読み込み中...</div>
      ) : filteredProxyLBs.length === 0 ? (
        <div className="empty-state">
          {searchQuery ? `「${searchQuery}」に一致するELBがありません` : 'エンハンスドロードバランサがありません'}
        </div>
      ) : (
        filteredProxyLBs.map((lb) => (
          <div
            key={lb.id}
            className="card"
            onClick={() => handleSelectProxyLB(lb)}
            style={{ cursor: 'pointer' }}
          >
            <div className="card-header">
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div className="card-title">{lb.name}</div>
                  <span className="status up" style={{ padding: '2px 6px', fontSize: '0.65rem' }}>
                    {getPlanName(lb.plan)}
                  </span>
                  <span style={{
                    padding: '2px 6px',
                    fontSize: '0.65rem',
                    backgroundColor: '#1a1a2e',
                    borderRadius: '3px',
                    color: '#888'
                  }}>
                    {getRegionName(lb.region)}
                  </span>
                </div>
                <div className="card-subtitle" style={{ marginTop: '2px', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'monospace', color: '#00adb5' }}>{lb.fqdn}</span>
                  <span style={{ color: '#555' }}>|</span>
                  <span style={{ fontFamily: 'monospace' }}>VIP: {lb.virtualIPAddress}</span>
                  {lb.bindPorts && lb.bindPorts.length > 0 && (
                    <>
                      <span style={{ color: '#555' }}>|</span>
                      <span>
                        ポート: {lb.bindPorts.map(bp => `${bp.port}/${bp.proxyMode}`).join(', ')}
                      </span>
                    </>
                  )}
                </div>
                {lb.servers && lb.servers.length > 0 && (
                  <div style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: '#888' }}>
                    実サーバー: {lb.servers.length}台
                    ({lb.servers.filter(s => s.enabled).length}台有効)
                  </div>
                )}
                {lb.tags && lb.tags.length > 0 && (
                  <div className="tags" style={{ marginTop: '0.25rem', display: 'flex', gap: '0.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    {lb.tags.map(tag => (
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
                )}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#666' }}>
                ID: {lb.id}
              </div>
            </div>
          </div>
        ))
      )}
    </>
  );
}
