import { useState, useEffect, useCallback } from 'react';
import {
  GetEventBusProcessConfigurations,
  CreateEventBusProcessConfiguration,
  UpdateEventBusProcessConfiguration,
  DeleteEventBusProcessConfiguration,
  UpdateEventBusProcessConfigurationSacloudAPISecret,
  UpdateEventBusProcessConfigurationSimpleMQSecret,
  GetEventBusTriggers,
  CreateEventBusTrigger,
  UpdateEventBusTrigger,
  DeleteEventBusTrigger,
  GetEventBusSchedules,
  CreateEventBusSchedule,
  UpdateEventBusSchedule,
  DeleteEventBusSchedule,
} from '../../wailsjs/go/main/App';
import { eventbus } from '../../wailsjs/go/models';
import { useGlobalReload } from '../hooks/useGlobalReload';

interface EventBusListProps {
  profile: string;
}

type SubPage = 'processConfigurations' | 'triggers' | 'schedules';

const TAB_LABEL: Record<SubPage, string> = {
  processConfigurations: '実行設定',
  triggers: 'トリガー',
  schedules: 'スケジュール',
};

const DESTINATION_LABEL: Record<string, string> = {
  simplenotification: '簡易通知',
  simplemq: 'SimpleMQ',
  autoscale: 'オートスケール',
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

const formatMillis = (millisString: string) => {
  const ms = Number(millisString);
  if (!millisString || isNaN(ms)) return '-';
  return formatDate(new Date(ms).toISOString());
};

const millisToDatetimeLocal = (millisString: string) => {
  const ms = Number(millisString);
  if (!millisString || isNaN(ms)) return '';
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const parseTags = (value: string) => value.split(',').map(t => t.trim()).filter(t => t);

interface PCFormState {
  id: string | null;
  name: string;
  description: string;
  destination: string;
  groupId: string;
  message: string;
  queueName: string;
  content: string;
  action: string;
  resourceId: string;
  tags: string;
}

const emptyPCForm: PCFormState = {
  id: null, name: '', description: '', destination: 'simplemq',
  groupId: '', message: '', queueName: '', content: '', action: 'scale_up', resourceId: '', tags: '',
};

function buildParameters(form: PCFormState): string {
  switch (form.destination) {
    case 'simplenotification':
      return JSON.stringify({ group_id: form.groupId, message: form.message });
    case 'autoscale':
      return JSON.stringify({ action: form.action, resource_id: form.resourceId });
    default:
      return JSON.stringify({ queue_name: form.queueName, content: form.content });
  }
}

function parseParameters(destination: string, parameters: string): Partial<PCFormState> {
  let obj: Record<string, string> = {};
  try {
    obj = JSON.parse(parameters || '{}');
  } catch {
    obj = {};
  }
  switch (destination) {
    case 'simplenotification':
      return { groupId: obj.group_id || '', message: obj.message || '' };
    case 'autoscale':
      return { action: obj.action || 'scale_up', resourceId: obj.resource_id || '' };
    default:
      return { queueName: obj.queue_name || '', content: obj.content || '' };
  }
}

interface SecretFormState {
  processConfigurationId: string;
  destination: string;
  apiKey: string;
  accessToken: string;
  accessTokenSecret: string;
}

interface TriggerConditionForm {
  key: string;
  op: string;
  valuesText: string;
}

interface TriggerFormState {
  id: string | null;
  name: string;
  description: string;
  source: string;
  types: string;
  processConfigurationId: string;
  conditions: TriggerConditionForm[];
  tags: string;
}

const emptyTriggerForm: TriggerFormState = {
  id: null, name: '', description: '', source: '', types: '', processConfigurationId: '', conditions: [], tags: '',
};

interface ScheduleFormState {
  id: string | null;
  name: string;
  description: string;
  processConfigurationId: string;
  scheduleType: 'recurring' | 'crontab';
  recurringStep: number;
  recurringUnit: string;
  crontab: string;
  startsAt: string;
  tags: string;
}

const emptyScheduleForm: ScheduleFormState = {
  id: null, name: '', description: '', processConfigurationId: '', scheduleType: 'recurring',
  recurringStep: 10, recurringUnit: 'min', crontab: '', startsAt: '', tags: '',
};

export function EventBusList({ profile }: EventBusListProps) {
  const [subPage, setSubPage] = useState<SubPage>('processConfigurations');
  const [processConfigurations, setProcessConfigurations] = useState<eventbus.ProcessConfigurationInfo[]>([]);
  const [triggers, setTriggers] = useState<eventbus.TriggerInfo[]>([]);
  const [schedules, setSchedules] = useState<eventbus.ScheduleInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [confirmDelete, setConfirmDelete] = useState<{ type: SubPage; id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [pcForm, setPCForm] = useState<PCFormState | null>(null);
  const [triggerForm, setTriggerForm] = useState<TriggerFormState | null>(null);
  const [scheduleForm, setScheduleForm] = useState<ScheduleFormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [secretForm, setSecretForm] = useState<SecretFormState | null>(null);
  const [settingSecret, setSettingSecret] = useState(false);
  const [secretError, setSecretError] = useState<string | null>(null);
  const [secretDone, setSecretDone] = useState(false);

  // トリガー・スケジュールタブは実行設定名を参照して表示するため、
  // 開いているタブに関わらず3リソースをまとめて読み込む
  const loadData = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      const [p, t, s] = await Promise.all([
        GetEventBusProcessConfigurations(profile),
        GetEventBusTriggers(profile),
        GetEventBusSchedules(profile),
      ]);
      setProcessConfigurations(p || []);
      setTriggers(t || []);
      setSchedules(s || []);
    } catch (err) {
      console.error('[EventBusList] loadData error:', err);
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
      if (target.type === 'processConfigurations') {
        await DeleteEventBusProcessConfiguration(profile, target.id);
      } else if (target.type === 'triggers') {
        await DeleteEventBusTrigger(profile, target.id);
      } else {
        await DeleteEventBusSchedule(profile, target.id);
      }
      await loadData();
    } catch (e) {
      alert(`削除に失敗しました: ${e}`);
    } finally {
      setDeleting(null);
    }
  };

  const handlePCSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pcForm) return;
    setSaving(true);
    setFormError(null);
    try {
      const tags = parseTags(pcForm.tags);
      const parameters = buildParameters(pcForm);
      if (pcForm.id) {
        await UpdateEventBusProcessConfiguration(profile, pcForm.id, pcForm.name, pcForm.description, pcForm.destination, parameters, tags);
      } else {
        await CreateEventBusProcessConfiguration(profile, pcForm.name, pcForm.description, pcForm.destination, parameters, tags);
      }
      setPCForm(null);
      await loadData();
    } catch (e) {
      setFormError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleTriggerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!triggerForm) return;
    setSaving(true);
    setFormError(null);
    try {
      const tags = parseTags(triggerForm.tags);
      const types = parseTags(triggerForm.types);
      const conditions = triggerForm.conditions
        .filter(c => c.key)
        .map(c => ({ key: c.key, op: c.op, values: parseTags(c.valuesText) } as eventbus.TriggerConditionInfo));
      if (triggerForm.id) {
        await UpdateEventBusTrigger(profile, triggerForm.id, triggerForm.name, triggerForm.description, triggerForm.source, types, conditions, triggerForm.processConfigurationId, tags);
      } else {
        await CreateEventBusTrigger(profile, triggerForm.name, triggerForm.description, triggerForm.source, types, conditions, triggerForm.processConfigurationId, tags);
      }
      setTriggerForm(null);
      await loadData();
    } catch (e) {
      setFormError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleForm) return;
    setSaving(true);
    setFormError(null);
    try {
      const tags = parseTags(scheduleForm.tags);
      const startsAtMillis = new Date(scheduleForm.startsAt).getTime();
      const recurringStep = scheduleForm.scheduleType === 'recurring' ? scheduleForm.recurringStep : 0;
      const recurringUnit = scheduleForm.scheduleType === 'recurring' ? scheduleForm.recurringUnit : '';
      const crontab = scheduleForm.scheduleType === 'crontab' ? scheduleForm.crontab : '';
      if (scheduleForm.id) {
        await UpdateEventBusSchedule(profile, scheduleForm.id, scheduleForm.name, scheduleForm.description, scheduleForm.processConfigurationId, recurringStep, recurringUnit, crontab, startsAtMillis, tags);
      } else {
        await CreateEventBusSchedule(profile, scheduleForm.name, scheduleForm.description, scheduleForm.processConfigurationId, recurringStep, recurringUnit, crontab, startsAtMillis, tags);
      }
      setScheduleForm(null);
      await loadData();
    } catch (e) {
      setFormError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleSecretSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!secretForm) return;
    setSettingSecret(true);
    setSecretError(null);
    setSecretDone(false);
    try {
      if (secretForm.destination === 'simplemq') {
        await UpdateEventBusProcessConfigurationSimpleMQSecret(profile, secretForm.processConfigurationId, secretForm.apiKey);
      } else {
        await UpdateEventBusProcessConfigurationSacloudAPISecret(profile, secretForm.processConfigurationId, secretForm.accessToken, secretForm.accessTokenSecret);
      }
      setSecretDone(true);
    } catch (e) {
      setSecretError(String(e));
    } finally {
      setSettingSecret(false);
    }
  };

  const pcName = (id: string) => processConfigurations.find(p => p.id === id)?.name || id;

  const renderContent = () => {
    if (loading) return <div className="loading">読み込み中...</div>;
    if (error) return <div className="empty-state">読み込みに失敗しました: {error}</div>;

    if (subPage === 'processConfigurations') {
      if (processConfigurations.length === 0) return <div className="empty-state">実行設定がありません</div>;
      return (
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>名前</th>
              <th>宛先</th>
              <th>パラメータ</th>
              <th>説明</th>
              <th>作成日</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {processConfigurations.map(p => (
              <tr key={p.id}>
                <td style={{ textAlign: 'left' }}>{p.id}</td>
                <td style={{ textAlign: 'left' }}>{p.name}</td>
                <td style={{ textAlign: 'left' }}>{DESTINATION_LABEL[p.destination] || p.destination}</td>
                <td style={{ textAlign: 'left', fontFamily: 'monospace', fontSize: '0.8rem' }}>{p.parameters}</td>
                <td style={{ textAlign: 'left' }}>{p.description || '-'}</td>
                <td style={{ textAlign: 'left' }}>{formatDate(p.createdAt)}</td>
                <td>
                  {(p.destination === 'simplemq' || p.destination === 'autoscale') && (
                    <button
                      className="btn btn-secondary btn-small"
                      style={{ marginRight: '0.5rem' }}
                      onClick={() => {
                        setSecretError(null);
                        setSecretDone(false);
                        setSecretForm({ processConfigurationId: p.id, destination: p.destination, apiKey: '', accessToken: '', accessTokenSecret: '' });
                      }}
                    >
                      シークレット設定
                    </button>
                  )}
                  <button
                    className="btn btn-secondary btn-small"
                    style={{ marginRight: '0.5rem' }}
                    onClick={() => {
                      setFormError(null);
                      setPCForm({
                        ...emptyPCForm,
                        id: p.id, name: p.name, description: p.description, destination: p.destination,
                        tags: (p.tags || []).join(','),
                        ...parseParameters(p.destination, p.parameters),
                      });
                    }}
                  >
                    編集
                  </button>
                  <button
                    className="btn btn-danger btn-small"
                    onClick={() => setConfirmDelete({ type: 'processConfigurations', id: p.id, name: p.name })}
                    disabled={deleting === p.id}
                  >
                    {deleting === p.id ? '削除中...' : '削除'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (subPage === 'triggers') {
      if (triggers.length === 0) return <div className="empty-state">トリガーがありません</div>;
      return (
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>名前</th>
              <th>ソース</th>
              <th>イベント種別</th>
              <th>実行設定</th>
              <th>条件</th>
              <th>説明</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {triggers.map(t => (
              <tr key={t.id}>
                <td style={{ textAlign: 'left' }}>{t.id}</td>
                <td style={{ textAlign: 'left' }}>{t.name}</td>
                <td style={{ textAlign: 'left' }}>{t.source}</td>
                <td style={{ textAlign: 'left' }}>{(t.types || []).join(', ') || '-'}</td>
                <td style={{ textAlign: 'left' }}>{pcName(t.processConfigurationId)}</td>
                <td style={{ textAlign: 'left' }}>{(t.conditions || []).map(c => `${c.key} ${c.op} [${(c.values || []).join(',')}]`).join(' / ') || '-'}</td>
                <td style={{ textAlign: 'left' }}>{t.description || '-'}</td>
                <td>
                  <button
                    className="btn btn-secondary btn-small"
                    style={{ marginRight: '0.5rem' }}
                    onClick={() => {
                      setFormError(null);
                      setTriggerForm({
                        id: t.id, name: t.name, description: t.description, source: t.source,
                        types: (t.types || []).join(','), processConfigurationId: t.processConfigurationId,
                        conditions: (t.conditions || []).map(c => ({ key: c.key, op: c.op, valuesText: (c.values || []).join(',') })),
                        tags: (t.tags || []).join(','),
                      });
                    }}
                  >
                    編集
                  </button>
                  <button
                    className="btn btn-danger btn-small"
                    onClick={() => setConfirmDelete({ type: 'triggers', id: t.id, name: t.name })}
                    disabled={deleting === t.id}
                  >
                    {deleting === t.id ? '削除中...' : '削除'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (schedules.length === 0) return <div className="empty-state">スケジュールがありません</div>;
    return (
      <table className="table">
        <thead>
          <tr>
            <th>ID</th>
            <th>名前</th>
            <th>実行設定</th>
            <th>間隔/Crontab</th>
            <th>開始日時</th>
            <th>説明</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {schedules.map(s => (
            <tr key={s.id}>
              <td style={{ textAlign: 'left' }}>{s.id}</td>
              <td style={{ textAlign: 'left' }}>{s.name}</td>
              <td style={{ textAlign: 'left' }}>{pcName(s.processConfigurationId)}</td>
              <td style={{ textAlign: 'left' }}>{s.crontab ? `crontab: ${s.crontab}` : `${s.recurringStep} ${s.recurringUnit}ごと`}</td>
              <td style={{ textAlign: 'left' }}>{formatMillis(s.startsAt)}</td>
              <td style={{ textAlign: 'left' }}>{s.description || '-'}</td>
              <td>
                <button
                  className="btn btn-secondary btn-small"
                  style={{ marginRight: '0.5rem' }}
                  onClick={() => {
                    setFormError(null);
                    setScheduleForm({
                      id: s.id, name: s.name, description: s.description, processConfigurationId: s.processConfigurationId,
                      scheduleType: s.crontab ? 'crontab' : 'recurring',
                      recurringStep: s.recurringStep || 10, recurringUnit: s.recurringUnit || 'min', crontab: s.crontab,
                      startsAt: millisToDatetimeLocal(s.startsAt), tags: (s.tags || []).join(','),
                    });
                  }}
                >
                  編集
                </button>
                <button
                  className="btn btn-danger btn-small"
                  onClick={() => setConfirmDelete({ type: 'schedules', id: s.id, name: s.name })}
                  disabled={deleting === s.id}
                >
                  {deleting === s.id ? '削除中...' : '削除'}
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
        <h2>イベントバス</h2>
        {subPage === 'processConfigurations' && (
          <button className="btn btn-primary btn-small" onClick={() => { setFormError(null); setPCForm({ ...emptyPCForm }); }}>+ 実行設定作成</button>
        )}
        {subPage === 'triggers' && (
          <button
            className="btn btn-primary btn-small"
            disabled={processConfigurations.length === 0}
            title={processConfigurations.length === 0 ? '先に実行設定を作成してください' : undefined}
            onClick={() => { setFormError(null); setTriggerForm({ ...emptyTriggerForm, processConfigurationId: processConfigurations[0]?.id || '' }); }}
          >
            + トリガー作成
          </button>
        )}
        {subPage === 'schedules' && (
          <button
            className="btn btn-primary btn-small"
            disabled={processConfigurations.length === 0}
            title={processConfigurations.length === 0 ? '先に実行設定を作成してください' : undefined}
            onClick={() => { setFormError(null); setScheduleForm({ ...emptyScheduleForm, processConfigurationId: processConfigurations[0]?.id || '' }); }}
          >
            + スケジュール作成
          </button>
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

      {pcForm && (
        <div className="modal-overlay" onClick={() => setPCForm(null)} style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
            backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
            padding: '20px', minWidth: '320px', maxWidth: '480px',
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>{pcForm.id ? '実行設定編集' : '実行設定作成'}</h3>
            <form onSubmit={handlePCSubmit}>
              <div className="form-group">
                <label>名前<span className="required-mark">*</span></label>
                <input
                  type="text"
                  value={pcForm.name}
                  onChange={(e) => setPCForm({ ...pcForm, name: e.target.value })}
                  placeholder="my-process-configuration"
                  autoFocus
                  required
                />
              </div>
              <div className="form-group">
                <label>宛先<span className="required-mark">*</span></label>
                <select
                  value={pcForm.destination}
                  onChange={(e) => setPCForm({ ...pcForm, destination: e.target.value })}
                  disabled={!!pcForm.id}
                >
                  <option value="simplemq">SimpleMQ</option>
                  <option value="simplenotification">簡易通知</option>
                  <option value="autoscale">オートスケール</option>
                </select>
              </div>
              {pcForm.destination === 'simplenotification' && (
                <>
                  <div className="form-group">
                    <label>通知グループID<span className="required-mark">*</span></label>
                    <input
                      type="text"
                      value={pcForm.groupId}
                      onChange={(e) => setPCForm({ ...pcForm, groupId: e.target.value })}
                      placeholder="簡易通知のグループID"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>メッセージ<span className="required-mark">*</span></label>
                    <input
                      type="text"
                      value={pcForm.message}
                      onChange={(e) => setPCForm({ ...pcForm, message: e.target.value })}
                      placeholder="通知メッセージ"
                      required
                    />
                  </div>
                </>
              )}
              {pcForm.destination === 'simplemq' && (
                <>
                  <div className="form-group">
                    <label>キュー名<span className="required-mark">*</span></label>
                    <input
                      type="text"
                      value={pcForm.queueName}
                      onChange={(e) => setPCForm({ ...pcForm, queueName: e.target.value })}
                      placeholder="SimpleMQのキュー名"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>メッセージ本文<span className="required-mark">*</span></label>
                    <input
                      type="text"
                      value={pcForm.content}
                      onChange={(e) => setPCForm({ ...pcForm, content: e.target.value })}
                      placeholder="送信するメッセージ本文"
                      required
                    />
                  </div>
                </>
              )}
              {pcForm.destination === 'autoscale' && (
                <>
                  <div className="form-group">
                    <label>アクション<span className="required-mark">*</span></label>
                    <select
                      value={pcForm.action}
                      onChange={(e) => setPCForm({ ...pcForm, action: e.target.value })}
                    >
                      <option value="scale_up">スケールアップ</option>
                      <option value="scale_down">スケールダウン</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>対象リソースID<span className="required-mark">*</span></label>
                    <input
                      type="text"
                      value={pcForm.resourceId}
                      onChange={(e) => setPCForm({ ...pcForm, resourceId: e.target.value })}
                      placeholder="101122334455"
                      required
                    />
                  </div>
                </>
              )}
              <div className="form-group">
                <label>説明</label>
                <input
                  type="text"
                  value={pcForm.description}
                  onChange={(e) => setPCForm({ ...pcForm, description: e.target.value })}
                  placeholder="任意"
                />
              </div>
              <div className="form-group">
                <label>タグ</label>
                <input
                  type="text"
                  value={pcForm.tags}
                  onChange={(e) => setPCForm({ ...pcForm, tags: e.target.value })}
                  placeholder="任意(カンマ区切り)"
                />
              </div>
              {formError && (
                <div style={{ marginBottom: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>
                  エラー: {formError}
                </div>
              )}
              <div className="confirm-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setPCForm(null)}>キャンセル</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? '保存中...' : (pcForm.id ? '更新する' : '作成する')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {triggerForm && (
        <div className="modal-overlay" onClick={() => setTriggerForm(null)} style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
            backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
            padding: '20px', minWidth: '320px', maxWidth: '520px',
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>{triggerForm.id ? 'トリガー編集' : 'トリガー作成'}</h3>
            <form onSubmit={handleTriggerSubmit}>
              <div className="form-group">
                <label>名前<span className="required-mark">*</span></label>
                <input
                  type="text"
                  value={triggerForm.name}
                  onChange={(e) => setTriggerForm({ ...triggerForm, name: e.target.value })}
                  placeholder="my-trigger"
                  autoFocus
                  required
                />
              </div>
              <div className="form-group">
                <label>ソース<span className="required-mark">*</span></label>
                <input
                  type="text"
                  value={triggerForm.source}
                  onChange={(e) => setTriggerForm({ ...triggerForm, source: e.target.value })}
                  placeholder="sakuracloud"
                  required
                />
              </div>
              <div className="form-group">
                <label>イベント種別</label>
                <input
                  type="text"
                  value={triggerForm.types}
                  onChange={(e) => setTriggerForm({ ...triggerForm, types: e.target.value })}
                  placeholder="任意(カンマ区切り、例: server.power.on)"
                />
              </div>
              <div className="form-group">
                <label>実行設定<span className="required-mark">*</span></label>
                <select
                  value={triggerForm.processConfigurationId}
                  onChange={(e) => setTriggerForm({ ...triggerForm, processConfigurationId: e.target.value })}
                  required
                >
                  <option value="">選択してください</option>
                  {processConfigurations.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>発火条件</label>
                {triggerForm.conditions.map((cond, i) => (
                  <div key={i} style={{ border: '1px solid #333', borderRadius: '4px', padding: '0.5rem', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <input
                        type="text"
                        value={cond.key}
                        onChange={(e) => {
                          const conditions = [...triggerForm.conditions];
                          conditions[i] = { ...conditions[i], key: e.target.value };
                          setTriggerForm({ ...triggerForm, conditions });
                        }}
                        placeholder="キー"
                        pattern="^(?!data$)[a-z0-9]{1,20}$"
                        title="小文字英数字1〜20文字(dataは不可)"
                        style={{ flex: 1, minWidth: 0, width: 'auto' }}
                      />
                      <select
                        value={cond.op}
                        onChange={(e) => {
                          const conditions = [...triggerForm.conditions];
                          conditions[i] = { ...conditions[i], op: e.target.value };
                          setTriggerForm({ ...triggerForm, conditions });
                        }}
                        style={{ flexShrink: 0, width: 'auto' }}
                      >
                        <option value="eq">一致(eq)</option>
                        <option value="in">いずれかに一致(in)</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input
                        type="text"
                        value={cond.valuesText}
                        onChange={(e) => {
                          const conditions = [...triggerForm.conditions];
                          conditions[i] = { ...conditions[i], valuesText: e.target.value };
                          setTriggerForm({ ...triggerForm, conditions });
                        }}
                        placeholder={cond.op === 'eq' ? '値' : '値(カンマ区切り)'}
                        style={{ flex: 1, minWidth: 0, width: 'auto' }}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary btn-small"
                        onClick={() => {
                          const conditions = triggerForm.conditions.filter((_, idx) => idx !== i);
                          setTriggerForm({ ...triggerForm, conditions });
                        }}
                      >
                        削除
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn btn-secondary btn-small"
                  onClick={() => setTriggerForm({ ...triggerForm, conditions: [...triggerForm.conditions, { key: '', op: 'eq', valuesText: '' }] })}
                >
                  + 条件追加
                </button>
              </div>
              <div className="form-group">
                <label>説明</label>
                <input
                  type="text"
                  value={triggerForm.description}
                  onChange={(e) => setTriggerForm({ ...triggerForm, description: e.target.value })}
                  placeholder="任意"
                />
              </div>
              <div className="form-group">
                <label>タグ</label>
                <input
                  type="text"
                  value={triggerForm.tags}
                  onChange={(e) => setTriggerForm({ ...triggerForm, tags: e.target.value })}
                  placeholder="任意(カンマ区切り)"
                />
              </div>
              {formError && (
                <div style={{ marginBottom: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>
                  エラー: {formError}
                </div>
              )}
              <div className="confirm-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setTriggerForm(null)}>キャンセル</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? '保存中...' : (triggerForm.id ? '更新する' : '作成する')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {scheduleForm && (
        <div className="modal-overlay" onClick={() => setScheduleForm(null)} style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
            backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
            padding: '20px', minWidth: '320px', maxWidth: '480px',
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>{scheduleForm.id ? 'スケジュール編集' : 'スケジュール作成'}</h3>
            <form onSubmit={handleScheduleSubmit}>
              <div className="form-group">
                <label>名前<span className="required-mark">*</span></label>
                <input
                  type="text"
                  value={scheduleForm.name}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, name: e.target.value })}
                  placeholder="my-schedule"
                  autoFocus
                  required
                />
              </div>
              <div className="form-group">
                <label>実行設定<span className="required-mark">*</span></label>
                <select
                  value={scheduleForm.processConfigurationId}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, processConfigurationId: e.target.value })}
                  required
                >
                  <option value="">選択してください</option>
                  {processConfigurations.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>種別<span className="required-mark">*</span></label>
                <select
                  value={scheduleForm.scheduleType}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, scheduleType: e.target.value as 'recurring' | 'crontab' })}
                >
                  <option value="recurring">定期実行(間隔指定)</option>
                  <option value="crontab">Crontab形式</option>
                </select>
              </div>
              {scheduleForm.scheduleType === 'recurring' ? (
                <div className="form-group">
                  <label>実行間隔<span className="required-mark">*</span></label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="number"
                      value={scheduleForm.recurringStep}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, recurringStep: Number(e.target.value) })}
                      min={1}
                      style={{ flex: 1, minWidth: 0, width: 'auto' }}
                      required
                    />
                    <select
                      value={scheduleForm.recurringUnit}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, recurringUnit: e.target.value })}
                      style={{ flexShrink: 0, width: 'auto' }}
                    >
                      <option value="min">分ごと</option>
                      <option value="hour">時間ごと</option>
                      <option value="day">日ごと</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div className="form-group">
                  <label>Crontab<span className="required-mark">*</span></label>
                  <input
                    type="text"
                    value={scheduleForm.crontab}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, crontab: e.target.value })}
                    placeholder="0 0 * * *"
                    required
                  />
                </div>
              )}
              <div className="form-group">
                <label>開始日時<span className="required-mark">*</span></label>
                <input
                  type="datetime-local"
                  value={scheduleForm.startsAt}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, startsAt: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>説明</label>
                <input
                  type="text"
                  value={scheduleForm.description}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, description: e.target.value })}
                  placeholder="任意"
                />
              </div>
              <div className="form-group">
                <label>タグ</label>
                <input
                  type="text"
                  value={scheduleForm.tags}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, tags: e.target.value })}
                  placeholder="任意(カンマ区切り)"
                />
              </div>
              {formError && (
                <div style={{ marginBottom: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>
                  エラー: {formError}
                </div>
              )}
              <div className="confirm-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setScheduleForm(null)}>キャンセル</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? '保存中...' : (scheduleForm.id ? '更新する' : '作成する')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {secretForm && (
        <div className="modal-overlay" onClick={() => setSecretForm(null)} style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
            backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
            padding: '20px', minWidth: '320px', maxWidth: '420px',
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>シークレット設定</h3>
            <form onSubmit={handleSecretSubmit}>
              {secretForm.destination === 'simplemq' ? (
                <div className="form-group">
                  <label>SimpleMQ APIキー<span className="required-mark">*</span></label>
                  <input
                    type="password"
                    value={secretForm.apiKey}
                    onChange={(e) => setSecretForm({ ...secretForm, apiKey: e.target.value })}
                    placeholder="SimpleMQのAPIキー"
                    autoFocus
                    required
                  />
                </div>
              ) : (
                <>
                  <div className="form-group">
                    <label>アクセストークン<span className="required-mark">*</span></label>
                    <input
                      type="text"
                      value={secretForm.accessToken}
                      onChange={(e) => setSecretForm({ ...secretForm, accessToken: e.target.value })}
                      autoFocus
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>アクセストークンシークレット<span className="required-mark">*</span></label>
                    <input
                      type="password"
                      value={secretForm.accessTokenSecret}
                      onChange={(e) => setSecretForm({ ...secretForm, accessTokenSecret: e.target.value })}
                      required
                    />
                  </div>
                </>
              )}
              {secretDone && (
                <div style={{ marginBottom: '1rem', color: '#4caf50', fontSize: '0.85rem' }}>設定しました</div>
              )}
              {secretError && (
                <div style={{ marginBottom: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>
                  エラー: {secretError}
                </div>
              )}
              <div className="confirm-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setSecretForm(null)}>閉じる</button>
                <button type="submit" className="btn btn-primary" disabled={settingSecret}>
                  {settingSecret ? '設定中...' : '設定する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
