package simplemq_test

import (
	"context"
	"testing"

	mocksimplemq "github.com/sacloud/sakumock/simplemq"

	"sakpilot/internal/simplemq"
)

func newTestService(t *testing.T, endpoint string) *simplemq.Service {
	t.Helper()

	t.Setenv("SAKURA_ACCESS_TOKEN", "dummy")
	t.Setenv("SAKURA_ACCESS_TOKEN_SECRET", "dummy")
	t.Setenv("SAKURA_ENDPOINTS_SIMPLE_MQ_QUEUE", endpoint)
	t.Setenv("SAKURA_ENDPOINTS_SIMPLE_MQ_MESSAGE", endpoint)

	profileName := writeUsacloudProfile(t, "dummy", "dummy")

	service, err := simplemq.NewService(profileName)
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}
	return service
}

func TestService_CreateQueue(t *testing.T) {
	srv := mocksimplemq.NewTestServer(mocksimplemq.Config{})
	defer srv.Close()

	service := newTestService(t, srv.TestURL())

	got, err := service.CreateQueue(context.Background(), "test-queue", "a test queue", []string{"env:test"})
	if err != nil {
		t.Fatalf("CreateQueue: %v", err)
	}
	if got.Name != "test-queue" {
		t.Errorf("Name = %q, want %q", got.Name, "test-queue")
	}
	if got.Description != "a test queue" {
		t.Errorf("Description = %q, want %q", got.Description, "a test queue")
	}
	if len(got.Tags) != 1 || got.Tags[0] != "env:test" {
		t.Errorf("Tags = %v, want [env:test]", got.Tags)
	}
	if got.ID == "" {
		t.Error("ID is empty")
	}
}

func TestService_ListQueues(t *testing.T) {
	srv := mocksimplemq.NewTestServer(mocksimplemq.Config{})
	defer srv.Close()

	service := newTestService(t, srv.TestURL())

	if _, err := service.CreateQueue(context.Background(), "test-queue", "", nil); err != nil {
		t.Fatalf("CreateQueue: %v", err)
	}

	queues, err := service.ListQueues(context.Background())
	if err != nil {
		t.Fatalf("ListQueues: %v", err)
	}
	if len(queues) != 1 {
		t.Fatalf("got %d queues, want 1: %+v", len(queues), queues)
	}
	if queues[0].Name != "test-queue" {
		t.Errorf("Name = %q, want %q", queues[0].Name, "test-queue")
	}
}

func TestService_GetQueue(t *testing.T) {
	srv := mocksimplemq.NewTestServer(mocksimplemq.Config{})
	defer srv.Close()

	service := newTestService(t, srv.TestURL())

	created, err := service.CreateQueue(context.Background(), "test-queue", "", nil)
	if err != nil {
		t.Fatalf("CreateQueue: %v", err)
	}

	got, err := service.GetQueue(context.Background(), created.ID)
	if err != nil {
		t.Fatalf("GetQueue: %v", err)
	}
	if got.Name != "test-queue" {
		t.Errorf("Name = %q, want %q", got.Name, "test-queue")
	}
}

func TestService_ConfigQueue(t *testing.T) {
	srv := mocksimplemq.NewTestServer(mocksimplemq.Config{})
	defer srv.Close()

	service := newTestService(t, srv.TestURL())

	created, err := service.CreateQueue(context.Background(), "test-queue", "", nil)
	if err != nil {
		t.Fatalf("CreateQueue: %v", err)
	}

	got, err := service.ConfigQueue(context.Background(), created.ID, "updated description", 60, 3600, []string{"env:prod"})
	if err != nil {
		t.Fatalf("ConfigQueue: %v", err)
	}
	if got.Description != "updated description" {
		t.Errorf("Description = %q, want %q", got.Description, "updated description")
	}
	if got.VisibilityTimeoutSeconds != 60 {
		t.Errorf("VisibilityTimeoutSeconds = %d, want 60", got.VisibilityTimeoutSeconds)
	}
	if got.ExpireSeconds != 3600 {
		t.Errorf("ExpireSeconds = %d, want 3600", got.ExpireSeconds)
	}
	if len(got.Tags) != 1 || got.Tags[0] != "env:prod" {
		t.Errorf("Tags = %v, want [env:prod]", got.Tags)
	}
}

func TestService_DeleteQueue(t *testing.T) {
	srv := mocksimplemq.NewTestServer(mocksimplemq.Config{})
	defer srv.Close()

	service := newTestService(t, srv.TestURL())

	created, err := service.CreateQueue(context.Background(), "test-queue", "", nil)
	if err != nil {
		t.Fatalf("CreateQueue: %v", err)
	}

	if err := service.DeleteQueue(context.Background(), created.ID); err != nil {
		t.Fatalf("DeleteQueue: %v", err)
	}

	queues, err := service.ListQueues(context.Background())
	if err != nil {
		t.Fatalf("ListQueues: %v", err)
	}
	if len(queues) != 0 {
		t.Fatalf("got %d queues after delete, want 0: %+v", len(queues), queues)
	}
}

func TestService_RotateAPIKeyAndMessageLifecycle(t *testing.T) {
	srv := mocksimplemq.NewTestServer(mocksimplemq.Config{})
	defer srv.Close()

	service := newTestService(t, srv.TestURL())

	created, err := service.CreateQueue(context.Background(), "test-queue", "", nil)
	if err != nil {
		t.Fatalf("CreateQueue: %v", err)
	}

	apiKey, err := service.RotateAPIKey(context.Background(), created.ID)
	if err != nil {
		t.Fatalf("RotateAPIKey: %v", err)
	}
	if apiKey == "" {
		t.Fatal("RotateAPIKey returned an empty key")
	}

	sent, err := service.SendMessage(context.Background(), created.Name, apiKey, "hello world")
	if err != nil {
		t.Fatalf("SendMessage: %v", err)
	}
	if sent.Content != "hello world" {
		t.Errorf("Content = %q, want %q", sent.Content, "hello world")
	}

	count, err := service.CountMessages(context.Background(), created.ID)
	if err != nil {
		t.Fatalf("CountMessages: %v", err)
	}
	if count != 1 {
		t.Fatalf("CountMessages = %d, want 1", count)
	}

	received, err := service.ReceiveMessages(context.Background(), created.Name, apiKey)
	if err != nil {
		t.Fatalf("ReceiveMessages: %v", err)
	}
	if len(received) != 1 {
		t.Fatalf("got %d messages, want 1: %+v", len(received), received)
	}
	if received[0].ID != sent.ID {
		t.Errorf("ID = %q, want %q", received[0].ID, sent.ID)
	}

	extended, err := service.ExtendMessageTimeout(context.Background(), created.Name, apiKey, received[0].ID)
	if err != nil {
		t.Fatalf("ExtendMessageTimeout: %v", err)
	}
	if extended.ID != sent.ID {
		t.Errorf("ID = %q, want %q", extended.ID, sent.ID)
	}

	if err := service.DeleteMessage(context.Background(), created.Name, apiKey, received[0].ID); err != nil {
		t.Fatalf("DeleteMessage: %v", err)
	}

	count, err = service.CountMessages(context.Background(), created.ID)
	if err != nil {
		t.Fatalf("CountMessages after delete: %v", err)
	}
	if count != 0 {
		t.Fatalf("CountMessages after delete = %d, want 0", count)
	}
}

func TestService_ClearMessages(t *testing.T) {
	srv := mocksimplemq.NewTestServer(mocksimplemq.Config{})
	defer srv.Close()

	service := newTestService(t, srv.TestURL())

	created, err := service.CreateQueue(context.Background(), "test-queue", "", nil)
	if err != nil {
		t.Fatalf("CreateQueue: %v", err)
	}

	apiKey, err := service.RotateAPIKey(context.Background(), created.ID)
	if err != nil {
		t.Fatalf("RotateAPIKey: %v", err)
	}

	if _, err := service.SendMessage(context.Background(), created.Name, apiKey, "hello"); err != nil {
		t.Fatalf("SendMessage: %v", err)
	}

	if err := service.ClearMessages(context.Background(), created.ID); err != nil {
		t.Fatalf("ClearMessages: %v", err)
	}

	count, err := service.CountMessages(context.Background(), created.ID)
	if err != nil {
		t.Fatalf("CountMessages: %v", err)
	}
	if count != 0 {
		t.Fatalf("CountMessages after clear = %d, want 0", count)
	}
}
