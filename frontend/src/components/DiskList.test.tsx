import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DiskList } from './DiskList';
import { sakura } from '../../wailsjs/go/models';
import { GetDisks, DeleteDisk } from '../../wailsjs/go/main/App';

vi.mock('../../wailsjs/go/main/App');

const zones: sakura.ZoneInfo[] = [
  new sakura.ZoneInfo({ id: 'is1a', name: '石狩第1ゾーン' }),
];

function makeDisk(overrides: Partial<sakura.DiskInfo> = {}): sakura.DiskInfo {
  return new sakura.DiskInfo({
    id: '123456789012',
    name: 'my-disk',
    description: '',
    zone: 'is1a',
    sizeGb: 20,
    diskPlanName: 'SSD',
    connection: 'virtio',
    serverId: '',
    serverName: '',
    tags: [],
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  });
}

describe('DiskList', () => {
  beforeEach(() => {
    vi.mocked(GetDisks).mockReset();
    vi.mocked(DeleteDisk).mockReset();
  });

  it('lists disks returned by GetDisks', async () => {
    vi.mocked(GetDisks).mockResolvedValueOnce([makeDisk()]);

    render(<DiskList profile="default" zone="is1a" zones={zones} onZoneChange={() => {}} />);

    expect(await screen.findByText('my-disk')).toBeInTheDocument();
    expect(GetDisks).toHaveBeenCalledWith('default', 'is1a');
  });

  it('shows an empty state when there are no disks', async () => {
    vi.mocked(GetDisks).mockResolvedValueOnce([]);

    render(<DiskList profile="default" zone="is1a" zones={zones} onZoneChange={() => {}} />);

    expect(await screen.findByText('ディスクがありません')).toBeInTheDocument();
  });

  it('shows (未接続) when the disk is not connected to a server', async () => {
    vi.mocked(GetDisks).mockResolvedValueOnce([makeDisk({ serverName: '' })]);

    render(<DiskList profile="default" zone="is1a" zones={zones} onZoneChange={() => {}} />);

    expect(await screen.findByText('接続先: (未接続)')).toBeInTheDocument();
  });

  it('deletes a disk after confirmation', async () => {
    vi.mocked(GetDisks)
      .mockResolvedValueOnce([makeDisk()])
      .mockResolvedValueOnce([]);
    vi.mocked(DeleteDisk).mockResolvedValueOnce(undefined);
    const user = userEvent.setup();

    render(<DiskList profile="default" zone="is1a" zones={zones} onZoneChange={() => {}} />);
    await screen.findByText('my-disk');

    await user.click(screen.getByRole('button', { name: '削除' }));

    expect(await screen.findByText('ディスク「my-disk」を削除しますか？')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '削除する' }));

    await waitFor(() => {
      expect(DeleteDisk).toHaveBeenCalledWith('default', 'is1a', '123456789012');
    });
    await waitFor(() => {
      expect(GetDisks).toHaveBeenCalledTimes(2);
    });
  });

  it('cancels deletion without calling DeleteDisk', async () => {
    vi.mocked(GetDisks).mockResolvedValueOnce([makeDisk()]);
    const user = userEvent.setup();

    render(<DiskList profile="default" zone="is1a" zones={zones} onZoneChange={() => {}} />);
    await screen.findByText('my-disk');

    await user.click(screen.getByRole('button', { name: '削除' }));
    expect(await screen.findByText('ディスク「my-disk」を削除しますか？')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'キャンセル' }));

    expect(screen.queryByText('ディスク「my-disk」を削除しますか？')).not.toBeInTheDocument();
    expect(DeleteDisk).not.toHaveBeenCalled();
  });
});
