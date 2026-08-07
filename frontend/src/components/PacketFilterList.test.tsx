import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PacketFilterList } from './PacketFilterList';
import { sakura } from '../../wailsjs/go/models';
import { GetPacketFilters, DeletePacketFilter } from '../../wailsjs/go/main/App';

vi.mock('../../wailsjs/go/main/App');

const zones: sakura.ZoneInfo[] = [
  new sakura.ZoneInfo({ id: 'is1a', name: '石狩第1ゾーン' }),
];

function makePacketFilter(overrides: Partial<sakura.PacketFilterInfo> = {}): sakura.PacketFilterInfo {
  return new sakura.PacketFilterInfo({
    id: '123456789012',
    name: 'my-filter',
    description: 'test filter',
    rules: [],
    ...overrides,
  });
}

describe('PacketFilterList', () => {
  beforeEach(() => {
    vi.mocked(GetPacketFilters).mockReset();
    vi.mocked(DeletePacketFilter).mockReset();
  });

  it('lists packet filters returned by GetPacketFilters', async () => {
    vi.mocked(GetPacketFilters).mockResolvedValueOnce([makePacketFilter()]);

    render(<PacketFilterList profile="default" zone="is1a" zones={zones} onZoneChange={() => {}} onSelectPacketFilter={() => {}} />);

    expect(await screen.findByText('my-filter')).toBeInTheDocument();
    expect(GetPacketFilters).toHaveBeenCalledWith('default', 'is1a');
  });

  it('shows an empty state when there are no packet filters', async () => {
    vi.mocked(GetPacketFilters).mockResolvedValueOnce([]);

    render(<PacketFilterList profile="default" zone="is1a" zones={zones} onZoneChange={() => {}} onSelectPacketFilter={() => {}} />);

    expect(await screen.findByText('パケットフィルターがありません')).toBeInTheDocument();
  });

  it('navigates to detail when a row is clicked', async () => {
    vi.mocked(GetPacketFilters).mockResolvedValueOnce([makePacketFilter()]);
    const onSelectPacketFilter = vi.fn();
    const user = userEvent.setup();

    render(<PacketFilterList profile="default" zone="is1a" zones={zones} onZoneChange={() => {}} onSelectPacketFilter={onSelectPacketFilter} />);
    await screen.findByText('my-filter');

    await user.click(screen.getByText('my-filter'));

    expect(onSelectPacketFilter).toHaveBeenCalledWith('123456789012');
  });

  it('deletes a packet filter after confirmation without triggering row navigation', async () => {
    vi.mocked(GetPacketFilters)
      .mockResolvedValueOnce([makePacketFilter()])
      .mockResolvedValueOnce([]);
    vi.mocked(DeletePacketFilter).mockResolvedValueOnce(undefined);
    const onSelectPacketFilter = vi.fn();
    const user = userEvent.setup();

    render(<PacketFilterList profile="default" zone="is1a" zones={zones} onZoneChange={() => {}} onSelectPacketFilter={onSelectPacketFilter} />);
    await screen.findByText('my-filter');

    await user.click(screen.getByRole('button', { name: '削除' }));

    expect(onSelectPacketFilter).not.toHaveBeenCalled();
    expect(await screen.findByText('パケットフィルター「my-filter」を削除しますか？')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '削除する' }));

    await waitFor(() => {
      expect(DeletePacketFilter).toHaveBeenCalledWith('default', 'is1a', '123456789012');
    });
    await waitFor(() => {
      expect(GetPacketFilters).toHaveBeenCalledTimes(2);
    });
  });
});
