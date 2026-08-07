import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ArchiveList } from './ArchiveList';
import { sakura } from '../../wailsjs/go/models';
import { GetArchives, DeleteArchive } from '../../wailsjs/go/main/App';

vi.mock('../../wailsjs/go/main/App');

const zones: sakura.ZoneInfo[] = [
  new sakura.ZoneInfo({ id: 'is1a', name: '石狩第1ゾーン' }),
];

function makeArchive(overrides: Partial<sakura.ArchiveInfo> = {}): sakura.ArchiveInfo {
  return new sakura.ArchiveInfo({
    id: '123456789012',
    name: 'my-archive',
    description: '',
    sizeGb: 20,
    scope: 'user',
    availability: 'available',
    tags: [],
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  });
}

describe('ArchiveList', () => {
  beforeEach(() => {
    vi.mocked(GetArchives).mockReset();
    vi.mocked(DeleteArchive).mockReset();
  });

  it('lists archives returned by GetArchives', async () => {
    vi.mocked(GetArchives).mockResolvedValueOnce([makeArchive()]);

    render(<ArchiveList profile="default" zone="is1a" zones={zones} onZoneChange={() => {}} />);

    expect(await screen.findByText('my-archive')).toBeInTheDocument();
    expect(GetArchives).toHaveBeenCalledWith('default', 'is1a');
  });

  it('shows an empty state when there are no archives', async () => {
    vi.mocked(GetArchives).mockResolvedValueOnce([]);

    render(<ArchiveList profile="default" zone="is1a" zones={zones} onZoneChange={() => {}} />);

    expect(await screen.findByText('アーカイブがありません')).toBeInTheDocument();
  });

  it('disables 削除 while the archive is uploading', async () => {
    vi.mocked(GetArchives).mockResolvedValueOnce([makeArchive({ availability: 'uploading' })]);

    render(<ArchiveList profile="default" zone="is1a" zones={zones} onZoneChange={() => {}} />);
    await screen.findByText('my-archive');

    expect(screen.getByRole('button', { name: '削除' })).toBeDisabled();
  });

  it('disables 削除 while the archive is migrating', async () => {
    vi.mocked(GetArchives).mockResolvedValueOnce([makeArchive({ availability: 'migrating' })]);

    render(<ArchiveList profile="default" zone="is1a" zones={zones} onZoneChange={() => {}} />);
    await screen.findByText('my-archive');

    expect(screen.getByRole('button', { name: '削除' })).toBeDisabled();
  });

  it('enables 削除 when the archive is available', async () => {
    vi.mocked(GetArchives).mockResolvedValueOnce([makeArchive({ availability: 'available' })]);

    render(<ArchiveList profile="default" zone="is1a" zones={zones} onZoneChange={() => {}} />);
    await screen.findByText('my-archive');

    expect(screen.getByRole('button', { name: '削除' })).toBeEnabled();
  });

  it('deletes an archive after confirmation', async () => {
    vi.mocked(GetArchives)
      .mockResolvedValueOnce([makeArchive()])
      .mockResolvedValueOnce([]);
    vi.mocked(DeleteArchive).mockResolvedValueOnce(undefined);
    const user = userEvent.setup();

    render(<ArchiveList profile="default" zone="is1a" zones={zones} onZoneChange={() => {}} />);
    await screen.findByText('my-archive');

    await user.click(screen.getByRole('button', { name: '削除' }));

    expect(await screen.findByText('アーカイブ「my-archive」を削除しますか？')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '削除する' }));

    await waitFor(() => {
      expect(DeleteArchive).toHaveBeenCalledWith('default', 'is1a', '123456789012');
    });
    await waitFor(() => {
      expect(GetArchives).toHaveBeenCalledTimes(2);
    });
  });

  it('cancels deletion without calling DeleteArchive', async () => {
    vi.mocked(GetArchives).mockResolvedValueOnce([makeArchive()]);
    const user = userEvent.setup();

    render(<ArchiveList profile="default" zone="is1a" zones={zones} onZoneChange={() => {}} />);
    await screen.findByText('my-archive');

    await user.click(screen.getByRole('button', { name: '削除' }));
    expect(await screen.findByText('アーカイブ「my-archive」を削除しますか？')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'キャンセル' }));

    expect(screen.queryByText('アーカイブ「my-archive」を削除しますか？')).not.toBeInTheDocument();
    expect(DeleteArchive).not.toHaveBeenCalled();
  });
});
