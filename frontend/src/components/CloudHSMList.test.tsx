import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CloudHSMList } from './CloudHSMList';
import { cloudhsm } from '../../wailsjs/go/models';
import {
  GetCloudHSMs,
  CreateCloudHSM,
  DeleteCloudHSM,
  GetCloudHSMLicenses,
  CreateCloudHSMLicense,
  DeleteCloudHSMLicense,
} from '../../wailsjs/go/main/App';

vi.mock('../../wailsjs/go/main/App');

function renderList(onSelectCloudHSM = vi.fn()) {
  return render(<CloudHSMList profile="default" onSelectCloudHSM={onSelectCloudHSM} />);
}

function makeHSM(overrides: Partial<cloudhsm.CloudHSMInfo> = {}): cloudhsm.CloudHSMInfo {
  return new cloudhsm.CloudHSMInfo({
    id: '100000000001',
    name: 'prod-hsm',
    description: '',
    availability: 'available',
    tags: [],
    ipv4NetworkAddress: '192.168.100.0',
    ipv4PrefixLength: 24,
    ipv4Address: '192.168.100.1',
    createdAt: '2026-01-01T00:00:00+09:00',
    modifiedAt: '2026-01-01T00:00:00+09:00',
    ...overrides,
  });
}

function makeLicense(overrides: Partial<cloudhsm.LicenseInfo> = {}): cloudhsm.LicenseInfo {
  return new cloudhsm.LicenseInfo({
    id: '200000000001',
    name: 'prod-license',
    description: '',
    tags: [],
    createdAt: '2026-01-01T00:00:00+09:00',
    modifiedAt: '2026-01-01T00:00:00+09:00',
    ...overrides,
  });
}

describe('CloudHSMList', () => {
  beforeEach(() => {
    vi.mocked(GetCloudHSMs).mockReset();
    vi.mocked(CreateCloudHSM).mockReset();
    vi.mocked(DeleteCloudHSM).mockReset();
    vi.mocked(GetCloudHSMLicenses).mockReset();
    vi.mocked(CreateCloudHSMLicense).mockReset();
    vi.mocked(DeleteCloudHSMLicense).mockReset();

    vi.mocked(GetCloudHSMLicenses).mockResolvedValue([]);
  });

  it('shows HSMs on load', async () => {
    vi.mocked(GetCloudHSMs).mockResolvedValue([makeHSM()]);

    renderList();

    expect(await screen.findByText('prod-hsm')).toBeInTheDocument();
    expect(GetCloudHSMs).toHaveBeenCalledWith('default');
    expect(screen.getByText('available')).toBeInTheDocument();
  });

  it('shows an empty state when there are no HSMs', async () => {
    vi.mocked(GetCloudHSMs).mockResolvedValue([]);

    renderList();

    expect(await screen.findByText('CloudHSMがありません')).toBeInTheDocument();
  });

  it('creates a CloudHSM from the create dialog', async () => {
    vi.mocked(GetCloudHSMs)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeHSM()]);
    vi.mocked(CreateCloudHSM).mockResolvedValueOnce(makeHSM());
    const user = userEvent.setup();

    renderList();
    await screen.findByText('CloudHSMがありません');

    await user.click(screen.getByRole('button', { name: '+ HSM作成' }));
    await user.type(screen.getByPlaceholderText('my-hsm'), 'prod-hsm');
    await user.click(screen.getByRole('button', { name: '作成する' }));

    expect(CreateCloudHSM).toHaveBeenCalledWith('default', 'prod-hsm', '', [], '192.168.100.0', 24);
    expect(await screen.findByText('prod-hsm')).toBeInTheDocument();
  });

  it('navigates to the detail page when an HSM card is clicked', async () => {
    vi.mocked(GetCloudHSMs).mockResolvedValue([makeHSM()]);
    const onSelectCloudHSM = vi.fn();
    const user = userEvent.setup();

    renderList(onSelectCloudHSM);
    await user.click(await screen.findByText('prod-hsm'));

    expect(onSelectCloudHSM).toHaveBeenCalledWith('100000000001');
  });

  it('deletes an HSM after confirmation', async () => {
    vi.mocked(GetCloudHSMs)
      .mockResolvedValueOnce([makeHSM()])
      .mockResolvedValueOnce([]);
    vi.mocked(DeleteCloudHSM).mockResolvedValueOnce();
    const user = userEvent.setup();

    renderList();
    await screen.findByText('prod-hsm');

    await user.click(screen.getByRole('button', { name: '削除' }));
    await user.click(screen.getByRole('button', { name: '削除する' }));

    expect(DeleteCloudHSM).toHaveBeenCalledWith('default', '100000000001');
    expect(await screen.findByText('CloudHSMがありません')).toBeInTheDocument();
  });

  it('switches to the license tab and shows licenses', async () => {
    vi.mocked(GetCloudHSMs).mockResolvedValue([]);
    vi.mocked(GetCloudHSMLicenses).mockResolvedValue([makeLicense()]);
    const user = userEvent.setup();

    renderList();
    await screen.findByText('CloudHSMがありません');

    await user.click(screen.getByRole('button', { name: 'ソフトウェアライセンス' }));

    expect(await screen.findByText('prod-license')).toBeInTheDocument();
  });

  it('creates a license from the create dialog', async () => {
    vi.mocked(GetCloudHSMs).mockResolvedValue([]);
    vi.mocked(GetCloudHSMLicenses)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeLicense()]);
    vi.mocked(CreateCloudHSMLicense).mockResolvedValueOnce(makeLicense());
    const user = userEvent.setup();

    renderList();
    await screen.findByText('CloudHSMがありません');
    await user.click(screen.getByRole('button', { name: 'ソフトウェアライセンス' }));
    await screen.findByText('ソフトウェアライセンスがありません');

    await user.click(screen.getByRole('button', { name: '+ ライセンス作成' }));
    await user.type(screen.getByPlaceholderText('my-license'), 'prod-license');
    await user.click(screen.getByRole('button', { name: '作成する' }));

    expect(CreateCloudHSMLicense).toHaveBeenCalledWith('default', 'prod-license', '', []);
    expect(await screen.findByText('prod-license')).toBeInTheDocument();
  });

  it('deletes a license after confirmation', async () => {
    vi.mocked(GetCloudHSMs).mockResolvedValue([]);
    vi.mocked(GetCloudHSMLicenses)
      .mockResolvedValueOnce([makeLicense()])
      .mockResolvedValueOnce([]);
    vi.mocked(DeleteCloudHSMLicense).mockResolvedValueOnce();
    const user = userEvent.setup();

    renderList();
    await screen.findByText('CloudHSMがありません');
    await user.click(screen.getByRole('button', { name: 'ソフトウェアライセンス' }));
    await screen.findByText('prod-license');

    await user.click(screen.getByRole('button', { name: '削除' }));
    await user.click(screen.getByRole('button', { name: '削除する' }));

    expect(DeleteCloudHSMLicense).toHaveBeenCalledWith('default', '200000000001');
    expect(await screen.findByText('ソフトウェアライセンスがありません')).toBeInTheDocument();
  });
});
