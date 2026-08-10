import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SimpleNotificationList } from './SimpleNotificationList';
import { simplenotification } from '../../wailsjs/go/models';
import {
  GetSimpleNotificationDestinations,
  CreateSimpleNotificationDestination,
  UpdateSimpleNotificationDestination,
  DeleteSimpleNotificationDestination,
  GetSimpleNotificationGroups,
  CreateSimpleNotificationGroup,
  DeleteSimpleNotificationGroup,
  SendSimpleNotificationGroupMessage,
  GetSimpleNotificationRoutings,
  CreateSimpleNotificationRouting,
  DeleteSimpleNotificationRouting,
} from '../../wailsjs/go/main/App';

vi.mock('../../wailsjs/go/main/App');

function renderList() {
  return render(<SimpleNotificationList profile="default" />);
}

function makeDestination(overrides: Partial<simplenotification.DestinationInfo> = {}): simplenotification.DestinationInfo {
  return new simplenotification.DestinationInfo({
    id: '100000000001',
    name: 'ops-email',
    description: '',
    type: 'email',
    value: 'ops@example.com',
    tags: [],
    createdAt: '2026-01-01T00:00:00+09:00',
    modifiedAt: '2026-01-01T00:00:00+09:00',
    ...overrides,
  });
}

function makeGroup(overrides: Partial<simplenotification.GroupInfo> = {}): simplenotification.GroupInfo {
  return new simplenotification.GroupInfo({
    id: '200000000001',
    name: 'sre-team',
    description: '',
    destinations: ['100000000001'],
    tags: [],
    createdAt: '2026-01-01T00:00:00+09:00',
    modifiedAt: '2026-01-01T00:00:00+09:00',
    ...overrides,
  });
}

function makeRouting(overrides: Partial<simplenotification.RoutingInfo> = {}): simplenotification.RoutingInfo {
  return new simplenotification.RoutingInfo({
    id: '300000000001',
    name: 'critical-alerts',
    description: '',
    sourceId: '101122334455',
    targetGroupId: '200000000001',
    matchLabels: [{ name: 'severity', value: 'critical' }],
    priorityRank: 1,
    tags: [],
    createdAt: '2026-01-01T00:00:00+09:00',
    modifiedAt: '2026-01-01T00:00:00+09:00',
    ...overrides,
  });
}

describe('SimpleNotificationList', () => {
  beforeEach(() => {
    vi.mocked(GetSimpleNotificationDestinations).mockReset();
    vi.mocked(CreateSimpleNotificationDestination).mockReset();
    vi.mocked(UpdateSimpleNotificationDestination).mockReset();
    vi.mocked(DeleteSimpleNotificationDestination).mockReset();
    vi.mocked(GetSimpleNotificationGroups).mockReset();
    vi.mocked(CreateSimpleNotificationGroup).mockReset();
    vi.mocked(DeleteSimpleNotificationGroup).mockReset();
    vi.mocked(SendSimpleNotificationGroupMessage).mockReset();
    vi.mocked(GetSimpleNotificationRoutings).mockReset();
    vi.mocked(CreateSimpleNotificationRouting).mockReset();
    vi.mocked(DeleteSimpleNotificationRouting).mockReset();

    // 各タブは送信先・グループ・ルーティングをまとめて読み込むため、テスト対象外のリソースにはデフォルト値を設定しておく
    vi.mocked(GetSimpleNotificationGroups).mockResolvedValue([]);
    vi.mocked(GetSimpleNotificationRoutings).mockResolvedValue([]);
  });

  it('shows destinations on the default tab', async () => {
    vi.mocked(GetSimpleNotificationDestinations).mockResolvedValue([makeDestination()]);

    renderList();

    expect(await screen.findByText('ops-email')).toBeInTheDocument();
    expect(GetSimpleNotificationDestinations).toHaveBeenCalledWith('default');
    expect(screen.getByText('ops@example.com')).toBeInTheDocument();
  });

  it('shows an empty state when there are no destinations', async () => {
    vi.mocked(GetSimpleNotificationDestinations).mockResolvedValue([]);

    renderList();

    expect(await screen.findByText('送信先がありません')).toBeInTheDocument();
  });

  it('creates a destination from the create dialog', async () => {
    vi.mocked(GetSimpleNotificationDestinations)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeDestination()]);
    vi.mocked(CreateSimpleNotificationDestination).mockResolvedValueOnce(makeDestination());
    const user = userEvent.setup();

    renderList();
    await screen.findByText('送信先がありません');

    await user.click(screen.getByRole('button', { name: '+ 送信先作成' }));
    await user.type(screen.getByPlaceholderText('my-destination'), 'ops-email');
    await user.type(screen.getByPlaceholderText('alert@example.com'), 'ops@example.com');
    await user.click(screen.getByRole('button', { name: '作成する' }));

    expect(CreateSimpleNotificationDestination).toHaveBeenCalledWith('default', 'ops-email', '', 'email', 'ops@example.com', []);
    expect(await screen.findByText('ops-email')).toBeInTheDocument();
  });

  it('edits a destination from the edit dialog', async () => {
    vi.mocked(GetSimpleNotificationDestinations)
      .mockResolvedValueOnce([makeDestination()])
      .mockResolvedValueOnce([makeDestination({ name: 'ops-email-updated' })]);
    vi.mocked(UpdateSimpleNotificationDestination).mockResolvedValueOnce(makeDestination({ name: 'ops-email-updated' }));
    const user = userEvent.setup();

    renderList();
    await screen.findByText('ops-email');

    await user.click(screen.getByRole('button', { name: '編集' }));
    const nameInput = screen.getByDisplayValue('ops-email');
    await user.clear(nameInput);
    await user.type(nameInput, 'ops-email-updated');
    await user.click(screen.getByRole('button', { name: '更新する' }));

    expect(UpdateSimpleNotificationDestination).toHaveBeenCalledWith('default', '100000000001', 'ops-email-updated', '', 'email', 'ops@example.com', []);
    expect(await screen.findByText('ops-email-updated')).toBeInTheDocument();
  });

  it('deletes a destination after confirmation', async () => {
    vi.mocked(GetSimpleNotificationDestinations)
      .mockResolvedValueOnce([makeDestination()])
      .mockResolvedValueOnce([]);
    vi.mocked(DeleteSimpleNotificationDestination).mockResolvedValueOnce();
    const user = userEvent.setup();

    renderList();
    await screen.findByText('ops-email');

    await user.click(screen.getByRole('button', { name: '削除' }));
    await user.click(screen.getByRole('button', { name: '削除する' }));

    expect(DeleteSimpleNotificationDestination).toHaveBeenCalledWith('default', '100000000001');
    expect(await screen.findByText('送信先がありません')).toBeInTheDocument();
  });

  it('switches to the groups tab and loads groups', async () => {
    vi.mocked(GetSimpleNotificationDestinations).mockResolvedValue([]);
    vi.mocked(GetSimpleNotificationGroups).mockResolvedValue([makeGroup()]);
    const user = userEvent.setup();

    renderList();
    await screen.findByText('送信先がありません');

    await user.click(screen.getByRole('button', { name: 'グループ' }));

    expect(await screen.findByText('sre-team')).toBeInTheDocument();
    expect(GetSimpleNotificationGroups).toHaveBeenCalledWith('default');
  });

  it('sends a test message to a group', async () => {
    vi.mocked(GetSimpleNotificationDestinations).mockResolvedValue([makeDestination()]);
    vi.mocked(GetSimpleNotificationGroups).mockResolvedValue([makeGroup()]);
    vi.mocked(SendSimpleNotificationGroupMessage).mockResolvedValueOnce(true);
    const user = userEvent.setup();

    renderList();
    await screen.findByText('ops-email');
    await user.click(screen.getByRole('button', { name: 'グループ' }));
    await screen.findByText('sre-team');

    await user.click(screen.getByRole('button', { name: 'メッセージ送信' }));
    await user.type(screen.getByPlaceholderText('テストメッセージ'), 'hello');
    await user.click(screen.getByRole('button', { name: '送信する' }));

    expect(SendSimpleNotificationGroupMessage).toHaveBeenCalledWith('default', '200000000001', 'hello');
    expect(await screen.findByText('送信しました')).toBeInTheDocument();
  });

  it('switches to the routings tab and loads routings', async () => {
    vi.mocked(GetSimpleNotificationDestinations).mockResolvedValue([]);
    vi.mocked(GetSimpleNotificationRoutings).mockResolvedValue([makeRouting()]);
    const user = userEvent.setup();

    renderList();
    await screen.findByText('送信先がありません');

    await user.click(screen.getByRole('button', { name: 'ルーティング' }));

    expect(await screen.findByText('critical-alerts')).toBeInTheDocument();
    expect(GetSimpleNotificationRoutings).toHaveBeenCalledWith('default');
  });

  it('deletes a routing after confirmation', async () => {
    vi.mocked(GetSimpleNotificationDestinations).mockResolvedValue([]);
    vi.mocked(GetSimpleNotificationRoutings)
      .mockResolvedValueOnce([makeRouting()])
      .mockResolvedValueOnce([]);
    vi.mocked(DeleteSimpleNotificationRouting).mockResolvedValueOnce();
    const user = userEvent.setup();

    renderList();
    await screen.findByText('送信先がありません');
    await user.click(screen.getByRole('button', { name: 'ルーティング' }));
    await screen.findByText('critical-alerts');

    await user.click(screen.getByRole('button', { name: '削除' }));
    await user.click(screen.getByRole('button', { name: '削除する' }));

    expect(DeleteSimpleNotificationRouting).toHaveBeenCalledWith('default', '300000000001');
    expect(await screen.findByText('ルーティングがありません')).toBeInTheDocument();
  });

  it('shows an error message when loading fails', async () => {
    vi.mocked(GetSimpleNotificationDestinations).mockRejectedValueOnce(new Error('network error'));

    renderList();

    expect(await screen.findByText(/読み込みに失敗しました: Error: network error/)).toBeInTheDocument();
  });
});
