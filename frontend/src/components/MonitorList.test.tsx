import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MonitorList } from './MonitorList';
import { sakura } from '../../wailsjs/go/models';
import { GetSimpleMonitors, DeleteSimpleMonitor, CreateSimpleMonitor } from '../../wailsjs/go/main/App';

vi.mock('../../wailsjs/go/main/App');

function makeMonitor(overrides: Partial<sakura.SimpleMonitorInfo> = {}): sakura.SimpleMonitorInfo {
  return new sakura.SimpleMonitorInfo({
    id: '123456789012',
    name: 'my-monitor',
    description: '',
    target: 'example.com',
    enabled: true,
    ...overrides,
  });
}

describe('MonitorList', () => {
  beforeEach(() => {
    vi.mocked(GetSimpleMonitors).mockReset();
    vi.mocked(DeleteSimpleMonitor).mockReset();
    vi.mocked(CreateSimpleMonitor).mockReset();
  });

  it('lists monitors returned by GetSimpleMonitors', async () => {
    vi.mocked(GetSimpleMonitors).mockResolvedValueOnce([makeMonitor()]);

    render(<MonitorList profile="default" onSelectMonitor={() => {}} />);

    expect(await screen.findByText('my-monitor')).toBeInTheDocument();
    expect(GetSimpleMonitors).toHaveBeenCalledWith('default');
  });

  it('shows an empty state when there are no monitors', async () => {
    vi.mocked(GetSimpleMonitors).mockResolvedValueOnce([]);

    render(<MonitorList profile="default" onSelectMonitor={() => {}} />);

    expect(await screen.findByText('シンプル監視がありません')).toBeInTheDocument();
  });

  it('navigates to monitor detail when a row is clicked', async () => {
    vi.mocked(GetSimpleMonitors).mockResolvedValueOnce([makeMonitor()]);
    const onSelectMonitor = vi.fn();
    const user = userEvent.setup();

    render(<MonitorList profile="default" onSelectMonitor={onSelectMonitor} />);
    await screen.findByText('my-monitor');

    await user.click(screen.getByText('my-monitor'));

    expect(onSelectMonitor).toHaveBeenCalledWith('123456789012');
  });

  it('deletes a monitor after confirmation without triggering row navigation', async () => {
    vi.mocked(GetSimpleMonitors)
      .mockResolvedValueOnce([makeMonitor()])
      .mockResolvedValueOnce([]);
    vi.mocked(DeleteSimpleMonitor).mockResolvedValueOnce(undefined);
    const onSelectMonitor = vi.fn();
    const user = userEvent.setup();

    render(<MonitorList profile="default" onSelectMonitor={onSelectMonitor} />);
    await screen.findByText('my-monitor');

    await user.click(screen.getByRole('button', { name: '削除' }));

    expect(onSelectMonitor).not.toHaveBeenCalled();
    expect(await screen.findByText('シンプル監視「my-monitor」を削除しますか？')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '削除する' }));

    await waitFor(() => {
      expect(DeleteSimpleMonitor).toHaveBeenCalledWith('default', '123456789012');
    });
    await waitFor(() => {
      expect(GetSimpleMonitors).toHaveBeenCalledTimes(2);
    });
  });

  it('creates a monitor', async () => {
    vi.mocked(GetSimpleMonitors)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeMonitor({ target: 'new.example.com' })]);
    vi.mocked(CreateSimpleMonitor).mockResolvedValueOnce(
      new sakura.SimpleMonitorDetailInfo(makeMonitor({ target: 'new.example.com' })),
    );
    const user = userEvent.setup();

    render(<MonitorList profile="default" onSelectMonitor={() => {}} />);
    await screen.findByText('シンプル監視がありません');

    await user.click(screen.getByRole('button', { name: '+ 監視作成' }));
    await user.type(screen.getByPlaceholderText('example.com'), 'new.example.com');
    await user.click(screen.getByRole('button', { name: '作成する' }));

    await waitFor(() => {
      expect(CreateSimpleMonitor).toHaveBeenCalledWith(
        'default',
        'new.example.com',
        '',
        expect.objectContaining({ healthCheck: expect.objectContaining({ protocol: 'ping' }) }),
      );
    });
    expect(await screen.findByText('new.example.com')).toBeInTheDocument();
  });
});
