import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Monitoring } from './Monitoring';
import { sakura } from '../../wailsjs/go/models';
import {
  GetMSLogs,
  GetMSMetrics,
  GetMSTraces,
  CreateMSLogsStorage,
  DeleteMSLogsStorage,
} from '../../wailsjs/go/main/App';

vi.mock('../../wailsjs/go/main/App');

function makeLog(overrides: Partial<sakura.MSLogInfo> = {}): sakura.MSLogInfo {
  return new sakura.MSLogInfo({
    id: 'log-1',
    name: 'my-log-storage',
    description: '',
    routings: [],
    ...overrides,
  });
}

function renderMonitoring() {
  return render(
    <MemoryRouter>
      <Monitoring profile="default" />
    </MemoryRouter>
  );
}

describe('Monitoring', () => {
  beforeEach(() => {
    vi.mocked(GetMSLogs).mockReset();
    vi.mocked(GetMSMetrics).mockReset();
    vi.mocked(GetMSTraces).mockReset();
    vi.mocked(CreateMSLogsStorage).mockReset();
    vi.mocked(DeleteMSLogsStorage).mockReset();

    vi.mocked(GetMSLogs).mockResolvedValue([]);
    vi.mocked(GetMSMetrics).mockResolvedValue([]);
    vi.mocked(GetMSTraces).mockResolvedValue([]);
  });

  it('shows an empty state when there are no log storages', async () => {
    renderMonitoring();

    expect(await screen.findByText('データがありません')).toBeInTheDocument();
  });

  it('creates a new logs storage via the create modal', async () => {
    vi.mocked(CreateMSLogsStorage).mockResolvedValue(makeLog());
    const user = userEvent.setup();

    renderMonitoring();
    await user.click(await screen.findByRole('button', { name: '+ ストレージ作成' }));
    await user.type(screen.getByLabelText('名前', { exact: false }), 'my-log-storage');
    await user.click(screen.getByRole('button', { name: '作成する' }));

    await waitFor(() => {
      expect(CreateMSLogsStorage).toHaveBeenCalledWith('default', 'my-log-storage', '');
    });
    expect(GetMSLogs).toHaveBeenCalledTimes(2);
  });

  it('blocks submission when the name is empty', async () => {
    const user = userEvent.setup();

    renderMonitoring();
    await user.click(await screen.findByRole('button', { name: '+ ストレージ作成' }));
    const nameInput = screen.getByLabelText('名前', { exact: false }) as HTMLInputElement;
    await user.click(screen.getByRole('button', { name: '作成する' }));

    expect(nameInput.validity.valid).toBe(false);
    expect(CreateMSLogsStorage).not.toHaveBeenCalled();
  });

  it('cancels the create modal without calling the API', async () => {
    const user = userEvent.setup();

    renderMonitoring();
    await user.click(await screen.findByRole('button', { name: '+ ストレージ作成' }));
    await user.click(screen.getByRole('button', { name: 'キャンセル' }));

    expect(screen.queryByText('ログストレージ作成')).not.toBeInTheDocument();
    expect(CreateMSLogsStorage).not.toHaveBeenCalled();
  });

  it('deletes a logs storage after confirmation', async () => {
    vi.mocked(GetMSLogs).mockResolvedValue([makeLog()]);
    const user = userEvent.setup();

    renderMonitoring();
    await user.click(await screen.findByRole('button', { name: '削除' }));
    expect(await screen.findByRole('button', { name: '削除する' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '削除する' }));

    await waitFor(() => {
      expect(DeleteMSLogsStorage).toHaveBeenCalledWith('default', 'log-1');
    });
  });

  it('cancels the delete confirmation without calling the API', async () => {
    vi.mocked(GetMSLogs).mockResolvedValue([makeLog()]);
    const user = userEvent.setup();

    renderMonitoring();
    await user.click(await screen.findByRole('button', { name: '削除' }));
    await user.click(screen.getByRole('button', { name: 'キャンセル' }));

    expect(DeleteMSLogsStorage).not.toHaveBeenCalled();
  });
});
