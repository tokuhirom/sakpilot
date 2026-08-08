import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DNSDetail } from './DNSDetail';
import { sakura } from '../../wailsjs/go/models';
import { GetDNSDetail, UpdateDNS, UpdateDNSRecords } from '../../wailsjs/go/main/App';

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

function makeRecord(overrides: Partial<sakura.DNSRecord> = {}): sakura.DNSRecord {
  return new sakura.DNSRecord({
    name: 'www',
    type: 'A',
    rdata: '192.0.2.1',
    ttl: 3600,
    ...overrides,
  });
}

describe('DNSDetail', () => {
  beforeEach(() => {
    vi.mocked(GetDNSDetail).mockReset();
    vi.mocked(UpdateDNS).mockReset();
    vi.mocked(UpdateDNSRecords).mockReset();
  });

  it('shows the placeholder when there are no records', async () => {
    vi.mocked(GetDNSDetail).mockResolvedValueOnce(makeDNS());

    render(<DNSDetail profile="default" dnsId="123456789012" />);

    expect(await screen.findByText('レコードが登録されていません')).toBeInTheDocument();
  });

  it('lists existing records', async () => {
    vi.mocked(GetDNSDetail).mockResolvedValueOnce(makeDNS({ records: [makeRecord()] }));

    render(<DNSDetail profile="default" dnsId="123456789012" />);

    expect(await screen.findByText('www')).toBeInTheDocument();
    expect(screen.getByText('192.0.2.1')).toBeInTheDocument();
  });

  it('updates the description', async () => {
    vi.mocked(GetDNSDetail).mockResolvedValueOnce(makeDNS());
    vi.mocked(UpdateDNS).mockResolvedValueOnce(makeDNS({ description: 'updated desc' }));
    const user = userEvent.setup();

    render(<DNSDetail profile="default" dnsId="123456789012" />);
    await screen.findByText('DNS詳細: my-dns-zone');

    await user.click(screen.getByRole('button', { name: '編集' }));
    const input = screen.getByRole('textbox');
    await user.type(input, 'updated desc');
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(UpdateDNS).toHaveBeenCalledWith('default', '123456789012', 'updated desc');
    });
    expect(await screen.findByText('updated desc')).toBeInTheDocument();
  });

  it('adds a new record', async () => {
    vi.mocked(GetDNSDetail).mockResolvedValueOnce(makeDNS());
    vi.mocked(UpdateDNSRecords).mockResolvedValueOnce(makeDNS({ records: [makeRecord({ name: 'api' })] }));
    const user = userEvent.setup();

    render(<DNSDetail profile="default" dnsId="123456789012" />);
    await screen.findByText('レコードが登録されていません');

    await user.click(screen.getByRole('button', { name: '+ レコード追加' }));
    await user.type(screen.getByPlaceholderText('www (@はゾーン自身)'), 'api');
    await user.type(screen.getByPlaceholderText('192.0.2.1'), '192.0.2.1');
    await user.click(screen.getByRole('button', { name: '保存する' }));

    await waitFor(() => {
      expect(UpdateDNSRecords).toHaveBeenCalledWith('default', '123456789012', [
        expect.objectContaining({ name: 'api', type: 'A', rdata: '192.0.2.1', ttl: 3600 }),
      ]);
    });
    expect(await screen.findByText('api')).toBeInTheDocument();
  });

  it('deletes a record after confirmation', async () => {
    vi.mocked(GetDNSDetail).mockResolvedValueOnce(makeDNS({ records: [makeRecord()] }));
    vi.mocked(UpdateDNSRecords).mockResolvedValueOnce(makeDNS({ records: [] }));
    const user = userEvent.setup();

    render(<DNSDetail profile="default" dnsId="123456789012" />);
    await screen.findByText('www');

    await user.click(screen.getByRole('button', { name: '削除' }));
    expect(await screen.findByText('レコード「www」(A)を削除しますか？')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '削除する' }));

    await waitFor(() => {
      expect(UpdateDNSRecords).toHaveBeenCalledWith('default', '123456789012', []);
    });
    expect(await screen.findByText('レコードが登録されていません')).toBeInTheDocument();
  });
});
