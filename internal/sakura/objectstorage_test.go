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
