import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ObjectStoragePermissions } from './ObjectStoragePermissions';
import { sakura } from '../../wailsjs/go/models';
import {
  GetObjectStoragePermissions,
  CreateObjectStoragePermission,
  UpdateObjectStoragePermission,
  DeleteObjectStoragePermission,
  GetObjectStoragePermissionAccessKeys,
  CreateObjectStoragePermissionAccessKey,
  DeleteObjectStoragePermissionAccessKey,
} from '../../wailsjs/go/main/App';

vi.mock('../../wailsjs/go/main/App');

function makePermission(overrides: Partial<sakura.PermissionInfo> = {}): sakura.PermissionInfo {
  return new sakura.PermissionInfo({
    id: '1',
    siteId: 'isk01',
    displayName: 'readonly',
    bucketControls: [{ bucketName: 'my-bucket', canRead: true, canWrite: false }],
    createdAt: '2026-08-01T00:00:00Z',
    ...overrides,
  });
}

function makeKey(overrides: Partial<sakura.PermissionAccessKeyInfo> = {}): sakura.PermissionAccessKeyInfo {
  return new sakura.PermissionAccessKeyInfo({
    id: 'pkey-1',
    permissionId: '1',
    siteId: 'isk01',
    createdAt: '2026-08-01T00:00:00Z',
    ...overrides,
  });
}

describe('ObjectStoragePermissions', () => {
  beforeEach(() => {
    vi.mocked(GetObjectStoragePermissions).mockReset();
    vi.mocked(CreateObjectStoragePermission).mockReset();
    vi.mocked(UpdateObjectStoragePermission).mockReset();
    vi.mocked(DeleteObjectStoragePermission).mockReset();
    vi.mocked(GetObjectStoragePermissionAccessKeys).mockReset();
    vi.mocked(CreateObjectStoragePermissionAccessKey).mockReset();
    vi.mocked(DeleteObjectStoragePermissionAccessKey).mockReset();
  });

  it('lists permissions with their bucket controls', async () => {
    vi.mocked(GetObjectStoragePermissions).mockResolvedValueOnce([makePermission()]);

    render(<ObjectStoragePermissions profile="default" siteId="isk01" bucketNames={['my-bucket']} onClose={vi.fn()} />);

    expect(await screen.findByText('readonly')).toBeInTheDocument();
    expect(screen.getByText('my-bucket(R)')).toBeInTheDocument();
  });

  it('creates a permission from the form', async () => {
    const user = userEvent.setup();
    vi.mocked(GetObjectStoragePermissions).mockResolvedValueOnce([]);
    render(<ObjectStoragePermissions profile="default" siteId="isk01" bucketNames={['my-bucket']} onClose={vi.fn()} />);
    await screen.findByText('パーミッションがありません');

    vi.mocked(CreateObjectStoragePermission).mockResolvedValueOnce(makePermission());
    vi.mocked(GetObjectStoragePermissions).mockResolvedValueOnce([makePermission()]);

    await user.click(screen.getByRole('button', { name: '+ 作成' }));
    await user.type(screen.getByPlaceholderText('読み取り専用アプリ'), 'readonly');
    await user.selectOptions(screen.getByRole('combobox'), 'my-bucket');
    await user.click(screen.getByRole('button', { name: '作成する' }));

    await waitFor(() => {
      expect(CreateObjectStoragePermission).toHaveBeenCalledWith('default', 'isk01', 'readonly', [
        { bucketName: 'my-bucket', canRead: true, canWrite: false },
      ]);
    });
    expect(await screen.findByText('my-bucket(R)')).toBeInTheDocument();
  });

  it('blocks submit when 表示名 is empty', async () => {
    const user = userEvent.setup();
    vi.mocked(GetObjectStoragePermissions).mockResolvedValueOnce([]);
    render(<ObjectStoragePermissions profile="default" siteId="isk01" bucketNames={['my-bucket']} onClose={vi.fn()} />);
    await screen.findByText('パーミッションがありません');

    await user.click(screen.getByRole('button', { name: '+ 作成' }));
    await user.click(screen.getByRole('button', { name: '作成する' }));

    const nameInput = screen.getByPlaceholderText('読み取り専用アプリ') as HTMLInputElement;
    expect(nameInput.validity.valid).toBe(false);
    expect(CreateObjectStoragePermission).not.toHaveBeenCalled();
  });

  it('blocks submit when no bucket is available to select', async () => {
    const user = userEvent.setup();
    vi.mocked(GetObjectStoragePermissions).mockResolvedValueOnce([]);
    render(<ObjectStoragePermissions profile="default" siteId="isk01" bucketNames={[]} onClose={vi.fn()} />);
    await screen.findByText('パーミッションがありません');

    await user.click(screen.getByRole('button', { name: '+ 作成' }));
    await user.type(screen.getByPlaceholderText('読み取り専用アプリ'), 'readonly');
    await user.click(screen.getByRole('button', { name: '作成する' }));

    const bucketSelect = screen.getByRole('combobox') as HTMLSelectElement;
    expect(bucketSelect.validity.valid).toBe(false);
    expect(CreateObjectStoragePermission).not.toHaveBeenCalled();
  });

  it('deletes a permission after confirmation', async () => {
    const user = userEvent.setup();
    vi.mocked(GetObjectStoragePermissions).mockResolvedValueOnce([makePermission()]);
    render(<ObjectStoragePermissions profile="default" siteId="isk01" bucketNames={['my-bucket']} onClose={vi.fn()} />);
    await screen.findByText('readonly');

    vi.mocked(DeleteObjectStoragePermission).mockResolvedValueOnce(undefined);
    vi.mocked(GetObjectStoragePermissions).mockResolvedValueOnce([]);

    const row = screen.getByText('readonly').closest('tr')!;
    await user.click(within(row).getByRole('button', { name: '削除' }));
    await user.click(screen.getByRole('button', { name: '削除する' }));

    await waitFor(() => {
      expect(DeleteObjectStoragePermission).toHaveBeenCalledWith('default', 'isk01', '1');
    });
    await waitFor(() => {
      expect(screen.queryByText('readonly')).not.toBeInTheDocument();
    });
  });

  it('expands a permission to manage its access keys', async () => {
    const user = userEvent.setup();
    vi.mocked(GetObjectStoragePermissions).mockResolvedValueOnce([makePermission()]);
    vi.mocked(GetObjectStoragePermissionAccessKeys).mockResolvedValue([]);
    render(<ObjectStoragePermissions profile="default" siteId="isk01" bucketNames={['my-bucket']} onClose={vi.fn()} />);
    await screen.findByText('readonly');

    await user.click(screen.getByText('readonly'));
    expect(await screen.findByText('アクセスキーがありません')).toBeInTheDocument();

    const created = new sakura.PermissionAccessKeyCreated({ id: 'pkey-1', secret: 'brand-new-secret', createdAt: '2026-08-08T00:00:00Z' });
    vi.mocked(CreateObjectStoragePermissionAccessKey).mockResolvedValueOnce(created);
    vi.mocked(GetObjectStoragePermissionAccessKeys).mockResolvedValueOnce([makeKey()]);

    await user.click(screen.getByRole('button', { name: '+ 新規作成' }));

    await waitFor(() => {
      expect(CreateObjectStoragePermissionAccessKey).toHaveBeenCalledWith('default', 'isk01', '1');
    });
    expect(await screen.findByDisplayValue('brand-new-secret')).toBeInTheDocument();
  });
});
