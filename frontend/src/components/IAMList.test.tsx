import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IAMList } from './IAMList';
import { iam } from '../../wailsjs/go/models';
import {
  GetIAMUsers,
  GetIAMGroups,
  GetIAMRoles,
  GetIAMIDRoles,
  GetIAMServicePrincipals,
  CreateIAMServicePrincipal,
  DeleteIAMServicePrincipal,
} from '../../wailsjs/go/main/App';

vi.mock('../../wailsjs/go/main/App');

function renderIAMList(onSelectServicePrincipal = vi.fn()) {
  return render(<IAMList profile="default" onSelectServicePrincipal={onSelectServicePrincipal} />);
}

function makeUser(overrides: Partial<iam.UserInfo> = {}): iam.UserInfo {
  return new iam.UserInfo({
    id: 100,
    name: 'taro',
    code: 'taro-code',
    status: 'available',
    description: '',
    email: 'taro@example.com',
    createdAt: '2026-01-01T00:00:00+09:00',
    updatedAt: '2026-01-01T00:00:00+09:00',
    ...overrides,
  });
}

function makeGroup(overrides: Partial<iam.GroupInfo> = {}): iam.GroupInfo {
  return new iam.GroupInfo({
    id: 200,
    name: 'sre-team',
    description: '',
    createdAt: '2026-01-01T00:00:00+09:00',
    updatedAt: '2026-01-01T00:00:00+09:00',
    ...overrides,
  });
}

function makeIAMRole(overrides: Partial<iam.IAMRoleInfo> = {}): iam.IAMRoleInfo {
  return new iam.IAMRoleInfo({
    id: 'owner',
    name: 'オーナー',
    description: '全ての操作が可能',
    category: 'general',
    lowestGrantableResource: 'project',
    ...overrides,
  });
}

function makeIDRole(overrides: Partial<iam.IDRoleInfo> = {}): iam.IDRoleInfo {
  return new iam.IDRoleInfo({
    id: 'admin',
    name: '管理者',
    description: 'ID管理の全操作が可能',
    ...overrides,
  });
}

function makeServicePrincipal(overrides: Partial<iam.ServicePrincipalInfo> = {}): iam.ServicePrincipalInfo {
  return new iam.ServicePrincipalInfo({
    id: 300,
    projectId: 1,
    name: 'sp-ci',
    description: 'CI用サービスプリンシパル',
    createdAt: '2026-01-01T00:00:00+09:00',
    updatedAt: '2026-01-01T00:00:00+09:00',
    ...overrides,
  });
}

describe('IAMList', () => {
  beforeEach(() => {
    vi.mocked(GetIAMUsers).mockReset();
    vi.mocked(GetIAMGroups).mockReset();
    vi.mocked(GetIAMRoles).mockReset();
    vi.mocked(GetIAMIDRoles).mockReset();
    vi.mocked(GetIAMServicePrincipals).mockReset();
    vi.mocked(CreateIAMServicePrincipal).mockReset();
    vi.mocked(DeleteIAMServicePrincipal).mockReset();
  });

  it('shows users on the default tab', async () => {
    vi.mocked(GetIAMUsers).mockResolvedValueOnce([makeUser()]);

    renderIAMList();

    expect(await screen.findByText('taro')).toBeInTheDocument();
    expect(GetIAMUsers).toHaveBeenCalledWith('default');
    expect(screen.getByText('taro@example.com')).toBeInTheDocument();
  });

  it('shows an empty state when there are no users', async () => {
    vi.mocked(GetIAMUsers).mockResolvedValueOnce([]);

    renderIAMList();

    expect(await screen.findByText('ユーザーがありません')).toBeInTheDocument();
  });

  it('switches to the groups tab and loads groups', async () => {
    vi.mocked(GetIAMUsers).mockResolvedValueOnce([]);
    vi.mocked(GetIAMGroups).mockResolvedValueOnce([makeGroup()]);
    const user = userEvent.setup();

    renderIAMList();
    await screen.findByText('ユーザーがありません');

    await user.click(screen.getByRole('button', { name: 'グループ' }));

    expect(await screen.findByText('sre-team')).toBeInTheDocument();
    expect(GetIAMGroups).toHaveBeenCalledWith('default');
  });

  it('switches to the IAM roles tab and loads roles', async () => {
    vi.mocked(GetIAMUsers).mockResolvedValueOnce([]);
    vi.mocked(GetIAMRoles).mockResolvedValueOnce([makeIAMRole()]);
    const user = userEvent.setup();

    renderIAMList();
    await screen.findByText('ユーザーがありません');

    await user.click(screen.getByRole('button', { name: 'IAMロール' }));

    expect(await screen.findByText('オーナー')).toBeInTheDocument();
    expect(screen.getByText('project')).toBeInTheDocument();
  });

  it('switches to the ID roles tab and loads roles', async () => {
    vi.mocked(GetIAMUsers).mockResolvedValueOnce([]);
    vi.mocked(GetIAMIDRoles).mockResolvedValueOnce([makeIDRole()]);
    const user = userEvent.setup();

    renderIAMList();
    await screen.findByText('ユーザーがありません');

    await user.click(screen.getByRole('button', { name: 'IDロール' }));

    expect(await screen.findByText('管理者')).toBeInTheDocument();
  });

  it('shows an error message when loading fails', async () => {
    vi.mocked(GetIAMUsers).mockRejectedValueOnce(new Error('network error'));

    renderIAMList();

    expect(await screen.findByText(/読み込みに失敗しました: Error: network error/)).toBeInTheDocument();
  });

  it('switches to the service principals tab, shows the list, and navigates on row click', async () => {
    vi.mocked(GetIAMUsers).mockResolvedValueOnce([]);
    vi.mocked(GetIAMServicePrincipals).mockResolvedValueOnce([makeServicePrincipal()]);
    const user = userEvent.setup();
    const onSelectServicePrincipal = vi.fn();

    renderIAMList(onSelectServicePrincipal);
    await screen.findByText('ユーザーがありません');

    await user.click(screen.getByRole('button', { name: 'サービスプリンシパル' }));

    expect(await screen.findByText('sp-ci')).toBeInTheDocument();
    expect(GetIAMServicePrincipals).toHaveBeenCalledWith('default');

    await user.click(screen.getByText('sp-ci'));
    expect(onSelectServicePrincipal).toHaveBeenCalledWith(300);
  });

  it('creates a service principal from the create dialog', async () => {
    vi.mocked(GetIAMUsers).mockResolvedValueOnce([]);
    vi.mocked(GetIAMServicePrincipals)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeServicePrincipal()]);
    vi.mocked(CreateIAMServicePrincipal).mockResolvedValueOnce(makeServicePrincipal());
    const user = userEvent.setup();

    renderIAMList();
    await screen.findByText('ユーザーがありません');
    await user.click(screen.getByRole('button', { name: 'サービスプリンシパル' }));
    await screen.findByText('サービスプリンシパルがありません');

    await user.click(screen.getByRole('button', { name: '+ サービスプリンシパル作成' }));
    await user.type(screen.getByPlaceholderText('1'), '1');
    await user.type(screen.getByPlaceholderText('my-service-principal'), 'sp-ci');
    await user.click(screen.getByRole('button', { name: '作成する' }));

    expect(CreateIAMServicePrincipal).toHaveBeenCalledWith('default', 1, 'sp-ci', '');
    expect(await screen.findByText('sp-ci')).toBeInTheDocument();
  });

  it('deletes a service principal after confirmation', async () => {
    vi.mocked(GetIAMUsers).mockResolvedValueOnce([]);
    vi.mocked(GetIAMServicePrincipals)
      .mockResolvedValueOnce([makeServicePrincipal()])
      .mockResolvedValueOnce([]);
    vi.mocked(DeleteIAMServicePrincipal).mockResolvedValueOnce();
    const user = userEvent.setup();

    renderIAMList();
    await screen.findByText('ユーザーがありません');
    await user.click(screen.getByRole('button', { name: 'サービスプリンシパル' }));
    await screen.findByText('sp-ci');

    await user.click(screen.getByRole('button', { name: '削除' }));
    await user.click(screen.getByRole('button', { name: '削除する' }));

    expect(DeleteIAMServicePrincipal).toHaveBeenCalledWith('default', 300);
    expect(await screen.findByText('サービスプリンシパルがありません')).toBeInTheDocument();
  });
});
