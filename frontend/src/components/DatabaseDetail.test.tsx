import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DatabaseDetail } from './DatabaseDetail';
import { sakura } from '../../wailsjs/go/models';
import { GetDatabaseDetail, UpdateDatabase, UpdateDatabaseSettings, GetDatabaseParameter, SetDatabaseParameter } from '../../wailsjs/go/main/App';

vi.mock('../../wailsjs/go/main/App');

function makeDatabase(overrides: Partial<sakura.DatabaseInfo> = {}): sakura.DatabaseInfo {
  return new sakura.DatabaseInfo({
    id: '123456789012',
    name: 'my-database',
    description: '',
    zone: 'is1a',
    status: 'up',
    availability: 'available',
    ipAddresses: ['192.168.0.11'],
    tags: [],
    createdAt: '2026-01-01T00:00:00+09:00',
    planId: '10',
    switchId: 'sw-1',
    defaultRoute: '192.168.0.1',
    networkMaskLen: 24,
    rdbmsType: 'MariaDB',
    rdbmsVersion: '10.11',
    rdbmsRevision: '10.11.9',
    defaultUser: 'dbadmin',
    servicePort: 3306,
    replicaUser: '',
    sourceNetwork: [],
    monitoringSuiteEnabled: false,
    ...overrides,
  });
}

function makeParameter(overrides: Partial<sakura.DatabaseParameterInfo> = {}): sakura.DatabaseParameterInfo {
  return new sakura.DatabaseParameterInfo({
    settings: {},
    meta: [
      { type: 'number', name: 'MariaDB/server.cnf/mysqld/max_connections', label: '最大接続数', text: '', example: '100', min: 1, max: 10000, maxLen: 0, reboot: 'false' },
    ],
    ...overrides,
  });
}

describe('DatabaseDetail', () => {
  beforeEach(() => {
    vi.mocked(GetDatabaseDetail).mockReset();
    vi.mocked(UpdateDatabase).mockReset();
    vi.mocked(UpdateDatabaseSettings).mockReset();
    vi.mocked(GetDatabaseParameter).mockReset();
    vi.mocked(SetDatabaseParameter).mockReset();
  });

  it('shows basic info and operational settings', async () => {
    vi.mocked(GetDatabaseDetail).mockResolvedValueOnce(makeDatabase());
    vi.mocked(GetDatabaseParameter).mockResolvedValueOnce(makeParameter());

    render(<DatabaseDetail profile="default" zone="is1a" databaseId="123456789012" />);

    expect(await screen.findByText('データベース詳細: my-database')).toBeInTheDocument();
    expect(screen.getByText('MariaDB 10.11')).toBeInTheDocument();
    expect(screen.getByText('dbadmin')).toBeInTheDocument();
    expect(screen.getByText('3306')).toBeInTheDocument();
    expect(screen.getByText('デフォルト値のまま(未設定)')).toBeInTheDocument();
  });

  it('updates name, description and tags', async () => {
    vi.mocked(GetDatabaseDetail).mockResolvedValueOnce(makeDatabase());
    vi.mocked(GetDatabaseParameter).mockResolvedValueOnce(makeParameter());
    vi.mocked(UpdateDatabase).mockResolvedValueOnce(makeDatabase({ name: 'renamed-db', description: 'updated desc' }));
    const user = userEvent.setup();

    render(<DatabaseDetail profile="default" zone="is1a" databaseId="123456789012" />);
    await screen.findByText('データベース詳細: my-database');

    await user.click(screen.getAllByRole('button', { name: '編集' })[0]);
    const [nameInput, descriptionInput] = screen.getAllByRole('textbox');
    await user.clear(nameInput);
    await user.type(nameInput, 'renamed-db');
    await user.type(descriptionInput, 'updated desc');
    await user.click(screen.getByRole('button', { name: '保存する' }));

    await waitFor(() => {
      expect(UpdateDatabase).toHaveBeenCalledWith('default', 'is1a', '123456789012', 'renamed-db', 'updated desc', []);
    });
    expect(await screen.findByText('データベース詳細: renamed-db')).toBeInTheDocument();
  });

  it('updates operational settings, leaving blank passwords unset', async () => {
    vi.mocked(GetDatabaseDetail).mockResolvedValueOnce(makeDatabase());
    vi.mocked(GetDatabaseParameter).mockResolvedValueOnce(makeParameter());
    vi.mocked(UpdateDatabaseSettings).mockResolvedValueOnce(makeDatabase({ servicePort: 3307, monitoringSuiteEnabled: true }));
    const user = userEvent.setup();

    render(<DatabaseDetail profile="default" zone="is1a" databaseId="123456789012" />);
    await screen.findByText('データベース詳細: my-database');

    await user.click(screen.getAllByRole('button', { name: '編集' })[1]);

    const portInput = screen.getByDisplayValue('3306');
    await user.clear(portInput);
    await user.type(portInput, '3307');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: '保存する' }));

    await waitFor(() => {
      expect(UpdateDatabaseSettings).toHaveBeenCalledWith('default', 'is1a', '123456789012', expect.objectContaining({
        DefaultUser: 'dbadmin',
        UserPassword: '',
        ServicePort: 3307,
        MonitoringSuiteEnabled: true,
      }));
    });
  });

  it('sets and resets a DB parameter', async () => {
    vi.mocked(GetDatabaseDetail).mockResolvedValueOnce(makeDatabase());
    vi.mocked(GetDatabaseParameter)
      .mockResolvedValueOnce(makeParameter())
      .mockResolvedValueOnce(makeParameter({ settings: { 'MariaDB/server.cnf/mysqld/max_connections': 50 } }))
      .mockResolvedValueOnce(makeParameter());
    vi.mocked(SetDatabaseParameter).mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(<DatabaseDetail profile="default" zone="is1a" databaseId="123456789012" />);
    await screen.findByText('データベース詳細: my-database');

    await user.selectOptions(screen.getByRole('combobox'), 'MariaDB/server.cnf/mysqld/max_connections');
    await user.type(screen.getByPlaceholderText('値 *'), '50');
    await user.click(screen.getByRole('button', { name: '設定' }));

    await waitFor(() => {
      expect(SetDatabaseParameter).toHaveBeenCalledWith('default', 'is1a', '123456789012', { 'MariaDB/server.cnf/mysqld/max_connections': 50 });
    });
    expect(await screen.findByText('MariaDB/server.cnf/mysqld/max_connections')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'リセット' }));

    await waitFor(() => {
      expect(SetDatabaseParameter).toHaveBeenCalledWith('default', 'is1a', '123456789012', { 'MariaDB/server.cnf/mysqld/max_connections': null });
    });
    expect(await screen.findByText('デフォルト値のまま(未設定)')).toBeInTheDocument();
  });
});
