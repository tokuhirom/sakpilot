package eventbus_test

import (
	"context"
	"testing"

	mockeventbus "github.com/sacloud/sakumock/eventbus"

	"sakpilot/internal/eventbus"
)

func newTestService(t *testing.T, endpoint string) *eventbus.Service {
	t.Helper()

	t.Setenv("SAKURA_ACCESS_TOKEN", "dummy")
	t.Setenv("SAKURA_ACCESS_TOKEN_SECRET", "dummy")
	t.Setenv("SAKURA_ENDPOINTS_EVENTBUS", endpoint)

	profileName := writeUsacloudProfile(t, "dummy", "dummy")

	service, err := eventbus.NewService(profileName)
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}
	return service
}

func TestService_ProcessConfigurationCRUDAndSecret(t *testing.T) {
	srv := mockeventbus.NewTestServer(mockeventbus.Config{})
	defer srv.Close()

	service := newTestService(t, srv.TestURL())
	ctx := context.Background()

	created, err := service.CreateProcessConfiguration(ctx, "test-pc", "a test process configuration", "simplemq", `{"queue_name":"q1","content":"hello"}`, []string{"env:test"})
	if err != nil {
		t.Fatalf("CreateProcessConfiguration: %v", err)
	}
	if created.Name != "test-pc" {
		t.Errorf("Name = %q, want %q", created.Name, "test-pc")
	}
	if created.Destination != "simplemq" {
		t.Errorf("Destination = %q, want %q", created.Destination, "simplemq")
	}
	if len(created.Tags) != 1 || created.Tags[0] != "env:test" {
		t.Errorf("Tags = %v, want [env:test]", created.Tags)
	}
	if created.ID == "" {
		t.Error("ID is empty")
	}

	list, err := service.ListProcessConfigurations(ctx)
	if err != nil {
		t.Fatalf("ListProcessConfigurations: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("got %d process configurations, want 1: %+v", len(list), list)
	}

	got, err := service.GetProcessConfiguration(ctx, created.ID)
	if err != nil {
		t.Fatalf("GetProcessConfiguration: %v", err)
	}
	if got.Name != "test-pc" {
		t.Errorf("Name = %q, want %q", got.Name, "test-pc")
	}

	updated, err := service.UpdateProcessConfiguration(ctx, created.ID, "updated-pc", "updated description", "simplemq", `{"queue_name":"q2","content":"world"}`, []string{"env:prod"})
	if err != nil {
		t.Fatalf("UpdateProcessConfiguration: %v", err)
	}
	if updated.Name != "updated-pc" {
		t.Errorf("Name = %q, want %q", updated.Name, "updated-pc")
	}

	if err := service.UpdateProcessConfigurationSimpleMQSecret(ctx, created.ID, "test-api-key"); err != nil {
		t.Fatalf("UpdateProcessConfigurationSimpleMQSecret: %v", err)
	}

	if err := service.DeleteProcessConfiguration(ctx, created.ID); err != nil {
		t.Fatalf("DeleteProcessConfiguration: %v", err)
	}

	list, err = service.ListProcessConfigurations(ctx)
	if err != nil {
		t.Fatalf("ListProcessConfigurations after delete: %v", err)
	}
	if len(list) != 0 {
		t.Fatalf("got %d process configurations after delete, want 0: %+v", len(list), list)
	}
}

func TestService_ProcessConfigurationSacloudAPISecret(t *testing.T) {
	srv := mockeventbus.NewTestServer(mockeventbus.Config{})
	defer srv.Close()

	service := newTestService(t, srv.TestURL())
	ctx := context.Background()

	created, err := service.CreateProcessConfiguration(ctx, "test-pc-autoscale", "", "autoscale", `{"action":"scale_up","resource_id":"101122334455"}`, nil)
	if err != nil {
		t.Fatalf("CreateProcessConfiguration: %v", err)
	}

	if err := service.UpdateProcessConfigurationSacloudAPISecret(ctx, created.ID, "test-token", "test-secret"); err != nil {
		t.Fatalf("UpdateProcessConfigurationSacloudAPISecret: %v", err)
	}
}

func TestService_TriggerCRUD(t *testing.T) {
	srv := mockeventbus.NewTestServer(mockeventbus.Config{})
	defer srv.Close()

	service := newTestService(t, srv.TestURL())
	ctx := context.Background()

	pc, err := service.CreateProcessConfiguration(ctx, "test-pc", "", "simplemq", `{"queue_name":"q1","content":"hello"}`, nil)
	if err != nil {
		t.Fatalf("CreateProcessConfiguration: %v", err)
	}

	conditions := []eventbus.TriggerConditionInfo{
		{Key: "resourcetag", Op: "in", Values: []string{"env:prod", "env:staging"}},
	}
	created, err := service.CreateTrigger(ctx, "test-trigger", "a test trigger", "sakuracloud", []string{"server.power.on"}, conditions, pc.ID, []string{"env:test"})
	if err != nil {
		t.Fatalf("CreateTrigger: %v", err)
	}
	if created.Name != "test-trigger" {
		t.Errorf("Name = %q, want %q", created.Name, "test-trigger")
	}
	if created.Source != "sakuracloud" {
		t.Errorf("Source = %q, want %q", created.Source, "sakuracloud")
	}
	if len(created.Types) != 1 || created.Types[0] != "server.power.on" {
		t.Errorf("Types = %v, want [server.power.on]", created.Types)
	}
	if created.ProcessConfigurationID != pc.ID {
		t.Errorf("ProcessConfigurationID = %q, want %q", created.ProcessConfigurationID, pc.ID)
	}
	if len(created.Conditions) != 1 || created.Conditions[0].Key != "resourcetag" || created.Conditions[0].Op != "in" {
		t.Errorf("Conditions = %+v, want [{resourcetag in [env:prod env:staging]}]", created.Conditions)
	}

	list, err := service.ListTriggers(ctx)
	if err != nil {
		t.Fatalf("ListTriggers: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("got %d triggers, want 1: %+v", len(list), list)
	}

	got, err := service.GetTrigger(ctx, created.ID)
	if err != nil {
		t.Fatalf("GetTrigger: %v", err)
	}
	if got.Name != "test-trigger" {
		t.Errorf("Name = %q, want %q", got.Name, "test-trigger")
	}

	updated, err := service.UpdateTrigger(ctx, created.ID, "updated-trigger", "updated description", "sakuracloud", []string{"server.power.off"}, conditions, pc.ID, []string{"env:prod"})
	if err != nil {
		t.Fatalf("UpdateTrigger: %v", err)
	}
	if updated.Name != "updated-trigger" {
		t.Errorf("Name = %q, want %q", updated.Name, "updated-trigger")
	}
	if len(updated.Types) != 1 || updated.Types[0] != "server.power.off" {
		t.Errorf("Types = %v, want [server.power.off]", updated.Types)
	}

	if err := service.DeleteTrigger(ctx, created.ID); err != nil {
		t.Fatalf("DeleteTrigger: %v", err)
	}

	list, err = service.ListTriggers(ctx)
	if err != nil {
		t.Fatalf("ListTriggers after delete: %v", err)
	}
	if len(list) != 0 {
		t.Fatalf("got %d triggers after delete, want 0: %+v", len(list), list)
	}
}

func TestService_ScheduleCRUD(t *testing.T) {
	srv := mockeventbus.NewTestServer(mockeventbus.Config{})
	defer srv.Close()

	service := newTestService(t, srv.TestURL())
	ctx := context.Background()

	pc, err := service.CreateProcessConfiguration(ctx, "test-pc", "", "simplemq", `{"queue_name":"q1","content":"hello"}`, nil)
	if err != nil {
		t.Fatalf("CreateProcessConfiguration: %v", err)
	}

	const startsAtMillis = int64(1893456000000) // 2030-01-01T00:00:00Z

	created, err := service.CreateSchedule(ctx, "test-schedule", "a test schedule", pc.ID, 10, "min", "", startsAtMillis, []string{"env:test"})
	if err != nil {
		t.Fatalf("CreateSchedule: %v", err)
	}
	if created.Name != "test-schedule" {
		t.Errorf("Name = %q, want %q", created.Name, "test-schedule")
	}
	if created.ProcessConfigurationID != pc.ID {
		t.Errorf("ProcessConfigurationID = %q, want %q", created.ProcessConfigurationID, pc.ID)
	}
	if created.RecurringStep != 10 {
		t.Errorf("RecurringStep = %d, want 10", created.RecurringStep)
	}
	if created.RecurringUnit != "min" {
		t.Errorf("RecurringUnit = %q, want %q", created.RecurringUnit, "min")
	}
	if created.StartsAt == "" {
		t.Error("StartsAt is empty")
	}

	list, err := service.ListSchedules(ctx)
	if err != nil {
		t.Fatalf("ListSchedules: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("got %d schedules, want 1: %+v", len(list), list)
	}

	got, err := service.GetSchedule(ctx, created.ID)
	if err != nil {
		t.Fatalf("GetSchedule: %v", err)
	}
	if got.Name != "test-schedule" {
		t.Errorf("Name = %q, want %q", got.Name, "test-schedule")
	}

	updated, err := service.UpdateSchedule(ctx, created.ID, "updated-schedule", "updated description", pc.ID, 0, "", "0 0 * * *", startsAtMillis, []string{"env:prod"})
	if err != nil {
		t.Fatalf("UpdateSchedule: %v", err)
	}
	if updated.Name != "updated-schedule" {
		t.Errorf("Name = %q, want %q", updated.Name, "updated-schedule")
	}
	if updated.Crontab != "0 0 * * *" {
		t.Errorf("Crontab = %q, want %q", updated.Crontab, "0 0 * * *")
	}

	if err := service.DeleteSchedule(ctx, created.ID); err != nil {
		t.Fatalf("DeleteSchedule: %v", err)
	}

	list, err = service.ListSchedules(ctx)
	if err != nil {
		t.Fatalf("ListSchedules after delete: %v", err)
	}
	if len(list) != 0 {
		t.Fatalf("got %d schedules after delete, want 0: %+v", len(list), list)
	}
}
