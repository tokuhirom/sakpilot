import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DatabaseList } from './DatabaseList';
import { sakura } from '../../wailsjs/go/models';
import { GetDatabases, PowerOnDatabase, PowerOffDatabase, DeleteDatabase, GetDatabaseStatus, ResetDatabase } from '../../wailsjs/go/main/App';

vi.mock('../../wailsjs/go/main/App');

const zones: sakura.ZoneInfo[] = [
  new sakura.ZoneInfo({ id: 'is1a', name: '石狩第1ゾーン' }),
];

function makeDatabase(overrides: Partial<sakura.DatabaseInfo> = {}): sakura.DatabaseInfo {
  return new sakura.DatabaseInfo({
    id: '123456789012',
    name: 'my-database',
    description: '',
    zone: 'is1a',
    status: 'up',
    ipAddresses: ['192.168.0.31'],
    tags: [],
    createdAt: '2026-01-01T00:00:00+09:00',
    planId: '30gb',
    defaultRoute: '',
    networkMaskLen: 24,
    ...overrides,
  });
}

describe('DatabaseList', () => {
  beforeEach(() => {
    vi.mocked(GetDatabases).mockReset();
    vi.mocked(PowerOnDatabase).mockReset();
    vi.mocked(PowerOffDatabase).mockReset();
    vi.mocked(DeleteDatabase).mockReset();
    vi.mocked(GetDatabaseStatus).mockReset();
    vi.mocked(ResetDatabase).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('lists databases returned by GetDatabases', async () => {
    vi.mocked(GetDatabases).mockResolvedValueOnce([makeDatabase()]);

    render(<DatabaseList profile="default" zone="is1a" zones={zones} onZoneChange={() => {}} />);

    expect(await screen.findByText('my-database')).toBeInTheDocument();
    expect(screen.getByText('192.168.0.31', { exact: false })).toBeInTheDocument();
    expect(GetDatabases).toHaveBeenCalledWith('default', 'is1a');
  });

  it('shows an empty state when there are no databases', async () => {
    vi.mocked(GetDatabases).mockResolvedValueOnce([]);

    render(<DatabaseList profile="default" zone="is1a" zones={zones} onZoneChange={() => {}} />);

    expect(await screen.findByText('データベースがありません')).toBeInTheDocument();
  });

  it('disables 起動 for a running database and 停止/再起動 stay enabled', async () => {
    vi.mocked(GetDatabases).mockResolvedValueOnce([makeDatabase({ status: 'up' })]);
    const user = userEvent.setup();

    render(<DatabaseList profile="default" zone="is1a" zones={zones} onZoneChange={() => {}} />);
    await screen.findByText('my-database');

    await user.click(screen.getByRole('button', { name: '⋮' }));

    expect(screen.getByRole('button', { name: '起動' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '停止' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '再起動' })).toBeEnabled();
  });

  it('disables 再起動 for a stopped database', async () => {
    vi.mocked(GetDatabases).mockResolvedValueOnce([makeDatabase({ status: 'down' })]);
    const user = userEvent.setup();

    render(<DatabaseList profile="default" zone="is1a" zones={zones} onZoneChange={() => {}} />);
    await screen.findByText('my-database');

    await user.click(screen.getByRole('button', { name: '⋮' }));

    expect(screen.getByRole('button', { name: '再起動' })).toBeDisabled();
  });

  it('deletes a database after confirmation and reloads the list', async () => {
    vi.mocked(GetDatabases)
      .mockResolvedValueOnce([makeDatabase()])
      .mockResolvedValueOnce([]);
    vi.mocked(DeleteDatabase).mockResolvedValueOnce(undefined);
    const user = userEvent.setup();

    render(<DatabaseList profile="default" zone="is1a" zones={zones} onZoneChange={() => {}} />);
    await screen.findByText('my-database');

    await user.click(screen.getByRole('button', { name: '⋮' }));
    await user.click(screen.getByRole('button', { name: '削除' }));

    expect(await screen.findByText('データベース削除')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '削除する' }));

    await waitFor(() => {
      expect(DeleteDatabase).toHaveBeenCalledWith('default', 'is1a', '123456789012');
    });
    await waitFor(() => {
      expect(GetDatabases).toHaveBeenCalledTimes(2);
    });
  });

  it('powers on a database and polls until it becomes up', async () => {
    vi.mocked(GetDatabases)
      .mockResolvedValueOnce([makeDatabase({ status: 'down' })])
      .mockResolvedValueOnce([makeDatabase({ status: 'up' })]);
    vi.mocked(PowerOnDatabase).mockResolvedValueOnce(undefined);
    vi.mocked(GetDatabaseStatus).mockResolvedValueOnce('up');

    render(<DatabaseList profile="default" zone="is1a" zones={zones} onZoneChange={() => {}} />);
    await screen.findByText('my-database');

    // userEventはfakeTimers下では内部delayが解決せず固まるため、クリックはfireEventで行う。
    // waitForもtesting-library版は実タイマーでポーリングするため、fakeTimers対応のvi.waitForを使う。
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: '⋮' }));
    fireEvent.click(screen.getByRole('button', { name: '起動' }));
    fireEvent.click(screen.getByRole('button', { name: '起動する' }));

    await vi.waitFor(() => {
      expect(PowerOnDatabase).toHaveBeenCalledWith('default', 'is1a', '123456789012');
    });

    await vi.advanceTimersByTimeAsync(2000);

    expect(GetDatabaseStatus).toHaveBeenCalledWith('default', 'is1a', '123456789012');
    expect(GetDatabases).toHaveBeenCalledTimes(2);
  });

  it('resets a database after confirmation and clears the spinner after a delay', async () => {
    vi.mocked(GetDatabases)
      .mockResolvedValueOnce([makeDatabase({ status: 'up' })])
      .mockResolvedValueOnce([makeDatabase({ status: 'up' })]);
    vi.mocked(ResetDatabase).mockResolvedValueOnce(undefined);

    render(<DatabaseList profile="default" zone="is1a" zones={zones} onZoneChange={() => {}} />);
    await screen.findByText('my-database');

    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: '⋮' }));
    fireEvent.click(screen.getByRole('button', { name: '再起動' }));
    fireEvent.click(screen.getByRole('button', { name: '再起動する' }));

    await vi.waitFor(() => {
      expect(ResetDatabase).toHaveBeenCalledWith('default', 'is1a', '123456789012');
    });
    await vi.waitFor(() => {
      expect(screen.getByText('再起動中...')).toBeInTheDocument();
    });

    await vi.advanceTimersByTimeAsync(5000);

    expect(GetDatabases).toHaveBeenCalledTimes(2);
    await vi.waitFor(() => {
      expect(screen.queryByText('再起動中...')).not.toBeInTheDocument();
    });
  });
});
