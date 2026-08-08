import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GSLBList } from './GSLBList';
import { sakura } from '../../wailsjs/go/models';
import { GetGSLBList, DeleteGSLB, CreateGSLB } from '../../wailsjs/go/main/App';

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
    ...overrides,
  });
}

describe('GSLBList', () => {
  beforeEach(() => {
    vi.mocked(GetGSLBList).mockReset();
    vi.mocked(DeleteGSLB).mockReset();
    vi.mocked(CreateGSLB).mockReset();
  });

  it('lists GSLBs returned by GetGSLBList', async () => {
    vi.mocked(GetGSLBList).mockResolvedValueOnce([makeGSLB()]);

    render(<GSLBList profile="default" onSelectGSLB={() => {}} />);

    expect(await screen.findByText('my-gslb')).toBeInTheDocument();
    expect(GetGSLBList).toHaveBeenCalledWith('default');
  });

  it('shows an empty state when there are no GSLBs', async () => {
    vi.mocked(GetGSLBList).mockResolvedValueOnce([]);

    render(<GSLBList profile="default" onSelectGSLB={() => {}} />);

    expect(await screen.findByText('GSLBがありません')).toBeInTheDocument();
  });

  it('navigates to detail when a row is clicked', async () => {
    vi.mocked(GetGSLBList).mockResolvedValueOnce([makeGSLB()]);
    const onSelectGSLB = vi.fn();
    const user = userEvent.setup();

    render(<GSLBList profile="default" onSelectGSLB={onSelectGSLB} />);
    await screen.findByText('my-gslb');

    await user.click(screen.getByText('my-gslb'));

    expect(onSelectGSLB).toHaveBeenCalledWith('123456789012');
  });

  it('deletes a GSLB after confirmation without triggering row navigation', async () => {
    vi.mocked(GetGSLBList)
      .mockResolvedValueOnce([makeGSLB()])
      .mockResolvedValueOnce([]);
    vi.mocked(DeleteGSLB).mockResolvedValueOnce(undefined);
    const onSelectGSLB = vi.fn();
    const user = userEvent.setup();

    render(<GSLBList profile="default" onSelectGSLB={onSelectGSLB} />);
    await screen.findByText('my-gslb');

    await user.click(screen.getByRole('button', { name: '削除' }));

    expect(onSelectGSLB).not.toHaveBeenCalled();
    expect(await screen.findByText('GSLB「my-gslb」を削除しますか？')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '削除する' }));

    await waitFor(() => {
      expect(DeleteGSLB).toHaveBeenCalledWith('default', '123456789012');
    });
    await waitFor(() => {
      expect(GetGSLBList).toHaveBeenCalledTimes(2);
    });
  });

  it('creates a GSLB', async () => {
    vi.mocked(GetGSLBList)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeGSLB({ name: 'new-gslb' })]);
    vi.mocked(CreateGSLB).mockResolvedValueOnce(makeGSLB({ name: 'new-gslb' }));
    const user = userEvent.setup();

    render(<GSLBList profile="default" onSelectGSLB={() => {}} />);
    await screen.findByText('GSLBがありません');

    await user.click(screen.getByRole('button', { name: '+ GSLB作成' }));
    await user.type(screen.getByPlaceholderText('my-gslb'), 'new-gslb');
    await user.click(screen.getByRole('button', { name: '作成する' }));

    await waitFor(() => {
      expect(CreateGSLB).toHaveBeenCalledWith(
        'default',
        'new-gslb',
        '',
        expect.objectContaining({ healthCheck: expect.objectContaining({ protocol: 'ping' }) }),
      );
    });
    expect(await screen.findByText('new-gslb')).toBeInTheDocument();
  });
});
