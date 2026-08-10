import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SecretManagerDetail } from './SecretManagerDetail';
import { secretmanager } from '../../wailsjs/go/models';
import {
  GetSecretManagerVault,
  UpdateSecretManagerVault,
  GetSecretManagerSecrets,
  SetSecretManagerSecret,
  DeleteSecretManagerSecret,
  UnveilSecretManagerSecret,
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

function makeSecret(overrides: Partial<secretmanager.SecretInfo> = {}): secretmanager.SecretInfo {
  return new secretmanager.SecretInfo({
    name: 'api-key',
    latestVersion: 1,
    ...overrides,
  });
}

describe('SecretManagerDetail', () => {
  beforeEach(() => {
    vi.mocked(GetSecretManagerVault).mockReset();
    vi.mocked(UpdateSecretManagerVault).mockReset();
    vi.mocked(GetSecretManagerSecrets).mockReset();
    vi.mocked(SetSecretManagerSecret).mockReset();
    vi.mocked(DeleteSecretManagerSecret).mockReset();
    vi.mocked(UnveilSecretManagerSecret).mockReset();
  });

  it('shows vault basic info and secrets', async () => {
    vi.mocked(GetSecretManagerVault).mockResolvedValueOnce(makeVault());
    vi.mocked(GetSecretManagerSecrets).mockResolvedValueOnce([makeSecret()]);

    render(<SecretManagerDetail profile="default" vaultId="123456789012" />);

    expect(await screen.findByText('Vault詳細: my-vault')).toBeInTheDocument();
    expect(GetSecretManagerVault).toHaveBeenCalledWith('default', '123456789012');
    expect(GetSecretManagerSecrets).toHaveBeenCalledWith('default', '123456789012');
    expect(screen.getByText('api-key')).toBeInTheDocument();
    expect(screen.getByText('••••••••')).toBeInTheDocument();
  });

  it('shows an empty state when there are no secrets', async () => {
    vi.mocked(GetSecretManagerVault).mockResolvedValueOnce(makeVault());
    vi.mocked(GetSecretManagerSecrets).mockResolvedValueOnce([]);

    render(<SecretManagerDetail profile="default" vaultId="123456789012" />);

    expect(await screen.findByText('シークレットがありません')).toBeInTheDocument();
  });

  it('edits name, description and tags', async () => {
    vi.mocked(GetSecretManagerVault).mockResolvedValueOnce(makeVault({ description: 'old desc', tags: ['old-tag'] }));
    vi.mocked(GetSecretManagerSecrets).mockResolvedValueOnce([]);
    vi.mocked(UpdateSecretManagerVault).mockResolvedValueOnce(
      makeVault({ name: 'renamed-vault', description: 'new desc', tags: ['new-tag'] })
    );
    const user = userEvent.setup();

    render(<SecretManagerDetail profile="default" vaultId="123456789012" />);
    await screen.findByText('Vault詳細: my-vault');

    await user.click(screen.getByRole('button', { name: '編集' }));

    const nameInput = screen.getByDisplayValue('my-vault');
    await user.clear(nameInput);
    await user.type(nameInput, 'renamed-vault');

    const descriptionInput = screen.getByDisplayValue('old desc');
    await user.clear(descriptionInput);
    await user.type(descriptionInput, 'new desc');

    const tagsInput = screen.getByDisplayValue('old-tag');
    await user.clear(tagsInput);
    await user.type(tagsInput, 'new-tag');

    await user.click(screen.getByRole('button', { name: '保存する' }));

    await waitFor(() => {
      expect(UpdateSecretManagerVault).toHaveBeenCalledWith('default', '123456789012', 'renamed-vault', 'new desc', ['new-tag']);
    });
    expect(await screen.findByText('Vault詳細: renamed-vault')).toBeInTheDocument();
  });

  it('shows an error and stays in edit mode when update fails', async () => {
    vi.mocked(GetSecretManagerVault).mockResolvedValueOnce(makeVault());
    vi.mocked(GetSecretManagerSecrets).mockResolvedValueOnce([]);
    vi.mocked(UpdateSecretManagerVault).mockRejectedValueOnce(new Error('name is required'));
    const user = userEvent.setup();

    render(<SecretManagerDetail profile="default" vaultId="123456789012" />);
    await screen.findByText('Vault詳細: my-vault');

    await user.click(screen.getByRole('button', { name: '編集' }));
    await user.click(screen.getByRole('button', { name: '保存する' }));

    expect(await screen.findByText(/エラー: Error: name is required/)).toBeInTheDocument();
  });

  it('adds a secret and reloads the secret list', async () => {
    vi.mocked(GetSecretManagerVault).mockResolvedValueOnce(makeVault());
    vi.mocked(GetSecretManagerSecrets)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeSecret({ name: 'new-secret' })]);
    vi.mocked(SetSecretManagerSecret).mockResolvedValueOnce(makeSecret({ name: 'new-secret' }));
    const user = userEvent.setup();

    render(<SecretManagerDetail profile="default" vaultId="123456789012" />);
    await screen.findByText('シークレットがありません');

    await user.click(screen.getByRole('button', { name: '+ シークレット追加' }));
    await user.type(screen.getByPlaceholderText('api-key'), 'new-secret');
    await user.type(screen.getByPlaceholderText('シークレットの値'), 'super-secret-value');
    await user.click(screen.getByRole('button', { name: '保存する' }));

    await waitFor(() => {
      expect(SetSecretManagerSecret).toHaveBeenCalledWith('default', '123456789012', 'new-secret', 'super-secret-value');
    });
    await waitFor(() => {
      expect(GetSecretManagerSecrets).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText('new-secret')).toBeInTheDocument();
  });

  it('reveals and hides a secret value', async () => {
    vi.mocked(GetSecretManagerVault).mockResolvedValueOnce(makeVault());
    vi.mocked(GetSecretManagerSecrets).mockResolvedValueOnce([makeSecret()]);
    vi.mocked(UnveilSecretManagerSecret).mockResolvedValueOnce(
      new secretmanager.SecretValue({ name: 'api-key', version: 1, value: 'super-secret-value' })
    );
    const user = userEvent.setup();

    render(<SecretManagerDetail profile="default" vaultId="123456789012" />);
    await screen.findByText('api-key');

    await user.click(screen.getByRole('button', { name: '値を表示' }));

    expect(await screen.findByText('super-secret-value')).toBeInTheDocument();
    expect(UnveilSecretManagerSecret).toHaveBeenCalledWith('default', '123456789012', 'api-key', 0);

    await user.click(screen.getByRole('button', { name: '隠す' }));

    expect(screen.queryByText('super-secret-value')).not.toBeInTheDocument();
    expect(screen.getByText('••••••••')).toBeInTheDocument();
  });

  it('shows an alert when revealing a secret fails', async () => {
    vi.mocked(GetSecretManagerVault).mockResolvedValueOnce(makeVault());
    vi.mocked(GetSecretManagerSecrets).mockResolvedValueOnce([makeSecret()]);
    vi.mocked(UnveilSecretManagerSecret).mockRejectedValueOnce(new Error('not found'));
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const user = userEvent.setup();

    render(<SecretManagerDetail profile="default" vaultId="123456789012" />);
    await screen.findByText('api-key');

    await user.click(screen.getByRole('button', { name: '値を表示' }));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('値の取得に失敗しました'));
    });
    alertSpy.mockRestore();
  });

  it('deletes a secret after confirmation, then reloads the list', async () => {
    vi.mocked(GetSecretManagerVault).mockResolvedValueOnce(makeVault());
    vi.mocked(GetSecretManagerSecrets)
      .mockResolvedValueOnce([makeSecret()])
      .mockResolvedValueOnce([]);
    vi.mocked(DeleteSecretManagerSecret).mockResolvedValueOnce(undefined);
    const user = userEvent.setup();

    render(<SecretManagerDetail profile="default" vaultId="123456789012" />);
    await screen.findByText('api-key');

    await user.click(screen.getByRole('button', { name: '削除' }));
    expect(await screen.findByText('シークレット「api-key」を削除しますか？')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '削除する' }));

    await waitFor(() => {
      expect(DeleteSecretManagerSecret).toHaveBeenCalledWith('default', '123456789012', 'api-key');
    });
    await waitFor(() => {
      expect(GetSecretManagerSecrets).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText('シークレットがありません')).toBeInTheDocument();
  });
});
