import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProxyLBList } from './ProxyLBList';
import { sakura } from '../../wailsjs/go/models';
import {
  GetProxyLBs,
  GetProxyLBDetail,
  GetProxyLBHealth,
  DeleteProxyLB,
  GetProxyLBCertificates,
  SetProxyLBCertificates,
  DeleteProxyLBCertificates,
  RenewProxyLBLetsEncryptCert,
} from '../../wailsjs/go/main/App';

vi.mock('../../wailsjs/go/main/App');

function makeProxyLB(overrides: Partial<sakura.ProxyLBInfo> = {}): sakura.ProxyLBInfo {
  return new sakura.ProxyLBInfo({
    id: '123456789012',
    name: 'my-elb',
    description: '',
    tags: [],
    plan: '100',
    region: 'is1',
    fqdn: 'my-elb.proxylb.sakura.ne.jp',
    virtualIPAddress: '203.0.113.1',
    proxyNetworks: [],
    useVIPFailover: false,
    bindPorts: [],
    servers: [],
    createdAt: '2026-01-01T00:00:00+09:00',
    modifiedAt: '2026-01-01T00:00:00+09:00',
    ...overrides,
  });
}

function makeHealth(overrides: Partial<sakura.ProxyLBHealthInfo> = {}): sakura.ProxyLBHealthInfo {
  return new sakura.ProxyLBHealthInfo({
    activeConn: 0,
    cps: 0,
    currentVip: '203.0.113.1',
    servers: [],
    ...overrides,
  });
}

function makeCertInfo(overrides: Partial<sakura.ProxyLBCertInfo> = {}): sakura.ProxyLBCertInfo {
  return new sakura.ProxyLBCertInfo({
    serverCertificate: '-----BEGIN CERTIFICATE-----\nMIIB...\n-----END CERTIFICATE-----',
    intermediateCertificate: '',
    certificateEndDate: '2027-01-01T00:00:00Z',
    certificateCommonName: 'my-elb.example.com',
    certificateAltNames: '',
    ...overrides,
  });
}

function makeCertificates(overrides: Partial<sakura.ProxyLBCertificatesInfo> = {}): sakura.ProxyLBCertificatesInfo {
  return new sakura.ProxyLBCertificatesInfo({
    primaryCert: makeCertInfo(),
    additionalCerts: [],
    ...overrides,
  });
}

describe('ProxyLBList', () => {
  beforeEach(() => {
    vi.mocked(GetProxyLBs).mockReset();
    vi.mocked(GetProxyLBDetail).mockReset();
    vi.mocked(GetProxyLBHealth).mockReset();
    vi.mocked(DeleteProxyLB).mockReset();
    vi.mocked(GetProxyLBCertificates).mockReset();
    vi.mocked(SetProxyLBCertificates).mockReset();
    vi.mocked(DeleteProxyLBCertificates).mockReset();
    vi.mocked(RenewProxyLBLetsEncryptCert).mockReset();
    vi.mocked(GetProxyLBCertificates).mockResolvedValue(null as unknown as sakura.ProxyLBCertificatesInfo);
  });

  it('lists ELBs returned by GetProxyLBs', async () => {
    vi.mocked(GetProxyLBs).mockResolvedValueOnce([makeProxyLB()]);

    render(<ProxyLBList profile="default" />);

    expect(await screen.findByText('my-elb')).toBeInTheDocument();
    expect(GetProxyLBs).toHaveBeenCalledWith('default');
  });

  it('shows an empty state when there are no ELBs', async () => {
    vi.mocked(GetProxyLBs).mockResolvedValueOnce([]);

    render(<ProxyLBList profile="default" />);

    expect(await screen.findByText('エンハンスドロードバランサがありません')).toBeInTheDocument();
  });

  it('navigates to detail view and loads detail/health', async () => {
    vi.mocked(GetProxyLBs).mockResolvedValueOnce([makeProxyLB()]);
    vi.mocked(GetProxyLBDetail).mockResolvedValueOnce(makeProxyLB());
    vi.mocked(GetProxyLBHealth).mockResolvedValueOnce(makeHealth());
    const user = userEvent.setup();

    render(<ProxyLBList profile="default" />);
    await screen.findByText('my-elb');

    await user.click(screen.getByText('my-elb'));

    expect(GetProxyLBDetail).toHaveBeenCalledWith('default', '123456789012');
    expect(GetProxyLBHealth).toHaveBeenCalledWith('default', '123456789012');
    expect(await screen.findByRole('button', { name: '削除' })).toBeInTheDocument();
  });

  it('deletes the ELB after confirmation and returns to the list', async () => {
    vi.mocked(GetProxyLBs)
      .mockResolvedValueOnce([makeProxyLB()])
      .mockResolvedValueOnce([]);
    vi.mocked(GetProxyLBDetail).mockResolvedValueOnce(makeProxyLB());
    vi.mocked(GetProxyLBHealth).mockResolvedValueOnce(makeHealth());
    vi.mocked(DeleteProxyLB).mockResolvedValueOnce(undefined);
    const user = userEvent.setup();

    render(<ProxyLBList profile="default" />);
    await screen.findByText('my-elb');
    await user.click(screen.getByText('my-elb'));

    await user.click(await screen.findByRole('button', { name: '削除' }));

    expect(await screen.findByText('ELB「my-elb」を削除しますか？')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '削除する' }));

    await waitFor(() => {
      expect(DeleteProxyLB).toHaveBeenCalledWith('default', '123456789012');
    });
    expect(await screen.findByText('エンハンスドロードバランサがありません')).toBeInTheDocument();
  });

  it('shows certificate info when a primary certificate is set', async () => {
    vi.mocked(GetProxyLBs).mockResolvedValueOnce([makeProxyLB()]);
    vi.mocked(GetProxyLBDetail).mockResolvedValueOnce(makeProxyLB());
    vi.mocked(GetProxyLBHealth).mockResolvedValueOnce(makeHealth());
    vi.mocked(GetProxyLBCertificates).mockResolvedValueOnce(makeCertificates());
    const user = userEvent.setup();

    render(<ProxyLBList profile="default" />);
    await screen.findByText('my-elb');
    await user.click(screen.getByText('my-elb'));

    expect(GetProxyLBCertificates).toHaveBeenCalledWith('default', '123456789012');
    expect(await screen.findByText('my-elb.example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '証明書を更新' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: "Let's Encryptで更新" })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '証明書を削除' })).toBeInTheDocument();
  });

  it('shows empty state and a setup button when no certificate is set', async () => {
    vi.mocked(GetProxyLBs).mockResolvedValueOnce([makeProxyLB()]);
    vi.mocked(GetProxyLBDetail).mockResolvedValueOnce(makeProxyLB());
    vi.mocked(GetProxyLBHealth).mockResolvedValueOnce(makeHealth());
    vi.mocked(GetProxyLBCertificates).mockResolvedValueOnce(null as unknown as sakura.ProxyLBCertificatesInfo);
    const user = userEvent.setup();

    render(<ProxyLBList profile="default" />);
    await screen.findByText('my-elb');
    await user.click(screen.getByText('my-elb'));

    expect(await screen.findByText('証明書が設定されていません')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '証明書を設定' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '証明書を削除' })).not.toBeInTheDocument();
  });

  it('saves a new certificate via the certificate form', async () => {
    vi.mocked(GetProxyLBs).mockResolvedValueOnce([makeProxyLB()]);
    vi.mocked(GetProxyLBDetail).mockResolvedValueOnce(makeProxyLB());
    vi.mocked(GetProxyLBHealth).mockResolvedValueOnce(makeHealth());
    vi.mocked(GetProxyLBCertificates).mockResolvedValueOnce(null as unknown as sakura.ProxyLBCertificatesInfo);
    vi.mocked(SetProxyLBCertificates).mockResolvedValueOnce(makeCertificates());
    const user = userEvent.setup();

    render(<ProxyLBList profile="default" />);
    await screen.findByText('my-elb');
    await user.click(screen.getByText('my-elb'));
    await screen.findByText('証明書が設定されていません');

    await user.click(screen.getByRole('button', { name: '証明書を設定' }));

    await user.type(screen.getByLabelText('プライマリ証明書 サーバー証明書 (PEM)'), 'CERT');
    await user.type(screen.getByLabelText('プライマリ証明書 中間証明書 (PEM)'), 'CHAIN');
    await user.type(screen.getByLabelText('プライマリ証明書 秘密鍵 (PEM)'), 'KEY');

    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(SetProxyLBCertificates).toHaveBeenCalledWith('default', '123456789012', {
        primaryCert: {
          serverCertificate: 'CERT',
          intermediateCertificate: 'CHAIN',
          privateKey: 'KEY',
        },
        additionalCerts: [],
      });
    });
    expect(await screen.findByText('my-elb.example.com')).toBeInTheDocument();
  });

  it('deletes the certificate after confirmation', async () => {
    vi.mocked(GetProxyLBs).mockResolvedValueOnce([makeProxyLB()]);
    vi.mocked(GetProxyLBDetail).mockResolvedValueOnce(makeProxyLB());
    vi.mocked(GetProxyLBHealth).mockResolvedValueOnce(makeHealth());
    vi.mocked(GetProxyLBCertificates).mockResolvedValueOnce(makeCertificates());
    vi.mocked(DeleteProxyLBCertificates).mockResolvedValueOnce(undefined);
    const user = userEvent.setup();

    render(<ProxyLBList profile="default" />);
    await screen.findByText('my-elb');
    await user.click(screen.getByText('my-elb'));
    await screen.findByText('my-elb.example.com');

    await user.click(screen.getByRole('button', { name: '証明書を削除' }));
    expect(await screen.findByText('SSL証明書を削除しますか？')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '削除する' }));

    await waitFor(() => {
      expect(DeleteProxyLBCertificates).toHaveBeenCalledWith('default', '123456789012');
    });
    expect(await screen.findByText('証明書が設定されていません')).toBeInTheDocument();
  });

  it('renews the Let\'s Encrypt certificate after confirmation', async () => {
    vi.mocked(GetProxyLBs).mockResolvedValueOnce([makeProxyLB()]);
    vi.mocked(GetProxyLBDetail).mockResolvedValueOnce(makeProxyLB());
    vi.mocked(GetProxyLBHealth).mockResolvedValueOnce(makeHealth());
    vi.mocked(GetProxyLBCertificates)
      .mockResolvedValueOnce(makeCertificates())
      .mockResolvedValueOnce(makeCertificates({ primaryCert: makeCertInfo({ certificateEndDate: '2027-06-01T00:00:00Z' }) }));
    vi.mocked(RenewProxyLBLetsEncryptCert).mockResolvedValueOnce(undefined);
    const user = userEvent.setup();

    render(<ProxyLBList profile="default" />);
    await screen.findByText('my-elb');
    await user.click(screen.getByText('my-elb'));
    await screen.findByText('my-elb.example.com');

    await user.click(screen.getByRole('button', { name: "Let's Encryptで更新" }));
    expect(await screen.findByText("Let's Encrypt証明書を更新しますか？")).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '更新する' }));

    await waitFor(() => {
      expect(RenewProxyLBLetsEncryptCert).toHaveBeenCalledWith('default', '123456789012');
    });
    await waitFor(() => {
      expect(GetProxyLBCertificates).toHaveBeenCalledTimes(2);
    });
  });
});
