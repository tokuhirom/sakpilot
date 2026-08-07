package kms_test

import (
	"context"
	"testing"

	sdkkms "github.com/sacloud/sacloud-sdk-go/api/kms"
	v1 "github.com/sacloud/sacloud-sdk-go/api/kms/apis/v1"
	"github.com/sacloud/sacloud-sdk-go/common/saclient"
	mockkms "github.com/sacloud/sakumock/kms"

	"sakpilot/internal/kms"
)

// newTestSaclient builds a saclient.Client pointed at the sakumock KMS test
// server, mirroring how internal/kms.Service authenticates in production.
func newTestSaclient(t *testing.T, endpoint string) *saclient.Client {
	t.Helper()
	var sc saclient.Client
	if err := sc.SetEnviron([]string{
		"SAKURA_ACCESS_TOKEN=dummy",
		"SAKURA_ACCESS_TOKEN_SECRET=dummy",
		"SAKURA_ENDPOINTS_KMS=" + endpoint,
	}); err != nil {
		t.Fatalf("SetEnviron: %v", err)
	}
	return &sc
}

func TestService_ListKeys(t *testing.T) {
	srv := mockkms.NewTestServer(mockkms.Config{})
	defer srv.Close()

	t.Setenv("SAKURA_ACCESS_TOKEN", "dummy")
	t.Setenv("SAKURA_ACCESS_TOKEN_SECRET", "dummy")
	t.Setenv("SAKURA_ENDPOINTS_KMS", srv.TestURL())

	// Seed a key directly through the SDK, bypassing internal/kms.Service
	// (which only exposes read operations), so ListKeys has something to map.
	sc := newTestSaclient(t, srv.TestURL())
	rawClient, err := sdkkms.NewClient(sc)
	if err != nil {
		t.Fatalf("sdkkms.NewClient: %v", err)
	}
	keyOp := sdkkms.NewKeyOp(rawClient)
	created, err := keyOp.Create(context.Background(), v1.CreateKey{
		Name:      "test-key",
		KeyOrigin: v1.KeyOriginEnumGenerated,
		Tags:      []string{"env:test"},
	})
	if err != nil {
		t.Fatalf("seed Create: %v", err)
	}

	// internal/kms.Service reads credentials from a usacloud-compatible
	// profile file, so point HOME at a throwaway profile for NewService.
	profileName := writeUsacloudProfile(t, "dummy", "dummy")

	service, err := kms.NewService(profileName)
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}

	keys, err := service.ListKeys(context.Background())
	if err != nil {
		t.Fatalf("ListKeys: %v", err)
	}
	if len(keys) != 1 {
		t.Fatalf("got %d keys, want 1: %+v", len(keys), keys)
	}

	got := keys[0]
	if got.ID != created.ID {
		t.Errorf("ID = %q, want %q", got.ID, created.ID)
	}
	if got.Name != "test-key" {
		t.Errorf("Name = %q, want %q", got.Name, "test-key")
	}
	if got.KeyOrigin != "generated" {
		t.Errorf("KeyOrigin = %q, want %q", got.KeyOrigin, "generated")
	}
	if len(got.Tags) != 1 || got.Tags[0] != "env:test" {
		t.Errorf("Tags = %v, want [env:test]", got.Tags)
	}
	if got.CreatedAt == "" {
		t.Error("CreatedAt is empty, want a formatted timestamp")
	}
}

func TestService_DeleteKey(t *testing.T) {
	srv := mockkms.NewTestServer(mockkms.Config{})
	defer srv.Close()

	t.Setenv("SAKURA_ACCESS_TOKEN", "dummy")
	t.Setenv("SAKURA_ACCESS_TOKEN_SECRET", "dummy")
	t.Setenv("SAKURA_ENDPOINTS_KMS", srv.TestURL())

	sc := newTestSaclient(t, srv.TestURL())
	rawClient, err := sdkkms.NewClient(sc)
	if err != nil {
		t.Fatalf("sdkkms.NewClient: %v", err)
	}
	keyOp := sdkkms.NewKeyOp(rawClient)
	created, err := keyOp.Create(context.Background(), v1.CreateKey{
		Name:      "test-key",
		KeyOrigin: v1.KeyOriginEnumGenerated,
	})
	if err != nil {
		t.Fatalf("seed Create: %v", err)
	}

	profileName := writeUsacloudProfile(t, "dummy", "dummy")

	service, err := kms.NewService(profileName)
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}

	if err := service.DeleteKey(context.Background(), created.ID); err != nil {
		t.Fatalf("DeleteKey: %v", err)
	}

	keys, err := service.ListKeys(context.Background())
	if err != nil {
		t.Fatalf("ListKeys: %v", err)
	}
	if len(keys) != 0 {
		t.Fatalf("got %d keys after delete, want 0: %+v", len(keys), keys)
	}
}

func TestService_GetKey(t *testing.T) {
	srv := mockkms.NewTestServer(mockkms.Config{})
	defer srv.Close()

	t.Setenv("SAKURA_ACCESS_TOKEN", "dummy")
	t.Setenv("SAKURA_ACCESS_TOKEN_SECRET", "dummy")
	t.Setenv("SAKURA_ENDPOINTS_KMS", srv.TestURL())

	sc := newTestSaclient(t, srv.TestURL())
	rawClient, err := sdkkms.NewClient(sc)
	if err != nil {
		t.Fatalf("sdkkms.NewClient: %v", err)
	}
	keyOp := sdkkms.NewKeyOp(rawClient)
	created, err := keyOp.Create(context.Background(), v1.CreateKey{
		Name:        "test-key",
		Description: v1.NewOptString("a test key"),
		KeyOrigin:   v1.KeyOriginEnumGenerated,
	})
	if err != nil {
		t.Fatalf("seed Create: %v", err)
	}

	profileName := writeUsacloudProfile(t, "dummy", "dummy")

	service, err := kms.NewService(profileName)
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}

	got, err := service.GetKey(context.Background(), created.ID)
	if err != nil {
		t.Fatalf("GetKey: %v", err)
	}
	if got.ID != created.ID {
		t.Errorf("ID = %q, want %q", got.ID, created.ID)
	}
	if got.Name != "test-key" {
		t.Errorf("Name = %q, want %q", got.Name, "test-key")
	}
	if got.Description != "a test key" {
		t.Errorf("Description = %q, want %q", got.Description, "a test key")
	}
}

func TestService_RotateKey(t *testing.T) {
	srv := mockkms.NewTestServer(mockkms.Config{})
	defer srv.Close()

	t.Setenv("SAKURA_ACCESS_TOKEN", "dummy")
	t.Setenv("SAKURA_ACCESS_TOKEN_SECRET", "dummy")
	t.Setenv("SAKURA_ENDPOINTS_KMS", srv.TestURL())

	sc := newTestSaclient(t, srv.TestURL())
	rawClient, err := sdkkms.NewClient(sc)
	if err != nil {
		t.Fatalf("sdkkms.NewClient: %v", err)
	}
	keyOp := sdkkms.NewKeyOp(rawClient)
	created, err := keyOp.Create(context.Background(), v1.CreateKey{
		Name:      "test-key",
		KeyOrigin: v1.KeyOriginEnumGenerated,
	})
	if err != nil {
		t.Fatalf("seed Create: %v", err)
	}

	profileName := writeUsacloudProfile(t, "dummy", "dummy")

	service, err := kms.NewService(profileName)
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}

	got, err := service.RotateKey(context.Background(), created.ID)
	if err != nil {
		t.Fatalf("RotateKey: %v", err)
	}
	if got.LatestVersion != 2 {
		t.Errorf("LatestVersion = %d, want 2", got.LatestVersion)
	}
}

func TestService_ChangeKeyStatus(t *testing.T) {
	srv := mockkms.NewTestServer(mockkms.Config{})
	defer srv.Close()

	t.Setenv("SAKURA_ACCESS_TOKEN", "dummy")
	t.Setenv("SAKURA_ACCESS_TOKEN_SECRET", "dummy")
	t.Setenv("SAKURA_ENDPOINTS_KMS", srv.TestURL())

	sc := newTestSaclient(t, srv.TestURL())
	rawClient, err := sdkkms.NewClient(sc)
	if err != nil {
		t.Fatalf("sdkkms.NewClient: %v", err)
	}
	keyOp := sdkkms.NewKeyOp(rawClient)
	created, err := keyOp.Create(context.Background(), v1.CreateKey{
		Name:      "test-key",
		KeyOrigin: v1.KeyOriginEnumGenerated,
	})
	if err != nil {
		t.Fatalf("seed Create: %v", err)
	}

	profileName := writeUsacloudProfile(t, "dummy", "dummy")

	service, err := kms.NewService(profileName)
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}

	if err := service.ChangeKeyStatus(context.Background(), created.ID, "suspended"); err != nil {
		t.Fatalf("ChangeKeyStatus: %v", err)
	}

	got, err := service.GetKey(context.Background(), created.ID)
	if err != nil {
		t.Fatalf("GetKey: %v", err)
	}
	if got.Status != "suspended" {
		t.Errorf("Status = %q, want %q", got.Status, "suspended")
	}
}
