import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NFSList } from './NFSList';
import { sakura } from '../../wailsjs/go/models';
import { GetNFSList, PowerOnNFS, PowerOffNFS, DeleteNFS, GetNFSStatus, ResetNFS } from '../../wailsjs/go/main/App';

vi.mock('../../wailsjs/go/main/App');

const zones: sakura.ZoneInfo[] = [
  new sakura.ZoneInfo({ id: 'is1a', name: '石狩第1ゾーン' }),
];

function makeNFS(overrides: Partial<sakura.NFSInfo> = {}): sakura.NFSInfo {
  return new sakura.NFSInfo({
    id: '123456789012',
    name: 'my-nfs',
    description: '',
    zone: 'is1a',
    status: 'up',
    ipAddresses: ['192.168.0.21'],
    tags: [],
    createdAt: '2026-01-01T00:00:00+09:00',
    planId: '100000022',
    defaultRoute: '',
    networkMaskLen: 24,
    switchName: '',
    ...overrides,
  });
}

describe('NFSList', () => {
  beforeEach(() => {
    vi.mocked(GetNFSList).mockReset();
    vi.mocked(PowerOnNFS).mockReset();
    vi.mocked(PowerOffNFS).mockReset();
    vi.mocked(DeleteNFS).mockReset();
    vi.mocked(GetNFSStatus).mockReset();
    vi.mocked(ResetNFS).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('lists NFS instances returned by GetNFSList', async () => {
    vi.mocked(GetNFSList).mockResolvedValueOnce([makeNFS()]);

    render(<NFSList profile="default" zone="is1a" zones={zones} onZoneChange={() => {}} />);

    expect(await screen.findByText('my-nfs')).toBeInTheDocument();
    expect(screen.getByText('192.168.0.21', { exact: false })).toBeInTheDocument();
    expect(GetNFSList).toHaveBeenCalledWith('default', 'is1a');
  });

  it('shows an empty state when there is no NFS', async () => {
    vi.mocked(GetNFSList).mockResolvedValueOnce([]);

    render(<NFSList profile="default" zone="is1a" zones={zones} onZoneChange={() => {}} />);

    expect(await screen.findByText('NFSがありません')).toBeInTheDocument();
  });

  it('disables 起動 for a running NFS and 停止/再起動 for a stopped one', async () => {
    vi.mocked(GetNFSList).mockResolvedValueOnce([makeNFS({ status: 'up' })]);
    const user = userEvent.setup();

    render(<NFSList profile="default" zone="is1a" zones={zones} onZoneChange={() => {}} />);
    await screen.findByText('my-nfs');

    await user.click(screen.getByRole('button', { name: '⋮' }));

    expect(screen.getByRole('button', { name: '起動' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '停止' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '再起動' })).toBeEnabled();
  });

  it('disables 再起動 for a stopped NFS', async () => {
    vi.mocked(GetNFSList).mockResolvedValueOnce([makeNFS({ status: 'down' })]);
    const user = userEvent.setup();

    render(<NFSList profile="default" zone="is1a" zones={zones} onZoneChange={() => {}} />);
    await screen.findByText('my-nfs');

    await user.click(screen.getByRole('button', { name: '⋮' }));

    expect(screen.getByRole('button', { name: '再起動' })).toBeDisabled();
  });

  it('deletes an NFS after confirmation and reloads the list', async () => {
    vi.mocked(GetNFSList)
      .mockResolvedValueOnce([makeNFS()])
      .mockResolvedValueOnce([]);
    vi.mocked(DeleteNFS).mockResolvedValueOnce(undefined);
    const user = userEvent.setup();

    render(<NFSList profile="default" zone="is1a" zones={zones} onZoneChange={() => {}} />);
    await screen.findByText('my-nfs');

    await user.click(screen.getByRole('button', { name: '⋮' }));
    await user.click(screen.getByRole('button', { name: '削除' }));

    expect(await screen.findByText('NFS削除')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '削除する' }));

    await waitFor(() => {
      expect(DeleteNFS).toHaveBeenCalledWith('default', 'is1a', '123456789012');
    });
    await waitFor(() => {
      expect(GetNFSList).toHaveBeenCalledTimes(2);
    });
  });

  it('powers on an NFS and polls until it becomes up', async () => {
    vi.mocked(GetNFSList)
      .mockResolvedValueOnce([makeNFS({ status: 'down' })])
      .mockResolvedValueOnce([makeNFS({ status: 'up' })]);
    vi.mocked(PowerOnNFS).mockResolvedValueOnce(undefined);
    vi.mocked(GetNFSStatus).mockResolvedValueOnce('up');

    render(<NFSList profile="default" zone="is1a" zones={zones} onZoneChange={() => {}} />);
    await screen.findByText('my-nfs');

    // userEventはfakeTimers下では内部delayが解決せず固まるため、クリックはfireEventで行う。
    // waitForもtesting-library版は実タイマーでポーリングするため、fakeTimers対応のvi.waitForを使う。
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: '⋮' }));
    fireEvent.click(screen.getByRole('button', { name: '起動' }));
    fireEvent.click(screen.getByRole('button', { name: '起動する' }));

    await vi.waitFor(() => {
      expect(PowerOnNFS).toHaveBeenCalledWith('default', 'is1a', '123456789012');
    });

    await vi.advanceTimersByTimeAsync(2000);

    expect(GetNFSStatus).toHaveBeenCalledWith('default', 'is1a', '123456789012');
    expect(GetNFSList).toHaveBeenCalledTimes(2);
  });

  it('resets an NFS after confirmation and clears the spinner after a delay', async () => {
    vi.mocked(GetNFSList)
      .mockResolvedValueOnce([makeNFS({ status: 'up' })])
      .mockResolvedValueOnce([makeNFS({ status: 'up' })]);
    vi.mocked(ResetNFS).mockResolvedValueOnce(undefined);

    render(<NFSList profile="default" zone="is1a" zones={zones} onZoneChange={() => {}} />);
    await screen.findByText('my-nfs');

    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: '⋮' }));
    fireEvent.click(screen.getByRole('button', { name: '再起動' }));
    fireEvent.click(screen.getByRole('button', { name: '再起動する' }));

    await vi.waitFor(() => {
      expect(ResetNFS).toHaveBeenCalledWith('default', 'is1a', '123456789012');
    });
    await vi.waitFor(() => {
      expect(screen.getByText('再起動中...')).toBeInTheDocument();
    });

    await vi.advanceTimersByTimeAsync(5000);

    expect(GetNFSList).toHaveBeenCalledTimes(2);
    await vi.waitFor(() => {
      expect(screen.queryByText('再起動中...')).not.toBeInTheDocument();
    });
  });
});
