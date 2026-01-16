import { useState, useEffect } from 'react';
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

type Page = 'servers' | 'disks' | 'archives' | 'databases' | 'switches' | 'switch-detail' | 'packetfilters' | 'packetfilter-detail' | 'dns' | 'dns-detail' | 'gslb' | 'gslb-detail' | 'monitors' | 'monitoring' | 'container-registry' | 'container-registry-detail' | 'object-storage' | 'enhanced-db' | 'kms' | 'apprun' | 'bills';

function App() {
  const [profiles, setProfiles] = useState<sakura.ProfileInfo[]>([]);
  const [currentProfile, setCurrentProfile] = useState('');
  const [authInfo, setAuthInfo] = useState<main.AuthInfo | null>(null);
  const [zones, setZones] = useState<sakura.ZoneInfo[]>([]);
  const [selectedZone, setSelectedZone] = useState('');
  const [currentPage, setCurrentPage] = useState<Page>('servers');
  const [selectedDNSId, setSelectedDNSId] = useState<string | null>(null);
  const [selectedGSLBId, setSelectedGSLBId] = useState<string | null>(null);
  const [selectedContainerRegistry, setSelectedContainerRegistry] = useState<sakura.ContainerRegistryInfo | null>(null);
  const [selectedSwitchId, setSelectedSwitchId] = useState<string | null>(null);
  const [selectedPacketFilterId, setSelectedPacketFilterId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Object Storage breadcrumb state
  const [objectStorageSiteName, setObjectStorageSiteName] = useState<string | null>(null);
  const [objectStorageBucketName, setObjectStorageBucketName] = useState<string | null>(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    console.log('[App] loadInitialData started');
    try {
      const [profileList, zoneList, defaultProfile] = await Promise.all([
        GetProfiles(),
        GetZones(),
        GetDefaultProfile(),
      ]);
      console.log('[App] loadInitialData:', { profileList, defaultProfile });
      setProfiles(profileList || []);
      setZones(zoneList);
      setCurrentProfile(defaultProfile);

      // デフォルトゾーンとアカウント情報を取得
      const [defaultZone, auth] = await Promise.all([
        GetDefaultZone(defaultProfile),
        GetAuthInfo(defaultProfile),
      ]);
      console.log('[App] defaultZone:', defaultZone, 'auth:', auth);
      setSelectedZone(defaultZone);
      setAuthInfo(auth);
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchProfile = async (profileName: string) => {
    if (profileName === currentProfile) return;

    console.log('[App] handleSwitchProfile:', profileName);
    setLoading(true);
    try {
      setAuthInfo(null);
      // 詳細ページの状態をクリア
      setSelectedDNSId(null);
      setSelectedGSLBId(null);
      setSelectedContainerRegistry(null);
      setSelectedSwitchId(null);
      setSelectedPacketFilterId(null);
      setObjectStorageSiteName(null);
      setObjectStorageBucketName(null);
      // 詳細ページにいる場合はリストページに戻す
      if (currentPage === 'dns-detail') setCurrentPage('dns');
      else if (currentPage === 'gslb-detail') setCurrentPage('gslb');
      else if (currentPage === 'container-registry-detail') setCurrentPage('container-registry');
      else if (currentPage === 'switch-detail') setCurrentPage('switches');
      else if (currentPage === 'packetfilter-detail') setCurrentPage('packetfilters');

      const [defaultZone, auth] = await Promise.all([
        GetDefaultZone(profileName),
        GetAuthInfo(profileName),
      ]);
      console.log('[App] profile switched:', { profileName, defaultZone, auth });

      setCurrentProfile(profileName);
      setSelectedZone(defaultZone);
      setAuthInfo(auth);
    } catch (e) {
      console.error('[App] handleSwitchProfile error:', e);
      alert(`プロファイル "${profileName}" への切り替えに失敗しました`);
    } finally {
      setLoading(false);
    }
  };

  // 初期ロード中
  if (loading && !currentProfile) {
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
    <div id="app">
      <div className="sidebar">
        <h1>SakPilot</h1>

        <div className="profile-selector">
          <select
            value={currentProfile}
            onChange={(e) => handleSwitchProfile(e.target.value)}
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
          <div
            className={`nav-item ${currentPage === 'servers' ? 'active' : ''}`}
            onClick={() => setCurrentPage('servers')}
          >
            サーバー
          </div>
          <div
            className={`nav-item ${currentPage === 'disks' ? 'active' : ''}`}
            onClick={() => setCurrentPage('disks')}
          >
            ディスク
          </div>
          <div
            className={`nav-item ${currentPage === 'archives' ? 'active' : ''}`}
            onClick={() => setCurrentPage('archives')}
          >
            アーカイブ
          </div>
          <div
            className={`nav-item ${currentPage === 'switches' ? 'active' : ''}`}
            onClick={() => setCurrentPage('switches')}
          >
            スイッチ
          </div>
          <div
            className={`nav-item ${currentPage === 'databases' ? 'active' : ''}`}
            onClick={() => setCurrentPage('databases')}
          >
            データベース
          </div>
          <div
            className={`nav-item ${currentPage === 'packetfilters' ? 'active' : ''}`}
            onClick={() => setCurrentPage('packetfilters')}
          >
            パケットフィルター
          </div>
        </div>

        <div className="nav-section">
          <h3>グローバルリソース</h3>
          <div
            className={`nav-item ${currentPage === 'dns' ? 'active' : ''}`}
            onClick={() => setCurrentPage('dns')}
          >
            DNS
          </div>
          <div
            className={`nav-item ${currentPage === 'gslb' ? 'active' : ''}`}
            onClick={() => setCurrentPage('gslb')}
          >
            GSLB
          </div>
          <div
            className={`nav-item ${currentPage === 'monitors' ? 'active' : ''}`}
            onClick={() => setCurrentPage('monitors')}
          >
            シンプル監視
          </div>
          <div
            className={`nav-item ${currentPage === 'monitoring' ? 'active' : ''}`}
            onClick={() => setCurrentPage('monitoring')}
          >
            モニタリングスイート
          </div>
          <div
            className={`nav-item ${currentPage === 'container-registry' ? 'active' : ''}`}
            onClick={() => setCurrentPage('container-registry')}
          >
            コンテナレジストリ
          </div>
          <div
            className={`nav-item ${currentPage === 'object-storage' ? 'active' : ''}`}
            onClick={() => setCurrentPage('object-storage')}
          >
            オブジェクトストレージ
          </div>
          <div
            className={`nav-item ${currentPage === 'enhanced-db' ? 'active' : ''}`}
            onClick={() => setCurrentPage('enhanced-db')}
          >
            エンハンスドDB
          </div>
          <div
            className={`nav-item ${currentPage === 'kms' ? 'active' : ''}`}
            onClick={() => setCurrentPage('kms')}
          >
            KMS
          </div>
        </div>

        <div className="nav-section">
          <h3>AppRun専有型</h3>
          <div
            className={`nav-item ${currentPage === 'apprun' ? 'active' : ''}`}
            onClick={() => setCurrentPage('apprun')}
          >
            クラスタ
          </div>
        </div>

        <div className="nav-section">
          <h3>アカウント</h3>
          <div
            className={`nav-item ${currentPage === 'bills' ? 'active' : ''}`}
            onClick={() => setCurrentPage('bills')}
          >
            請求
          </div>
        </div>
      </div>

      <div className="main-content">
        <div className="top-bar">
          <div className="breadcrumb">
          <span
            className={`breadcrumb-item ${['dns', 'dns-detail'].includes(currentPage) || ['gslb', 'gslb-detail'].includes(currentPage) || ['container-registry', 'container-registry-detail'].includes(currentPage) || ['switches', 'switch-detail'].includes(currentPage) || ['packetfilters', 'packetfilter-detail'].includes(currentPage) ? '' : 'active'}`}
            onClick={() => {
              if (currentPage === 'dns-detail') setCurrentPage('dns');
              else if (currentPage === 'gslb-detail') setCurrentPage('gslb');
              else if (currentPage === 'container-registry-detail') setCurrentPage('container-registry');
              else if (currentPage === 'switch-detail') setCurrentPage('switches');
              else if (currentPage === 'packetfilter-detail') setCurrentPage('packetfilters');
            }}
            style={{ cursor: ['dns-detail', 'gslb-detail', 'container-registry-detail', 'switch-detail', 'packetfilter-detail'].includes(currentPage) ? 'pointer' : 'default' }}
          >
            {currentPage === 'dns' || currentPage === 'dns-detail' ? 'DNS' :
             currentPage === 'servers' ? 'サーバー' :
             currentPage === 'disks' ? 'ディスク' :
             currentPage === 'archives' ? 'アーカイブ' :
             currentPage === 'switches' || currentPage === 'switch-detail' ? 'スイッチ' :
             currentPage === 'packetfilters' || currentPage === 'packetfilter-detail' ? 'パケットフィルター' :
             currentPage === 'databases' ? 'データベース' :
             currentPage === 'gslb' || currentPage === 'gslb-detail' ? 'GSLB' :
             currentPage === 'monitors' ? 'シンプル監視' :
             currentPage === 'monitoring' ? 'モニタリングスイート' :
             currentPage === 'container-registry' || currentPage === 'container-registry-detail' ? 'コンテナレジストリ' :
             currentPage === 'object-storage' ? 'オブジェクトストレージ' :
             currentPage === 'enhanced-db' ? 'エンハンスドDB' :
             currentPage === 'kms' ? 'KMS' :
             currentPage === 'apprun' ? 'AppRun' :
             currentPage === 'bills' ? '請求' : ''}
          </span>
          {(currentPage === 'dns-detail' || currentPage === 'gslb-detail' || currentPage === 'container-registry-detail' || currentPage === 'switch-detail' || currentPage === 'packetfilter-detail') && (
            <>
              <span className="breadcrumb-separator">/</span>
              <span className="breadcrumb-item active">詳細</span>
            </>
          )}
          {currentPage === 'object-storage' && objectStorageSiteName && (
            <>
              <span className="breadcrumb-separator">/</span>
              <span className={`breadcrumb-item ${objectStorageBucketName ? '' : 'active'}`}>{objectStorageSiteName}</span>
            </>
          )}
          {currentPage === 'object-storage' && objectStorageBucketName && (
            <>
              <span className="breadcrumb-separator">/</span>
              <span className="breadcrumb-item active">{objectStorageBucketName}</span>
            </>
          )}
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

        {currentPage === 'servers' && (
          <ServerList
            profile={currentProfile}
            zone={selectedZone}
            zones={zones}
            onZoneChange={setSelectedZone}
          />
        )}

        {currentPage === 'disks' && (
          <DiskList
            profile={currentProfile}
            zone={selectedZone}
            zones={zones}
            onZoneChange={setSelectedZone}
          />
        )}

        {currentPage === 'archives' && (
          <ArchiveList
            profile={currentProfile}
            zone={selectedZone}
            zones={zones}
            onZoneChange={setSelectedZone}
          />
        )}

        {currentPage === 'databases' && (
          <DatabaseList
            profile={currentProfile}
            zone={selectedZone}
            zones={zones}
            onZoneChange={setSelectedZone}
          />
        )}

        {currentPage === 'switches' && (
          <SwitchList
            profile={currentProfile}
            zone={selectedZone}
            zones={zones}
            onZoneChange={setSelectedZone}
            onSelectSwitch={(id) => {
              setSelectedSwitchId(id);
              setCurrentPage('switch-detail');
            }}
          />
        )}

        {currentPage === 'switch-detail' && selectedSwitchId && (
          <SwitchDetail
            profile={currentProfile}
            zone={selectedZone}
            switchId={selectedSwitchId}
          />
        )}

        {currentPage === 'packetfilters' && (
          <PacketFilterList
            profile={currentProfile}
            zone={selectedZone}
            zones={zones}
            onZoneChange={setSelectedZone}
            onSelectPacketFilter={(id) => {
              setSelectedPacketFilterId(id);
              setCurrentPage('packetfilter-detail');
            }}
          />
        )}

        {currentPage === 'packetfilter-detail' && selectedPacketFilterId && (
          <PacketFilterDetail
            profile={currentProfile}
            zone={selectedZone}
            packetFilterId={selectedPacketFilterId}
          />
        )}

        {currentPage === 'dns' && (
          <DNSList 
            profile={currentProfile} 
            onSelectDNS={(id) => {
              setSelectedDNSId(id);
              setCurrentPage('dns-detail');
            }} 
          />
        )}

        {currentPage === 'dns-detail' && selectedDNSId && (
          <DNSDetail profile={currentProfile} dnsId={selectedDNSId} />
        )}

        {currentPage === 'gslb' && (
          <GSLBList
            profile={currentProfile}
            onSelectGSLB={(id) => {
              setSelectedGSLBId(id);
              setCurrentPage('gslb-detail');
            }}
          />
        )}

        {currentPage === 'gslb-detail' && selectedGSLBId && (
          <GSLBDetail profile={currentProfile} gslbId={selectedGSLBId} />
        )}

        {currentPage === 'monitors' && (
          <MonitorList profile={currentProfile} />
        )}
        {currentPage === 'monitoring' && (
          <Monitoring profile={currentProfile} />
        )}

        {currentPage === 'container-registry' && (
          <ContainerRegistryList
            profile={currentProfile}
            onSelectRegistry={(registry) => {
              setSelectedContainerRegistry(registry);
              setCurrentPage('container-registry-detail');
            }}
          />
        )}

        {currentPage === 'container-registry-detail' && selectedContainerRegistry && (
          <ContainerRegistryDetail
            profile={currentProfile}
            registry={selectedContainerRegistry}
          />
        )}

        {currentPage === 'object-storage' && (
          <ObjectStorageList
            profile={currentProfile}
            onBreadcrumbChange={(siteName, bucketName) => {
              setObjectStorageSiteName(siteName);
              setObjectStorageBucketName(bucketName);
            }}
          />
        )}

        {currentPage === 'enhanced-db' && (
          <EnhancedDBList profile={currentProfile} />
        )}

        {currentPage === 'kms' && (
          <KMSList profile={currentProfile} />
        )}

        {currentPage === 'apprun' && (
          <AppRunList profile={currentProfile} />
        )}

        {currentPage === 'bills' && authInfo && (
          <BillList
            profile={currentProfile}
            accountId={authInfo.accountId}
            memberCode={authInfo.memberCode}
          />
        )}
      </div>
    </div>
  );
}

export default App;
