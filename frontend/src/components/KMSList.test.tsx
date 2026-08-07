import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KMSList } from './KMSList';
import { kms } from '../../wailsjs/go/models';
import { GetKMSKeys, DeleteKMSKey } from '../../wailsjs/go/main/App';

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

describe('KMSList', () => {
  beforeEach(() => {
    vi.mocked(GetKMSKeys).mockReset();
    vi.mocked(DeleteKMSKey).mockReset();
  });

  it('lists KMS keys returned by GetKMSKeys', async () => {
    vi.mocked(GetKMSKeys).mockResolvedValueOnce([makeKey()]);

    render(<KMSList profile="default" onSelectKey={() => {}} />);

    expect(await screen.findByText('my-kms-key')).toBeInTheDocument();
    expect(GetKMSKeys).toHaveBeenCalledWith('default');
    expect(screen.getByText('アクティブ')).toBeInTheDocument();
  });

  it('shows an empty state when there are no keys', async () => {
    vi.mocked(GetKMSKeys).mockResolvedValueOnce([]);

    render(<KMSList profile="default" onSelectKey={() => {}} />);

    expect(await screen.findByText('KMSキーがありません')).toBeInTheDocument();
  });

  it('navigates to detail when a card is clicked', async () => {
    vi.mocked(GetKMSKeys).mockResolvedValueOnce([makeKey()]);
    const onSelectKey = vi.fn();
    const user = userEvent.setup();

    render(<KMSList profile="default" onSelectKey={onSelectKey} />);
    await screen.findByText('my-kms-key');

    await user.click(screen.getByText('my-kms-key'));

    expect(onSelectKey).toHaveBeenCalledWith('123456789012');
  });

  it('deletes a key after confirmation without triggering navigation, then reloads the list', async () => {
    vi.mocked(GetKMSKeys)
      .mockResolvedValueOnce([makeKey()])
      .mockResolvedValueOnce([]);
    vi.mocked(DeleteKMSKey).mockResolvedValueOnce(undefined);
    const onSelectKey = vi.fn();
    const user = userEvent.setup();

    render(<KMSList profile="default" onSelectKey={onSelectKey} />);
    await screen.findByText('my-kms-key');

    await user.click(screen.getByRole('button', { name: '削除' }));

    expect(onSelectKey).not.toHaveBeenCalled();
    expect(await screen.findByText('KMSキー「my-kms-key」を削除しますか？')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '削除する' }));

    await waitFor(() => {
      expect(DeleteKMSKey).toHaveBeenCalledWith('default', '123456789012');
    });
    await waitFor(() => {
      expect(GetKMSKeys).toHaveBeenCalledTimes(2);
    });
  });
});
