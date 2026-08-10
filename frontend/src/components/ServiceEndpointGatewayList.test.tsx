import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ServiceEndpointGatewayList } from './ServiceEndpointGatewayList';
import { sakura, serviceendpointgateway } from '../../wailsjs/go/models';
import {
  GetServiceEndpointGateways,
  CreateServiceEndpointGateway,
  DeleteServiceEndpointGateway,
  PowerOnServiceEndpointGateway,
  ShutdownServiceEndpointGateway,
  ResetServiceEndpointGateway,
  GetServiceEndpointGatewayPowerStatus,
  GetSwitches,
} from '../../wailsjs/go/main/App';

vi.mock('../../wailsjs/go/main/App');

const zones: sakura.ZoneInfo[] = [
  new sakura.ZoneInfo({ id: 'is1a', name: '石狩第1ゾーン' }),
];

function makeSwitch(overrides: Partial<sakura.SwitchInfo> = {}): sakura.SwitchInfo {
  return new sakura.SwitchInfo({
    id: 'sw-1',
    name: 'my-switch',
    description: '',
    serverCount: 0,
    networkMaskLen: 0,
    defaultRoute: '',
    scope: 'user',
    ...overrides,
  });
}

function makeAppliance(overrides: Partial<serviceendpointgateway.ApplianceInfo> = {}): serviceendpointgateway.ApplianceInfo {
  return new serviceendpointgateway.ApplianceInfo({
    id: '123456789012',
    availability: 'available',
    powerStatus: 'up',
    generation: 1,
    switchId: 'sw-1',
    switchName: 'my-switch',
    interfaces: [],
    enabledServices: [],
    monitoringSuite: false,
    dnsForwarding: { enabled: false, privateHostedZone: '', upstreamDNS1: '', upstreamDNS2: '' },
    settingsHash: '',
    createdAt: '2026-01-01T00:00:00+09:00',
    ...overrides,
  });
}

describe('ServiceEndpointGatewayList', () => {
  beforeEach(() => {
    vi.mocked(GetServiceEndpointGateways).mockReset();
    vi.mocked(CreateServiceEndpointGateway).mockReset();
    vi.mocked(DeleteServiceEndpointGateway).mockReset();
    vi.mocked(PowerOnServiceEndpointGateway).mockReset();
    vi.mocked(ShutdownServiceEndpointGateway).mockReset();
    vi.mocked(ResetServiceEndpointGateway).mockReset();
    vi.mocked(GetServiceEndpointGatewayPowerStatus).mockReset();
    vi.mocked(GetSwitches).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('lists appliances returned by GetServiceEndpointGateways', async () => {
    vi.mocked(GetServiceEndpointGateways).mockResolvedValueOnce([makeAppliance()]);

    render(<ServiceEndpointGatewayList profile="default" zone="is1a" zones={zones} onZoneChange={() => {}} onSelect={() => {}} />);

    expect(await screen.findByText('123456789012')).toBeInTheDocument();
    expect(screen.getByText('スイッチ: my-switch', { exact: false })).toBeInTheDocument();
    expect(GetServiceEndpointGateways).toHaveBeenCalledWith('default', 'is1a');
  });

  it('shows an empty state when there is no appliance', async () => {
    vi.mocked(GetServiceEndpointGateways).mockResolvedValueOnce([]);

    render(<ServiceEndpointGatewayList profile="default" zone="is1a" zones={zones} onZoneChange={() => {}} onSelect={() => {}} />);

    expect(await screen.findByText('サービスエンドポイントゲートウェイがありません')).toBeInTheDocument();
  });

  it('disables 起動 for a running appliance and 停止/再起動 for a stopped one', async () => {
    vi.mocked(GetServiceEndpointGateways).mockResolvedValueOnce([makeAppliance({ powerStatus: 'up' })]);
    const user = userEvent.setup();

    render(<ServiceEndpointGatewayList profile="default" zone="is1a" zones={zones} onZoneChange={() => {}} onSelect={() => {}} />);
    await screen.findByText('123456789012');

    await user.click(screen.getByRole('button', { name: '⋮' }));

    expect(screen.getByRole('button', { name: '起動' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '停止' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '再起動' })).toBeEnabled();
  });

  it('deletes an appliance after confirmation and reloads the list', async () => {
    vi.mocked(GetServiceEndpointGateways)
      .mockResolvedValueOnce([makeAppliance()])
      .mockResolvedValueOnce([]);
    vi.mocked(DeleteServiceEndpointGateway).mockResolvedValueOnce(undefined);
    const user = userEvent.setup();

    render(<ServiceEndpointGatewayList profile="default" zone="is1a" zones={zones} onZoneChange={() => {}} onSelect={() => {}} />);
    await screen.findByText('123456789012');

    await user.click(screen.getByRole('button', { name: '⋮' }));
    await user.click(screen.getByRole('button', { name: '削除' }));

    expect(await screen.findByRole('heading', { name: '削除' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '削除する' }));

    await waitFor(() => {
      expect(DeleteServiceEndpointGateway).toHaveBeenCalledWith('default', 'is1a', '123456789012');
    });
    await waitFor(() => {
      expect(GetServiceEndpointGateways).toHaveBeenCalledTimes(2);
    });
  });

  it('powers on an appliance and polls until it becomes up', async () => {
    vi.mocked(GetServiceEndpointGateways)
      .mockResolvedValueOnce([makeAppliance({ powerStatus: 'down' })])
      .mockResolvedValueOnce([makeAppliance({ powerStatus: 'up' })]);
    vi.mocked(PowerOnServiceEndpointGateway).mockResolvedValueOnce(undefined);
    vi.mocked(GetServiceEndpointGatewayPowerStatus).mockResolvedValueOnce('up');

    render(<ServiceEndpointGatewayList profile="default" zone="is1a" zones={zones} onZoneChange={() => {}} onSelect={() => {}} />);
    await screen.findByText('123456789012');

    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: '⋮' }));
    fireEvent.click(screen.getByRole('button', { name: '起動' }));
    fireEvent.click(screen.getByRole('button', { name: '起動する' }));

    await vi.waitFor(() => {
      expect(PowerOnServiceEndpointGateway).toHaveBeenCalledWith('default', 'is1a', '123456789012');
    });

    await vi.advanceTimersByTimeAsync(2000);

    expect(GetServiceEndpointGatewayPowerStatus).toHaveBeenCalledWith('default', 'is1a', '123456789012');
    expect(GetServiceEndpointGateways).toHaveBeenCalledTimes(2);
  });

  it('creates an appliance via the create modal and reloads the list', async () => {
    vi.mocked(GetServiceEndpointGateways)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeAppliance()]);
    vi.mocked(GetSwitches).mockResolvedValueOnce([makeSwitch()]);
    vi.mocked(CreateServiceEndpointGateway).mockResolvedValueOnce(makeAppliance());
    const user = userEvent.setup();

    render(<ServiceEndpointGatewayList profile="default" zone="is1a" zones={zones} onZoneChange={() => {}} onSelect={() => {}} />);
    await screen.findByText('サービスエンドポイントゲートウェイがありません');

    await user.click(screen.getByRole('button', { name: '+ 作成' }));
    expect(await screen.findByRole('option', { name: 'my-switch' })).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('接続スイッチ', { exact: false }), 'sw-1');
    await user.click(screen.getByRole('button', { name: '作成する' }));

    await waitFor(() => {
      expect(CreateServiceEndpointGateway).toHaveBeenCalledWith('default', 'is1a', 'sw-1', 24, []);
    });
    await waitFor(() => {
      expect(GetServiceEndpointGateways).toHaveBeenCalledTimes(2);
    });
  });

  it('blocks appliance creation submit when 接続スイッチ is not selected', async () => {
    vi.mocked(GetServiceEndpointGateways).mockResolvedValueOnce([]);
    vi.mocked(GetSwitches).mockResolvedValueOnce([makeSwitch()]);
    const user = userEvent.setup();

    render(<ServiceEndpointGatewayList profile="default" zone="is1a" zones={zones} onZoneChange={() => {}} onSelect={() => {}} />);
    await screen.findByText('サービスエンドポイントゲートウェイがありません');

    await user.click(screen.getByRole('button', { name: '+ 作成' }));
    expect(await screen.findByRole('option', { name: 'my-switch' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '作成する' }));

    const switchSelect = screen.getByLabelText('接続スイッチ', { exact: false }) as HTMLSelectElement;
    expect(switchSelect.validity.valid).toBe(false);
    expect(CreateServiceEndpointGateway).not.toHaveBeenCalled();
  });
});
