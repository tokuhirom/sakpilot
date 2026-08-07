import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EnhancedDBList } from './EnhancedDBList';
import { sakura } from '../../wailsjs/go/models';
import { GetEnhancedDBs, DeleteEnhancedDB } from '../../wailsjs/go/main/App';

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
  });

  it('lists enhanced databases returned by GetEnhancedDBs', async () => {
    vi.mocked(GetEnhancedDBs).mockResolvedValueOnce([makeEnhancedDB()]);

    render(<EnhancedDBList profile="default" />);

    expect(await screen.findByText('my-enhanced-db')).toBeInTheDocument();
    expect(GetEnhancedDBs).toHaveBeenCalledWith('default');
  });

  it('shows an empty state when there are no enhanced databases', async () => {
    vi.mocked(GetEnhancedDBs).mockResolvedValueOnce([]);

    render(<EnhancedDBList profile="default" />);

    expect(await screen.findByText('エンハンスドDBがありません')).toBeInTheDocument();
  });

  it('deletes an enhanced database after confirmation and reloads the list', async () => {
    vi.mocked(GetEnhancedDBs)
      .mockResolvedValueOnce([makeEnhancedDB()])
      .mockResolvedValueOnce([]);
    vi.mocked(DeleteEnhancedDB).mockResolvedValueOnce(undefined);
    const user = userEvent.setup();

    render(<EnhancedDBList profile="default" />);
    await screen.findByText('my-enhanced-db');

    await user.click(screen.getByRole('button', { name: '削除' }));

    expect(await screen.findByText('エンハンスドDB「my-enhanced-db」を削除しますか？')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '削除する' }));

    await waitFor(() => {
      expect(DeleteEnhancedDB).toHaveBeenCalledWith('default', '123456789012');
    });
    await waitFor(() => {
      expect(GetEnhancedDBs).toHaveBeenCalledTimes(2);
    });
  });
});
