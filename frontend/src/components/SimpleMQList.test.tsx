import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SimpleMQList } from './SimpleMQList';
import { simplemq } from '../../wailsjs/go/models';
import {
  GetSimpleMQQueues,
  DeleteSimpleMQQueue,
  CreateSimpleMQQueue,
} from '../../wailsjs/go/main/App';

vi.mock('../../wailsjs/go/main/App');

function makeQueue(overrides: Partial<simplemq.QueueInfo> = {}): simplemq.QueueInfo {
  return new simplemq.QueueInfo({
    id: '123456789012',
    name: 'my-queue',
    description: '',
    visibilityTimeoutSeconds: 30,
    expireSeconds: 345600,
    tags: [],
    createdAt: '2026-01-01T00:00:00+09:00',
    modifiedAt: '2026-01-01T00:00:00+09:00',
    ...overrides,
  });
}

describe('SimpleMQList', () => {
  beforeEach(() => {
    vi.mocked(GetSimpleMQQueues).mockReset();
    vi.mocked(DeleteSimpleMQQueue).mockReset();
    vi.mocked(CreateSimpleMQQueue).mockReset();
  });

  it('lists queues returned by GetSimpleMQQueues', async () => {
    vi.mocked(GetSimpleMQQueues).mockResolvedValueOnce([makeQueue()]);

    render(<SimpleMQList profile="default" onSelectQueue={() => {}} />);

    expect(await screen.findByText('my-queue')).toBeInTheDocument();
    expect(GetSimpleMQQueues).toHaveBeenCalledWith('default');
    expect(screen.getByText('可視性タイムアウト: 30秒')).toBeInTheDocument();
  });

  it('shows an empty state when there are no queues', async () => {
    vi.mocked(GetSimpleMQQueues).mockResolvedValueOnce([]);

    render(<SimpleMQList profile="default" onSelectQueue={() => {}} />);

    expect(await screen.findByText('Queueがありません')).toBeInTheDocument();
  });

  it('navigates to detail when a card is clicked', async () => {
    vi.mocked(GetSimpleMQQueues).mockResolvedValueOnce([makeQueue()]);
    const onSelectQueue = vi.fn();
    const user = userEvent.setup();

    render(<SimpleMQList profile="default" onSelectQueue={onSelectQueue} />);
    await screen.findByText('my-queue');

    await user.click(screen.getByText('my-queue'));

    expect(onSelectQueue).toHaveBeenCalledWith('123456789012');
  });

  it('deletes a queue after confirmation without triggering navigation, then reloads the list', async () => {
    vi.mocked(GetSimpleMQQueues)
      .mockResolvedValueOnce([makeQueue()])
      .mockResolvedValueOnce([]);
    vi.mocked(DeleteSimpleMQQueue).mockResolvedValueOnce(undefined);
    const onSelectQueue = vi.fn();
    const user = userEvent.setup();

    render(<SimpleMQList profile="default" onSelectQueue={onSelectQueue} />);
    await screen.findByText('my-queue');

    await user.click(screen.getByRole('button', { name: '削除' }));

    expect(onSelectQueue).not.toHaveBeenCalled();
    expect(await screen.findByText('Queue「my-queue」を削除しますか？')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '削除する' }));

    await waitFor(() => {
      expect(DeleteSimpleMQQueue).toHaveBeenCalledWith('default', '123456789012');
    });
    await waitFor(() => {
      expect(GetSimpleMQQueues).toHaveBeenCalledTimes(2);
    });
  });

  it('creates a queue with the entered fields, then reloads the list', async () => {
    vi.mocked(GetSimpleMQQueues)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeQueue({ name: 'new-queue' })]);
    vi.mocked(CreateSimpleMQQueue).mockResolvedValueOnce(makeQueue({ name: 'new-queue' }));
    const user = userEvent.setup();

    render(<SimpleMQList profile="default" onSelectQueue={() => {}} />);
    await screen.findByText('Queueがありません');

    await user.click(screen.getByRole('button', { name: '+ Queue作成' }));
    await user.type(screen.getByPlaceholderText('my-queue'), 'new-queue');
    await user.type(screen.getByPlaceholderText('任意', { exact: true }), 'a new queue');
    await user.click(screen.getByRole('button', { name: '作成する' }));

    await waitFor(() => {
      expect(CreateSimpleMQQueue).toHaveBeenCalledWith('default', 'new-queue', 'a new queue', []);
    });
    await waitFor(() => {
      expect(GetSimpleMQQueues).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText('new-queue')).toBeInTheDocument();
  });
});
