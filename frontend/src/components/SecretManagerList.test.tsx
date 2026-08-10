import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SecretManagerList } from './SecretManagerList';
import { secretmanager, kms } from '../../wailsjs/go/models';
import {
  GetSecretManagerVaults,
  DeleteSecretManagerVault,
  CreateSecretManagerVault,
  GetKMSKeys,
} from '../../wailsjs/go/main/App';

vi.mock('../../wailsjs/go/main/App');

function makeVault(overrides: Partial<secretmanager.VaultInfo> = {}): secretmanager.VaultInfo {
  return new secretmanager.VaultInfo({
    id: '123456789012',
    name: 'my-vault',
    description: '',
    kmsKeyId: '990000000123',
    tags: [],
    createdAt: '2026-01-01T00:00:00+09:00',
    modifiedAt: '2026-01-01T00:00:00+09:00',
    ...overrides,
  });
}

function makeKmsKey(overrides: Partial<kms.KeyInfo> = {}): kms.KeyInfo {
  return new kms.KeyInfo({
    id: '990000000123',
    name: 'my-kms-key',
    description: '',
    status: 'active',
    keyOrigin: 'generated',
    latestVersion: 1,
    tags: [],
    createdAt: '2026-01-01T00:00:00+09:00',
    ...overrides,
  });
}

describe('SecretManagerList', () => {
  beforeEach(() => {
    vi.mocked(GetSecretManagerVaults).mockReset();
    vi.mocked(DeleteSecretManagerVault).mockReset();
    vi.mocked(CreateSecretManagerVault).mockReset();
    vi.mocked(GetKMSKeys).mockReset();
  });

  it('lists vaults returned by GetSecretManagerVaults', async () => {
    vi.mocked(GetSecretManagerVaults).mockResolvedValueOnce([makeVault()]);

    render(<SecretManagerList profile="default" onSelectVault={() => {}} />);

    expect(await screen.findByText('my-vault')).toBeInTheDocument();
    expect(GetSecretManagerVaults).toHaveBeenCalledWith('default');
    expect(screen.getByText('KMSキー: 990000000123')).toBeInTheDocument();
  });

  it('shows an empty state when there are no vaults', async () => {
    vi.mocked(GetSecretManagerVaults).mockResolvedValueOnce([]);

    render(<SecretManagerList profile="default" onSelectVault={() => {}} />);

    expect(await screen.findByText('Vaultがありません')).toBeInTheDocument();
  });

  it('navigates to detail when a card is clicked', async () => {
    vi.mocked(GetSecretManagerVaults).mockResolvedValueOnce([makeVault()]);
    const onSelectVault = vi.fn();
    const user = userEvent.setup();

    render(<SecretManagerList profile="default" onSelectVault={onSelectVault} />);
    await screen.findByText('my-vault');

    await user.click(screen.getByText('my-vault'));

    expect(onSelectVault).toHaveBeenCalledWith('123456789012');
  });

  it('deletes a vault after confirmation without triggering navigation, then reloads the list', async () => {
    vi.mocked(GetSecretManagerVaults)
      .mockResolvedValueOnce([makeVault()])
      .mockResolvedValueOnce([]);
    vi.mocked(DeleteSecretManagerVault).mockResolvedValueOnce(undefined);
    const onSelectVault = vi.fn();
    const user = userEvent.setup();

    render(<SecretManagerList profile="default" onSelectVault={onSelectVault} />);
    await screen.findByText('my-vault');

    await user.click(screen.getByRole('button', { name: '削除' }));

    expect(onSelectVault).not.toHaveBeenCalled();
    expect(await screen.findByText('Vault「my-vault」を削除しますか？')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '削除する' }));

    await waitFor(() => {
      expect(DeleteSecretManagerVault).toHaveBeenCalledWith('default', '123456789012');
    });
    await waitFor(() => {
      expect(GetSecretManagerVaults).toHaveBeenCalledTimes(2);
    });
  });

  it('creates a vault with the entered fields and selected KMS key, then reloads the list', async () => {
    vi.mocked(GetSecretManagerVaults)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeVault({ name: 'new-vault' })]);
    vi.mocked(GetKMSKeys).mockResolvedValueOnce([makeKmsKey()]);
    vi.mocked(CreateSecretManagerVault).mockResolvedValueOnce(makeVault({ name: 'new-vault' }));
    const user = userEvent.setup();

    render(<SecretManagerList profile="default" onSelectVault={() => {}} />);
    await screen.findByText('Vaultがありません');

    await user.click(screen.getByRole('button', { name: '+ Vault作成' }));
    await screen.findByText('my-kms-key (990000000123)');
    await user.type(screen.getByPlaceholderText('my-vault'), 'new-vault');
    await user.type(screen.getByPlaceholderText('任意', { exact: true }), 'a new vault');
    await user.click(screen.getByRole('button', { name: '作成する' }));

    await waitFor(() => {
      expect(CreateSecretManagerVault).toHaveBeenCalledWith('default', 'new-vault', 'a new vault', '990000000123', []);
    });
    await waitFor(() => {
      expect(GetSecretManagerVaults).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText('new-vault')).toBeInTheDocument();
  });

  it('disables vault creation when no KMS keys are available', async () => {
    vi.mocked(GetSecretManagerVaults).mockResolvedValueOnce([]);
    vi.mocked(GetKMSKeys).mockResolvedValueOnce([]);
    const user = userEvent.setup();

    render(<SecretManagerList profile="default" onSelectVault={() => {}} />);
    await screen.findByText('Vaultがありません');

    await user.click(screen.getByRole('button', { name: '+ Vault作成' }));

    expect(await screen.findByText('利用可能なKMSキーがありません。先にKMSキーを作成してください。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '作成する' })).toBeDisabled();
  });
});
