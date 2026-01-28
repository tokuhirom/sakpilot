import { useState, useEffect, useCallback } from 'react';
import { GetBills, GetBillDetails } from '../../wailsjs/go/main/App';
import { sakura } from '../../wailsjs/go/models';
import { useGlobalReload } from '../hooks/useGlobalReload';

interface BillListProps {
  profile: string;
  accountId: string;
  memberCode: string;
}

export function BillList({ profile, accountId, memberCode }: BillListProps) {
  const [bills, setBills] = useState<sakura.BillInfo[]>([]);
  const [selectedBill, setSelectedBill] = useState<sakura.BillInfo | null>(null);
  const [details, setDetails] = useState<sakura.BillDetailInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const loadBills = useCallback(async () => {
    if (!profile || !accountId) return;

    setLoading(true);
    try {
      const list = await GetBills(profile, accountId);
      setBills(list || []);
    } catch (err) {
      console.error('[BillList] loadBills error:', err);
      setBills([]);
    } finally {
      setLoading(false);
    }
  }, [profile, accountId]);

  useGlobalReload(loadBills);

  useEffect(() => {
    loadBills();
  }, [loadBills]);

  const handleSelectBill = async (bill: sakura.BillInfo) => {
    setSelectedBill(bill);
    setDetailsLoading(true);
    try {
      const detailList = await GetBillDetails(profile, memberCode, bill.id);
      setDetails(detailList || []);
    } catch (err) {
      console.error('[BillList] loadDetails error:', err);
      setDetails([]);
    } finally {
      setDetailsLoading(false);
    }
  };

  const formatAmount = (amount: number) => {
    return amount.toLocaleString('ja-JP') + ' 円';
  };

  const formatDate = (dateString: string) => {
    // "2024-01" 形式
    const [year, month] = dateString.split('-');
    return `${year}年${month}月`;
  };

  // 詳細表示
  if (selectedBill) {
    return (
      <>
        <div className="header">
          <h2>請求詳細: {formatDate(selectedBill.date)}</h2>
          <button
            className="btn btn-secondary"
            onClick={() => {
              setSelectedBill(null);
              setDetails([]);
            }}
          >
            戻る
          </button>
        </div>

        <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem', background: '#2a2a2a', borderRadius: '8px' }}>
          <table style={{ borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>請求月</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{formatDate(selectedBill.date)}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>合計金額</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left', fontWeight: 'bold', color: '#00adb5' }}>
                  {formatAmount(selectedBill.amount)}
                </td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>状態</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>
                  <span className={`status ${selectedBill.paid ? 'up' : 'draining'}`}>
                    {selectedBill.paid ? '支払い済み' : '未払い'}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3 style={{ color: '#00adb5' }}>明細</h3>
        {detailsLoading ? (
          <div className="loading">読み込み中...</div>
        ) : details.length === 0 ? (
          <div className="empty-state">明細がありません</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>サービス</th>
                <th>説明</th>
                <th>ゾーン</th>
                <th>使用量</th>
                <th>金額</th>
              </tr>
            </thead>
            <tbody>
              {details.map((d, index) => (
                <tr key={index}>
                  <td style={{ textAlign: 'left', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                    {d.serviceClassPath}
                  </td>
                  <td style={{ textAlign: 'left' }}>{d.description || '-'}</td>
                  <td style={{ textAlign: 'left' }}>{d.zone || '-'}</td>
                  <td style={{ textAlign: 'left' }}>{d.formattedUsage || '-'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{formatAmount(d.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </>
    );
  }

  // 一覧表示
  return (
    <>
      <div className="header">
        <h2>請求一覧</h2>
      </div>

      {loading ? (
        <div className="loading">読み込み中...</div>
      ) : bills.length === 0 ? (
        <div className="empty-state">請求データがありません</div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>請求月</th>
              <th>金額</th>
              <th>状態</th>
            </tr>
          </thead>
          <tbody>
            {bills.map((bill) => (
              <tr
                key={bill.id}
                onClick={() => handleSelectBill(bill)}
                style={{ cursor: 'pointer' }}
              >
                <td style={{ textAlign: 'left', fontWeight: 'bold', color: '#00adb5' }}>
                  {formatDate(bill.date)}
                </td>
                <td style={{ textAlign: 'right' }}>{formatAmount(bill.amount)}</td>
                <td style={{ textAlign: 'left' }}>
                  <span className={`status ${bill.paid ? 'up' : 'draining'}`}>
                    {bill.paid ? '支払い済み' : '未払い'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
