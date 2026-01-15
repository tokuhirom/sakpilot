import { useState, useEffect, useCallback } from 'react';
import { GetArchives } from '../../wailsjs/go/main/App';
import { sakura } from '../../wailsjs/go/models';

interface ArchiveListProps {
  profile: string;
  zone: string;
  zones: sakura.ZoneInfo[];
  onZoneChange: (zone: string) => void;
}

export function ArchiveList({ profile, zone, zones, onZoneChange }: ArchiveListProps) {
  const [archives, setArchives] = useState<sakura.ArchiveInfo[]>([]);
  const [loading, setLoading] = useState(false);

  const loadArchives = useCallback(async () => {
    if (!profile || !zone) {
      return;
    }

    setLoading(true);
    try {
      const list = await GetArchives(profile, zone);
      setArchives(list || []);
    } catch (err) {
      console.error('[ArchiveList] loadArchives error:', err);
      setArchives([]);
    } finally {
      setLoading(false);
    }
  }, [profile, zone]);

  useEffect(() => {
    loadArchives();
  }, [loadArchives]);

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

  const formatAvailability = (availability: string) => {
    switch (availability) {
      case 'available': return { label: '利用可能', className: 'up' };
      case 'uploading': return { label: 'アップロード中', className: 'draining' };
      case 'failed': return { label: '失敗', className: 'down' };
      case 'migrating': return { label: '移行中', className: 'draining' };
      default: return { label: availability, className: '' };
    }
  };

  return (
    <>
      <div className="header">
        <h2>アーカイブ</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            className="btn-reload"
            onClick={() => loadArchives()}
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
      ) : archives.length === 0 ? (
        <div className="empty-state">アーカイブがありません</div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>名前</th>
              <th>サイズ</th>
              <th>状態</th>
              <th>作成日時</th>
            </tr>
          </thead>
          <tbody>
            {archives.map((archive) => {
              const availability = formatAvailability(archive.availability);
              return (
                <tr key={archive.id}>
                  <td>
                    <div style={{ fontWeight: 'bold', color: '#00adb5' }}>{archive.name}</div>
                    {archive.description && (
                      <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.25rem' }}>
                        {archive.description}
                      </div>
                    )}
                    {archive.tags && archive.tags.length > 0 && (
                      <div style={{ marginTop: '0.25rem', display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                        {archive.tags.map(tag => (
                          <span key={tag} style={{
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
                  </td>
                  <td style={{ textAlign: 'left' }}>{archive.sizeGb} GB</td>
                  <td style={{ textAlign: 'left' }}>
                    <span className={`status ${availability.className}`}>{availability.label}</span>
                  </td>
                  <td style={{ textAlign: 'left' }}>{formatDate(archive.createdAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}
