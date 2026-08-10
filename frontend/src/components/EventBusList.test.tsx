import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EventBusList } from './EventBusList';
import { eventbus } from '../../wailsjs/go/models';
import {
  GetEventBusProcessConfigurations,
  CreateEventBusProcessConfiguration,
  UpdateEventBusProcessConfiguration,
  DeleteEventBusProcessConfiguration,
  UpdateEventBusProcessConfigurationSimpleMQSecret,
  GetEventBusTriggers,
  CreateEventBusTrigger,
  DeleteEventBusTrigger,
  GetEventBusSchedules,
  CreateEventBusSchedule,
  DeleteEventBusSchedule,
} from '../../wailsjs/go/main/App';

vi.mock('../../wailsjs/go/main/App');

function renderList() {
  return render(<EventBusList profile="default" />);
}

function makePC(overrides: Partial<eventbus.ProcessConfigurationInfo> = {}): eventbus.ProcessConfigurationInfo {
  return new eventbus.ProcessConfigurationInfo({
    id: '100000000001',
    name: 'notify-on-error',
    description: '',
    destination: 'simplemq',
    parameters: '{"queue_name":"q1","content":"hello"}',
    tags: [],
    createdAt: '2026-01-01T00:00:00+09:00',
    modifiedAt: '2026-01-01T00:00:00+09:00',
    ...overrides,
  });
}

function makeTrigger(overrides: Partial<eventbus.TriggerInfo> = {}): eventbus.TriggerInfo {
  return new eventbus.TriggerInfo({
    id: '200000000001',
    name: 'server-power-on',
    description: '',
    source: 'sakuracloud',
    types: ['server.power.on'],
    conditions: [],
    processConfigurationId: '100000000001',
    tags: [],
    createdAt: '2026-01-01T00:00:00+09:00',
    modifiedAt: '2026-01-01T00:00:00+09:00',
    ...overrides,
  });
}

function makeSchedule(overrides: Partial<eventbus.ScheduleInfo> = {}): eventbus.ScheduleInfo {
  return new eventbus.ScheduleInfo({
    id: '300000000001',
    name: 'nightly-check',
    description: '',
    processConfigurationId: '100000000001',
    recurringStep: 10,
    recurringUnit: 'min',
    crontab: '',
    startsAt: '1893456000000',
    tags: [],
    createdAt: '2026-01-01T00:00:00+09:00',
    modifiedAt: '2026-01-01T00:00:00+09:00',
    ...overrides,
  });
}

describe('EventBusList', () => {
  beforeEach(() => {
    vi.mocked(GetEventBusProcessConfigurations).mockReset();
    vi.mocked(CreateEventBusProcessConfiguration).mockReset();
    vi.mocked(UpdateEventBusProcessConfiguration).mockReset();
    vi.mocked(DeleteEventBusProcessConfiguration).mockReset();
    vi.mocked(UpdateEventBusProcessConfigurationSimpleMQSecret).mockReset();
    vi.mocked(GetEventBusTriggers).mockReset();
    vi.mocked(CreateEventBusTrigger).mockReset();
    vi.mocked(DeleteEventBusTrigger).mockReset();
    vi.mocked(GetEventBusSchedules).mockReset();
    vi.mocked(CreateEventBusSchedule).mockReset();
    vi.mocked(DeleteEventBusSchedule).mockReset();

    // 各タブは実行設定・トリガー・スケジュールをまとめて読み込むため、テスト対象外のリソースにはデフォルト値を設定しておく
    vi.mocked(GetEventBusTriggers).mockResolvedValue([]);
    vi.mocked(GetEventBusSchedules).mockResolvedValue([]);
  });

  it('shows process configurations on the default tab', async () => {
    vi.mocked(GetEventBusProcessConfigurations).mockResolvedValue([makePC()]);

    renderList();

    expect(await screen.findByText('notify-on-error')).toBeInTheDocument();
    expect(GetEventBusProcessConfigurations).toHaveBeenCalledWith('default');
    expect(screen.getByText('SimpleMQ')).toBeInTheDocument();
  });

  it('shows an empty state when there are no process configurations', async () => {
    vi.mocked(GetEventBusProcessConfigurations).mockResolvedValue([]);

    renderList();

    expect(await screen.findByText('実行設定がありません')).toBeInTheDocument();
  });

  it('creates a process configuration from the create dialog', async () => {
    vi.mocked(GetEventBusProcessConfigurations)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makePC()]);
    vi.mocked(CreateEventBusProcessConfiguration).mockResolvedValueOnce(makePC());
    const user = userEvent.setup();

    renderList();
    await screen.findByText('実行設定がありません');

    await user.click(screen.getByRole('button', { name: '+ 実行設定作成' }));
    await user.type(screen.getByPlaceholderText('my-process-configuration'), 'notify-on-error');
    await user.type(screen.getByPlaceholderText('SimpleMQのキュー名'), 'q1');
    await user.type(screen.getByPlaceholderText('送信するメッセージ本文'), 'hello');
    await user.click(screen.getByRole('button', { name: '作成する' }));

    expect(CreateEventBusProcessConfiguration).toHaveBeenCalledWith(
      'default', 'notify-on-error', '', 'simplemq', JSON.stringify({ queue_name: 'q1', content: 'hello' }), []
    );
    expect(await screen.findByText('notify-on-error')).toBeInTheDocument();
  });

  it('deletes a process configuration after confirmation', async () => {
    vi.mocked(GetEventBusProcessConfigurations)
      .mockResolvedValueOnce([makePC()])
      .mockResolvedValueOnce([]);
    vi.mocked(DeleteEventBusProcessConfiguration).mockResolvedValueOnce();
    const user = userEvent.setup();

    renderList();
    await screen.findByText('notify-on-error');

    await user.click(screen.getByRole('button', { name: '削除' }));
    await user.click(screen.getByRole('button', { name: '削除する' }));

    expect(DeleteEventBusProcessConfiguration).toHaveBeenCalledWith('default', '100000000001');
    expect(await screen.findByText('実行設定がありません')).toBeInTheDocument();
  });

  it('sets a SimpleMQ secret for a process configuration', async () => {
    vi.mocked(GetEventBusProcessConfigurations).mockResolvedValue([makePC()]);
    vi.mocked(UpdateEventBusProcessConfigurationSimpleMQSecret).mockResolvedValueOnce();
    const user = userEvent.setup();

    renderList();
    await screen.findByText('notify-on-error');

    await user.click(screen.getByRole('button', { name: 'シークレット設定' }));
    await user.type(screen.getByPlaceholderText('SimpleMQのAPIキー'), 'test-api-key');
    await user.click(screen.getByRole('button', { name: '設定する' }));

    expect(UpdateEventBusProcessConfigurationSimpleMQSecret).toHaveBeenCalledWith('default', '100000000001', 'test-api-key');
    expect(await screen.findByText('設定しました')).toBeInTheDocument();
  });

  it('switches to the triggers tab and loads triggers', async () => {
    vi.mocked(GetEventBusProcessConfigurations).mockResolvedValue([makePC()]);
    vi.mocked(GetEventBusTriggers).mockResolvedValue([makeTrigger()]);
    const user = userEvent.setup();

    renderList();
    await screen.findByText('notify-on-error');

    await user.click(screen.getByRole('button', { name: 'トリガー' }));

    expect(await screen.findByText('server-power-on')).toBeInTheDocument();
    expect(GetEventBusTriggers).toHaveBeenCalledWith('default');
    // 実行設定名で解決されて表示される
    expect(screen.getAllByText('notify-on-error').length).toBeGreaterThan(0);
  });

  it('creates a trigger from the create dialog', async () => {
    vi.mocked(GetEventBusProcessConfigurations).mockResolvedValue([makePC()]);
    vi.mocked(GetEventBusTriggers)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeTrigger()]);
    vi.mocked(CreateEventBusTrigger).mockResolvedValueOnce(makeTrigger());
    const user = userEvent.setup();

    renderList();
    await screen.findByText('notify-on-error');
    await user.click(screen.getByRole('button', { name: 'トリガー' }));
    await screen.findByText('トリガーがありません');

    await user.click(screen.getByRole('button', { name: '+ トリガー作成' }));
    await user.type(screen.getByPlaceholderText('my-trigger'), 'server-power-on');
    await user.type(screen.getByPlaceholderText('sakuracloud'), 'sakuracloud');
    await user.click(screen.getByRole('button', { name: '作成する' }));

    expect(CreateEventBusTrigger).toHaveBeenCalledWith(
      'default', 'server-power-on', '', 'sakuracloud', [], [], '100000000001', []
    );
    expect(await screen.findByText('server-power-on')).toBeInTheDocument();
  });

  it('deletes a trigger after confirmation', async () => {
    vi.mocked(GetEventBusProcessConfigurations).mockResolvedValue([makePC()]);
    vi.mocked(GetEventBusTriggers)
      .mockResolvedValueOnce([makeTrigger()])
      .mockResolvedValueOnce([]);
    vi.mocked(DeleteEventBusTrigger).mockResolvedValueOnce();
    const user = userEvent.setup();

    renderList();
    await screen.findByText('notify-on-error');
    await user.click(screen.getByRole('button', { name: 'トリガー' }));
    await screen.findByText('server-power-on');

    await user.click(screen.getByRole('button', { name: '削除' }));
    await user.click(screen.getByRole('button', { name: '削除する' }));

    expect(DeleteEventBusTrigger).toHaveBeenCalledWith('default', '200000000001');
    expect(await screen.findByText('トリガーがありません')).toBeInTheDocument();
  });

  it('switches to the schedules tab and loads schedules', async () => {
    vi.mocked(GetEventBusProcessConfigurations).mockResolvedValue([makePC()]);
    vi.mocked(GetEventBusSchedules).mockResolvedValue([makeSchedule()]);
    const user = userEvent.setup();

    renderList();
    await screen.findByText('notify-on-error');

    await user.click(screen.getByRole('button', { name: 'スケジュール' }));

    expect(await screen.findByText('nightly-check')).toBeInTheDocument();
    expect(GetEventBusSchedules).toHaveBeenCalledWith('default');
  });

  it('creates a schedule from the create dialog', async () => {
    vi.mocked(GetEventBusProcessConfigurations).mockResolvedValue([makePC()]);
    vi.mocked(GetEventBusSchedules)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeSchedule()]);
    vi.mocked(CreateEventBusSchedule).mockResolvedValueOnce(makeSchedule());
    const user = userEvent.setup();

    renderList();
    await screen.findByText('notify-on-error');
    await user.click(screen.getByRole('button', { name: 'スケジュール' }));
    await screen.findByText('スケジュールがありません');

    await user.click(screen.getByRole('button', { name: '+ スケジュール作成' }));
    await user.type(screen.getByPlaceholderText('my-schedule'), 'nightly-check');
    const startsAtInput = document.querySelector('input[type="datetime-local"]') as HTMLInputElement;
    fireEvent.change(startsAtInput, { target: { value: '2030-01-01T00:00' } });
    await user.click(screen.getByRole('button', { name: '作成する' }));

    expect(CreateEventBusSchedule).toHaveBeenCalledWith(
      'default', 'nightly-check', '', '100000000001', 10, 'min', '', expect.any(Number), []
    );
    expect(await screen.findByText('nightly-check')).toBeInTheDocument();
  });

  it('deletes a schedule after confirmation', async () => {
    vi.mocked(GetEventBusProcessConfigurations).mockResolvedValue([makePC()]);
    vi.mocked(GetEventBusSchedules)
      .mockResolvedValueOnce([makeSchedule()])
      .mockResolvedValueOnce([]);
    vi.mocked(DeleteEventBusSchedule).mockResolvedValueOnce();
    const user = userEvent.setup();

    renderList();
    await screen.findByText('notify-on-error');
    await user.click(screen.getByRole('button', { name: 'スケジュール' }));
    await screen.findByText('nightly-check');

    await user.click(screen.getByRole('button', { name: '削除' }));
    await user.click(screen.getByRole('button', { name: '削除する' }));

    expect(DeleteEventBusSchedule).toHaveBeenCalledWith('default', '300000000001');
    expect(await screen.findByText('スケジュールがありません')).toBeInTheDocument();
  });

  it('shows an error message when loading fails', async () => {
    vi.mocked(GetEventBusProcessConfigurations).mockRejectedValueOnce(new Error('network error'));

    renderList();

    expect(await screen.findByText(/読み込みに失敗しました: Error: network error/)).toBeInTheDocument();
  });
});
