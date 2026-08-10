package secretmanager_test

import (
	"context"
	"testing"

	sdksm "github.com/sacloud/sacloud-sdk-go/api/secretmanager"
	v1 "github.com/sacloud/sacloud-sdk-go/api/secretmanager/apis/v1"
	"github.com/sacloud/sacloud-sdk-go/common/saclient"
	mocksm "github.com/sacloud/sakumock/secretmanager"

	"sakpilot/internal/secretmanager"
)

// newTestSaclient builds a saclient.Client pointed at the sakumock
// secretmanager test server, mirroring how internal/secretmanager.Service
// authenticates in production.
func newTestSaclient(t *testing.T, endpoint string) *saclient.Client {
	t.Helper()
	var sc saclient.Client
	if err := sc.SetEnviron([]string{
		"SAKURA_ACCESS_TOKEN=dummy",
		"SAKURA_ACCESS_TOKEN_SECRET=dummy",
		"SAKURA_ENDPOINTS_SECRETMANAGER=" + endpoint,
	}); err != nil {
		t.Fatalf("SetEnviron: %v", err)
	}
	return &sc
}

func TestService_ListVaults(t *testing.T) {
	srv := mocksm.NewTestServer(mocksm.Config{})
	defer srv.Close()

	sc := newTestSaclient(t, srv.TestURL())
	rawClient, err := sdksm.NewClient(sc)
	if err != nil {
		t.Fatalf("sdksm.NewClient: %v", err)
	}
	vaultOp := sdksm.NewVaultOp(rawClient)
	created, err := vaultOp.Create(context.Background(), v1.CreateVault{
		Name:        "test-vault",
		Description: v1.NewOptString("a test vault"),
		KmsKeyID:    "990000000123",
		Tags:        []string{"env:test"},
	})
	if err != nil {
		t.Fatalf("seed Create: %v", err)
	}

	profileName := writeUsacloudProfile(t, "dummy", "dummy")
	t.Setenv("SAKURA_ENDPOINTS_SECRETMANAGER", srv.TestURL())

	service, err := secretmanager.NewService(profileName)
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}

	vaults, err := service.ListVaults(context.Background())
	if err != nil {
		t.Fatalf("ListVaults: %v", err)
	}
	if len(vaults) != 1 {
		t.Fatalf("got %d vaults, want 1: %+v", len(vaults), vaults)
	}

	got := vaults[0]
	if got.ID != created.ID {
		t.Errorf("ID = %q, want %q", got.ID, created.ID)
	}
	if got.Name != "test-vault" {
		t.Errorf("Name = %q, want %q", got.Name, "test-vault")
	}
	if got.KmsKeyID != "990000000123" {
		t.Errorf("KmsKeyID = %q, want %q", got.KmsKeyID, "990000000123")
	}
	if len(got.Tags) != 1 || got.Tags[0] != "env:test" {
		t.Errorf("Tags = %v, want [env:test]", got.Tags)
	}
}

func TestService_GetVault(t *testing.T) {
	srv := mocksm.NewTestServer(mocksm.Config{})
	defer srv.Close()

	sc := newTestSaclient(t, srv.TestURL())
	rawClient, err := sdksm.NewClient(sc)
	if err != nil {
		t.Fatalf("sdksm.NewClient: %v", err)
	}
	vaultOp := sdksm.NewVaultOp(rawClient)
	created, err := vaultOp.Create(context.Background(), v1.CreateVault{
		Name:     "test-vault",
		KmsKeyID: "990000000123",
	})
	if err != nil {
		t.Fatalf("seed Create: %v", err)
	}

	profileName := writeUsacloudProfile(t, "dummy", "dummy")
	t.Setenv("SAKURA_ENDPOINTS_SECRETMANAGER", srv.TestURL())

	service, err := secretmanager.NewService(profileName)
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}

	got, err := service.GetVault(context.Background(), created.ID)
	if err != nil {
		t.Fatalf("GetVault: %v", err)
	}
	if got.ID != created.ID {
		t.Errorf("ID = %q, want %q", got.ID, created.ID)
	}
	if got.Name != "test-vault" {
		t.Errorf("Name = %q, want %q", got.Name, "test-vault")
	}
}

func TestService_CreateVault(t *testing.T) {
	srv := mocksm.NewTestServer(mocksm.Config{})
	defer srv.Close()

	profileName := writeUsacloudProfile(t, "dummy", "dummy")
	t.Setenv("SAKURA_ENDPOINTS_SECRETMANAGER", srv.TestURL())

	service, err := secretmanager.NewService(profileName)
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}

	got, err := service.CreateVault(context.Background(), "test-vault", "a test vault", "990000000123", []string{"env:test"})
	if err != nil {
		t.Fatalf("CreateVault: %v", err)
	}
	if got.Name != "test-vault" {
		t.Errorf("Name = %q, want %q", got.Name, "test-vault")
	}
	if got.Description != "a test vault" {
		t.Errorf("Description = %q, want %q", got.Description, "a test vault")
	}
	if got.KmsKeyID != "990000000123" {
		t.Errorf("KmsKeyID = %q, want %q", got.KmsKeyID, "990000000123")
	}
	if len(got.Tags) != 1 || got.Tags[0] != "env:test" {
		t.Errorf("Tags = %v, want [env:test]", got.Tags)
	}

	vaults, err := service.ListVaults(context.Background())
	if err != nil {
		t.Fatalf("ListVaults: %v", err)
	}
	if len(vaults) != 1 {
		t.Fatalf("got %d vaults after create, want 1: %+v", len(vaults), vaults)
	}
}

func TestService_UpdateVault(t *testing.T) {
	srv := mocksm.NewTestServer(mocksm.Config{})
	defer srv.Close()

	sc := newTestSaclient(t, srv.TestURL())
	rawClient, err := sdksm.NewClient(sc)
	if err != nil {
		t.Fatalf("sdksm.NewClient: %v", err)
	}
	vaultOp := sdksm.NewVaultOp(rawClient)
	created, err := vaultOp.Create(context.Background(), v1.CreateVault{
		Name:     "test-vault",
		KmsKeyID: "990000000123",
	})
	if err != nil {
		t.Fatalf("seed Create: %v", err)
	}

	profileName := writeUsacloudProfile(t, "dummy", "dummy")
	t.Setenv("SAKURA_ENDPOINTS_SECRETMANAGER", srv.TestURL())

	service, err := secretmanager.NewService(profileName)
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}

	got, err := service.UpdateVault(context.Background(), created.ID, "test-vault-renamed", "updated description", []string{"env:prod"})
	if err != nil {
		t.Fatalf("UpdateVault: %v", err)
	}
	if got.Name != "test-vault-renamed" {
		t.Errorf("Name = %q, want %q", got.Name, "test-vault-renamed")
	}
	if got.Description != "updated description" {
		t.Errorf("Description = %q, want %q", got.Description, "updated description")
	}
	if got.KmsKeyID != "990000000123" {
		t.Errorf("KmsKeyID = %q, want %q (should be preserved)", got.KmsKeyID, "990000000123")
	}
	if len(got.Tags) != 1 || got.Tags[0] != "env:prod" {
		t.Errorf("Tags = %v, want [env:prod]", got.Tags)
	}
}

func TestService_DeleteVault(t *testing.T) {
	srv := mocksm.NewTestServer(mocksm.Config{})
	defer srv.Close()

	sc := newTestSaclient(t, srv.TestURL())
	rawClient, err := sdksm.NewClient(sc)
	if err != nil {
		t.Fatalf("sdksm.NewClient: %v", err)
	}
	vaultOp := sdksm.NewVaultOp(rawClient)
	created, err := vaultOp.Create(context.Background(), v1.CreateVault{
		Name:     "test-vault",
		KmsKeyID: "990000000123",
	})
	if err != nil {
		t.Fatalf("seed Create: %v", err)
	}

	profileName := writeUsacloudProfile(t, "dummy", "dummy")
	t.Setenv("SAKURA_ENDPOINTS_SECRETMANAGER", srv.TestURL())

	service, err := secretmanager.NewService(profileName)
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}

	if err := service.DeleteVault(context.Background(), created.ID); err != nil {
		t.Fatalf("DeleteVault: %v", err)
	}

	vaults, err := service.ListVaults(context.Background())
	if err != nil {
		t.Fatalf("ListVaults: %v", err)
	}
	if len(vaults) != 0 {
		t.Fatalf("got %d vaults after delete, want 0: %+v", len(vaults), vaults)
	}
}

func TestService_SecretLifecycle(t *testing.T) {
	srv := mocksm.NewTestServer(mocksm.Config{})
	defer srv.Close()

	sc := newTestSaclient(t, srv.TestURL())
	rawClient, err := sdksm.NewClient(sc)
	if err != nil {
		t.Fatalf("sdksm.NewClient: %v", err)
	}
	vaultOp := sdksm.NewVaultOp(rawClient)
	vault, err := vaultOp.Create(context.Background(), v1.CreateVault{
		Name:     "test-vault",
		KmsKeyID: "990000000123",
	})
	if err != nil {
		t.Fatalf("seed vault Create: %v", err)
	}

	profileName := writeUsacloudProfile(t, "dummy", "dummy")
	t.Setenv("SAKURA_ENDPOINTS_SECRETMANAGER", srv.TestURL())

	service, err := secretmanager.NewService(profileName)
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}

	ctx := context.Background()

	secrets, err := service.ListSecrets(ctx, vault.ID)
	if err != nil {
		t.Fatalf("ListSecrets (empty): %v", err)
	}
	if len(secrets) != 0 {
		t.Fatalf("got %d secrets, want 0: %+v", len(secrets), secrets)
	}

	setResult, err := service.SetSecret(ctx, vault.ID, "api-key", "v1-value")
	if err != nil {
		t.Fatalf("SetSecret (v1): %v", err)
	}
	if setResult.Name != "api-key" || setResult.LatestVersion != 1 {
		t.Errorf("SetSecret (v1) = %+v, want {api-key 1}", setResult)
	}

	setResult, err = service.SetSecret(ctx, vault.ID, "api-key", "v2-value")
	if err != nil {
		t.Fatalf("SetSecret (v2): %v", err)
	}
	if setResult.LatestVersion != 2 {
		t.Errorf("SetSecret (v2) LatestVersion = %d, want 2", setResult.LatestVersion)
	}

	secrets, err = service.ListSecrets(ctx, vault.ID)
	if err != nil {
		t.Fatalf("ListSecrets: %v", err)
	}
	if len(secrets) != 1 {
		t.Fatalf("got %d secrets, want 1: %+v", len(secrets), secrets)
	}
	if secrets[0].Name != "api-key" || secrets[0].LatestVersion != 2 {
		t.Errorf("secrets[0] = %+v, want {api-key 2}", secrets[0])
	}

	latest, err := service.UnveilSecret(ctx, vault.ID, "api-key", 0)
	if err != nil {
		t.Fatalf("UnveilSecret (latest): %v", err)
	}
	if latest.Value != "v2-value" {
		t.Errorf("UnveilSecret (latest) Value = %q, want %q", latest.Value, "v2-value")
	}

	v1Value, err := service.UnveilSecret(ctx, vault.ID, "api-key", 1)
	if err != nil {
		t.Fatalf("UnveilSecret (v1): %v", err)
	}
	if v1Value.Value != "v1-value" {
		t.Errorf("UnveilSecret (v1) Value = %q, want %q", v1Value.Value, "v1-value")
	}

	if err := service.DeleteSecret(ctx, vault.ID, "api-key"); err != nil {
		t.Fatalf("DeleteSecret: %v", err)
	}

	secrets, err = service.ListSecrets(ctx, vault.ID)
	if err != nil {
		t.Fatalf("ListSecrets (after delete): %v", err)
	}
	if len(secrets) != 0 {
		t.Fatalf("got %d secrets after delete, want 0: %+v", len(secrets), secrets)
	}
}
