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

type Page = 'servers' | 'disks' | 'databases' | 'dns' | 'dns-detail' | 'monitors' | 'monitoring';

function App() {
  const [profiles, setProfiles] = useState<sakura.ProfileInfo[]>([]);
  const [currentProfile, setCurrentProfile] = useState('');
  const [authInfo, setAuthInfo] = useState<main.AuthInfo | null>(null);
  const [zones, setZones] = useState<sakura.ZoneInfo[]>([]);
  const [selectedZone, setSelectedZone] = useState('');
  const [currentPage, setCurrentPage] = useState<Page>('servers');
  const [selectedDNSId, setSelectedDNSId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
            {currentProfile}
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

        {authInfo && (
          <div className="auth-info">
            <div className="auth-account">{authInfo.accountName}</div>
            <div className="auth-member">{authInfo.memberCode}</div>
          </div>
        )}

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
            className={`nav-item ${currentPage === 'databases' ? 'active' : ''}`}
            onClick={() => setCurrentPage('databases')}
          >
            データベース
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
        </div>
      </div>

      <div className="main-content">
        <div className="breadcrumb">
          <span 
            className={`breadcrumb-item ${currentPage === 'dns' || currentPage === 'dns-detail' ? 'active' : ''}`}
            onClick={() => {
              if (currentPage === 'dns-detail') {
                setCurrentPage('dns');
              }
            }}
          >
            {currentPage === 'dns' || currentPage === 'dns-detail' ? 'DNS' : 
             currentPage === 'servers' ? 'サーバー' : 
             currentPage === 'disks' ? 'ディスク' : 
             currentPage === 'databases' ? 'データベース' : 
             currentPage === 'monitors' ? 'シンプル監視' : 
             currentPage === 'monitoring' ? 'モニタリングスイート' : ''}
          </span>
          {currentPage === 'dns-detail' && (
            <>
              <span className="breadcrumb-separator">/</span>
              <span className="breadcrumb-item active">詳細</span>
            </>
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

        {currentPage === 'databases' && (
          <DatabaseList
            profile={currentProfile}
            zone={selectedZone}
            zones={zones}
            onZoneChange={setSelectedZone}
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

        {currentPage === 'monitors' && (
          <MonitorList profile={currentProfile} />
        )}
        {currentPage === 'monitoring' && (
          <Monitoring profile={currentProfile} />
        )}
      </div>
    </div>
  );
}

export default App;
