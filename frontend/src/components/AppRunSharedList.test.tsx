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

    vi.mocked(HasAppRunSharedUser).mockResolvedValue(true);
    vi.mocked(GetAppRunSharedApplications).mockResolvedValue([]);
    vi.mocked(GetAppRunSharedApplication).mockResolvedValue(makeAppDetail());
    vi.mocked(GetAppRunSharedVersions).mockResolvedValue([]);
    vi.mocked(GetAppRunSharedTraffics).mockResolvedValue([]);
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
});
