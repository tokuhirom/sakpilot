import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BillList } from './BillList';
import { sakura } from '../../wailsjs/go/models';
import {
  GetBills,
  GetBillsByYear,
  GetBillsByYearMonth,
  GetBillDetails,
  DownloadBillDetailsCSV,
} from '../../wailsjs/go/main/App';

vi.mock('../../wailsjs/go/main/App');

function makeBill(overrides: Partial<sakura.BillInfo> = {}): sakura.BillInfo {
  return new sakura.BillInfo({
    id: '1',
    amount: 1000,
    date: '2026-01',
    paid: true,
    payLimit: '2026-02-28T00:00:00+09:00',
    ...overrides,
  });
}

function makeDetail(overrides: Partial<sakura.BillDetailInfo> = {}): sakura.BillDetailInfo {
  return new sakura.BillDetailInfo({
    id: '1',
    amount: 500,
    description: 'サーバー',
    serviceClassPath: 'cloud/server',
    usage: 1,
    formattedUsage: '1時間',
    zone: 'is1a',
    ...overrides,
  });
}

describe('BillList', () => {
  beforeEach(() => {
    vi.mocked(GetBills).mockReset();
    vi.mocked(GetBillsByYear).mockReset();
    vi.mocked(GetBillsByYearMonth).mockReset();
    vi.mocked(GetBillDetails).mockReset();
    vi.mocked(DownloadBillDetailsCSV).mockReset();
  });

  it('lists bills returned by GetBills when no filter is set', async () => {
    vi.mocked(GetBills).mockResolvedValueOnce([makeBill()]);

    render(<BillList profile="default" accountId="acc1" memberCode="member1" />);

    expect(await screen.findByText('2026年01月')).toBeInTheDocument();
    expect(GetBills).toHaveBeenCalledWith('default', 'acc1');
  });

  it('shows an empty state when there are no bills', async () => {
    vi.mocked(GetBills).mockResolvedValueOnce([]);

    render(<BillList profile="default" accountId="acc1" memberCode="member1" />);

    expect(await screen.findByText('請求データがありません')).toBeInTheDocument();
  });

  it('calls GetBillsByYear when only a year filter is selected', async () => {
    vi.mocked(GetBills).mockResolvedValueOnce([makeBill()]);
    vi.mocked(GetBillsByYear).mockResolvedValueOnce([makeBill({ date: '2026-03' })]);
    const user = userEvent.setup();

    render(<BillList profile="default" accountId="acc1" memberCode="member1" />);
    await screen.findByText('2026年01月');

    await user.selectOptions(screen.getByLabelText('年:'), '2026');

    expect(await screen.findByText('2026年03月')).toBeInTheDocument();
    expect(GetBillsByYear).toHaveBeenCalledWith('default', 'acc1', 2026);
  });

  it('calls GetBillsByYearMonth when both year and month filters are selected', async () => {
    vi.mocked(GetBills).mockResolvedValueOnce([makeBill()]);
    vi.mocked(GetBillsByYear).mockResolvedValueOnce([makeBill()]);
    vi.mocked(GetBillsByYearMonth).mockResolvedValueOnce([makeBill({ date: '2026-05' })]);
    const user = userEvent.setup();

    render(<BillList profile="default" accountId="acc1" memberCode="member1" />);
    await screen.findByText('2026年01月');

    await user.selectOptions(screen.getByLabelText('年:'), '2026');
    await screen.findByText('2026年01月');
    await user.selectOptions(screen.getByLabelText('月:'), '5');

    expect(await screen.findByText('2026年05月')).toBeInTheDocument();
    expect(GetBillsByYearMonth).toHaveBeenCalledWith('default', 'acc1', 2026, 5);
  });

  it('shows bill details and downloads CSV', async () => {
    vi.mocked(GetBills).mockResolvedValueOnce([makeBill()]);
    vi.mocked(GetBillDetails).mockResolvedValueOnce([makeDetail()]);
    vi.mocked(DownloadBillDetailsCSV).mockResolvedValueOnce();
    const user = userEvent.setup();

    render(<BillList profile="default" accountId="acc1" memberCode="member1" />);
    await user.click(await screen.findByText('2026年01月'));

    expect(await screen.findByText('サーバー')).toBeInTheDocument();
    expect(GetBillDetails).toHaveBeenCalledWith('default', 'member1', '1');

    await user.click(screen.getByRole('button', { name: 'CSVダウンロード' }));

    expect(DownloadBillDetailsCSV).toHaveBeenCalledWith('default', 'member1', '1', 'bill_202601.csv');
  });

  it('ignores a cancelled CSV download without showing an error', async () => {
    vi.mocked(GetBills).mockResolvedValueOnce([makeBill()]);
    vi.mocked(GetBillDetails).mockResolvedValueOnce([makeDetail()]);
    vi.mocked(DownloadBillDetailsCSV).mockRejectedValueOnce(new Error('cancelled'));
    const user = userEvent.setup();

    render(<BillList profile="default" accountId="acc1" memberCode="member1" />);
    await user.click(await screen.findByText('2026年01月'));
    await user.click(screen.getByRole('button', { name: 'CSVダウンロード' }));

    expect(screen.queryByText(/CSVダウンロードに失敗しました/)).not.toBeInTheDocument();
  });

  it('shows an error message when the CSV download fails', async () => {
    vi.mocked(GetBills).mockResolvedValueOnce([makeBill()]);
    vi.mocked(GetBillDetails).mockResolvedValueOnce([makeDetail()]);
    vi.mocked(DownloadBillDetailsCSV).mockRejectedValueOnce(new Error('network error'));
    const user = userEvent.setup();

    render(<BillList profile="default" accountId="acc1" memberCode="member1" />);
    await user.click(await screen.findByText('2026年01月'));
    await user.click(screen.getByRole('button', { name: 'CSVダウンロード' }));

    expect(await screen.findByText(/CSVダウンロードに失敗しました: network error/)).toBeInTheDocument();
  });
});
