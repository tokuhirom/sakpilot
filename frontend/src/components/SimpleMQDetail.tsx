import { useState, useEffect, useCallback } from 'react';
import {
  GetSimpleMQQueue,
  ConfigSimpleMQQueue,
  GetSimpleMQMessageCount,
  RotateSimpleMQQueueAPIKey,
  ClearSimpleMQMessages,
  SendSimpleMQMessage,
  ReceiveSimpleMQMessages,
  ExtendSimpleMQMessageTimeout,
  DeleteSimpleMQMessage,
} from '../../wailsjs/go/main/App';
import { simplemq } from '../../wailsjs/go/models';
import { useGlobalReload } from '../hooks/useGlobalReload';

interface SimpleMQDetailProps {
  profile: string;
  queueId: string;
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Invalid Date';

  const Y = date.getFullYear();
  const M = String(date.getMonth() + 1).padStart(2, '0');
  const D = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');

  return `${Y}/${M}/${D} ${h}:${m}:${s}`;
};

const formatEpochMillis = (ms: number) => {
  if (!ms) return '-';
  return formatDate(new Date(ms).toISOString());
};

export function SimpleMQDetail({ profile, queueId }: SimpleMQDetailProps) {
  const [queue, setQueue] = useState<simplemq.QueueInfo | null>(null);
  const [loading, setLoading] = useState(false);

  const [editingBasic, setEditingBasic] = useState(false);
  const [descriptionInput, setDescriptionInput] = useState('');
  const [visibilityTimeoutInput, setVisibilityTimeoutInput] = useState(30);
  const [expireSecondsInput, setExpireSecondsInput] = useState(345600);
  const [tagsInput, setTagsInput] = useState('');
  const [savingBasic, setSavingBasic] = useState(false);
  const [basicError, setBasicError] = useState<string | null>(null);

  const [messageCount, setMessageCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  const [apiKey, setApiKey] = useState('');
  const [rotating, setRotating] = useState(false);
  const [rotateError, setRotateError] = useState<string | null>(null);
  const [justRotated, setJustRotated] = useState(false);

  const [sendContent, setSendContent] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const [messages, setMessages] = useState<simplemq.MessageInfo[]>([]);
  const [receiving, setReceiving] = useState(false);
  const [receiveError, setReceiveError] = useState<string | null>(null);
  const [messageActionId, setMessageActionId] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    if (!profile || !queueId) return;

    setLoading(true);
    try {
      const detail = await GetSimpleMQQueue(profile, queueId);
      setQueue(detail);
    } catch (err) {
      console.error('[SimpleMQDetail] loadQueue error:', err);
    } finally {
      setLoading(false);
    }
  }, [profile, queueId]);

  const loadMessageCount = useCallback(async () => {
    if (!profile || !queueId) return;

    setCountLoading(true);
    try {
      const count = await GetSimpleMQMessageCount(profile, queueId);
      setMessageCount(count);
    } catch (err) {
      console.error('[SimpleMQDetail] loadMessageCount error:', err);
    } finally {
      setCountLoading(false);
    }
  }, [profile, queueId]);

  const loadAll = useCallback(async () => {
    await Promise.all([loadQueue(), loadMessageCount()]);
  }, [loadQueue, loadMessageCount]);

  useGlobalReload(loadAll);

  useEffect(() => {
    loadAll();
    setApiKey('');
    setJustRotated(false);
    setMessages([]);
  }, [loadAll]);

  const handleBasicEditStart = () => {
    if (!queue) return;
    setDescriptionInput(queue.description || '');
    setVisibilityTimeoutInput(queue.visibilityTimeoutSeconds);
    setExpireSecondsInput(queue.expireSeconds);
    setTagsInput((queue.tags || []).join(', '));
    setBasicError(null);
    setEditingBasic(true);
  };

  const handleBasicEditCancel = () => {
    setEditingBasic(false);
    setBasicError(null);
  };

  const handleBasicSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBasic(true);
    setBasicError(null);
    try {
      const tags = tagsInput.split(',').map(t => t.trim()).filter(t => t);
      const updated = await ConfigSimpleMQQueue(profile, queueId, descriptionInput, visibilityTimeoutInput, expireSecondsInput, tags);
      setQueue(updated);
      setEditingBasic(false);
    } catch (e) {
      setBasicError(String(e));
    } finally {
      setSavingBasic(false);
    }
  };

  const handleRotate = async () => {
    setRotating(true);
    setRotateError(null);
    try {
      const key = await RotateSimpleMQQueueAPIKey(profile, queueId);
      setApiKey(key);
      setJustRotated(true);
    } catch (e) {
      setRotateError(String(e));
    } finally {
      setRotating(false);
    }
  };

  const handleClearConfirm = async () => {
    setConfirmClear(false);
    setClearing(true);
    try {
      await ClearSimpleMQMessages(profile, queueId);
      setMessages([]);
      await loadMessageCount();
    } catch (e) {
      alert(`メッセージの全削除に失敗しました: ${e}`);
    } finally {
      setClearing(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!queue) return;
    setSending(true);
    setSendError(null);
    try {
      await SendSimpleMQMessage(profile, queue.name, apiKey, sendContent);
      setSendContent('');
      await loadMessageCount();
    } catch (e) {
      setSendError(String(e));
    } finally {
      setSending(false);
    }
  };

  const handleReceive = async () => {
    if (!queue) return;
    setReceiving(true);
    setReceiveError(null);
    try {
      const received = await ReceiveSimpleMQMessages(profile, queue.name, apiKey);
      setMessages(received || []);
    } catch (e) {
      setReceiveError(String(e));
    } finally {
      setReceiving(false);
    }
  };

  const handleExtendTimeout = async (messageId: string) => {
    if (!queue) return;
    setMessageActionId(messageId);
    try {
      const updated = await ExtendSimpleMQMessageTimeout(profile, queue.name, apiKey, messageId);
      setMessages(prev => prev.map(m => m.id === messageId ? updated : m));
    } catch (e) {
      alert(`タイムアウト延長に失敗しました: ${e}`);
    } finally {
      setMessageActionId(null);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!queue) return;
    setMessageActionId(messageId);
    try {
      await DeleteSimpleMQMessage(profile, queue.name, apiKey, messageId);
      setMessages(prev => prev.filter(m => m.id !== messageId));
      await loadMessageCount();
    } catch (e) {
      alert(`メッセージの削除に失敗しました: ${e}`);
    } finally {
      setMessageActionId(null);
    }
  };

  if (loading) return <div className="loading">読み込み中...</div>;
  if (!queue) return <div className="empty-state">Queue情報が見つかりません</div>;

  return (
    <div className="simplemq-detail">
      <div className="header">
        <h2>Queue詳細: {queue.name}</h2>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem', background: '#2a2a2a', borderRadius: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h4 style={{ color: '#00adb5', margin: 0 }}>基本情報</h4>
          {!editingBasic && (
            <button className="btn btn-secondary btn-small" onClick={handleBasicEditStart}>編集</button>
          )}
        </div>
        {editingBasic ? (
          <form onSubmit={handleBasicSave}>
            <div className="form-group">
              <label>説明</label>
              <input
                type="text"
                value={descriptionInput}
                onChange={(e) => setDescriptionInput(e.target.value)}
                placeholder="任意"
                maxLength={512}
              />
            </div>
            <div className="form-group">
              <label>可視性タイムアウト(秒)<span className="required-mark">*</span></label>
              <input
                type="number"
                value={visibilityTimeoutInput}
                onChange={(e) => setVisibilityTimeoutInput(Number(e.target.value))}
                min={1}
                max={43200}
                required
              />
            </div>
            <div className="form-group">
              <label>メッセージ保持期間(秒)<span className="required-mark">*</span></label>
              <input
                type="number"
                value={expireSecondsInput}
                onChange={(e) => setExpireSecondsInput(Number(e.target.value))}
                min={60}
                max={1209600}
                required
              />
            </div>
            <div className="form-group">
              <label>タグ</label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="任意(カンマ区切り、例: env:prod,team:sre)"
              />
            </div>
            {basicError && (
              <div style={{ marginBottom: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>
                エラー: {basicError}
              </div>
            )}
            <div className="confirm-actions">
              <button type="button" className="btn btn-secondary" onClick={handleBasicEditCancel} disabled={savingBasic}>キャンセル</button>
              <button type="submit" className="btn btn-primary" disabled={savingBasic}>
                {savingBasic ? '保存中...' : '保存する'}
              </button>
            </div>
          </form>
        ) : (
          <table style={{ borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>ID</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{queue.id}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>説明</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{queue.description || '-'}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>可視性タイムアウト</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{queue.visibilityTimeoutSeconds}秒</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>メッセージ保持期間</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{queue.expireSeconds}秒</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>作成日</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{formatDate(queue.createdAt)}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>更新日</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{formatDate(queue.modifiedAt)}</td>
              </tr>
              {queue.tags && queue.tags.length > 0 && (
                <tr>
                  <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>タグ</td>
                  <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>
                    <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                      {queue.tags.map(tag => (
                        <span key={tag} className="tag" style={{
                          backgroundColor: '#e2e8f0',
                          padding: '0px 6px',
                          borderRadius: '3px',
                          fontSize: '0.65rem',
                          color: '#4a5568',
                          border: '1px solid #cbd5e0'
                        }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem', background: '#2a2a2a', borderRadius: '8px' }}>
        <h4 style={{ color: '#00adb5', margin: '0 0 1rem 0' }}>メッセージAPIキー</h4>
        <p style={{ fontSize: '0.8rem', color: '#888', marginTop: 0 }}>
          メッセージの送受信にはAPIキーが必要です。発行できるのはこの画面のみで、以降取得する手段はありません。
          既にキーを控えている場合は下の入力欄に貼り付けてください(このアプリには保存されません)。
        </p>
        <div className="form-group">
          <label>APIキー</label>
          <input
            type="text"
            value={apiKey}
            onChange={(e) => { setApiKey(e.target.value); setJustRotated(false); }}
            placeholder="発行済みのAPIキーを入力、または右のボタンで新規発行"
          />
        </div>
        {justRotated && (
          <div style={{ marginBottom: '1rem', color: '#f6c343', fontSize: '0.8rem' }}>
            新しいAPIキーを発行しました。このキーは今だけ表示されています。必要であれば控えてください。
          </div>
        )}
        {rotateError && (
          <div style={{ marginBottom: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>
            エラー: {rotateError}
          </div>
        )}
        <button className="btn btn-secondary btn-small" onClick={handleRotate} disabled={rotating}>
          {rotating ? '発行中...' : 'APIキーを発行(ローテーション)'}
        </button>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem', background: '#2a2a2a', borderRadius: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 style={{ color: '#00adb5', margin: 0 }}>メッセージ数</h4>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-secondary btn-small" onClick={loadMessageCount} disabled={countLoading}>
              {countLoading ? '取得中...' : '再取得'}
            </button>
            <button className="btn btn-danger btn-small" onClick={() => setConfirmClear(true)} disabled={clearing}>
              {clearing ? '削除中...' : '全メッセージ削除'}
            </button>
          </div>
        </div>
        <div style={{ marginTop: '0.5rem', fontSize: '1.2rem' }}>
          {messageCount === null ? '-' : `${messageCount} 件`}
        </div>
      </div>

      <div className="card" style={{ padding: '1rem', background: '#2a2a2a', borderRadius: '8px' }}>
        <h4 style={{ color: '#00adb5', margin: '0 0 1rem 0' }}>メッセージ送受信</h4>
        {!apiKey ? (
          <div className="empty-state">APIキーを発行または入力すると、メッセージの送受信ができます</div>
        ) : (
          <>
            <form onSubmit={handleSend} style={{ marginBottom: '1.5rem' }}>
              <div className="form-group">
                <label>送信するメッセージ<span className="required-mark">*</span></label>
                <input
                  type="text"
                  value={sendContent}
                  onChange={(e) => setSendContent(e.target.value)}
                  placeholder="メッセージ本文"
                  required
                />
              </div>
              {sendError && (
                <div style={{ marginBottom: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>
                  エラー: {sendError}
                </div>
              )}
              <button type="submit" className="btn btn-primary btn-small" disabled={sending}>
                {sending ? '送信中...' : '送信する'}
              </button>
            </form>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h5 style={{ margin: 0, color: '#888' }}>受信したメッセージ</h5>
              <button className="btn btn-secondary btn-small" onClick={handleReceive} disabled={receiving}>
                {receiving ? '受信中...' : '受信する'}
              </button>
            </div>
            {receiveError && (
              <div style={{ marginBottom: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>
                エラー: {receiveError}
              </div>
            )}
            {messages.length === 0 ? (
              <div className="empty-state">受信したメッセージはありません</div>
            ) : (
              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>内容</th>
                    <th style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>受信時刻</th>
                    <th style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>可視性タイムアウト</th>
                    <th style={{ padding: '0.5rem 0', color: '#888', textAlign: 'left' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {messages.map(m => (
                    <tr key={m.id}>
                      <td style={{ padding: '0.5rem 1rem 0.5rem 0', textAlign: 'left', wordBreak: 'break-all' }}>{m.content}</td>
                      <td style={{ padding: '0.5rem 1rem 0.5rem 0', textAlign: 'left', whiteSpace: 'nowrap' }}>{formatEpochMillis(m.acquiredAt)}</td>
                      <td style={{ padding: '0.5rem 1rem 0.5rem 0', textAlign: 'left', whiteSpace: 'nowrap' }}>{formatEpochMillis(m.visibilityTimeoutAt)}</td>
                      <td style={{ padding: '0.5rem 0', textAlign: 'left', whiteSpace: 'nowrap' }}>
                        <button
                          className="btn btn-secondary btn-small"
                          onClick={() => handleExtendTimeout(m.id)}
                          disabled={messageActionId === m.id}
                          style={{ marginRight: '0.5rem' }}
                        >
                          タイムアウト延長
                        </button>
                        <button
                          className="btn btn-danger btn-small"
                          onClick={() => handleDeleteMessage(m.id)}
                          disabled={messageActionId === m.id}
                        >
                          削除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>

      {confirmClear && (
        <div className="confirm-overlay" onClick={() => setConfirmClear(false)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <p>Queue「{queue.name}」の全メッセージを削除しますか？</p>
            <p className="confirm-warning">この操作は取り消せません。</p>
            <div className="confirm-actions">
              <button className="btn btn-secondary" onClick={() => setConfirmClear(false)}>キャンセル</button>
              <button className="btn btn-danger" onClick={handleClearConfirm}>削除する</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
