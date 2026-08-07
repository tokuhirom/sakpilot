import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KMSDetail } from './KMSDetail';
import { kms } from '../../wailsjs/go/models';
import { GetKMSKey, RotateKMSKey, ChangeKMSKeyStatus } from '../../wailsjs/go/main/App';

vi.mock('../../wailsjs/go/main/App');

function makeKey(overrides: Partial<kms.KeyInfo> = {}): kms.KeyInfo {
  return new kms.KeyInfo({
    id: '123456789012',
    name: 'my-kms-key',
    description: '',
    status: 'active',
    keyOrigin: 'sakura_kms',
    latestVersion: 1,
    tags: [],
    createdAt: '2026-01-01T00:00:00+09:00',
    ...overrides,
  });
}

describe('KMSDetail', () => {
  beforeEach(() => {
    vi.mocked(GetKMSKey).mockReset();
    vi.mocked(RotateKMSKey).mockReset();
    vi.mocked(ChangeKMSKeyStatus).mockReset();
  });

  it('shows key basic info', async () => {
    vi.mocked(GetKMSKey).mockResolvedValueOnce(makeKey());

    render(<KMSDetail profile="default" keyId="123456789012" />);

    expect(await screen.findByText('KMSキー詳細: my-kms-key')).toBeInTheDocument();
    expect(GetKMSKey).toHaveBeenCalledWith('default', '123456789012');
    expect(screen.getByText('アクティブ')).toBeInTheDocument();
    expect(screen.getByText('さくらKMS')).toBeInTheDocument();
  });

  it('disables the status button matching the current status', async () => {
    vi.mocked(GetKMSKey).mockResolvedValueOnce(makeKey({ status: 'suspended' }));

    render(<KMSDetail profile="default" keyId="123456789012" />);
    await screen.findByText('KMSキー詳細: my-kms-key');

    expect(screen.getByRole('button', { name: '停止' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'アクティブ化' })).not.toBeDisabled();
  });

  it('rotates the key after confirmation', async () => {
    vi.mocked(GetKMSKey).mockResolvedValueOnce(makeKey());
    vi.mocked(RotateKMSKey).mockResolvedValueOnce(makeKey({ latestVersion: 2 }));
    const user = userEvent.setup();

    render(<KMSDetail profile="default" keyId="123456789012" />);
    await screen.findByText('KMSキー詳細: my-kms-key');

    await user.click(screen.getByRole('button', { name: 'ローテーション' }));
    expect(await screen.findByText('KMSキー「my-kms-key」をローテーションしますか？')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '実行する' }));

    await waitFor(() => {
      expect(RotateKMSKey).toHaveBeenCalledWith('default', '123456789012');
    });
    expect(await screen.findByText('2')).toBeInTheDocument();
  });

  it('changes the key status after confirmation', async () => {
    vi.mocked(GetKMSKey)
      .mockResolvedValueOnce(makeKey())
      .mockResolvedValueOnce(makeKey({ status: 'restricted' }));
    vi.mocked(ChangeKMSKeyStatus).mockResolvedValueOnce(undefined);
    const user = userEvent.setup();

    render(<KMSDetail profile="default" keyId="123456789012" />);
    await screen.findByText('KMSキー詳細: my-kms-key');

    await user.click(screen.getByRole('button', { name: '制限' }));
    expect(await screen.findByText('KMSキー「my-kms-key」のステータスを制限しますか？')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '実行する' }));

    await waitFor(() => {
      expect(ChangeKMSKeyStatus).toHaveBeenCalledWith('default', '123456789012', 'restricted');
    });
    expect(await screen.findByText('制限中')).toBeInTheDocument();
  });

  it('cancels a pending action without calling the API', async () => {
    vi.mocked(GetKMSKey).mockResolvedValueOnce(makeKey());
    const user = userEvent.setup();

    render(<KMSDetail profile="default" keyId="123456789012" />);
    await screen.findByText('KMSキー詳細: my-kms-key');

    await user.click(screen.getByRole('button', { name: 'ローテーション' }));
    await screen.findByText('KMSキー「my-kms-key」をローテーションしますか？');

    await user.click(screen.getByRole('button', { name: 'キャンセル' }));

    expect(screen.queryByText('KMSキー「my-kms-key」をローテーションしますか？')).not.toBeInTheDocument();
    expect(RotateKMSKey).not.toHaveBeenCalled();
  });

  it('shows an alert when rotation fails', async () => {
    vi.mocked(GetKMSKey).mockResolvedValueOnce(makeKey());
    vi.mocked(RotateKMSKey).mockRejectedValueOnce(new Error('key is not active'));
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const user = userEvent.setup();

    render(<KMSDetail profile="default" keyId="123456789012" />);
    await screen.findByText('KMSキー詳細: my-kms-key');

    await user.click(screen.getByRole('button', { name: 'ローテーション' }));
    await user.click(screen.getByRole('button', { name: '実行する' }));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('ローテーションに失敗しました'));
    });
    alertSpy.mockRestore();
  });
});
