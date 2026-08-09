import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EnhancedDBDetail } from './EnhancedDBDetail';
import { sakura } from '../../wailsjs/go/models';
import { GetEnhancedDB, UpdateEnhancedDB, SetEnhancedDBPassword } from '../../wailsjs/go/main/App';

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

describe('EnhancedDBDetail', () => {
  beforeEach(() => {
    vi.mocked(GetEnhancedDB).mockReset();
    vi.mocked(UpdateEnhancedDB).mockReset();
    vi.mocked(SetEnhancedDBPassword).mockReset();
  });

  it('shows basic info', async () => {
    vi.mocked(GetEnhancedDB).mockResolvedValueOnce(makeEnhancedDB());

    render(<EnhancedDBDetail profile="default" enhancedDBId="123456789012" />);

    expect(await screen.findByText('エンハンスドDB詳細: my-enhanced-db')).toBeInTheDocument();
    expect(GetEnhancedDB).toHaveBeenCalledWith('default', '123456789012');
    expect(screen.getByText('TiDB')).toBeInTheDocument();
    expect(screen.getByText('mydb')).toBeInTheDocument();
    expect(screen.getByText('石狩')).toBeInTheDocument();
  });

  it('edits name, description and tags', async () => {
    vi.mocked(GetEnhancedDB).mockResolvedValueOnce(makeEnhancedDB({ description: 'old desc', tags: ['old-tag'] }));
    vi.mocked(UpdateEnhancedDB).mockResolvedValueOnce(
      makeEnhancedDB({ name: 'renamed-db', description: 'new desc', tags: ['new-tag'] })
    );
    const user = userEvent.setup();

    render(<EnhancedDBDetail profile="default" enhancedDBId="123456789012" />);
    await screen.findByText('エンハンスドDB詳細: my-enhanced-db');

    await user.click(screen.getByRole('button', { name: '編集' }));

    const nameInput = screen.getByDisplayValue('my-enhanced-db');
    await user.clear(nameInput);
    await user.type(nameInput, 'renamed-db');

    const descriptionInput = screen.getByDisplayValue('old desc');
    await user.clear(descriptionInput);
    await user.type(descriptionInput, 'new desc');

    const tagsInput = screen.getByDisplayValue('old-tag');
    await user.clear(tagsInput);
    await user.type(tagsInput, 'new-tag');

    await user.click(screen.getByRole('button', { name: '保存する' }));

    await waitFor(() => {
      expect(UpdateEnhancedDB).toHaveBeenCalledWith('default', '123456789012', 'renamed-db', 'new desc', ['new-tag']);
    });
    expect(await screen.findByText('エンハンスドDB詳細: renamed-db')).toBeInTheDocument();
  });

  it('shows an error and stays in edit mode when update fails', async () => {
    vi.mocked(GetEnhancedDB).mockResolvedValueOnce(makeEnhancedDB());
    vi.mocked(UpdateEnhancedDB).mockRejectedValueOnce(new Error('name is required'));
    const user = userEvent.setup();

    render(<EnhancedDBDetail profile="default" enhancedDBId="123456789012" />);
    await screen.findByText('エンハンスドDB詳細: my-enhanced-db');

    await user.click(screen.getByRole('button', { name: '編集' }));
    await user.click(screen.getByRole('button', { name: '保存する' }));

    expect(await screen.findByText(/エラー: Error: name is required/)).toBeInTheDocument();
  });

  it('sets a new password after confirmation', async () => {
    vi.mocked(GetEnhancedDB).mockResolvedValueOnce(makeEnhancedDB());
    vi.mocked(SetEnhancedDBPassword).mockResolvedValueOnce(undefined);
    const user = userEvent.setup();

    render(<EnhancedDBDetail profile="default" enhancedDBId="123456789012" />);
    await screen.findByText('エンハンスドDB詳細: my-enhanced-db');

    await user.type(screen.getByPlaceholderText('管理ユーザーの新しいパスワード'), 'NewPassword01');
    await user.click(screen.getByRole('button', { name: 'パスワードを再設定' }));

    expect(await screen.findByText('エンハンスドDB「my-enhanced-db」のパスワードを再設定しますか？')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '実行する' }));

    await waitFor(() => {
      expect(SetEnhancedDBPassword).toHaveBeenCalledWith('default', '123456789012', 'NewPassword01');
    });
  });

  it('blocks the password submit when the field is empty', async () => {
    vi.mocked(GetEnhancedDB).mockResolvedValueOnce(makeEnhancedDB());
    const user = userEvent.setup();

    render(<EnhancedDBDetail profile="default" enhancedDBId="123456789012" />);
    await screen.findByText('エンハンスドDB詳細: my-enhanced-db');

    const passwordInput = screen.getByPlaceholderText('管理ユーザーの新しいパスワード') as HTMLInputElement;
    await user.click(screen.getByRole('button', { name: 'パスワードを再設定' }));

    expect(passwordInput.validity.valid).toBe(false);
    expect(SetEnhancedDBPassword).not.toHaveBeenCalled();
    expect(screen.queryByText(/のパスワードを再設定しますか/)).not.toBeInTheDocument();
  });

  it('shows an error when setting the password fails', async () => {
    vi.mocked(GetEnhancedDB).mockResolvedValueOnce(makeEnhancedDB());
    vi.mocked(SetEnhancedDBPassword).mockRejectedValueOnce(new Error('password too weak'));
    const user = userEvent.setup();

    render(<EnhancedDBDetail profile="default" enhancedDBId="123456789012" />);
    await screen.findByText('エンハンスドDB詳細: my-enhanced-db');

    await user.type(screen.getByPlaceholderText('管理ユーザーの新しいパスワード'), 'weak');
    await user.click(screen.getByRole('button', { name: 'パスワードを再設定' }));
    await user.click(screen.getByRole('button', { name: '実行する' }));

    expect(await screen.findByText(/エラー: Error: password too weak/)).toBeInTheDocument();
  });
});
