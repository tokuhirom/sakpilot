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

func TestService_CreateApplication(t *testing.T) {
	srv := mockapprun.NewTestServer(mockapprun.Config{})
	defer srv.Close()

	t.Setenv("SAKURA_ENDPOINTS_APPRUN_SHARED", srv.TestURL())
	profileName := writeUsacloudProfile(t, "dummy", "dummy")

	service, err := apprunshared.NewService(profileName)
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}

	app, err := service.CreateApplication(context.Background(), apprunshared.CreateApplicationParams{
		Name:           "test-app",
		Port:           80,
		MinScale:       0,
		MaxScale:       1,
		TimeoutSeconds: 60,
		ComponentName:  "component1",
		Image:          "docker.io/library/nginx:latest",
		MaxCPU:         "0.5",
		MaxMemory:      "1Gi",
	})
	if err != nil {
		t.Fatalf("CreateApplication: %v", err)
	}
	if app.Name != "test-app" {
		t.Errorf("Name = %q, want %q", app.Name, "test-app")
	}
	if app.Port != 80 || app.MinScale != 0 || app.MaxScale != 1 || app.TimeoutSeconds != 60 {
		t.Errorf("unexpected scale/port/timeout: %+v", app)
	}
	if len(app.Components) != 1 || app.Components[0].Image != "docker.io/library/nginx:latest" {
		t.Errorf("unexpected components: %+v", app.Components)
	}

	apps, err := service.ListApplications(context.Background())
	if err != nil {
		t.Fatalf("ListApplications: %v", err)
	}
	if len(apps) != 1 {
		t.Errorf("got %d applications, want 1", len(apps))
	}
}

func TestService_UpdateApplication(t *testing.T) {
	srv := mockapprun.NewTestServer(mockapprun.Config{})
	defer srv.Close()

	t.Setenv("SAKURA_ENDPOINTS_APPRUN_SHARED", srv.TestURL())
	profileName := writeUsacloudProfile(t, "dummy", "dummy")

	service, err := apprunshared.NewService(profileName)
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}

	created, err := service.CreateApplication(context.Background(), apprunshared.CreateApplicationParams{
		Name:           "test-app",
		Port:           80,
		MinScale:       0,
		MaxScale:       1,
		TimeoutSeconds: 60,
		ComponentName:  "component1",
		Image:          "docker.io/library/nginx:latest",
		MaxCPU:         "0.5",
		MaxMemory:      "1Gi",
	})
	if err != nil {
		t.Fatalf("CreateApplication: %v", err)
	}

	timeoutUpdated := 30
	maxScaleUpdated := 3
	updated, err := service.UpdateApplication(context.Background(), created.ID, apprunshared.UpdateApplicationParams{
		TimeoutSeconds: &timeoutUpdated,
		MaxScale:       &maxScaleUpdated,
	})
	if err != nil {
		t.Fatalf("UpdateApplication: %v", err)
	}
	if updated.TimeoutSeconds != timeoutUpdated {
		t.Errorf("TimeoutSeconds = %d, want %d", updated.TimeoutSeconds, timeoutUpdated)
	}
	if updated.MaxScale != maxScaleUpdated {
		t.Errorf("MaxScale = %d, want %d", updated.MaxScale, maxScaleUpdated)
	}
	if updated.Port != 80 {
		t.Errorf("Port = %d, want unchanged 80", updated.Port)
	}
}
