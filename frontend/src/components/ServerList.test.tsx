import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ServerList } from './ServerList';
import { sakura } from '../../wailsjs/go/models';
import { GetServers, PowerOnServer, PowerOffServer, DeleteServer, GetServerStatus, ResetServer } from '../../wailsjs/go/main/App';

vi.mock('../../wailsjs/go/main/App');

const zones: sakura.ZoneInfo[] = [
  new sakura.ZoneInfo({ id: 'is1a', name: '石狩第1ゾーン' }),
];

function makeServer(overrides: Partial<sakura.ServerInfo> = {}): sakura.ServerInfo {
  return new sakura.ServerInfo({
    id: '123456789012',
    name: 'my-server',
    description: '',
    zone: 'is1a',
    cpu: 2,
    memory: 4,
    status: 'up',
    ipAddresses: ['192.168.0.11'],
    tags: [],
    createdAt: '2026-01-01T00:00:00+09:00',
    ...overrides,
  });
}

describe('ServerList', () => {
  beforeEach(() => {
    vi.mocked(GetServers).mockReset();
    vi.mocked(PowerOnServer).mockReset();
    vi.mocked(PowerOffServer).mockReset();
    vi.mocked(DeleteServer).mockReset();
    vi.mocked(GetServerStatus).mockReset();
    vi.mocked(ResetServer).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('lists servers returned by GetServers', async () => {
    vi.mocked(GetServers).mockResolvedValueOnce([makeServer()]);

    render(<ServerList profile="default" zone="is1a" zones={zones} onZoneChange={() => {}} />);

    expect(await screen.findByText('my-server')).toBeInTheDocument();
    expect(screen.getByText('2 vCPU / 4 GB', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('192.168.0.11', { exact: false })).toBeInTheDocument();
    expect(GetServers).toHaveBeenCalledWith('default', 'is1a');
  });

  it('shows an empty state when there are no servers', async () => {
    vi.mocked(GetServers).mockResolvedValueOnce([]);

    render(<ServerList profile="default" zone="is1a" zones={zones} onZoneChange={() => {}} />);

    expect(await screen.findByText('サーバーがありません')).toBeInTheDocument();
  });

  it('disables 起動 for a running server and 停止 for a stopped one', async () => {
    vi.mocked(GetServers).mockResolvedValueOnce([makeServer({ status: 'up' })]);
    const user = userEvent.setup();

    render(<ServerList profile="default" zone="is1a" zones={zones} onZoneChange={() => {}} />);
    await screen.findByText('my-server');

    await user.click(screen.getByRole('button', { name: '⋮' }));

    expect(screen.getByRole('button', { name: '起動' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '停止' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '再起動' })).toBeEnabled();
  });

  it('disables 再起動 for a stopped server', async () => {
    vi.mocked(GetServers).mockResolvedValueOnce([makeServer({ status: 'down' })]);
    const user = userEvent.setup();

    render(<ServerList profile="default" zone="is1a" zones={zones} onZoneChange={() => {}} />);
    await screen.findByText('my-server');

    await user.click(screen.getByRole('button', { name: '⋮' }));

    expect(screen.getByRole('button', { name: '再起動' })).toBeDisabled();
  });

  it('deletes a server after confirmation and reloads the list', async () => {
    vi.mocked(GetServers)
      .mockResolvedValueOnce([makeServer()])
      .mockResolvedValueOnce([]);
    vi.mocked(DeleteServer).mockResolvedValueOnce(undefined);
    const user = userEvent.setup();

    render(<ServerList profile="default" zone="is1a" zones={zones} onZoneChange={() => {}} />);
    await screen.findByText('my-server');

    await user.click(screen.getByRole('button', { name: '⋮' }));
    await user.click(screen.getByRole('button', { name: '削除' }));

    expect(await screen.findByText('サーバー削除')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '削除する' }));

    await waitFor(() => {
      expect(DeleteServer).toHaveBeenCalledWith('default', 'is1a', '123456789012');
    });
    await waitFor(() => {
      expect(GetServers).toHaveBeenCalledTimes(2);
    });
  });

  it('powers on a server and polls until it becomes up', async () => {
    vi.mocked(GetServers)
      .mockResolvedValueOnce([makeServer({ status: 'down' })])
      .mockResolvedValueOnce([makeServer({ status: 'up' })]);
    vi.mocked(PowerOnServer).mockResolvedValueOnce(undefined);
    vi.mocked(GetServerStatus).mockResolvedValueOnce('up');

    render(<ServerList profile="default" zone="is1a" zones={zones} onZoneChange={() => {}} />);
    await screen.findByText('my-server');

    // userEventはfakeTimers下では内部delayが解決せず固まるため、クリックはfireEventで行う。
    // waitForもtesting-library版は実タイマーでポーリングするため、fakeTimers対応のvi.waitForを使う。
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: '⋮' }));
    fireEvent.click(screen.getByRole('button', { name: '起動' }));
    fireEvent.click(screen.getByRole('button', { name: '起動する' }));

    await vi.waitFor(() => {
      expect(PowerOnServer).toHaveBeenCalledWith('default', 'is1a', '123456789012');
    });

    await vi.advanceTimersByTimeAsync(2000);

    expect(GetServerStatus).toHaveBeenCalledWith('default', 'is1a', '123456789012');
    expect(GetServers).toHaveBeenCalledTimes(2);
  });

  it('resets a server after confirmation and clears the spinner after a delay', async () => {
    vi.mocked(GetServers)
      .mockResolvedValueOnce([makeServer({ status: 'up' })])
      .mockResolvedValueOnce([makeServer({ status: 'up' })]);
    vi.mocked(ResetServer).mockResolvedValueOnce(undefined);

    render(<ServerList profile="default" zone="is1a" zones={zones} onZoneChange={() => {}} />);
    await screen.findByText('my-server');

    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: '⋮' }));
    fireEvent.click(screen.getByRole('button', { name: '再起動' }));
    fireEvent.click(screen.getByRole('button', { name: '再起動する' }));

    await vi.waitFor(() => {
      expect(ResetServer).toHaveBeenCalledWith('default', 'is1a', '123456789012');
    });
    await vi.waitFor(() => {
      expect(screen.getByText('再起動中...')).toBeInTheDocument();
    });

    await vi.advanceTimersByTimeAsync(5000);

    expect(GetServers).toHaveBeenCalledTimes(2);
    await vi.waitFor(() => {
      expect(screen.queryByText('再起動中...')).not.toBeInTheDocument();
    });
  });
});
