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
  CreateAppRunApplicationVersion,
  DeleteAppRunCluster,
  DeleteAppRunApplication,
  DeleteAppRunASG,
  DeleteAppRunLoadBalancer,
  DeleteAppRunApplicationVersion,
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
    vi.mocked(CreateAppRunApplicationVersion).mockReset();
    vi.mocked(DeleteAppRunCluster).mockReset();
    vi.mocked(DeleteAppRunApplication).mockReset();
    vi.mocked(DeleteAppRunASG).mockReset();
    vi.mocked(DeleteAppRunLoadBalancer).mockReset();
    vi.mocked(DeleteAppRunApplicationVersion).mockReset();

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
    vi.mocked(CreateAppRunApplicationVersion).mockResolvedValue(
      new apprun.AppVersionInfo({ version: 3, image: 'nginx:3', activeNodeCount: 0, createdAt: '2026-08-08T00:00:00Z' })
    );
    vi.mocked(DeleteAppRunCluster).mockResolvedValue();
    vi.mocked(DeleteAppRunApplication).mockResolvedValue();
    vi.mocked(DeleteAppRunASG).mockResolvedValue();
    vi.mocked(DeleteAppRunLoadBalancer).mockResolvedValue();
    vi.mocked(DeleteAppRunApplicationVersion).mockResolvedValue();
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

  it('cancels a cluster deletion without calling the API', async () => {
    vi.mocked(GetAppRunClusters).mockResolvedValue([makeCluster()]);
    const user = userEvent.setup();

    render(<AppRunDedicatedList profile="default" />);
    await user.click(await screen.findByRole('button', { name: '削除' }));

    expect(await screen.findByText('「my-cluster」を削除しますか？')).toBeInTheDocument();
    await user.click(screen.getByText('キャンセル'));

    expect(screen.queryByText('「my-cluster」を削除しますか？')).not.toBeInTheDocument();
    expect(DeleteAppRunCluster).not.toHaveBeenCalled();
  });

  it('deletes a cluster after confirmation and reloads the cluster list', async () => {
    vi.mocked(GetAppRunClusters).mockResolvedValue([makeCluster()]);
    const user = userEvent.setup();

    render(<AppRunDedicatedList profile="default" />);
    await user.click(await screen.findByRole('button', { name: '削除' }));
    await user.click(await screen.findByText('削除する'));

    await waitFor(() => {
      expect(DeleteAppRunCluster).toHaveBeenCalledWith('default', 'cluster-1');
    });
    expect(GetAppRunClusters).toHaveBeenCalledTimes(2);
  });

  it('shows an alert when cluster deletion fails', async () => {
    vi.mocked(GetAppRunClusters).mockResolvedValue([makeCluster()]);
    vi.mocked(DeleteAppRunCluster).mockRejectedValue(new Error('boom'));
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const user = userEvent.setup();

    render(<AppRunDedicatedList profile="default" />);
    await user.click(await screen.findByRole('button', { name: '削除' }));
    await user.click(await screen.findByText('削除する'));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('削除に失敗しました'));
    });
  });

  it('deletes an application from the cluster view and reloads cluster details', async () => {
    vi.mocked(GetAppRunClusters).mockResolvedValue([makeCluster()]);
    vi.mocked(GetAppRunApplications).mockResolvedValue([makeApp()]);
    vi.mocked(GetAppRunASGs).mockResolvedValue([makeAsg()]);
    const user = userEvent.setup();

    render(<AppRunDedicatedList profile="default" />);
    await user.click(await screen.findByText('my-cluster'));
    await screen.findByText('my-app');

    const deleteButtons = await screen.findAllByRole('button', { name: '削除' });
    await user.click(deleteButtons[0]);
    await user.click(await screen.findByText('削除する'));

    await waitFor(() => {
      expect(DeleteAppRunApplication).toHaveBeenCalledWith('default', 'app-1');
    });
    expect(GetAppRunApplications).toHaveBeenCalledWith('default', 'cluster-1');
  });

  it('deletes an ASG from the cluster view and reloads cluster details', async () => {
    vi.mocked(GetAppRunClusters).mockResolvedValue([makeCluster()]);
    vi.mocked(GetAppRunApplications).mockResolvedValue([makeApp()]);
    vi.mocked(GetAppRunASGs).mockResolvedValue([makeAsg()]);
    const user = userEvent.setup();

    render(<AppRunDedicatedList profile="default" />);
    await user.click(await screen.findByText('my-cluster'));
    await screen.findByText('my-asg');

    const deleteButtons = await screen.findAllByRole('button', { name: '削除' });
    await user.click(deleteButtons[1]);
    await user.click(await screen.findByText('削除する'));

    await waitFor(() => {
      expect(DeleteAppRunASG).toHaveBeenCalledWith('default', 'cluster-1', 'asg-1');
    });
    expect(GetAppRunASGs).toHaveBeenCalledWith('default', 'cluster-1');
  });

  it('deletes a load balancer from the ASG view and reloads ASG details', async () => {
    vi.mocked(GetAppRunClusters).mockResolvedValue([makeCluster()]);
    vi.mocked(GetAppRunASGs).mockResolvedValue([makeAsg()]);
    vi.mocked(GetAppRunLoadBalancers).mockResolvedValue([makeLb()]);
    const user = userEvent.setup();

    render(<AppRunDedicatedList profile="default" />);
    await user.click(await screen.findByText('my-cluster'));
    await user.click(await screen.findByText('my-asg'));
    await user.click(await screen.findByRole('button', { name: '削除' }));
    await user.click(await screen.findByText('削除する'));

    await waitFor(() => {
      expect(DeleteAppRunLoadBalancer).toHaveBeenCalledWith('default', 'cluster-1', 'asg-1', 'lb-1');
    });
    expect(GetAppRunLoadBalancers).toHaveBeenCalledWith('default', 'cluster-1', 'asg-1');
  });

  it('deletes a non-active version from the version list and reloads it', async () => {
    vi.mocked(GetAppRunClusters).mockResolvedValue([makeCluster()]);
    vi.mocked(GetAppRunApplications).mockResolvedValue([makeApp({ activeVersion: 2 })]);
    vi.mocked(GetAppRunApplicationVersions).mockResolvedValue([
      makeVersion({ version: 1 }),
      makeVersion({ version: 2 }),
    ]);
    const user = userEvent.setup();

    render(<AppRunDedicatedList profile="default" />);
    await user.click(await screen.findByText('my-cluster'));
    await user.click(await screen.findByText('my-app'));
    await screen.findByText('v1');

    const deleteButtons = await screen.findAllByRole('button', { name: '削除' });
    expect(deleteButtons).toHaveLength(2);
    await user.click(deleteButtons[0]);
    await user.click(await screen.findByText('削除する'));

    await waitFor(() => {
      expect(DeleteAppRunApplicationVersion).toHaveBeenCalledWith('default', 'app-1', 1);
    });
    expect(GetAppRunApplicationVersions).toHaveBeenCalledTimes(2);
  });

  it('disables the delete button for the active version in the version list', async () => {
    vi.mocked(GetAppRunClusters).mockResolvedValue([makeCluster()]);
    vi.mocked(GetAppRunApplications).mockResolvedValue([makeApp({ activeVersion: 1 })]);
    vi.mocked(GetAppRunApplicationVersions).mockResolvedValue([makeVersion({ version: 1 })]);
    const user = userEvent.setup();

    render(<AppRunDedicatedList profile="default" />);
    await user.click(await screen.findByText('my-cluster'));
    await user.click(await screen.findByText('my-app'));

    expect(await screen.findByRole('button', { name: '削除' })).toBeDisabled();
  });

  it('deletes the current version from the version detail dropdown and navigates back to the app view', async () => {
    vi.mocked(GetAppRunClusters).mockResolvedValue([makeCluster()]);
    vi.mocked(GetAppRunApplications).mockResolvedValue([makeApp({ activeVersion: 2 })]);
    vi.mocked(GetAppRunApplicationVersions).mockResolvedValue([makeVersion({ version: 1 })]);
    vi.mocked(GetAppRunApplicationVersion).mockResolvedValue(makeVersionDetail({ version: 1 }));
    const user = userEvent.setup();

    render(<AppRunDedicatedList profile="default" />);
    await user.click(await screen.findByText('my-cluster'));
    await user.click(await screen.findByText('my-app'));
    await user.click(await screen.findByText('v1'));

    await user.click(await screen.findByRole('button', { name: '⋯' }));
    await user.click(screen.getByText('削除'));
    await user.click(await screen.findByText('削除する'));

    await waitFor(() => {
      expect(DeleteAppRunApplicationVersion).toHaveBeenCalledWith('default', 'app-1', 1);
    });
    expect(await screen.findByText('+ デプロイ')).toBeInTheDocument();
  });

  it('deploys a new version with default (manual) scaling and reloads the version list', async () => {
    vi.mocked(GetAppRunClusters).mockResolvedValue([makeCluster()]);
    vi.mocked(GetAppRunApplications).mockResolvedValue([makeApp()]);
    vi.mocked(GetAppRunApplicationVersions).mockResolvedValue([makeVersion({ version: 1 })]);
    const user = userEvent.setup();

    render(<AppRunDedicatedList profile="default" />);
    await user.click(await screen.findByText('my-cluster'));
    await user.click(await screen.findByText('my-app'));

    await user.click(await screen.findByText('+ デプロイ'));
    expect(await screen.findByText('新しいバージョンをデプロイ')).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('docker.io/library/nginx:latest'), 'nginx:latest');
    await user.click(screen.getByRole('button', { name: 'デプロイする' }));

    await waitFor(() => {
      expect(CreateAppRunApplicationVersion).toHaveBeenCalledWith(
        'default',
        'app-1',
        expect.objectContaining({ image: 'nginx:latest', scalingMode: 'manual', fixedScale: 1 })
      );
    });
    expect(GetAppRunApplicationVersions).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('新しいバージョンをデプロイ')).not.toBeInTheDocument();
  });

  it('requires an image before submitting the deploy form', async () => {
    vi.mocked(GetAppRunClusters).mockResolvedValue([makeCluster()]);
    vi.mocked(GetAppRunApplications).mockResolvedValue([makeApp()]);
    const user = userEvent.setup();

    render(<AppRunDedicatedList profile="default" />);
    await user.click(await screen.findByText('my-cluster'));
    await user.click(await screen.findByText('my-app'));
    await user.click(await screen.findByText('+ デプロイ'));

    expect(screen.getByRole('button', { name: 'デプロイする' })).toBeDisabled();
    expect(CreateAppRunApplicationVersion).not.toHaveBeenCalled();
  });

  it('switches to cpu-based scaling and sends min/max scale instead of a fixed scale', async () => {
    vi.mocked(GetAppRunClusters).mockResolvedValue([makeCluster()]);
    vi.mocked(GetAppRunApplications).mockResolvedValue([makeApp()]);
    const user = userEvent.setup();

    render(<AppRunDedicatedList profile="default" />);
    await user.click(await screen.findByText('my-cluster'));
    await user.click(await screen.findByText('my-app'));
    await user.click(await screen.findByText('+ デプロイ'));

    await user.type(screen.getByPlaceholderText('docker.io/library/nginx:latest'), 'nginx:latest');
    await user.selectOptions(screen.getByDisplayValue('固定 (manual)'), 'cpu');
    await user.click(screen.getByRole('button', { name: 'デプロイする' }));

    await waitFor(() => {
      expect(CreateAppRunApplicationVersion).toHaveBeenCalledWith(
        'default',
        'app-1',
        expect.objectContaining({ scalingMode: 'cpu', minScale: 1, maxScale: 3, fixedScale: undefined })
      );
    });
  });

  it('cancels the deploy form without calling the API', async () => {
    vi.mocked(GetAppRunClusters).mockResolvedValue([makeCluster()]);
    vi.mocked(GetAppRunApplications).mockResolvedValue([makeApp()]);
    const user = userEvent.setup();

    render(<AppRunDedicatedList profile="default" />);
    await user.click(await screen.findByText('my-cluster'));
    await user.click(await screen.findByText('my-app'));
    await user.click(await screen.findByText('+ デプロイ'));
    await user.type(screen.getByPlaceholderText('docker.io/library/nginx:latest'), 'nginx:latest');

    await user.click(screen.getByText('キャンセル'));

    expect(screen.queryByText('新しいバージョンをデプロイ')).not.toBeInTheDocument();
    expect(CreateAppRunApplicationVersion).not.toHaveBeenCalled();
  });

  it('shows an error message when deploying a version fails', async () => {
    vi.mocked(GetAppRunClusters).mockResolvedValue([makeCluster()]);
    vi.mocked(GetAppRunApplications).mockResolvedValue([makeApp()]);
    vi.mocked(CreateAppRunApplicationVersion).mockRejectedValue(new Error('quota exceeded'));
    const user = userEvent.setup();

    render(<AppRunDedicatedList profile="default" />);
    await user.click(await screen.findByText('my-cluster'));
    await user.click(await screen.findByText('my-app'));
    await user.click(await screen.findByText('+ デプロイ'));
    await user.type(screen.getByPlaceholderText('docker.io/library/nginx:latest'), 'nginx:latest');
    await user.click(screen.getByRole('button', { name: 'デプロイする' }));

    expect(await screen.findByText(/エラー: Error: quota exceeded/)).toBeInTheDocument();
    expect(screen.getByText('新しいバージョンをデプロイ')).toBeInTheDocument();
  });
});
