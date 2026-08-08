import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EnhancedDBList } from './EnhancedDBList';
import { sakura } from '../../wailsjs/go/models';
import { GetEnhancedDBs, DeleteEnhancedDB, CreateEnhancedDB } from '../../wailsjs/go/main/App';

vi.mock('../../wailsjs/go/main/App');

function makeEnhancedDB(overrides: Partial<sakura.EnhancedDBInfo> = {}): sakura.EnhancedDBInfo {
  return new sakura.EnhancedDBInfo({
    id: '123456789012',
    name: 'my-enhanced-db',
    description: '',
    tags: [],
    databaseName: 'mydb',
    databaseType: 'tidb',
    region: 'is1',
    hostName: 'my-enhanced-db.tidb.db.sakurausercontent.com',
    port: 3306,
    createdAt: '2026-01-01T00:00:00+09:00',
    ...overrides,
  });
}

describe('EnhancedDBList', () => {
  beforeEach(() => {
    vi.mocked(GetEnhancedDBs).mockReset();
    vi.mocked(DeleteEnhancedDB).mockReset();
    vi.mocked(CreateEnhancedDB).mockReset();
  });

  it('lists enhanced databases returned by GetEnhancedDBs', async () => {
    vi.mocked(GetEnhancedDBs).mockResolvedValueOnce([makeEnhancedDB()]);

    render(<EnhancedDBList profile="default" onSelectDB={vi.fn()} />);

    expect(await screen.findByText('my-enhanced-db')).toBeInTheDocument();
    expect(GetEnhancedDBs).toHaveBeenCalledWith('default');
  });

  it('shows an empty state when there are no enhanced databases', async () => {
    vi.mocked(GetEnhancedDBs).mockResolvedValueOnce([]);

    render(<EnhancedDBList profile="default" onSelectDB={vi.fn()} />);

    expect(await screen.findByText('エンハンスドDBがありません')).toBeInTheDocument();
  });

  it('navigates to detail when a card is clicked', async () => {
    vi.mocked(GetEnhancedDBs).mockResolvedValueOnce([makeEnhancedDB()]);
    const onSelectDB = vi.fn();
    const user = userEvent.setup();

    render(<EnhancedDBList profile="default" onSelectDB={onSelectDB} />);
    await screen.findByText('my-enhanced-db');

    await user.click(screen.getByText('my-enhanced-db'));

    expect(onSelectDB).toHaveBeenCalledWith('123456789012');
  });

  it('deletes an enhanced database after confirmation without triggering navigation, then reloads the list', async () => {
    vi.mocked(GetEnhancedDBs)
      .mockResolvedValueOnce([makeEnhancedDB()])
      .mockResolvedValueOnce([]);
    vi.mocked(DeleteEnhancedDB).mockResolvedValueOnce(undefined);
    const onSelectDB = vi.fn();
    const user = userEvent.setup();

    render(<EnhancedDBList profile="default" onSelectDB={onSelectDB} />);
    await screen.findByText('my-enhanced-db');

    await user.click(screen.getByRole('button', { name: '削除' }));

    expect(onSelectDB).not.toHaveBeenCalled();
    expect(await screen.findByText('エンハンスドDB「my-enhanced-db」を削除しますか？')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '削除する' }));

    await waitFor(() => {
      expect(DeleteEnhancedDB).toHaveBeenCalledWith('default', '123456789012');
    });
    await waitFor(() => {
      expect(GetEnhancedDBs).toHaveBeenCalledTimes(2);
    });
  });

  it('creates an enhanced database with the entered fields, then reloads the list', async () => {
    vi.mocked(GetEnhancedDBs)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeEnhancedDB({ name: 'new-db' })]);
    vi.mocked(CreateEnhancedDB).mockResolvedValueOnce(makeEnhancedDB({ name: 'new-db' }));
    const user = userEvent.setup();

    render(<EnhancedDBList profile="default" onSelectDB={vi.fn()} />);
    await screen.findByText('エンハンスドDBがありません');

    await user.click(screen.getByRole('button', { name: '+ 作成' }));
    await user.type(screen.getByPlaceholderText('my-enhanced-db'), 'new-db');
    await user.type(screen.getByPlaceholderText('mydb'), 'newdb');
    await user.selectOptions(screen.getByLabelText('DB種別'), 'mariadb');
    await user.selectOptions(screen.getByLabelText('リージョン'), 'tk1');
    await user.click(screen.getByRole('button', { name: '作成する' }));

    await waitFor(() => {
      expect(CreateEnhancedDB).toHaveBeenCalledWith('default', 'new-db', '', [], 'newdb', 'mariadb', 'tk1');
    });
    await waitFor(() => {
      expect(GetEnhancedDBs).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText('new-db')).toBeInTheDocument();
  });

  it('requires name and database name before allowing create', async () => {
    vi.mocked(GetEnhancedDBs).mockResolvedValueOnce([]);
    const user = userEvent.setup();

    render(<EnhancedDBList profile="default" onSelectDB={vi.fn()} />);
    await screen.findByText('エンハンスドDBがありません');

    await user.click(screen.getByRole('button', { name: '+ 作成' }));

    expect(screen.getByRole('button', { name: '作成する' })).toBeDisabled();

    await user.type(screen.getByPlaceholderText('my-enhanced-db'), 'new-db');
    expect(screen.getByRole('button', { name: '作成する' })).toBeDisabled();

    await user.type(screen.getByPlaceholderText('mydb'), 'newdb');
    expect(screen.getByRole('button', { name: '作成する' })).not.toBeDisabled();
    expect(CreateEnhancedDB).not.toHaveBeenCalled();
  });
});
