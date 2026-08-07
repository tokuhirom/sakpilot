import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProxyLBList } from './ProxyLBList';
import { sakura } from '../../wailsjs/go/models';
import { GetProxyLBs, GetProxyLBDetail, GetProxyLBHealth, DeleteProxyLB } from '../../wailsjs/go/main/App';

vi.mock('../../wailsjs/go/main/App');

function makeProxyLB(overrides: Partial<sakura.ProxyLBInfo> = {}): sakura.ProxyLBInfo {
  return new sakura.ProxyLBInfo({
    id: '123456789012',
    name: 'my-elb',
    description: '',
    tags: [],
    plan: '100',
    region: 'is1',
    fqdn: 'my-elb.proxylb.sakura.ne.jp',
    virtualIPAddress: '203.0.113.1',
    proxyNetworks: [],
    useVIPFailover: false,
    bindPorts: [],
    servers: [],
    createdAt: '2026-01-01T00:00:00+09:00',
    modifiedAt: '2026-01-01T00:00:00+09:00',
    ...overrides,
  });
}

function makeHealth(overrides: Partial<sakura.ProxyLBHealthInfo> = {}): sakura.ProxyLBHealthInfo {
  return new sakura.ProxyLBHealthInfo({
    activeConn: 0,
    cps: 0,
    currentVip: '203.0.113.1',
    servers: [],
    ...overrides,
  });
}

describe('ProxyLBList', () => {
  beforeEach(() => {
    vi.mocked(GetProxyLBs).mockReset();
    vi.mocked(GetProxyLBDetail).mockReset();
    vi.mocked(GetProxyLBHealth).mockReset();
    vi.mocked(DeleteProxyLB).mockReset();
  });

  it('lists ELBs returned by GetProxyLBs', async () => {
    vi.mocked(GetProxyLBs).mockResolvedValueOnce([makeProxyLB()]);

    render(<ProxyLBList profile="default" />);

    expect(await screen.findByText('my-elb')).toBeInTheDocument();
    expect(GetProxyLBs).toHaveBeenCalledWith('default');
  });

  it('shows an empty state when there are no ELBs', async () => {
    vi.mocked(GetProxyLBs).mockResolvedValueOnce([]);

    render(<ProxyLBList profile="default" />);

    expect(await screen.findByText('エンハンスドロードバランサがありません')).toBeInTheDocument();
  });

  it('navigates to detail view and loads detail/health', async () => {
    vi.mocked(GetProxyLBs).mockResolvedValueOnce([makeProxyLB()]);
    vi.mocked(GetProxyLBDetail).mockResolvedValueOnce(makeProxyLB());
    vi.mocked(GetProxyLBHealth).mockResolvedValueOnce(makeHealth());
    const user = userEvent.setup();

    render(<ProxyLBList profile="default" />);
    await screen.findByText('my-elb');

    await user.click(screen.getByText('my-elb'));

    expect(GetProxyLBDetail).toHaveBeenCalledWith('default', '123456789012');
    expect(GetProxyLBHealth).toHaveBeenCalledWith('default', '123456789012');
    expect(await screen.findByRole('button', { name: '削除' })).toBeInTheDocument();
  });

  it('deletes the ELB after confirmation and returns to the list', async () => {
    vi.mocked(GetProxyLBs)
      .mockResolvedValueOnce([makeProxyLB()])
      .mockResolvedValueOnce([]);
    vi.mocked(GetProxyLBDetail).mockResolvedValueOnce(makeProxyLB());
    vi.mocked(GetProxyLBHealth).mockResolvedValueOnce(makeHealth());
    vi.mocked(DeleteProxyLB).mockResolvedValueOnce(undefined);
    const user = userEvent.setup();

    render(<ProxyLBList profile="default" />);
    await screen.findByText('my-elb');
    await user.click(screen.getByText('my-elb'));

    await user.click(await screen.findByRole('button', { name: '削除' }));

    expect(await screen.findByText('ELB「my-elb」を削除しますか？')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '削除する' }));

    await waitFor(() => {
      expect(DeleteProxyLB).toHaveBeenCalledWith('default', '123456789012');
    });
    expect(await screen.findByText('エンハンスドロードバランサがありません')).toBeInTheDocument();
  });
});
