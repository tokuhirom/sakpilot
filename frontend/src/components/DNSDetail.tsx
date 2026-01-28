import { useState, useEffect, useCallback } from 'react';
import { GetDNSDetail } from '../../wailsjs/go/main/App';
import { sakura } from '../../wailsjs/go/models';
import { useGlobalReload } from '../hooks/useGlobalReload';

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

  useGlobalReload(loadDNSDetail);

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

      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem', background: '#2a2a2a', borderRadius: '8px' }}>
        <h4 style={{ color: '#00adb5', marginTop: 0, marginBottom: '1rem' }}>基本情報</h4>
        <table style={{ borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>ID</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{dns.id}</td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>ゾーン名</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{dns.zone}</td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>説明</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{dns.description || '-'}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3 style={{ color: '#00adb5' }}>リソースレコード</h3>
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
            [...dns.records].sort((a, b) => a.name.localeCompare(b.name)).map((record, index) => (
              <tr key={index}>
                <td style={{ textAlign: 'left' }}>{record.name}</td>
                <td style={{ textAlign: 'left' }}>
                  <span className="badge" style={{ backgroundColor: '#2d3748' }}>{record.type}</span>
                </td>
                <td style={{ textAlign: 'left', wordBreak: 'break-all' }}>{record.rdata}</td>
                <td style={{ textAlign: 'left' }}>{record.ttl}</td>
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
