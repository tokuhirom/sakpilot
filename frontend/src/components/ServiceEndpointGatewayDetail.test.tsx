import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ServiceEndpointGatewayDetail } from './ServiceEndpointGatewayDetail';
import { serviceendpointgateway } from '../../wailsjs/go/models';
import {
  GetServiceEndpointGateway,
  UpdateServiceEndpointGateway,
  ApplyServiceEndpointGateway,
  PowerOnServiceEndpointGateway,
  ShutdownServiceEndpointGateway,
  ResetServiceEndpointGateway,
} from '../../wailsjs/go/main/App';

vi.mock('../../wailsjs/go/main/App');

function makeAppliance(overrides: Partial<serviceendpointgateway.ApplianceInfo> = {}): serviceendpointgateway.ApplianceInfo {
  return new serviceendpointgateway.ApplianceInfo({
    id: '123456789012',
    availability: 'available',
    powerStatus: 'up',
    generation: 1,
    switchId: 'sw-1',
    switchName: 'my-switch',
    interfaces: [{ ipAddress: '192.168.0.101', userIpAddress: '192.168.0.101' }],
    enabledServices: [],
    monitoringSuite: false,
    dnsForwarding: { enabled: false, privateHostedZone: '', upstreamDNS1: '', upstreamDNS2: '' },
    settingsHash: '',
    createdAt: '2026-01-01T00:00:00+09:00',
    ...overrides,
  });
}

describe('ServiceEndpointGatewayDetail', () => {
  beforeEach(() => {
    vi.mocked(GetServiceEndpointGateway).mockReset();
    vi.mocked(UpdateServiceEndpointGateway).mockReset();
    vi.mocked(ApplyServiceEndpointGateway).mockReset();
    vi.mocked(PowerOnServiceEndpointGateway).mockReset();
    vi.mocked(ShutdownServiceEndpointGateway).mockReset();
    vi.mocked(ResetServiceEndpointGateway).mockReset();
  });

  it('shows appliance detail returned by GetServiceEndpointGateway', async () => {
    vi.mocked(GetServiceEndpointGateway).mockResolvedValueOnce(makeAppliance());

    render(<ServiceEndpointGatewayDetail profile="default" zone="is1a" id="123456789012" />);

    expect(await screen.findByText('サービスエンドポイントゲートウェイ詳細: 123456789012')).toBeInTheDocument();
    expect(screen.getByText('my-switch')).toBeInTheDocument();
    expect(screen.getByText('192.168.0.101')).toBeInTheDocument();
    expect(GetServiceEndpointGateway).toHaveBeenCalledWith('default', 'is1a', '123456789012');
  });

  it('disables 起動 for a running appliance and 停止 for a stopped one', async () => {
    vi.mocked(GetServiceEndpointGateway).mockResolvedValueOnce(makeAppliance({ powerStatus: 'up' }));

    render(<ServiceEndpointGatewayDetail profile="default" zone="is1a" id="123456789012" />);
    await screen.findByText('サービスエンドポイントゲートウェイ詳細: 123456789012');

    expect(screen.getByRole('button', { name: '起動' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '停止' })).toBeEnabled();
  });

  it('adds an enabled service, saves settings, and applies them', async () => {
    vi.mocked(GetServiceEndpointGateway).mockResolvedValueOnce(makeAppliance());
    vi.mocked(UpdateServiceEndpointGateway).mockResolvedValueOnce(makeAppliance({
      enabledServices: [{ type: 'ObjectStorage', endpoints: ['s3.isk01.sakurastorage.jp'], mode: '' }],
    }));
    vi.mocked(ApplyServiceEndpointGateway).mockResolvedValueOnce(undefined);
    const user = userEvent.setup();

    render(<ServiceEndpointGatewayDetail profile="default" zone="is1a" id="123456789012" />);
    await screen.findByText('サービスエンドポイントゲートウェイ詳細: 123456789012');

    await user.click(screen.getByRole('button', { name: '編集' }));
    await user.click(screen.getByRole('button', { name: '+ 接続先サービスを追加' }));
    await user.type(screen.getByPlaceholderText('エンドポイント(カンマ区切り)'), 's3.isk01.sakurastorage.jp');
    await user.click(screen.getByRole('button', { name: '保存して適用する' }));

    await waitFor(() => {
      expect(UpdateServiceEndpointGateway).toHaveBeenCalledWith(
        'default',
        'is1a',
        '123456789012',
        expect.objectContaining({
          enabledServices: [{ type: 'ObjectStorage', endpoints: ['s3.isk01.sakurastorage.jp'], mode: '' }],
        })
      );
    });
    await waitFor(() => {
      expect(ApplyServiceEndpointGateway).toHaveBeenCalledWith('default', 'is1a', '123456789012');
    });
    expect(await screen.findByText('ObjectStorage: s3.isk01.sakurastorage.jp')).toBeInTheDocument();
  });
});
