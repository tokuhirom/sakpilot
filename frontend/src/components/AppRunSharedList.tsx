import { useState, useEffect, useCallback } from 'react';
import {
  GetAppRunSharedApplications,
  GetAppRunSharedApplication,
  GetAppRunSharedVersions,
  GetAppRunSharedTraffics,
  HasAppRunSharedUser,
} from '../../wailsjs/go/main/App';
import { apprunshared } from '../../wailsjs/go/models';
import { useGlobalReload } from '../hooks/useGlobalReload';

interface AppRunSharedListProps {
  profile: string;
}

type View =
  | { type: 'list' }
  | { type: 'detail'; appId: string; appName: string };

export function AppRunSharedList({ profile }: AppRunSharedListProps) {
  const [view, setView] = useState<View>({ type: 'list' });
  const [hasUser, setHasUser] = useState<boolean | null>(null);
  const [apps, setApps] = useState<apprunshared.AppInfo[]>([]);
  const [appDetail, setAppDetail] = useState<apprunshared.AppDetailInfo | null>(null);
  const [versions, setVersions] = useState<apprunshared.VersionInfo[]>([]);
  const [traffics, setTraffics] = useState<apprunshared.TrafficInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkUser = useCallback(async () => {
    if (!profile) return;
    try {
      const result = await HasAppRunSharedUser(profile);
      setHasUser(result);
    } catch (err) {
      console.error('[AppRunSharedList] checkUser error:', err);
      setHasUser(false);
    }
  }, [profile]);

  const loadApps = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      const list = await GetAppRunSharedApplications(profile);
      setApps(list || []);
    } catch (err) {
      console.error('[AppRunSharedList] loadApps error:', err);
      setError(err instanceof Error ? err.message : String(err));
      setApps([]);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  const loadAppDetail = useCallback(async (appId: string) => {
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      const [detail, versionList, trafficList] = await Promise.all([
        GetAppRunSharedApplication(profile, appId),
        GetAppRunSharedVersions(profile, appId),
        GetAppRunSharedTraffics(profile, appId),
      ]);
      setAppDetail(detail);
      setVersions(versionList || []);
      setTraffics(trafficList || []);
    } catch (err) {
      console.error('[AppRunSharedList] loadAppDetail error:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [profile]);

  const handleGlobalReload = useCallback(() => {
    if (view.type === 'list') {
      loadApps();
    } else if (view.type === 'detail') {
      loadAppDetail(view.appId);
    }
  }, [view, loadApps, loadAppDetail]);

  useGlobalReload(handleGlobalReload);

  useEffect(() => {
    checkUser();
  }, [checkUser]);

  useEffect(() => {
    if (hasUser === true && view.type === 'list') {
      loadApps();
    } else if (view.type === 'detail') {
      loadAppDetail(view.appId);
    }
  }, [hasUser, view, loadApps, loadAppDetail]);

  // Reset view on profile change
  useEffect(() => {
    setView({ type: 'list' });
    setApps([]);
    setAppDetail(null);
    setVersions([]);
    setTraffics([]);
    setError(null);
  }, [profile]);

  const handleAppClick = (app: apprunshared.AppInfo) => {
    setView({ type: 'detail', appId: app.id, appName: app.name });
  };

  const handleBackToList = () => {
    setView({ type: 'list' });
    setAppDetail(null);
    setVersions([]);
    setTraffics([]);
  };

  const getStatusClass = (status: string): string => {
    switch (status.toLowerCase()) {
      case 'healthy':
        return 'up';
      case 'deploying':
        return 'migrating';
      case 'unhealthy':
        return 'down';
      default:
        return '';
    }
  };

  // User not set up
  if (hasUser === false) {
    return (
      <div className="apprun-shared-list">
        <div className="header">
          <h2>AppRun共用型</h2>
        </div>
        <div className="empty-state">
          AppRun共用型のユーザーが設定されていません。
          <br />
          さくらのクラウドコントロールパネルからAppRun共用型のユーザーを作成してください。
        </div>
      </div>
    );
  }

  // Loading user check
  if (hasUser === null) {
    return (
      <div className="apprun-shared-list">
        <div className="header">
          <h2>AppRun共用型</h2>
        </div>
        <div className="loading">読み込み中...</div>
      </div>
    );
  }

  // Detail view
  if (view.type === 'detail') {
    return (
      <div className="apprun-shared-list">
        <div className="header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              className="btn btn-secondary"
              onClick={handleBackToList}
              style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
            >
              ← 戻る
            </button>
            <h2>{view.appName}</h2>
          </div>
          <button
            className="btn-reload"
            onClick={() => loadAppDetail(view.appId)}
            disabled={loading}
            title="リロード"
          >
            ↻
          </button>
        </div>

        {error && (
          <div style={{
            marginBottom: '1rem',
            padding: '0.75rem',
            backgroundColor: '#3d1f1f',
            borderRadius: '4px',
            color: '#ff6b6b',
            fontSize: '0.85rem'
          }}>
            エラー: {error}
          </div>
        )}

        {loading ? (
          <div className="loading">読み込み中...</div>
        ) : appDetail ? (
          <>
            <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem', background: '#2a2a2a', borderRadius: '8px' }}>
              <h4 style={{ color: '#00adb5', marginTop: 0, marginBottom: '1rem' }}>基本情報</h4>
              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <tbody>
                  <tr>
                    <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left', width: '150px' }}>ID</td>
                    <td style={{ padding: '0.5rem 0', textAlign: 'left', fontFamily: 'monospace' }}>{appDetail.id}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>ステータス</td>
                    <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>
                      <span className={`status ${getStatusClass(appDetail.status)}`}>
                        {appDetail.status}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>公開URL</td>
                    <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>
                      {appDetail.publicUrl ? (
                        <a href={appDetail.publicUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#00adb5' }}>
                          {appDetail.publicUrl}
                        </a>
                      ) : '-'}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>ポート</td>
                    <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{appDetail.port}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>スケール</td>
                    <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{appDetail.minScale} - {appDetail.maxScale}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>タイムアウト</td>
                    <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{appDetail.timeoutSeconds}秒</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>作成日時</td>
                    <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{appDetail.createdAt}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {appDetail.components && appDetail.components.length > 0 && (
              <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem', background: '#2a2a2a', borderRadius: '8px' }}>
                <h4 style={{ color: '#00adb5', marginTop: 0, marginBottom: '1rem' }}>コンポーネント</h4>
                <table className="table">
                  <thead>
                    <tr>
                      <th>名前</th>
                      <th>イメージ</th>
                      <th>CPU</th>
                      <th>メモリ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {appDetail.components.map((comp, idx) => (
                      <tr key={idx}>
                        <td style={{ fontFamily: 'monospace' }}>{comp.name}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{comp.image || '-'}</td>
                        <td>{comp.maxCpu}</td>
                        <td>{comp.maxMemory}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {traffics.length > 0 && (
              <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem', background: '#2a2a2a', borderRadius: '8px' }}>
                <h4 style={{ color: '#00adb5', marginTop: 0, marginBottom: '1rem' }}>トラフィック分散</h4>
                <table className="table">
                  <thead>
                    <tr>
                      <th>バージョン</th>
                      <th>割合</th>
                    </tr>
                  </thead>
                  <tbody>
                    {traffics.map((traffic, idx) => (
                      <tr key={idx}>
                        <td style={{ fontFamily: 'monospace' }}>
                          {traffic.isLatestVersion ? '(最新)' : traffic.versionName}
                        </td>
                        <td>{traffic.percent}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {versions.length > 0 && (
              <div className="card" style={{ padding: '1rem', background: '#2a2a2a', borderRadius: '8px' }}>
                <h4 style={{ color: '#00adb5', marginTop: 0, marginBottom: '1rem' }}>バージョン履歴</h4>
                <table className="table">
                  <thead>
                    <tr>
                      <th>名前</th>
                      <th>ステータス</th>
                      <th>作成日時</th>
                    </tr>
                  </thead>
                  <tbody>
                    {versions.map((version) => (
                      <tr key={version.id}>
                        <td style={{ fontFamily: 'monospace' }}>{version.name}</td>
                        <td>
                          <span className={`status ${getStatusClass(version.status)}`}>
                            {version.status}
                          </span>
                        </td>
                        <td>{version.createdAt}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : null}
      </div>
    );
  }

  // List view
  return (
    <div className="apprun-shared-list">
      <div className="header">
        <h2>AppRun共用型</h2>
        <button
          className="btn-reload"
          onClick={loadApps}
          disabled={loading}
          title="リロード"
        >
          ↻
        </button>
      </div>

      {error && (
        <div style={{
          marginBottom: '1rem',
          padding: '0.75rem',
          backgroundColor: '#3d1f1f',
          borderRadius: '4px',
          color: '#ff6b6b',
          fontSize: '0.85rem'
        }}>
          エラー: {error}
        </div>
      )}

      {loading ? (
        <div className="loading">読み込み中...</div>
      ) : apps.length === 0 ? (
        <div className="empty-state">アプリケーションがありません</div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>名前</th>
              <th>ステータス</th>
              <th>公開URL</th>
              <th>作成日時</th>
            </tr>
          </thead>
          <tbody>
            {apps.map((app) => (
              <tr
                key={app.id}
                onClick={() => handleAppClick(app)}
                style={{ cursor: 'pointer' }}
              >
                <td style={{ color: '#00adb5', fontFamily: 'monospace' }}>{app.name}</td>
                <td>
                  <span className={`status ${getStatusClass(app.status)}`}>
                    {app.status}
                  </span>
                </td>
                <td>
                  {app.publicUrl ? (
                    <a
                      href={app.publicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#00adb5', fontSize: '0.85rem' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {app.publicUrl}
                    </a>
                  ) : '-'}
                </td>
                <td>{app.createdAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
