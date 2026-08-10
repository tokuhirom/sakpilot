import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WorkflowDetail } from './WorkflowDetail';
import { workflows } from '../../wailsjs/go/models';
import {
  GetWorkflow,
  UpdateWorkflow,
  GetWorkflowRevisions,
  CreateWorkflowRevision,
  UpdateWorkflowRevisionAlias,
  DeleteWorkflowRevisionAlias,
  GetWorkflowExecutions,
  CreateWorkflowExecution,
  CancelWorkflowExecution,
  DeleteWorkflowExecution,
  GetWorkflowExecutionHistory,
} from '../../wailsjs/go/main/App';

vi.mock('../../wailsjs/go/main/App');

function renderDetail() {
  return render(<WorkflowDetail profile="default" workflowId="100000000001" />);
}

function makeWorkflow(overrides: Partial<workflows.WorkflowInfo> = {}): workflows.WorkflowInfo {
  return new workflows.WorkflowInfo({
    id: '100000000001',
    name: 'daily-batch',
    description: '',
    runbook: '',
    publish: true,
    logging: true,
    concurrencyMode: '',
    servicePrincipalId: '',
    tags: [],
    createdAt: '2026-01-01T00:00:00+09:00',
    updatedAt: '2026-01-01T00:00:00+09:00',
    ...overrides,
  });
}

function makeRevision(overrides: Partial<workflows.RevisionInfo> = {}): workflows.RevisionInfo {
  return new workflows.RevisionInfo({
    revisionId: 1,
    workflowId: '100000000001',
    revisionAlias: '',
    runbook: 'meta:\n  description: test\nsteps:\n  done:\n    return: "hello"\n',
    createdAt: '2026-01-01T00:00:00+09:00',
    updatedAt: '2026-01-01T00:00:00+09:00',
    ...overrides,
  });
}

function makeExecution(overrides: Partial<workflows.ExecutionInfo> = {}): workflows.ExecutionInfo {
  return new workflows.ExecutionInfo({
    executionId: 'exec-1',
    name: '',
    workflowId: '100000000001',
    status: 'Succeeded',
    revision: 1,
    revisionAlias: '',
    args: '',
    stepCount: 1,
    result: '',
    error: '',
    createdAt: '2026-01-01T00:00:00+09:00',
    updatedAt: '2026-01-01T00:00:00+09:00',
    runAt: '',
    failedAt: '',
    succeededAt: '',
    canceledAt: '',
    ...overrides,
  });
}

describe('WorkflowDetail', () => {
  beforeEach(() => {
    vi.mocked(GetWorkflow).mockReset();
    vi.mocked(UpdateWorkflow).mockReset();
    vi.mocked(GetWorkflowRevisions).mockReset();
    vi.mocked(CreateWorkflowRevision).mockReset();
    vi.mocked(UpdateWorkflowRevisionAlias).mockReset();
    vi.mocked(DeleteWorkflowRevisionAlias).mockReset();
    vi.mocked(GetWorkflowExecutions).mockReset();
    vi.mocked(CreateWorkflowExecution).mockReset();
    vi.mocked(CancelWorkflowExecution).mockReset();
    vi.mocked(DeleteWorkflowExecution).mockReset();
    vi.mocked(GetWorkflowExecutionHistory).mockReset();

    vi.mocked(GetWorkflow).mockResolvedValue(makeWorkflow());
    vi.mocked(GetWorkflowRevisions).mockResolvedValue([makeRevision()]);
    vi.mocked(GetWorkflowExecutions).mockResolvedValue([]);
  });

  it('shows the basic info of a workflow', async () => {
    renderDetail();

    expect(await screen.findByRole('heading', { name: 'ワークフロー詳細: daily-batch' })).toBeInTheDocument();
    expect(GetWorkflow).toHaveBeenCalledWith('default', '100000000001');
  });

  it('edits the basic info', async () => {
    vi.mocked(GetWorkflow)
      .mockResolvedValueOnce(makeWorkflow())
      .mockResolvedValueOnce(makeWorkflow({ name: 'daily-batch-renamed' }));
    vi.mocked(UpdateWorkflow).mockResolvedValueOnce(makeWorkflow({ name: 'daily-batch-renamed' }));
    const user = userEvent.setup();

    renderDetail();
    await screen.findByRole('heading', { name: 'ワークフロー詳細: daily-batch' });

    await user.click(screen.getByRole('button', { name: '編集' }));
    const nameInput = screen.getByDisplayValue('daily-batch');
    await user.clear(nameInput);
    await user.type(nameInput, 'daily-batch-renamed');
    await user.click(screen.getByRole('button', { name: '保存する' }));

    expect(UpdateWorkflow).toHaveBeenCalledWith('default', '100000000001', 'daily-batch-renamed', '', true, true, '', []);
    expect(await screen.findByRole('heading', { name: 'ワークフロー詳細: daily-batch-renamed' })).toBeInTheDocument();
  });

  it('shows revisions on the default tab', async () => {
    renderDetail();

    expect(await screen.findByText('1')).toBeInTheDocument();
    expect(GetWorkflowRevisions).toHaveBeenCalledWith('default', '100000000001');
  });

  it('creates a revision', async () => {
    vi.mocked(GetWorkflowRevisions)
      .mockResolvedValueOnce([makeRevision()])
      .mockResolvedValueOnce([makeRevision(), makeRevision({ revisionId: 2, revisionAlias: 'v2' })]);
    vi.mocked(CreateWorkflowRevision).mockResolvedValueOnce(makeRevision({ revisionId: 2, revisionAlias: 'v2' }));
    const user = userEvent.setup();

    renderDetail();
    await screen.findByRole('heading', { name: 'ワークフロー詳細: daily-batch' });

    await user.click(screen.getByRole('button', { name: '+ リビジョン作成' }));
    await user.click(screen.getByRole('button', { name: '作成する' }));

    expect(CreateWorkflowRevision).toHaveBeenCalled();
    expect(await screen.findByText('v2')).toBeInTheDocument();
  });

  it('updates a revision alias', async () => {
    vi.mocked(UpdateWorkflowRevisionAlias).mockResolvedValueOnce(makeRevision({ revisionAlias: 'stable' }));
    const user = userEvent.setup();

    renderDetail();
    await screen.findByRole('heading', { name: 'ワークフロー詳細: daily-batch' });

    await user.click(screen.getByRole('button', { name: 'Alias編集' }));
    await user.type(screen.getByRole('textbox'), 'stable');
    await user.click(screen.getByRole('button', { name: '保存する' }));

    expect(UpdateWorkflowRevisionAlias).toHaveBeenCalledWith('default', '100000000001', 1, 'stable');
  });

  it('switches to the executions tab and creates an execution', async () => {
    vi.mocked(GetWorkflowExecutions)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeExecution()]);
    vi.mocked(CreateWorkflowExecution).mockResolvedValueOnce(makeExecution());
    const user = userEvent.setup();

    renderDetail();
    await screen.findByRole('heading', { name: 'ワークフロー詳細: daily-batch' });

    await user.click(screen.getByRole('button', { name: '実行' }));
    await screen.findByText('実行履歴がありません');

    await user.click(screen.getByRole('button', { name: '+ 実行する' }));
    await user.click(screen.getByRole('button', { name: '実行する' }));

    expect(CreateWorkflowExecution).toHaveBeenCalledWith('default', '100000000001', 0, '', '', '');
    expect(await screen.findByText('exec-1')).toBeInTheDocument();
  });

  it('cancels a running execution', async () => {
    vi.mocked(GetWorkflowExecutions).mockResolvedValue([makeExecution({ status: 'Running' })]);
    vi.mocked(CancelWorkflowExecution).mockResolvedValueOnce(makeExecution({ status: 'Canceling' }));
    const user = userEvent.setup();

    renderDetail();
    await screen.findByRole('heading', { name: 'ワークフロー詳細: daily-batch' });
    await user.click(screen.getByRole('button', { name: '実行' }));
    await screen.findByText('exec-1');

    await user.click(screen.getByRole('button', { name: 'キャンセル' }));

    expect(CancelWorkflowExecution).toHaveBeenCalledWith('default', '100000000001', 'exec-1');
  });

  it('deletes an execution after confirmation', async () => {
    vi.mocked(GetWorkflowExecutions)
      .mockResolvedValueOnce([makeExecution()])
      .mockResolvedValueOnce([]);
    vi.mocked(DeleteWorkflowExecution).mockResolvedValueOnce();
    const user = userEvent.setup();

    renderDetail();
    await screen.findByRole('heading', { name: 'ワークフロー詳細: daily-batch' });
    await user.click(screen.getByRole('button', { name: '実行' }));
    await screen.findByText('exec-1');

    await user.click(screen.getByRole('button', { name: '削除' }));
    await user.click(screen.getByRole('button', { name: '削除する' }));

    expect(DeleteWorkflowExecution).toHaveBeenCalledWith('default', '100000000001', 'exec-1');
    expect(await screen.findByText('実行履歴がありません')).toBeInTheDocument();
  });

  it('shows execution history in a modal', async () => {
    vi.mocked(GetWorkflowExecutions).mockResolvedValue([makeExecution()]);
    vi.mocked(GetWorkflowExecutionHistory).mockResolvedValueOnce([
      new workflows.ExecutionHistoryInfo({
        jobId: 'job-1', threadId: 'thread-1', type: 'STEP_STARTED',
        createdAt: '2026-01-01T00:00:00+09:00', meta: '{"step":"done"}', stackTrace: '', variables: '',
      }),
    ]);
    const user = userEvent.setup();

    renderDetail();
    await screen.findByRole('heading', { name: 'ワークフロー詳細: daily-batch' });
    await user.click(screen.getByRole('button', { name: '実行' }));
    await screen.findByText('exec-1');

    await user.click(screen.getByRole('button', { name: '履歴' }));

    expect(await screen.findByText('STEP_STARTED')).toBeInTheDocument();
    expect(GetWorkflowExecutionHistory).toHaveBeenCalledWith('default', '100000000001', 'exec-1');
  });
});
