import { useState, useEffect, useCallback } from 'react';
import {
  GetSimpleNotificationDestinations,
  CreateSimpleNotificationDestination,
  UpdateSimpleNotificationDestination,
  DeleteSimpleNotificationDestination,
  GetSimpleNotificationGroups,
  CreateSimpleNotificationGroup,
  UpdateSimpleNotificationGroup,
  DeleteSimpleNotificationGroup,
  SendSimpleNotificationGroupMessage,
  GetSimpleNotificationRoutings,
  CreateSimpleNotificationRouting,
  UpdateSimpleNotificationRouting,
  DeleteSimpleNotificationRouting,
} from '../../wailsjs/go/main/App';
import { simplenotification } from '../../wailsjs/go/models';
import { useGlobalReload } from '../hooks/useGlobalReload';

interface SimpleNotificationListProps {
  profile: string;
}

type SubPage = 'destinations' | 'groups' | 'routings';

const TAB_LABEL: Record<SubPage, string> = {
  destinations: '送信先',
  groups: 'グループ',
  routings: 'ルーティング',
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString || '-';

  const Y = date.getFullYear();
  const M = String(date.getMonth() + 1).padStart(2, '0');
  const D = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');

  return `${Y}/${M}/${D} ${h}:${m}:${s}`;
};

const parseTags = (value: string) => value.split(',').map(t => t.trim()).filter(t => t);

interface DestinationFormState {
  id: string | null;
  name: string;
  description: string;
  type: string;
  value: string;
  tags: string;
}

const emptyDestinationForm: DestinationFormState = { id: null, name: '', description: '', type: 'email', value: '', tags: '' };

interface GroupFormState {
  id: string | null;
  name: string;
  description: string;
  destinationIds: string[];
  tags: string;
}

const emptyGroupForm: GroupFormState = { id: null, name: '', description: '', destinationIds: [], tags: '' };

interface RoutingFormState {
  id: string | null;
  name: string;
  description: string;
  sourceId: string;
  targetGroupId: string;
  matchLabels: { name: string; value: string }[];
  priorityRank: number;
  tags: string;
}

const emptyRoutingForm: RoutingFormState = {
  id: null, name: '', description: '', sourceId: '', targetGroupId: '',
  matchLabels: [], priorityRank: 1, tags: '',
};

export function SimpleNotificationList({ profile }: SimpleNotificationListProps) {
  const [subPage, setSubPage] = useState<SubPage>('destinations');
  const [destinations, setDestinations] = useState<simplenotification.DestinationInfo[]>([]);
  const [groups, setGroups] = useState<simplenotification.GroupInfo[]>([]);
  const [routings, setRoutings] = useState<simplenotification.RoutingInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [confirmDelete, setConfirmDelete] = useState<{ type: SubPage; id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [destinationForm, setDestinationForm] = useState<DestinationFormState | null>(null);
  const [groupForm, setGroupForm] = useState<GroupFormState | null>(null);
  const [routingForm, setRoutingForm] = useState<RoutingFormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [sendMessageTarget, setSendMessageTarget] = useState<simplenotification.GroupInfo | null>(null);
  const [sendMessageText, setSendMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<string | null>(null);

  // グループタブは送信先名を、ルーティングタブはグループ名を参照して表示するため、
  // 開いているタブに関わらず送信先・グループ・ルーティングをまとめて読み込む
  const loadData = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      const [d, g, r] = await Promise.all([
        GetSimpleNotificationDestinations(profile),
        GetSimpleNotificationGroups(profile),
        GetSimpleNotificationRoutings(profile),
      ]);
      setDestinations(d || []);
      setGroups(g || []);
      setRoutings(r || []);
    } catch (err) {
      console.error('[SimpleNotificationList] loadData error:', err);
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useGlobalReload(loadData);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return;
    const target = confirmDelete;
    setConfirmDelete(null);
    setDeleting(target.id);
    try {
      if (target.type === 'destinations') {
        await DeleteSimpleNotificationDestination(profile, target.id);
      } else if (target.type === 'groups') {
        await DeleteSimpleNotificationGroup(profile, target.id);
      } else {
        await DeleteSimpleNotificationRouting(profile, target.id);
      }
      await loadData();
    } catch (e) {
      alert(`削除に失敗しました: ${e}`);
    } finally {
      setDeleting(null);
    }
  };

  const handleDestinationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!destinationForm) return;
    setSaving(true);
    setFormError(null);
    try {
      const tags = parseTags(destinationForm.tags);
      if (destinationForm.id) {
        await UpdateSimpleNotificationDestination(profile, destinationForm.id, destinationForm.name, destinationForm.description, destinationForm.type, destinationForm.value, tags);
      } else {
        await CreateSimpleNotificationDestination(profile, destinationForm.name, destinationForm.description, destinationForm.type, destinationForm.value, tags);
      }
      setDestinationForm(null);
      await loadData();
    } catch (e) {
      setFormError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupForm) return;
    setSaving(true);
    setFormError(null);
    try {
      const tags = parseTags(groupForm.tags);
      if (groupForm.id) {
        await UpdateSimpleNotificationGroup(profile, groupForm.id, groupForm.name, groupForm.description, groupForm.destinationIds, tags);
      } else {
        await CreateSimpleNotificationGroup(profile, groupForm.name, groupForm.description, groupForm.destinationIds, tags);
      }
      setGroupForm(null);
      await loadData();
    } catch (e) {
      setFormError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleRoutingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!routingForm) return;
    setSaving(true);
    setFormError(null);
    try {
      const tags = parseTags(routingForm.tags);
      const matchLabels = routingForm.matchLabels.filter(l => l.name && l.value);
      if (routingForm.id) {
        await UpdateSimpleNotificationRouting(profile, routingForm.id, routingForm.name, routingForm.description, routingForm.sourceId, routingForm.targetGroupId, matchLabels, routingForm.priorityRank, tags);
      } else {
        await CreateSimpleNotificationRouting(profile, routingForm.name, routingForm.description, routingForm.sourceId, routingForm.targetGroupId, matchLabels, routingForm.priorityRank, tags);
      }
      setRoutingForm(null);
      await loadData();
    } catch (e) {
      setFormError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sendMessageTarget) return;
    setSending(true);
    setSendError(null);
    setSendResult(null);
    try {
      const ok = await SendSimpleNotificationGroupMessage(profile, sendMessageTarget.id, sendMessageText);
      setSendResult(ok ? '送信しました' : '送信に失敗しました');
    } catch (e) {
      setSendError(String(e));
    } finally {
      setSending(false);
    }
  };

  const destinationName = (id: string) => destinations.find(d => d.id === id)?.name || id;
  const groupName = (id: string) => groups.find(g => g.id === id)?.name || id;

  const renderContent = () => {
    if (loading) return <div className="loading">読み込み中...</div>;
    if (error) return <div className="empty-state">読み込みに失敗しました: {error}</div>;

    if (subPage === 'destinations') {
      if (destinations.length === 0) return <div className="empty-state">送信先がありません</div>;
      return (
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>名前</th>
              <th>種別</th>
              <th>値</th>
              <th>説明</th>
              <th>作成日</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {destinations.map(d => (
              <tr key={d.id}>
                <td style={{ textAlign: 'left' }}>{d.id}</td>
                <td style={{ textAlign: 'left' }}>{d.name}</td>
                <td style={{ textAlign: 'left' }}>{d.type === 'email' ? 'メール' : 'Webhook'}</td>
                <td style={{ textAlign: 'left' }}>{d.value}</td>
                <td style={{ textAlign: 'left' }}>{d.description || '-'}</td>
                <td style={{ textAlign: 'left' }}>{formatDate(d.createdAt)}</td>
                <td>
                  <button
                    className="btn btn-secondary btn-small"
                    style={{ marginRight: '0.5rem' }}
                    onClick={() => {
                      setFormError(null);
                      setDestinationForm({ id: d.id, name: d.name, description: d.description, type: d.type, value: d.value, tags: (d.tags || []).join(',') });
                    }}
                  >
                    編集
                  </button>
                  <button
                    className="btn btn-danger btn-small"
                    onClick={() => setConfirmDelete({ type: 'destinations', id: d.id, name: d.name })}
                    disabled={deleting === d.id}
                  >
                    {deleting === d.id ? '削除中...' : '削除'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (subPage === 'groups') {
      if (groups.length === 0) return <div className="empty-state">グループがありません</div>;
      return (
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>名前</th>
              <th>送信先</th>
              <th>説明</th>
              <th>作成日</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {groups.map(g => (
              <tr key={g.id}>
                <td style={{ textAlign: 'left' }}>{g.id}</td>
                <td style={{ textAlign: 'left' }}>{g.name}</td>
                <td style={{ textAlign: 'left' }}>{(g.destinations || []).map(destinationName).join(', ') || '-'}</td>
                <td style={{ textAlign: 'left' }}>{g.description || '-'}</td>
                <td style={{ textAlign: 'left' }}>{formatDate(g.createdAt)}</td>
                <td>
                  <button
                    className="btn btn-secondary btn-small"
                    style={{ marginRight: '0.5rem' }}
                    onClick={() => {
                      setSendError(null);
                      setSendResult(null);
                      setSendMessageText('');
                      setSendMessageTarget(g);
                    }}
                  >
                    メッセージ送信
                  </button>
                  <button
                    className="btn btn-secondary btn-small"
                    style={{ marginRight: '0.5rem' }}
                    onClick={() => {
                      setFormError(null);
                      setGroupForm({ id: g.id, name: g.name, description: g.description, destinationIds: g.destinations || [], tags: (g.tags || []).join(',') });
                    }}
                  >
                    編集
                  </button>
                  <button
                    className="btn btn-danger btn-small"
                    onClick={() => setConfirmDelete({ type: 'groups', id: g.id, name: g.name })}
                    disabled={deleting === g.id}
                  >
                    {deleting === g.id ? '削除中...' : '削除'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (routings.length === 0) return <div className="empty-state">ルーティングがありません</div>;
    return (
      <table className="table">
        <thead>
          <tr>
            <th>ID</th>
            <th>名前</th>
            <th>ソースID</th>
            <th>マッチラベル</th>
            <th>送信先グループ</th>
            <th>優先度</th>
            <th>説明</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {routings.map(r => (
            <tr key={r.id}>
              <td style={{ textAlign: 'left' }}>{r.id}</td>
              <td style={{ textAlign: 'left' }}>{r.name}</td>
              <td style={{ textAlign: 'left' }}>{r.sourceId}</td>
              <td style={{ textAlign: 'left' }}>{(r.matchLabels || []).map(l => `${l.name}=${l.value}`).join(', ') || '-'}</td>
              <td style={{ textAlign: 'left' }}>{groupName(r.targetGroupId)}</td>
              <td style={{ textAlign: 'left' }}>{r.priorityRank}</td>
              <td style={{ textAlign: 'left' }}>{r.description || '-'}</td>
              <td>
                <button
                  className="btn btn-secondary btn-small"
                  style={{ marginRight: '0.5rem' }}
                  onClick={() => {
                    setFormError(null);
                    setRoutingForm({
                      id: r.id, name: r.name, description: r.description, sourceId: r.sourceId,
                      targetGroupId: r.targetGroupId, matchLabels: (r.matchLabels || []).map(l => ({ name: l.name, value: l.value })),
                      priorityRank: r.priorityRank, tags: (r.tags || []).join(','),
                    });
                  }}
                >
                  編集
                </button>
                <button
                  className="btn btn-danger btn-small"
                  onClick={() => setConfirmDelete({ type: 'routings', id: r.id, name: r.name })}
                  disabled={deleting === r.id}
                >
                  {deleting === r.id ? '削除中...' : '削除'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <>
      <div className="header">
        <h2>簡易通知</h2>
        {subPage === 'destinations' && (
          <button className="btn btn-primary btn-small" onClick={() => { setFormError(null); setDestinationForm({ ...emptyDestinationForm }); }}>+ 送信先作成</button>
        )}
        {subPage === 'groups' && (
          <button className="btn btn-primary btn-small" onClick={() => { setFormError(null); setGroupForm({ ...emptyGroupForm }); }}>+ グループ作成</button>
        )}
        {subPage === 'routings' && (
          <button className="btn btn-primary btn-small" onClick={() => { setFormError(null); setRoutingForm({ ...emptyRoutingForm }); }}>+ ルーティング作成</button>
        )}
      </div>

      <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem' }}>
        {(Object.keys(TAB_LABEL) as SubPage[]).map(key => (
          <button
            key={key}
            className={`btn ${subPage === key ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setSubPage(key)}
          >
            {TAB_LABEL[key]}
          </button>
        ))}
      </div>

      {renderContent()}

      {confirmDelete && (
        <div className="confirm-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <p>「{confirmDelete.name}」を削除しますか？</p>
            <p className="confirm-warning">この操作は取り消せません。</p>
            <div className="confirm-actions">
              <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>キャンセル</button>
              <button className="btn btn-danger" onClick={handleDeleteConfirm}>削除する</button>
            </div>
          </div>
        </div>
      )}

      {destinationForm && (
        <div className="modal-overlay" onClick={() => setDestinationForm(null)} style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
            backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
            padding: '20px', minWidth: '320px', maxWidth: '420px',
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>{destinationForm.id ? '送信先編集' : '送信先作成'}</h3>
            <form onSubmit={handleDestinationSubmit}>
              <div className="form-group">
                <label>名前<span className="required-mark">*</span></label>
                <input
                  type="text"
                  value={destinationForm.name}
                  onChange={(e) => setDestinationForm({ ...destinationForm, name: e.target.value })}
                  placeholder="my-destination"
                  autoFocus
                  required
                />
              </div>
              <div className="form-group">
                <label>種別<span className="required-mark">*</span></label>
                <select
                  value={destinationForm.type}
                  onChange={(e) => setDestinationForm({ ...destinationForm, type: e.target.value })}
                >
                  <option value="email">メール</option>
                  <option value="webhook">Webhook</option>
                </select>
              </div>
              <div className="form-group">
                <label>{destinationForm.type === 'email' ? 'メールアドレス' : 'Webhook URL'}<span className="required-mark">*</span></label>
                <input
                  type="text"
                  value={destinationForm.value}
                  onChange={(e) => setDestinationForm({ ...destinationForm, value: e.target.value })}
                  placeholder={destinationForm.type === 'email' ? 'alert@example.com' : 'https://example.com/hook'}
                  required
                />
              </div>
              <div className="form-group">
                <label>説明</label>
                <input
                  type="text"
                  value={destinationForm.description}
                  onChange={(e) => setDestinationForm({ ...destinationForm, description: e.target.value })}
                  placeholder="任意"
                />
              </div>
              <div className="form-group">
                <label>タグ</label>
                <input
                  type="text"
                  value={destinationForm.tags}
                  onChange={(e) => setDestinationForm({ ...destinationForm, tags: e.target.value })}
                  placeholder="任意(カンマ区切り)"
                />
              </div>
              {formError && (
                <div style={{ marginBottom: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>
                  エラー: {formError}
                </div>
              )}
              <div className="confirm-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setDestinationForm(null)}>キャンセル</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? '保存中...' : (destinationForm.id ? '更新する' : '作成する')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {groupForm && (
        <div className="modal-overlay" onClick={() => setGroupForm(null)} style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
            backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
            padding: '20px', minWidth: '320px', maxWidth: '420px',
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>{groupForm.id ? 'グループ編集' : 'グループ作成'}</h3>
            <form onSubmit={handleGroupSubmit}>
              <div className="form-group">
                <label>名前<span className="required-mark">*</span></label>
                <input
                  type="text"
                  value={groupForm.name}
                  onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                  placeholder="my-group"
                  autoFocus
                  required
                />
              </div>
              <div className="form-group">
                <label>送信先</label>
                {destinations.length === 0 ? (
                  <div style={{ fontSize: '0.8rem', color: '#888' }}>送信先がありません。先に送信先を作成してください</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxHeight: '160px', overflowY: 'auto' }}>
                    {destinations.map(d => (
                      <label key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'normal' }}>
                        <input
                          type="checkbox"
                          checked={groupForm.destinationIds.includes(d.id)}
                          onChange={(e) => {
                            const ids = e.target.checked
                              ? [...groupForm.destinationIds, d.id]
                              : groupForm.destinationIds.filter(id => id !== d.id);
                            setGroupForm({ ...groupForm, destinationIds: ids });
                          }}
                        />
                        {d.name} ({d.type === 'email' ? 'メール' : 'Webhook'}: {d.value})
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div className="form-group">
                <label>説明</label>
                <input
                  type="text"
                  value={groupForm.description}
                  onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
                  placeholder="任意"
                />
              </div>
              <div className="form-group">
                <label>タグ</label>
                <input
                  type="text"
                  value={groupForm.tags}
                  onChange={(e) => setGroupForm({ ...groupForm, tags: e.target.value })}
                  placeholder="任意(カンマ区切り)"
                />
              </div>
              {formError && (
                <div style={{ marginBottom: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>
                  エラー: {formError}
                </div>
              )}
              <div className="confirm-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setGroupForm(null)}>キャンセル</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? '保存中...' : (groupForm.id ? '更新する' : '作成する')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {routingForm && (
        <div className="modal-overlay" onClick={() => setRoutingForm(null)} style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
            backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
            padding: '20px', minWidth: '320px', maxWidth: '480px',
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>{routingForm.id ? 'ルーティング編集' : 'ルーティング作成'}</h3>
            <form onSubmit={handleRoutingSubmit}>
              <div className="form-group">
                <label>名前<span className="required-mark">*</span></label>
                <input
                  type="text"
                  value={routingForm.name}
                  onChange={(e) => setRoutingForm({ ...routingForm, name: e.target.value })}
                  placeholder="my-routing"
                  autoFocus
                  required
                />
              </div>
              <div className="form-group">
                <label>ソースID<span className="required-mark">*</span></label>
                <input
                  type="text"
                  value={routingForm.sourceId}
                  onChange={(e) => setRoutingForm({ ...routingForm, sourceId: e.target.value })}
                  placeholder="101122334455"
                  pattern="[0-9]{1,12}"
                  title="1〜12桁の数字"
                  required
                />
              </div>
              <div className="form-group">
                <label>送信先グループ<span className="required-mark">*</span></label>
                <select
                  value={routingForm.targetGroupId}
                  onChange={(e) => setRoutingForm({ ...routingForm, targetGroupId: e.target.value })}
                  required
                >
                  <option value="">選択してください</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>マッチラベル</label>
                {routingForm.matchLabels.map((label, i) => (
                  <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <input
                      type="text"
                      value={label.name}
                      onChange={(e) => {
                        const labels = [...routingForm.matchLabels];
                        labels[i] = { ...labels[i], name: e.target.value };
                        setRoutingForm({ ...routingForm, matchLabels: labels });
                      }}
                      placeholder="キー"
                      style={{ flex: 1 }}
                    />
                    <input
                      type="text"
                      value={label.value}
                      onChange={(e) => {
                        const labels = [...routingForm.matchLabels];
                        labels[i] = { ...labels[i], value: e.target.value };
                        setRoutingForm({ ...routingForm, matchLabels: labels });
                      }}
                      placeholder="値"
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary btn-small"
                      onClick={() => {
                        const labels = routingForm.matchLabels.filter((_, idx) => idx !== i);
                        setRoutingForm({ ...routingForm, matchLabels: labels });
                      }}
                    >
                      削除
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn btn-secondary btn-small"
                  onClick={() => setRoutingForm({ ...routingForm, matchLabels: [...routingForm.matchLabels, { name: '', value: '' }] })}
                >
                  + ラベル追加
                </button>
              </div>
              <div className="form-group">
                <label>優先度(1〜100)<span className="required-mark">*</span></label>
                <input
                  type="number"
                  value={routingForm.priorityRank}
                  onChange={(e) => setRoutingForm({ ...routingForm, priorityRank: Number(e.target.value) })}
                  min={1}
                  max={100}
                  required
                />
              </div>
              <div className="form-group">
                <label>説明</label>
                <input
                  type="text"
                  value={routingForm.description}
                  onChange={(e) => setRoutingForm({ ...routingForm, description: e.target.value })}
                  placeholder="任意"
                />
              </div>
              <div className="form-group">
                <label>タグ</label>
                <input
                  type="text"
                  value={routingForm.tags}
                  onChange={(e) => setRoutingForm({ ...routingForm, tags: e.target.value })}
                  placeholder="任意(カンマ区切り)"
                />
              </div>
              {formError && (
                <div style={{ marginBottom: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>
                  エラー: {formError}
                </div>
              )}
              <div className="confirm-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setRoutingForm(null)}>キャンセル</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? '保存中...' : (routingForm.id ? '更新する' : '作成する')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {sendMessageTarget && (
        <div className="modal-overlay" onClick={() => setSendMessageTarget(null)} style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
            backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
            padding: '20px', minWidth: '320px', maxWidth: '420px',
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>「{sendMessageTarget.name}」へメッセージ送信</h3>
            <form onSubmit={handleSendMessage}>
              <div className="form-group">
                <label>メッセージ<span className="required-mark">*</span></label>
                <input
                  type="text"
                  value={sendMessageText}
                  onChange={(e) => setSendMessageText(e.target.value)}
                  placeholder="テストメッセージ"
                  maxLength={2048}
                  autoFocus
                  required
                />
              </div>
              {sendResult && (
                <div style={{ marginBottom: '1rem', color: '#4caf50', fontSize: '0.85rem' }}>{sendResult}</div>
              )}
              {sendError && (
                <div style={{ marginBottom: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>
                  エラー: {sendError}
                </div>
              )}
              <div className="confirm-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setSendMessageTarget(null)}>閉じる</button>
                <button type="submit" className="btn btn-primary" disabled={sending}>
                  {sending ? '送信中...' : '送信する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
