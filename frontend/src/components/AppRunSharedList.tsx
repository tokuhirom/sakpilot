import { useState, useEffect, useCallback } from 'react';
import {
  GetAppRunSharedApplications,
  GetAppRunSharedApplication,
  GetAppRunSharedVersions,
  GetAppRunSharedTraffics,
  HasAppRunSharedUser,
  CreateAppRunSharedApplication,
  UpdateAppRunSharedApplication,
  DeleteAppRunSharedApplication,
  DeleteAppRunSharedVersion,
  UpdateAppRunSharedTraffics,
  CreateAppRunSharedUser,
} from '../../wailsjs/go/main/App';
import { apprunshared } from '../../wailsjs/go/models';
import { useGlobalReload } from '../hooks/useGlobalReload';

interface AppRunSharedListProps {
  profile: string;
}

type View =
  | { type: 'list' }
  | { type: 'detail'; appId: string; appName: string };

const MAX_CPU_OPTIONS = ['0.5', '1', '2'];
const MAX_MEMORY_OPTIONS = ['1Gi', '2Gi', '4Gi'];

interface CreateEnvVarForm {
  key: string;
  value: string;
}

interface CreateApplicationForm {
  name: string;
  port: string;
  minScale: string;
  maxScale: string;
  timeoutSeconds: string;
  componentName: string;
  image: string;
  maxCpu: string;
  maxMemory: string;
  envVars: CreateEnvVarForm[];
}

const emptyCreateForm = (): CreateApplicationForm => ({
  name: '',
  port: '80',
  minScale: '0',
  maxScale: '1',
  timeoutSeconds: '60',
  componentName: 'component1',
  image: '',
  maxCpu: '0.5',
  maxMemory: '1Gi',
  envVars: [],
});

interface EditApplicationForm {
  port: string;
  minScale: string;
  maxScale: string;
  timeoutSeconds: string;
}

interface TrafficEditForm {
  versionName: string;
  isLatestVersion: boolean;
  percent: string;
}

export function AppRunSharedList({ profile }: AppRunSharedListProps) {
  const [view, setView] = useState<View>({ type: 'list' });
  const [hasUser, setHasUser] = useState<boolean | null>(null);
  const [apps, setApps] = useState<apprunshared.AppInfo[]>([]);
  const [appDetail, setAppDetail] = useState<apprunshared.AppDetailInfo | null>(null);
  const [versions, setVersions] = useState<apprunshared.VersionInfo[]>([]);
  const [traffics, setTraffics] = useState<apprunshared.TrafficInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [createForm, setCreateForm] = useState<CreateApplicationForm | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [editForm, setEditForm] = useState<EditApplicationForm | null>(null);
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [confirmDeleteApp, setConfirmDeleteApp] = useState<apprunshared.AppInfo | null>(null);
  const [confirmDeleteVersion, setConfirmDeleteVersion] = useState<apprunshared.VersionInfo | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [trafficForm, setTrafficForm] = useState<TrafficEditForm[] | null>(null);
  const [savingTraffics, setSavingTraffics] = useState(false);
  const [trafficError, setTrafficError] = useState<string | null>(null);

  const [signingUp, setSigningUp] = useState(false);
  const [signUpError, setSignUpError] = useState<string | null>(null);

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

  const handleCreateOpen = () => {
    setCreateError(null);
    setCreateForm(emptyCreateForm());
  };

  const handleCreateCancel = () => {
    setCreateForm(null);
    setCreateError(null);
  };

  const handleEnvVarAdd = () => {
    if (!createForm) return;
    setCreateForm({ ...createForm, envVars: [...createForm.envVars, { key: '', value: '' }] });
  };

  const handleEnvVarRemove = (index: number) => {
    if (!createForm) return;
    setCreateForm({ ...createForm, envVars: createForm.envVars.filter((_, i) => i !== index) });
  };

  const handleEnvVarChange = (index: number, field: keyof CreateEnvVarForm, value: string) => {
    if (!createForm) return;
    setCreateForm({
      ...createForm,
      envVars: createForm.envVars.map((e, i) => (i === index ? { ...e, [field]: value } : e)),
    });
  };

  const handleCreateSubmit = async () => {
    if (!createForm || !profile) return;
    if (!createForm.name.trim()) {
      setCreateError('アプリ名を入力してください');
      return;
    }
    if (!createForm.image.trim()) {
      setCreateError('コンテナイメージを入力してください');
      return;
    }
    const port = parseInt(createForm.port, 10);
    const minScale = parseInt(createForm.minScale, 10);
    const maxScale = parseInt(createForm.maxScale, 10);
    const timeoutSeconds = parseInt(createForm.timeoutSeconds, 10);
    if ([port, minScale, maxScale, timeoutSeconds].some(isNaN)) {
      setCreateError('ポート・スケール・タイムアウトは数値で入力してください');
      return;
    }
    if (createForm.envVars.some((e) => !e.key)) {
      setCreateError('環境変数のキーを入力してください');
      return;
    }

    setCreating(true);
    setCreateError(null);
    try {
      await CreateAppRunSharedApplication(profile, new apprunshared.CreateApplicationParams({
        name: createForm.name.trim(),
        port,
        minScale,
        maxScale,
        timeoutSeconds,
        componentName: createForm.componentName.trim() || 'component1',
        image: createForm.image.trim(),
        maxCpu: createForm.maxCpu,
        maxMemory: createForm.maxMemory,
        envVars: createForm.envVars.map((e) => new apprunshared.CreateEnvVarParams({ key: e.key, value: e.value })),
      }));
      setCreateForm(null);
      await loadApps();
    } catch (e) {
      setCreateError(String(e));
    } finally {
      setCreating(false);
    }
  };

  const handleEditOpen = () => {
    if (!appDetail) return;
    setEditError(null);
    setEditForm({
      port: String(appDetail.port),
      minScale: String(appDetail.minScale),
      maxScale: String(appDetail.maxScale),
      timeoutSeconds: String(appDetail.timeoutSeconds),
    });
  };

  const handleEditCancel = () => {
    setEditForm(null);
    setEditError(null);
  };

  const handleEditSubmit = async () => {
    if (!editForm || !profile || view.type !== 'detail') return;
    const port = parseInt(editForm.port, 10);
    const minScale = parseInt(editForm.minScale, 10);
    const maxScale = parseInt(editForm.maxScale, 10);
    const timeoutSeconds = parseInt(editForm.timeoutSeconds, 10);
    if ([port, minScale, maxScale, timeoutSeconds].some(isNaN)) {
      setEditError('ポート・スケール・タイムアウトは数値で入力してください');
      return;
    }

    setEditing(true);
    setEditError(null);
    try {
      await UpdateAppRunSharedApplication(profile, view.appId, new apprunshared.UpdateApplicationParams({
        port,
        minScale,
        maxScale,
        timeoutSeconds,
      }));
      setEditForm(null);
      await loadAppDetail(view.appId);
    } catch (e) {
      setEditError(String(e));
    } finally {
      setEditing(false);
    }
  };

  const handleDeleteAppClick = (e: React.MouseEvent, app: apprunshared.AppInfo) => {
    e.stopPropagation();
    setDeleteError(null);
    setConfirmDeleteApp(app);
  };

  const handleDeleteAppCancel = () => {
    setConfirmDeleteApp(null);
  };

  const handleDeleteAppConfirm = async () => {
    if (!confirmDeleteApp || !profile) return;
    const target = confirmDeleteApp;
    setConfirmDeleteApp(null);
    setDeletingId(target.id);
    setDeleteError(null);
    try {
      await DeleteAppRunSharedApplication(profile, target.id);
      await loadApps();
    } catch (e) {
      setDeleteError(String(e));
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteVersionClick = (version: apprunshared.VersionInfo) => {
    setDeleteError(null);
    setConfirmDeleteVersion(version);
  };

  const handleDeleteVersionCancel = () => {
    setConfirmDeleteVersion(null);
  };

  const handleDeleteVersionConfirm = async () => {
    if (!confirmDeleteVersion || !profile || view.type !== 'detail') return;
    const target = confirmDeleteVersion;
    setConfirmDeleteVersion(null);
    setDeletingId(target.id);
    setDeleteError(null);
    try {
      await DeleteAppRunSharedVersion(profile, view.appId, target.id);
      await loadAppDetail(view.appId);
    } catch (e) {
      setDeleteError(String(e));
    } finally {
      setDeletingId(null);
    }
  };

  const handleTrafficEditOpen = () => {
    setTrafficError(null);
    setTrafficForm(
      traffics.map((t) => ({
        versionName: t.versionName,
        isLatestVersion: t.isLatestVersion,
        percent: String(t.percent),
      }))
    );
  };

  const handleTrafficEditCancel = () => {
    setTrafficForm(null);
    setTrafficError(null);
  };

  const handleTrafficPercentChange = (index: number, value: string) => {
    if (!trafficForm) return;
    setTrafficForm(trafficForm.map((t, i) => (i === index ? { ...t, percent: value } : t)));
  };

  const handleTrafficEditSubmit = async () => {
    if (!trafficForm || !profile || view.type !== 'detail') return;
    const percents = trafficForm.map((t) => parseInt(t.percent, 10));
    if (percents.some(isNaN)) {
      setTrafficError('割合は数値で入力してください');
      return;
    }
    if (percents.reduce((sum, p) => sum + p, 0) !== 100) {
      setTrafficError('割合の合計は100%にしてください');
      return;
    }

    setSavingTraffics(true);
    setTrafficError(null);
    try {
      await UpdateAppRunSharedTraffics(
        profile,
        view.appId,
        trafficForm.map((t, i) => new apprunshared.UpdateTrafficParams({
          versionName: t.versionName,
          isLatestVersion: t.isLatestVersion,
          percent: percents[i],
        }))
      );
      setTrafficForm(null);
      await loadAppDetail(view.appId);
    } catch (e) {
      setTrafficError(String(e));
    } finally {
      setSavingTraffics(false);
    }
  };

  const handleSignUp = async () => {
    setSigningUp(true);
    setSignUpError(null);
    try {
      await CreateAppRunSharedUser(profile);
      await checkUser();
    } catch (e) {
      setSignUpError(String(e));
    } finally {
      setSigningUp(false);
    }
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

  const renderCreateModal = () => {
    if (!createForm) return null;
    return (
      <div className="modal-overlay" onClick={handleCreateCancel} style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
          backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
          padding: '20px', minWidth: '480px', maxWidth: '640px', maxHeight: '85vh', overflowY: 'auto',
        }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>アプリケーションを作成</h3>

          <div className="form-group">
            <label>アプリ名</label>
            <input
              type="text"
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              placeholder="my-app"
              autoFocus
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
            <div className="form-group">
              <label>ポート</label>
              <input
                type="text"
                value={createForm.port}
                onChange={(e) => setCreateForm({ ...createForm, port: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>タイムアウト(秒)</label>
              <input
                type="text"
                value={createForm.timeoutSeconds}
                onChange={(e) => setCreateForm({ ...createForm, timeoutSeconds: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>最小スケール</label>
              <input
                type="text"
                value={createForm.minScale}
                onChange={(e) => setCreateForm({ ...createForm, minScale: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>最大スケール</label>
              <input
                type="text"
                value={createForm.maxScale}
                onChange={(e) => setCreateForm({ ...createForm, maxScale: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label>コンポーネント名</label>
            <input
              type="text"
              value={createForm.componentName}
              onChange={(e) => setCreateForm({ ...createForm, componentName: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>コンテナイメージ</label>
            <input
              type="text"
              value={createForm.image}
              onChange={(e) => setCreateForm({ ...createForm, image: e.target.value })}
              placeholder="docker.io/library/nginx:latest"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
            <div className="form-group">
              <label>最大CPU (vCPU)</label>
              <select
                value={createForm.maxCpu}
                onChange={(e) => setCreateForm({ ...createForm, maxCpu: e.target.value })}
              >
                {MAX_CPU_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>最大メモリ</label>
              <select
                value={createForm.maxMemory}
                onChange={(e) => setCreateForm({ ...createForm, maxMemory: e.target.value })}
              >
                {MAX_MEMORY_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginTop: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ margin: 0 }}>環境変数</label>
              <button className="btn btn-secondary btn-small" onClick={handleEnvVarAdd}>+ 環境変数追加</button>
            </div>
            {createForm.envVars.length === 0 ? (
              <div style={{ color: '#888', fontSize: '0.85rem', marginTop: '0.5rem' }}>環境変数なし</div>
            ) : (
              createForm.envVars.map((e, index) => (
                <div key={index} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
                  <input
                    type="text"
                    value={e.key}
                    onChange={(ev) => handleEnvVarChange(index, 'key', ev.target.value)}
                    placeholder="KEY"
                    style={{ flex: 1 }}
                  />
                  <input
                    type="text"
                    value={e.value}
                    onChange={(ev) => handleEnvVarChange(index, 'value', ev.target.value)}
                    placeholder="値"
                    style={{ flex: 1 }}
                  />
                  <button className="btn btn-danger btn-small" onClick={() => handleEnvVarRemove(index)}>削除</button>
                </div>
              ))
            )}
          </div>

          {createError && (
            <div style={{ marginTop: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>
              エラー: {createError}
            </div>
          )}
          <div className="confirm-actions" style={{ marginTop: '1.5rem' }}>
            <button className="btn btn-secondary" onClick={handleCreateCancel}>キャンセル</button>
            <button
              className="btn btn-primary"
              onClick={handleCreateSubmit}
              disabled={creating || !createForm.name.trim() || !createForm.image.trim()}
            >
              {creating ? '作成中...' : '作成する'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderEditModal = () => {
    if (!editForm) return null;
    return (
      <div className="modal-overlay" onClick={handleEditCancel} style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
          backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
          padding: '20px', minWidth: '360px',
        }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>スケール・タイムアウト設定を編集</h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
            <div className="form-group">
              <label htmlFor="apprun-shared-edit-port">ポート</label>
              <input
                id="apprun-shared-edit-port"
                type="text"
                value={editForm.port}
                onChange={(e) => setEditForm({ ...editForm, port: e.target.value })}
                autoFocus
              />
            </div>
            <div className="form-group">
              <label htmlFor="apprun-shared-edit-timeout">タイムアウト(秒)</label>
              <input
                id="apprun-shared-edit-timeout"
                type="text"
                value={editForm.timeoutSeconds}
                onChange={(e) => setEditForm({ ...editForm, timeoutSeconds: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label htmlFor="apprun-shared-edit-min-scale">最小スケール</label>
              <input
                id="apprun-shared-edit-min-scale"
                type="text"
                value={editForm.minScale}
                onChange={(e) => setEditForm({ ...editForm, minScale: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label htmlFor="apprun-shared-edit-max-scale">最大スケール</label>
              <input
                id="apprun-shared-edit-max-scale"
                type="text"
                value={editForm.maxScale}
                onChange={(e) => setEditForm({ ...editForm, maxScale: e.target.value })}
              />
            </div>
          </div>

          {editError && (
            <div style={{ marginTop: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>
              エラー: {editError}
            </div>
          )}
          <div className="confirm-actions" style={{ marginTop: '1.5rem' }}>
            <button className="btn btn-secondary" onClick={handleEditCancel}>キャンセル</button>
            <button
              className="btn btn-primary"
              onClick={handleEditSubmit}
              disabled={editing}
            >
              {editing ? '保存中...' : '保存する'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderDeleteAppConfirm = () => {
    if (!confirmDeleteApp) return null;
    return (
      <div className="confirm-overlay" onClick={handleDeleteAppCancel}>
        <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
          <p>「{confirmDeleteApp.name}」を削除しますか？</p>
          <div className="confirm-actions">
            <button className="btn btn-secondary" onClick={handleDeleteAppCancel}>キャンセル</button>
            <button className="btn btn-danger" onClick={handleDeleteAppConfirm}>削除する</button>
          </div>
        </div>
      </div>
    );
  };

  const renderDeleteVersionConfirm = () => {
    if (!confirmDeleteVersion) return null;
    return (
      <div className="confirm-overlay" onClick={handleDeleteVersionCancel}>
        <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
          <p>バージョン「{confirmDeleteVersion.name}」を削除しますか？</p>
          <div className="confirm-actions">
            <button className="btn btn-secondary" onClick={handleDeleteVersionCancel}>キャンセル</button>
            <button className="btn btn-danger" onClick={handleDeleteVersionConfirm}>削除する</button>
          </div>
        </div>
      </div>
    );
  };

  const renderTrafficEditModal = () => {
    if (!trafficForm) return null;
    const total = trafficForm.reduce((sum, t) => sum + (parseInt(t.percent, 10) || 0), 0);
    return (
      <div className="modal-overlay" onClick={handleTrafficEditCancel} style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
          backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
          padding: '20px', minWidth: '360px',
        }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>トラフィック分散を編集</h3>

          {trafficForm.map((t, index) => (
            <div key={index} className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label htmlFor={`apprun-shared-traffic-${index}`} style={{ flex: 1, margin: 0, fontFamily: 'monospace' }}>
                {t.isLatestVersion ? '(最新)' : t.versionName}
              </label>
              <input
                id={`apprun-shared-traffic-${index}`}
                type="text"
                value={t.percent}
                onChange={(e) => handleTrafficPercentChange(index, e.target.value)}
                style={{ width: '70px' }}
              />
              <span>%</span>
            </div>
          ))}

          <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: total === 100 ? '#888' : '#ff6b6b' }}>
            合計: {total}%
          </div>

          {trafficError && (
            <div style={{ marginTop: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>
              エラー: {trafficError}
            </div>
          )}
          <div className="confirm-actions" style={{ marginTop: '1.5rem' }}>
            <button className="btn btn-secondary" onClick={handleTrafficEditCancel}>キャンセル</button>
            <button
              className="btn btn-primary"
              onClick={handleTrafficEditSubmit}
              disabled={savingTraffics}
            >
              {savingTraffics ? '保存中...' : '保存する'}
            </button>
          </div>
        </div>
      </div>
    );
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
          <button
            className="btn btn-primary btn-small"
            style={{ marginTop: '1rem' }}
            onClick={handleSignUp}
            disabled={signingUp}
          >
            {signingUp ? '登録中...' : 'AppRun共用型を利用開始する'}
          </button>
          {signUpError && (
            <div style={{ marginTop: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>
              エラー: {signUpError}
            </div>
          )}
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
        </div>

        {deleteError && (
          <div style={{
            marginBottom: '1rem',
            padding: '0.75rem',
            backgroundColor: '#3d1f1f',
            borderRadius: '4px',
            color: '#ff6b6b',
            fontSize: '0.85rem'
          }}>
            エラー: {deleteError}
          </div>
        )}

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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h4 style={{ color: '#00adb5', margin: 0 }}>基本情報</h4>
                <button className="btn btn-secondary btn-small" onClick={handleEditOpen}>編集</button>
              </div>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h4 style={{ color: '#00adb5', margin: 0 }}>トラフィック分散</h4>
                  <button className="btn btn-secondary btn-small" onClick={handleTrafficEditOpen}>編集</button>
                </div>
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
                      <th></th>
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
                        <td>
                          <button
                            className="btn btn-danger btn-small"
                            onClick={() => handleDeleteVersionClick(version)}
                            disabled={deletingId === version.id}
                          >
                            {deletingId === version.id ? '削除中...' : '削除'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : null}
        {renderEditModal()}
        {renderDeleteVersionConfirm()}
        {renderTrafficEditModal()}
      </div>
    );
  }

  // List view
  return (
    <div className="apprun-shared-list">
      <div className="header">
        <h2>AppRun共用型</h2>
        <button className="btn btn-primary btn-small" onClick={handleCreateOpen}>+ アプリ作成</button>
      </div>

      {(error || deleteError) && (
        <div style={{
          marginBottom: '1rem',
          padding: '0.75rem',
          backgroundColor: '#3d1f1f',
          borderRadius: '4px',
          color: '#ff6b6b',
          fontSize: '0.85rem'
        }}>
          エラー: {error || deleteError}
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
              <th></th>
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
                <td>
                  <button
                    className="btn btn-danger btn-small"
                    onClick={(e) => handleDeleteAppClick(e, app)}
                    disabled={deletingId === app.id}
                  >
                    {deletingId === app.id ? '削除中...' : '削除'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {renderCreateModal()}
      {renderDeleteAppConfirm()}
    </div>
  );
}
