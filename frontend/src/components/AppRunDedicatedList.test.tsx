import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppRunDedicatedList } from './AppRunDedicatedList';
import { apprun } from '../../wailsjs/go/models';
import {
  GetAppRunClusters,
  GetAppRunApplications,
  GetAppRunApplicationVersions,
  GetAppRunApplicationVersion,
  GetAppRunASGs,
  GetAppRunLoadBalancers,
  GetAppRunWorkerNodes,
  GetAppRunLBNodes,
  ClearAppRunActiveVersion,
  SetAppRunActiveVersion,
} from '../../wailsjs/go/main/App';

vi.mock('../../wailsjs/go/main/App');

function makeCluster(overrides: Partial<apprun.ClusterInfo> = {}): apprun.ClusterInfo {
  return new apprun.ClusterInfo({ id: 'cluster-1', name: 'my-cluster', ...overrides });
}

function makeApp(overrides: Partial<apprun.AppInfo> = {}): apprun.AppInfo {
  return new apprun.AppInfo({ id: 'app-1', clusterId: 'cluster-1', name: 'my-app', activeVersion: 2, ...overrides });
}

function makeAsg(overrides: Partial<apprun.ASGInfo> = {}): apprun.ASGInfo {
  return new apprun.ASGInfo({
    id: 'asg-1', name: 'my-asg', zone: 'is1a', minNodes: 1, maxNodes: 3, workerNodeCount: 2, interfaces: [],
    ...overrides,
  });
}

function makeLb(overrides: Partial<apprun.LBInfo> = {}): apprun.LBInfo {
  return new apprun.LBInfo({ id: 'lb-1', name: 'my-lb', serviceClassPath: '100', ...overrides });
}

function makeLbNode(overrides: Partial<apprun.LBNodeInfo> = {}): apprun.LBNodeInfo {
  return new apprun.LBNodeInfo({
    id: 'lbnode-12345678', status: 'running', interfaces: [{ index: 0, addresses: ['192.0.2.1'] }],
    ...overrides,
  });
}

function makeWorkerNode(overrides: Partial<apprun.WorkerNodeInfo> = {}): apprun.WorkerNodeInfo {
  return new apprun.WorkerNodeInfo({
    id: 'wnode-12345678', status: 'running', draining: false, interfaces: [{ index: 0, addresses: ['192.0.2.2'] }],
    ...overrides,
  });
}

function makeVersion(overrides: Partial<apprun.AppVersionInfo> = {}): apprun.AppVersionInfo {
  return new apprun.AppVersionInfo({
    version: 1, image: 'nginx:1', activeNodeCount: 0, createdAt: '2026-08-01T00:00:00Z',
    ...overrides,
  });
}

function makeVersionDetail(overrides: Partial<apprun.AppVersionDetailInfo> = {}): apprun.AppVersionDetailInfo {
  return new apprun.AppVersionDetailInfo({
    version: 1, cpu: 0.5, memory: 256, scalingMode: 'manual', fixedScale: 1,
    minScale: 0, maxScale: 0, scaleInThreshold: 0, scaleOutThreshold: 0,
    image: 'nginx:1', cmd: [], activeNodeCount: 0, createdAt: '2026-08-01T00:00:00Z',
    exposedPorts: [], env: [],
    ...overrides,
  });
}

describe('AppRunDedicatedList', () => {
  beforeEach(() => {
    vi.mocked(GetAppRunClusters).mockReset();
    vi.mocked(GetAppRunApplications).mockReset();
    vi.mocked(GetAppRunApplicationVersions).mockReset();
    vi.mocked(GetAppRunApplicationVersion).mockReset();
    vi.mocked(GetAppRunASGs).mockReset();
    vi.mocked(GetAppRunLoadBalancers).mockReset();
    vi.mocked(GetAppRunWorkerNodes).mockReset();
    vi.mocked(GetAppRunLBNodes).mockReset();
    vi.mocked(ClearAppRunActiveVersion).mockReset();
    vi.mocked(SetAppRunActiveVersion).mockReset();

    vi.mocked(GetAppRunClusters).mockResolvedValue([]);
    vi.mocked(GetAppRunApplications).mockResolvedValue([]);
    vi.mocked(GetAppRunApplicationVersions).mockResolvedValue([]);
    vi.mocked(GetAppRunApplicationVersion).mockResolvedValue(makeVersionDetail());
    vi.mocked(GetAppRunASGs).mockResolvedValue([]);
    vi.mocked(GetAppRunLoadBalancers).mockResolvedValue([]);
    vi.mocked(GetAppRunWorkerNodes).mockResolvedValue([]);
    vi.mocked(GetAppRunLBNodes).mockResolvedValue([]);
    vi.mocked(ClearAppRunActiveVersion).mockResolvedValue();
    vi.mocked(SetAppRunActiveVersion).mockResolvedValue();
  });

  it('shows an empty state when there are no clusters', async () => {
    render(<AppRunDedicatedList profile="default" />);

    expect(await screen.findByText('クラスタがありません')).toBeInTheDocument();
  });

  it('navigates cluster -> app -> version, sets the active version, and navigates back via breadcrumb', async () => {
    vi.mocked(GetAppRunClusters).mockResolvedValue([makeCluster()]);
    vi.mocked(GetAppRunApplications).mockResolvedValue([makeApp()]);
    vi.mocked(GetAppRunASGs).mockResolvedValue([makeAsg()]);
    vi.mocked(GetAppRunApplicationVersions).mockResolvedValue([
      makeVersion({ version: 1, image: 'nginx:1', activeNodeCount: 0 }),
      makeVersion({ version: 2, image: 'nginx:2', activeNodeCount: 1 }),
    ]);
    vi.mocked(GetAppRunApplicationVersion).mockResolvedValue(makeVersionDetail({ version: 1, image: 'nginx:1' }));
    const user = userEvent.setup();

    render(<AppRunDedicatedList profile="default" />);
    await user.click(await screen.findByText('my-cluster'));

    expect(await screen.findByText('my-app')).toBeInTheDocument();
    expect(screen.getByText('my-asg')).toBeInTheDocument();
    await waitFor(() => {
      expect(GetAppRunApplications).toHaveBeenCalledWith('default', 'cluster-1');
      expect(GetAppRunASGs).toHaveBeenCalledWith('default', 'cluster-1');
    });

    await user.click(screen.getByText('my-app'));

    expect(await screen.findByText('v1')).toBeInTheDocument();
    expect(screen.getByText('v2')).toBeInTheDocument();
    expect(screen.getByText('非アクティブ化')).toBeInTheDocument();
    expect(GetAppRunApplicationVersions).toHaveBeenCalledWith('default', 'app-1');

    await user.click(screen.getByText('v1'));

    expect(await screen.findByText('nginx:1')).toBeInTheDocument();
    expect(GetAppRunApplicationVersion).toHaveBeenCalledWith('default', 'app-1', 1);
    expect(screen.queryByText('Active')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '⋯' }));
    await user.click(screen.getByText('このバージョンをアクティブにする'));

    await waitFor(() => {
      expect(SetAppRunActiveVersion).toHaveBeenCalledWith('default', 'app-1', 1);
    });
    expect(await screen.findByText('Active')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '⋯' })).not.toBeInTheDocument();

    await user.click(screen.getByText('my-app'));

    expect(await screen.findByText('v1')).toBeInTheDocument();

    await user.click(screen.getByText('クラスタ'));

    expect(await screen.findByText('my-cluster')).toBeInTheDocument();
  });

  it('shows load balancer and worker node details for an ASG', async () => {
    vi.mocked(GetAppRunClusters).mockResolvedValue([makeCluster()]);
    vi.mocked(GetAppRunASGs).mockResolvedValue([makeAsg()]);
    vi.mocked(GetAppRunLoadBalancers).mockResolvedValue([makeLb()]);
    vi.mocked(GetAppRunWorkerNodes).mockResolvedValue([makeWorkerNode()]);
    vi.mocked(GetAppRunLBNodes).mockResolvedValue([makeLbNode()]);
    const user = userEvent.setup();

    render(<AppRunDedicatedList profile="default" />);
    await user.click(await screen.findByText('my-cluster'));
    await user.click(await screen.findByText('my-asg'));

    expect(await screen.findByText('my-lb')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    await waitFor(() => {
      expect(GetAppRunLBNodes).toHaveBeenCalledWith('default', 'cluster-1', 'asg-1', 'lb-1');
    });
    expect(screen.getByText('lbnode-1...')).toBeInTheDocument();
    expect(screen.getByText('wnode-12...')).toBeInTheDocument();
    expect(screen.getAllByText('running')).toHaveLength(2);
  });

  it('clears the active version from the app view', async () => {
    vi.mocked(GetAppRunClusters).mockResolvedValue([makeCluster()]);
    vi.mocked(GetAppRunApplications).mockResolvedValue([makeApp({ activeVersion: 2 })]);
    vi.mocked(GetAppRunApplicationVersions).mockResolvedValue([makeVersion({ version: 2, activeNodeCount: 1 })]);
    const user = userEvent.setup();

    render(<AppRunDedicatedList profile="default" />);
    await user.click(await screen.findByText('my-cluster'));
    await user.click(await screen.findByText('my-app'));

    await user.click(await screen.findByText('非アクティブ化'));

    await waitFor(() => {
      expect(ClearAppRunActiveVersion).toHaveBeenCalledWith('default', 'app-1');
    });
    await waitFor(() => {
      expect(screen.queryByText('非アクティブ化')).not.toBeInTheDocument();
    });
    expect(GetAppRunApplicationVersions).toHaveBeenCalledTimes(3);
  });

  it('shows an alert when clearing the active version fails', async () => {
    vi.mocked(GetAppRunClusters).mockResolvedValue([makeCluster()]);
    vi.mocked(GetAppRunApplications).mockResolvedValue([makeApp({ activeVersion: 2 })]);
    vi.mocked(ClearAppRunActiveVersion).mockRejectedValue(new Error('boom'));
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const user = userEvent.setup();

    render(<AppRunDedicatedList profile="default" />);
    await user.click(await screen.findByText('my-cluster'));
    await user.click(await screen.findByText('my-app'));
    await user.click(await screen.findByText('非アクティブ化'));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('アクティブバージョンのクリアに失敗しました');
    });
    expect(screen.getByText('非アクティブ化')).toBeInTheDocument();
  });

  it('shows an alert when setting the active version fails', async () => {
    vi.mocked(GetAppRunClusters).mockResolvedValue([makeCluster()]);
    vi.mocked(GetAppRunApplications).mockResolvedValue([makeApp()]);
    vi.mocked(GetAppRunApplicationVersions).mockResolvedValue([makeVersion({ version: 1 })]);
    vi.mocked(SetAppRunActiveVersion).mockRejectedValue(new Error('boom'));
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const user = userEvent.setup();

    render(<AppRunDedicatedList profile="default" />);
    await user.click(await screen.findByText('my-cluster'));
    await user.click(await screen.findByText('my-app'));
    await user.click(await screen.findByText('v1'));
    await user.click(await screen.findByRole('button', { name: '⋯' }));
    await user.click(screen.getByText('このバージョンをアクティブにする'));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('アクティブバージョンの設定に失敗しました');
    });
    expect(screen.getByRole('button', { name: '⋯' })).toBeInTheDocument();
  });
});
