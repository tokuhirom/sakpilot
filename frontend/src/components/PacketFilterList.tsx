import { useState, useEffect, useCallback } from 'react';
import { GetPacketFilters } from '../../wailsjs/go/main/App';
import { sakura } from '../../wailsjs/go/models';

interface PacketFilterListProps {
  profile: string;
  zone: string;
  zones: sakura.ZoneInfo[];
  onZoneChange: (zone: string) => void;
  onSelectPacketFilter: (id: string) => void;
}

export function PacketFilterList({ profile, zone, zones, onZoneChange, onSelectPacketFilter }: PacketFilterListProps) {
  const [packetFilters, setPacketFilters] = useState<sakura.PacketFilterInfo[]>([]);
  const [loading, setLoading] = useState(false);

  const loadPacketFilters = useCallback(async () => {
    if (!profile || !zone) return;

    setLoading(true);
    try {
      const list = await GetPacketFilters(profile, zone);
      setPacketFilters(list || []);
    } catch (err) {
      console.error('[PacketFilterList] loadPacketFilters error:', err);
      setPacketFilters([]);
    } finally {
      setLoading(false);
    }
  }, [profile, zone]);

  useEffect(() => {
    loadPacketFilters();
  }, [loadPacketFilters]);

  return (
    <>
      <div className="header">
        <h2>パケットフィルター</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            className="btn-reload"
            onClick={() => loadPacketFilters()}
            disabled={loading}
            title="リロード"
          >
            ↻
          </button>
          <select
            className="zone-select"
            value={zone}
            onChange={(e) => onZoneChange(e.target.value)}
            disabled={loading}
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
      ) : packetFilters.length === 0 ? (
        <div className="empty-state">パケットフィルターがありません</div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>名前</th>
              <th>説明</th>
            </tr>
          </thead>
          <tbody>
            {packetFilters.map((pf) => (
              <tr
                key={pf.id}
                onClick={() => onSelectPacketFilter(pf.id)}
                style={{ cursor: 'pointer' }}
              >
                <td style={{ color: '#00adb5', fontWeight: 'bold' }}>{pf.name}</td>
                <td>{pf.description || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
