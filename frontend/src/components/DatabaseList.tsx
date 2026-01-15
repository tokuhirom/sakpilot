import { useState, useEffect, useCallback } from 'react';
import { GetDatabases } from '../../wailsjs/go/main/App';
import { sakura } from '../../wailsjs/go/models';

interface DatabaseListProps {
  profile: string;
  zone: string;
  zones: sakura.ZoneInfo[];
  onZoneChange: (zone: string) => void;
}

export function DatabaseList({ profile, zone, zones, onZoneChange }: DatabaseListProps) {
  const [databases, setDatabases] = useState<sakura.DatabaseInfo[]>([]);
  const [loading, setLoading] = useState(false);

  const loadDatabases = useCallback(async () => {
    if (!profile || !zone) {
      return;
    }

    setLoading(true);
    try {
      const list = await GetDatabases(profile, zone);
      setDatabases(list || []);
    } catch (err) {
      console.error('[DatabaseList] loadDatabases error:', err);
      setDatabases([]);
    } finally {
      setLoading(false);
    }
  }, [profile, zone]);

  useEffect(() => {
    loadDatabases();
  }, [loadDatabases]);

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

  const getPlanName = (planId: string) => {
    // 簡略化したプラン名。実際にはもっと詳細なマッピングが必要かもしれない
    if (planId.includes('10gb')) return '10 GB';
    if (planId.includes('30gb')) return '30 GB';
    if (planId.includes('90gb')) return '90 GB';
    if (planId.includes('240gb')) return '240 GB';
    if (planId.includes('500gb')) return '500 GB';
    if (planId.includes('1tb')) return '1 TB';
    return planId;
  };

  return (
    <>
      <div className="header">
        <h2>データベース</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            className="btn-reload"
            onClick={() => loadDatabases()}
            disabled={loading}
            title="リロード"
          >
            ↻
          </button>
          <select
            className="zone-select"
            value={zone}
            onChange={(e) => onZoneChange(e.target.value)}
          >
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="loading">読み込み中...</div>
      ) : databases.length === 0 ? (
        <div className="empty-state">データベースがありません</div>
      ) : (
        databases.map((db) => (
          <div key={db.id} className="card">
            <div className="card-header">
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div className="card-title">{db.name}</div>
                  <span className={`status ${db.status === 'up' ? 'up' : 'down'}`} style={{ padding: '2px 6px', fontSize: '0.65rem' }}>
                    {db.status}
                  </span>
                </div>
                <div className="card-subtitle" style={{ marginTop: '2px', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span>プラン: {getPlanName(db.planId)}</span>
                  <span style={{ color: '#555' }}>|</span>
                  <span>{db.ipAddresses?.join(', ') || 'No IP'}</span>
                  <span style={{ color: '#555' }}>|</span>
                  <span title={`作成日: ${formatDate(db.createdAt)}`}>
                    作成日: {formatDate(db.createdAt)}
                  </span>
                </div>
                {db.tags && db.tags.length > 0 && (
                  <div className="tags" style={{ marginTop: '0.25rem', display: 'flex', gap: '0.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    {db.tags.map(tag => (
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
                ID: {db.id}
              </div>
            </div>
          </div>
        ))
      )}
    </>
  );
}
