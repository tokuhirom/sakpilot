import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IAMList } from './IAMList';
import { iam } from '../../wailsjs/go/models';
import { GetIAMUsers, GetIAMGroups, GetIAMRoles, GetIAMIDRoles } from '../../wailsjs/go/main/App';

vi.mock('../../wailsjs/go/main/App');

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

describe('IAMList', () => {
  beforeEach(() => {
    vi.mocked(GetIAMUsers).mockReset();
    vi.mocked(GetIAMGroups).mockReset();
    vi.mocked(GetIAMRoles).mockReset();
    vi.mocked(GetIAMIDRoles).mockReset();
  });

  it('shows users on the default tab', async () => {
    vi.mocked(GetIAMUsers).mockResolvedValueOnce([makeUser()]);

    render(<IAMList profile="default" />);

    expect(await screen.findByText('taro')).toBeInTheDocument();
    expect(GetIAMUsers).toHaveBeenCalledWith('default');
    expect(screen.getByText('taro@example.com')).toBeInTheDocument();
  });

  it('shows an empty state when there are no users', async () => {
    vi.mocked(GetIAMUsers).mockResolvedValueOnce([]);

    render(<IAMList profile="default" />);

    expect(await screen.findByText('ユーザーがありません')).toBeInTheDocument();
  });

  it('switches to the groups tab and loads groups', async () => {
    vi.mocked(GetIAMUsers).mockResolvedValueOnce([]);
    vi.mocked(GetIAMGroups).mockResolvedValueOnce([makeGroup()]);
    const user = userEvent.setup();

    render(<IAMList profile="default" />);
    await screen.findByText('ユーザーがありません');

    await user.click(screen.getByRole('button', { name: 'グループ' }));

    expect(await screen.findByText('sre-team')).toBeInTheDocument();
    expect(GetIAMGroups).toHaveBeenCalledWith('default');
  });

  it('switches to the IAM roles tab and loads roles', async () => {
    vi.mocked(GetIAMUsers).mockResolvedValueOnce([]);
    vi.mocked(GetIAMRoles).mockResolvedValueOnce([makeIAMRole()]);
    const user = userEvent.setup();

    render(<IAMList profile="default" />);
    await screen.findByText('ユーザーがありません');

    await user.click(screen.getByRole('button', { name: 'IAMロール' }));

    expect(await screen.findByText('オーナー')).toBeInTheDocument();
    expect(screen.getByText('project')).toBeInTheDocument();
  });

  it('switches to the ID roles tab and loads roles', async () => {
    vi.mocked(GetIAMUsers).mockResolvedValueOnce([]);
    vi.mocked(GetIAMIDRoles).mockResolvedValueOnce([makeIDRole()]);
    const user = userEvent.setup();

    render(<IAMList profile="default" />);
    await screen.findByText('ユーザーがありません');

    await user.click(screen.getByRole('button', { name: 'IDロール' }));

    expect(await screen.findByText('管理者')).toBeInTheDocument();
  });

  it('shows an error message when loading fails', async () => {
    vi.mocked(GetIAMUsers).mockRejectedValueOnce(new Error('network error'));

    render(<IAMList profile="default" />);

    expect(await screen.findByText(/読み込みに失敗しました: Error: network error/)).toBeInTheDocument();
  });
});
