import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MonitorDetail } from './MonitorDetail';
import { sakura } from '../../wailsjs/go/models';
import { GetSimpleMonitorDetail, UpdateSimpleMonitor, UpdateSimpleMonitorSettings } from '../../wailsjs/go/main/App';

vi.mock('../../wailsjs/go/main/App');

function makeMonitor(overrides: Partial<sakura.SimpleMonitorDetailInfo> = {}): sakura.SimpleMonitorDetailInfo {
  return new sakura.SimpleMonitorDetailInfo({
    id: '123456789012',
    name: 'my-monitor',
    description: '',
    target: 'example.com',
    enabled: true,
    availability: 'available',
    delayLoop: 60,
    maxCheckAttempts: 3,
    retryInterval: 60,
    timeout: 10,
    notifyEmailEnabled: true,
    notifySlackEnabled: false,
    slackWebhooksUrl: '',
    notifyInterval: 3600,
    healthCheck: {
      protocol: 'ping',
      port: '',
      path: '',
      status: '',
      host: '',
      containsString: '',
    },
    ...overrides,
  });
}

describe('MonitorDetail', () => {
  beforeEach(() => {
    vi.mocked(GetSimpleMonitorDetail).mockReset();
    vi.mocked(UpdateSimpleMonitor).mockReset();
    vi.mocked(UpdateSimpleMonitorSettings).mockReset();
  });

  it('shows monitor basic info and health check settings', async () => {
    vi.mocked(GetSimpleMonitorDetail).mockResolvedValueOnce(makeMonitor({
      healthCheck: { protocol: 'https', port: '443', path: '/health', status: '200', host: 'example.com', containsString: 'ok' },
    }));

    render(<MonitorDetail profile="default" monitorId="123456789012" />);

    expect(await screen.findByText('シンプル監視詳細: my-monitor')).toBeInTheDocument();
    expect(screen.getAllByText('example.com').length).toBeGreaterThan(0);
    expect(screen.getByText('https')).toBeInTheDocument();
    expect(screen.getByText('/health')).toBeInTheDocument();
  });

  it('updates the description', async () => {
    vi.mocked(GetSimpleMonitorDetail).mockResolvedValueOnce(makeMonitor());
    vi.mocked(UpdateSimpleMonitor).mockResolvedValueOnce(makeMonitor({ description: 'updated desc' }));
    const user = userEvent.setup();

    render(<MonitorDetail profile="default" monitorId="123456789012" />);
    await screen.findByText('シンプル監視詳細: my-monitor');

    await user.click(screen.getByRole('button', { name: '編集' }));
    const input = screen.getByRole('textbox');
    await user.type(input, 'updated desc');
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(UpdateSimpleMonitor).toHaveBeenCalledWith('default', '123456789012', 'updated desc');
    });
    expect(await screen.findByText('updated desc')).toBeInTheDocument();
  });

  it('updates monitoring settings', async () => {
    vi.mocked(GetSimpleMonitorDetail).mockResolvedValueOnce(makeMonitor());
    vi.mocked(UpdateSimpleMonitorSettings).mockResolvedValueOnce(makeMonitor({ delayLoop: 120 }));
    const user = userEvent.setup();

    render(<MonitorDetail profile="default" monitorId="123456789012" />);
    await screen.findByText('シンプル監視詳細: my-monitor');

    await user.click(screen.getByRole('button', { name: '監視設定を編集' }));
    const delayLoopInput = screen.getAllByRole('spinbutton')[0];
    await user.clear(delayLoopInput);
    await user.type(delayLoopInput, '120');
    await user.click(screen.getByRole('button', { name: '保存する' }));

    await waitFor(() => {
      expect(UpdateSimpleMonitorSettings).toHaveBeenCalledWith(
        'default',
        '123456789012',
        expect.objectContaining({ delayLoop: 120 }),
      );
    });
  });
});
