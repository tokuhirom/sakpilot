package simplenotification_test

import (
	"context"
	"testing"

	mocksimplenotification "github.com/sacloud/sakumock/simplenotification"

	"sakpilot/internal/simplenotification"
)

func newTestService(t *testing.T, endpoint string) *simplenotification.Service {
	t.Helper()

	t.Setenv("SAKURA_ACCESS_TOKEN", "dummy")
	t.Setenv("SAKURA_ACCESS_TOKEN_SECRET", "dummy")
	t.Setenv("SAKURA_ENDPOINTS_SIMPLE_NOTIFICATION", endpoint)

	profileName := writeUsacloudProfile(t, "dummy", "dummy")

	service, err := simplenotification.NewService(profileName)
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}
	return service
}

func TestService_DestinationCRUD(t *testing.T) {
	srv := mocksimplenotification.NewTestServer(mocksimplenotification.Config{})
	defer srv.Close()

	service := newTestService(t, srv.TestURL())
	ctx := context.Background()

	created, err := service.CreateDestination(ctx, "test-destination", "a test destination", "email", "alert@example.com", []string{"env:test"})
	if err != nil {
		t.Fatalf("CreateDestination: %v", err)
	}
	if created.Name != "test-destination" {
		t.Errorf("Name = %q, want %q", created.Name, "test-destination")
	}
	if created.Type != "email" {
		t.Errorf("Type = %q, want %q", created.Type, "email")
	}
	if created.Value != "alert@example.com" {
		t.Errorf("Value = %q, want %q", created.Value, "alert@example.com")
	}
	if len(created.Tags) != 1 || created.Tags[0] != "env:test" {
		t.Errorf("Tags = %v, want [env:test]", created.Tags)
	}
	if created.ID == "" {
		t.Error("ID is empty")
	}

	list, err := service.ListDestinations(ctx)
	if err != nil {
		t.Fatalf("ListDestinations: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("got %d destinations, want 1: %+v", len(list), list)
	}

	got, err := service.GetDestination(ctx, created.ID)
	if err != nil {
		t.Fatalf("GetDestination: %v", err)
	}
	if got.Name != "test-destination" {
		t.Errorf("Name = %q, want %q", got.Name, "test-destination")
	}

	updated, err := service.UpdateDestination(ctx, created.ID, "updated-destination", "updated description", "webhook", "https://example.com/hook", []string{"env:prod"})
	if err != nil {
		t.Fatalf("UpdateDestination: %v", err)
	}
	if updated.Name != "updated-destination" {
		t.Errorf("Name = %q, want %q", updated.Name, "updated-destination")
	}
	if updated.Type != "webhook" {
		t.Errorf("Type = %q, want %q", updated.Type, "webhook")
	}
	if updated.Value != "https://example.com/hook" {
		t.Errorf("Value = %q, want %q", updated.Value, "https://example.com/hook")
	}

	if err := service.DeleteDestination(ctx, created.ID); err != nil {
		t.Fatalf("DeleteDestination: %v", err)
	}

	list, err = service.ListDestinations(ctx)
	if err != nil {
		t.Fatalf("ListDestinations after delete: %v", err)
	}
	if len(list) != 0 {
		t.Fatalf("got %d destinations after delete, want 0: %+v", len(list), list)
	}
}

func TestService_GroupCRUDAndSendMessage(t *testing.T) {
	srv := mocksimplenotification.NewTestServer(mocksimplenotification.Config{})
	defer srv.Close()

	service := newTestService(t, srv.TestURL())
	ctx := context.Background()

	dest, err := service.CreateDestination(ctx, "test-destination", "", "email", "alert@example.com", nil)
	if err != nil {
		t.Fatalf("CreateDestination: %v", err)
	}

	created, err := service.CreateGroup(ctx, "test-group", "a test group", []string{dest.ID}, []string{"env:test"})
	if err != nil {
		t.Fatalf("CreateGroup: %v", err)
	}
	if created.Name != "test-group" {
		t.Errorf("Name = %q, want %q", created.Name, "test-group")
	}
	if len(created.Destinations) != 1 || created.Destinations[0] != dest.ID {
		t.Errorf("Destinations = %v, want [%s]", created.Destinations, dest.ID)
	}

	list, err := service.ListGroups(ctx)
	if err != nil {
		t.Fatalf("ListGroups: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("got %d groups, want 1: %+v", len(list), list)
	}

	got, err := service.GetGroup(ctx, created.ID)
	if err != nil {
		t.Fatalf("GetGroup: %v", err)
	}
	if got.Name != "test-group" {
		t.Errorf("Name = %q, want %q", got.Name, "test-group")
	}

	updated, err := service.UpdateGroup(ctx, created.ID, "updated-group", "updated description", []string{dest.ID}, []string{"env:prod"})
	if err != nil {
		t.Fatalf("UpdateGroup: %v", err)
	}
	if updated.Name != "updated-group" {
		t.Errorf("Name = %q, want %q", updated.Name, "updated-group")
	}

	ok, err := service.SendGroupMessage(ctx, created.ID, "test message")
	if err != nil {
		t.Fatalf("SendGroupMessage: %v", err)
	}
	if !ok {
		t.Error("SendGroupMessage returned false, want true")
	}

	if err := service.DeleteGroup(ctx, created.ID); err != nil {
		t.Fatalf("DeleteGroup: %v", err)
	}

	list, err = service.ListGroups(ctx)
	if err != nil {
		t.Fatalf("ListGroups after delete: %v", err)
	}
	if len(list) != 0 {
		t.Fatalf("got %d groups after delete, want 0: %+v", len(list), list)
	}
}

func TestService_RoutingCRUD(t *testing.T) {
	srv := mocksimplenotification.NewTestServer(mocksimplenotification.Config{})
	defer srv.Close()

	service := newTestService(t, srv.TestURL())
	ctx := context.Background()

	dest, err := service.CreateDestination(ctx, "test-destination", "", "email", "alert@example.com", nil)
	if err != nil {
		t.Fatalf("CreateDestination: %v", err)
	}
	group, err := service.CreateGroup(ctx, "test-group", "", []string{dest.ID}, nil)
	if err != nil {
		t.Fatalf("CreateGroup: %v", err)
	}

	matchLabels := []simplenotification.MatchLabel{{Name: "severity", Value: "critical"}}
	created, err := service.CreateRouting(ctx, "test-routing", "a test routing", "101122334455", group.ID, matchLabels, 1, []string{"env:test"})
	if err != nil {
		t.Fatalf("CreateRouting: %v", err)
	}
	if created.Name != "test-routing" {
		t.Errorf("Name = %q, want %q", created.Name, "test-routing")
	}
	if created.SourceID != "101122334455" {
		t.Errorf("SourceID = %q, want %q", created.SourceID, "101122334455")
	}
	if created.TargetGroupID != group.ID {
		t.Errorf("TargetGroupID = %q, want %q", created.TargetGroupID, group.ID)
	}
	if len(created.MatchLabels) != 1 || created.MatchLabels[0] != matchLabels[0] {
		t.Errorf("MatchLabels = %v, want %v", created.MatchLabels, matchLabels)
	}

	list, err := service.ListRoutings(ctx)
	if err != nil {
		t.Fatalf("ListRoutings: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("got %d routings, want 1: %+v", len(list), list)
	}

	got, err := service.GetRouting(ctx, created.ID)
	if err != nil {
		t.Fatalf("GetRouting: %v", err)
	}
	if got.Name != "test-routing" {
		t.Errorf("Name = %q, want %q", got.Name, "test-routing")
	}

	updated, err := service.UpdateRouting(ctx, created.ID, "updated-routing", "updated description", "101122334455", group.ID, matchLabels, 1, []string{"env:prod"})
	if err != nil {
		t.Fatalf("UpdateRouting: %v", err)
	}
	if updated.Name != "updated-routing" {
		t.Errorf("Name = %q, want %q", updated.Name, "updated-routing")
	}

	if err := service.DeleteRouting(ctx, created.ID); err != nil {
		t.Fatalf("DeleteRouting: %v", err)
	}

	list, err = service.ListRoutings(ctx)
	if err != nil {
		t.Fatalf("ListRoutings after delete: %v", err)
	}
	if len(list) != 0 {
		t.Fatalf("got %d routings after delete, want 0: %+v", len(list), list)
	}
}
