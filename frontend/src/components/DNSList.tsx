import { useState, useEffect, useCallback } from 'react';
import { GetDNSList } from '../../wailsjs/go/main/App';
import { sakura } from '../../wailsjs/go/models';

interface DNSListProps {
  profile: string;
}

export function DNSList({ profile }: DNSListProps) {
  const [dnsList, setDnsList] = useState<sakura.DNSInfo[]>([]);
  const [loading, setLoading] = useState(false);

  const loadDNS = useCallback(async () => {
    if (!profile) {
      console.log('[DNSList] loadDNS skipped: profile is empty');
      return;
    }

    console.log('[DNSList] loadDNS called:', { profile });
    setLoading(true);
    try {
      const list = await GetDNSList(profile);
      console.log('[DNSList] DNS loaded:', list?.length ?? 0, 'zones');
      setDnsList(list || []);
    } catch (err) {
      console.error('[DNSList] loadDNS error:', err);
      setDnsList([]);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  // profile が変更されたら DNS 一覧を再取得
  useEffect(() => {
    console.log('[DNSList] useEffect triggered:', { profile });
    loadDNS();
  }, [loadDNS]);

  return (
    <>
      <div className="header">
        <h2>DNS</h2>
      </div>

      {loading ? (
        <div className="loading">読み込み中...</div>
      ) : dnsList.length === 0 ? (
        <div className="empty-state">DNSゾーンがありません</div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>名前</th>
              <th>ゾーン</th>
              <th>説明</th>
            </tr>
          </thead>
          <tbody>
            {dnsList.map((dns) => (
              <tr key={dns.id}>
                <td>{dns.name}</td>
                <td>{dns.zone}</td>
                <td>{dns.description || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
