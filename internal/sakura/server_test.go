package sakura

import (
	"context"
	"testing"

	"github.com/sacloud/sacloud-sdk-go/api/iaas"
	"github.com/sacloud/sacloud-sdk-go/api/iaas/fake"
)

func newTestServerService(t *testing.T) *ServerService {
	t.Helper()
	fake.SwitchFactoryFuncToFake()
	fake.InitDataStore()
	return NewServerService(&Client{})
}

func TestServerService_Get(t *testing.T) {
	service := newTestServerService(t)
	ctx := context.Background()

	created, err := createTestServer(ctx, "is1a")
	if err != nil {
		t.Fatalf("createTestServer: %v", err)
	}

	got, err := service.Get(ctx, "is1a", created.ID.String())
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if got.ID != created.ID.String() {
		t.Errorf("ID = %q, want %q", got.ID, created.ID.String())
	}
	if got.Name != "test-server" {
		t.Errorf("Name = %q, want %q", got.Name, "test-server")
	}
	if got.CDROMID != "" {
		t.Errorf("CDROMID = %q, want empty", got.CDROMID)
	}
}

func TestServerService_ChangePlan(t *testing.T) {
	service := newTestServerService(t)
	ctx := context.Background()

	created, err := createTestServer(ctx, "is1a")
	if err != nil {
		t.Fatalf("createTestServer: %v", err)
	}

	updated, err := service.ChangePlan(ctx, "is1a", created.ID.String(), 2, 4)
	if err != nil {
		t.Fatalf("ChangePlan: %v", err)
	}
	if updated.CPU != 2 {
		t.Errorf("CPU = %d, want 2", updated.CPU)
	}
	if updated.Memory != 4 {
		t.Errorf("Memory = %d, want 4", updated.Memory)
	}

	// プラン変更はサーバーIDの再採番を伴う
	if updated.ID == created.ID.String() {
		t.Errorf("ID = %q, want different from original %q after plan change", updated.ID, created.ID.String())
	}

	if _, err := service.Get(ctx, "is1a", created.ID.String()); err == nil {
		t.Error("Get with old ID after ChangePlan: got nil error, want not-found error")
	}
}

func TestServerService_InsertAndEjectCDROM(t *testing.T) {
	service := newTestServerService(t)
	ctx := context.Background()

	server, err := createTestServer(ctx, "is1a")
	if err != nil {
		t.Fatalf("createTestServer: %v", err)
	}

	cdromOp := iaas.NewCDROMOp(nil)
	cdrom, _, err := cdromOp.Create(ctx, "is1a", &iaas.CDROMCreateRequest{Name: "test-iso", SizeMB: 512})
	if err != nil {
		t.Fatalf("cdromOp.Create: %v", err)
	}

	if err := service.InsertCDROM(ctx, "is1a", server.ID.String(), cdrom.ID.String()); err != nil {
		t.Fatalf("InsertCDROM: %v", err)
	}

	got, err := service.Get(ctx, "is1a", server.ID.String())
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if got.CDROMID != cdrom.ID.String() {
		t.Errorf("CDROMID = %q, want %q", got.CDROMID, cdrom.ID.String())
	}

	if err := service.EjectCDROM(ctx, "is1a", server.ID.String()); err != nil {
		t.Fatalf("EjectCDROM: %v", err)
	}

	got, err = service.Get(ctx, "is1a", server.ID.String())
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if got.CDROMID != "" {
		t.Errorf("CDROMID = %q, want empty after eject", got.CDROMID)
	}
}

func TestServerService_SendKeyAndNMI(t *testing.T) {
	service := newTestServerService(t)
	ctx := context.Background()

	server, err := createTestServer(ctx, "is1a")
	if err != nil {
		t.Fatalf("createTestServer: %v", err)
	}

	if err := service.SendKey(ctx, "is1a", server.ID.String(), "CTRL+ALT+DELETE"); err != nil {
		t.Fatalf("SendKey: %v", err)
	}
	if err := service.SendNMI(ctx, "is1a", server.ID.String()); err != nil {
		t.Fatalf("SendNMI: %v", err)
	}
}

func TestServerService_GetVNCProxy(t *testing.T) {
	service := newTestServerService(t)
	ctx := context.Background()

	server, err := createTestServer(ctx, "is1a")
	if err != nil {
		t.Fatalf("createTestServer: %v", err)
	}

	info, err := service.GetVNCProxy(ctx, "is1a", server.ID.String())
	if err != nil {
		t.Fatalf("GetVNCProxy: %v", err)
	}
	if info == nil {
		t.Fatal("GetVNCProxy returned nil info")
	}
}

func TestCDROMService_List(t *testing.T) {
	fake.SwitchFactoryFuncToFake()
	fake.InitDataStore()
	service := NewCDROMService(&Client{})
	ctx := context.Background()

	cdromOp := iaas.NewCDROMOp(nil)
	created, _, err := cdromOp.Create(ctx, "is1a", &iaas.CDROMCreateRequest{Name: "test-iso", SizeMB: 512})
	if err != nil {
		t.Fatalf("cdromOp.Create: %v", err)
	}

	list, err := service.List(ctx, "is1a")
	if err != nil {
		t.Fatalf("List: %v", err)
	}

	found := false
	for _, c := range list {
		if c.ID == created.ID.String() {
			found = true
			if c.Name != "test-iso" {
				t.Errorf("Name = %q, want %q", c.Name, "test-iso")
			}
		}
	}
	if !found {
		t.Errorf("List() does not contain created CD-ROM %q: %+v", created.ID, list)
	}
}
