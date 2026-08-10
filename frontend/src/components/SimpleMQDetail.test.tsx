import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SimpleMQDetail } from './SimpleMQDetail';
import { simplemq } from '../../wailsjs/go/models';
import {
  GetSimpleMQQueue,
  ConfigSimpleMQQueue,
  GetSimpleMQMessageCount,
  RotateSimpleMQQueueAPIKey,
  ClearSimpleMQMessages,
  SendSimpleMQMessage,
  ReceiveSimpleMQMessages,
  ExtendSimpleMQMessageTimeout,
  DeleteSimpleMQMessage,
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

function makeMessage(overrides: Partial<simplemq.MessageInfo> = {}): simplemq.MessageInfo {
  return new simplemq.MessageInfo({
    id: '019feaa1-f5ef-78e4-a99d-7c135f450758',
    content: 'hello world',
    createdAt: 1767225600000,
    updatedAt: 1767225600000,
    expiresAt: 1767312000000,
    acquiredAt: 1767225600000,
    visibilityTimeoutAt: 1767225630000,
    ...overrides,
  });
}

describe('SimpleMQDetail', () => {
  beforeEach(() => {
    vi.mocked(GetSimpleMQQueue).mockReset();
    vi.mocked(ConfigSimpleMQQueue).mockReset();
    vi.mocked(GetSimpleMQMessageCount).mockReset();
    vi.mocked(RotateSimpleMQQueueAPIKey).mockReset();
    vi.mocked(ClearSimpleMQMessages).mockReset();
    vi.mocked(SendSimpleMQMessage).mockReset();
    vi.mocked(ReceiveSimpleMQMessages).mockReset();
    vi.mocked(ExtendSimpleMQMessageTimeout).mockReset();
    vi.mocked(DeleteSimpleMQMessage).mockReset();
  });

  it('shows queue basic info and message count', async () => {
    vi.mocked(GetSimpleMQQueue).mockResolvedValueOnce(makeQueue());
    vi.mocked(GetSimpleMQMessageCount).mockResolvedValueOnce(3);

    render(<SimpleMQDetail profile="default" queueId="123456789012" />);

    expect(await screen.findByText('Queue詳細: my-queue')).toBeInTheDocument();
    expect(GetSimpleMQQueue).toHaveBeenCalledWith('default', '123456789012');
    expect(GetSimpleMQMessageCount).toHaveBeenCalledWith('default', '123456789012');
    expect(await screen.findByText('3 件')).toBeInTheDocument();
    expect(screen.getByText('APIキーを発行または入力すると、メッセージの送受信ができます')).toBeInTheDocument();
  });

  it('edits description, visibility timeout, expire seconds and tags', async () => {
    vi.mocked(GetSimpleMQQueue).mockResolvedValueOnce(makeQueue({ description: 'old desc', tags: ['old-tag'] }));
    vi.mocked(GetSimpleMQMessageCount).mockResolvedValueOnce(0);
    vi.mocked(ConfigSimpleMQQueue).mockResolvedValueOnce(
      makeQueue({ description: 'new desc', visibilityTimeoutSeconds: 60, expireSeconds: 7200, tags: ['new-tag'] })
    );
    const user = userEvent.setup();

    render(<SimpleMQDetail profile="default" queueId="123456789012" />);
    await screen.findByText('Queue詳細: my-queue');

    await user.click(screen.getByRole('button', { name: '編集' }));

    const descriptionInput = screen.getByDisplayValue('old desc');
    await user.clear(descriptionInput);
    await user.type(descriptionInput, 'new desc');

    const vtInput = screen.getByDisplayValue('30');
    await user.clear(vtInput);
    await user.type(vtInput, '60');

    const expireInput = screen.getByDisplayValue('345600');
    await user.clear(expireInput);
    await user.type(expireInput, '7200');

    const tagsInput = screen.getByDisplayValue('old-tag');
    await user.clear(tagsInput);
    await user.type(tagsInput, 'new-tag');

    await user.click(screen.getByRole('button', { name: '保存する' }));

    await waitFor(() => {
      expect(ConfigSimpleMQQueue).toHaveBeenCalledWith('default', '123456789012', 'new desc', 60, 7200, ['new-tag']);
    });
    expect(await screen.findByText('7200秒')).toBeInTheDocument();
  });

  it('rotates the API key and enables message operations', async () => {
    vi.mocked(GetSimpleMQQueue).mockResolvedValueOnce(makeQueue());
    vi.mocked(GetSimpleMQMessageCount).mockResolvedValueOnce(0);
    vi.mocked(RotateSimpleMQQueueAPIKey).mockResolvedValueOnce('new-api-key');
    const user = userEvent.setup();

    render(<SimpleMQDetail profile="default" queueId="123456789012" />);
    await screen.findByText('Queue詳細: my-queue');

    await user.click(screen.getByRole('button', { name: 'APIキーを発行(ローテーション)' }));

    await waitFor(() => {
      expect(RotateSimpleMQQueueAPIKey).toHaveBeenCalledWith('default', '123456789012');
    });
    expect(await screen.findByDisplayValue('new-api-key')).toBeInTheDocument();
    expect(screen.getByText(/新しいAPIキーを発行しました/)).toBeInTheDocument();
    expect(screen.queryByText('APIキーを発行または入力すると、メッセージの送受信ができます')).not.toBeInTheDocument();
  });

  it('clears all messages after confirmation', async () => {
    vi.mocked(GetSimpleMQQueue).mockResolvedValueOnce(makeQueue());
    vi.mocked(GetSimpleMQMessageCount)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(0);
    vi.mocked(ClearSimpleMQMessages).mockResolvedValueOnce(undefined);
    const user = userEvent.setup();

    render(<SimpleMQDetail profile="default" queueId="123456789012" />);
    await screen.findByText('5 件');

    await user.click(screen.getByRole('button', { name: '全メッセージ削除' }));
    expect(await screen.findByText('Queue「my-queue」の全メッセージを削除しますか？')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '削除する' }));

    await waitFor(() => {
      expect(ClearSimpleMQMessages).toHaveBeenCalledWith('default', '123456789012');
    });
    expect(await screen.findByText('0 件')).toBeInTheDocument();
  });

  it('sends and receives messages, then extends timeout and deletes a message', async () => {
    vi.mocked(GetSimpleMQQueue).mockResolvedValueOnce(makeQueue());
    vi.mocked(GetSimpleMQMessageCount).mockResolvedValue(0);
    vi.mocked(RotateSimpleMQQueueAPIKey).mockResolvedValueOnce('test-api-key');
    vi.mocked(SendSimpleMQMessage).mockResolvedValueOnce(makeMessage());
    vi.mocked(ReceiveSimpleMQMessages).mockResolvedValueOnce([makeMessage()]);
    vi.mocked(ExtendSimpleMQMessageTimeout).mockResolvedValueOnce(makeMessage({ visibilityTimeoutAt: 1767225660000 }));
    vi.mocked(DeleteSimpleMQMessage).mockResolvedValueOnce(undefined);
    const user = userEvent.setup();

    render(<SimpleMQDetail profile="default" queueId="123456789012" />);
    await screen.findByText('Queue詳細: my-queue');

    await user.click(screen.getByRole('button', { name: 'APIキーを発行(ローテーション)' }));
    await screen.findByDisplayValue('test-api-key');

    await user.type(screen.getByPlaceholderText('メッセージ本文'), 'hello world');
    await user.click(screen.getByRole('button', { name: '送信する' }));

    await waitFor(() => {
      expect(SendSimpleMQMessage).toHaveBeenCalledWith('default', 'my-queue', 'test-api-key', 'hello world');
    });

    await user.click(screen.getByRole('button', { name: '受信する' }));

    await waitFor(() => {
      expect(ReceiveSimpleMQMessages).toHaveBeenCalledWith('default', 'my-queue', 'test-api-key');
    });
    expect(await screen.findByText('hello world')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'タイムアウト延長' }));
    await waitFor(() => {
      expect(ExtendSimpleMQMessageTimeout).toHaveBeenCalledWith(
        'default', 'my-queue', 'test-api-key', '019feaa1-f5ef-78e4-a99d-7c135f450758'
      );
    });

    await user.click(screen.getByRole('button', { name: '削除' }));
    await waitFor(() => {
      expect(DeleteSimpleMQMessage).toHaveBeenCalledWith(
        'default', 'my-queue', 'test-api-key', '019feaa1-f5ef-78e4-a99d-7c135f450758'
      );
    });
    expect(screen.queryByText('hello world')).not.toBeInTheDocument();
  });
});
