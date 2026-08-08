import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { MonitoringMetricDetail } from './MonitoringMetricDetail';
import { sakura } from '../../wailsjs/go/models';
import {
  GetMSMetricsStorageDetail,
  GetMSMetricsAccessKeys,
  QueryMSPrometheusPublishers,
  QueryMSPrometheusMetricsByPublisher,
  QueryMSPrometheusMetricsWithoutPublisher,
  UpdateMSMetricsStorage,
  DeleteMSMetricsStorage,
  CreateMSMetricsAccessKey,
  DeleteMSMetricsAccessKey,
} from '../../wailsjs/go/main/App';

vi.mock('../../wailsjs/go/main/App');
vi.mock('./MetricGraph', () => ({
  MetricGraph: ({ metricName }: { metricName: string }) => <div>graph:{metricName}</div>,
}));

function makeStorageDetail(overrides: Partial<sakura.MSMetricsStorageDetail> = {}): sakura.MSMetricsStorageDetail {
  return new sakura.MSMetricsStorageDetail({
    id: 'storage-1',
    name: 'my-storage',
    description: '',
    endpoint: 'https://metrics.example.com',
    ...overrides,
  });
}

function makeAccessKey(overrides: Partial<sakura.MSMetricsAccessKey> = {}): sakura.MSMetricsAccessKey {
  return new sakura.MSMetricsAccessKey({
    id: 'key-1',
    uid: 'uid-1',
    token: 'abcdefghijklmnopqrstuvwxyz0123456789',
    description: '',
    ...overrides,
  });
}

function renderDetail(storageId = 'storage-1') {
  return render(
    <MemoryRouter>
      <MonitoringMetricDetail profile="default" storageId={storageId} />
    </MemoryRouter>
  );
}

describe('MonitoringMetricDetail', () => {
  beforeEach(() => {
    vi.mocked(GetMSMetricsStorageDetail).mockReset();
    vi.mocked(GetMSMetricsAccessKeys).mockReset();
    vi.mocked(QueryMSPrometheusPublishers).mockReset();
    vi.mocked(QueryMSPrometheusMetricsByPublisher).mockReset();
    vi.mocked(QueryMSPrometheusMetricsWithoutPublisher).mockReset();
    vi.mocked(UpdateMSMetricsStorage).mockReset();
    vi.mocked(DeleteMSMetricsStorage).mockReset();
    vi.mocked(CreateMSMetricsAccessKey).mockReset();
    vi.mocked(DeleteMSMetricsAccessKey).mockReset();

    vi.mocked(GetMSMetricsStorageDetail).mockResolvedValue(makeStorageDetail());
    vi.mocked(GetMSMetricsAccessKeys).mockResolvedValue([]);
    vi.mocked(QueryMSPrometheusPublishers).mockResolvedValue([]);
  });

  it('shows storage basic info', async () => {
    renderDetail();

    expect(await screen.findByText('メトリクスストレージ: my-storage')).toBeInTheDocument();
    expect(screen.getByText('https://metrics.example.com')).toBeInTheDocument();
  });

  it('shows a guidance message when there are no access keys', async () => {
    renderDetail();

    expect(await screen.findByText(/アクセスキーを作成してください/)).toBeInTheDocument();
    expect(QueryMSPrometheusPublishers).not.toHaveBeenCalled();
  });

  it('shows an error message when the storage detail fails to load', async () => {
    vi.mocked(GetMSMetricsStorageDetail).mockRejectedValue(new Error('boom'));

    renderDetail();

    expect(await screen.findByText(/データの読み込みに失敗しました/)).toBeInTheDocument();
  });

  it('shows publisher buttons and keeps the storage info when publishers fail to load', async () => {
    vi.mocked(GetMSMetricsAccessKeys).mockResolvedValue([makeAccessKey()]);
    vi.mocked(QueryMSPrometheusPublishers).mockRejectedValue(new Error('boom'));

    renderDetail();

    expect(await screen.findByText('サービス一覧の取得に失敗しました')).toBeInTheDocument();
    expect(screen.getByText('メトリクスストレージ: my-storage')).toBeInTheDocument();
  });

  it('loads and groups metrics by variant when a publisher is selected', async () => {
    vi.mocked(GetMSMetricsAccessKeys).mockResolvedValue([makeAccessKey()]);
    vi.mocked(QueryMSPrometheusPublishers).mockResolvedValue(['sakura-cloud']);
    vi.mocked(QueryMSPrometheusMetricsByPublisher).mockResolvedValue([
      new sakura.MetricInfo({ name: 'cpu_usage', variant: 'server' }),
      new sakura.MetricInfo({ name: 'disk_read', variant: 'disk' }),
    ]);
    const user = userEvent.setup();

    renderDetail();
    await user.click(await screen.findByRole('button', { name: 'sakura-cloud' }));

    await waitFor(() => {
      expect(QueryMSPrometheusMetricsByPublisher).toHaveBeenCalledWith('default', 'storage-1', 'sakura-cloud');
    });
    expect(await screen.findByText('graph:cpu_usage')).toBeInTheDocument();
    expect(screen.getByText('graph:disk_read')).toBeInTheDocument();
    expect(screen.getByText('server (1)')).toBeInTheDocument();
    expect(screen.getByText('disk (1)')).toBeInTheDocument();
  });

  it('shows a message when the selected publisher has no metrics', async () => {
    vi.mocked(GetMSMetricsAccessKeys).mockResolvedValue([makeAccessKey()]);
    vi.mocked(QueryMSPrometheusPublishers).mockResolvedValue(['sakura-cloud']);
    vi.mocked(QueryMSPrometheusMetricsByPublisher).mockResolvedValue([]);
    const user = userEvent.setup();

    renderDetail();
    await user.click(await screen.findByRole('button', { name: 'sakura-cloud' }));

    expect(await screen.findByText('メトリクスが見つかりません')).toBeInTheDocument();
  });

  it('loads custom metrics without a publisher label', async () => {
    vi.mocked(GetMSMetricsAccessKeys).mockResolvedValue([makeAccessKey()]);
    vi.mocked(QueryMSPrometheusPublishers).mockResolvedValue([]);
    vi.mocked(QueryMSPrometheusMetricsWithoutPublisher).mockResolvedValue(['custom_metric_b', 'custom_metric_a']);
    const user = userEvent.setup();

    renderDetail();
    await user.click(await screen.findByRole('button', { name: 'カスタムメトリクス' }));

    await waitFor(() => {
      expect(QueryMSPrometheusMetricsWithoutPublisher).toHaveBeenCalledWith('default', 'storage-1');
    });
    expect(await screen.findByText('graph:custom_metric_a')).toBeInTheDocument();
    expect(screen.getByText('graph:custom_metric_b')).toBeInTheDocument();
    expect(screen.getByText('(その他) (2)')).toBeInTheDocument();
  });

  it('edits the storage name and description', async () => {
    vi.mocked(UpdateMSMetricsStorage).mockResolvedValue(
      new sakura.MSMetricInfo({ id: 'storage-1', name: 'renamed-storage', description: 'updated', routings: [] })
    );
    const user = userEvent.setup();

    renderDetail();
    await user.click(await screen.findByRole('button', { name: '編集' }));
    const nameField = screen.getByLabelText('名前');
    await user.clear(nameField);
    await user.type(nameField, 'renamed-storage');
    await user.type(screen.getByLabelText('説明'), 'updated');
    await user.click(screen.getByRole('button', { name: '保存する' }));

    await waitFor(() => {
      expect(UpdateMSMetricsStorage).toHaveBeenCalledWith('default', 'storage-1', 'renamed-storage', 'updated');
    });
    expect(await screen.findByText('メトリクスストレージ: renamed-storage')).toBeInTheDocument();
  });

  it('deletes the storage after confirmation', async () => {
    const user = userEvent.setup();

    renderDetail();
    await user.click(await screen.findByRole('button', { name: '削除' }));
    await user.click(screen.getByRole('button', { name: '削除する' }));

    await waitFor(() => {
      expect(DeleteMSMetricsStorage).toHaveBeenCalledWith('default', 'storage-1');
    });
  });

  it('creates an access key and shows the one-time secret', async () => {
    vi.mocked(CreateMSMetricsAccessKey).mockResolvedValue(
      new sakura.MSMetricsAccessKeyCreated({
        uid: 'uid-new',
        token: 'token-new',
        secret: 'secret-new',
        description: 'ingest key',
      })
    );
    const user = userEvent.setup();

    renderDetail();
    await user.click(await screen.findByRole('button', { name: '+ アクセスキー作成' }));
    await user.type(screen.getByLabelText('説明'), 'ingest key');
    await user.click(screen.getByRole('button', { name: '作成する' }));

    await waitFor(() => {
      expect(CreateMSMetricsAccessKey).toHaveBeenCalledWith('default', 'storage-1', 'ingest key');
    });
    expect(await screen.findByText('アクセスキーを作成しました')).toBeInTheDocument();
    expect(screen.getByDisplayValue('secret-new')).toBeInTheDocument();
  });

  it('deletes an access key after confirmation', async () => {
    vi.mocked(GetMSMetricsAccessKeys).mockResolvedValue([makeAccessKey()]);
    const user = userEvent.setup();

    renderDetail();
    // The header has a storage-delete button and the access key row has its own; both are labeled "削除".
    const deleteButtons = await screen.findAllByRole('button', { name: '削除' });
    await user.click(deleteButtons[deleteButtons.length - 1]);
    await user.click(screen.getByRole('button', { name: '削除する' }));

    await waitFor(() => {
      expect(DeleteMSMetricsAccessKey).toHaveBeenCalledWith('default', 'storage-1', 'uid-1');
    });
  });
});
