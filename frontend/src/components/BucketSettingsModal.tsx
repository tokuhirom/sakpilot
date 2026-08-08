import { useState, useEffect, useCallback } from 'react';
import {
  GetObjectStorageBucketEncryption,
  EnableObjectStorageBucketEncryption,
  DisableObjectStorageBucketEncryption,
  GetObjectStorageBucketReplication,
  EnableObjectStorageBucketReplication,
  DisableObjectStorageBucketReplication,
  GetObjectStorageBucketQuota,
} from '../../wailsjs/go/main/App';
import { sakura } from '../../wailsjs/go/models';

interface BucketSettingsModalProps {
  profile: string;
  siteId: string;
  bucketName: string;
  otherBuckets: string[];
  onClose: () => void;
}

const formatDate = (dateString: string) => {
  if (!dateString) return '-';
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

export function BucketSettingsModal({ profile, siteId, bucketName, otherBuckets, onClose }: BucketSettingsModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [encryption, setEncryption] = useState<sakura.BucketEncryptionInfo | null>(null);
  const [kmsKeyId, setKmsKeyId] = useState('');
  const [encryptionBusy, setEncryptionBusy] = useState(false);

  const [replication, setReplication] = useState<sakura.BucketReplicationInfo | null>(null);
  const [targetBucket, setTargetBucket] = useState('');
  const [replicationBusy, setReplicationBusy] = useState(false);

  const [quota, setQuota] = useState<sakura.BucketQuotaInfo | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [enc, repl, q] = await Promise.all([
        GetObjectStorageBucketEncryption(profile, siteId, bucketName),
        GetObjectStorageBucketReplication(profile, siteId, bucketName),
        GetObjectStorageBucketQuota(profile, siteId, bucketName),
      ]);
      setEncryption(enc);
      setReplication(repl);
      setQuota(q);
    } catch (err) {
      console.error('[BucketSettingsModal] load error:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [profile, siteId, bucketName]);

  useEffect(() => {
    load();
  }, [load]);

  const handleEnableEncryption = async () => {
    if (!kmsKeyId) return;
    setEncryptionBusy(true);
    setError(null);
    try {
      await EnableObjectStorageBucketEncryption(profile, siteId, bucketName, kmsKeyId);
      setKmsKeyId('');
      const enc = await GetObjectStorageBucketEncryption(profile, siteId, bucketName);
      setEncryption(enc);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setEncryptionBusy(false);
    }
  };

  const handleDisableEncryption = async () => {
    setEncryptionBusy(true);
    setError(null);
    try {
      await DisableObjectStorageBucketEncryption(profile, siteId, bucketName);
      const enc = await GetObjectStorageBucketEncryption(profile, siteId, bucketName);
      setEncryption(enc);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setEncryptionBusy(false);
    }
  };

  const handleEnableReplication = async () => {
    if (!targetBucket) return;
    setReplicationBusy(true);
    setError(null);
    try {
      const repl = await EnableObjectStorageBucketReplication(profile, siteId, bucketName, targetBucket);
      setReplication(repl);
      setTargetBucket('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setReplicationBusy(false);
    }
  };

  const handleDisableReplication = async () => {
    setReplicationBusy(true);
    setError(null);
    try {
      await DisableObjectStorageBucketReplication(profile, siteId, bucketName);
      const repl = await GetObjectStorageBucketReplication(profile, siteId, bucketName);
      setReplication(repl);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setReplicationBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
        backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
        padding: '20px', minWidth: '420px', maxWidth: '560px',
      }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>バケット設定: {bucketName}</h3>

        {error && (
          <div style={{ marginBottom: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>
            エラー: {error}
          </div>
        )}

        {loading ? (
          <div className="loading">読み込み中...</div>
        ) : (
          <>
            <section style={{ marginBottom: '1.25rem' }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: '#00adb5' }}>暗号化</h4>
              {encryption?.enabled ? (
                <>
                  <div style={{ fontSize: '0.85rem', color: '#e0e0e0' }}>
                    有効（KMSキーID: {encryption.kmsKeyId}）
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.5rem' }}>
                    設定日時: {formatDate(encryption.configuredAt)}
                  </div>
                  <button className="btn btn-danger btn-small" onClick={handleDisableEncryption} disabled={encryptionBusy}>
                    {encryptionBusy ? '処理中...' : '無効にする'}
                  </button>
                </>
              ) : (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={kmsKeyId}
                    onChange={(e) => setKmsKeyId(e.target.value)}
                    placeholder="KMSキーID"
                    style={{ flex: 1, padding: '0.4rem', fontSize: '0.85rem' }}
                  />
                  <button className="btn btn-primary btn-small" onClick={handleEnableEncryption} disabled={encryptionBusy || !kmsKeyId}>
                    {encryptionBusy ? '処理中...' : '有効にする'}
                  </button>
                </div>
              )}
            </section>

            <section style={{ marginBottom: '1.25rem' }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: '#00adb5' }}>レプリケーション</h4>
              {replication?.enabled ? (
                <>
                  <div style={{ fontSize: '0.85rem', color: '#e0e0e0' }}>
                    有効（複製先: {replication.destBucketName} / {replication.configStatus}）
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.5rem' }}>
                    設定日時: {formatDate(replication.createdAt)}
                  </div>
                  <button className="btn btn-danger btn-small" onClick={handleDisableReplication} disabled={replicationBusy}>
                    {replicationBusy ? '処理中...' : '無効にする'}
                  </button>
                </>
              ) : (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <select
                    value={targetBucket}
                    onChange={(e) => setTargetBucket(e.target.value)}
                    style={{ flex: 1, padding: '0.4rem', fontSize: '0.85rem' }}
                  >
                    <option value="">複製先バケットを選択</option>
                    {otherBuckets.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                  <button className="btn btn-primary btn-small" onClick={handleEnableReplication} disabled={replicationBusy || !targetBucket}>
                    {replicationBusy ? '処理中...' : '有効にする'}
                  </button>
                </div>
              )}
            </section>

            {quota && (
              <section>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: '#00adb5' }}>クォータ</h4>
                <div style={{ fontSize: '0.85rem', color: '#e0e0e0' }}>
                  オブジェクト数上限: {quota.numObjectsPerBucket.toLocaleString()}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#e0e0e0' }}>
                  容量上限: {quota.amountGibPerBucket.toLocaleString()} GiB
                </div>
              </section>
            )}
          </>
        )}

        <div className="confirm-actions" style={{ marginTop: '1.25rem' }}>
          <button className="btn btn-secondary" onClick={onClose}>閉じる</button>
        </div>
      </div>
    </div>
  );
}
