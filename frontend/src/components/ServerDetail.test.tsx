import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ServerDetail } from './ServerDetail';
import { sakura } from '../../wailsjs/go/models';
import {
  GetServerDetail,
  ChangeServerPlan,
  GetCDROMs,
  InsertServerCDROM,
  EjectServerCDROM,
  SendServerKey,
  SendServerNMI,
  GetServerVNCProxy,
} from '../../wailsjs/go/main/App';

vi.mock('../../wailsjs/go/main/App');

function makeServer(overrides: Partial<sakura.ServerInfo> = {}): sakura.ServerInfo {
  return new sakura.ServerInfo({
    id: '123456789012',
    name: 'my-server',
    description: '',
    zone: 'is1a',
    cpu: 1,
    memory: 1,
    status: 'down',
    ipAddresses: ['192.168.0.11'],
    tags: [],
    cdromId: '',
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  });
}

function makeCDROM(overrides: Partial<sakura.CDROMInfo> = {}): sakura.CDROMInfo {
  return new sakura.CDROMInfo({
    id: '777777777777',
    name: 'test-iso',
    description: '',
    sizeGb: 1,
    ...overrides,
  });
}

function renderServerDetail(serverId = '123456789012') {
  return render(
    <MemoryRouter>
      <ServerDetail profile="default" zone="is1a" serverId={serverId} />
    </MemoryRouter>
  );
}

describe('ServerDetail', () => {
  beforeEach(() => {
    vi.mocked(GetServerDetail).mockReset();
    vi.mocked(ChangeServerPlan).mockReset();
    vi.mocked(GetCDROMs).mockReset();
    vi.mocked(InsertServerCDROM).mockReset();
    vi.mocked(EjectServerCDROM).mockReset();
    vi.mocked(SendServerKey).mockReset();
    vi.mocked(SendServerNMI).mockReset();
    vi.mocked(GetServerVNCProxy).mockReset();
  });

  it('shows basic server information', async () => {
    vi.mocked(GetServerDetail).mockResolvedValueOnce(makeServer());

    renderServerDetail();

    expect(await screen.findByText('サーバー詳細: my-server')).toBeInTheDocument();
    expect(screen.getByText('192.168.0.11', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('1 vCPU / 1 GB')).toBeInTheDocument();
    expect(GetServerDetail).toHaveBeenCalledWith('default', 'is1a', '123456789012');
  });

  it('shows (未挿入) when no CD-ROM is attached', async () => {
    vi.mocked(GetServerDetail).mockResolvedValueOnce(makeServer());

    renderServerDetail();

    expect(await screen.findByText('(未挿入)')).toBeInTheDocument();
  });

  it('changes the plan for a stopped server', async () => {
    vi.mocked(GetServerDetail).mockResolvedValueOnce(makeServer({ status: 'down' }));
    vi.mocked(ChangeServerPlan).mockResolvedValueOnce(makeServer({ cpu: 2, memory: 4 }));
    const user = userEvent.setup();

    renderServerDetail();
    await screen.findByText('サーバー詳細: my-server');

    await user.click(screen.getAllByRole('button', { name: '変更' })[0]);
    const [cpuInput, memInput] = screen.getAllByRole('spinbutton');
    await user.clear(cpuInput);
    await user.type(cpuInput, '2');
    await user.clear(memInput);
    await user.type(memInput, '4');
    await user.click(screen.getByRole('button', { name: '保存する' }));

    await waitFor(() => {
      expect(ChangeServerPlan).toHaveBeenCalledWith('default', 'is1a', '123456789012', 2, 4);
    });
  });

  it('disables plan change for a running server', async () => {
    vi.mocked(GetServerDetail).mockResolvedValueOnce(makeServer({ status: 'up' }));

    renderServerDetail();
    await screen.findByText('サーバー詳細: my-server');

    expect(screen.getAllByRole('button', { name: '変更' })[0]).toBeDisabled();
  });

  it('blocks plan submission via native min validation when CPU is below 1', async () => {
    vi.mocked(GetServerDetail).mockResolvedValueOnce(makeServer({ status: 'down' }));
    const user = userEvent.setup();

    renderServerDetail();
    await screen.findByText('サーバー詳細: my-server');

    await user.click(screen.getAllByRole('button', { name: '変更' })[0]);
    const [cpuInput] = screen.getAllByRole('spinbutton') as HTMLInputElement[];
    await user.clear(cpuInput);
    await user.type(cpuInput, '0');
    await user.click(screen.getByRole('button', { name: '保存する' }));

    expect(cpuInput.validity.valid).toBe(false);
    expect(ChangeServerPlan).not.toHaveBeenCalled();
  });

  it('inserts a CD-ROM', async () => {
    vi.mocked(GetServerDetail)
      .mockResolvedValueOnce(makeServer())
      .mockResolvedValueOnce(makeServer({ cdromId: '777777777777' }));
    vi.mocked(GetCDROMs).mockResolvedValueOnce([makeCDROM()]);
    vi.mocked(InsertServerCDROM).mockResolvedValueOnce(undefined);
    const user = userEvent.setup();

    renderServerDetail();
    await screen.findByText('サーバー詳細: my-server');

    await user.click(screen.getAllByRole('button', { name: '変更' })[1]);

    await waitFor(() => {
      expect(GetCDROMs).toHaveBeenCalledWith('default', 'is1a');
    });

    await user.selectOptions(screen.getAllByRole('combobox')[0], '777777777777');
    await user.click(screen.getByRole('button', { name: '挿入する' }));

    await waitFor(() => {
      expect(InsertServerCDROM).toHaveBeenCalledWith('default', 'is1a', '123456789012', '777777777777');
    });
    expect(await screen.findByText('777777777777')).toBeInTheDocument();
  });

  it('blocks CD-ROM insert submission via native required validation when nothing is selected', async () => {
    vi.mocked(GetServerDetail).mockResolvedValueOnce(makeServer());
    vi.mocked(GetCDROMs).mockResolvedValueOnce([makeCDROM()]);
    const user = userEvent.setup();

    renderServerDetail();
    await screen.findByText('サーバー詳細: my-server');

    await user.click(screen.getAllByRole('button', { name: '変更' })[1]);
    await waitFor(() => {
      expect(GetCDROMs).toHaveBeenCalledWith('default', 'is1a');
    });

    const select = screen.getAllByRole('combobox')[0] as HTMLSelectElement;
    await user.click(screen.getByRole('button', { name: '挿入する' }));

    expect(select.validity.valid).toBe(false);
    expect(InsertServerCDROM).not.toHaveBeenCalled();
  });

  it('ejects the currently inserted CD-ROM', async () => {
    vi.mocked(GetServerDetail)
      .mockResolvedValueOnce(makeServer({ cdromId: '777777777777' }))
      .mockResolvedValueOnce(makeServer());
    vi.mocked(GetCDROMs).mockResolvedValueOnce([makeCDROM()]);
    vi.mocked(EjectServerCDROM).mockResolvedValueOnce(undefined);
    const user = userEvent.setup();

    renderServerDetail();
    await screen.findByText('777777777777');

    await user.click(screen.getAllByRole('button', { name: '変更' })[1]);
    await user.click(screen.getByRole('button', { name: '排出する' }));

    await waitFor(() => {
      expect(EjectServerCDROM).toHaveBeenCalledWith('default', 'is1a', '123456789012');
    });
    expect(await screen.findByText('(未挿入)')).toBeInTheDocument();
  });

  it('sends a key to the console', async () => {
    vi.mocked(GetServerDetail).mockResolvedValueOnce(makeServer());
    vi.mocked(SendServerKey).mockResolvedValueOnce(undefined);
    const user = userEvent.setup();

    renderServerDetail();
    await screen.findByText('サーバー詳細: my-server');

    await user.click(screen.getByRole('button', { name: 'キーを送信' }));

    await waitFor(() => {
      expect(SendServerKey).toHaveBeenCalledWith('default', 'is1a', '123456789012', 'CTRL+ALT+DELETE');
    });
    expect(await screen.findByText('「CTRL+ALT+DELETE」を送信しました')).toBeInTheDocument();
  });

  it('requires confirmation before sending NMI', async () => {
    vi.mocked(GetServerDetail).mockResolvedValueOnce(makeServer());
    vi.mocked(SendServerNMI).mockResolvedValueOnce(undefined);
    const user = userEvent.setup();

    renderServerDetail();
    await screen.findByText('サーバー詳細: my-server');

    await user.click(screen.getByRole('button', { name: 'NMIを送信' }));
    expect(SendServerNMI).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'NMIを送信する' }));

    await waitFor(() => {
      expect(SendServerNMI).toHaveBeenCalledWith('default', 'is1a', '123456789012');
    });
  });

  it('fetches and displays VNC connection info', async () => {
    vi.mocked(GetServerDetail).mockResolvedValueOnce(makeServer());
    vi.mocked(GetServerVNCProxy).mockResolvedValueOnce(new sakura.VNCProxyInfo({
      status: 'ready',
      host: 'vnc.example.jp',
      ioServerHost: '',
      port: '5900',
      password: 'secretpass',
    }));
    const user = userEvent.setup();

    renderServerDetail();
    await screen.findByText('サーバー詳細: my-server');

    await user.click(screen.getByRole('button', { name: '接続情報を取得' }));

    expect(await screen.findByText('vnc.example.jp')).toBeInTheDocument();
    expect(screen.getByText('5900')).toBeInTheDocument();
    expect(screen.getByText('secretpass')).toBeInTheDocument();
  });
});
