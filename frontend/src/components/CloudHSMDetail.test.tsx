import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CloudHSMDetail } from './CloudHSMDetail';
import { cloudhsm } from '../../wailsjs/go/models';
import {
  GetCloudHSM,
  UpdateCloudHSM,
  GetCloudHSMClients,
  CreateCloudHSMClient,
  DeleteCloudHSMClient,
  GetCloudHSMPeers,
  CreateCloudHSMPeer,
  DeleteCloudHSMPeer,
} from '../../wailsjs/go/main/App';

vi.mock('../../wailsjs/go/main/App');

function renderDetail() {
  return render(<CloudHSMDetail profile="default" hsmId="100000000001" />);
}

function makeHSM(overrides: Partial<cloudhsm.CloudHSMInfo> = {}): cloudhsm.CloudHSMInfo {
  return new cloudhsm.CloudHSMInfo({
    id: '100000000001',
    name: 'prod-hsm',
    description: 'a production hsm',
    availability: 'available',
    tags: ['env:prod'],
    ipv4NetworkAddress: '192.168.100.0',
    ipv4PrefixLength: 24,
    ipv4Address: '192.168.100.1',
    createdAt: '2026-01-01T00:00:00+09:00',
    modifiedAt: '2026-01-01T00:00:00+09:00',
    ...overrides,
  });
}

function makeClient(overrides: Partial<cloudhsm.ClientInfo> = {}): cloudhsm.ClientInfo {
  return new cloudhsm.ClientInfo({
    id: '100000000002',
    name: 'app-client',
    certificate: '-----BEGIN CERTIFICATE-----\ndummy\n-----END CERTIFICATE-----',
    availability: 'available',
    createdAt: '2026-01-01T00:00:00+09:00',
    modifiedAt: '2026-01-01T00:00:00+09:00',
    ...overrides,
  });
}

function makePeer(overrides: Partial<cloudhsm.PeerInfo> = {}): cloudhsm.PeerInfo {
  return new cloudhsm.PeerInfo({
    id: '112233445566',
    index: 0,
    status: 'UP',
    routes: ['10.0.0.0/24'],
    ...overrides,
  });
}

describe('CloudHSMDetail', () => {
  beforeEach(() => {
    vi.mocked(GetCloudHSM).mockReset();
    vi.mocked(UpdateCloudHSM).mockReset();
    vi.mocked(GetCloudHSMClients).mockReset();
    vi.mocked(CreateCloudHSMClient).mockReset();
    vi.mocked(DeleteCloudHSMClient).mockReset();
    vi.mocked(GetCloudHSMPeers).mockReset();
    vi.mocked(CreateCloudHSMPeer).mockReset();
    vi.mocked(DeleteCloudHSMPeer).mockReset();

    vi.mocked(GetCloudHSM).mockResolvedValue(makeHSM());
    vi.mocked(GetCloudHSMClients).mockResolvedValue([]);
    vi.mocked(GetCloudHSMPeers).mockResolvedValue([]);
  });

  it('shows the basic info of the HSM', async () => {
    renderDetail();

    expect(await screen.findByText('CloudHSM詳細: prod-hsm')).toBeInTheDocument();
    expect(screen.getByText('a production hsm')).toBeInTheDocument();
    expect(screen.getByText('192.168.100.0/24')).toBeInTheDocument();
    expect(screen.getByText('available')).toBeInTheDocument();
  });

  it('edits the basic info', async () => {
    vi.mocked(UpdateCloudHSM).mockResolvedValueOnce(makeHSM({ name: 'prod-hsm-renamed' }));
    const user = userEvent.setup();

    renderDetail();
    await screen.findByText('CloudHSM詳細: prod-hsm');

    await user.click(screen.getByRole('button', { name: '編集' }));
    const nameInput = screen.getByDisplayValue('prod-hsm');
    await user.clear(nameInput);
    await user.type(nameInput, 'prod-hsm-renamed');
    await user.click(screen.getByRole('button', { name: '保存する' }));

    expect(UpdateCloudHSM).toHaveBeenCalledWith('default', '100000000001', 'prod-hsm-renamed', 'a production hsm', ['env:prod']);
    expect(await screen.findByText('CloudHSM詳細: prod-hsm-renamed')).toBeInTheDocument();
  });

  it('shows clients on the clients tab and creates one', async () => {
    vi.mocked(GetCloudHSMClients)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeClient()]);
    vi.mocked(CreateCloudHSMClient).mockResolvedValueOnce(makeClient());
    const user = userEvent.setup();

    renderDetail();
    await screen.findByText('接続クライアントがありません');

    await user.click(screen.getByRole('button', { name: '+ クライアント作成' }));
    await user.type(screen.getByPlaceholderText('app-client'), 'app-client');
    await user.type(screen.getByPlaceholderText('-----BEGIN CERTIFICATE-----...'), 'cert-data');
    await user.click(screen.getByRole('button', { name: '作成する' }));

    expect(CreateCloudHSMClient).toHaveBeenCalledWith('default', '100000000001', 'app-client', 'cert-data');
    expect(await screen.findByText('app-client')).toBeInTheDocument();
  });

  it('deletes a client after confirmation', async () => {
    vi.mocked(GetCloudHSMClients)
      .mockResolvedValueOnce([makeClient()])
      .mockResolvedValueOnce([]);
    vi.mocked(DeleteCloudHSMClient).mockResolvedValueOnce();
    const user = userEvent.setup();

    renderDetail();
    await screen.findByText('app-client');

    await user.click(screen.getByRole('button', { name: '削除' }));
    await user.click(screen.getByRole('button', { name: '削除する' }));

    expect(DeleteCloudHSMClient).toHaveBeenCalledWith('default', '100000000001', '100000000002');
    expect(await screen.findByText('接続クライアントがありません')).toBeInTheDocument();
  });

  it('shows peers on the peers tab and creates one', async () => {
    vi.mocked(GetCloudHSMPeers)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makePeer()]);
    vi.mocked(CreateCloudHSMPeer).mockResolvedValueOnce();
    const user = userEvent.setup();

    renderDetail();
    await screen.findByText('CloudHSM詳細: prod-hsm');
    await user.click(screen.getByRole('button', { name: 'ピア' }));
    await screen.findByText('ピアがありません');

    await user.click(screen.getByRole('button', { name: '+ ピア作成' }));
    await user.type(screen.getByPlaceholderText('対向ルーターのID'), '112233445566');
    await user.type(screen.getByPlaceholderText('対向ルーターと共有するシークレットキー'), 'supersecretkey');
    await user.click(screen.getByRole('button', { name: '作成する' }));

    expect(CreateCloudHSMPeer).toHaveBeenCalledWith('default', '100000000001', '112233445566', 'supersecretkey');
    expect(await screen.findByText('112233445566')).toBeInTheDocument();
    expect(screen.getByText('UP')).toBeInTheDocument();
  });

  it('deletes a peer after confirmation', async () => {
    vi.mocked(GetCloudHSMPeers)
      .mockResolvedValueOnce([makePeer()])
      .mockResolvedValueOnce([]);
    vi.mocked(DeleteCloudHSMPeer).mockResolvedValueOnce();
    const user = userEvent.setup();

    renderDetail();
    await screen.findByText('CloudHSM詳細: prod-hsm');
    await user.click(screen.getByRole('button', { name: 'ピア' }));
    await screen.findByText('112233445566');

    await user.click(screen.getByRole('button', { name: '削除' }));
    await user.click(screen.getByRole('button', { name: '削除する' }));

    expect(DeleteCloudHSMPeer).toHaveBeenCalledWith('default', '100000000001', '112233445566');
    expect(await screen.findByText('ピアがありません')).toBeInTheDocument();
  });
});
