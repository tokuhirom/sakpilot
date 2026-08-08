package sakura

import (
	"context"
	"testing"

	"github.com/sacloud/sacloud-sdk-go/api/iaas"
	"github.com/sacloud/sacloud-sdk-go/api/iaas/fake"
)

// newTestDiskService はfakeドライバに切り替えたDiskServiceを返す。
// fake.InitDataStore はプロセス内でsync.Onceにより一度しか初期化されないため、
// データストアはテスト間で共有される。各テストはListの総件数に依存せず、
// 自身が作成したリソースをIDで参照して検証すること。
func newTestDiskService(t *testing.T) *DiskService {
	t.Helper()
	fake.SwitchFactoryFuncToFake()
	fake.InitDataStore()
	return NewDiskService(&Client{})
}

func createTestServer(ctx context.Context, zone string) (*iaas.Server, error) {
	serverOp := iaas.NewServerOp(nil)
	return serverOp.Create(ctx, zone, &iaas.ServerCreateRequest{
		CPU:      1,
		MemoryMB: 1024,
		Name:     "test-server",
	})
}

func TestDiskService_Create(t *testing.T) {
	service := newTestDiskService(t)
	ctx := context.Background()

	disk, err := service.Create(ctx, "is1a", "test-disk", "test description", []string{"tag1"}, 20, "ssd", "virtio", "", "")
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if disk.Name != "test-disk" {
		t.Errorf("Name = %q, want %q", disk.Name, "test-disk")
	}
	if disk.SizeGB != 20 {
		t.Errorf("SizeGB = %d, want 20", disk.SizeGB)
	}
	if disk.Connection != "virtio" {
		t.Errorf("Connection = %q, want %q", disk.Connection, "virtio")
	}

	disks, err := service.List(ctx, "is1a")
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if !containsDiskID(disks, disk.ID) {
		t.Errorf("List() does not contain created disk %q: %+v", disk.ID, disks)
	}
}

func containsDiskID(disks []DiskInfo, id string) bool {
	for _, d := range disks {
		if d.ID == id {
			return true
		}
	}
	return false
}

func TestDiskService_Get(t *testing.T) {
	service := newTestDiskService(t)
	ctx := context.Background()

	created, err := service.Create(ctx, "is1a", "test-disk", "", nil, 20, "ssd", "virtio", "", "")
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	got, err := service.Get(ctx, "is1a", created.ID)
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if got.ID != created.ID {
		t.Errorf("ID = %q, want %q", got.ID, created.ID)
	}
	if got.Name != "test-disk" {
		t.Errorf("Name = %q, want %q", got.Name, "test-disk")
	}
}

func TestDiskService_Update(t *testing.T) {
	service := newTestDiskService(t)
	ctx := context.Background()

	created, err := service.Create(ctx, "is1a", "before", "before-desc", nil, 20, "ssd", "virtio", "", "")
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	updated, err := service.Update(ctx, "is1a", created.ID, "after", "after-desc", []string{"updated"})
	if err != nil {
		t.Fatalf("Update: %v", err)
	}
	if updated.Name != "after" {
		t.Errorf("Name = %q, want %q", updated.Name, "after")
	}
	if updated.Description != "after-desc" {
		t.Errorf("Description = %q, want %q", updated.Description, "after-desc")
	}
}

func TestDiskService_ConnectAndDisconnectServer(t *testing.T) {
	service := newTestDiskService(t)
	ctx := context.Background()

	created, err := service.Create(ctx, "is1a", "test-disk", "", nil, 20, "ssd", "virtio", "", "")
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if created.ServerID != "" {
		t.Fatalf("ServerID = %q, want empty before connect", created.ServerID)
	}

	server, err := createTestServer(ctx, "is1a")
	if err != nil {
		t.Fatalf("createTestServer: %v", err)
	}

	if err := service.ConnectToServer(ctx, "is1a", created.ID, server.ID.String()); err != nil {
		t.Fatalf("ConnectToServer: %v", err)
	}

	got, err := service.Get(ctx, "is1a", created.ID)
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if got.ServerID != server.ID.String() {
		t.Errorf("ServerID = %q, want %q", got.ServerID, server.ID.String())
	}

	if err := service.DisconnectFromServer(ctx, "is1a", created.ID); err != nil {
		t.Fatalf("DisconnectFromServer: %v", err)
	}

	got, err = service.Get(ctx, "is1a", created.ID)
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if got.ServerID != "" {
		t.Errorf("ServerID = %q, want empty after disconnect", got.ServerID)
	}
}

func TestDiskService_Delete(t *testing.T) {
	service := newTestDiskService(t)
	ctx := context.Background()

	created, err := service.Create(ctx, "is1a", "test-disk", "", nil, 20, "ssd", "virtio", "", "")
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	if err := service.Delete(ctx, "is1a", created.ID); err != nil {
		t.Fatalf("Delete: %v", err)
	}

	if _, err := service.Get(ctx, "is1a", created.ID); err == nil {
		t.Error("Get after Delete: got nil error, want not-found error")
	}
}
