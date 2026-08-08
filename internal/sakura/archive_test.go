package sakura

import (
	"context"
	"testing"

	"github.com/sacloud/sacloud-sdk-go/api/iaas"
	"github.com/sacloud/sacloud-sdk-go/api/iaas/fake"
)

func newTestArchiveService(t *testing.T) *ArchiveService {
	t.Helper()
	fake.SwitchFactoryFuncToFake()
	fake.InitDataStore()
	return NewArchiveService(&Client{})
}

func TestArchiveService_CreateBlank(t *testing.T) {
	service := newTestArchiveService(t)
	ctx := context.Background()

	result, err := service.CreateBlank(ctx, "is1a", "test-archive", "test description", []string{"tag1"}, 20)
	if err != nil {
		t.Fatalf("CreateBlank: %v", err)
	}
	if result.Archive.Name != "test-archive" {
		t.Errorf("Name = %q, want %q", result.Archive.Name, "test-archive")
	}
	if result.Archive.SizeGB != 20 {
		t.Errorf("SizeGB = %d, want 20", result.Archive.SizeGB)
	}
	if result.FTPServer.HostName == "" {
		t.Errorf("FTPServer.HostName is empty")
	}
	if result.FTPServer.User == "" {
		t.Errorf("FTPServer.User is empty")
	}

	archives, err := service.List(ctx, "is1a")
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if !containsArchiveID(archives, result.Archive.ID) {
		t.Errorf("List() does not contain created archive %q: %+v", result.Archive.ID, archives)
	}
}

func containsArchiveID(archives []ArchiveInfo, id string) bool {
	for _, a := range archives {
		if a.ID == id {
			return true
		}
	}
	return false
}

func TestArchiveService_CreateFromDisk(t *testing.T) {
	service := newTestArchiveService(t)
	ctx := context.Background()

	diskOp := iaas.NewDiskOp(nil)
	disk, err := diskOp.Create(ctx, "is1a", &iaas.DiskCreateRequest{
		Name:   "test-disk",
		SizeMB: 20 * 1024,
	}, nil, 0)
	if err != nil {
		t.Fatalf("create test disk: %v", err)
	}

	archive, err := service.Create(ctx, "is1a", "from-disk", "", nil, disk.ID.String(), "")
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if archive.Name != "from-disk" {
		t.Errorf("Name = %q, want %q", archive.Name, "from-disk")
	}
}

func TestArchiveService_OpenCloseFTP(t *testing.T) {
	service := newTestArchiveService(t)
	ctx := context.Background()

	result, err := service.CreateBlank(ctx, "is1a", "ftp-archive", "", nil, 20)
	if err != nil {
		t.Fatalf("CreateBlank: %v", err)
	}

	ftp, err := service.OpenFTP(ctx, "is1a", result.Archive.ID, false)
	if err != nil {
		t.Fatalf("OpenFTP: %v", err)
	}
	if ftp.HostName == "" {
		t.Errorf("FTPServer.HostName is empty")
	}

	if err := service.CloseFTP(ctx, "is1a", result.Archive.ID); err != nil {
		t.Fatalf("CloseFTP: %v", err)
	}
}

func TestArchiveService_Share(t *testing.T) {
	service := newTestArchiveService(t)
	ctx := context.Background()

	result, err := service.CreateBlank(ctx, "is1a", "share-archive", "", nil, 20)
	if err != nil {
		t.Fatalf("CreateBlank: %v", err)
	}

	key, err := service.Share(ctx, "is1a", result.Archive.ID)
	if err != nil {
		t.Fatalf("Share: %v", err)
	}
	if key == "" {
		t.Errorf("Share() returned empty key")
	}
}

func TestArchiveService_CreateFromShared(t *testing.T) {
	service := newTestArchiveService(t)
	ctx := context.Background()

	result, err := service.CreateBlank(ctx, "is1a", "shared-source", "", nil, 20)
	if err != nil {
		t.Fatalf("CreateBlank: %v", err)
	}
	key, err := service.Share(ctx, "is1a", result.Archive.ID)
	if err != nil {
		t.Fatalf("Share: %v", err)
	}

	archive, err := service.CreateFromShared(ctx, "tk1a", key, "shared-copy", "copied", []string{"shared"})
	if err != nil {
		t.Fatalf("CreateFromShared: %v", err)
	}
	if archive.Name != "shared-copy" {
		t.Errorf("Name = %q, want %q", archive.Name, "shared-copy")
	}

	if _, err := service.CreateFromShared(ctx, "tk1a", "invalid-key", "x", "", nil); err == nil {
		t.Errorf("CreateFromShared() with invalid key: want error, got nil")
	}
	if _, err := service.CreateFromShared(ctx, "no-such-zone", key, "x", "", nil); err == nil {
		t.Errorf("CreateFromShared() with unknown zone: want error, got nil")
	}
}
