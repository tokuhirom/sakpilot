import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ObjectStorageList } from './ObjectStorageList';
import { sakura } from '../../wailsjs/go/models';
import {
  GetObjectStorageSites,
  GetObjectStorageBuckets,
  GetObjectStorageAccessKeys,
  GetObjectStorageSecretKey,
  SaveObjectStorageSecretKey,
  DeleteObjectStorageSecretKey,
  HasObjectStorageSecretKey,
  CreateObjectStorageBucket,
  DeleteObjectStorageBucket,
  CreateObjectStorageAccessKey,
  DeleteObjectStorageAccessKey,
  GetObjectStorageAccount,
  DeleteObjectStorageAccount,
  ListObjectStorageObjects,
  UploadObjectStorageObject,
  DeleteObjectStorageObject,
  GetObjectStoragePermissions,
  GetObjectStorageBucketEncryption,
  GetObjectStorageBucketReplication,
  GetObjectStorageBucketQuota,
} from '../../wailsjs/go/main/App';

vi.mock('../../wailsjs/go/main/App');

function makeSite(overrides: Partial<sakura.SiteInfo> = {}): sakura.SiteInfo {
  return new sakura.SiteInfo({
    id: 'isk01',
    displayName: '石狩第1サイト',
    endpoint: 's3.isk01.objectstorage.sakurastorage.jp',
    ...overrides,
  });
}

function makeAccessKey(overrides: Partial<sakura.AccessKeyInfo> = {}): sakura.AccessKeyInfo {
  return new sakura.AccessKeyInfo({
    id: 'key-1',
    siteId: 'isk01',
    createdAt: '2026-08-01T00:00:00Z',
    ...overrides,
  });
}

function makeBucket(overrides: Partial<sakura.BucketInfo> = {}): sakura.BucketInfo {
  return new sakura.BucketInfo({
    name: 'my-bucket',
    siteId: 'isk01',
    creationDate: '2026-08-01T00:00:00Z',
    ...overrides,
  });
}

function makeAccount(overrides: Partial<sakura.AccountInfo> = {}): sakura.AccountInfo {
  return new sakura.AccountInfo({
    siteId: 'isk01',
    code: 'ACC001',
    createdAt: '2026-08-01T00:00:00Z',
    ...overrides,
  });
}

function makeObject(overrides: Partial<sakura.ObjectInfo> = {}): sakura.ObjectInfo {
  return new sakura.ObjectInfo({
    key: 'file.txt',
    size: 123,
    lastModified: '2026-08-01T00:00:00Z',
    storageClass: 'STANDARD',
    ...overrides,
  });
}

// Navigates to the buckets view for 石狩第1サイト and selects key-1 as the
// access key (but does not enter a secret).
async function goToBucketsView() {
  vi.mocked(GetObjectStorageSites).mockResolvedValueOnce([makeSite()]);
  vi.mocked(GetObjectStorageAccessKeys).mockResolvedValueOnce([makeAccessKey()]);
  vi.mocked(HasObjectStorageSecretKey).mockResolvedValue(false);

  const user = userEvent.setup();
  render(<ObjectStorageList profile="default" />);

  await screen.findByText('石狩第1サイト');
  await user.click(screen.getByText('石狩第1サイト'));
  await screen.findByText('key-1');

  await user.selectOptions(screen.getByRole('combobox'), 'key-1');
  await screen.findByPlaceholderText('Secret Access Key');

  return user;
}

// Types + saves the secret key so that loadBuckets() succeeds. Note that
// saving triggers loadBuckets() twice (once explicitly, once via the
// secretSaved effect), so callers should use a persistent mock resolution
// for GetObjectStorageBuckets rather than mockResolvedValueOnce here.
async function enterAndSaveSecret(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText('Secret Access Key'), 'my-secret');
  await user.click(screen.getByRole('button', { name: '保存' }));
  await waitFor(() => {
    expect(SaveObjectStorageSecretKey).toHaveBeenCalledWith('isk01', 'key-1', 'my-secret');
  });
}

describe('ObjectStorageList', () => {
  beforeEach(() => {
    vi.mocked(GetObjectStorageSites).mockReset();
    vi.mocked(GetObjectStorageBuckets).mockReset();
    vi.mocked(GetObjectStorageAccessKeys).mockReset();
    vi.mocked(GetObjectStorageSecretKey).mockReset();
    vi.mocked(SaveObjectStorageSecretKey).mockReset();
    vi.mocked(DeleteObjectStorageSecretKey).mockReset();
    vi.mocked(HasObjectStorageSecretKey).mockReset();
    vi.mocked(CreateObjectStorageBucket).mockReset();
    vi.mocked(DeleteObjectStorageBucket).mockReset();
    vi.mocked(CreateObjectStorageAccessKey).mockReset();
    vi.mocked(DeleteObjectStorageAccessKey).mockReset();
    vi.mocked(GetObjectStorageAccount).mockReset();
    vi.mocked(DeleteObjectStorageAccount).mockReset();
    vi.mocked(ListObjectStorageObjects).mockReset();
    vi.mocked(UploadObjectStorageObject).mockReset();
    vi.mocked(DeleteObjectStorageObject).mockReset();
    vi.mocked(GetObjectStoragePermissions).mockReset();
    vi.mocked(GetObjectStorageBucketEncryption).mockReset();
    vi.mocked(GetObjectStorageBucketReplication).mockReset();
    vi.mocked(GetObjectStorageBucketQuota).mockReset();
  });

  it('lists sites and navigates to the buckets view on click', async () => {
    vi.mocked(GetObjectStorageSites).mockResolvedValueOnce([makeSite()]);
    vi.mocked(GetObjectStorageAccessKeys).mockResolvedValueOnce([]);

    const user = userEvent.setup();
    render(<ObjectStorageList profile="default" />);

    expect(await screen.findByText('石狩第1サイト')).toBeInTheDocument();
    await user.click(screen.getByText('石狩第1サイト'));

    expect(await screen.findByText('アクセスキー')).toBeInTheDocument();
    expect(GetObjectStorageAccessKeys).toHaveBeenCalledWith('default', 'isk01');
  });

  it('saves the secret and loads buckets once entered', async () => {
    const user = await goToBucketsView();
    vi.mocked(GetObjectStorageBuckets).mockResolvedValue([makeBucket()]);

    await enterAndSaveSecret(user);

    expect(await screen.findByText('my-bucket')).toBeInTheDocument();
  });

  describe('bucket create', () => {
    it('creates a bucket and reloads the list on success', async () => {
      const user = await goToBucketsView();
      vi.mocked(GetObjectStorageBuckets).mockResolvedValue([]);
      await enterAndSaveSecret(user);
      await screen.findByText('バケットがありません');

      vi.mocked(CreateObjectStorageBucket).mockResolvedValueOnce(undefined);
      vi.mocked(GetObjectStorageBuckets).mockResolvedValueOnce([makeBucket({ name: 'new-bucket' })]);

      await user.click(screen.getByRole('button', { name: '+ バケット作成' }));
      await user.type(screen.getByPlaceholderText('my-bucket'), 'new-bucket');
      await user.click(screen.getByRole('button', { name: '作成する' }));

      await waitFor(() => {
        expect(CreateObjectStorageBucket).toHaveBeenCalledWith('default', 'isk01', 'new-bucket', '');
      });
      expect(await screen.findByText('new-bucket')).toBeInTheDocument();
    });

    it('shows an error message when bucket creation fails', async () => {
      const user = await goToBucketsView();
      vi.mocked(CreateObjectStorageBucket).mockRejectedValueOnce(new Error('bucket already exists'));

      await user.click(screen.getByRole('button', { name: '+ バケット作成' }));
      await user.type(screen.getByPlaceholderText('my-bucket'), 'dup-bucket');
      await user.click(screen.getByRole('button', { name: '作成する' }));

      expect(await screen.findByText('エラー: bucket already exists')).toBeInTheDocument();
    });

    it('blocks submit when バケット名 is empty', async () => {
      const user = await goToBucketsView();

      await user.click(screen.getByRole('button', { name: '+ バケット作成' }));
      await user.click(screen.getByRole('button', { name: '作成する' }));

      const nameInput = screen.getByPlaceholderText('my-bucket') as HTMLInputElement;
      expect(nameInput.validity.valid).toBe(false);
      expect(CreateObjectStorageBucket).not.toHaveBeenCalled();
    });
  });

  describe('bucket delete', () => {
    it('cancels without calling DeleteObjectStorageBucket', async () => {
      const user = await goToBucketsView();
      vi.mocked(GetObjectStorageBuckets).mockResolvedValue([makeBucket()]);
      await enterAndSaveSecret(user);
      await screen.findByText('my-bucket');

      const bucketRow = screen.getByText('my-bucket').closest('tr')!;
      await user.click(within(bucketRow).getByRole('button', { name: '削除' }));
      expect(await screen.findByText('バケット「my-bucket」を削除しますか？')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'キャンセル' }));

      expect(DeleteObjectStorageBucket).not.toHaveBeenCalled();
    });

    it('deletes a bucket after confirmation', async () => {
      const user = await goToBucketsView();
      vi.mocked(GetObjectStorageBuckets).mockResolvedValue([makeBucket()]);
      await enterAndSaveSecret(user);
      await screen.findByText('my-bucket');

      vi.mocked(DeleteObjectStorageBucket).mockResolvedValueOnce(undefined);
      vi.mocked(GetObjectStorageBuckets).mockResolvedValueOnce([]);

      const bucketRow = screen.getByText('my-bucket').closest('tr')!;
      await user.click(within(bucketRow).getByRole('button', { name: '削除' }));
      await user.click(screen.getByRole('button', { name: '削除する' }));

      await waitFor(() => {
        expect(DeleteObjectStorageBucket).toHaveBeenCalledWith('default', 'isk01', 'my-bucket');
      });
      await waitFor(() => {
        expect(screen.queryByText('my-bucket')).not.toBeInTheDocument();
      });
    });
  });

  describe('access key create', () => {
    it('reveals the secret once and saves it as the selected key', async () => {
      const user = await goToBucketsView();
      const created = new sakura.AccessKeyCreated({ id: 'key-2', secret: 'brand-new-secret', createdAt: '2026-08-08T00:00:00Z' });
      vi.mocked(CreateObjectStorageAccessKey).mockResolvedValueOnce(created);
      vi.mocked(GetObjectStorageAccessKeys).mockResolvedValue([makeAccessKey(), makeAccessKey({ id: 'key-2' })]);

      await user.click(screen.getByRole('button', { name: '+ 新規作成' }));

      expect(await screen.findByDisplayValue('brand-new-secret')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: '保存して選択する' }));

      await waitFor(() => {
        expect(SaveObjectStorageSecretKey).toHaveBeenCalledWith('isk01', 'key-2', 'brand-new-secret');
      });
      // The reveal modal closes; the secret now lives in the (single) main secret field instead.
      expect(screen.queryByText('アクセスキーを作成しました')).not.toBeInTheDocument();
    });
  });

  describe('access key delete', () => {
    it('deletes the selected access key after confirmation', async () => {
      const user = await goToBucketsView();
      vi.mocked(DeleteObjectStorageAccessKey).mockResolvedValueOnce(undefined);
      vi.mocked(DeleteObjectStorageSecretKey).mockResolvedValueOnce(undefined);
      vi.mocked(GetObjectStorageAccessKeys).mockResolvedValueOnce([]);

      await user.click(screen.getByRole('button', { name: 'アクセスキーを削除' }));
      expect(await screen.findByText('アクセスキー「key-1」を削除しますか？')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: '削除する' }));

      await waitFor(() => {
        expect(DeleteObjectStorageAccessKey).toHaveBeenCalledWith('default', 'isk01', 'key-1');
      });
      await waitFor(() => {
        expect(screen.queryByText('key-1')).not.toBeInTheDocument();
      });
    });
  });

  describe('account', () => {
    it('shows the account code and deletes the account after confirmation', async () => {
      vi.mocked(GetObjectStorageSites).mockResolvedValueOnce([makeSite()]);
      vi.mocked(GetObjectStorageAccessKeys).mockResolvedValueOnce([]);
      vi.mocked(GetObjectStorageAccount).mockResolvedValueOnce(makeAccount());

      const user = userEvent.setup();
      render(<ObjectStorageList profile="default" />);
      await user.click(await screen.findByText('石狩第1サイト'));

      expect(await screen.findByText(/アカウントコード: ACC001/)).toBeInTheDocument();

      vi.mocked(DeleteObjectStorageAccount).mockResolvedValueOnce(undefined);
      await user.click(screen.getByRole('button', { name: 'アカウント削除' }));
      await user.click(screen.getByRole('button', { name: '削除する' }));

      await waitFor(() => {
        expect(DeleteObjectStorageAccount).toHaveBeenCalledWith('default', 'isk01');
      });
      await waitFor(() => {
        expect(screen.queryByText(/アカウントコード/)).not.toBeInTheDocument();
      });
    });
  });

  describe('bucket settings and permissions', () => {
    it('opens the bucket settings modal from a bucket row', async () => {
      const user = await goToBucketsView();
      vi.mocked(GetObjectStorageBuckets).mockResolvedValue([makeBucket()]);
      await enterAndSaveSecret(user);
      await screen.findByText('my-bucket');

      vi.mocked(GetObjectStorageBucketEncryption).mockResolvedValueOnce(
        new sakura.BucketEncryptionInfo({ enabled: false, kmsKeyId: '', configuredAt: '' })
      );
      vi.mocked(GetObjectStorageBucketReplication).mockResolvedValueOnce(
        new sakura.BucketReplicationInfo({ enabled: false, destBucketName: '', destClusterId: '', configStatus: '', createdAt: '' })
      );
      vi.mocked(GetObjectStorageBucketQuota).mockResolvedValueOnce(
        new sakura.BucketQuotaInfo({ numObjectsPerBucket: 100, amountGibPerBucket: 10 })
      );

      const bucketRow = screen.getByText('my-bucket').closest('tr')!;
      await user.click(within(bucketRow).getByRole('button', { name: '設定' }));

      expect(await screen.findByText('バケット設定: my-bucket')).toBeInTheDocument();
    });

    it('opens the permissions management modal', async () => {
      const user = await goToBucketsView();
      vi.mocked(GetObjectStoragePermissions).mockResolvedValueOnce([]);

      await user.click(screen.getByRole('button', { name: 'パーミッション管理' }));

      expect(await screen.findByText('パーミッションがありません')).toBeInTheDocument();
    });
  });

  describe('objects view', () => {
    async function goToObjectsView() {
      const user = await goToBucketsView();
      vi.mocked(GetObjectStorageBuckets).mockResolvedValue([makeBucket()]);
      await enterAndSaveSecret(user);
      await screen.findByText('my-bucket');

      vi.mocked(ListObjectStorageObjects).mockResolvedValue(
        new sakura.ListObjectsResult({ objects: [makeObject()], prefixes: [], isTruncated: false, nextToken: '' })
      );
      await user.click(screen.getByText('my-bucket'));
      await screen.findByText(/file\.txt/);

      return user;
    }

    it('uploads a file and reloads the object list', async () => {
      const user = await goToObjectsView();
      vi.mocked(UploadObjectStorageObject).mockResolvedValueOnce(undefined);

      await user.click(screen.getByRole('button', { name: '+ アップロード' }));

      await waitFor(() => {
        expect(UploadObjectStorageObject).toHaveBeenCalledWith(
          's3.isk01.objectstorage.sakurastorage.jp', 'key-1', 'my-secret', 'my-bucket', ''
        );
      });
    });

    it('deletes an object after confirmation', async () => {
      const user = await goToObjectsView();
      vi.mocked(DeleteObjectStorageObject).mockResolvedValueOnce(undefined);
      vi.mocked(ListObjectStorageObjects).mockResolvedValueOnce(
        new sakura.ListObjectsResult({ objects: [], prefixes: [], isTruncated: false, nextToken: '' })
      );

      const objectRow = screen.getByText(/file\.txt/).closest('tr')!;
      await user.click(within(objectRow).getByTitle('削除'));
      await user.click(screen.getByRole('button', { name: '削除する' }));

      await waitFor(() => {
        expect(DeleteObjectStorageObject).toHaveBeenCalledWith(
          's3.isk01.objectstorage.sakurastorage.jp', 'key-1', 'my-secret', 'my-bucket', 'file.txt'
        );
      });
      await waitFor(() => {
        expect(screen.queryByText(/file\.txt/)).not.toBeInTheDocument();
      });
    });
  });
});
