package workflows_test

import (
	"context"
	"testing"

	mockworkflows "github.com/sacloud/sakumock/workflows"

	"sakpilot/internal/workflows"
)

const testRunbook = `
meta:
  description: test
steps:
  done:
    return: "hello"
`

func newTestService(t *testing.T, endpoint string) *workflows.Service {
	t.Helper()

	t.Setenv("SAKURA_ACCESS_TOKEN", "dummy")
	t.Setenv("SAKURA_ACCESS_TOKEN_SECRET", "dummy")
	t.Setenv("SAKURA_ENDPOINTS_WORKFLOWS", endpoint)

	profileName := writeUsacloudProfile(t, "dummy", "dummy")

	service, err := workflows.NewService(profileName)
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}
	return service
}

func TestService_WorkflowCRUD(t *testing.T) {
	srv := mockworkflows.NewTestServer(mockworkflows.Config{})
	defer srv.Close()

	service := newTestService(t, srv.TestURL())
	ctx := context.Background()

	created, err := service.CreateWorkflow(ctx, "test-workflow", "a test workflow", testRunbook, true, true, "parallel", []string{"env:test"})
	if err != nil {
		t.Fatalf("CreateWorkflow: %v", err)
	}
	if created.Name != "test-workflow" {
		t.Errorf("Name = %q, want %q", created.Name, "test-workflow")
	}
	if !created.Publish || !created.Logging {
		t.Errorf("Publish/Logging = %v/%v, want true/true", created.Publish, created.Logging)
	}
	if created.ConcurrencyMode != "parallel" {
		t.Errorf("ConcurrencyMode = %q, want %q", created.ConcurrencyMode, "parallel")
	}
	if len(created.Tags) != 1 || created.Tags[0] != "env:test" {
		t.Errorf("Tags = %v, want [env:test]", created.Tags)
	}
	if created.ID == "" {
		t.Fatal("ID is empty")
	}

	list, err := service.ListWorkflows(ctx)
	if err != nil {
		t.Fatalf("ListWorkflows: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("got %d workflows, want 1: %+v", len(list), list)
	}

	got, err := service.GetWorkflow(ctx, created.ID)
	if err != nil {
		t.Fatalf("GetWorkflow: %v", err)
	}
	if got.Name != "test-workflow" {
		t.Errorf("Name = %q, want %q", got.Name, "test-workflow")
	}

	updated, err := service.UpdateWorkflow(ctx, created.ID, "updated-workflow", "updated description", false, false, "lock", []string{"env:prod"})
	if err != nil {
		t.Fatalf("UpdateWorkflow: %v", err)
	}
	if updated.Name != "updated-workflow" {
		t.Errorf("Name = %q, want %q", updated.Name, "updated-workflow")
	}
	if updated.ConcurrencyMode != "lock" {
		t.Errorf("ConcurrencyMode = %q, want %q", updated.ConcurrencyMode, "lock")
	}

	if err := service.DeleteWorkflow(ctx, created.ID); err != nil {
		t.Fatalf("DeleteWorkflow: %v", err)
	}
	if _, err := service.GetWorkflow(ctx, created.ID); err == nil {
		t.Error("expected GetWorkflow after delete to fail")
	}
}

func TestService_RevisionCRUD(t *testing.T) {
	srv := mockworkflows.NewTestServer(mockworkflows.Config{})
	defer srv.Close()

	service := newTestService(t, srv.TestURL())
	ctx := context.Background()

	wf, err := service.CreateWorkflow(ctx, "rev-test", "", testRunbook, true, true, "", nil)
	if err != nil {
		t.Fatalf("CreateWorkflow: %v", err)
	}

	list, err := service.ListRevisions(ctx, wf.ID)
	if err != nil {
		t.Fatalf("ListRevisions: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("got %d revisions, want 1: %+v", len(list), list)
	}

	newRunbook := `
meta:
  description: v2
steps:
  done:
    return: "world"
`
	created, err := service.CreateRevision(ctx, wf.ID, newRunbook, "v2")
	if err != nil {
		t.Fatalf("CreateRevision: %v", err)
	}
	if created.RevisionAlias != "v2" {
		t.Errorf("RevisionAlias = %q, want %q", created.RevisionAlias, "v2")
	}

	list, err = service.ListRevisions(ctx, wf.ID)
	if err != nil {
		t.Fatalf("ListRevisions: %v", err)
	}
	if len(list) != 2 {
		t.Fatalf("got %d revisions, want 2: %+v", len(list), list)
	}

	updated, err := service.UpdateRevisionAlias(ctx, wf.ID, created.RevisionID, "v2-updated")
	if err != nil {
		t.Fatalf("UpdateRevisionAlias: %v", err)
	}
	if updated.RevisionAlias != "v2-updated" {
		t.Errorf("RevisionAlias = %q, want %q", updated.RevisionAlias, "v2-updated")
	}

	if err := service.DeleteRevisionAlias(ctx, wf.ID, created.RevisionID); err != nil {
		t.Fatalf("DeleteRevisionAlias: %v", err)
	}
}

func TestService_ExecutionLifecycle(t *testing.T) {
	srv := mockworkflows.NewTestServer(mockworkflows.Config{})
	defer srv.Close()

	service := newTestService(t, srv.TestURL())
	ctx := context.Background()

	wf, err := service.CreateWorkflow(ctx, "exec-test", "", testRunbook, true, true, "", nil)
	if err != nil {
		t.Fatalf("CreateWorkflow: %v", err)
	}

	exec, err := service.CreateExecution(ctx, wf.ID, 0, "", "", "")
	if err != nil {
		t.Fatalf("CreateExecution: %v", err)
	}
	if exec.ExecutionID == "" {
		t.Fatal("ExecutionID is empty")
	}
	if exec.Status != "Succeeded" {
		t.Errorf("Status = %q, want %q", exec.Status, "Succeeded")
	}

	got, err := service.GetExecution(ctx, wf.ID, exec.ExecutionID)
	if err != nil {
		t.Fatalf("GetExecution: %v", err)
	}
	if got.ExecutionID != exec.ExecutionID {
		t.Errorf("ExecutionID mismatch: got %q, want %q", got.ExecutionID, exec.ExecutionID)
	}

	list, err := service.ListExecutions(ctx, wf.ID)
	if err != nil {
		t.Fatalf("ListExecutions: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("got %d executions, want 1: %+v", len(list), list)
	}

	if _, err := service.ListExecutionHistory(ctx, wf.ID, exec.ExecutionID); err != nil {
		t.Fatalf("ListExecutionHistory: %v", err)
	}

	if err := service.DeleteExecution(ctx, wf.ID, exec.ExecutionID); err != nil {
		t.Fatalf("DeleteExecution: %v", err)
	}

	if err := service.DeleteWorkflow(ctx, wf.ID); err != nil {
		t.Fatalf("DeleteWorkflow: %v", err)
	}
}

func TestService_Subscription(t *testing.T) {
	srv := mockworkflows.NewTestServer(mockworkflows.Config{})
	defer srv.Close()

	service := newTestService(t, srv.TestURL())
	ctx := context.Background()

	plans, err := service.ListPlans(ctx)
	if err != nil {
		t.Fatalf("ListPlans: %v", err)
	}
	if len(plans) == 0 {
		t.Fatal("expected at least one plan")
	}

	sub, err := service.GetSubscription(ctx)
	if err != nil {
		t.Fatalf("GetSubscription: %v", err)
	}
	if sub.Subscribed {
		t.Error("expected Subscribed=false before subscribing")
	}

	if err := service.CreateSubscription(ctx, plans[0].ID); err != nil {
		t.Fatalf("CreateSubscription: %v", err)
	}

	sub, err = service.GetSubscription(ctx)
	if err != nil {
		t.Fatalf("GetSubscription: %v", err)
	}
	if !sub.Subscribed {
		t.Fatal("expected Subscribed=true after subscribing")
	}
	if sub.PlanID != plans[0].ID {
		t.Errorf("PlanID = %d, want %d", sub.PlanID, plans[0].ID)
	}

	if err := service.DeleteSubscription(ctx); err != nil {
		t.Fatalf("DeleteSubscription: %v", err)
	}
}
