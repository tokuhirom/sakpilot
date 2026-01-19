import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, NavLink, useParams, useNavigate, Navigate } from 'react-router-dom';
import './App.css';
import {
  GetProfiles,
  GetDefaultProfile,
  GetDefaultZone,
  GetZones,
  GetAuthInfo,
  CreateProfile,
  DeleteProfile,
  UpdateProfile,
  SetCurrentProfile,
  ValidateCredentials,
  GetProfileCredentials,
} from '../wailsjs/go/main/App';
import { sakura, main } from '../wailsjs/go/models';
import { ServerList } from './components/ServerList';
import { DiskList } from './components/DiskList';
import { DNSList } from './components/DNSList';
import { DNSDetail } from './components/DNSDetail';
import { MonitorList } from './components/MonitorList';
import { DatabaseList } from './components/DatabaseList';
import { Monitoring } from './components/Monitoring';
import { AppRunList } from './components/AppRunList';
import { AppRunSharedList } from './components/AppRunSharedList';
import { GSLBList } from './components/GSLBList';
import { GSLBDetail } from './components/GSLBDetail';
import { ContainerRegistryList } from './components/ContainerRegistryList';
import { ContainerRegistryDetail } from './components/ContainerRegistryDetail';
import { SwitchList } from './components/SwitchList';
import { SwitchDetail } from './components/SwitchDetail';
import { PacketFilterList } from './components/PacketFilterList';
import { PacketFilterDetail } from './components/PacketFilterDetail';
import { ArchiveList } from './components/ArchiveList';
import { BillList } from './components/BillList';
import { ObjectStorageList } from './components/ObjectStorageList';
import { EnhancedDBList } from './components/EnhancedDBList';
import { KMSList } from './components/KMSList';
import { ProxyLBList } from './components/ProxyLBList';

// ナビゲーション項目の定義
const zoneResources = [
  { path: 'servers', label: 'サーバー' },
  { path: 'disks', label: 'ディスク' },
  { path: 'archives', label: 'アーカイブ' },
  { path: 'switches', label: 'スイッチ' },
  { path: 'databases', label: 'データベース' },
  { path: 'packetfilters', label: 'パケットフィルター' },
];

const globalResources = [
  { path: 'dns', label: 'DNS' },
  { path: 'gslb', label: 'GSLB' },
  { path: 'elb', label: 'ELB' },
  { path: 'monitors', label: 'シンプル監視' },
  { path: 'monitoring', label: 'モニタリングスイート' },
  { path: 'container-registry', label: 'コンテナレジストリ' },
  { path: 'object-storage', label: 'オブジェクトストレージ' },
  { path: 'enhanced-db', label: 'エンハンスドDB' },
  { path: 'kms', label: 'KMS' },
  { path: 'apprun-shared', label: 'AppRun共用型' },
  { path: 'apprun', label: 'AppRun専有型' },
];

interface AppContentProps {
  profiles: sakura.ProfileInfo[];
  zones: sakura.ZoneInfo[];
  authInfo: main.AuthInfo | null;
  loading: boolean;
  onProfileChange: (profile: string) => Promise<void>;
  onShowProfileModal: () => void;
}

function AppContent({ profiles, zones, authInfo, loading, onProfileChange, onShowProfileModal }: AppContentProps) {
  const { profile } = useParams<{ profile: string }>();
  const navigate = useNavigate();
  const [selectedZone, setSelectedZone] = useState('');

  // プロファイル変更時にデフォルトゾーンを取得
  useEffect(() => {
    if (profile) {
      GetDefaultZone(profile).then(setSelectedZone);
    }
  }, [profile]);

  const handleProfileChange = async (newProfile: string) => {
    if (newProfile === profile) return;
    await onProfileChange(newProfile);
    navigate(`/${newProfile}/servers`);
  };

  if (!profile) {
    return <Navigate to={`/${profiles[0]?.name || 'default'}/servers`} replace />;
  }

  return (
    <div id="app">
      <div className="sidebar">
        <h1>SakPilot</h1>

        <div className="profile-selector">
          <div className="profile-selector-row">
            <select
              value={profile}
              onChange={(e) => handleProfileChange(e.target.value)}
              disabled={loading}
            >
              {profiles.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
            <button
              className="btn-icon profile-manage-btn"
              onClick={onShowProfileModal}
              title="プロファイル管理"
            >
              &#9881;
            </button>
          </div>
        </div>

        <div className="nav-section">
          <h3>ゾーンリソース</h3>
          {zoneResources.map((item) => (
            <NavLink
              key={item.path}
              to={`/${profile}/${item.path}`}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </div>

        <div className="nav-section">
          <h3>グローバルリソース</h3>
          {globalResources.map((item) => (
            <NavLink
              key={item.path}
              to={`/${profile}/${item.path}`}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </div>

        <div className="nav-section">
          <h3>アカウント</h3>
          <NavLink
            to={`/${profile}/bills`}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            請求
          </NavLink>
        </div>
      </div>

      <div className="main-content">
        <div className="top-bar">
          <div className="breadcrumb">
            <Routes>
              <Route path="servers" element={<span className="breadcrumb-item active">サーバー</span>} />
              <Route path="disks" element={<span className="breadcrumb-item active">ディスク</span>} />
              <Route path="archives" element={<span className="breadcrumb-item active">アーカイブ</span>} />
              <Route path="switches" element={<span className="breadcrumb-item active">スイッチ</span>} />
              <Route path="switches/:id" element={<SwitchBreadcrumb profile={profile} />} />
              <Route path="databases" element={<span className="breadcrumb-item active">データベース</span>} />
              <Route path="packetfilters" element={<span className="breadcrumb-item active">パケットフィルター</span>} />
              <Route path="packetfilters/:id" element={<PacketFilterBreadcrumb profile={profile} />} />
              <Route path="dns" element={<span className="breadcrumb-item active">DNS</span>} />
              <Route path="dns/:id" element={<DNSBreadcrumb profile={profile} />} />
              <Route path="gslb" element={<span className="breadcrumb-item active">GSLB</span>} />
              <Route path="gslb/:id" element={<GSLBBreadcrumb profile={profile} />} />
              <Route path="elb" element={<span className="breadcrumb-item active">ELB</span>} />
              <Route path="monitors" element={<span className="breadcrumb-item active">シンプル監視</span>} />
              <Route path="monitoring" element={<span className="breadcrumb-item active">モニタリングスイート</span>} />
              <Route path="container-registry" element={<span className="breadcrumb-item active">コンテナレジストリ</span>} />
              <Route path="container-registry/:id" element={<ContainerRegistryBreadcrumb profile={profile} />} />
              <Route path="object-storage/*" element={<span className="breadcrumb-item active">オブジェクトストレージ</span>} />
              <Route path="enhanced-db" element={<span className="breadcrumb-item active">エンハンスドDB</span>} />
              <Route path="kms" element={<span className="breadcrumb-item active">KMS</span>} />
              <Route path="apprun" element={<span className="breadcrumb-item active">AppRun 専有型</span>} />
              <Route path="apprun-shared" element={<span className="breadcrumb-item active">AppRun 共用型</span>} />
              <Route path="bills" element={<span className="breadcrumb-item active">請求</span>} />
            </Routes>
          </div>
          {loading ? (
            <div className="auth-info">
              <span className="auth-loading">読み込み中...</span>
            </div>
          ) : authInfo && (
            <div className="auth-info">
              <span className="auth-account">{authInfo.accountName}</span>
              <span className="auth-member">{authInfo.memberCode}</span>
            </div>
          )}
        </div>

        <Routes>
          <Route path="servers" element={
            <ServerList profile={profile} zone={selectedZone} zones={zones} onZoneChange={setSelectedZone} />
          } />
          <Route path="disks" element={
            <DiskList profile={profile} zone={selectedZone} zones={zones} onZoneChange={setSelectedZone} />
          } />
          <Route path="archives" element={
            <ArchiveList profile={profile} zone={selectedZone} zones={zones} onZoneChange={setSelectedZone} />
          } />
          <Route path="databases" element={
            <DatabaseList profile={profile} zone={selectedZone} zones={zones} onZoneChange={setSelectedZone} />
          } />
          <Route path="switches" element={
            <SwitchListWrapper profile={profile} zone={selectedZone} zones={zones} onZoneChange={setSelectedZone} />
          } />
          <Route path="switches/:id" element={
            <SwitchDetailWrapper profile={profile} zone={selectedZone} />
          } />
          <Route path="packetfilters" element={
            <PacketFilterListWrapper profile={profile} zone={selectedZone} zones={zones} onZoneChange={setSelectedZone} />
          } />
          <Route path="packetfilters/:id" element={
            <PacketFilterDetailWrapper profile={profile} zone={selectedZone} />
          } />
          <Route path="dns" element={
            <DNSListWrapper profile={profile} />
          } />
          <Route path="dns/:id" element={
            <DNSDetailWrapper profile={profile} />
          } />
          <Route path="gslb" element={
            <GSLBListWrapper profile={profile} />
          } />
          <Route path="gslb/:id" element={
            <GSLBDetailWrapper profile={profile} />
          } />
          <Route path="monitors" element={<MonitorList profile={profile} />} />
          <Route path="monitoring" element={<Monitoring profile={profile} />} />
          <Route path="elb" element={<ProxyLBList profile={profile} />} />
          <Route path="container-registry" element={
            <ContainerRegistryListWrapper profile={profile} />
          } />
          <Route path="container-registry/:id" element={
            <ContainerRegistryDetailWrapper profile={profile} />
          } />
          <Route path="object-storage" element={<ObjectStorageList profile={profile} />} />
          <Route path="enhanced-db" element={<EnhancedDBList profile={profile} />} />
          <Route path="kms" element={<KMSList profile={profile} />} />
          <Route path="apprun" element={<AppRunList profile={profile} />} />
          <Route path="apprun-shared" element={<AppRunSharedList profile={profile} />} />
          <Route path="bills" element={
            authInfo ? (
              <BillList profile={profile} accountId={authInfo.accountId} memberCode={authInfo.memberCode} />
            ) : (
              <div className="loading">読み込み中...</div>
            )
          } />
          <Route path="*" element={<Navigate to="servers" replace />} />
        </Routes>
      </div>
    </div>
  );
}

// Wrapper components for navigation
function SwitchListWrapper({ profile, zone, zones, onZoneChange }: { profile: string; zone: string; zones: sakura.ZoneInfo[]; onZoneChange: (zone: string) => void }) {
  const navigate = useNavigate();
  return (
    <SwitchList
      profile={profile}
      zone={zone}
      zones={zones}
      onZoneChange={onZoneChange}
      onSelectSwitch={(id) => navigate(`/${profile}/switches/${id}`)}
    />
  );
}

function SwitchDetailWrapper({ profile, zone }: { profile: string; zone: string }) {
  const { id } = useParams<{ id: string }>();
  if (!id) return null;
  return <SwitchDetail profile={profile} zone={zone} switchId={id} />;
}

function PacketFilterListWrapper({ profile, zone, zones, onZoneChange }: { profile: string; zone: string; zones: sakura.ZoneInfo[]; onZoneChange: (zone: string) => void }) {
  const navigate = useNavigate();
  return (
    <PacketFilterList
      profile={profile}
      zone={zone}
      zones={zones}
      onZoneChange={onZoneChange}
      onSelectPacketFilter={(id) => navigate(`/${profile}/packetfilters/${id}`)}
    />
  );
}

function PacketFilterDetailWrapper({ profile, zone }: { profile: string; zone: string }) {
  const { id } = useParams<{ id: string }>();
  if (!id) return null;
  return <PacketFilterDetail profile={profile} zone={zone} packetFilterId={id} />;
}

function DNSListWrapper({ profile }: { profile: string }) {
  const navigate = useNavigate();
  return (
    <DNSList
      profile={profile}
      onSelectDNS={(id) => navigate(`/${profile}/dns/${id}`)}
    />
  );
}

function DNSDetailWrapper({ profile }: { profile: string }) {
  const { id } = useParams<{ id: string }>();
  if (!id) return null;
  return <DNSDetail profile={profile} dnsId={id} />;
}

function GSLBListWrapper({ profile }: { profile: string }) {
  const navigate = useNavigate();
  return (
    <GSLBList
      profile={profile}
      onSelectGSLB={(id) => navigate(`/${profile}/gslb/${id}`)}
    />
  );
}

function GSLBDetailWrapper({ profile }: { profile: string }) {
  const { id } = useParams<{ id: string }>();
  if (!id) return null;
  return <GSLBDetail profile={profile} gslbId={id} />;
}

function ContainerRegistryListWrapper({ profile }: { profile: string }) {
  const navigate = useNavigate();
  return (
    <ContainerRegistryList
      profile={profile}
      onSelectRegistry={(registry) => navigate(`/${profile}/container-registry/${registry.id}`)}
    />
  );
}

function ContainerRegistryDetailWrapper({ profile }: { profile: string }) {
  const { id } = useParams<{ id: string }>();

  if (!id) return null;
  return <ContainerRegistryDetail profile={profile} registryId={id} />;
}

// Breadcrumb components
function SwitchBreadcrumb({ profile }: { profile: string }) {
  const navigate = useNavigate();
  return (
    <>
      <span className="breadcrumb-item" style={{ cursor: 'pointer' }} onClick={() => navigate(`/${profile}/switches`)}>
        スイッチ
      </span>
      <span className="breadcrumb-separator">/</span>
      <span className="breadcrumb-item active">詳細</span>
    </>
  );
}

function PacketFilterBreadcrumb({ profile }: { profile: string }) {
  const navigate = useNavigate();
  return (
    <>
      <span className="breadcrumb-item" style={{ cursor: 'pointer' }} onClick={() => navigate(`/${profile}/packetfilters`)}>
        パケットフィルター
      </span>
      <span className="breadcrumb-separator">/</span>
      <span className="breadcrumb-item active">詳細</span>
    </>
  );
}

function DNSBreadcrumb({ profile }: { profile: string }) {
  const navigate = useNavigate();
  return (
    <>
      <span className="breadcrumb-item" style={{ cursor: 'pointer' }} onClick={() => navigate(`/${profile}/dns`)}>
        DNS
      </span>
      <span className="breadcrumb-separator">/</span>
      <span className="breadcrumb-item active">詳細</span>
    </>
  );
}

function GSLBBreadcrumb({ profile }: { profile: string }) {
  const navigate = useNavigate();
  return (
    <>
      <span className="breadcrumb-item" style={{ cursor: 'pointer' }} onClick={() => navigate(`/${profile}/gslb`)}>
        GSLB
      </span>
      <span className="breadcrumb-separator">/</span>
      <span className="breadcrumb-item active">詳細</span>
    </>
  );
}

function ContainerRegistryBreadcrumb({ profile }: { profile: string }) {
  const navigate = useNavigate();
  return (
    <>
      <span className="breadcrumb-item" style={{ cursor: 'pointer' }} onClick={() => navigate(`/${profile}/container-registry`)}>
        コンテナレジストリ
      </span>
      <span className="breadcrumb-separator">/</span>
      <span className="breadcrumb-item active">詳細</span>
    </>
  );
}

// プロファイル作成/編集フォームのProps
interface ProfileFormProps {
  zones: sakura.ZoneInfo[];
  onSuccess: () => void;
  onCancel?: () => void;
  isInitialSetup?: boolean;
  editProfile?: sakura.ProfileInfo; // 編集時に設定
}

// プロファイル作成/編集フォーム
function ProfileForm({ zones, onSuccess, onCancel, isInitialSetup = false, editProfile }: ProfileFormProps) {
  const isEditMode = !!editProfile;
  const [name, setName] = useState(editProfile?.name || '');
  const [accessToken, setAccessToken] = useState('');
  const [accessTokenSecret, setAccessTokenSecret] = useState('');
  const [zone, setZone] = useState(editProfile?.defaultZone || 'is1a');
  const [validating, setValidating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingCredentials, setLoadingCredentials] = useState(false);
  const [error, setError] = useState('');
  const [validated, setValidated] = useState(false);

  // 編集モードの場合、既存の認証情報を読み込む
  useEffect(() => {
    if (isEditMode && editProfile) {
      setLoadingCredentials(true);
      GetProfileCredentials(editProfile.name)
        .then((creds) => {
          setAccessToken(creds.accessToken);
          setAccessTokenSecret(creds.accessTokenSecret);
          if (creds.zone) {
            setZone(creds.zone);
          }
        })
        .catch((e) => {
          setError(`認証情報の読み込みに失敗しました: ${e}`);
        })
        .finally(() => {
          setLoadingCredentials(false);
        });
    }
  }, [isEditMode, editProfile]);

  const validateProfileName = (value: string) => {
    return /^[a-zA-Z0-9_-]+$/.test(value);
  };

  const handleValidate = async () => {
    if (!accessToken || !accessTokenSecret) {
      setError('APIトークンとAPIシークレットを入力してください');
      return;
    }
    setValidating(true);
    setError('');
    try {
      await ValidateCredentials(accessToken, accessTokenSecret);
      setValidated(true);
      setError('');
    } catch {
      setError('認証に失敗しました。トークンとシークレットを確認してください。');
      setValidated(false);
    } finally {
      setValidating(false);
    }
  };

  const handleSubmit = async () => {
    if (!name) {
      setError('プロファイル名を入力してください');
      return;
    }
    if (!validateProfileName(name)) {
      setError('プロファイル名は英数字、ハイフン、アンダースコアのみ使用できます');
      return;
    }
    if (!accessToken || !accessTokenSecret) {
      setError('APIトークンとAPIシークレットを入力してください');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      if (isEditMode) {
        await UpdateProfile(editProfile.name, name, accessToken, accessTokenSecret, zone);
      } else {
        await CreateProfile(name, accessToken, accessTokenSecret, zone);
        // 初期セットアップ時のみ current に設定
        if (isInitialSetup) {
          await SetCurrentProfile(name);
        }
      }
      onSuccess();
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      if (errorMessage.includes('O_EXCL')) {
        setError(`プロファイル "${name}" は既に存在します`);
      } else {
        setError(`プロファイルの${isEditMode ? '更新' : '作成'}に失敗しました: ${errorMessage}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingCredentials) {
    return (
      <div className="profile-form">
        <div className="loading">認証情報を読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="profile-form">
      {isInitialSetup && <p className="form-description">さくらのクラウドのAPI認証情報を入力してください。</p>}
      {error && <div className="error-message">{error}</div>}
      <div className="form-group">
        <label>プロファイル名</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="default"
          disabled={submitting}
        />
        <small>英数字、ハイフン、アンダースコアのみ</small>
      </div>
      <div className="form-group">
        <label>APIトークン</label>
        <input
          type="text"
          value={accessToken}
          onChange={(e) => { setAccessToken(e.target.value); setValidated(false); }}
          placeholder="アクセストークン"
          disabled={submitting}
        />
      </div>
      <div className="form-group">
        <label>APIシークレット</label>
        <input
          type="password"
          value={accessTokenSecret}
          onChange={(e) => { setAccessTokenSecret(e.target.value); setValidated(false); }}
          placeholder="アクセストークンシークレット"
          disabled={submitting}
        />
      </div>
      <div className="form-group">
        <label>デフォルトゾーン</label>
        <select value={zone} onChange={(e) => setZone(e.target.value)} disabled={submitting}>
          {zones.map((z) => (
            <option key={z.id} value={z.id}>{z.name} ({z.id})</option>
          ))}
        </select>
      </div>
      <div className="form-actions">
        <button
          className="btn btn-secondary"
          onClick={handleValidate}
          disabled={validating || submitting || !accessToken || !accessTokenSecret}
        >
          {validating ? '検証中...' : validated ? '認証OK' : '認証テスト'}
        </button>
        <button
          className="btn btn-primary"
          onClick={handleSubmit}
          disabled={submitting || !name || !accessToken || !accessTokenSecret}
        >
          {submitting ? (isEditMode ? '更新中...' : '作成中...') : (isEditMode ? '更新' : '作成')}
        </button>
        {onCancel && (
          <button className="btn btn-secondary" onClick={onCancel} disabled={submitting}>
            キャンセル
          </button>
        )}
      </div>
    </div>
  );
}

// プロファイル管理モーダルのProps
interface ProfileManagementModalProps {
  profiles: sakura.ProfileInfo[];
  zones: sakura.ZoneInfo[];
  currentProfile: string;
  onClose: () => void;
  onProfileCreated: () => void;
  onProfileDeleted: () => void;
  onProfileUpdated: () => void;
}

// プロファイルの認証ステータス
interface ProfileAuthStatus {
  loading: boolean;
  error: boolean;
  accountName?: string;
  memberCode?: string;
}

// プロファイル管理モーダル
function ProfileManagementModal({ profiles, zones, currentProfile, onClose, onProfileCreated, onProfileDeleted, onProfileUpdated }: ProfileManagementModalProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingProfile, setEditingProfile] = useState<sakura.ProfileInfo | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [authStatuses, setAuthStatuses] = useState<Record<string, ProfileAuthStatus>>({});

  const isShowingForm = showCreateForm || editingProfile !== null;

  // 遅延読み込みで各プロファイルの認証ステータスを取得
  useEffect(() => {
    if (isShowingForm) return;

    let cancelled = false;
    const loadAuthStatuses = async () => {
      // 初期状態: すべてloading
      const initialStatuses: Record<string, ProfileAuthStatus> = {};
      for (const p of profiles) {
        initialStatuses[p.name] = { loading: true, error: false };
      }
      setAuthStatuses(initialStatuses);

      // 1秒後から開始
      await new Promise(resolve => setTimeout(resolve, 1000));
      if (cancelled) return;

      // 100msおきに各プロファイルの認証ステータスを取得
      for (const p of profiles) {
        if (cancelled) return;
        try {
          const auth = await GetAuthInfo(p.name);
          if (cancelled) return;
          setAuthStatuses(prev => ({
            ...prev,
            [p.name]: {
              loading: false,
              error: false,
              accountName: auth.accountName,
              memberCode: auth.memberCode,
            },
          }));
        } catch {
          if (cancelled) return;
          setAuthStatuses(prev => ({
            ...prev,
            [p.name]: { loading: false, error: true },
          }));
        }
        // 100ms待機
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    };

    loadAuthStatuses();
    return () => { cancelled = true; };
  }, [profiles, isShowingForm]);

  const handleDelete = async (profileName: string) => {
    if (!confirm(`プロファイル "${profileName}" を削除しますか？この操作は取り消せません。`)) {
      return;
    }
    setDeleting(profileName);
    try {
      await DeleteProfile(profileName);
      onProfileDeleted();
    } catch (e) {
      alert(`削除に失敗しました: ${e}`);
    } finally {
      setDeleting(null);
    }
  };

  const renderAuthStatus = (profileName: string) => {
    const status = authStatuses[profileName];
    if (!status || status.loading) {
      return <span className="profile-auth-status loading">読み込み中...</span>;
    }
    if (status.error) {
      return <span className="profile-auth-status error">認証エラー</span>;
    }
    return (
      <span className="profile-auth-status">
        {status.accountName && <span className="auth-account-name">{status.accountName}</span>}
        {status.memberCode && <span className="auth-member-code">{status.memberCode}</span>}
      </span>
    );
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>プロファイル管理</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          {showCreateForm ? (
            <>
              <h4>新規プロファイル作成</h4>
              <ProfileForm
                zones={zones}
                onSuccess={() => {
                  setShowCreateForm(false);
                  onProfileCreated();
                }}
                onCancel={() => setShowCreateForm(false)}
              />
            </>
          ) : editingProfile ? (
            <>
              <h4>プロファイル編集</h4>
              <ProfileForm
                zones={zones}
                editProfile={editingProfile}
                onSuccess={() => {
                  setEditingProfile(null);
                  onProfileUpdated();
                }}
                onCancel={() => setEditingProfile(null)}
              />
            </>
          ) : (
            <>
              <div className="profile-list-header">
                <span>登録済みプロファイル</span>
                <button className="btn btn-primary btn-small" onClick={() => setShowCreateForm(true)}>
                  + 新規作成
                </button>
              </div>
              <div className="profile-list">
                {profiles.map((p) => (
                  <div key={p.name} className={`profile-item ${p.name === currentProfile ? 'current' : ''}`}>
                    <div className="profile-info">
                      <div className="profile-info-row">
                        <span className="profile-name">{p.name}</span>
                        {p.isCurrent && <span className="badge">current</span>}
                        {p.defaultZone && <span className="profile-zone">{p.defaultZone}</span>}
                      </div>
                      {p.accessTokenPrefix && (
                        <span className="profile-token-prefix">Key: {p.accessTokenPrefix}...</span>
                      )}
                      {renderAuthStatus(p.name)}
                    </div>
                    <div className="profile-actions">
                      <button
                        className="btn btn-secondary btn-small"
                        onClick={() => setEditingProfile(p)}
                        title="編集"
                      >
                        編集
                      </button>
                      <button
                        className="btn btn-danger btn-small"
                        onClick={() => handleDelete(p.name)}
                        disabled={p.name === currentProfile || deleting === p.name}
                        title={p.name === currentProfile ? '使用中のプロファイルは削除できません' : '削除'}
                      >
                        {deleting === p.name ? '削除中...' : '削除'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function App() {
  const [profiles, setProfiles] = useState<sakura.ProfileInfo[]>([]);
  const [authInfo, setAuthInfo] = useState<main.AuthInfo | null>(null);
  const [zones, setZones] = useState<sakura.ZoneInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [defaultProfile, setDefaultProfile] = useState('');
  const [showProfileModal, setShowProfileModal] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    console.log('[App] loadInitialData started');
    try {
      const [profileList, zoneList, defProfile] = await Promise.all([
        GetProfiles(),
        GetZones(),
        GetDefaultProfile(),
      ]);
      console.log('[App] loadInitialData:', { profileList, defProfile });
      setProfiles(profileList || []);
      setZones(zoneList);
      setDefaultProfile(defProfile);

      // プロファイルがある場合のみアカウント情報を取得
      if (profileList && profileList.length > 0) {
        const auth = await GetAuthInfo(defProfile);
        console.log('[App] auth:', auth);
        setAuthInfo(auth);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleProfileChange = async (profileName: string) => {
    console.log('[App] handleProfileChange:', profileName);
    setLoading(true);
    try {
      setAuthInfo(null);
      const auth = await GetAuthInfo(profileName);
      console.log('[App] profile switched:', { profileName, auth });
      setAuthInfo(auth);
    } catch (e) {
      console.error('[App] handleProfileChange error:', e);
      alert(`プロファイル "${profileName}" への切り替えに失敗しました`);
    } finally {
      setLoading(false);
    }
  };

  const handleProfileCreated = async () => {
    setShowProfileModal(false);
    setLoading(true);
    await loadInitialData();
  };

  const handleProfileDeleted = async () => {
    await loadInitialData();
  };

  const handleProfileUpdated = async () => {
    await loadInitialData();
  };

  // 初期ロード中
  if (loading && profiles.length === 0) {
    return (
      <div className="login-form">
        <h2>SakPilot</h2>
        <div className="loading">読み込み中...</div>
      </div>
    );
  }

  // プロファイルがない場合：初期セットアップ画面
  if (profiles.length === 0) {
    return (
      <div className="login-form">
        <h2>SakPilot</h2>
        <h3>初期セットアップ</h3>
        <ProfileForm
          zones={zones}
          onSuccess={loadInitialData}
          isInitialSetup={true}
        />
      </div>
    );
  }

  return (
    <>
      <HashRouter>
        <Routes>
          <Route path="/:profile/*" element={
            <AppContent
              profiles={profiles}
              zones={zones}
              authInfo={authInfo}
              loading={loading}
              onProfileChange={handleProfileChange}
              onShowProfileModal={() => setShowProfileModal(true)}
            />
          } />
          <Route path="*" element={<Navigate to={`/${defaultProfile}/servers`} replace />} />
        </Routes>
      </HashRouter>
      {showProfileModal && (
        <ProfileManagementModal
          profiles={profiles}
          zones={zones}
          currentProfile={defaultProfile}
          onClose={() => setShowProfileModal(false)}
          onProfileCreated={handleProfileCreated}
          onProfileDeleted={handleProfileDeleted}
          onProfileUpdated={handleProfileUpdated}
        />
      )}
    </>
  );
}

export default App;
