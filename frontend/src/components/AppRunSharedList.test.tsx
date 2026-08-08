import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppRunSharedList } from './AppRunSharedList';
import { apprunshared } from '../../wailsjs/go/models';
import {
  GetAppRunSharedApplications,
  GetAppRunSharedApplication,
  GetAppRunSharedVersions,
  GetAppRunSharedTraffics,
  HasAppRunSharedUser,
  CreateAppRunSharedApplication,
  UpdateAppRunSharedApplication,
} from '../../wailsjs/go/main/App';

vi.mock('../../wailsjs/go/main/App');

function makeApp(overrides: Partial<apprunshared.AppInfo> = {}): apprunshared.AppInfo {
  return new apprunshared.AppInfo({
    id: 'app-1',
    name: 'my-app',
    status: 'healthy',
    publicUrl: 'https://my-app.apprun.sakura.ne.jp',
    createdAt: '2026-08-01T00:00:00Z',
    ...overrides,
  });
}

function makeAppDetail(overrides: Partial<apprunshared.AppDetailInfo> = {}): apprunshared.AppDetailInfo {
  return new apprunshared.AppDetailInfo({
    id: 'app-1',
    name: 'my-app',
    status: 'healthy',
    publicUrl: 'https://my-app.apprun.sakura.ne.jp',
    port: 8080,
    minScale: 1,
    maxScale: 3,
    timeoutSeconds: 30,
    createdAt: '2026-08-01T00:00:00Z',
    components: [],
    ...overrides,
  });
}

function makeVersion(overrides: Partial<apprunshared.VersionInfo> = {}): apprunshared.VersionInfo {
  return new apprunshared.VersionInfo({
    id: 'ver-1',
    name: 'v1',
    status: 'active',
    createdAt: '2026-08-01T00:00:00Z',
    ...overrides,
  });
}

function makeTraffic(overrides: Partial<apprunshared.TrafficInfo> = {}): apprunshared.TrafficInfo {
  return new apprunshared.TrafficInfo({
    versionName: 'v1',
    isLatestVersion: true,
    percent: 100,
    ...overrides,
  });
}

describe('AppRunSharedList', () => {
  beforeEach(() => {
    vi.mocked(HasAppRunSharedUser).mockReset();
    vi.mocked(GetAppRunSharedApplications).mockReset();
    vi.mocked(GetAppRunSharedApplication).mockReset();
    vi.mocked(GetAppRunSharedVersions).mockReset();
    vi.mocked(GetAppRunSharedTraffics).mockReset();
    vi.mocked(CreateAppRunSharedApplication).mockReset();
    vi.mocked(UpdateAppRunSharedApplication).mockReset();

    vi.mocked(HasAppRunSharedUser).mockResolvedValue(true);
    vi.mocked(GetAppRunSharedApplications).mockResolvedValue([]);
    vi.mocked(GetAppRunSharedApplication).mockResolvedValue(makeAppDetail());
    vi.mocked(GetAppRunSharedVersions).mockResolvedValue([]);
    vi.mocked(GetAppRunSharedTraffics).mockResolvedValue([]);
    vi.mocked(CreateAppRunSharedApplication).mockResolvedValue(makeAppDetail());
    vi.mocked(UpdateAppRunSharedApplication).mockResolvedValue(makeAppDetail());
  });

  it('shows a guidance message when no shared user is configured', async () => {
    vi.mocked(HasAppRunSharedUser).mockResolvedValue(false);

    render(<AppRunSharedList profile="default" />);

    expect(await screen.findByText(/AppRun共用型のユーザーが設定されていません/)).toBeInTheDocument();
  });

  it('falls back to hasUser=false when HasAppRunSharedUser fails', async () => {
    vi.mocked(HasAppRunSharedUser).mockRejectedValue(new Error('boom'));

    render(<AppRunSharedList profile="default" />);

    expect(await screen.findByText(/AppRun共用型のユーザーが設定されていません/)).toBeInTheDocument();
  });

  it('shows an empty state when there are no applications', async () => {
    render(<AppRunSharedList profile="default" />);

    expect(await screen.findByText('アプリケーションがありません')).toBeInTheDocument();
  });

  it('lists applications', async () => {
    vi.mocked(GetAppRunSharedApplications).mockResolvedValue([makeApp()]);

    render(<AppRunSharedList profile="default" />);

    expect(await screen.findByText('my-app')).toBeInTheDocument();
    expect(screen.getByText('healthy')).toBeInTheDocument();
    expect(screen.getByText('https://my-app.apprun.sakura.ne.jp')).toBeInTheDocument();
  });

  it('shows an error message when loading applications fails', async () => {
    vi.mocked(GetAppRunSharedApplications).mockRejectedValue(new Error('network error'));

    render(<AppRunSharedList profile="default" />);

    expect(await screen.findByText('エラー: network error')).toBeInTheDocument();
  });

  it('navigates to the detail view when a row is clicked and back again', async () => {
    vi.mocked(GetAppRunSharedApplications).mockResolvedValue([makeApp()]);
    vi.mocked(GetAppRunSharedApplication).mockResolvedValue(
      makeAppDetail({ components: [{ name: 'web', image: 'nginx:latest', maxCpu: '0.5', maxMemory: '256Mi' } as apprunshared.ComponentInfo] })
    );
    vi.mocked(GetAppRunSharedVersions).mockResolvedValue([makeVersion()]);
    vi.mocked(GetAppRunSharedTraffics).mockResolvedValue([makeTraffic()]);
    const user = userEvent.setup();

    render(<AppRunSharedList profile="default" />);
    await user.click(await screen.findByText('my-app'));

    expect(await screen.findByRole('heading', { name: 'my-app' })).toBeInTheDocument();
    await waitFor(() => {
      expect(GetAppRunSharedApplication).toHaveBeenCalledWith('default', 'app-1');
      expect(GetAppRunSharedVersions).toHaveBeenCalledWith('default', 'app-1');
      expect(GetAppRunSharedTraffics).toHaveBeenCalledWith('default', 'app-1');
    });
    expect(await screen.findByText('nginx:latest')).toBeInTheDocument();
    expect(screen.getByText('(最新)')).toBeInTheDocument();
    expect(screen.getByText('v1')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '← 戻る' }));

    expect(await screen.findByRole('heading', { name: 'AppRun共用型' })).toBeInTheDocument();
    expect(screen.getByText('my-app')).toBeInTheDocument();
  });

  it('shows an error message when loading the detail fails', async () => {
    vi.mocked(GetAppRunSharedApplications).mockResolvedValue([makeApp()]);
    vi.mocked(GetAppRunSharedApplication).mockRejectedValue(new Error('detail error'));
    const user = userEvent.setup();

    render(<AppRunSharedList profile="default" />);
    await user.click(await screen.findByText('my-app'));

    expect(await screen.findByText('エラー: detail error')).toBeInTheDocument();
  });

  it('creates an application via the create modal', async () => {
    const user = userEvent.setup();

    render(<AppRunSharedList profile="default" />);
    await screen.findByText('アプリケーションがありません');

    await user.click(screen.getByRole('button', { name: '+ アプリ作成' }));
    await user.type(screen.getByPlaceholderText('my-app'), 'new-app');
    await user.type(screen.getByPlaceholderText('docker.io/library/nginx:latest'), 'docker.io/library/nginx:latest');
    await user.click(screen.getByRole('button', { name: '作成する' }));

    await waitFor(() => {
      expect(CreateAppRunSharedApplication).toHaveBeenCalledWith('default', expect.objectContaining({
        name: 'new-app',
        image: 'docker.io/library/nginx:latest',
      }));
    });
    expect(screen.queryByText('アプリケーションを作成')).not.toBeInTheDocument();
  });

  it('shows a validation error when creating without required fields', async () => {
    const user = userEvent.setup();

    render(<AppRunSharedList profile="default" />);
    await screen.findByText('アプリケーションがありません');

    await user.click(screen.getByRole('button', { name: '+ アプリ作成' }));
    await user.type(screen.getByPlaceholderText('my-app'), 'new-app');
    expect(screen.getByRole('button', { name: '作成する' })).toBeDisabled();
    expect(CreateAppRunSharedApplication).not.toHaveBeenCalled();
  });

  it('cancels the create modal without submitting', async () => {
    const user = userEvent.setup();

    render(<AppRunSharedList profile="default" />);
    await screen.findByText('アプリケーションがありません');

    await user.click(screen.getByRole('button', { name: '+ アプリ作成' }));
    await user.click(screen.getByRole('button', { name: 'キャンセル' }));

    expect(screen.queryByText('アプリケーションを作成')).not.toBeInTheDocument();
    expect(CreateAppRunSharedApplication).not.toHaveBeenCalled();
  });

  it('updates scale/timeout settings via the edit modal', async () => {
    vi.mocked(GetAppRunSharedApplications).mockResolvedValue([makeApp()]);
    const user = userEvent.setup();

    render(<AppRunSharedList profile="default" />);
    await user.click(await screen.findByText('my-app'));
    await screen.findByRole('heading', { name: 'my-app' });

    await user.click(screen.getByRole('button', { name: '編集' }));
    const maxScaleInput = screen.getByDisplayValue('3');
    await user.clear(maxScaleInput);
    await user.type(maxScaleInput, '5');
    await user.click(screen.getByRole('button', { name: '保存する' }));

    await waitFor(() => {
      expect(UpdateAppRunSharedApplication).toHaveBeenCalledWith('default', 'app-1', expect.objectContaining({
        maxScale: 5,
      }));
    });
    expect(screen.queryByText('スケール・タイムアウト設定を編集')).not.toBeInTheDocument();
  });
});
