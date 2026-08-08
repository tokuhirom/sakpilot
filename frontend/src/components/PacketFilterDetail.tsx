import { useState, useEffect, useCallback } from 'react';
import { GetPacketFilterDetail, UpdatePacketFilter } from '../../wailsjs/go/main/App';
import { sakura } from '../../wailsjs/go/models';
import { useGlobalReload } from '../hooks/useGlobalReload';

interface PacketFilterDetailProps {
  profile: string;
  zone: string;
  packetFilterId: string;
}

const PROTOCOLS = ['tcp', 'udp', 'icmp', 'ip'];
const ACTIONS = ['allow', 'deny'];

type RuleForm = {
  protocol: string;
  sourceNetwork: string;
  sourcePort: string;
  destinationPort: string;
  action: string;
  description: string;
};

const emptyRuleForm: RuleForm = {
  protocol: 'tcp',
  sourceNetwork: '',
  sourcePort: '',
  destinationPort: '',
  action: 'allow',
  description: '',
};

export function PacketFilterDetail({ profile, zone, packetFilterId }: PacketFilterDetailProps) {
  const [pfInfo, setPfInfo] = useState<sakura.PacketFilterInfo | null>(null);
  const [loading, setLoading] = useState(false);

  const [editingBasic, setEditingBasic] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [descriptionInput, setDescriptionInput] = useState('');
  const [savingBasic, setSavingBasic] = useState(false);
  const [basicError, setBasicError] = useState<string | null>(null);

  const [ruleForm, setRuleForm] = useState<RuleForm | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [savingRules, setSavingRules] = useState(false);
  const [ruleError, setRuleError] = useState<string | null>(null);
  const [confirmDeleteIndex, setConfirmDeleteIndex] = useState<number | null>(null);

  const loadPacketFilterDetail = useCallback(async () => {
    if (!profile || !zone || !packetFilterId) return;

    setLoading(true);
    try {
      const detail = await GetPacketFilterDetail(profile, zone, packetFilterId);
      setPfInfo(detail);
    } catch (err) {
      console.error('[PacketFilterDetail] loadPacketFilterDetail error:', err);
    } finally {
      setLoading(false);
    }
  }, [profile, zone, packetFilterId]);

  useGlobalReload(loadPacketFilterDetail);

  useEffect(() => {
    loadPacketFilterDetail();
  }, [loadPacketFilterDetail]);

  const submitUpdate = async (name: string, description: string, rules: sakura.PacketFilterRuleInfo[]) => {
    const updated = await UpdatePacketFilter(profile, zone, packetFilterId, name, description, rules);
    setPfInfo(updated);
    return updated;
  };

  const handleBasicEditStart = () => {
    setNameInput(pfInfo?.name || '');
    setDescriptionInput(pfInfo?.description || '');
    setBasicError(null);
    setEditingBasic(true);
  };

  const handleBasicCancel = () => {
    setEditingBasic(false);
  };

  const handleBasicSave = async () => {
    if (!pfInfo) return;
    setSavingBasic(true);
    setBasicError(null);
    try {
      await submitUpdate(nameInput, descriptionInput, pfInfo.rules || []);
      setEditingBasic(false);
    } catch (e) {
      setBasicError(String(e));
    } finally {
      setSavingBasic(false);
    }
  };

  const submitRules = async (rules: sakura.PacketFilterRuleInfo[]) => {
    if (!pfInfo) return;
    setSavingRules(true);
    setRuleError(null);
    try {
      await submitUpdate(pfInfo.name, pfInfo.description, rules);
      setRuleForm(null);
      setEditingIndex(null);
    } catch (e) {
      setRuleError(String(e));
    } finally {
      setSavingRules(false);
    }
  };

  const handleAddRuleOpen = () => {
    setRuleError(null);
    setEditingIndex(null);
    setRuleForm({ ...emptyRuleForm });
  };

  const handleEditRuleOpen = (index: number) => {
    if (!pfInfo?.rules) return;
    const r = pfInfo.rules[index];
    setRuleError(null);
    setEditingIndex(index);
    setRuleForm({
      protocol: r.protocol,
      sourceNetwork: r.sourceNetwork,
      sourcePort: r.sourcePort,
      destinationPort: r.destinationPort,
      action: r.action,
      description: r.description,
    });
  };

  const handleRuleFormCancel = () => {
    setRuleForm(null);
    setEditingIndex(null);
    setRuleError(null);
  };

  const handleRuleFormSubmit = async () => {
    if (!pfInfo || !ruleForm) return;
    const newRule = new sakura.PacketFilterRuleInfo({
      protocol: ruleForm.protocol,
      sourceNetwork: ruleForm.sourceNetwork,
      sourcePort: ruleForm.sourcePort,
      destinationPort: ruleForm.destinationPort,
      action: ruleForm.action,
      description: ruleForm.description,
    });
    const rules = [...(pfInfo.rules || [])];
    if (editingIndex !== null) {
      rules[editingIndex] = newRule;
    } else {
      rules.push(newRule);
    }
    await submitRules(rules);
  };

  const handleDeleteRuleConfirm = async () => {
    if (!pfInfo?.rules || confirmDeleteIndex === null) return;
    const rules = pfInfo.rules.filter((_, i) => i !== confirmDeleteIndex);
    setConfirmDeleteIndex(null);
    await submitRules(rules);
  };

  const formatAction = (action: string) => {
    switch (action) {
      case 'allow': return { label: '許可', className: 'up' };
      case 'deny': return { label: '拒否', className: 'down' };
      default: return { label: action, className: '' };
    }
  };

  const formatProtocol = (protocol: string) => {
    switch (protocol) {
      case 'tcp': return 'TCP';
      case 'udp': return 'UDP';
      case 'icmp': return 'ICMP';
      case 'ip': return 'IP';
      default: return protocol.toUpperCase();
    }
  };

  if (loading) return <div className="loading">読み込み中...</div>;
  if (!pfInfo) return <div className="empty-state">パケットフィルター情報が見つかりません</div>;

  return (
    <div className="packetfilter-detail">
      <div className="header">
        <h2>パケットフィルター詳細: {pfInfo.name}</h2>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem', background: '#2a2a2a', borderRadius: '8px' }}>
        <h4 style={{ color: '#00adb5', marginTop: 0, marginBottom: '1rem' }}>基本情報</h4>
        <table style={{ borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>ID</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{pfInfo.id}</td>
            </tr>
            {editingBasic ? (
              <>
                <tr>
                  <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>名前</td>
                  <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>
                    <input type="text" value={nameInput} onChange={(e) => setNameInput(e.target.value)} placeholder="名前" autoFocus />
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>説明</td>
                  <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>
                    <input type="text" value={descriptionInput} onChange={(e) => setDescriptionInput(e.target.value)} placeholder="説明" />
                  </td>
                </tr>
                <tr>
                  <td></td>
                  <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>
                    {basicError && (
                      <div style={{ marginBottom: '0.5rem', color: '#ff6b6b', fontSize: '0.85rem' }}>エラー: {basicError}</div>
                    )}
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn btn-primary btn-small" onClick={handleBasicSave} disabled={savingBasic || !nameInput}>
                        {savingBasic ? '保存中...' : '保存'}
                      </button>
                      <button className="btn btn-secondary btn-small" onClick={handleBasicCancel} disabled={savingBasic}>キャンセル</button>
                    </div>
                  </td>
                </tr>
              </>
            ) : (
              <>
                <tr>
                  <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>名前</td>
                  <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>
                    <span style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      {pfInfo.name || '-'}
                      <button className="btn btn-secondary btn-small" onClick={handleBasicEditStart}>編集</button>
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>説明</td>
                  <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{pfInfo.description || '-'}</td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>

      <div className="header">
        <h3 style={{ color: '#00adb5' }}>ルール一覧</h3>
        <button className="btn btn-primary btn-small" onClick={handleAddRuleOpen}>+ ルール追加</button>
      </div>
      {(!pfInfo.rules || pfInfo.rules.length === 0) ? (
        <div className="empty-state">ルールがありません</div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>アクション</th>
              <th>プロトコル</th>
              <th>送信元ネットワーク</th>
              <th>送信元ポート</th>
              <th>宛先ポート</th>
              <th>説明</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pfInfo.rules.map((rule, index) => {
              const action = formatAction(rule.action);
              return (
                <tr key={index}>
                  <td style={{ textAlign: 'left', color: '#888' }}>{index + 1}</td>
                  <td style={{ textAlign: 'left' }}>
                    <span className={`status ${action.className}`}>{action.label}</span>
                  </td>
                  <td style={{ textAlign: 'left', fontFamily: 'monospace' }}>{formatProtocol(rule.protocol)}</td>
                  <td style={{ textAlign: 'left', fontFamily: 'monospace' }}>{rule.sourceNetwork || '*'}</td>
                  <td style={{ textAlign: 'left', fontFamily: 'monospace' }}>{rule.sourcePort || '*'}</td>
                  <td style={{ textAlign: 'left', fontFamily: 'monospace' }}>{rule.destinationPort || '*'}</td>
                  <td style={{ textAlign: 'left' }}>{rule.description || '-'}</td>
                  <td style={{ textAlign: 'left', whiteSpace: 'nowrap' }}>
                    <button className="btn btn-secondary btn-small" onClick={() => handleEditRuleOpen(index)} style={{ marginRight: '0.5rem' }}>編集</button>
                    <button className="btn btn-danger btn-small" onClick={() => setConfirmDeleteIndex(index)}>削除</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {ruleForm && (
        <div className="modal-overlay" onClick={handleRuleFormCancel} style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
            backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
            padding: '20px', minWidth: '320px', maxWidth: '420px',
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>{editingIndex !== null ? 'ルール編集' : 'ルール追加'}</h3>
            <div className="form-group">
              <label>アクション</label>
              <select
                value={ruleForm.action}
                onChange={(e) => setRuleForm({ ...ruleForm, action: e.target.value })}
              >
                {ACTIONS.map((a) => <option key={a} value={a}>{a === 'allow' ? '許可' : '拒否'}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>プロトコル</label>
              <select
                value={ruleForm.protocol}
                onChange={(e) => setRuleForm({ ...ruleForm, protocol: e.target.value })}
              >
                {PROTOCOLS.map((p) => <option key={p} value={p}>{formatProtocol(p)}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>送信元ネットワーク</label>
              <input
                type="text"
                value={ruleForm.sourceNetwork}
                onChange={(e) => setRuleForm({ ...ruleForm, sourceNetwork: e.target.value })}
                placeholder="0.0.0.0/0 (空欄で全て)"
              />
            </div>
            <div className="form-group">
              <label>送信元ポート</label>
              <input
                type="text"
                value={ruleForm.sourcePort}
                onChange={(e) => setRuleForm({ ...ruleForm, sourcePort: e.target.value })}
                placeholder="0-65535 (空欄で全て)"
              />
            </div>
            <div className="form-group">
              <label>宛先ポート</label>
              <input
                type="text"
                value={ruleForm.destinationPort}
                onChange={(e) => setRuleForm({ ...ruleForm, destinationPort: e.target.value })}
                placeholder="80 (空欄で全て)"
              />
            </div>
            <div className="form-group">
              <label>説明</label>
              <input
                type="text"
                value={ruleForm.description}
                onChange={(e) => setRuleForm({ ...ruleForm, description: e.target.value })}
                placeholder="任意"
              />
            </div>
            {ruleError && (
              <div style={{ marginBottom: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>
                エラー: {ruleError}
              </div>
            )}
            <div className="confirm-actions">
              <button className="btn btn-secondary" onClick={handleRuleFormCancel}>キャンセル</button>
              <button className="btn btn-primary" onClick={handleRuleFormSubmit} disabled={savingRules}>
                {savingRules ? '保存中...' : '保存する'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteIndex !== null && pfInfo.rules?.[confirmDeleteIndex] && (
        <div className="confirm-overlay" onClick={() => setConfirmDeleteIndex(null)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <p>ルール #{confirmDeleteIndex + 1} を削除しますか？</p>
            <div className="confirm-actions">
              <button className="btn btn-secondary" onClick={() => setConfirmDeleteIndex(null)}>キャンセル</button>
              <button className="btn btn-danger" onClick={handleDeleteRuleConfirm} disabled={savingRules}>削除する</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
