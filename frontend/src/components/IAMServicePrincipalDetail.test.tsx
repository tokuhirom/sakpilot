import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IAMServicePrincipalDetail } from './IAMServicePrincipalDetail';
import { iam } from '../../wailsjs/go/models';
import {
  GetIAMServicePrincipal,
  UpdateIAMServicePrincipal,
  GetIAMServicePrincipalKeys,
  UploadIAMServicePrincipalKey,
  EnableIAMServicePrincipalKey,
  DisableIAMServicePrincipalKey,
  DeleteIAMServicePrincipalKey,
} from '../../wailsjs/go/main/App';

vi.mock('../../wailsjs/go/main/App');

function makeServicePrincipal(overrides: Partial<iam.ServicePrincipalInfo> = {}): iam.ServicePrincipalInfo {
  return new iam.ServicePrincipalInfo({
    id: 300,
    projectId: 1,
    name: 'sp-ci',
    description: 'CI用サービスプリンシパル',
    createdAt: '2026-01-01T00:00:00+09:00',
    updatedAt: '2026-01-01T00:00:00+09:00',
    ...overrides,
  });
}

function makeKey(overrides: Partial<iam.ServicePrincipalKeyInfo> = {}): iam.ServicePrincipalKeyInfo {
  return new iam.ServicePrincipalKeyInfo({
    id: 'key-uuid-1',
    kid: 'kid-1',
    status: 'enabled',
    keyOrigin: 'user',
    publicKey: '-----BEGIN PUBLIC KEY-----abc-----END PUBLIC KEY-----',
    createdAt: '2026-01-01T00:00:00+09:00',
    keyExpiresAt: '',
    ...overrides,
  });
}

describe('IAMServicePrincipalDetail', () => {
  beforeEach(() => {
    vi.mocked(GetIAMServicePrincipal).mockReset();
    vi.mocked(UpdateIAMServicePrincipal).mockReset();
    vi.mocked(GetIAMServicePrincipalKeys).mockReset();
    vi.mocked(UploadIAMServicePrincipalKey).mockReset();
    vi.mocked(EnableIAMServicePrincipalKey).mockReset();
    vi.mocked(DisableIAMServicePrincipalKey).mockReset();
    vi.mocked(DeleteIAMServicePrincipalKey).mockReset();
  });

  it('shows service principal basic info and keys', async () => {
    vi.mocked(GetIAMServicePrincipal).mockResolvedValueOnce(makeServicePrincipal());
    vi.mocked(GetIAMServicePrincipalKeys).mockResolvedValueOnce([makeKey()]);

    render(<IAMServicePrincipalDetail profile="default" servicePrincipalId={300} />);

    expect(await screen.findByText('サービスプリンシパル詳細: sp-ci')).toBeInTheDocument();
    expect(GetIAMServicePrincipal).toHaveBeenCalledWith('default', 300);
    expect(GetIAMServicePrincipalKeys).toHaveBeenCalledWith('default', 300);
    expect(screen.getByText('kid-1')).toBeInTheDocument();
    expect(screen.getByText('有効')).toBeInTheDocument();
  });

  it('shows an empty state when there are no keys', async () => {
    vi.mocked(GetIAMServicePrincipal).mockResolvedValueOnce(makeServicePrincipal());
    vi.mocked(GetIAMServicePrincipalKeys).mockResolvedValueOnce([]);

    render(<IAMServicePrincipalDetail profile="default" servicePrincipalId={300} />);

    expect(await screen.findByText('キーがありません')).toBeInTheDocument();
  });

  it('edits name and description', async () => {
    vi.mocked(GetIAMServicePrincipal).mockResolvedValueOnce(makeServicePrincipal());
    vi.mocked(GetIAMServicePrincipalKeys).mockResolvedValueOnce([]);
    vi.mocked(UpdateIAMServicePrincipal).mockResolvedValueOnce(makeServicePrincipal({ name: 'sp-renamed' }));
    const user = userEvent.setup();

    render(<IAMServicePrincipalDetail profile="default" servicePrincipalId={300} />);
    await screen.findByText('サービスプリンシパル詳細: sp-ci');

    await user.click(screen.getByRole('button', { name: '編集' }));
    const nameInput = screen.getByDisplayValue('sp-ci');
    await user.clear(nameInput);
    await user.type(nameInput, 'sp-renamed');
    await user.click(screen.getByRole('button', { name: '保存する' }));

    await waitFor(() => {
      expect(UpdateIAMServicePrincipal).toHaveBeenCalledWith('default', 300, 'sp-renamed', 'CI用サービスプリンシパル');
    });
    expect(await screen.findByText('サービスプリンシパル詳細: sp-renamed')).toBeInTheDocument();
  });

  it('uploads a new key', async () => {
    vi.mocked(GetIAMServicePrincipal)
      .mockResolvedValueOnce(makeServicePrincipal())
      .mockResolvedValueOnce(makeServicePrincipal());
    vi.mocked(GetIAMServicePrincipalKeys)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeKey()]);
    vi.mocked(UploadIAMServicePrincipalKey).mockResolvedValueOnce(makeKey());
    const user = userEvent.setup();

    render(<IAMServicePrincipalDetail profile="default" servicePrincipalId={300} />);
    await screen.findByText('キーがありません');

    await user.click(screen.getByRole('button', { name: '+ キー登録' }));
    await user.type(screen.getByPlaceholderText('-----BEGIN PUBLIC KEY-----...'), 'pubkey-data');
    await user.click(screen.getByRole('button', { name: '登録する' }));

    await waitFor(() => {
      expect(UploadIAMServicePrincipalKey).toHaveBeenCalledWith('default', 300, 'pubkey-data');
    });
    expect(await screen.findByText('kid-1')).toBeInTheDocument();
  });

  it('disables an enabled key after confirmation', async () => {
    vi.mocked(GetIAMServicePrincipal)
      .mockResolvedValueOnce(makeServicePrincipal())
      .mockResolvedValueOnce(makeServicePrincipal());
    vi.mocked(GetIAMServicePrincipalKeys)
      .mockResolvedValueOnce([makeKey({ status: 'enabled' })])
      .mockResolvedValueOnce([makeKey({ status: 'disabled' })]);
    vi.mocked(DisableIAMServicePrincipalKey).mockResolvedValueOnce(makeKey({ status: 'disabled' }));
    const user = userEvent.setup();

    render(<IAMServicePrincipalDetail profile="default" servicePrincipalId={300} />);
    await screen.findByText('kid-1');

    await user.click(screen.getByRole('button', { name: '無効化' }));
    expect(await screen.findByText('キー「kid-1」を無効化しますか？')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '実行する' }));

    await waitFor(() => {
      expect(DisableIAMServicePrincipalKey).toHaveBeenCalledWith('default', 300, 'key-uuid-1');
    });
    expect(await screen.findByText('無効')).toBeInTheDocument();
  });

  it('enables a disabled key after confirmation', async () => {
    vi.mocked(GetIAMServicePrincipal)
      .mockResolvedValueOnce(makeServicePrincipal())
      .mockResolvedValueOnce(makeServicePrincipal());
    vi.mocked(GetIAMServicePrincipalKeys)
      .mockResolvedValueOnce([makeKey({ status: 'disabled' })])
      .mockResolvedValueOnce([makeKey({ status: 'enabled' })]);
    vi.mocked(EnableIAMServicePrincipalKey).mockResolvedValueOnce(makeKey({ status: 'enabled' }));
    const user = userEvent.setup();

    render(<IAMServicePrincipalDetail profile="default" servicePrincipalId={300} />);
    await screen.findByText('kid-1');

    await user.click(screen.getByRole('button', { name: '有効化' }));
    await user.click(screen.getByRole('button', { name: '実行する' }));

    await waitFor(() => {
      expect(EnableIAMServicePrincipalKey).toHaveBeenCalledWith('default', 300, 'key-uuid-1');
    });
    expect(await screen.findByText('有効')).toBeInTheDocument();
  });

  it('deletes a key after confirmation', async () => {
    vi.mocked(GetIAMServicePrincipal)
      .mockResolvedValueOnce(makeServicePrincipal())
      .mockResolvedValueOnce(makeServicePrincipal());
    vi.mocked(GetIAMServicePrincipalKeys)
      .mockResolvedValueOnce([makeKey()])
      .mockResolvedValueOnce([]);
    vi.mocked(DeleteIAMServicePrincipalKey).mockResolvedValueOnce();
    const user = userEvent.setup();

    render(<IAMServicePrincipalDetail profile="default" servicePrincipalId={300} />);
    await screen.findByText('kid-1');

    await user.click(screen.getByRole('button', { name: '削除' }));
    expect(await screen.findByText('キー「kid-1」を削除しますか？')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '実行する' }));

    await waitFor(() => {
      expect(DeleteIAMServicePrincipalKey).toHaveBeenCalledWith('default', 300, 'key-uuid-1');
    });
    expect(await screen.findByText('キーがありません')).toBeInTheDocument();
  });
});
