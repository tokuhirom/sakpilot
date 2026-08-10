package serviceendpointgateway_test

import (
	"context"
	"testing"

	"sakpilot/internal/serviceendpointgateway"
)

func newTestService(t *testing.T, endpoint string) *serviceendpointgateway.Service {
	t.Helper()

	t.Setenv("SAKURA_ACCESS_TOKEN", "dummy")
	t.Setenv("SAKURA_ACCESS_TOKEN_SECRET", "dummy")
	t.Setenv("SAKURA_ENDPOINTS_SERVICE_ENDPOINT_GATEWAY", endpoint)

	profileName := writeUsacloudProfile(t, "dummy", "dummy")

	service, err := serviceendpointgateway.NewService(profileName, "is1a")
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}
	return service
}

func TestService_CRUD(t *testing.T) {
	srv := newFakeServer()
	defer srv.Close()

	service := newTestService(t, srv.URL)
	ctx := context.Background()

	list, err := service.List(ctx)
	if err != nil {
		t.Fatalf("List (empty): %v", err)
	}
	if len(list) != 0 {
		t.Fatalf("List (empty) = %d appliances, want 0", len(list))
	}

	created, err := service.Create(ctx, serviceendpointgateway.CreateParams{
		SwitchID:          "111111111111",
		NetworkMaskLen:    24,
		ServerIPAddresses: []string{"192.168.0.11", "192.168.0.12"},
	})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if created.ID == "" {
		t.Fatalf("Create: got empty ID")
	}
	if created.SwitchID != "111111111111" {
		t.Fatalf("Create: SwitchID = %q, want 111111111111", created.SwitchID)
	}
	if created.Availability != "available" {
		t.Fatalf("Create: Availability = %q, want available", created.Availability)
	}

	list, err = service.List(ctx)
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("List = %d appliances, want 1", len(list))
	}

	got, err := service.Get(ctx, created.ID)
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if got.ID != created.ID {
		t.Fatalf("Get: ID = %q, want %q", got.ID, created.ID)
	}

	updated, err := service.Update(ctx, created.ID, serviceendpointgateway.UpdateParams{
		EnabledServices: []serviceendpointgateway.EnabledServiceInfo{
			{Type: "ObjectStorage", Endpoints: []string{"s3.isk01.sakurastorage.jp"}},
		},
		MonitoringSuite: true,
		DNSForwarding: serviceendpointgateway.DNSForwardingInfo{
			Enabled:           true,
			PrivateHostedZone: "internal.example.com",
			UpstreamDNS1:      "10.0.0.1",
			UpstreamDNS2:      "10.0.0.2",
		},
	})
	if err != nil {
		t.Fatalf("Update: %v", err)
	}
	if len(updated.EnabledServices) != 1 || updated.EnabledServices[0].Type != "ObjectStorage" {
		t.Fatalf("Update: EnabledServices = %+v", updated.EnabledServices)
	}
	if !updated.MonitoringSuite {
		t.Fatalf("Update: MonitoringSuite = false, want true")
	}
	if !updated.DNSForwarding.Enabled || updated.DNSForwarding.PrivateHostedZone != "internal.example.com" {
		t.Fatalf("Update: DNSForwarding = %+v", updated.DNSForwarding)
	}

	if err := service.Apply(ctx, created.ID); err != nil {
		t.Fatalf("Apply: %v", err)
	}

	iface, err := service.ReadInterface(ctx, created.ID, "interface-1")
	if err != nil {
		t.Fatalf("ReadInterface: %v", err)
	}
	if iface.IPAddress == "" {
		t.Fatalf("ReadInterface: got empty IPAddress")
	}

	status, err := service.ReadPowerStatus(ctx, created.ID)
	if err != nil {
		t.Fatalf("ReadPowerStatus: %v", err)
	}
	if status != "down" {
		t.Fatalf("ReadPowerStatus = %q, want down", status)
	}

	if err := service.PowerOn(ctx, created.ID); err != nil {
		t.Fatalf("PowerOn: %v", err)
	}
	status, err = service.ReadPowerStatus(ctx, created.ID)
	if err != nil {
		t.Fatalf("ReadPowerStatus (after PowerOn): %v", err)
	}
	if status != "up" {
		t.Fatalf("ReadPowerStatus (after PowerOn) = %q, want up", status)
	}

	if err := service.Reset(ctx, created.ID); err != nil {
		t.Fatalf("Reset: %v", err)
	}

	if err := service.Shutdown(ctx, created.ID); err != nil {
		t.Fatalf("Shutdown: %v", err)
	}
	status, err = service.ReadPowerStatus(ctx, created.ID)
	if err != nil {
		t.Fatalf("ReadPowerStatus (after Shutdown): %v", err)
	}
	if status != "down" {
		t.Fatalf("ReadPowerStatus (after Shutdown) = %q, want down", status)
	}

	if err := service.Delete(ctx, created.ID); err != nil {
		t.Fatalf("Delete: %v", err)
	}

	list, err = service.List(ctx)
	if err != nil {
		t.Fatalf("List (after delete): %v", err)
	}
	if len(list) != 0 {
		t.Fatalf("List (after delete) = %d appliances, want 0", len(list))
	}
}

func TestService_Get_NotFound(t *testing.T) {
	srv := newFakeServer()
	defer srv.Close()

	service := newTestService(t, srv.URL)
	if _, err := service.Get(context.Background(), "does-not-exist"); err == nil {
		t.Fatalf("Get: want error for missing appliance, got nil")
	}
}
