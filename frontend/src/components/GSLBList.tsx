import { useState, useEffect, useCallback } from 'react';
import { GetGSLBList } from '../../wailsjs/go/main/App';
import { sakura } from '../../wailsjs/go/models';

interface GSLBListProps {
  profile: string;
  onSelectGSLB: (id: string) => void;
}

export function GSLBList({ profile, onSelectGSLB }: GSLBListProps) {
  const [gslbList, setGslbList] = useState<sakura.GSLBInfo[]>([]);
  const [loading, setLoading] = useState(false);

  const loadGSLBList = useCallback(async () => {
    if (!profile) {
      return;
    }

    setLoading(true);
    try {
      const list = await GetGSLBList(profile);
      setGslbList(list || []);
    } catch (err) {
      console.error('[GSLBList] loadGSLBList error:', err);
      setGslbList([]);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    loadGSLBList();
  }, [loadGSLBList]);

  return (
    <>
      <div className="header">
        <h2>GSLB</h2>
        <button
          className="btn-reload"
          onClick={() => loadGSLBList()}
          disabled={loading}
          title="リロード"
        >
          ↻
        </button>
      </div>

      {loading ? (
        <div className="loading">読み込み中...</div>
      ) : gslbList.length === 0 ? (
        <div className="empty-state">GSLBがありません</div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>名前</th>
              <th>FQDN</th>
              <th>サーバー数</th>
              <th>Sorry Server</th>
            </tr>
          </thead>
          <tbody>
            {gslbList.map((g) => (
              <tr
                key={g.id}
                onClick={() => onSelectGSLB(g.id)}
                style={{ cursor: 'pointer' }}
              >
                <td style={{ color: '#00adb5', fontWeight: 'bold' }}>{g.name}</td>
                <td>{g.fqdn}</td>
                <td>
                  {g.servers?.length || 0}
                  {g.servers && g.servers.length > 0 && (
                    <span style={{ color: '#888', marginLeft: '0.5rem', fontSize: '0.9em' }}>
                      ({g.servers.filter(s => s.enabled).length} 有効)
                    </span>
                  )}
                </td>
                <td>{g.sorryServer || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
