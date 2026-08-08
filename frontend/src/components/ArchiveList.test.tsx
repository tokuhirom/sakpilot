import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ArchiveList } from './ArchiveList';
import { sakura } from '../../wailsjs/go/models';
import {
  GetArchives,
  DeleteArchive,
  GetDisks,
  CreateArchive,
  CreateBlankArchive,
  OpenArchiveFTP,
  CloseArchiveFTP,
  ShareArchive,
  CreateArchiveFromShared,
} from '../../wailsjs/go/main/App';

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

function makeDisk(overrides: Partial<sakura.DiskInfo> = {}): sakura.DiskInfo {
  return new sakura.DiskInfo({
    id: '999',
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

describe('ArchiveList', () => {
  beforeEach(() => {
    vi.mocked(GetArchives).mockReset();
    vi.mocked(DeleteArchive).mockReset();
    vi.mocked(GetDisks).mockReset();
    vi.mocked(CreateArchive).mockReset();
    vi.mocked(CreateBlankArchive).mockReset();
    vi.mocked(OpenArchiveFTP).mockReset();
    vi.mocked(CloseArchiveFTP).mockReset();
    vi.mocked(ShareArchive).mockReset();
    vi.mocked(CreateArchiveFromShared).mockReset();
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

  it('creates a blank archive and shows the FTP credentials', async () => {
    vi.mocked(GetArchives)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeArchive({ availability: 'uploading' })]);
    vi.mocked(GetDisks).mockResolvedValueOnce([]);
    vi.mocked(CreateBlankArchive).mockResolvedValueOnce(new sakura.ArchiveWithFTP({
      archive: makeArchive({ availability: 'uploading' }),
      ftpServer: new sakura.FTPServerInfo({
        hostName: 'sac-is1a-ftp.example.jp',
        ipAddress: '192.0.2.1',
        user: 'archive123',
        password: 'secret-password',
      }),
    }));
    const user = userEvent.setup();

    render(<ArchiveList profile="default" zone="is1a" zones={zones} onZoneChange={() => {}} />);
    await screen.findByText('アーカイブがありません');

    await user.click(screen.getByRole('button', { name: '+ アーカイブ作成' }));
    await user.type(screen.getByPlaceholderText('my-archive'), 'new-archive');
    await user.click(screen.getByRole('button', { name: '作成する' }));

    await waitFor(() => {
      expect(CreateBlankArchive).toHaveBeenCalledWith('default', 'is1a', 'new-archive', '', [], 20);
    });
    expect(await screen.findByText('secret-password')).toBeInTheDocument();
    expect(screen.getByText('archive123')).toBeInTheDocument();
  });

  it('creates an archive from an existing disk', async () => {
    vi.mocked(GetArchives)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    vi.mocked(GetDisks).mockResolvedValueOnce([makeDisk()]);
    vi.mocked(CreateArchive).mockResolvedValueOnce(makeArchive());
    const user = userEvent.setup();

    render(<ArchiveList profile="default" zone="is1a" zones={zones} onZoneChange={() => {}} />);
    await screen.findByText('アーカイブがありません');

    await user.click(screen.getByRole('button', { name: '+ アーカイブ作成' }));
    await user.selectOptions(screen.getByLabelText('作成方法'), 'disk');
    await screen.findByText('my-disk');
    await user.selectOptions(screen.getByLabelText('コピー元ディスク'), '999');
    await user.type(screen.getByPlaceholderText('my-archive'), 'from-disk-archive');
    await user.click(screen.getByRole('button', { name: '作成する' }));

    await waitFor(() => {
      expect(CreateArchive).toHaveBeenCalledWith('default', 'is1a', 'from-disk-archive', '', [], '999', '');
    });
  });

  it('shares an archive and displays the share key', async () => {
    vi.mocked(GetArchives).mockResolvedValueOnce([makeArchive()]);
    vi.mocked(ShareArchive).mockResolvedValueOnce('is1a:123456789012:xxx');
    const user = userEvent.setup();

    render(<ArchiveList profile="default" zone="is1a" zones={zones} onZoneChange={() => {}} />);
    await screen.findByText('my-archive');

    await user.click(screen.getByRole('button', { name: '共有' }));

    expect(ShareArchive).toHaveBeenCalledWith('default', 'is1a', '123456789012');
    await waitFor(() => {
      expect(screen.getByDisplayValue('is1a:123456789012:xxx')).toBeInTheDocument();
    });
  });

  it('opens and closes FTP for an archive', async () => {
    vi.mocked(GetArchives)
      .mockResolvedValueOnce([makeArchive()])
      .mockResolvedValueOnce([makeArchive()]);
    vi.mocked(OpenArchiveFTP).mockResolvedValueOnce(new sakura.FTPServerInfo({
      hostName: 'sac-is1a-ftp.example.jp',
      ipAddress: '192.0.2.1',
      user: 'archive123',
      password: 'secret-password',
    }));
    vi.mocked(CloseArchiveFTP).mockResolvedValueOnce(undefined);
    const user = userEvent.setup();

    render(<ArchiveList profile="default" zone="is1a" zones={zones} onZoneChange={() => {}} />);
    await screen.findByText('my-archive');

    await user.click(screen.getByRole('button', { name: 'FTP' }));

    expect(OpenArchiveFTP).toHaveBeenCalledWith('default', 'is1a', '123456789012', false);
    await screen.findByText('secret-password');

    await user.click(screen.getByRole('button', { name: 'FTPを終了して閉じる' }));

    await waitFor(() => {
      expect(CloseArchiveFTP).toHaveBeenCalledWith('default', 'is1a', '123456789012');
    });
  });

  it('creates an archive from a shared key', async () => {
    vi.mocked(GetArchives).mockResolvedValueOnce([]);
    vi.mocked(CreateArchiveFromShared).mockResolvedValueOnce(makeArchive());
    const user = userEvent.setup();

    render(<ArchiveList profile="default" zone="is1a" zones={zones} onZoneChange={() => {}} />);
    await screen.findByText('アーカイブがありません');

    await user.click(screen.getByRole('button', { name: '共有キーから複製' }));
    await user.type(screen.getByPlaceholderText('ゾーン:アーカイブID:トークン'), 'is1a:999:token');
    await user.type(screen.getByPlaceholderText('my-archive'), 'shared-copy');
    await user.click(screen.getByRole('button', { name: '複製する' }));

    await waitFor(() => {
      expect(CreateArchiveFromShared).toHaveBeenCalledWith('default', 'is1a', 'is1a:999:token', 'shared-copy', '', []);
    });
  });
});
