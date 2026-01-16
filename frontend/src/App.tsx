import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, NavLink, useParams, useNavigate, Navigate } from 'react-router-dom';
import './App.css';
import {
  GetProfiles,
  GetDefaultProfile,
  GetDefaultZone,
  GetZones,
  GetAuthInfo,
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
}

function AppContent({ profiles, zones, authInfo, loading, onProfileChange }: AppContentProps) {
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

function App() {
  const [profiles, setProfiles] = useState<sakura.ProfileInfo[]>([]);
  const [authInfo, setAuthInfo] = useState<main.AuthInfo | null>(null);
  const [zones, setZones] = useState<sakura.ZoneInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [defaultProfile, setDefaultProfile] = useState('');

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

      // デフォルトプロファイルのアカウント情報を取得
      const auth = await GetAuthInfo(defProfile);
      console.log('[App] auth:', auth);
      setAuthInfo(auth);
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

  // 初期ロード中
  if (loading && profiles.length === 0) {
    return (
      <div className="login-form">
        <h2>SakPilot</h2>
        <div className="loading">読み込み中...</div>
      </div>
    );
  }

  // プロファイルがない場合
  if (profiles.length === 0) {
    return (
      <div className="login-form">
        <h2>SakPilot</h2>
        <div className="empty-state">
          プロファイルが見つかりません。<br />
          usacloud を設定してください。
        </div>
      </div>
    );
  }

  return (
    <HashRouter>
      <Routes>
        <Route path="/:profile/*" element={
          <AppContent
            profiles={profiles}
            zones={zones}
            authInfo={authInfo}
            loading={loading}
            onProfileChange={handleProfileChange}
          />
        } />
        <Route path="*" element={<Navigate to={`/${defaultProfile}/servers`} replace />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
