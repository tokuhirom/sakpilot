package apprun_test

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/google/uuid"
	sdkapprundedicated "github.com/sacloud/sacloud-sdk-go/api/apprun-dedicated"
	v1 "github.com/sacloud/sacloud-sdk-go/api/apprun-dedicated/apis/v1"
	"github.com/sacloud/sacloud-sdk-go/api/apprun-dedicated/apis/version"
	"github.com/sacloud/sacloud-sdk-go/common/saclient"
	mockapprundedicated "github.com/sacloud/sakumock/apprundedicated"

	"sakpilot/internal/apprun"
)

// writeUsacloudProfile creates a throwaway ~/.usacloud/<name>/config.json
// under a temp HOME, mirroring how apprun.NewService(profileName) resolves
// credentials in production. Returns the profile name to pass to NewService.
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

// newTestSaclient builds a saclient.Client pointed at the sakumock AppRun
// Dedicated test server, mirroring how internal/apprun.Service authenticates
// in production.
func newTestSaclient(t *testing.T, endpoint string) *saclient.Client {
	t.Helper()
	var sc saclient.Client
	if err := sc.SetEnviron([]string{
		"SAKURA_ACCESS_TOKEN=dummy",
		"SAKURA_ACCESS_TOKEN_SECRET=dummy",
		"SAKURA_ENDPOINTS_APPRUN_DEDICATED=" + endpoint,
	}); err != nil {
		t.Fatalf("SetEnviron: %v", err)
	}
	return &sc
}

// seedCluster creates a cluster directly through the SDK, bypassing
// internal/apprun.Service (which only exposes read operations), so the
// service methods under test have something to list.
func seedCluster(t *testing.T, ctx context.Context, client *v1.Client) v1.ClusterID {
	t.Helper()
	resp, err := client.CreateCluster(ctx, &v1.CreateCluster{
		Name:               "test-cluster",
		ServicePrincipalID: "123456789012",
		Ports: []v1.CreateLoadBalancerPort{
			{Port: 443, Protocol: v1.CreateLoadBalancerPortProtocolHTTPS},
		},
	})
	if err != nil {
		t.Fatalf("seed CreateCluster: %v", err)
	}
	return resp.Cluster.GetClusterID()
}

// seedApplication creates an application directly through the SDK.
func seedApplication(t *testing.T, ctx context.Context, client *v1.Client, clusterID v1.ClusterID) v1.ApplicationID {
	t.Helper()
	resp, err := client.CreateApplication(ctx, &v1.CreateApplication{
		Name:      "test-app",
		ClusterID: clusterID,
	})
	if err != nil {
		t.Fatalf("seed CreateApplication: %v", err)
	}
	return resp.Application.GetApplicationID()
}

func newRawClient(t *testing.T, endpoint string) *v1.Client {
	t.Helper()
	sc := newTestSaclient(t, endpoint)
	client, err := sdkapprundedicated.NewClient(sc)
	if err != nil {
		t.Fatalf("sdkapprundedicated.NewClient: %v", err)
	}
	return client
}

func TestService_ListClusters(t *testing.T) {
	srv := mockapprundedicated.NewTestServer(mockapprundedicated.Config{})
	defer srv.Close()
	ctx := context.Background()

	clusterID := seedCluster(t, ctx, newRawClient(t, srv.TestURL()))

	profileName := writeUsacloudProfile(t, "dummy", "dummy")
	t.Setenv("SAKURA_ENDPOINTS_APPRUN_DEDICATED", srv.TestURL())

	service, err := apprun.NewService(profileName)
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}

	clusters, err := service.ListClusters(ctx)
	if err != nil {
		t.Fatalf("ListClusters: %v", err)
	}
	if len(clusters) != 1 {
		t.Fatalf("got %d clusters, want 1: %+v", len(clusters), clusters)
	}
	if clusters[0].ID != uuid.UUID(clusterID).String() {
		t.Errorf("ID = %q, want %q", clusters[0].ID, uuid.UUID(clusterID).String())
	}
	if clusters[0].Name != "test-cluster" {
		t.Errorf("Name = %q, want %q", clusters[0].Name, "test-cluster")
	}
}

func TestService_ListApplications_FilteredByCluster(t *testing.T) {
	srv := mockapprundedicated.NewTestServer(mockapprundedicated.Config{})
	defer srv.Close()
	ctx := context.Background()
	rawClient := newRawClient(t, srv.TestURL())

	clusterID := seedCluster(t, ctx, rawClient)
	otherClusterID := seedCluster(t, ctx, rawClient)
	appID := seedApplication(t, ctx, rawClient, clusterID)
	_ = seedApplication(t, ctx, rawClient, otherClusterID)

	profileName := writeUsacloudProfile(t, "dummy", "dummy")
	t.Setenv("SAKURA_ENDPOINTS_APPRUN_DEDICATED", srv.TestURL())

	service, err := apprun.NewService(profileName)
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}

	apps, err := service.ListApplications(ctx, uuid.UUID(clusterID).String())
	if err != nil {
		t.Fatalf("ListApplications: %v", err)
	}
	if len(apps) != 1 {
		t.Fatalf("got %d applications, want 1: %+v", len(apps), apps)
	}
	if apps[0].ID != uuid.UUID(appID).String() {
		t.Errorf("ID = %q, want %q", apps[0].ID, uuid.UUID(appID).String())
	}
	if apps[0].ClusterID != uuid.UUID(clusterID).String() {
		t.Errorf("ClusterID = %q, want %q", apps[0].ClusterID, uuid.UUID(clusterID).String())
	}

	all, err := service.ListApplications(ctx, "")
	if err != nil {
		t.Fatalf("ListApplications (unfiltered): %v", err)
	}
	if len(all) != 2 {
		t.Fatalf("got %d applications unfiltered, want 2: %+v", len(all), all)
	}
}

func TestService_ApplicationVersionLifecycle(t *testing.T) {
	srv := mockapprundedicated.NewTestServer(mockapprundedicated.Config{})
	defer srv.Close()
	ctx := context.Background()
	rawClient := newRawClient(t, srv.TestURL())

	clusterID := seedCluster(t, ctx, rawClient)
	appID := seedApplication(t, ctx, rawClient, clusterID)

	versionOp := sdkapprundedicated.NewVersionOp(rawClient, appID)
	created, err := versionOp.Create(ctx, version.CreateParams{
		Image:                  "nginx:latest",
		CPU:                    1000,
		Memory:                 512,
		ScalingMode:            v1.ScalingModeManual,
		FixedScale:             saclient.Ptr(int32(1)),
		RegistryPasswordAction: v1.RegistryPasswordActionKeep,
		EnvVars: []version.EnvironmentVariable{
			{Key: "FOO", Value: saclient.Ptr("bar")},
		},
	})
	if err != nil {
		t.Fatalf("seed Version.Create: %v", err)
	}

	profileName := writeUsacloudProfile(t, "dummy", "dummy")
	t.Setenv("SAKURA_ENDPOINTS_APPRUN_DEDICATED", srv.TestURL())

	service, err := apprun.NewService(profileName)
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}
	appIDStr := uuid.UUID(appID).String()

	versions, err := service.ListApplicationVersions(ctx, appIDStr)
	if err != nil {
		t.Fatalf("ListApplicationVersions: %v", err)
	}
	if len(versions) != 1 {
		t.Fatalf("got %d versions, want 1: %+v", len(versions), versions)
	}
	if versions[0].Version != int(created.Version) {
		t.Errorf("Version = %d, want %d", versions[0].Version, created.Version)
	}
	if versions[0].Image != "nginx:latest" {
		t.Errorf("Image = %q, want %q", versions[0].Image, "nginx:latest")
	}

	detail, err := service.GetApplicationVersion(ctx, appIDStr, int(created.Version))
	if err != nil {
		t.Fatalf("GetApplicationVersion: %v", err)
	}
	if detail.CPU != 1000 {
		t.Errorf("CPU = %d, want 1000", detail.CPU)
	}
	if detail.ScalingMode != string(v1.ScalingModeManual) {
		t.Errorf("ScalingMode = %q, want %q", detail.ScalingMode, v1.ScalingModeManual)
	}
	if detail.FixedScale != 1 {
		t.Errorf("FixedScale = %d, want 1", detail.FixedScale)
	}
	if len(detail.Env) != 1 || detail.Env[0].Key != "FOO" || detail.Env[0].Value != "bar" {
		t.Errorf("Env = %+v, want [{FOO bar false}]", detail.Env)
	}

	if err := service.SetActiveVersion(ctx, appIDStr, int(created.Version)); err != nil {
		t.Fatalf("SetActiveVersion: %v", err)
	}

	apps, err := service.ListApplications(ctx, "")
	if err != nil {
		t.Fatalf("ListApplications: %v", err)
	}
	if len(apps) != 1 || apps[0].ActiveVersion != int(created.Version) {
		t.Fatalf("apps = %+v, want ActiveVersion=%d", apps, created.Version)
	}

	if err := service.ClearActiveVersion(ctx, appIDStr); err != nil {
		t.Fatalf("ClearActiveVersion: %v", err)
	}

	apps, err = service.ListApplications(ctx, "")
	if err != nil {
		t.Fatalf("ListApplications after clear: %v", err)
	}
	if len(apps) != 1 || apps[0].ActiveVersion != 0 {
		t.Fatalf("apps = %+v, want ActiveVersion=0", apps)
	}
}

func TestService_CreateApplicationVersion(t *testing.T) {
	srv := mockapprundedicated.NewTestServer(mockapprundedicated.Config{})
	defer srv.Close()
	ctx := context.Background()
	rawClient := newRawClient(t, srv.TestURL())

	clusterID := seedCluster(t, ctx, rawClient)
	appID := seedApplication(t, ctx, rawClient, clusterID)
	appIDStr := uuid.UUID(appID).String()

	profileName := writeUsacloudProfile(t, "dummy", "dummy")
	t.Setenv("SAKURA_ENDPOINTS_APPRUN_DEDICATED", srv.TestURL())

	service, err := apprun.NewService(profileName)
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}

	lbPort := int32(443)
	created, err := service.CreateApplicationVersion(ctx, appIDStr, apprun.CreateAppVersionParams{
		CPU:         1000,
		Memory:      512,
		ScalingMode: "manual",
		FixedScale:  saclient.Ptr(int32(2)),
		Image:       "nginx:latest",
		ExposedPorts: []apprun.CreateExposedPortParams{
			{
				TargetPort:       8080,
				LoadBalancerPort: &lbPort,
				UseLetsEncrypt:   true,
				Host:             []string{"example.com"},
				HealthCheck: &apprun.CreateHealthCheckParams{
					Path:            "/healthz",
					IntervalSeconds: 10,
					TimeoutSeconds:  5,
				},
			},
		},
		EnvVars: []apprun.CreateEnvVarParams{
			{Key: "FOO", Value: saclient.Ptr("bar")},
		},
	})
	if err != nil {
		t.Fatalf("CreateApplicationVersion: %v", err)
	}
	if created.Image != "nginx:latest" {
		t.Errorf("Image = %q, want %q", created.Image, "nginx:latest")
	}

	detail, err := service.GetApplicationVersion(ctx, appIDStr, created.Version)
	if err != nil {
		t.Fatalf("GetApplicationVersion: %v", err)
	}
	if detail.CPU != 1000 {
		t.Errorf("CPU = %d, want 1000", detail.CPU)
	}
	if detail.FixedScale != 2 {
		t.Errorf("FixedScale = %d, want 2", detail.FixedScale)
	}
	if len(detail.Env) != 1 || detail.Env[0].Key != "FOO" || detail.Env[0].Value != "bar" {
		t.Errorf("Env = %+v, want [{FOO bar false}]", detail.Env)
	}
	if len(detail.ExposedPorts) != 1 || detail.ExposedPorts[0].TargetPort != 8080 {
		t.Errorf("ExposedPorts = %+v, want target port 8080", detail.ExposedPorts)
	}
}

func TestService_DeleteApplicationVersion(t *testing.T) {
	srv := mockapprundedicated.NewTestServer(mockapprundedicated.Config{})
	defer srv.Close()
	ctx := context.Background()
	rawClient := newRawClient(t, srv.TestURL())

	clusterID := seedCluster(t, ctx, rawClient)
	appID := seedApplication(t, ctx, rawClient, clusterID)
	appIDStr := uuid.UUID(appID).String()

	versionOp := sdkapprundedicated.NewVersionOp(rawClient, appID)
	created, err := versionOp.Create(ctx, version.CreateParams{
		Image:                  "nginx:latest",
		CPU:                    1000,
		Memory:                 512,
		ScalingMode:            v1.ScalingModeManual,
		FixedScale:             saclient.Ptr(int32(1)),
		RegistryPasswordAction: v1.RegistryPasswordActionKeep,
	})
	if err != nil {
		t.Fatalf("seed Version.Create: %v", err)
	}

	profileName := writeUsacloudProfile(t, "dummy", "dummy")
	t.Setenv("SAKURA_ENDPOINTS_APPRUN_DEDICATED", srv.TestURL())

	service, err := apprun.NewService(profileName)
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}

	if err := service.DeleteApplicationVersion(ctx, appIDStr, int(created.Version)); err != nil {
		t.Fatalf("DeleteApplicationVersion: %v", err)
	}

	versions, err := service.ListApplicationVersions(ctx, appIDStr)
	if err != nil {
		t.Fatalf("ListApplicationVersions: %v", err)
	}
	if len(versions) != 0 {
		t.Errorf("got %d versions after delete, want 0: %+v", len(versions), versions)
	}
}

func TestService_DeleteCluster(t *testing.T) {
	srv := mockapprundedicated.NewTestServer(mockapprundedicated.Config{})
	defer srv.Close()
	ctx := context.Background()

	clusterID := seedCluster(t, ctx, newRawClient(t, srv.TestURL()))

	profileName := writeUsacloudProfile(t, "dummy", "dummy")
	t.Setenv("SAKURA_ENDPOINTS_APPRUN_DEDICATED", srv.TestURL())

	service, err := apprun.NewService(profileName)
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}

	if err := service.DeleteCluster(ctx, uuid.UUID(clusterID).String()); err != nil {
		t.Fatalf("DeleteCluster: %v", err)
	}

	clusters, err := service.ListClusters(ctx)
	if err != nil {
		t.Fatalf("ListClusters: %v", err)
	}
	if len(clusters) != 0 {
		t.Errorf("got %d clusters after delete, want 0: %+v", len(clusters), clusters)
	}
}

func TestService_DeleteApplication(t *testing.T) {
	srv := mockapprundedicated.NewTestServer(mockapprundedicated.Config{})
	defer srv.Close()
	ctx := context.Background()
	rawClient := newRawClient(t, srv.TestURL())

	clusterID := seedCluster(t, ctx, rawClient)
	appID := seedApplication(t, ctx, rawClient, clusterID)

	profileName := writeUsacloudProfile(t, "dummy", "dummy")
	t.Setenv("SAKURA_ENDPOINTS_APPRUN_DEDICATED", srv.TestURL())

	service, err := apprun.NewService(profileName)
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}

	if err := service.DeleteApplication(ctx, uuid.UUID(appID).String()); err != nil {
		t.Fatalf("DeleteApplication: %v", err)
	}

	apps, err := service.ListApplications(ctx, uuid.UUID(clusterID).String())
	if err != nil {
		t.Fatalf("ListApplications: %v", err)
	}
	if len(apps) != 0 {
		t.Errorf("got %d applications after delete, want 0: %+v", len(apps), apps)
	}
}

func TestService_DeleteAutoScalingGroup(t *testing.T) {
	srv := mockapprundedicated.NewTestServer(mockapprundedicated.Config{})
	defer srv.Close()
	ctx := context.Background()
	rawClient := newRawClient(t, srv.TestURL())

	clusterID := seedCluster(t, ctx, rawClient)

	asgResp, err := rawClient.CreateAutoScalingGroup(ctx, &v1.CreateAutoScalingGroup{
		Name:                   "test-asg",
		Zone:                   "is1a",
		WorkerServiceClassPath: "cloud/apprun/dedicated/worker/1vcpu_2gb",
		MinNodes:               1,
		MaxNodes:               1,
		NameServers:            []v1.IPv4{"210.188.224.10"},
		Interfaces: []v1.AutoScalingGroupNodeInterface{
			{InterfaceIndex: 0, Upstream: "shared"},
		},
	}, v1.CreateAutoScalingGroupParams{ClusterID: clusterID})
	if err != nil {
		t.Fatalf("seed CreateAutoScalingGroup: %v", err)
	}

	profileName := writeUsacloudProfile(t, "dummy", "dummy")
	t.Setenv("SAKURA_ENDPOINTS_APPRUN_DEDICATED", srv.TestURL())

	service, err := apprun.NewService(profileName)
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}

	clusterIDStr := uuid.UUID(clusterID).String()
	asgIDStr := uuid.UUID(asgResp.AutoScalingGroup.GetAutoScalingGroupID()).String()

	if err := service.DeleteAutoScalingGroup(ctx, clusterIDStr, asgIDStr); err != nil {
		t.Fatalf("DeleteAutoScalingGroup: %v", err)
	}

	asgs, err := service.ListAutoScalingGroups(ctx, clusterIDStr)
	if err != nil {
		t.Fatalf("ListAutoScalingGroups: %v", err)
	}
	if len(asgs) != 0 {
		t.Errorf("got %d ASGs after delete, want 0: %+v", len(asgs), asgs)
	}
}

func TestService_DeleteLoadBalancer(t *testing.T) {
	srv := mockapprundedicated.NewTestServer(mockapprundedicated.Config{})
	defer srv.Close()
	ctx := context.Background()
	rawClient := newRawClient(t, srv.TestURL())

	clusterID := seedCluster(t, ctx, rawClient)

	asgResp, err := rawClient.CreateAutoScalingGroup(ctx, &v1.CreateAutoScalingGroup{
		Name:                   "test-asg",
		Zone:                   "is1a",
		WorkerServiceClassPath: "cloud/apprun/dedicated/worker/1vcpu_2gb",
		MinNodes:               1,
		MaxNodes:               1,
		NameServers:            []v1.IPv4{"210.188.224.10"},
		Interfaces: []v1.AutoScalingGroupNodeInterface{
			{InterfaceIndex: 0, Upstream: "shared"},
		},
	}, v1.CreateAutoScalingGroupParams{ClusterID: clusterID})
	if err != nil {
		t.Fatalf("seed CreateAutoScalingGroup: %v", err)
	}
	asgID := asgResp.AutoScalingGroup.GetAutoScalingGroupID()

	lbResp, err := rawClient.CreateLoadBalancer(ctx, &v1.CreateLoadBalancer{
		Name:             "test-lb",
		ServiceClassPath: "cloud/apprun/dedicated/lb/1vcpu_2gb",
		NameServers:      []v1.IPv4{"210.188.224.10"},
		Interfaces: []v1.LoadBalancerInterface{
			{InterfaceIndex: 0, Upstream: "shared"},
		},
	}, v1.CreateLoadBalancerParams{ClusterID: clusterID, AutoScalingGroupID: asgID})
	if err != nil {
		t.Fatalf("seed CreateLoadBalancer: %v", err)
	}

	profileName := writeUsacloudProfile(t, "dummy", "dummy")
	t.Setenv("SAKURA_ENDPOINTS_APPRUN_DEDICATED", srv.TestURL())

	service, err := apprun.NewService(profileName)
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}

	clusterIDStr := uuid.UUID(clusterID).String()
	asgIDStr := uuid.UUID(asgID).String()
	lbIDStr := uuid.UUID(lbResp.LoadBalancer.GetLoadBalancerID()).String()

	if err := service.DeleteLoadBalancer(ctx, clusterIDStr, asgIDStr, lbIDStr); err != nil {
		t.Fatalf("DeleteLoadBalancer: %v", err)
	}

	lbs, err := service.ListLoadBalancers(ctx, clusterIDStr, asgIDStr)
	if err != nil {
		t.Fatalf("ListLoadBalancers: %v", err)
	}
	if len(lbs) != 0 {
		t.Errorf("got %d LBs after delete, want 0: %+v", len(lbs), lbs)
	}
}

func TestService_ListAutoScalingGroups_Empty(t *testing.T) {
	srv := mockapprundedicated.NewTestServer(mockapprundedicated.Config{})
	defer srv.Close()
	ctx := context.Background()

	clusterID := seedCluster(t, ctx, newRawClient(t, srv.TestURL()))

	profileName := writeUsacloudProfile(t, "dummy", "dummy")
	t.Setenv("SAKURA_ENDPOINTS_APPRUN_DEDICATED", srv.TestURL())

	service, err := apprun.NewService(profileName)
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}

	asgs, err := service.ListAutoScalingGroups(ctx, uuid.UUID(clusterID).String())
	if err != nil {
		t.Fatalf("ListAutoScalingGroups: %v", err)
	}
	if len(asgs) != 0 {
		t.Errorf("got %d ASGs, want 0: %+v", len(asgs), asgs)
	}
}
