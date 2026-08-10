import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApigwList } from './ApigwList';
import { apigw } from '../../wailsjs/go/models';
import {
  GetApigwServices,
  CreateApigwService,
  DeleteApigwService,
  GetApigwUsers,
  GetApigwUserGroups,
  SetApigwUserGroup,
  GetApigwGroups,
  CreateApigwGroup,
  DeleteApigwGroup,
  GetApigwDomains,
  GetApigwCertificates,
  GetApigwSubscriptions,
  GetApigwPlans,
  CreateApigwSubscription,
} from '../../wailsjs/go/main/App';

vi.mock('../../wailsjs/go/main/App');

function renderList() {
  return render(<ApigwList profile="default" onSelectService={vi.fn()} />);
}

function makeService(overrides: Partial<apigw.ServiceInfo> = {}): apigw.ServiceInfo {
  return new apigw.ServiceInfo({
    id: 'svc-1',
    name: 'my_service',
    tags: [],
    protocol: 'https',
    host: 'backend.example.com',
    path: '/',
    port: 443,
    retries: 3,
    connectTimeout: 5,
    writeTimeout: 60,
    readTimeout: 60,
    authentication: 'none',
    routeHost: 'abc123.apigw.example.com',
    subscriptionId: 'sub-1',
    subscriptionName: 'my-subscription',
    createdAt: '2026-01-01T00:00:00+09:00',
    updatedAt: '2026-01-01T00:00:00+09:00',
    ...overrides,
  });
}

function makeUser(overrides: Partial<apigw.UserInfo> = {}): apigw.UserInfo {
  return new apigw.UserInfo({
    id: 'user-1',
    name: 'my_user',
    customId: '',
    tags: [],
    groupIds: [],
    groupNames: [],
    createdAt: '2026-01-01T00:00:00+09:00',
    updatedAt: '2026-01-01T00:00:00+09:00',
    ...overrides,
  });
}

function makeGroup(overrides: Partial<apigw.GroupInfo> = {}): apigw.GroupInfo {
  return new apigw.GroupInfo({
    id: 'group-1',
    name: 'my_group',
    tags: [],
    createdAt: '2026-01-01T00:00:00+09:00',
    updatedAt: '2026-01-01T00:00:00+09:00',
    ...overrides,
  });
}

function makeSubscription(overrides: Partial<apigw.SubscriptionInfo> = {}): apigw.SubscriptionInfo {
  return new apigw.SubscriptionInfo({
    id: 'sub-1',
    name: 'my-subscription',
    planId: 'plan-1',
    planName: 'トライアル',
    resourceId: '',
    monthlyRequest: 0,
    serviceId: '',
    serviceName: '',
    createdAt: '2026-01-01T00:00:00+09:00',
    updatedAt: '2026-01-01T00:00:00+09:00',
    ...overrides,
  });
}

function makePlan(overrides: Partial<apigw.PlanInfo> = {}): apigw.PlanInfo {
  return new apigw.PlanInfo({
    id: 'plan-1',
    name: 'トライアル',
    price: '0',
    description: '',
    maxServices: 1,
    maxRequests: 10,
    maxRequestsUnit: 'second',
    overageUnitPrice: '',
    overageUnitAmount: 0,
    ...overrides,
  });
}

describe('ApigwList', () => {
  beforeEach(() => {
    vi.mocked(GetApigwServices).mockReset();
    vi.mocked(CreateApigwService).mockReset();
    vi.mocked(DeleteApigwService).mockReset();
    vi.mocked(GetApigwUsers).mockReset();
    vi.mocked(GetApigwUserGroups).mockReset();
    vi.mocked(SetApigwUserGroup).mockReset();
    vi.mocked(GetApigwGroups).mockReset();
    vi.mocked(CreateApigwGroup).mockReset();
    vi.mocked(DeleteApigwGroup).mockReset();
    vi.mocked(GetApigwDomains).mockReset();
    vi.mocked(GetApigwCertificates).mockReset();
    vi.mocked(GetApigwSubscriptions).mockReset();
    vi.mocked(GetApigwPlans).mockReset();
    vi.mocked(CreateApigwSubscription).mockReset();

    // 各タブはサービス・ユーザー・グループ・ドメイン・証明書・サブスクリプションをまとめて読み込むため、
    // テスト対象外のリソースにはデフォルト値を設定しておく
    vi.mocked(GetApigwUsers).mockResolvedValue([]);
    vi.mocked(GetApigwGroups).mockResolvedValue([]);
    vi.mocked(GetApigwDomains).mockResolvedValue([]);
    vi.mocked(GetApigwCertificates).mockResolvedValue([]);
    vi.mocked(GetApigwSubscriptions).mockResolvedValue([]);
  });

  it('shows services on the default tab', async () => {
    vi.mocked(GetApigwServices).mockResolvedValue([makeService()]);

    renderList();

    expect(await screen.findByText('my_service')).toBeInTheDocument();
    expect(GetApigwServices).toHaveBeenCalledWith('default');
  });

  it('shows an empty state when there are no services', async () => {
    vi.mocked(GetApigwServices).mockResolvedValue([]);

    renderList();

    expect(await screen.findByText('サービスがありません')).toBeInTheDocument();
  });

  it('disables service creation when there is no available subscription', async () => {
    vi.mocked(GetApigwServices).mockResolvedValue([]);
    vi.mocked(GetApigwSubscriptions).mockResolvedValue([makeSubscription({ serviceId: 'svc-1' })]);

    renderList();
    await screen.findByText('サービスがありません');

    expect(screen.getByRole('button', { name: '+ サービス作成' })).toBeDisabled();
  });

  it('creates a service from the create dialog', async () => {
    vi.mocked(GetApigwServices)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeService()]);
    vi.mocked(GetApigwSubscriptions).mockResolvedValue([makeSubscription()]);
    vi.mocked(CreateApigwService).mockResolvedValueOnce(makeService());
    const user = userEvent.setup();

    renderList();
    await screen.findByText('サービスがありません');

    await user.click(screen.getByRole('button', { name: '+ サービス作成' }));
    await user.type(screen.getByPlaceholderText('my_service'), 'my_service');
    await user.type(screen.getByPlaceholderText('backend.example.com'), 'backend.example.com');
    await user.click(screen.getByRole('button', { name: '作成する' }));

    expect(CreateApigwService).toHaveBeenCalledWith(
      'default', 'my_service', 'https', 'backend.example.com', '/', 443, 3, 5000, 60000, 60000, 'sub-1'
    );
    expect(await screen.findByText('my_service')).toBeInTheDocument();
  });

  it('deletes a service after confirmation', async () => {
    vi.mocked(GetApigwServices)
      .mockResolvedValueOnce([makeService()])
      .mockResolvedValueOnce([]);
    vi.mocked(DeleteApigwService).mockResolvedValueOnce();
    const user = userEvent.setup();

    renderList();
    await screen.findByText('my_service');

    await user.click(screen.getByRole('button', { name: '削除' }));
    await user.click(screen.getByRole('button', { name: '削除する' }));

    expect(DeleteApigwService).toHaveBeenCalledWith('default', 'svc-1');
    expect(await screen.findByText('サービスがありません')).toBeInTheDocument();
  });

  it('switches to the groups tab and creates a group', async () => {
    vi.mocked(GetApigwServices).mockResolvedValue([]);
    vi.mocked(GetApigwGroups)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeGroup()]);
    vi.mocked(CreateApigwGroup).mockResolvedValueOnce(makeGroup());
    const user = userEvent.setup();

    renderList();
    await screen.findByText('サービスがありません');

    await user.click(screen.getByRole('button', { name: 'グループ' }));
    await screen.findByText('グループがありません');

    await user.click(screen.getByRole('button', { name: '+ グループ作成' }));
    await user.type(screen.getByPlaceholderText('my_group'), 'my_group');
    await user.click(screen.getByRole('button', { name: '作成する' }));

    expect(CreateApigwGroup).toHaveBeenCalledWith('default', 'my_group', []);
    expect(await screen.findByText('my_group')).toBeInTheDocument();
  });

  it('deletes a group after confirmation', async () => {
    vi.mocked(GetApigwServices).mockResolvedValue([]);
    vi.mocked(GetApigwGroups)
      .mockResolvedValueOnce([makeGroup()])
      .mockResolvedValueOnce([]);
    vi.mocked(DeleteApigwGroup).mockResolvedValueOnce();
    const user = userEvent.setup();

    renderList();
    await screen.findByText('サービスがありません');
    await user.click(screen.getByRole('button', { name: 'グループ' }));
    await screen.findByText('my_group');

    await user.click(screen.getByRole('button', { name: '削除' }));
    await user.click(screen.getByRole('button', { name: '削除する' }));

    expect(DeleteApigwGroup).toHaveBeenCalledWith('default', 'group-1');
    expect(await screen.findByText('グループがありません')).toBeInTheDocument();
  });

  it('manages group assignment from the users tab', async () => {
    vi.mocked(GetApigwServices).mockResolvedValue([]);
    vi.mocked(GetApigwUsers).mockResolvedValue([makeUser()]);
    vi.mocked(GetApigwUserGroups).mockResolvedValue([
      { id: 'group-1', name: 'my_group', isAssigned: false } as apigw.UserGroupAssignmentInfo,
    ]);
    vi.mocked(SetApigwUserGroup).mockResolvedValueOnce();
    const user = userEvent.setup();

    renderList();
    await screen.findByText('サービスがありません');
    await user.click(screen.getByRole('button', { name: 'ユーザー' }));
    await screen.findByText('my_user');

    await user.click(screen.getByRole('button', { name: 'グループ管理' }));
    const checkbox = await screen.findByRole('checkbox', { name: 'my_group' });
    await user.click(checkbox);

    expect(SetApigwUserGroup).toHaveBeenCalledWith('default', 'user-1', 'group-1', true);
  });

  it('subscribes to a plan from the subscriptions tab', async () => {
    vi.mocked(GetApigwServices).mockResolvedValue([]);
    vi.mocked(GetApigwSubscriptions)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeSubscription()]);
    vi.mocked(GetApigwPlans).mockResolvedValue([makePlan()]);
    vi.mocked(CreateApigwSubscription).mockResolvedValueOnce(makeSubscription());
    const user = userEvent.setup();

    renderList();
    await screen.findByText('サービスがありません');
    await user.click(screen.getByRole('button', { name: 'サブスクリプション' }));
    await screen.findByText('サブスクリプションがありません');

    await user.click(screen.getByRole('button', { name: '+ サブスクリプション作成' }));
    await user.type(screen.getByPlaceholderText('my-subscription'), 'my-subscription');
    await user.click(screen.getByRole('button', { name: '契約する' }));

    expect(CreateApigwSubscription).toHaveBeenCalledWith('default', 'plan-1', 'my-subscription');
    expect(await screen.findByText('my-subscription')).toBeInTheDocument();
  });

  it('shows an error message when loading fails', async () => {
    vi.mocked(GetApigwServices).mockRejectedValueOnce(new Error('network error'));

    renderList();

    expect(await screen.findByText(/読み込みに失敗しました: Error: network error/)).toBeInTheDocument();
  });
});
