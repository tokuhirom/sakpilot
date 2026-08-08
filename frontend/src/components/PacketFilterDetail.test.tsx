import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PacketFilterDetail } from './PacketFilterDetail';
import { sakura } from '../../wailsjs/go/models';
import { GetPacketFilterDetail, UpdatePacketFilter } from '../../wailsjs/go/main/App';

vi.mock('../../wailsjs/go/main/App');

function makePacketFilter(overrides: Partial<sakura.PacketFilterInfo> = {}): sakura.PacketFilterInfo {
  return new sakura.PacketFilterInfo({
    id: '123456789012',
    name: 'my-filter',
    description: '',
    rules: [],
    ...overrides,
  });
}

function makeRule(overrides: Partial<sakura.PacketFilterRuleInfo> = {}): sakura.PacketFilterRuleInfo {
  return new sakura.PacketFilterRuleInfo({
    protocol: 'tcp',
    sourceNetwork: '',
    sourcePort: '',
    destinationPort: '80',
    action: 'allow',
    description: '',
    ...overrides,
  });
}

describe('PacketFilterDetail', () => {
  beforeEach(() => {
    vi.mocked(GetPacketFilterDetail).mockReset();
    vi.mocked(UpdatePacketFilter).mockReset();
  });

  it('shows the placeholder when there are no rules', async () => {
    vi.mocked(GetPacketFilterDetail).mockResolvedValueOnce(makePacketFilter());

    render(<PacketFilterDetail profile="default" zone="is1a" packetFilterId="123456789012" />);

    expect(await screen.findByText('ルールがありません')).toBeInTheDocument();
  });

  it('lists existing rules', async () => {
    vi.mocked(GetPacketFilterDetail).mockResolvedValueOnce(makePacketFilter({ rules: [makeRule()] }));

    render(<PacketFilterDetail profile="default" zone="is1a" packetFilterId="123456789012" />);

    expect(await screen.findByText('許可')).toBeInTheDocument();
    expect(screen.getByText('TCP')).toBeInTheDocument();
    expect(screen.getByText('80')).toBeInTheDocument();
  });

  it('updates the name and description', async () => {
    vi.mocked(GetPacketFilterDetail).mockResolvedValueOnce(makePacketFilter());
    vi.mocked(UpdatePacketFilter).mockResolvedValueOnce(makePacketFilter({ description: 'updated desc' }));
    const user = userEvent.setup();

    render(<PacketFilterDetail profile="default" zone="is1a" packetFilterId="123456789012" />);
    await screen.findByText('パケットフィルター詳細: my-filter');

    await user.click(screen.getByRole('button', { name: '編集' }));
    await user.type(screen.getByPlaceholderText('説明'), 'updated desc');
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(UpdatePacketFilter).toHaveBeenCalledWith('default', 'is1a', '123456789012', 'my-filter', 'updated desc', []);
    });
    expect(await screen.findByText('updated desc')).toBeInTheDocument();
  });

  it('adds a new rule', async () => {
    vi.mocked(GetPacketFilterDetail).mockResolvedValueOnce(makePacketFilter());
    vi.mocked(UpdatePacketFilter).mockResolvedValueOnce(makePacketFilter({ rules: [makeRule({ destinationPort: '443' })] }));
    const user = userEvent.setup();

    render(<PacketFilterDetail profile="default" zone="is1a" packetFilterId="123456789012" />);
    await screen.findByText('ルールがありません');

    await user.click(screen.getByRole('button', { name: '+ ルール追加' }));
    await user.type(screen.getByPlaceholderText('80 (空欄で全て)'), '443');
    await user.click(screen.getByRole('button', { name: '保存する' }));

    await waitFor(() => {
      expect(UpdatePacketFilter).toHaveBeenCalledWith('default', 'is1a', '123456789012', 'my-filter', '', [
        expect.objectContaining({ protocol: 'tcp', action: 'allow', destinationPort: '443' }),
      ]);
    });
    expect(await screen.findByText('443')).toBeInTheDocument();
  });

  it('deletes a rule after confirmation', async () => {
    vi.mocked(GetPacketFilterDetail).mockResolvedValueOnce(makePacketFilter({ rules: [makeRule()] }));
    vi.mocked(UpdatePacketFilter).mockResolvedValueOnce(makePacketFilter({ rules: [] }));
    const user = userEvent.setup();

    render(<PacketFilterDetail profile="default" zone="is1a" packetFilterId="123456789012" />);
    await screen.findByText('許可');

    await user.click(screen.getByRole('button', { name: '削除' }));
    expect(await screen.findByText('ルール #1 を削除しますか？')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '削除する' }));

    await waitFor(() => {
      expect(UpdatePacketFilter).toHaveBeenCalledWith('default', 'is1a', '123456789012', 'my-filter', '', []);
    });
    expect(await screen.findByText('ルールがありません')).toBeInTheDocument();
  });
});
