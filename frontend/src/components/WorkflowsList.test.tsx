import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WorkflowsList } from './WorkflowsList';
import { workflows } from '../../wailsjs/go/models';
import {
  GetWorkflows,
  CreateWorkflow,
  DeleteWorkflow,
  GetWorkflowsSubscription,
  GetWorkflowsPlans,
  CreateWorkflowsSubscription,
  DeleteWorkflowsSubscription,
} from '../../wailsjs/go/main/App';

vi.mock('../../wailsjs/go/main/App');

function renderList(onSelectWorkflow = vi.fn()) {
  return render(<WorkflowsList profile="default" onSelectWorkflow={onSelectWorkflow} />);
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

function makeSubscribedInfo(overrides: Partial<workflows.SubscriptionInfo> = {}): workflows.SubscriptionInfo {
  return new workflows.SubscriptionInfo({
    subscribed: true,
    planId: 1,
    planName: 'Standard',
    activateFrom: '2026-01-01T00:00:00+09:00',
    ...overrides,
  });
}

function makePlan(overrides: Partial<workflows.PlanInfo> = {}): workflows.PlanInfo {
  return new workflows.PlanInfo({
    id: 1,
    name: 'Standard',
    grade: 1,
    serviceClassPath: 'cloud/workflows/standard',
    basePrice: 1000,
    includedSteps: 10000,
    overageStepUnit: 1000,
    overagePricePerUnit: 10,
    ...overrides,
  });
}

describe('WorkflowsList', () => {
  beforeEach(() => {
    vi.mocked(GetWorkflows).mockReset();
    vi.mocked(CreateWorkflow).mockReset();
    vi.mocked(DeleteWorkflow).mockReset();
    vi.mocked(GetWorkflowsSubscription).mockReset();
    vi.mocked(GetWorkflowsPlans).mockReset();
    vi.mocked(CreateWorkflowsSubscription).mockReset();
    vi.mocked(DeleteWorkflowsSubscription).mockReset();

    vi.mocked(GetWorkflowsSubscription).mockResolvedValue(makeSubscribedInfo());
  });

  it('shows workflows on load', async () => {
    vi.mocked(GetWorkflows).mockResolvedValue([makeWorkflow()]);

    renderList();

    expect(await screen.findByText('daily-batch')).toBeInTheDocument();
    expect(GetWorkflows).toHaveBeenCalledWith('default');
    expect(screen.getByText(/プラン: Standard/)).toBeInTheDocument();
  });

  it('shows an empty state when there are no workflows', async () => {
    vi.mocked(GetWorkflows).mockResolvedValue([]);

    renderList();

    expect(await screen.findByText('ワークフローがありません')).toBeInTheDocument();
  });

  it('shows the unsubscribed state and disables create', async () => {
    vi.mocked(GetWorkflows).mockResolvedValue([]);
    vi.mocked(GetWorkflowsSubscription).mockResolvedValue(new workflows.SubscriptionInfo({
      subscribed: false, planId: 0, planName: '', activateFrom: '',
    }));

    renderList();

    expect(await screen.findByText('未契約です。ワークフローを作成するにはプランの契約が必要です')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ ワークフロー作成' })).toBeDisabled();
  });

  it('creates a workflow from the create dialog', async () => {
    vi.mocked(GetWorkflows)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeWorkflow()]);
    vi.mocked(CreateWorkflow).mockResolvedValueOnce(makeWorkflow());
    const user = userEvent.setup();

    renderList();
    await screen.findByText('ワークフローがありません');

    await user.click(screen.getByRole('button', { name: '+ ワークフロー作成' }));
    await user.type(screen.getByPlaceholderText('my-workflow'), 'daily-batch');
    await user.click(screen.getByRole('button', { name: '作成する' }));

    expect(CreateWorkflow).toHaveBeenCalled();
    expect(CreateWorkflow).toHaveBeenCalledWith('default', 'daily-batch', '', expect.any(String), true, true, '', []);
    expect(await screen.findByText('daily-batch')).toBeInTheDocument();
  });

  it('navigates to the detail page when a workflow card is clicked', async () => {
    vi.mocked(GetWorkflows).mockResolvedValue([makeWorkflow()]);
    const onSelectWorkflow = vi.fn();
    const user = userEvent.setup();

    renderList(onSelectWorkflow);
    await user.click(await screen.findByText('daily-batch'));

    expect(onSelectWorkflow).toHaveBeenCalledWith('100000000001');
  });

  it('deletes a workflow after confirmation', async () => {
    vi.mocked(GetWorkflows)
      .mockResolvedValueOnce([makeWorkflow()])
      .mockResolvedValueOnce([]);
    vi.mocked(DeleteWorkflow).mockResolvedValueOnce();
    const user = userEvent.setup();

    renderList();
    await screen.findByText('daily-batch');

    await user.click(screen.getByRole('button', { name: '削除' }));
    await user.click(screen.getByRole('button', { name: '削除する' }));

    expect(DeleteWorkflow).toHaveBeenCalledWith('default', '100000000001');
    expect(await screen.findByText('ワークフローがありません')).toBeInTheDocument();
  });

  it('subscribes to a plan from the subscribe dialog', async () => {
    vi.mocked(GetWorkflows).mockResolvedValue([]);
    vi.mocked(GetWorkflowsSubscription)
      .mockResolvedValueOnce(new workflows.SubscriptionInfo({ subscribed: false, planId: 0, planName: '', activateFrom: '' }))
      .mockResolvedValueOnce(makeSubscribedInfo());
    vi.mocked(GetWorkflowsPlans).mockResolvedValueOnce([makePlan()]);
    vi.mocked(CreateWorkflowsSubscription).mockResolvedValueOnce();
    const user = userEvent.setup();

    renderList();
    await screen.findByText('未契約です。ワークフローを作成するにはプランの契約が必要です');

    await user.click(screen.getByRole('button', { name: '契約する' }));
    await screen.findByRole('option', { name: /Standard/ });
    const submitButtons = screen.getAllByRole('button', { name: '契約する' });
    await user.click(submitButtons[submitButtons.length - 1]);

    expect(CreateWorkflowsSubscription).toHaveBeenCalledWith('default', 1);
    expect(await screen.findByText(/プラン: Standard/)).toBeInTheDocument();
  });

  it('unsubscribes after confirmation', async () => {
    vi.mocked(GetWorkflows).mockResolvedValue([]);
    vi.mocked(DeleteWorkflowsSubscription).mockResolvedValueOnce();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();

    renderList();
    await screen.findByText(/プラン: Standard/);

    await user.click(screen.getByRole('button', { name: '解約する' }));

    expect(DeleteWorkflowsSubscription).toHaveBeenCalledWith('default');
  });
});
