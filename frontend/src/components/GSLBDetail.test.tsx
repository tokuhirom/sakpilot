import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GSLBDetail } from './GSLBDetail';
import { sakura } from '../../wailsjs/go/models';
import { GetGSLBDetail, UpdateGSLB, UpdateGSLBSettings } from '../../wailsjs/go/main/App';

vi.mock('../../wailsjs/go/main/App');

function makeGSLB(overrides: Partial<sakura.GSLBInfo> = {}): sakura.GSLBInfo {
  return new sakura.GSLBInfo({
    id: '123456789012',
    name: 'my-gslb',
    description: '',
    fqdn: 'my-gslb.gslb4.sakura.ne.jp',
    sorryServer: '',
    servers: [],
    delayLoop: 10,
    weighted: false,
    healthCheck: {
      protocol: 'ping',
      hostHeader: '',
      path: '',
      responseCode: 0,
      port: 0,
    },
    ...overrides,
  });
}

describe('GSLBDetail', () => {
  beforeEach(() => {
    vi.mocked(GetGSLBDetail).mockReset();
    vi.mocked(UpdateGSLB).mockReset();
    vi.mocked(UpdateGSLBSettings).mockReset();
  });

  it('shows GSLB basic info, health check settings and servers', async () => {
    vi.mocked(GetGSLBDetail).mockResolvedValueOnce(makeGSLB({
      sorryServer: '192.0.2.1',
      healthCheck: { protocol: 'https', hostHeader: 'example.com', path: '/health', responseCode: 200, port: 443 },
      servers: [{ ipAddress: '192.0.2.10', enabled: true, weight: 1 }],
    }));

    render(<GSLBDetail profile="default" gslbId="123456789012" />);

    expect(await screen.findByText('GSLB詳細: my-gslb')).toBeInTheDocument();
    expect(screen.getByText('192.0.2.1')).toBeInTheDocument();
    expect(screen.getByText('https')).toBeInTheDocument();
    expect(screen.getByText('/health')).toBeInTheDocument();
    expect(screen.getByText('192.0.2.10')).toBeInTheDocument();
  });

  it('shows empty state message when there are no servers', async () => {
    vi.mocked(GetGSLBDetail).mockResolvedValueOnce(makeGSLB());

    render(<GSLBDetail profile="default" gslbId="123456789012" />);

    expect(await screen.findByText('サーバーが登録されていません')).toBeInTheDocument();
  });

  it('updates name and description', async () => {
    vi.mocked(GetGSLBDetail).mockResolvedValueOnce(makeGSLB());
    vi.mocked(UpdateGSLB).mockResolvedValueOnce(makeGSLB({ name: 'renamed-gslb', description: 'updated desc' }));
    const user = userEvent.setup();

    render(<GSLBDetail profile="default" gslbId="123456789012" />);
    await screen.findByText('GSLB詳細: my-gslb');

    await user.click(screen.getByRole('button', { name: '編集' }));
    const [nameInput, descriptionInput] = screen.getAllByRole('textbox');
    await user.clear(nameInput);
    await user.type(nameInput, 'renamed-gslb');
    await user.type(descriptionInput, 'updated desc');
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(UpdateGSLB).toHaveBeenCalledWith('default', '123456789012', 'renamed-gslb', 'updated desc');
    });
    expect(await screen.findByText('GSLB詳細: renamed-gslb')).toBeInTheDocument();
  });

  it('updates monitoring settings including a newly added server', async () => {
    vi.mocked(GetGSLBDetail).mockResolvedValueOnce(makeGSLB());
    vi.mocked(UpdateGSLBSettings).mockResolvedValueOnce(makeGSLB({
      servers: [{ ipAddress: '192.0.2.20', enabled: true, weight: 1 }],
    }));
    const user = userEvent.setup();

    render(<GSLBDetail profile="default" gslbId="123456789012" />);
    await screen.findByText('GSLB詳細: my-gslb');

    await user.click(screen.getByRole('button', { name: '監視設定を編集' }));
    await user.click(screen.getByRole('button', { name: '+ サーバー追加' }));
    await user.type(screen.getByPlaceholderText('IPアドレス *'), '192.0.2.20');
    await user.click(screen.getByRole('button', { name: '保存する' }));

    await waitFor(() => {
      expect(UpdateGSLBSettings).toHaveBeenCalledWith(
        'default',
        '123456789012',
        expect.objectContaining({
          servers: [expect.objectContaining({ ipAddress: '192.0.2.20', enabled: true, weight: 1 })],
        }),
      );
    });
  });

  it('blocks submission via native required validation when a server IP address is missing', async () => {
    vi.mocked(GetGSLBDetail).mockResolvedValueOnce(makeGSLB());
    const user = userEvent.setup();

    render(<GSLBDetail profile="default" gslbId="123456789012" />);
    await screen.findByText('GSLB詳細: my-gslb');

    await user.click(screen.getByRole('button', { name: '監視設定を編集' }));
    await user.click(screen.getByRole('button', { name: '+ サーバー追加' }));
    const ipInput = screen.getByPlaceholderText('IPアドレス *') as HTMLInputElement;
    await user.click(screen.getByRole('button', { name: '保存する' }));

    expect(ipInput.validity.valid).toBe(false);
    expect(UpdateGSLBSettings).not.toHaveBeenCalled();
  });
});
