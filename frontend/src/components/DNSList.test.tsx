import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DNSList } from './DNSList';
import { sakura } from '../../wailsjs/go/models';
import { GetDNSList, DeleteDNS } from '../../wailsjs/go/main/App';

vi.mock('../../wailsjs/go/main/App');

function makeDNS(overrides: Partial<sakura.DNSInfo> = {}): sakura.DNSInfo {
  return new sakura.DNSInfo({
    id: '123456789012',
    name: 'my-dns-zone',
    description: '',
    zone: 'example.com',
    records: [],
    ...overrides,
  });
}

describe('DNSList', () => {
  beforeEach(() => {
    vi.mocked(GetDNSList).mockReset();
    vi.mocked(DeleteDNS).mockReset();
  });

  it('lists DNS zones returned by GetDNSList', async () => {
    vi.mocked(GetDNSList).mockResolvedValueOnce([makeDNS()]);

    render(<DNSList profile="default" onSelectDNS={() => {}} />);

    expect(await screen.findByText('my-dns-zone')).toBeInTheDocument();
    expect(GetDNSList).toHaveBeenCalledWith('default');
  });

  it('shows an empty state when there are no DNS zones', async () => {
    vi.mocked(GetDNSList).mockResolvedValueOnce([]);

    render(<DNSList profile="default" onSelectDNS={() => {}} />);

    expect(await screen.findByText('DNSゾーンがありません')).toBeInTheDocument();
  });

  it('navigates to detail when a row is clicked', async () => {
    vi.mocked(GetDNSList).mockResolvedValueOnce([makeDNS()]);
    const onSelectDNS = vi.fn();
    const user = userEvent.setup();

    render(<DNSList profile="default" onSelectDNS={onSelectDNS} />);
    await screen.findByText('my-dns-zone');

    await user.click(screen.getByText('my-dns-zone'));

    expect(onSelectDNS).toHaveBeenCalledWith('123456789012');
  });

  it('deletes a DNS zone after confirmation without triggering row navigation', async () => {
    vi.mocked(GetDNSList)
      .mockResolvedValueOnce([makeDNS()])
      .mockResolvedValueOnce([]);
    vi.mocked(DeleteDNS).mockResolvedValueOnce(undefined);
    const onSelectDNS = vi.fn();
    const user = userEvent.setup();

    render(<DNSList profile="default" onSelectDNS={onSelectDNS} />);
    await screen.findByText('my-dns-zone');

    await user.click(screen.getByRole('button', { name: '削除' }));

    expect(onSelectDNS).not.toHaveBeenCalled();
    expect(await screen.findByText('DNSゾーン「my-dns-zone」を削除しますか？')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '削除する' }));

    await waitFor(() => {
      expect(DeleteDNS).toHaveBeenCalledWith('default', '123456789012');
    });
    await waitFor(() => {
      expect(GetDNSList).toHaveBeenCalledTimes(2);
    });
  });
});
