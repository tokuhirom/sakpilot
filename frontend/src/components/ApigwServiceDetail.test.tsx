import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApigwServiceDetail } from './ApigwServiceDetail';
import { apigw } from '../../wailsjs/go/models';
import {
  GetApigwService,
  UpdateApigwService,
  GetApigwRoutes,
  CreateApigwRoute,
  UpdateApigwRoute,
  DeleteApigwRoute,
} from '../../wailsjs/go/main/App';

vi.mock('../../wailsjs/go/main/App');

function renderDetail() {
  return render(<ApigwServiceDetail profile="default" serviceId="svc-1" />);
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

function makeRoute(overrides: Partial<apigw.RouteInfo> = {}): apigw.RouteInfo {
  return new apigw.RouteInfo({
    id: 'route-1',
    serviceId: 'svc-1',
    name: 'my_route',
    tags: [],
    protocols: 'http,https',
    path: '/foo',
    host: '',
    hosts: [],
    methods: ['GET'],
    httpsRedirectStatusCode: 0,
    regexPriority: 0,
    stripPath: true,
    preserveHost: false,
    createdAt: '2026-01-01T00:00:00+09:00',
    updatedAt: '2026-01-01T00:00:00+09:00',
    ...overrides,
  });
}

describe('ApigwServiceDetail', () => {
  beforeEach(() => {
    vi.mocked(GetApigwService).mockReset();
    vi.mocked(UpdateApigwService).mockReset();
    vi.mocked(GetApigwRoutes).mockReset();
    vi.mocked(CreateApigwRoute).mockReset();
    vi.mocked(UpdateApigwRoute).mockReset();
    vi.mocked(DeleteApigwRoute).mockReset();
  });

  it('shows service basic info and routes', async () => {
    vi.mocked(GetApigwService).mockResolvedValue(makeService());
    vi.mocked(GetApigwRoutes).mockResolvedValue([makeRoute()]);

    renderDetail();

    expect(await screen.findByText('サービス詳細: my_service')).toBeInTheDocument();
    expect(screen.getByText('my_route')).toBeInTheDocument();
    expect(GetApigwRoutes).toHaveBeenCalledWith('default', 'svc-1');
  });

  it('shows an empty state when there are no routes', async () => {
    vi.mocked(GetApigwService).mockResolvedValue(makeService());
    vi.mocked(GetApigwRoutes).mockResolvedValue([]);

    renderDetail();

    expect(await screen.findByText('ルートがありません')).toBeInTheDocument();
  });

  it('edits basic info', async () => {
    vi.mocked(GetApigwService).mockResolvedValue(makeService());
    vi.mocked(GetApigwRoutes).mockResolvedValue([]);
    vi.mocked(UpdateApigwService).mockResolvedValueOnce();
    const user = userEvent.setup();

    renderDetail();
    await screen.findByText('サービス詳細: my_service');

    await user.click(screen.getByRole('button', { name: '編集' }));
    const nameInput = screen.getByDisplayValue('my_service');
    await user.clear(nameInput);
    await user.type(nameInput, 'renamed_service');
    await user.click(screen.getByRole('button', { name: '保存する' }));

    expect(UpdateApigwService).toHaveBeenCalledWith(
      'default', 'svc-1', 'renamed_service', 'https', 'backend.example.com', '/', 443, 3, 5, 60, 60
    );
  });

  it('creates a route from the create dialog', async () => {
    vi.mocked(GetApigwService).mockResolvedValue(makeService());
    vi.mocked(GetApigwRoutes)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeRoute()]);
    vi.mocked(CreateApigwRoute).mockResolvedValueOnce(makeRoute());
    const user = userEvent.setup();

    renderDetail();
    await screen.findByText('ルートがありません');

    await user.click(screen.getByRole('button', { name: '+ ルート作成' }));
    await user.type(screen.getByPlaceholderText('my_route'), 'my_route');
    await user.clear(screen.getByPlaceholderText('/'));
    await user.type(screen.getByPlaceholderText('/'), '/foo');
    await user.click(screen.getByRole('button', { name: '作成する' }));

    expect(CreateApigwRoute).toHaveBeenCalledWith(
      'default', 'svc-1', 'my_route', 'http,https', '/foo', [], [], 0, 0, true, false, []
    );
    expect(await screen.findByText('my_route')).toBeInTheDocument();
  });

  it('deletes a route after confirmation', async () => {
    vi.mocked(GetApigwService).mockResolvedValue(makeService());
    vi.mocked(GetApigwRoutes)
      .mockResolvedValueOnce([makeRoute()])
      .mockResolvedValueOnce([]);
    vi.mocked(DeleteApigwRoute).mockResolvedValueOnce();
    const user = userEvent.setup();

    renderDetail();
    await screen.findByText('my_route');

    await user.click(screen.getByRole('button', { name: '削除' }));
    await user.click(screen.getByRole('button', { name: '削除する' }));

    expect(DeleteApigwRoute).toHaveBeenCalledWith('default', 'svc-1', 'route-1');
    expect(await screen.findByText('ルートがありません')).toBeInTheDocument();
  });
});
