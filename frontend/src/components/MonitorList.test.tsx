import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MonitorList } from './MonitorList';
import { sakura } from '../../wailsjs/go/models';
import { GetSimpleMonitors, DeleteSimpleMonitor } from '../../wailsjs/go/main/App';

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
  });

  it('lists monitors returned by GetSimpleMonitors', async () => {
    vi.mocked(GetSimpleMonitors).mockResolvedValueOnce([makeMonitor()]);

    render(<MonitorList profile="default" />);

    expect(await screen.findByText('my-monitor')).toBeInTheDocument();
    expect(GetSimpleMonitors).toHaveBeenCalledWith('default');
  });

  it('shows an empty state when there are no monitors', async () => {
    vi.mocked(GetSimpleMonitors).mockResolvedValueOnce([]);

    render(<MonitorList profile="default" />);

    expect(await screen.findByText('シンプル監視がありません')).toBeInTheDocument();
  });

  it('deletes a monitor after confirmation and reloads the list', async () => {
    vi.mocked(GetSimpleMonitors)
      .mockResolvedValueOnce([makeMonitor()])
      .mockResolvedValueOnce([]);
    vi.mocked(DeleteSimpleMonitor).mockResolvedValueOnce(undefined);
    const user = userEvent.setup();

    render(<MonitorList profile="default" />);
    await screen.findByText('my-monitor');

    await user.click(screen.getByRole('button', { name: '削除' }));

    expect(await screen.findByText('シンプル監視「my-monitor」を削除しますか？')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '削除する' }));

    await waitFor(() => {
      expect(DeleteSimpleMonitor).toHaveBeenCalledWith('default', '123456789012');
    });
    await waitFor(() => {
      expect(GetSimpleMonitors).toHaveBeenCalledTimes(2);
    });
  });
});
