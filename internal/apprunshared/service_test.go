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

func TestService_DeleteApplication(t *testing.T) {
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

	if err := service.DeleteApplication(context.Background(), created.ID); err != nil {
		t.Fatalf("DeleteApplication: %v", err)
	}

	apps, err := service.ListApplications(context.Background())
	if err != nil {
		t.Fatalf("ListApplications: %v", err)
	}
	if len(apps) != 0 {
		t.Errorf("got %d applications after delete, want 0", len(apps))
	}
}

func TestService_DeleteVersion(t *testing.T) {
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

	// UpdateApplicationを2回呼ぶと新しいバージョンが都度作成される。
	// 最新版とトラフィック分散対象のバージョンは削除できないため、
	// 中間のバージョンを削除対象として作る。
	maxScale2 := 2
	if _, err := service.UpdateApplication(context.Background(), created.ID, apprunshared.UpdateApplicationParams{MaxScale: &maxScale2}); err != nil {
		t.Fatalf("UpdateApplication(1): %v", err)
	}
	maxScale3 := 3
	if _, err := service.UpdateApplication(context.Background(), created.ID, apprunshared.UpdateApplicationParams{MaxScale: &maxScale3}); err != nil {
		t.Fatalf("UpdateApplication(2): %v", err)
	}

	versions, err := service.ListVersions(context.Background(), created.ID)
	if err != nil {
		t.Fatalf("ListVersions: %v", err)
	}
	if len(versions) != 3 {
		t.Fatalf("got %d versions, want 3: %+v", len(versions), versions)
	}

	traffics, err := service.ListTraffics(context.Background(), created.ID)
	if err != nil {
		t.Fatalf("ListTraffics: %v", err)
	}
	if len(traffics) != 1 {
		t.Fatalf("got %d traffic entries, want 1: %+v", len(traffics), traffics)
	}
	trafficTargetName := traffics[0].VersionName

	// 3つ目に作ったバージョンのうち、トラフィック分散対象(作成直後のv1)以外の
	// 2つが削除の候補。作成時刻がすべて同一秒に丸められうるため、
	// どちらが「最新バージョン」判定されるかは保証されない。最新版は
	// 削除できないため、削除できる方を実際に試して確認する。
	var candidates []apprunshared.VersionInfo
	for _, v := range versions {
		if v.Name != trafficTargetName {
			candidates = append(candidates, v)
		}
	}
	if len(candidates) != 2 {
		t.Fatalf("got %d deletable candidates, want 2: %+v", len(candidates), candidates)
	}

	deletable := candidates[0]
	if err := service.DeleteVersion(context.Background(), created.ID, deletable.ID); err != nil {
		deletable = candidates[1]
		if err := service.DeleteVersion(context.Background(), created.ID, deletable.ID); err != nil {
			t.Fatalf("DeleteVersion: both candidates failed, last error: %v", err)
		}
	}

	remaining, err := service.ListVersions(context.Background(), created.ID)
	if err != nil {
		t.Fatalf("ListVersions after delete: %v", err)
	}
	if len(remaining) != 2 {
		t.Errorf("got %d versions after delete, want 2", len(remaining))
	}
	for _, v := range remaining {
		if v.ID == deletable.ID {
			t.Errorf("deleted version %s still present", deletable.ID)
		}
	}
}

func TestService_UpdateTraffics(t *testing.T) {
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

	maxScale2 := 2
	if _, err := service.UpdateApplication(context.Background(), created.ID, apprunshared.UpdateApplicationParams{MaxScale: &maxScale2}); err != nil {
		t.Fatalf("UpdateApplication: %v", err)
	}

	versions, err := service.ListVersions(context.Background(), created.ID)
	if err != nil {
		t.Fatalf("ListVersions: %v", err)
	}
	if len(versions) != 2 {
		t.Fatalf("got %d versions, want 2: %+v", len(versions), versions)
	}
	oldest := versions[1]

	traffics, err := service.UpdateTraffics(context.Background(), created.ID, []apprunshared.UpdateTrafficParams{
		{IsLatestVersion: true, Percent: 70},
		{VersionName: oldest.Name, Percent: 30},
	})
	if err != nil {
		t.Fatalf("UpdateTraffics: %v", err)
	}
	if len(traffics) != 2 {
		t.Fatalf("got %d traffic entries, want 2: %+v", len(traffics), traffics)
	}

	var latestPercent, oldestPercent int
	for _, tr := range traffics {
		if tr.IsLatestVersion {
			latestPercent = tr.Percent
		}
		if tr.VersionName == oldest.Name {
			oldestPercent = tr.Percent
		}
	}
	if latestPercent != 70 {
		t.Errorf("latest version percent = %d, want 70", latestPercent)
	}
	if oldestPercent != 30 {
		t.Errorf("oldest version percent = %d, want 30", oldestPercent)
	}
}

func TestService_CreateUser(t *testing.T) {
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
		t.Fatal("HasUser = true before CreateUser, want false")
	}

	if err := service.CreateUser(context.Background()); err != nil {
		t.Fatalf("CreateUser: %v", err)
	}

	hasUser, err = service.HasUser(context.Background())
	if err != nil {
		t.Fatalf("HasUser after CreateUser: %v", err)
	}
	if !hasUser {
		t.Error("HasUser = false after CreateUser, want true")
	}
}
