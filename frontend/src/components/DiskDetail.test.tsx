import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DiskDetail } from './DiskDetail';
import { sakura } from '../../wailsjs/go/models';
import {
  GetDiskDetail,
  UpdateDisk,
  ConnectDiskToServer,
  DisconnectDiskFromServer,
  GetServers,
} from '../../wailsjs/go/main/App';

vi.mock('../../wailsjs/go/main/App');

function makeDisk(overrides: Partial<sakura.DiskInfo> = {}): sakura.DiskInfo {
  return new sakura.DiskInfo({
    id: '123456789012',
    name: 'my-disk',
    description: '',
    zone: 'is1a',
    sizeGb: 20,
    diskPlanName: 'SSDプラン',
    connection: 'virtio',
    serverId: '',
    serverName: '',
    tags: [],
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  });
}

function makeServer(overrides: Partial<sakura.ServerInfo> = {}): sakura.ServerInfo {
  return new sakura.ServerInfo({
    id: '999999999999',
    name: 'my-server',
    description: '',
    zone: 'is1a',
    cpu: 1,
    memory: 1,
    status: 'up',
    ipAddresses: [],
    tags: [],
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  });
}

describe('DiskDetail', () => {
  beforeEach(() => {
    vi.mocked(GetDiskDetail).mockReset();
    vi.mocked(UpdateDisk).mockReset();
    vi.mocked(ConnectDiskToServer).mockReset();
    vi.mocked(DisconnectDiskFromServer).mockReset();
    vi.mocked(GetServers).mockReset();
  });

  it('shows basic disk information', async () => {
    vi.mocked(GetDiskDetail).mockResolvedValueOnce(makeDisk());

    render(<DiskDetail profile="default" zone="is1a" diskId="123456789012" />);

    expect(await screen.findByText('ディスク詳細: my-disk')).toBeInTheDocument();
    expect(screen.getByText('20 GB')).toBeInTheDocument();
    expect(screen.getByText('SSDプラン')).toBeInTheDocument();
    expect(GetDiskDetail).toHaveBeenCalledWith('default', 'is1a', '123456789012');
  });

  it('shows (未接続) when the disk is not connected to a server', async () => {
    vi.mocked(GetDiskDetail).mockResolvedValueOnce(makeDisk());

    render(<DiskDetail profile="default" zone="is1a" diskId="123456789012" />);

    expect(await screen.findByText('(未接続)')).toBeInTheDocument();
  });

  it('updates the name, description and tags', async () => {
    vi.mocked(GetDiskDetail).mockResolvedValueOnce(makeDisk());
    vi.mocked(UpdateDisk).mockResolvedValueOnce(makeDisk({ name: 'renamed-disk', description: 'new desc', tags: ['a', 'b'] }));
    const user = userEvent.setup();

    render(<DiskDetail profile="default" zone="is1a" diskId="123456789012" />);
    await screen.findByText('ディスク詳細: my-disk');

    await user.click(screen.getByRole('button', { name: '編集' }));
    const nameInput = screen.getByDisplayValue('my-disk');
    await user.clear(nameInput);
    await user.type(nameInput, 'renamed-disk');
    await user.type(screen.getByPlaceholderText('カンマ区切り(任意)'), 'a, b');
    await user.click(screen.getByRole('button', { name: '保存する' }));

    await waitFor(() => {
      expect(UpdateDisk).toHaveBeenCalledWith('default', 'is1a', '123456789012', 'renamed-disk', '', ['a', 'b']);
    });
    expect(await screen.findByText('ディスク詳細: renamed-disk')).toBeInTheDocument();
  });

  it('connects the disk to a server', async () => {
    vi.mocked(GetDiskDetail)
      .mockResolvedValueOnce(makeDisk())
      .mockResolvedValueOnce(makeDisk({ serverId: '999999999999', serverName: 'my-server' }));
    vi.mocked(GetServers).mockResolvedValueOnce([makeServer()]);
    vi.mocked(ConnectDiskToServer).mockResolvedValueOnce(undefined);
    const user = userEvent.setup();

    render(<DiskDetail profile="default" zone="is1a" diskId="123456789012" />);
    await screen.findByText('ディスク詳細: my-disk');

    await user.click(screen.getByRole('button', { name: '変更' }));
    await waitFor(() => {
      expect(GetServers).toHaveBeenCalledWith('default', 'is1a');
    });

    await user.selectOptions(screen.getByRole('combobox'), '999999999999');
    await user.click(screen.getByRole('button', { name: '接続する' }));

    await waitFor(() => {
      expect(ConnectDiskToServer).toHaveBeenCalledWith('default', 'is1a', '123456789012', '999999999999');
    });
    expect(await screen.findByText('my-server')).toBeInTheDocument();
  });

  it('disconnects the disk from its server', async () => {
    vi.mocked(GetDiskDetail)
      .mockResolvedValueOnce(makeDisk({ serverId: '999999999999', serverName: 'my-server' }))
      .mockResolvedValueOnce(makeDisk());
    vi.mocked(GetServers).mockResolvedValueOnce([makeServer()]);
    vi.mocked(DisconnectDiskFromServer).mockResolvedValueOnce(undefined);
    const user = userEvent.setup();

    render(<DiskDetail profile="default" zone="is1a" diskId="123456789012" />);
    await screen.findByText('my-server');

    await user.click(screen.getByRole('button', { name: '変更' }));
    await user.click(screen.getByRole('button', { name: '接続を解除する' }));

    await waitFor(() => {
      expect(DisconnectDiskFromServer).toHaveBeenCalledWith('default', 'is1a', '123456789012');
    });
    expect(await screen.findByText('(未接続)')).toBeInTheDocument();
  });
});
