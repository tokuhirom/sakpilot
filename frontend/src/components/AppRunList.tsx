import { useState, useEffect, useCallback } from 'react';
import {
  GetAppRunClusters,
  GetAppRunApplications,
  GetAppRunApplicationVersions,
  GetAppRunApplicationVersion,
  GetAppRunASGs,
  GetAppRunLoadBalancers,
  GetAppRunWorkerNodes,
  GetAppRunLBNodes,
  ClearAppRunActiveVersion,
} from '../../wailsjs/go/main/App';
import { apprun } from '../../wailsjs/go/models';

interface AppRunListProps {
  profile: string;
}

type View =
  | { type: 'clusters' }
  | { type: 'cluster'; clusterId: string; clusterName: string }
  | { type: 'asg'; clusterId: string; clusterName: string; asgId: string; asgName: string }
  | { type: 'lb'; clusterId: string; clusterName: string; asgId: string; asgName: string; lbId: string; lbName: string }
  | { type: 'app'; clusterId: string; clusterName: string; appId: string; appName: string; activeVersion: number }
  | { type: 'version'; clusterId: string; clusterName: string; appId: string; appName: string; activeVersion: number; version: number };

export function AppRunList({ profile }: AppRunListProps) {
  const [view, setView] = useState<View>({ type: 'clusters' });
  const [clusters, setClusters] = useState<apprun.ClusterInfo[]>([]);
  const [apps, setApps] = useState<apprun.AppInfo[]>([]);
  const [versions, setVersions] = useState<apprun.AppVersionInfo[]>([]);
  const [asgs, setAsgs] = useState<apprun.ASGInfo[]>([]);
  const [lbs, setLbs] = useState<apprun.LBInfo[]>([]);
  const [workerNodes, setWorkerNodes] = useState<apprun.WorkerNodeInfo[]>([]);
  const [lbNodes, setLbNodes] = useState<apprun.LBNodeInfo[]>([]);
  const [lbNodesMap, setLbNodesMap] = useState<Record<string, apprun.LBNodeInfo[]>>({});
  const [versionDetail, setVersionDetail] = useState<apprun.AppVersionDetailInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [clearingActiveVersion, setClearingActiveVersion] = useState(false);

  const loadClusters = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const list = await GetAppRunClusters(profile);
      setClusters(list || []);
    } catch (err) {
      console.error('[AppRunList] loadClusters error:', err);
      setClusters([]);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  const loadClusterDetails = useCallback(async (clusterId: string) => {
    if (!profile) return;
    setLoading(true);
    try {
      const [appList, asgList] = await Promise.all([
        GetAppRunApplications(profile, clusterId),
        GetAppRunASGs(profile, clusterId),
      ]);
      setApps(appList || []);
      setAsgs(asgList || []);
    } catch (err) {
      console.error('[AppRunList] loadClusterDetails error:', err);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  const loadAppVersions = useCallback(async (appId: string) => {
    if (!profile) return;
    setLoading(true);
    try {
      const list = await GetAppRunApplicationVersions(profile, appId);
      setVersions(list || []);
    } catch (err) {
      console.error('[AppRunList] loadAppVersions error:', err);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  const loadASGDetails = useCallback(async (clusterId: string, asgId: string) => {
    if (!profile) return;
    setLoading(true);
    try {
      const [lbList, nodeList] = await Promise.all([
        GetAppRunLoadBalancers(profile, clusterId, asgId),
        GetAppRunWorkerNodes(profile, clusterId, asgId),
      ]);
      setLbs(lbList || []);
      setWorkerNodes(nodeList || []);

      // 各LBのノード情報も取得
      const nodesMap: Record<string, apprun.LBNodeInfo[]> = {};
      if (lbList && lbList.length > 0) {
        const nodePromises = lbList.map(async (lb) => {
          try {
            const nodes = await GetAppRunLBNodes(profile, clusterId, asgId, lb.id);
            return { lbId: lb.id, nodes: nodes || [] };
          } catch {
            return { lbId: lb.id, nodes: [] };
          }
        });
        const results = await Promise.all(nodePromises);
        for (const { lbId, nodes } of results) {
          nodesMap[lbId] = nodes;
        }
      }
      setLbNodesMap(nodesMap);
    } catch (err) {
      console.error('[AppRunList] loadASGDetails error:', err);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  const loadLBNodes = useCallback(async (clusterId: string, asgId: string, lbId: string) => {
    if (!profile) return;
    setLoading(true);
    try {
      const list = await GetAppRunLBNodes(profile, clusterId, asgId, lbId);
      setLbNodes(list || []);
    } catch (err) {
      console.error('[AppRunList] loadLBNodes error:', err);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  const loadVersionDetail = useCallback(async (appId: string, version: number) => {
    if (!profile) return;
    setLoading(true);
    try {
      const detail = await GetAppRunApplicationVersion(profile, appId, version);
      setVersionDetail(detail);
    } catch (err) {
      console.error('[AppRunList] loadVersionDetail error:', err);
      setVersionDetail(null);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  const handleClearActiveVersion = async (appId: string, clusterId: string, clusterName: string, appName: string) => {
    if (!profile) return;
    setClearingActiveVersion(true);
    try {
      await ClearAppRunActiveVersion(profile, appId);
      // 成功したらビューを更新（activeVersionを0に）
      setView({
        type: 'app',
        clusterId,
        clusterName,
        appId,
        appName,
        activeVersion: 0
      });
      // バージョン一覧を再読み込み
      await loadAppVersions(appId);
    } catch (err) {
      console.error('[AppRunList] handleClearActiveVersion error:', err);
      alert('アクティブバージョンのクリアに失敗しました');
    } finally {
      setClearingActiveVersion(false);
    }
  };

  useEffect(() => {
    if (view.type === 'clusters') {
      loadClusters();
    } else if (view.type === 'cluster') {
      loadClusterDetails(view.clusterId);
    } else if (view.type === 'app') {
      loadAppVersions(view.appId);
    } else if (view.type === 'asg') {
      loadASGDetails(view.clusterId, view.asgId);
    } else if (view.type === 'lb') {
      loadLBNodes(view.clusterId, view.asgId, view.lbId);
    } else if (view.type === 'version') {
      loadVersionDetail(view.appId, view.version);
    }
  }, [view, loadClusters, loadClusterDetails, loadAppVersions, loadASGDetails, loadLBNodes, loadVersionDetail]);

  const renderBreadcrumb = () => {
    const items: { label: string; onClick?: () => void }[] = [];

    items.push({
      label: 'クラスタ',
      onClick: view.type !== 'clusters' ? () => setView({ type: 'clusters' }) : undefined,
    });

    if (view.type === 'cluster' || view.type === 'asg' || view.type === 'lb' || view.type === 'app' || view.type === 'version') {
      const clusterName = view.clusterName;
      const clusterId = view.clusterId;
      items.push({
        label: clusterName,
        onClick: view.type !== 'cluster' ? () => setView({ type: 'cluster', clusterId, clusterName }) : undefined,
      });
    }

    if (view.type === 'asg' || view.type === 'lb') {
      items.push({
        label: view.asgName,
        onClick: view.type !== 'asg' ? () => setView({
          type: 'asg',
          clusterId: view.clusterId,
          clusterName: view.clusterName,
          asgId: view.asgId,
          asgName: view.asgName
        }) : undefined,
      });
    }

    if (view.type === 'lb') {
      items.push({ label: view.lbName });
    }

    if (view.type === 'app' || view.type === 'version') {
      items.push({
        label: view.appName,
        onClick: view.type === 'version' ? () => setView({
          type: 'app',
          clusterId: view.clusterId,
          clusterName: view.clusterName,
          appId: view.appId,
          appName: view.appName,
          activeVersion: view.activeVersion
        }) : undefined,
      });
    }

    if (view.type === 'version') {
      items.push({ label: `v${view.version}` });
    }

    return (
      <div className="breadcrumb">
        {items.map((item, idx) => (
          <span key={idx}>
            {idx > 0 && <span className="breadcrumb-separator"> / </span>}
            <span
              className={`breadcrumb-item ${!item.onClick ? 'active' : ''}`}
              onClick={item.onClick}
            >
              {item.label}
            </span>
          </span>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <>
        <div className="header">
          <h2>AppRun</h2>
        </div>
        {renderBreadcrumb()}
        <div className="loading">読み込み中...</div>
      </>
    );
  }

  // クラスタ一覧
  if (view.type === 'clusters') {
    return (
      <>
        <div className="header">
          <h2>AppRun</h2>
          <button
            className="btn-reload"
            onClick={() => loadClusters()}
            disabled={loading}
            title="リロード"
          >
            ↻
          </button>
        </div>
        {renderBreadcrumb()}
        {clusters.length === 0 ? (
          <div className="empty-state">クラスタがありません</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>名前</th>
                <th>ID</th>
              </tr>
            </thead>
            <tbody>
              {clusters.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => setView({ type: 'cluster', clusterId: c.id, clusterName: c.name })}
                  style={{ cursor: 'pointer' }}
                  className="row-hover"
                >
                  <td style={{ color: '#00adb5', fontWeight: 'bold' }}>{c.name}</td>
                  <td>{c.id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </>
    );
  }

  // クラスタ詳細（アプリ一覧 + ASG一覧）
  if (view.type === 'cluster') {
    return (
      <>
        <div className="header">
          <h2>AppRun</h2>
        </div>
        {renderBreadcrumb()}

        <h3 style={{ marginTop: '1rem', color: '#00adb5' }}>アプリケーション</h3>
        {apps.length === 0 ? (
          <div className="empty-state">アプリケーションがありません</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>名前</th>
                <th>アクティブバージョン</th>
                <th>ID</th>
              </tr>
            </thead>
            <tbody>
              {apps.map((app) => (
                <tr
                  key={app.id}
                  onClick={() => setView({
                    type: 'app',
                    clusterId: view.clusterId,
                    clusterName: view.clusterName,
                    appId: app.id,
                    appName: app.name,
                    activeVersion: app.activeVersion
                  })}
                  style={{ cursor: 'pointer' }}
                  className="row-hover"
                >
                  <td style={{ color: '#00adb5', fontWeight: 'bold' }}>{app.name}</td>
                  <td>{app.activeVersion || '-'}</td>
                  <td>{app.id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <h3 style={{ marginTop: '2rem', color: '#00adb5' }}>Auto Scaling Groups</h3>
        {asgs.length === 0 ? (
          <div className="empty-state">ASGがありません</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>名前</th>
                <th>ゾーン</th>
                <th>ノード (min/max/current)</th>
                <th>ID</th>
              </tr>
            </thead>
            <tbody>
              {asgs.map((asg) => (
                <tr
                  key={asg.id}
                  onClick={() => setView({
                    type: 'asg',
                    clusterId: view.clusterId,
                    clusterName: view.clusterName,
                    asgId: asg.id,
                    asgName: asg.name
                  })}
                  style={{ cursor: 'pointer' }}
                  className="row-hover"
                >
                  <td style={{ color: '#00adb5', fontWeight: 'bold' }}>{asg.name}</td>
                  <td>{asg.zone}</td>
                  <td>{asg.minNodes} / {asg.maxNodes} / {asg.workerNodeCount}</td>
                  <td>{asg.id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </>
    );
  }

  // アプリ詳細（バージョン一覧）
  if (view.type === 'app') {
    return (
      <>
        <div className="header">
          <h2>AppRun</h2>
        </div>
        {renderBreadcrumb()}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
          <h3 style={{ color: '#00adb5', margin: 0 }}>バージョン</h3>
          {view.activeVersion > 0 && (
            <button
              className="btn btn-danger btn-small"
              onClick={() => handleClearActiveVersion(view.appId, view.clusterId, view.clusterName, view.appName)}
              disabled={clearingActiveVersion}
            >
              {clearingActiveVersion ? '処理中...' : '非アクティブ化'}
            </button>
          )}
        </div>
        {versions.length === 0 ? (
          <div className="empty-state">バージョンがありません</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>バージョン</th>
                <th>状態</th>
                <th>イメージ</th>
                <th>アクティブノード数</th>
                <th>作成日時</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((v) => {
                const isActive = v.version === view.activeVersion;
                return (
                  <tr
                    key={v.version}
                    onClick={() => setView({
                      type: 'version',
                      clusterId: view.clusterId,
                      clusterName: view.clusterName,
                      appId: view.appId,
                      appName: view.appName,
                      activeVersion: view.activeVersion,
                      version: v.version
                    })}
                    style={{ cursor: 'pointer' }}
                    className="row-hover"
                  >
                    <td style={{ fontWeight: 'bold', color: '#00adb5' }}>v{v.version}</td>
                    <td>
                      {isActive ? (
                        <span className="status up">Active</span>
                      ) : v.activeNodeCount > 0 ? (
                        <span className="status draining">Draining</span>
                      ) : (
                        <span className="status" style={{ background: '#666' }}>-</span>
                      )}
                    </td>
                    <td>{v.image || '-'}</td>
                    <td>
                      {!isActive && v.activeNodeCount > 0 ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                          {v.activeNodeCount}
                          <span className="spinner-small" />
                        </span>
                      ) : (
                        v.activeNodeCount
                      )}
                    </td>
                    <td>{v.createdAt || '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </>
    );
  }

  // ASG詳細（LB一覧 + ワーカーノード一覧）
  if (view.type === 'asg') {
    return (
      <>
        <div className="header">
          <h2>AppRun</h2>
        </div>
        {renderBreadcrumb()}

        <h3 style={{ marginTop: '1rem', color: '#00adb5' }}>ロードバランサー</h3>
        {lbs.length === 0 ? (
          <div className="empty-state">ロードバランサーがありません</div>
        ) : (
          lbs.map((lb) => {
            const nodes = lbNodesMap[lb.id] || [];
            return (
              <div key={lb.id} style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                  <span style={{ color: '#00adb5', fontWeight: 'bold', fontSize: '1.1rem' }}>{lb.name}</span>
                  <span style={{ color: '#888', fontSize: '0.9rem' }}>{lb.serviceClassPath}</span>
                </div>
                {nodes.length === 0 ? (
                  <div style={{ color: '#888', marginLeft: '1rem' }}>ノードなし</div>
                ) : (
                  <table className="table" style={{ marginLeft: '1rem' }}>
                    <thead>
                      <tr>
                        <th>ノードID</th>
                        <th>状態</th>
                        <th>IPアドレス</th>
                      </tr>
                    </thead>
                    <tbody>
                      {nodes.map((node) => {
                        const isHealthy = ['running', 'healthy'].includes(node.status.toLowerCase());
                        return (
                          <tr key={node.id}>
                            <td>{node.id.substring(0, 8)}...</td>
                            <td>
                              <span className={`status ${isHealthy ? 'up' : 'down'}`}>
                                {node.status}
                              </span>
                            </td>
                            <td>
                              {node.interfaces?.map((iface, idx) => (
                                <span key={idx}>
                                  eth{iface.index}: {iface.addresses?.join(', ') || '-'}
                                  {idx < (node.interfaces?.length || 0) - 1 && ' | '}
                                </span>
                              ))}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })
        )}

        <h3 style={{ marginTop: '2rem', color: '#00adb5' }}>ワーカーノード</h3>
        {workerNodes.length === 0 ? (
          <div className="empty-state">ワーカーノードがありません</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>状態</th>
                <th>Draining</th>
                <th>IPアドレス</th>
              </tr>
            </thead>
            <tbody>
              {workerNodes.map((node) => {
                const isHealthy = ['running', 'healthy'].includes(node.status.toLowerCase());
                return (
                  <tr key={node.id}>
                    <td>{node.id.substring(0, 8)}...</td>
                    <td>
                      <span className={`status ${isHealthy ? 'up' : 'down'}`}>
                        {node.status}
                      </span>
                    </td>
                    <td>{node.draining ? 'Yes' : 'No'}</td>
                    <td>
                      {node.interfaces?.map((iface, idx) => (
                        <div key={idx}>
                          eth{iface.index}: {iface.addresses?.join(', ') || '-'}
                        </div>
                      ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </>
    );
  }

  // LB詳細（LBノード一覧）
  if (view.type === 'lb') {
    return (
      <>
        <div className="header">
          <h2>AppRun</h2>
        </div>
        {renderBreadcrumb()}

        <h3 style={{ marginTop: '1rem', color: '#00adb5' }}>ロードバランサーノード</h3>
        {lbNodes.length === 0 ? (
          <div className="empty-state">LBノードがありません</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>状態</th>
                <th>IPアドレス</th>
              </tr>
            </thead>
            <tbody>
              {lbNodes.map((node) => {
                const isHealthy = ['running', 'healthy'].includes(node.status.toLowerCase());
                return (
                  <tr key={node.id}>
                    <td>{node.id.substring(0, 8)}...</td>
                    <td>
                      <span className={`status ${isHealthy ? 'up' : 'down'}`}>
                        {node.status}
                      </span>
                    </td>
                    <td>
                      {node.interfaces?.map((iface, idx) => (
                        <div key={idx}>
                          eth{iface.index}: {iface.addresses?.join(', ') || '-'}
                        </div>
                      ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </>
    );
  }

  // バージョン詳細
  if (view.type === 'version') {
    const isActive = view.version === view.activeVersion;
    return (
      <>
        <div className="header">
          <h2>AppRun</h2>
        </div>
        {renderBreadcrumb()}

        {versionDetail ? (
          <div style={{ marginTop: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
              <h3 style={{ color: '#00adb5', margin: 0 }}>バージョン {view.version}</h3>
              {isActive && <span className="status up">Active</span>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem' }}>
              {/* 基本情報 */}
              <div className="card" style={{ padding: '1rem', background: '#2a2a2a', borderRadius: '8px' }}>
                <h4 style={{ color: '#00adb5', marginTop: 0, marginBottom: '1rem' }}>基本情報</h4>
                <table style={{ borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>イメージ</td>
                      <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{versionDetail.image || '-'}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>CPU</td>
                      <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{versionDetail.cpu} vCPU</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>メモリ</td>
                      <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{versionDetail.memory} MB</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>アクティブノード数</td>
                      <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{versionDetail.activeNodeCount}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>作成日時</td>
                      <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{versionDetail.createdAt || '-'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* スケーリング設定 */}
              <div className="card" style={{ padding: '1rem', background: '#2a2a2a', borderRadius: '8px' }}>
                <h4 style={{ color: '#00adb5', marginTop: 0, marginBottom: '1rem' }}>スケーリング設定</h4>
                <table style={{ borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>モード</td>
                      <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{versionDetail.scalingMode || '-'}</td>
                    </tr>
                    {versionDetail.scalingMode === 'manual' ? (
                      <tr>
                        <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>固定スケール</td>
                        <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{versionDetail.fixedScale}</td>
                      </tr>
                    ) : versionDetail.scalingMode === 'cpu' ? (
                      <>
                        <tr>
                          <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>最小/最大スケール</td>
                          <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{versionDetail.minScale} / {versionDetail.maxScale}</td>
                        </tr>
                        <tr>
                          <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>スケールイン閾値</td>
                          <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{versionDetail.scaleInThreshold}%</td>
                        </tr>
                        <tr>
                          <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>スケールアウト閾値</td>
                          <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{versionDetail.scaleOutThreshold}%</td>
                        </tr>
                      </>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>

            {/* コマンド */}
            {versionDetail.cmd && versionDetail.cmd.length > 0 && (
              <div className="card" style={{ marginTop: '1.5rem', padding: '1rem', background: '#2a2a2a', borderRadius: '8px' }}>
                <h4 style={{ color: '#00adb5', marginTop: 0, marginBottom: '1rem' }}>コマンド</h4>
                <code style={{ background: '#1a1a1a', padding: '0.5rem', borderRadius: '4px', display: 'block' }}>
                  {versionDetail.cmd.join(' ')}
                </code>
              </div>
            )}

            {/* 公開ポート */}
            {versionDetail.exposedPorts && versionDetail.exposedPorts.length > 0 && (
              <div className="card" style={{ marginTop: '1.5rem', padding: '1rem', background: '#2a2a2a', borderRadius: '8px' }}>
                <h4 style={{ color: '#00adb5', marginTop: 0, marginBottom: '1rem' }}>公開ポート</h4>
                <table className="table">
                  <thead>
                    <tr>
                      <th>ターゲットポート</th>
                      <th>LBポート</th>
                    </tr>
                  </thead>
                  <tbody>
                    {versionDetail.exposedPorts.map((port, idx) => (
                      <tr key={idx}>
                        <td>{port.targetPort}</td>
                        <td>{port.loadBalancerPort}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 環境変数 */}
            {versionDetail.env && versionDetail.env.length > 0 && (
              <div className="card" style={{ marginTop: '1.5rem', padding: '1rem', background: '#2a2a2a', borderRadius: '8px' }}>
                <h4 style={{ color: '#00adb5', marginTop: 0, marginBottom: '1rem' }}>環境変数</h4>
                <table className="table">
                  <thead>
                    <tr>
                      <th>名前</th>
                      <th>値</th>
                    </tr>
                  </thead>
                  <tbody>
                    {versionDetail.env.map((env, idx) => (
                      <tr key={idx}>
                        <td style={{ fontFamily: 'monospace' }}>
                          {env.key}
                          {env.secret && <span style={{ color: '#ff6b6b', marginLeft: '0.5rem', fontSize: '0.8em' }}>secret</span>}
                        </td>
                        <td style={{ fontFamily: 'monospace', color: env.secret && !env.value ? '#888' : undefined }}>
                          {env.value || (env.secret ? '(hidden)' : '(empty)')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div className="empty-state">バージョン情報を読み込めませんでした</div>
        )}
      </>
    );
  }

  return null;
}
