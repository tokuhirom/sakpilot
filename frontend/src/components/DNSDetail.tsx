import { useState, useEffect, useCallback } from 'react';
import { GetDNSDetail, UpdateDNS, UpdateDNSRecords } from '../../wailsjs/go/main/App';
import { sakura } from '../../wailsjs/go/models';
import { useGlobalReload } from '../hooks/useGlobalReload';

interface DNSDetailProps {
  profile: string;
  dnsId: string;
}

const RECORD_TYPES = ['A', 'AAAA', 'CNAME', 'ALIAS', 'MX', 'NS', 'TXT', 'SRV', 'CAA', 'PTR'];

type RecordForm = { name: string; type: string; rdata: string; ttl: string };

const emptyRecordForm: RecordForm = { name: '', type: 'A', rdata: '', ttl: '3600' };

const IPV4_PATTERN = '^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(\\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$';

const RDATA_PLACEHOLDER: Record<string, string> = {
  A: '192.0.2.1',
  AAAA: '2001:db8::1',
  CNAME: 'target.example.com.',
  ALIAS: 'target.example.com.',
  MX: '10 mail.example.com.',
  NS: 'ns1.example.com.',
  TXT: 'v=spf1 include:example.com ~all',
  SRV: '10 5 5060 sip.example.com.',
  CAA: '0 issue "letsencrypt.org"',
  PTR: 'host.example.com.',
};

export function DNSDetail({ profile, dnsId }: DNSDetailProps) {
  const [dns, setDns] = useState<sakura.DNSInfo | null>(null);
  const [loading, setLoading] = useState(false);

  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionInput, setDescriptionInput] = useState('');
  const [savingDescription, setSavingDescription] = useState(false);

  const [recordForm, setRecordForm] = useState<RecordForm | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [savingRecords, setSavingRecords] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [confirmDeleteIndex, setConfirmDeleteIndex] = useState<number | null>(null);

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

  const handleDescriptionEditStart = () => {
    setDescriptionInput(dns?.description || '');
    setEditingDescription(true);
  };

  const handleDescriptionCancel = () => {
    setEditingDescription(false);
  };

  const handleDescriptionSave = async () => {
    setSavingDescription(true);
    try {
      const updated = await UpdateDNS(profile, dnsId, descriptionInput);
      setDns(updated);
      setEditingDescription(false);
    } catch (e) {
      alert(`説明の更新に失敗しました: ${e}`);
    } finally {
      setSavingDescription(false);
    }
  };

  const submitRecords = async (records: sakura.DNSRecord[]) => {
    setSavingRecords(true);
    setRecordError(null);
    try {
      const updated = await UpdateDNSRecords(profile, dnsId, records);
      setDns(updated);
      setRecordForm(null);
      setEditingIndex(null);
      return true;
    } catch (e) {
      setRecordError(String(e));
      return false;
    } finally {
      setSavingRecords(false);
    }
  };

  const handleAddRecordOpen = () => {
    setRecordError(null);
    setEditingIndex(null);
    setRecordForm({ ...emptyRecordForm });
  };

  const handleEditRecordOpen = (index: number) => {
    if (!dns) return;
    const r = dns.records[index];
    setRecordError(null);
    setEditingIndex(index);
    setRecordForm({ name: r.name, type: r.type, rdata: r.rdata, ttl: String(r.ttl) });
  };

  const handleRecordFormCancel = () => {
    setRecordForm(null);
    setEditingIndex(null);
    setRecordError(null);
  };

  const handleRecordFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dns || !recordForm) return;
    const ttl = parseInt(recordForm.ttl, 10);
    if (!recordForm.name || !recordForm.rdata || isNaN(ttl)) {
      setRecordError('名前・データ・TTLを正しく入力してください');
      return;
    }
    const newRecord = new sakura.DNSRecord({ name: recordForm.name, type: recordForm.type, rdata: recordForm.rdata, ttl });
    const records = [...dns.records];
    if (editingIndex !== null) {
      records[editingIndex] = newRecord;
    } else {
      records.push(newRecord);
    }
    await submitRecords(records);
  };

  const handleDeleteRecordConfirm = async () => {
    if (!dns || confirmDeleteIndex === null) return;
    const records = dns.records.filter((_, i) => i !== confirmDeleteIndex);
    setConfirmDeleteIndex(null);
    await submitRecords(records);
  };

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
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>
                {editingDescription ? (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                      type="text"
                      value={descriptionInput}
                      onChange={(e) => setDescriptionInput(e.target.value)}
                      autoFocus
                    />
                    <button className="btn btn-primary btn-small" onClick={handleDescriptionSave} disabled={savingDescription}>
                      {savingDescription ? '保存中...' : '保存'}
                    </button>
                    <button className="btn btn-secondary btn-small" onClick={handleDescriptionCancel} disabled={savingDescription}>キャンセル</button>
                  </div>
                ) : (
                  <span style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {dns.description || '-'}
                    <button className="btn btn-secondary btn-small" onClick={handleDescriptionEditStart}>編集</button>
                  </span>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="header">
        <h3 style={{ color: '#00adb5' }}>リソースレコード</h3>
        <button className="btn btn-primary btn-small" onClick={handleAddRecordOpen}>+ レコード追加</button>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>名前</th>
            <th>タイプ</th>
            <th>データ</th>
            <th>TTL</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {dns.records && dns.records.length > 0 ? (
            dns.records
              .map((record, index) => ({ record, index }))
              .sort((a, b) => a.record.name.localeCompare(b.record.name))
              .map(({ record, index }) => (
                <tr key={index}>
                  <td style={{ textAlign: 'left' }}>{record.name}</td>
                  <td style={{ textAlign: 'left' }}>
                    <span className="badge" style={{ backgroundColor: '#2d3748' }}>{record.type}</span>
                  </td>
                  <td style={{ textAlign: 'left', wordBreak: 'break-all' }}>{record.rdata}</td>
                  <td style={{ textAlign: 'left' }}>{record.ttl}</td>
                  <td style={{ textAlign: 'left', whiteSpace: 'nowrap' }}>
                    <button className="btn btn-secondary btn-small" onClick={() => handleEditRecordOpen(index)} style={{ marginRight: '0.5rem' }}>編集</button>
                    <button className="btn btn-danger btn-small" onClick={() => setConfirmDeleteIndex(index)}>削除</button>
                  </td>
                </tr>
              ))
          ) : (
            <tr>
              <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
                レコードが登録されていません
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {recordForm && (
        <div className="modal-overlay" onClick={handleRecordFormCancel} style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
            backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
            padding: '20px', minWidth: '320px', maxWidth: '420px',
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>{editingIndex !== null ? 'レコード編集' : 'レコード追加'}</h3>
            <form onSubmit={handleRecordFormSubmit}>
            <div className="form-group">
              <label>名前<span className="required-mark">*</span></label>
              <input
                type="text"
                value={recordForm.name}
                onChange={(e) => setRecordForm({ ...recordForm, name: e.target.value })}
                placeholder="www (@はゾーン自身)"
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>タイプ</label>
              <select
                value={recordForm.type}
                onChange={(e) => setRecordForm({ ...recordForm, type: e.target.value })}
              >
                {RECORD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>データ<span className="required-mark">*</span></label>
              <input
                type="text"
                value={recordForm.rdata}
                onChange={(e) => setRecordForm({ ...recordForm, rdata: e.target.value })}
                placeholder={RDATA_PLACEHOLDER[recordForm.type] || ''}
                pattern={recordForm.type === 'A' ? IPV4_PATTERN : undefined}
                required
              />
            </div>
            <div className="form-group">
              <label>TTL(秒)<span className="required-mark">*</span></label>
              <input
                type="number"
                value={recordForm.ttl}
                onChange={(e) => setRecordForm({ ...recordForm, ttl: e.target.value })}
                min={10}
                step={1}
                required
              />
            </div>
            {recordError && (
              <div style={{ marginBottom: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>
                エラー: {recordError}
              </div>
            )}
            <div className="confirm-actions">
              <button type="button" className="btn btn-secondary" onClick={handleRecordFormCancel}>キャンセル</button>
              <button type="submit" className="btn btn-primary" disabled={savingRecords}>
                {savingRecords ? '保存中...' : '保存する'}
              </button>
            </div>
            </form>
          </div>
        </div>
      )}

      {confirmDeleteIndex !== null && dns.records[confirmDeleteIndex] && (
        <div className="confirm-overlay" onClick={() => setConfirmDeleteIndex(null)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <p>レコード「{dns.records[confirmDeleteIndex].name}」({dns.records[confirmDeleteIndex].type})を削除しますか？</p>
            <div className="confirm-actions">
              <button className="btn btn-secondary" onClick={() => setConfirmDeleteIndex(null)}>キャンセル</button>
              <button className="btn btn-danger" onClick={handleDeleteRecordConfirm} disabled={savingRecords}>削除する</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
