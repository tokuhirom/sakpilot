package apprunshared_test

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	mockapprun "github.com/sacloud/sakumock/apprun"

	"sakpilot/internal/apprunshared"
)

func writeUsacloudProfile(t *testing.T, accessToken, accessTokenSecret string) string {
	t.Helper()

	home := t.TempDir()
	t.Setenv("HOME", home)

	const profileName = "test-profile"
	dir := filepath.Join(home, ".usacloud", profileName)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}

	data, err := json.Marshal(map[string]string{
		"AccessToken":       accessToken,
		"AccessTokenSecret": accessTokenSecret,
	})
	if err != nil {
		t.Fatalf("Marshal: %v", err)
	}
	if err := os.WriteFile(filepath.Join(dir, "config.json"), data, 0o600); err != nil {
		t.Fatalf("WriteFile: %v", err)
	}

	return profileName
}

func TestService_ListApplications_Empty(t *testing.T) {
	srv := mockapprun.NewTestServer(mockapprun.Config{})
	defer srv.Close()

	t.Setenv("SAKURA_ENDPOINTS_APPRUN_SHARED", srv.TestURL())
	profileName := writeUsacloudProfile(t, "dummy", "dummy")

	service, err := apprunshared.NewService(profileName)
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}

	apps, err := service.ListApplications(context.Background())
	if err != nil {
		t.Fatalf("ListApplications: %v", err)
	}
	if len(apps) != 0 {
		t.Errorf("got %d applications, want 0: %+v", len(apps), apps)
	}
}

// TestService_HasUser_NoUser exercises the saclient.IsNotFoundError-based
// 404 handling that replaced apprun-api-go's HTTP-status check during the
// sacloud-sdk-go migration.
func TestService_HasUser_NoUser(t *testing.T) {
	srv := mockapprun.NewTestServer(mockapprun.Config{})
	defer srv.Close()

	t.Setenv("SAKURA_ENDPOINTS_APPRUN_SHARED", srv.TestURL())
	profileName := writeUsacloudProfile(t, "dummy", "dummy")

	service, err := apprunshared.NewService(profileName)
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}

	hasUser, err := service.HasUser(context.Background())
	if err != nil {
		t.Fatalf("HasUser: %v", err)
	}
	if hasUser {
		t.Error("HasUser = true, want false on a fresh mock server")
	}
}
