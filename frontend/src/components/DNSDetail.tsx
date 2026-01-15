import { useState, useEffect, useCallback } from 'react';
import { GetDNSDetail } from '../../wailsjs/go/main/App';
import { sakura } from '../../wailsjs/go/models';

interface DNSDetailProps {
  profile: string;
  dnsId: string;
}

export function DNSDetail({ profile, dnsId }: DNSDetailProps) {
  const [dns, setDns] = useState<sakura.DNSInfo | null>(null);
  const [loading, setLoading] = useState(false);

  const loadDNSDetail = useCallback(async () => {
    if (!profile || !dnsId) return;

    setLoading(true);
    try {
      const detail = await GetDNSDetail(profile, dnsId);
      setDns(detail);
    } catch (err) {
      console.error('[DNSDetail] loadDNSDetail error:', err);
    } finally {
      setLoading(false);
    }
  }, [profile, dnsId]);

  useEffect(() => {
    loadDNSDetail();
  }, [loadDNSDetail]);

  if (loading) return <div className="loading">読み込み中...</div>;
  if (!dns) return <div className="empty-state">DNS情報が見つかりません</div>;

  return (
    <div className="dns-detail">
      <div className="header">
        <h2>DNS詳細: {dns.name}</h2>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '0.5rem', fontSize: '0.9rem' }}>
          <div style={{ color: '#888' }}>ID:</div>
          <div>{dns.id}</div>
          <div style={{ color: '#888' }}>ゾーン名:</div>
          <div>{dns.zone}</div>
          <div style={{ color: '#888' }}>説明:</div>
          <div>{dns.description || '-'}</div>
        </div>
      </div>

      <h3>リソースレコード</h3>
      <table className="table">
        <thead>
          <tr>
            <th>名前</th>
            <th>タイプ</th>
            <th>データ</th>
            <th>TTL</th>
          </tr>
        </thead>
        <tbody>
          {dns.records && dns.records.length > 0 ? (
            dns.records.map((record, index) => (
              <tr key={index}>
                <td>{record.name}</td>
                <td>
                  <span className="badge" style={{ backgroundColor: '#2d3748' }}>{record.type}</span>
                </td>
                <td style={{ wordBreak: 'break-all' }}>{record.rdata}</td>
                <td>{record.ttl}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
                レコードが登録されていません
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
