package cloudhsm_test

import (
	"context"
	"testing"

	sdkcloudhsm "github.com/sacloud/sacloud-sdk-go/api/cloudhsm"
	"github.com/sacloud/sacloud-sdk-go/common/saclient"
	mockcloudhsm "github.com/sacloud/sakumock/cloudhsm"

	"sakpilot/internal/cloudhsm"
)

// newTestSaclient builds a saclient.Client pointed at the sakumock CloudHSM
// test server, mirroring how internal/cloudhsm.Service authenticates in
// production.
func newTestSaclient(t *testing.T, endpoint string) *saclient.Client {
	t.Helper()
	var sc saclient.Client
	if err := sc.SetEnviron([]string{
		"SAKURA_ACCESS_TOKEN=dummy",
		"SAKURA_ACCESS_TOKEN_SECRET=dummy",
		"SAKURA_ENDPOINTS_CLOUDHSM=" + endpoint,
	}); err != nil {
		t.Fatalf("SetEnviron: %v", err)
	}
	return &sc
}

func newTestService(t *testing.T, endpoint string) *cloudhsm.Service {
	t.Helper()
	t.Setenv("SAKURA_ACCESS_TOKEN", "dummy")
	t.Setenv("SAKURA_ACCESS_TOKEN_SECRET", "dummy")
	t.Setenv("SAKURA_ENDPOINTS_CLOUDHSM", endpoint)

	profileName := writeUsacloudProfile(t, "dummy", "dummy")
	service, err := cloudhsm.NewService(profileName)
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}
	return service
}

func TestService_ListCloudHSMs(t *testing.T) {
	srv := mockcloudhsm.NewTestServer(mockcloudhsm.Config{})
	defer srv.Close()

	sc := newTestSaclient(t, srv.TestURL())
	rawClient, err := sdkcloudhsm.NewClient(sc)
	if err != nil {
		t.Fatalf("sdkcloudhsm.NewClient: %v", err)
	}
	hsmOp := sdkcloudhsm.NewCloudHSMOp(rawClient)
	created, err := hsmOp.Create(context.Background(), sdkcloudhsm.CloudHSMCreateParams{
		Name:               "test-hsm",
		Tags:               []string{"env:test"},
		Ipv4NetworkAddress: "192.168.0.0",
		Ipv4PrefixLength:   24,
	})
	if err != nil {
		t.Fatalf("seed Create: %v", err)
	}

	service := newTestService(t, srv.TestURL())

	hsms, err := service.ListCloudHSMs(context.Background())
	if err != nil {
		t.Fatalf("ListCloudHSMs: %v", err)
	}
	if len(hsms) != 1 {
		t.Fatalf("got %d hsms, want 1: %+v", len(hsms), hsms)
	}

	got := hsms[0]
	if got.ID != created.ID {
		t.Errorf("ID = %q, want %q", got.ID, created.ID)
	}
	if got.Name != "test-hsm" {
		t.Errorf("Name = %q, want %q", got.Name, "test-hsm")
	}
	if got.Availability != "available" {
		t.Errorf("Availability = %q, want %q", got.Availability, "available")
	}
	if got.Ipv4NetworkAddress != "192.168.0.0" {
		t.Errorf("Ipv4NetworkAddress = %q, want %q", got.Ipv4NetworkAddress, "192.168.0.0")
	}
	if got.Ipv4PrefixLength != 24 {
		t.Errorf("Ipv4PrefixLength = %d, want 24", got.Ipv4PrefixLength)
	}
	if got.Ipv4Address == "" {
		t.Error("Ipv4Address is empty, want an auto-assigned address")
	}
	if len(got.Tags) != 1 || got.Tags[0] != "env:test" {
		t.Errorf("Tags = %v, want [env:test]", got.Tags)
	}
	if got.CreatedAt == "" {
		t.Error("CreatedAt is empty, want a formatted timestamp")
	}
}

func TestService_GetCloudHSM(t *testing.T) {
	srv := mockcloudhsm.NewTestServer(mockcloudhsm.Config{})
	defer srv.Close()

	service := newTestService(t, srv.TestURL())

	created, err := service.CreateCloudHSM(context.Background(), "test-hsm", "a test hsm", nil, "192.168.0.0", 24)
	if err != nil {
		t.Fatalf("CreateCloudHSM: %v", err)
	}

	got, err := service.GetCloudHSM(context.Background(), created.ID)
	if err != nil {
		t.Fatalf("GetCloudHSM: %v", err)
	}
	if got.Description != "a test hsm" {
		t.Errorf("Description = %q, want %q", got.Description, "a test hsm")
	}
}

func TestService_CreateCloudHSM(t *testing.T) {
	srv := mockcloudhsm.NewTestServer(mockcloudhsm.Config{})
	defer srv.Close()

	service := newTestService(t, srv.TestURL())

	got, err := service.CreateCloudHSM(context.Background(), "test-hsm", "a test hsm", []string{"env:test"}, "192.168.0.0", 24)
	if err != nil {
		t.Fatalf("CreateCloudHSM: %v", err)
	}
	if got.Name != "test-hsm" {
		t.Errorf("Name = %q, want %q", got.Name, "test-hsm")
	}
	if got.Availability != "available" {
		t.Errorf("Availability = %q, want %q (sakumock provisions synchronously)", got.Availability, "available")
	}

	hsms, err := service.ListCloudHSMs(context.Background())
	if err != nil {
		t.Fatalf("ListCloudHSMs: %v", err)
	}
	if len(hsms) != 1 {
		t.Fatalf("got %d hsms after create, want 1: %+v", len(hsms), hsms)
	}
}

func TestService_UpdateCloudHSM(t *testing.T) {
	srv := mockcloudhsm.NewTestServer(mockcloudhsm.Config{})
	defer srv.Close()

	service := newTestService(t, srv.TestURL())

	created, err := service.CreateCloudHSM(context.Background(), "test-hsm", "", nil, "192.168.0.0", 24)
	if err != nil {
		t.Fatalf("CreateCloudHSM: %v", err)
	}

	got, err := service.UpdateCloudHSM(context.Background(), created.ID, "test-hsm-renamed", "updated description", []string{"env:prod"})
	if err != nil {
		t.Fatalf("UpdateCloudHSM: %v", err)
	}
	if got.Name != "test-hsm-renamed" {
		t.Errorf("Name = %q, want %q", got.Name, "test-hsm-renamed")
	}
	if got.Description != "updated description" {
		t.Errorf("Description = %q, want %q", got.Description, "updated description")
	}
	// Ipv4NetworkAddress/Ipv4PrefixLength are immutable in practice; Service
	// should carry the current values forward rather than clearing them.
	if got.Ipv4NetworkAddress != "192.168.0.0" {
		t.Errorf("Ipv4NetworkAddress = %q, want %q", got.Ipv4NetworkAddress, "192.168.0.0")
	}
	if got.Ipv4PrefixLength != 24 {
		t.Errorf("Ipv4PrefixLength = %d, want 24", got.Ipv4PrefixLength)
	}
	if len(got.Tags) != 1 || got.Tags[0] != "env:prod" {
		t.Errorf("Tags = %v, want [env:prod]", got.Tags)
	}
}

func TestService_DeleteCloudHSM(t *testing.T) {
	srv := mockcloudhsm.NewTestServer(mockcloudhsm.Config{})
	defer srv.Close()

	service := newTestService(t, srv.TestURL())

	created, err := service.CreateCloudHSM(context.Background(), "test-hsm", "", nil, "192.168.0.0", 24)
	if err != nil {
		t.Fatalf("CreateCloudHSM: %v", err)
	}

	if err := service.DeleteCloudHSM(context.Background(), created.ID); err != nil {
		t.Fatalf("DeleteCloudHSM: %v", err)
	}

	hsms, err := service.ListCloudHSMs(context.Background())
	if err != nil {
		t.Fatalf("ListCloudHSMs: %v", err)
	}
	if len(hsms) != 0 {
		t.Fatalf("got %d hsms after delete, want 0: %+v", len(hsms), hsms)
	}
}

const testCertPEM = `-----BEGIN CERTIFICATE-----
MIIBhTCCASugAwIBAgIQIeZQ7dGVJ8W2yhWgHu2XjTAKBggqhkjOPQQDAjASMRAw
DgYDVQQKEwdzYWtwaWxvdDAeFw0yNTAxMDEwMDAwMDBaFw0zNTAxMDEwMDAwMDBa
MBIxEDAOBgNVBAoTB3Nha3BpbG90MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE
6d0aY+huGKq0Sm3xkbaAaZpWWfziuxxEQFwPWY3G/1kkiVWnDwj1kIcS+9tWr4uv
0V6oQpZv9EnBw9UkakLhoaNGMEQwDgYDVR0PAQH/BAQDAgWgMBMGA1UdJQQMMAoG
CCsGAQUFBwMCMB0GA1UdDgQWBBRTeSN9nAK1YB1PguoBIyF+VuvcHzAKBggqhkjO
PQQDAgNIADBFAiAJdummydummydummydummydummydummydummydummydummy
AiEAdummydummydummydummydummydummydummydummydummydummydummy=
-----END CERTIFICATE-----`

func TestService_ClientCRUD(t *testing.T) {
	srv := mockcloudhsm.NewTestServer(mockcloudhsm.Config{})
	defer srv.Close()

	service := newTestService(t, srv.TestURL())

	hsm, err := service.CreateCloudHSM(context.Background(), "test-hsm", "", nil, "192.168.0.0", 24)
	if err != nil {
		t.Fatalf("CreateCloudHSM: %v", err)
	}

	created, err := service.CreateClient(context.Background(), hsm.ID, "test-client", testCertPEM)
	if err != nil {
		t.Fatalf("CreateClient: %v", err)
	}
	if created.Name != "test-client" {
		t.Errorf("Name = %q, want %q", created.Name, "test-client")
	}
	if created.Certificate != testCertPEM {
		t.Errorf("Certificate mismatch")
	}

	clients, err := service.ListClients(context.Background(), hsm.ID)
	if err != nil {
		t.Fatalf("ListClients: %v", err)
	}
	if len(clients) != 1 {
		t.Fatalf("got %d clients, want 1: %+v", len(clients), clients)
	}

	updated, err := service.UpdateClient(context.Background(), hsm.ID, created.ID, "test-client-renamed")
	if err != nil {
		t.Fatalf("UpdateClient: %v", err)
	}
	if updated.Name != "test-client-renamed" {
		t.Errorf("Name = %q, want %q", updated.Name, "test-client-renamed")
	}
	// NOTE: sacloud-sdk-go's ClientOp.Update intentionally omits Certificate
	// from the update request (the SDK's own comment says the field "cannot
	// be updated"), on the assumption the real API preserves it server-side
	// when absent. sakumock instead overwrites the stored certificate with
	// the empty value it receives, so it comes back blank here. See
	// docs/upstream-issues.md for details; this is a sakumock-only quirk we
	// cannot fix from SakPilot.
	if updated.Certificate != "" {
		t.Errorf("Certificate = %q, want empty (sakumock clears it on update, see docs/upstream-issues.md)", updated.Certificate)
	}

	if err := service.DeleteClient(context.Background(), hsm.ID, created.ID); err != nil {
		t.Fatalf("DeleteClient: %v", err)
	}
	clients, err = service.ListClients(context.Background(), hsm.ID)
	if err != nil {
		t.Fatalf("ListClients after delete: %v", err)
	}
	if len(clients) != 0 {
		t.Fatalf("got %d clients after delete, want 0: %+v", len(clients), clients)
	}
}

func TestService_PeerCRUD(t *testing.T) {
	srv := mockcloudhsm.NewTestServer(mockcloudhsm.Config{})
	defer srv.Close()

	service := newTestService(t, srv.TestURL())

	hsm, err := service.CreateCloudHSM(context.Background(), "test-hsm", "", nil, "192.168.0.0", 24)
	if err != nil {
		t.Fatalf("CreateCloudHSM: %v", err)
	}

	const routerID = "112233445566"
	if err := service.CreatePeer(context.Background(), hsm.ID, routerID, "supersecretkey"); err != nil {
		t.Fatalf("CreatePeer: %v", err)
	}

	peers, err := service.ListPeers(context.Background(), hsm.ID)
	if err != nil {
		t.Fatalf("ListPeers: %v", err)
	}
	if len(peers) != 1 {
		t.Fatalf("got %d peers, want 1: %+v", len(peers), peers)
	}
	if peers[0].ID != routerID {
		t.Errorf("ID = %q, want %q", peers[0].ID, routerID)
	}

	if err := service.DeletePeer(context.Background(), hsm.ID, peers[0].ID); err != nil {
		t.Fatalf("DeletePeer: %v", err)
	}
	peers, err = service.ListPeers(context.Background(), hsm.ID)
	if err != nil {
		t.Fatalf("ListPeers after delete: %v", err)
	}
	if len(peers) != 0 {
		t.Fatalf("got %d peers after delete, want 0: %+v", len(peers), peers)
	}
}

func TestService_LicenseCRUD(t *testing.T) {
	srv := mockcloudhsm.NewTestServer(mockcloudhsm.Config{})
	defer srv.Close()

	service := newTestService(t, srv.TestURL())

	created, err := service.CreateLicense(context.Background(), "test-license", "a test license", []string{"env:test"})
	if err != nil {
		t.Fatalf("CreateLicense: %v", err)
	}
	if created.Name != "test-license" {
		t.Errorf("Name = %q, want %q", created.Name, "test-license")
	}
	if created.Description != "a test license" {
		t.Errorf("Description = %q, want %q", created.Description, "a test license")
	}

	got, err := service.GetLicense(context.Background(), created.ID)
	if err != nil {
		t.Fatalf("GetLicense: %v", err)
	}
	if got.ID != created.ID {
		t.Errorf("ID = %q, want %q", got.ID, created.ID)
	}

	licenses, err := service.ListLicenses(context.Background())
	if err != nil {
		t.Fatalf("ListLicenses: %v", err)
	}
	if len(licenses) != 1 {
		t.Fatalf("got %d licenses, want 1: %+v", len(licenses), licenses)
	}

	updated, err := service.UpdateLicense(context.Background(), created.ID, "test-license-renamed", "updated description", []string{"env:prod"})
	if err != nil {
		t.Fatalf("UpdateLicense: %v", err)
	}
	if updated.Name != "test-license-renamed" {
		t.Errorf("Name = %q, want %q", updated.Name, "test-license-renamed")
	}
	if len(updated.Tags) != 1 || updated.Tags[0] != "env:prod" {
		t.Errorf("Tags = %v, want [env:prod]", updated.Tags)
	}

	if err := service.DeleteLicense(context.Background(), created.ID); err != nil {
		t.Fatalf("DeleteLicense: %v", err)
	}
	licenses, err = service.ListLicenses(context.Background())
	if err != nil {
		t.Fatalf("ListLicenses after delete: %v", err)
	}
	if len(licenses) != 0 {
		t.Fatalf("got %d licenses after delete, want 0: %+v", len(licenses), licenses)
	}
}
