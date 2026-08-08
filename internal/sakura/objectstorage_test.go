package sakura

import (
	"context"
	"testing"

	sdkobjectstorage "github.com/sacloud/sacloud-sdk-go/api/object-storage"
	"github.com/sacloud/sacloud-sdk-go/common/saclient"
	mockobjectstorage "github.com/sacloud/sakumock/objectstorage"
)

func TestObjectStorageService_ListSites(t *testing.T) {
	srv := mockobjectstorage.NewTestServer(mockobjectstorage.Config{})
	defer srv.Close()

	t.Setenv("SAKURA_ENDPOINTS_OBJECT_STORAGE", srv.TestURL())

	client := &Client{accessToken: "dummy", accessTokenSecret: "dummy"}
	service := NewObjectStorageService(client)

	sites, err := service.ListSites(context.Background())
	if err != nil {
		t.Fatalf("ListSites: %v", err)
	}

	// sakumock seeds three fixed sites (isk01, tky01, arc02).
	if len(sites) != 3 {
		t.Fatalf("got %d sites, want 3: %+v", len(sites), sites)
	}

	var isk01 *SiteInfo
	for i := range sites {
		if sites[i].ID == "isk01" {
			isk01 = &sites[i]
		}
	}
	if isk01 == nil {
		t.Fatalf("isk01 not found in %+v", sites)
	}
	if isk01.DisplayName != "石狩第1サイト" {
		t.Errorf("DisplayName = %q, want %q", isk01.DisplayName, "石狩第1サイト")
	}
	if isk01.Endpoint != "s3.isk01.objectstorage.sakurastorage.jp" {
		t.Errorf("Endpoint = %q, want %q", isk01.Endpoint, "s3.isk01.objectstorage.sakurastorage.jp")
	}
}

func TestObjectStorageService_ListAccessKeys_Empty(t *testing.T) {
	srv := mockobjectstorage.NewTestServer(mockobjectstorage.Config{})
	defer srv.Close()

	t.Setenv("SAKURA_ENDPOINTS_OBJECT_STORAGE", srv.TestURL())

	// The mock 404s "account does not exist" until an account is created for
	// the site, so seed one directly through the SDK before listing keys.
	var sc saclient.Client
	if err := sc.SetEnviron([]string{
		"SAKURA_ACCESS_TOKEN=dummy",
		"SAKURA_ACCESS_TOKEN_SECRET=dummy",
		"SAKURA_ENDPOINTS_OBJECT_STORAGE=" + srv.TestURL(),
	}); err != nil {
		t.Fatalf("SetEnviron: %v", err)
	}
	siteClient, err := sdkobjectstorage.NewSiteClient(&sc, "isk01")
	if err != nil {
		t.Fatalf("NewSiteClient: %v", err)
	}
	if _, err := sdkobjectstorage.NewAccountOp(siteClient).Create(context.Background()); err != nil {
		t.Fatalf("seed account Create: %v", err)
	}

	client := &Client{accessToken: "dummy", accessTokenSecret: "dummy"}
	service := NewObjectStorageService(client)

	keys, err := service.ListAccessKeys(context.Background(), "isk01")
	if err != nil {
		t.Fatalf("ListAccessKeys: %v", err)
	}
	if len(keys) != 0 {
		t.Errorf("got %d keys, want 0: %+v", len(keys), keys)
	}
}

func TestObjectStorageService_CreateAccessKey(t *testing.T) {
	srv := mockobjectstorage.NewTestServer(mockobjectstorage.Config{})
	defer srv.Close()

	t.Setenv("SAKURA_ENDPOINTS_OBJECT_STORAGE", srv.TestURL())

	client := &Client{accessToken: "dummy", accessTokenSecret: "dummy"}
	service := NewObjectStorageService(client)

	// No account exists yet for this site; CreateAccessKey must create one
	// implicitly before creating the key.
	created, err := service.CreateAccessKey(context.Background(), "isk01")
	if err != nil {
		t.Fatalf("CreateAccessKey: %v", err)
	}
	if created.ID == "" {
		t.Errorf("ID is empty: %+v", created)
	}
	if created.Secret == "" {
		t.Errorf("Secret is empty: %+v", created)
	}

	keys, err := service.ListAccessKeys(context.Background(), "isk01")
	if err != nil {
		t.Fatalf("ListAccessKeys: %v", err)
	}
	if len(keys) != 1 {
		t.Fatalf("got %d keys, want 1: %+v", len(keys), keys)
	}
	if keys[0].ID != created.ID {
		t.Errorf("ID = %q, want %q", keys[0].ID, created.ID)
	}
}

func TestObjectStorageService_DeleteAccessKey(t *testing.T) {
	srv := mockobjectstorage.NewTestServer(mockobjectstorage.Config{})
	defer srv.Close()

	t.Setenv("SAKURA_ENDPOINTS_OBJECT_STORAGE", srv.TestURL())

	client := &Client{accessToken: "dummy", accessTokenSecret: "dummy"}
	service := NewObjectStorageService(client)

	created, err := service.CreateAccessKey(context.Background(), "isk01")
	if err != nil {
		t.Fatalf("CreateAccessKey: %v", err)
	}

	if err := service.DeleteAccessKey(context.Background(), "isk01", created.ID); err != nil {
		t.Fatalf("DeleteAccessKey: %v", err)
	}

	keys, err := service.ListAccessKeys(context.Background(), "isk01")
	if err != nil {
		t.Fatalf("ListAccessKeys: %v", err)
	}
	if len(keys) != 0 {
		t.Errorf("got %d keys, want 0 after delete: %+v", len(keys), keys)
	}
}

func TestObjectStorageService_CreateBucket_And_Delete(t *testing.T) {
	srv := mockobjectstorage.NewTestServer(mockobjectstorage.Config{})
	defer srv.Close()

	t.Setenv("SAKURA_ENDPOINTS_OBJECT_STORAGE", srv.TestURL())

	client := &Client{accessToken: "dummy", accessTokenSecret: "dummy"}
	service := NewObjectStorageService(client)

	bucketName := "sakpilot-test-bucket"
	if err := service.CreateBucket(context.Background(), "isk01", bucketName, ""); err != nil {
		t.Fatalf("CreateBucket: %v", err)
	}

	if err := service.DeleteBucket(context.Background(), "isk01", bucketName); err != nil {
		t.Fatalf("DeleteBucket: %v", err)
	}
}

func TestObjectStorageService_ReadAccount_And_Delete(t *testing.T) {
	srv := mockobjectstorage.NewTestServer(mockobjectstorage.Config{})
	defer srv.Close()

	t.Setenv("SAKURA_ENDPOINTS_OBJECT_STORAGE", srv.TestURL())

	client := &Client{accessToken: "dummy", accessTokenSecret: "dummy"}
	service := NewObjectStorageService(client)

	// No account exists yet - CreateAccessKey creates one implicitly.
	if _, err := service.CreateAccessKey(context.Background(), "isk01"); err != nil {
		t.Fatalf("CreateAccessKey: %v", err)
	}

	account, err := service.ReadAccount(context.Background(), "isk01")
	if err != nil {
		t.Fatalf("ReadAccount: %v", err)
	}
	if account.SiteID != "isk01" {
		t.Errorf("SiteID = %q, want %q", account.SiteID, "isk01")
	}

	if err := service.DeleteAccount(context.Background(), "isk01"); err != nil {
		t.Fatalf("DeleteAccount: %v", err)
	}

	if _, err := service.ReadAccount(context.Background(), "isk01"); err == nil {
		t.Errorf("ReadAccount after Delete: want error, got nil")
	}
}

func TestObjectStorageService_Permission_CRUD(t *testing.T) {
	srv := mockobjectstorage.NewTestServer(mockobjectstorage.Config{})
	defer srv.Close()

	t.Setenv("SAKURA_ENDPOINTS_OBJECT_STORAGE", srv.TestURL())

	client := &Client{accessToken: "dummy", accessTokenSecret: "dummy"}
	service := NewObjectStorageService(client)

	controls := []BucketControlInfo{{BucketName: "my-bucket", CanRead: true, CanWrite: false}}
	created, err := service.CreatePermission(context.Background(), "isk01", "readonly", controls)
	if err != nil {
		t.Fatalf("CreatePermission: %v", err)
	}
	if created.DisplayName != "readonly" {
		t.Errorf("DisplayName = %q, want %q", created.DisplayName, "readonly")
	}
	if len(created.BucketControls) != 1 || created.BucketControls[0].BucketName != "my-bucket" || !created.BucketControls[0].CanRead || created.BucketControls[0].CanWrite {
		t.Errorf("BucketControls = %+v, want [{my-bucket true false}]", created.BucketControls)
	}

	list, err := service.ListPermissions(context.Background(), "isk01")
	if err != nil {
		t.Fatalf("ListPermissions: %v", err)
	}
	if len(list) != 1 || list[0].ID != created.ID {
		t.Fatalf("ListPermissions = %+v, want one entry with ID %q", list, created.ID)
	}

	updated, err := service.UpdatePermission(context.Background(), "isk01", created.ID, "readwrite", []BucketControlInfo{
		{BucketName: "my-bucket", CanRead: true, CanWrite: true},
	})
	if err != nil {
		t.Fatalf("UpdatePermission: %v", err)
	}
	if updated.DisplayName != "readwrite" || !updated.BucketControls[0].CanWrite {
		t.Errorf("updated = %+v, want display name readwrite with CanWrite=true", updated)
	}

	key, err := service.CreatePermissionAccessKey(context.Background(), "isk01", created.ID)
	if err != nil {
		t.Fatalf("CreatePermissionAccessKey: %v", err)
	}
	if key.ID == "" || key.Secret == "" {
		t.Errorf("key = %+v, want non-empty ID and Secret", key)
	}

	keys, err := service.ListPermissionAccessKeys(context.Background(), "isk01", created.ID)
	if err != nil {
		t.Fatalf("ListPermissionAccessKeys: %v", err)
	}
	if len(keys) != 1 || keys[0].ID != key.ID {
		t.Fatalf("ListPermissionAccessKeys = %+v, want one entry with ID %q", keys, key.ID)
	}

	if err := service.DeletePermissionAccessKey(context.Background(), "isk01", created.ID, key.ID); err != nil {
		t.Fatalf("DeletePermissionAccessKey: %v", err)
	}
	keys, err = service.ListPermissionAccessKeys(context.Background(), "isk01", created.ID)
	if err != nil {
		t.Fatalf("ListPermissionAccessKeys after delete: %v", err)
	}
	if len(keys) != 0 {
		t.Errorf("got %d keys, want 0 after delete: %+v", len(keys), keys)
	}

	if err := service.DeletePermission(context.Background(), "isk01", created.ID); err != nil {
		t.Fatalf("DeletePermission: %v", err)
	}
	list, err = service.ListPermissions(context.Background(), "isk01")
	if err != nil {
		t.Fatalf("ListPermissions after delete: %v", err)
	}
	if len(list) != 0 {
		t.Errorf("got %d permissions, want 0 after delete: %+v", len(list), list)
	}
}

func TestObjectStorageService_BucketEncryption(t *testing.T) {
	srv := mockobjectstorage.NewTestServer(mockobjectstorage.Config{})
	defer srv.Close()

	t.Setenv("SAKURA_ENDPOINTS_OBJECT_STORAGE", srv.TestURL())

	client := &Client{accessToken: "dummy", accessTokenSecret: "dummy"}
	service := NewObjectStorageService(client)

	bucketName := "sakpilot-encryption-test"
	if err := service.CreateBucket(context.Background(), "isk01", bucketName, ""); err != nil {
		t.Fatalf("CreateBucket: %v", err)
	}

	enc, err := service.ReadBucketEncryption(context.Background(), "isk01", bucketName)
	if err != nil {
		t.Fatalf("ReadBucketEncryption (unconfigured): %v", err)
	}
	if enc.Enabled {
		t.Errorf("Enabled = true before configuration, want false: %+v", enc)
	}

	const kmsKeyID = "123456789012" // KMS resource IDs are numeric on the wire.
	if err := service.EnableBucketEncryption(context.Background(), "isk01", bucketName, kmsKeyID); err != nil {
		t.Fatalf("EnableBucketEncryption: %v", err)
	}

	enc, err = service.ReadBucketEncryption(context.Background(), "isk01", bucketName)
	if err != nil {
		t.Fatalf("ReadBucketEncryption (configured): %v", err)
	}
	if !enc.Enabled || enc.KMSKeyID != kmsKeyID {
		t.Errorf("enc = %+v, want Enabled=true KMSKeyID=%s", enc, kmsKeyID)
	}

	if err := service.DisableBucketEncryption(context.Background(), "isk01", bucketName); err != nil {
		t.Fatalf("DisableBucketEncryption: %v", err)
	}

	enc, err = service.ReadBucketEncryption(context.Background(), "isk01", bucketName)
	if err != nil {
		t.Fatalf("ReadBucketEncryption (after disable): %v", err)
	}
	if enc.Enabled {
		t.Errorf("Enabled = true after disable, want false: %+v", enc)
	}
}

func TestObjectStorageService_BucketReplication(t *testing.T) {
	srv := mockobjectstorage.NewTestServer(mockobjectstorage.Config{})
	defer srv.Close()

	t.Setenv("SAKURA_ENDPOINTS_OBJECT_STORAGE", srv.TestURL())

	client := &Client{accessToken: "dummy", accessTokenSecret: "dummy"}
	service := NewObjectStorageService(client)

	srcBucket := "sakpilot-replication-src"
	destBucket := "sakpilot-replication-dest"
	if err := service.CreateBucket(context.Background(), "isk01", srcBucket, ""); err != nil {
		t.Fatalf("CreateBucket(src): %v", err)
	}
	if err := service.CreateBucket(context.Background(), "isk01", destBucket, ""); err != nil {
		t.Fatalf("CreateBucket(dest): %v", err)
	}

	repl, err := service.ReadBucketReplication(context.Background(), "isk01", srcBucket)
	if err != nil {
		t.Fatalf("ReadBucketReplication (unconfigured): %v", err)
	}
	if repl.Enabled {
		t.Errorf("Enabled = true before configuration, want false: %+v", repl)
	}

	enabled, err := service.EnableBucketReplication(context.Background(), "isk01", srcBucket, destBucket)
	if err != nil {
		t.Fatalf("EnableBucketReplication: %v", err)
	}
	if !enabled.Enabled || enabled.DestBucketName != destBucket {
		t.Errorf("enabled = %+v, want Enabled=true DestBucketName=%q", enabled, destBucket)
	}

	if err := service.DisableBucketReplication(context.Background(), "isk01", srcBucket); err != nil {
		t.Fatalf("DisableBucketReplication: %v", err)
	}

	repl, err = service.ReadBucketReplication(context.Background(), "isk01", srcBucket)
	if err != nil {
		t.Fatalf("ReadBucketReplication (after disable): %v", err)
	}
	if repl.Enabled {
		t.Errorf("Enabled = true after disable, want false: %+v", repl)
	}
}

func TestObjectStorageService_ReadBucketQuota(t *testing.T) {
	srv := mockobjectstorage.NewTestServer(mockobjectstorage.Config{})
	defer srv.Close()

	t.Setenv("SAKURA_ENDPOINTS_OBJECT_STORAGE", srv.TestURL())

	client := &Client{accessToken: "dummy", accessTokenSecret: "dummy"}
	service := NewObjectStorageService(client)

	bucketName := "sakpilot-quota-test"
	if err := service.CreateBucket(context.Background(), "isk01", bucketName, ""); err != nil {
		t.Fatalf("CreateBucket: %v", err)
	}

	quota, err := service.ReadBucketQuota(context.Background(), "isk01", bucketName)
	if err != nil {
		t.Fatalf("ReadBucketQuota: %v", err)
	}
	if quota.NumObjectsPerBucket <= 0 || quota.AmountGibPerBucket <= 0 {
		t.Errorf("quota = %+v, want positive limits", quota)
	}
}
