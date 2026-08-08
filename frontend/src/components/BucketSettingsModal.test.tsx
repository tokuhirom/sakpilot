import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BucketSettingsModal } from './BucketSettingsModal';
import { sakura } from '../../wailsjs/go/models';
import {
  GetObjectStorageBucketEncryption,
  EnableObjectStorageBucketEncryption,
  DisableObjectStorageBucketEncryption,
  GetObjectStorageBucketReplication,
  EnableObjectStorageBucketReplication,
  DisableObjectStorageBucketReplication,
  GetObjectStorageBucketQuota,
} from '../../wailsjs/go/main/App';

vi.mock('../../wailsjs/go/main/App');

function makeEncryption(overrides: Partial<sakura.BucketEncryptionInfo> = {}): sakura.BucketEncryptionInfo {
  return new sakura.BucketEncryptionInfo({ enabled: false, kmsKeyId: '', configuredAt: '', ...overrides });
}

function makeReplication(overrides: Partial<sakura.BucketReplicationInfo> = {}): sakura.BucketReplicationInfo {
  return new sakura.BucketReplicationInfo({
    enabled: false, destBucketName: '', destClusterId: '', configStatus: '', createdAt: '', ...overrides,
  });
}

function makeQuota(overrides: Partial<sakura.BucketQuotaInfo> = {}): sakura.BucketQuotaInfo {
  return new sakura.BucketQuotaInfo({ numObjectsPerBucket: 10000000, amountGibPerBucket: 10240, ...overrides });
}

describe('BucketSettingsModal', () => {
  beforeEach(() => {
    vi.mocked(GetObjectStorageBucketEncryption).mockReset();
    vi.mocked(EnableObjectStorageBucketEncryption).mockReset();
    vi.mocked(DisableObjectStorageBucketEncryption).mockReset();
    vi.mocked(GetObjectStorageBucketReplication).mockReset();
    vi.mocked(EnableObjectStorageBucketReplication).mockReset();
    vi.mocked(DisableObjectStorageBucketReplication).mockReset();
    vi.mocked(GetObjectStorageBucketQuota).mockReset();

    vi.mocked(GetObjectStorageBucketEncryption).mockResolvedValue(makeEncryption());
    vi.mocked(GetObjectStorageBucketReplication).mockResolvedValue(makeReplication());
    vi.mocked(GetObjectStorageBucketQuota).mockResolvedValue(makeQuota());
  });

  it('shows quota and unconfigured encryption/replication on load', async () => {
    render(
      <BucketSettingsModal profile="default" siteId="isk01" bucketName="my-bucket" otherBuckets={['other-bucket']} onClose={vi.fn()} />
    );

    expect(await screen.findByText(/オブジェクト数上限/)).toHaveTextContent('10,000,000');
    expect(screen.getByText(/容量上限/)).toHaveTextContent('10,240');
    expect(screen.getByPlaceholderText('KMSキーID')).toBeInTheDocument();
    expect(screen.getByText('複製先バケットを選択')).toBeInTheDocument();
  });

  it('enables encryption and reflects the configured state', async () => {
    const user = userEvent.setup();
    vi.mocked(EnableObjectStorageBucketEncryption).mockResolvedValueOnce(undefined);

    render(
      <BucketSettingsModal profile="default" siteId="isk01" bucketName="my-bucket" otherBuckets={[]} onClose={vi.fn()} />
    );
    await screen.findByPlaceholderText('KMSキーID');

    vi.mocked(GetObjectStorageBucketEncryption).mockResolvedValueOnce(
      makeEncryption({ enabled: true, kmsKeyId: '123456789012', configuredAt: '2026-08-01T00:00:00Z' })
    );

    const encryptionSection = screen.getByText('暗号化').closest('section')!;
    await user.type(screen.getByPlaceholderText('KMSキーID'), '123456789012');
    await user.click(within(encryptionSection).getByRole('button', { name: '有効にする' }));

    await waitFor(() => {
      expect(EnableObjectStorageBucketEncryption).toHaveBeenCalledWith('default', 'isk01', 'my-bucket', '123456789012');
    });
    expect(await screen.findByText(/有効（KMSキーID: 123456789012）/)).toBeInTheDocument();
  });

  it('disables replication after confirming an enabled state', async () => {
    const user = userEvent.setup();
    vi.mocked(GetObjectStorageBucketReplication).mockResolvedValueOnce(
      makeReplication({ enabled: true, destBucketName: 'dest-bucket', configStatus: 'created', createdAt: '2026-08-01T00:00:00Z' })
    );
    vi.mocked(DisableObjectStorageBucketReplication).mockResolvedValueOnce(undefined);

    render(
      <BucketSettingsModal profile="default" siteId="isk01" bucketName="my-bucket" otherBuckets={['dest-bucket']} onClose={vi.fn()} />
    );

    expect(await screen.findByText(/複製先: dest-bucket/)).toBeInTheDocument();

    vi.mocked(GetObjectStorageBucketReplication).mockResolvedValueOnce(makeReplication());
    await user.click(screen.getByRole('button', { name: '無効にする' }));

    await waitFor(() => {
      expect(DisableObjectStorageBucketReplication).toHaveBeenCalledWith('default', 'isk01', 'my-bucket');
    });
    expect(await screen.findByText('複製先バケットを選択')).toBeInTheDocument();
  });

  it('shows an error message when a call fails', async () => {
    vi.mocked(GetObjectStorageBucketEncryption).mockRejectedValueOnce(new Error('boom'));

    render(
      <BucketSettingsModal profile="default" siteId="isk01" bucketName="my-bucket" otherBuckets={[]} onClose={vi.fn()} />
    );

    expect(await screen.findByText('エラー: boom')).toBeInTheDocument();
  });
});
