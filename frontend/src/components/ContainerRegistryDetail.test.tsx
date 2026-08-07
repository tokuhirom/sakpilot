import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ContainerRegistryDetail } from './ContainerRegistryDetail';
import { sakura } from '../../wailsjs/go/models';
import {
  GetContainerRegistries,
  GetContainerRegistryUsers,
  SaveContainerRegistrySecret,
  GetContainerRegistrySecret,
  DeleteContainerRegistrySecret,
  HasContainerRegistrySecret,
  ListContainerRegistryImages,
  GetContainerRegistryImageTags,
} from '../../wailsjs/go/main/App';

vi.mock('../../wailsjs/go/main/App');

function makeRegistry(overrides: Partial<sakura.ContainerRegistryInfo> = {}): sakura.ContainerRegistryInfo {
  return new sakura.ContainerRegistryInfo({
    id: '123456789012',
    name: 'my-registry',
    description: '',
    fqdn: 'my-registry.sakuracr.jp',
    accessLevel: 'readwrite',
    virtualDomain: '',
    ...overrides,
  });
}

function makeUser(overrides: Partial<sakura.ContainerRegistryUserInfo> = {}): sakura.ContainerRegistryUserInfo {
  return new sakura.ContainerRegistryUserInfo({
    userName: 'user1',
    permission: 'all',
    ...overrides,
  });
}

describe('ContainerRegistryDetail', () => {
  beforeEach(() => {
    vi.mocked(GetContainerRegistries).mockReset();
    vi.mocked(GetContainerRegistryUsers).mockReset();
    vi.mocked(SaveContainerRegistrySecret).mockReset();
    vi.mocked(GetContainerRegistrySecret).mockReset();
    vi.mocked(DeleteContainerRegistrySecret).mockReset();
    vi.mocked(HasContainerRegistrySecret).mockReset();
    vi.mocked(ListContainerRegistryImages).mockReset();
    vi.mocked(GetContainerRegistryImageTags).mockReset();

    vi.mocked(GetContainerRegistries).mockResolvedValue([makeRegistry()]);
    vi.mocked(GetContainerRegistryUsers).mockResolvedValue([]);
  });

  it('shows registry basic info', async () => {
    render(<ContainerRegistryDetail profile="default" registryId="123456789012" />);

    expect(await screen.findByText('コンテナレジストリ詳細: my-registry')).toBeInTheDocument();
    expect(screen.getByText('my-registry.sakuracr.jp')).toBeInTheDocument();
    expect(screen.getByText('読み書き')).toBeInTheDocument();
  });

  it('shows an empty state when there are no users', async () => {
    render(<ContainerRegistryDetail profile="default" registryId="123456789012" />);

    expect(await screen.findByText('ユーザーが登録されていません')).toBeInTheDocument();
  });

  it('shows "-" for non-all permission users instead of action buttons', async () => {
    vi.mocked(GetContainerRegistryUsers).mockResolvedValue([
      makeUser({ userName: 'readonly-user', permission: 'readonly' }),
    ]);
    vi.mocked(HasContainerRegistrySecret).mockResolvedValue(false);

    render(<ContainerRegistryDetail profile="default" registryId="123456789012" />);

    expect(await screen.findByText('readonly-user')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'パスワード設定' })).not.toBeInTheDocument();
  });

  it('loads saved credentials on mount and fetches the image list', async () => {
    vi.mocked(GetContainerRegistryUsers).mockResolvedValue([makeUser()]);
    vi.mocked(HasContainerRegistrySecret).mockResolvedValue(true);
    vi.mocked(GetContainerRegistrySecret).mockResolvedValue('saved-password');
    vi.mocked(ListContainerRegistryImages).mockResolvedValue([{ name: 'my-app' } as sakura.RegistryImage]);

    render(<ContainerRegistryDetail profile="default" registryId="123456789012" />);

    expect(await screen.findByText('(保存済み)')).toBeInTheDocument();
    await waitFor(() => {
      expect(ListContainerRegistryImages).toHaveBeenCalledWith(
        'my-registry.sakuracr.jp',
        'user1',
        'saved-password'
      );
    });
    expect(await screen.findByText('my-app')).toBeInTheDocument();
  });

  it('saves a new password for a user without a saved secret and activates it', async () => {
    vi.mocked(GetContainerRegistryUsers).mockResolvedValue([makeUser()]);
    vi.mocked(HasContainerRegistrySecret).mockResolvedValue(false);
    vi.mocked(SaveContainerRegistrySecret).mockResolvedValue(undefined);
    vi.mocked(ListContainerRegistryImages).mockResolvedValue([]);
    const user = userEvent.setup();

    render(<ContainerRegistryDetail profile="default" registryId="123456789012" />);

    await user.click(await screen.findByRole('button', { name: 'パスワード設定' }));
    await user.type(screen.getByPlaceholderText('パスワード'), 'new-password');
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(SaveContainerRegistrySecret).toHaveBeenCalledWith('123456789012', 'user1', 'new-password');
    });
    expect(await screen.findByText('(保存済み)')).toBeInTheDocument();
    await waitFor(() => {
      expect(ListContainerRegistryImages).toHaveBeenCalledWith(
        'my-registry.sakuracr.jp',
        'user1',
        'new-password'
      );
    });
  });

  it('cancels the password input without saving', async () => {
    vi.mocked(GetContainerRegistryUsers).mockResolvedValue([makeUser()]);
    vi.mocked(HasContainerRegistrySecret).mockResolvedValue(false);
    const user = userEvent.setup();

    render(<ContainerRegistryDetail profile="default" registryId="123456789012" />);

    await user.click(await screen.findByRole('button', { name: 'パスワード設定' }));
    await user.type(screen.getByPlaceholderText('パスワード'), 'abc');
    await user.click(screen.getByRole('button', { name: '取消' }));

    expect(screen.queryByPlaceholderText('パスワード')).not.toBeInTheDocument();
    expect(SaveContainerRegistrySecret).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'パスワード設定' })).toBeInTheDocument();
  });

  it('deletes a saved password and clears active credentials', async () => {
    vi.mocked(GetContainerRegistryUsers).mockResolvedValue([makeUser()]);
    vi.mocked(HasContainerRegistrySecret).mockResolvedValue(true);
    vi.mocked(GetContainerRegistrySecret).mockResolvedValue('saved-password');
    vi.mocked(ListContainerRegistryImages).mockResolvedValue([{ name: 'my-app' } as sakura.RegistryImage]);
    vi.mocked(DeleteContainerRegistrySecret).mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(<ContainerRegistryDetail profile="default" registryId="123456789012" />);
    await screen.findByText('my-app');

    await user.click(screen.getByRole('button', { name: '削除' }));

    await waitFor(() => {
      expect(DeleteContainerRegistrySecret).toHaveBeenCalledWith('123456789012', 'user1');
    });
    expect(screen.queryByText('(保存済み)')).not.toBeInTheDocument();
    expect(screen.queryByText('イメージ一覧')).not.toBeInTheDocument();
  });

  it('navigates to the tag list when an image is clicked and back again', async () => {
    vi.mocked(GetContainerRegistryUsers).mockResolvedValue([makeUser()]);
    vi.mocked(HasContainerRegistrySecret).mockResolvedValue(true);
    vi.mocked(GetContainerRegistrySecret).mockResolvedValue('saved-password');
    vi.mocked(ListContainerRegistryImages).mockResolvedValue([{ name: 'my-app' } as sakura.RegistryImage]);
    vi.mocked(GetContainerRegistryImageTags).mockResolvedValue([
      { name: 'latest', size: 1024, digest: 'sha256:abcdef1234567890' } as sakura.RegistryTag,
    ]);
    const user = userEvent.setup();

    render(<ContainerRegistryDetail profile="default" registryId="123456789012" />);
    await user.click(await screen.findByText('my-app'));

    expect(await screen.findByText('my-app のタグ一覧')).toBeInTheDocument();
    await waitFor(() => {
      expect(GetContainerRegistryImageTags).toHaveBeenCalledWith(
        'my-registry.sakuracr.jp',
        'user1',
        'saved-password',
        'my-app'
      );
    });
    expect(await screen.findByText('latest')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '← 戻る' }));

    expect(await screen.findByText('コンテナレジストリ詳細: my-registry')).toBeInTheDocument();
  });
});
