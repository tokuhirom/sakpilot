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
  GetIAMProjects,
  GetIAMFolders,
  CreateIAMProject,
  UpdateIAMProject,
  DeleteIAMProject,
  MoveIAMProjects,
  CreateIAMFolder,
  DeleteIAMFolder,
  GetIAMOrganization,
  UpdateIAMOrganization,
  GetIAMSSOProfiles,
  CreateIAMSSOProfile,
  UpdateIAMSSOProfile,
  DeleteIAMSSOProfile,
  LinkIAMSSOProfile,
  UnlinkIAMSSOProfile,
  GetIAMScimConfigurations,
  CreateIAMScimConfiguration,
  UpdateIAMScimConfiguration,
  DeleteIAMScimConfiguration,
  RegenerateIAMScimConfigurationToken,
  GetIAMServicePolicyStatus,
  EnableIAMServicePolicy,
  DisableIAMServicePolicy,
  GetIAMServicePolicyRuleTemplates,
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

function makeFolder(overrides: Partial<iam.FolderInfo> = {}): iam.FolderInfo {
  return new iam.FolderInfo({
    id: 400,
    name: 'root-folder',
    description: '',
    parentId: 0,
    createdAt: '2026-01-01T00:00:00+09:00',
    updatedAt: '2026-01-01T00:00:00+09:00',
    ...overrides,
  });
}

function makeProject(overrides: Partial<iam.ProjectInfo> = {}): iam.ProjectInfo {
  return new iam.ProjectInfo({
    id: 500,
    code: 'proj-code',
    name: 'my-project',
    description: '',
    status: 'available',
    parentFolderId: 0,
    createdAt: '2026-01-01T00:00:00+09:00',
    updatedAt: '2026-01-01T00:00:00+09:00',
    ...overrides,
  });
}

function makeOrganization(overrides: Partial<iam.OrganizationInfo> = {}): iam.OrganizationInfo {
  return new iam.OrganizationInfo({
    id: 1,
    name: 'my-organization',
    ...overrides,
  });
}

function makeSSOProfile(overrides: Partial<iam.SSOProfileInfo> = {}): iam.SSOProfileInfo {
  return new iam.SSOProfileInfo({
    id: 600,
    name: 'sso-ci',
    description: '',
    spEntityId: 'https://secure.sakura.ad.jp/cloud/sso/saml/metadata',
    spAcsUrl: 'https://secure.sakura.ad.jp/cloud/sso/saml/acs',
    idpEntityId: 'https://idp.example.com/metadata',
    idpLoginUrl: 'https://idp.example.com/sso',
    idpLogoutUrl: '',
    idpCertificate: '-----BEGIN CERTIFICATE-----test-----END CERTIFICATE-----',
    assigned: false,
    createdAt: '2026-01-01T00:00:00+09:00',
    updatedAt: '2026-01-01T00:00:00+09:00',
    ...overrides,
  });
}

function makeScimConfiguration(overrides: Partial<iam.ScimConfigurationInfo> = {}): iam.ScimConfigurationInfo {
  return new iam.ScimConfigurationInfo({
    id: '700',
    name: 'scim-ci',
    baseUrl: 'https://secure.sakura.ad.jp/cloud/api/iam/1.0/scim/700',
    createdAt: '2026-01-01T00:00:00+09:00',
    updatedAt: '2026-01-01T00:00:00+09:00',
    ...overrides,
  });
}

function makeScimConfigurationSecret(overrides: Partial<iam.ScimConfigurationSecretInfo> = {}): iam.ScimConfigurationSecretInfo {
  return new iam.ScimConfigurationSecretInfo({
    id: '700',
    name: 'scim-ci',
    baseUrl: 'https://secure.sakura.ad.jp/cloud/api/iam/1.0/scim/700',
    createdAt: '2026-01-01T00:00:00+09:00',
    updatedAt: '2026-01-01T00:00:00+09:00',
    secretToken: 'test-secret-token',
    ...overrides,
  });
}

function makeServicePolicyRuleTemplate(overrides: Partial<iam.ServicePolicyRuleTemplateInfo> = {}): iam.ServicePolicyRuleTemplateInfo {
  return new iam.ServicePolicyRuleTemplateInfo({
    code: 'deny-public-bucket',
    name: 'パブリックバケット禁止',
    description: '',
    type: 'boolean',
    supportsDryRun: true,
    prefixes: ['objectstorage'],
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
    vi.mocked(GetIAMProjects).mockReset();
    vi.mocked(GetIAMFolders).mockReset();
    vi.mocked(CreateIAMProject).mockReset();
    vi.mocked(UpdateIAMProject).mockReset();
    vi.mocked(DeleteIAMProject).mockReset();
    vi.mocked(MoveIAMProjects).mockReset();
    vi.mocked(CreateIAMFolder).mockReset();
    vi.mocked(DeleteIAMFolder).mockReset();
    vi.mocked(GetIAMOrganization).mockReset();
    vi.mocked(UpdateIAMOrganization).mockReset();
    vi.mocked(GetIAMSSOProfiles).mockReset();
    vi.mocked(CreateIAMSSOProfile).mockReset();
    vi.mocked(UpdateIAMSSOProfile).mockReset();
    vi.mocked(DeleteIAMSSOProfile).mockReset();
    vi.mocked(LinkIAMSSOProfile).mockReset();
    vi.mocked(UnlinkIAMSSOProfile).mockReset();
    vi.mocked(GetIAMScimConfigurations).mockReset();
    vi.mocked(CreateIAMScimConfiguration).mockReset();
    vi.mocked(UpdateIAMScimConfiguration).mockReset();
    vi.mocked(DeleteIAMScimConfiguration).mockReset();
    vi.mocked(RegenerateIAMScimConfigurationToken).mockReset();
    vi.mocked(GetIAMServicePolicyStatus).mockReset();
    vi.mocked(EnableIAMServicePolicy).mockReset();
    vi.mocked(DisableIAMServicePolicy).mockReset();
    vi.mocked(GetIAMServicePolicyRuleTemplates).mockReset();
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

  it('switches to the projects/folders tab and renders the tree', async () => {
    vi.mocked(GetIAMUsers).mockResolvedValueOnce([]);
    vi.mocked(GetIAMFolders).mockResolvedValueOnce([makeFolder()]);
    vi.mocked(GetIAMProjects).mockResolvedValueOnce([makeProject({ parentFolderId: 400 })]);
    const user = userEvent.setup();

    renderIAMList();
    await screen.findByText('ユーザーがありません');

    await user.click(screen.getByRole('button', { name: 'プロジェクト/フォルダ' }));

    expect(await screen.findByText('root-folder')).toBeInTheDocument();
    expect(screen.getByText('my-project')).toBeInTheDocument();
    expect(GetIAMFolders).toHaveBeenCalledWith('default');
    expect(GetIAMProjects).toHaveBeenCalledWith('default');
  });

  it('shows an empty state when there are no projects or folders', async () => {
    vi.mocked(GetIAMUsers).mockResolvedValueOnce([]);
    vi.mocked(GetIAMFolders).mockResolvedValueOnce([]);
    vi.mocked(GetIAMProjects).mockResolvedValueOnce([]);
    const user = userEvent.setup();

    renderIAMList();
    await screen.findByText('ユーザーがありません');

    await user.click(screen.getByRole('button', { name: 'プロジェクト/フォルダ' }));

    expect(await screen.findByText('プロジェクト・フォルダがありません')).toBeInTheDocument();
  });

  it('creates a root folder from the create dialog', async () => {
    vi.mocked(GetIAMUsers).mockResolvedValueOnce([]);
    vi.mocked(GetIAMFolders)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeFolder()]);
    vi.mocked(GetIAMProjects).mockResolvedValue([]);
    vi.mocked(CreateIAMFolder).mockResolvedValueOnce(makeFolder());
    const user = userEvent.setup();

    renderIAMList();
    await screen.findByText('ユーザーがありません');
    await user.click(screen.getByRole('button', { name: 'プロジェクト/フォルダ' }));
    await screen.findByText('プロジェクト・フォルダがありません');

    await user.click(screen.getByRole('button', { name: '+ フォルダ作成' }));
    await user.type(screen.getByPlaceholderText('my-folder'), 'root-folder');
    await user.click(screen.getByRole('button', { name: '作成する' }));

    expect(CreateIAMFolder).toHaveBeenCalledWith('default', 'root-folder', '', 0);
    expect(await screen.findByText('root-folder')).toBeInTheDocument();
  });

  it('creates a root project from the create dialog', async () => {
    vi.mocked(GetIAMUsers).mockResolvedValueOnce([]);
    vi.mocked(GetIAMFolders).mockResolvedValue([]);
    vi.mocked(GetIAMProjects)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeProject()]);
    vi.mocked(CreateIAMProject).mockResolvedValueOnce(makeProject());
    const user = userEvent.setup();

    renderIAMList();
    await screen.findByText('ユーザーがありません');
    await user.click(screen.getByRole('button', { name: 'プロジェクト/フォルダ' }));
    await screen.findByText('プロジェクト・フォルダがありません');

    await user.click(screen.getByRole('button', { name: '+ プロジェクト作成' }));
    await user.type(screen.getByPlaceholderText('my-project-code'), 'proj-code');
    await user.type(screen.getByPlaceholderText('my-project'), 'my-project');
    await user.click(screen.getByRole('button', { name: '作成する' }));

    expect(CreateIAMProject).toHaveBeenCalledWith('default', 'proj-code', 'my-project', '', 0);
    expect(await screen.findByText('my-project')).toBeInTheDocument();
  });

  it('edits a project name from the tree', async () => {
    vi.mocked(GetIAMUsers).mockResolvedValueOnce([]);
    vi.mocked(GetIAMFolders).mockResolvedValue([]);
    const project = makeProject();
    vi.mocked(GetIAMProjects)
      .mockResolvedValueOnce([project])
      .mockResolvedValueOnce([makeProject({ name: 'renamed-project' })]);
    vi.mocked(UpdateIAMProject).mockResolvedValueOnce(makeProject({ name: 'renamed-project' }));
    const user = userEvent.setup();

    renderIAMList();
    await screen.findByText('ユーザーがありません');
    await user.click(screen.getByRole('button', { name: 'プロジェクト/フォルダ' }));
    await screen.findByText('my-project');

    await user.click(screen.getByRole('button', { name: '編集' }));
    const nameInput = screen.getByPlaceholderText('my-project');
    await user.clear(nameInput);
    await user.type(nameInput, 'renamed-project');
    await user.click(screen.getByRole('button', { name: '更新する' }));

    expect(UpdateIAMProject).toHaveBeenCalledWith('default', project.id, 'renamed-project', '');
    expect(await screen.findByText('renamed-project')).toBeInTheDocument();
  });

  it('moves a project to another folder from the tree', async () => {
    vi.mocked(GetIAMUsers).mockResolvedValueOnce([]);
    const folder = makeFolder();
    const project = makeProject();
    vi.mocked(GetIAMFolders).mockResolvedValue([folder]);
    vi.mocked(GetIAMProjects)
      .mockResolvedValueOnce([project])
      .mockResolvedValueOnce([makeProject({ parentFolderId: folder.id })]);
    vi.mocked(MoveIAMProjects).mockResolvedValueOnce();
    const user = userEvent.setup();

    renderIAMList();
    await screen.findByText('ユーザーがありません');
    await user.click(screen.getByRole('button', { name: 'プロジェクト/フォルダ' }));
    await screen.findByText('my-project');

    const moveButtons = screen.getAllByRole('button', { name: '移動' });
    await user.click(moveButtons[moveButtons.length - 1]); // 一覧末尾はプロジェクト(root-folderの後に描画される)
    await user.selectOptions(screen.getByRole('combobox'), String(folder.id));
    await user.click(screen.getByRole('button', { name: '移動する' }));

    expect(MoveIAMProjects).toHaveBeenCalledWith('default', [project.id], folder.id);
  });

  it('deletes a folder after confirmation', async () => {
    vi.mocked(GetIAMUsers).mockResolvedValueOnce([]);
    vi.mocked(GetIAMProjects).mockResolvedValue([]);
    const folder = makeFolder();
    vi.mocked(GetIAMFolders)
      .mockResolvedValueOnce([folder])
      .mockResolvedValueOnce([]);
    vi.mocked(DeleteIAMFolder).mockResolvedValueOnce();
    const user = userEvent.setup();

    renderIAMList();
    await screen.findByText('ユーザーがありません');
    await user.click(screen.getByRole('button', { name: 'プロジェクト/フォルダ' }));
    await screen.findByText('root-folder');

    await user.click(screen.getByRole('button', { name: '削除' }));
    await user.click(screen.getByRole('button', { name: '削除する' }));

    expect(DeleteIAMFolder).toHaveBeenCalledWith('default', folder.id);
    expect(await screen.findByText('プロジェクト・フォルダがありません')).toBeInTheDocument();
  });

  it('shows organization info and edits the name', async () => {
    vi.mocked(GetIAMUsers).mockResolvedValueOnce([]);
    vi.mocked(GetIAMOrganization).mockResolvedValueOnce(makeOrganization());
    vi.mocked(UpdateIAMOrganization).mockResolvedValueOnce(makeOrganization({ name: 'renamed-organization' }));
    const user = userEvent.setup();

    renderIAMList();
    await screen.findByText('ユーザーがありません');

    await user.click(screen.getByRole('button', { name: '組織' }));

    expect(await screen.findByText('my-organization')).toBeInTheDocument();
    expect(GetIAMOrganization).toHaveBeenCalledWith('default');

    await user.click(screen.getByRole('button', { name: '組織名を編集' }));
    const input = screen.getByDisplayValue('my-organization');
    await user.clear(input);
    await user.type(input, 'renamed-organization');
    await user.click(screen.getByRole('button', { name: '更新する' }));

    expect(UpdateIAMOrganization).toHaveBeenCalledWith('default', 'renamed-organization');
    expect(await screen.findByText('renamed-organization')).toBeInTheDocument();
  });

  it('switches to the SSO tab and shows profiles', async () => {
    vi.mocked(GetIAMUsers).mockResolvedValueOnce([]);
    vi.mocked(GetIAMSSOProfiles).mockResolvedValueOnce([makeSSOProfile()]);
    const user = userEvent.setup();

    renderIAMList();
    await screen.findByText('ユーザーがありません');

    await user.click(screen.getByRole('button', { name: 'SSO' }));

    expect(await screen.findByText('sso-ci')).toBeInTheDocument();
    expect(screen.getByText('未割り当て')).toBeInTheDocument();
    expect(GetIAMSSOProfiles).toHaveBeenCalledWith('default');
  });

  it('creates an SSO profile from the create dialog', async () => {
    vi.mocked(GetIAMUsers).mockResolvedValueOnce([]);
    vi.mocked(GetIAMSSOProfiles)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeSSOProfile()]);
    vi.mocked(CreateIAMSSOProfile).mockResolvedValueOnce(makeSSOProfile());
    const user = userEvent.setup();

    renderIAMList();
    await screen.findByText('ユーザーがありません');
    await user.click(screen.getByRole('button', { name: 'SSO' }));
    await screen.findByText('SSOプロファイルがありません');

    await user.click(screen.getByRole('button', { name: '+ SSOプロファイル作成' }));
    await user.type(screen.getByPlaceholderText('my-sso-profile'), 'sso-ci');
    await user.type(screen.getByPlaceholderText('https://idp.example.com/metadata'), 'https://idp.example.com/metadata');
    await user.type(screen.getByPlaceholderText('https://idp.example.com/sso'), 'https://idp.example.com/sso');
    await user.type(screen.getByPlaceholderText('-----BEGIN CERTIFICATE-----...'), '-----BEGIN CERTIFICATE-----test-----END CERTIFICATE-----');
    await user.click(screen.getByRole('button', { name: '作成する' }));

    expect(CreateIAMSSOProfile).toHaveBeenCalledWith(
      'default', 'sso-ci', '', 'https://idp.example.com/metadata', 'https://idp.example.com/sso', '',
      '-----BEGIN CERTIFICATE-----test-----END CERTIFICATE-----',
    );
    expect(await screen.findByText('sso-ci')).toBeInTheDocument();
  });

  it('deletes an SSO profile after confirmation', async () => {
    vi.mocked(GetIAMUsers).mockResolvedValueOnce([]);
    vi.mocked(GetIAMSSOProfiles)
      .mockResolvedValueOnce([makeSSOProfile()])
      .mockResolvedValueOnce([]);
    vi.mocked(DeleteIAMSSOProfile).mockResolvedValueOnce();
    const user = userEvent.setup();

    renderIAMList();
    await screen.findByText('ユーザーがありません');
    await user.click(screen.getByRole('button', { name: 'SSO' }));
    await screen.findByText('sso-ci');

    await user.click(screen.getByRole('button', { name: '削除' }));
    await user.click(screen.getByRole('button', { name: '削除する' }));

    expect(DeleteIAMSSOProfile).toHaveBeenCalledWith('default', 600);
    expect(await screen.findByText('SSOプロファイルがありません')).toBeInTheDocument();
  });

  it('links and unlinks an SSO profile', async () => {
    vi.mocked(GetIAMUsers).mockResolvedValueOnce([]);
    vi.mocked(GetIAMSSOProfiles)
      .mockResolvedValueOnce([makeSSOProfile()])
      .mockResolvedValueOnce([makeSSOProfile({ assigned: true })])
      .mockResolvedValueOnce([makeSSOProfile({ assigned: false })]);
    vi.mocked(LinkIAMSSOProfile).mockResolvedValueOnce(makeSSOProfile({ assigned: true }));
    vi.mocked(UnlinkIAMSSOProfile).mockResolvedValueOnce(makeSSOProfile({ assigned: false }));
    const user = userEvent.setup();

    renderIAMList();
    await screen.findByText('ユーザーがありません');
    await user.click(screen.getByRole('button', { name: 'SSO' }));
    await screen.findByText('未割り当て');

    await user.click(screen.getByRole('button', { name: '割り当てる' }));
    expect(LinkIAMSSOProfile).toHaveBeenCalledWith('default', 600);
    await screen.findByText('割り当て済み');

    await user.click(screen.getByRole('button', { name: '割り当て解除' }));
    expect(UnlinkIAMSSOProfile).toHaveBeenCalledWith('default', 600);
    await screen.findByText('未割り当て');
  });

  it('switches to the SCIM tab and shows configurations', async () => {
    vi.mocked(GetIAMUsers).mockResolvedValueOnce([]);
    vi.mocked(GetIAMScimConfigurations).mockResolvedValueOnce([makeScimConfiguration()]);
    const user = userEvent.setup();

    renderIAMList();
    await screen.findByText('ユーザーがありません');

    await user.click(screen.getByRole('button', { name: 'SCIM' }));

    expect(await screen.findByText('scim-ci')).toBeInTheDocument();
    expect(GetIAMScimConfigurations).toHaveBeenCalledWith('default');
  });

  it('creates a SCIM configuration and reveals the secret token once', async () => {
    vi.mocked(GetIAMUsers).mockResolvedValueOnce([]);
    vi.mocked(GetIAMScimConfigurations)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeScimConfiguration()]);
    vi.mocked(CreateIAMScimConfiguration).mockResolvedValueOnce(makeScimConfigurationSecret());
    const user = userEvent.setup();

    renderIAMList();
    await screen.findByText('ユーザーがありません');
    await user.click(screen.getByRole('button', { name: 'SCIM' }));
    await screen.findByText('ユーザープロビジョニング(SCIM)設定がありません');

    await user.click(screen.getByRole('button', { name: '+ ユーザープロビジョニング作成' }));
    await user.type(screen.getByPlaceholderText('my-scim-config'), 'scim-ci');
    await user.click(screen.getByRole('button', { name: '作成する' }));

    expect(CreateIAMScimConfiguration).toHaveBeenCalledWith('default', 'scim-ci');
    expect(await screen.findByText('シークレットトークン「scim-ci」')).toBeInTheDocument();
    expect(screen.getByDisplayValue('test-secret-token')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '閉じる' }));
    expect(await screen.findByText('scim-ci')).toBeInTheDocument();
  });

  it('deletes a SCIM configuration after confirmation', async () => {
    vi.mocked(GetIAMUsers).mockResolvedValueOnce([]);
    vi.mocked(GetIAMScimConfigurations)
      .mockResolvedValueOnce([makeScimConfiguration()])
      .mockResolvedValueOnce([]);
    vi.mocked(DeleteIAMScimConfiguration).mockResolvedValueOnce();
    const user = userEvent.setup();

    renderIAMList();
    await screen.findByText('ユーザーがありません');
    await user.click(screen.getByRole('button', { name: 'SCIM' }));
    await screen.findByText('scim-ci');

    await user.click(screen.getByRole('button', { name: '削除' }));
    await user.click(screen.getByRole('button', { name: '削除する' }));

    expect(DeleteIAMScimConfiguration).toHaveBeenCalledWith('default', '700');
    expect(await screen.findByText('ユーザープロビジョニング(SCIM)設定がありません')).toBeInTheDocument();
  });

  it('regenerates a SCIM configuration token', async () => {
    vi.mocked(GetIAMUsers).mockResolvedValueOnce([]);
    vi.mocked(GetIAMScimConfigurations).mockResolvedValue([makeScimConfiguration()]);
    vi.mocked(RegenerateIAMScimConfigurationToken).mockResolvedValueOnce('regenerated-token');
    const user = userEvent.setup();

    renderIAMList();
    await screen.findByText('ユーザーがありません');
    await user.click(screen.getByRole('button', { name: 'SCIM' }));
    await screen.findByText('scim-ci');

    await user.click(screen.getByRole('button', { name: 'トークン再発行' }));

    expect(RegenerateIAMScimConfigurationToken).toHaveBeenCalledWith('default', '700');
    expect(await screen.findByText('シークレットトークン「scim-ci」')).toBeInTheDocument();
    expect(screen.getByDisplayValue('regenerated-token')).toBeInTheDocument();
  });

  it('shows service policy status and rule templates, and toggles enablement', async () => {
    vi.mocked(GetIAMUsers).mockResolvedValueOnce([]);
    vi.mocked(GetIAMServicePolicyStatus)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false);
    vi.mocked(GetIAMServicePolicyRuleTemplates).mockResolvedValueOnce([makeServicePolicyRuleTemplate()]);
    vi.mocked(EnableIAMServicePolicy).mockResolvedValueOnce();
    const user = userEvent.setup();

    renderIAMList();
    await screen.findByText('ユーザーがありません');

    await user.click(screen.getByRole('button', { name: 'サービスポリシー' }));

    expect(await screen.findByText('無効')).toBeInTheDocument();
    expect(screen.getByText('パブリックバケット禁止')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '有効化する' }));
    expect(EnableIAMServicePolicy).toHaveBeenCalledWith('default');
  });
});
