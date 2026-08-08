package sakura

import (
	"context"
	"testing"

	"github.com/sacloud/sacloud-sdk-go/api/iaas"
	"github.com/sacloud/sacloud-sdk-go/api/iaas/fake"
	"github.com/sacloud/sacloud-sdk-go/api/iaas/types"
)

// newTestDatabaseService はfakeドライバに切り替えたDatabaseServiceを返す。
// fake.InitDataStore はプロセス内でsync.Onceにより一度しか初期化されないため、
// データストアはテスト間で共有される。各テストはListの総件数に依存せず、
// 自身が作成したリソースをIDで参照して検証すること。
func newTestDatabaseService(t *testing.T) *DatabaseService {
	t.Helper()
	fake.SwitchFactoryFuncToFake()
	fake.InitDataStore()
	return NewDatabaseService(&Client{})
}

func createTestSwitchForDatabase(ctx context.Context, zone string) (*iaas.Switch, error) {
	swOp := iaas.NewSwitchOp(nil)
	return swOp.Create(ctx, zone, &iaas.SwitchCreateRequest{
		Name: "test-switch",
	})
}

func testCreateDatabaseParams(switchID string) CreateDatabaseParams {
	return CreateDatabaseParams{
		Name:           "test-db",
		Description:    "test description",
		Tags:           []string{"tag1"},
		Plan:           "10g",
		SwitchID:       switchID,
		IPAddress:      "192.168.0.11",
		NetworkMaskLen: 24,
		DefaultRoute:   "192.168.0.1",
		RDBMSType:      "mariadb",
		DefaultUser:    "testuser",
		UserPassword:   "TestPassword01",
		ServicePort:    3306,
	}
}

func TestDatabaseService_Create(t *testing.T) {
	service := newTestDatabaseService(t)
	ctx := context.Background()

	sw, err := createTestSwitchForDatabase(ctx, "is1a")
	if err != nil {
		t.Fatalf("createTestSwitchForDatabase: %v", err)
	}

	db, err := service.Create(ctx, "is1a", testCreateDatabaseParams(sw.ID.String()))
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if db.Name != "test-db" {
		t.Errorf("Name = %q, want %q", db.Name, "test-db")
	}
	if db.PlanID != types.DatabasePlans.DB10GB.String() {
		t.Errorf("PlanID = %q, want %q", db.PlanID, types.DatabasePlans.DB10GB.String())
	}
	if db.RDBMSType != "MariaDB" {
		t.Errorf("RDBMSType = %q, want %q", db.RDBMSType, "MariaDB")
	}
	if db.DefaultUser != "testuser" {
		t.Errorf("DefaultUser = %q, want %q", db.DefaultUser, "testuser")
	}
	if db.ServicePort != 3306 {
		t.Errorf("ServicePort = %d, want 3306", db.ServicePort)
	}

	list, err := service.List(ctx, "is1a")
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if !containsDatabaseID(list, db.ID) {
		t.Errorf("List() does not contain created database %q: %+v", db.ID, list)
	}
}

func containsDatabaseID(list []DatabaseInfo, id string) bool {
	for _, d := range list {
		if d.ID == id {
			return true
		}
	}
	return false
}

func TestDatabaseService_Get(t *testing.T) {
	service := newTestDatabaseService(t)
	ctx := context.Background()

	sw, err := createTestSwitchForDatabase(ctx, "is1a")
	if err != nil {
		t.Fatalf("createTestSwitchForDatabase: %v", err)
	}
	created, err := service.Create(ctx, "is1a", testCreateDatabaseParams(sw.ID.String()))
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
	if got.Name != "test-db" {
		t.Errorf("Name = %q, want %q", got.Name, "test-db")
	}
}

func TestDatabaseService_Update(t *testing.T) {
	service := newTestDatabaseService(t)
	ctx := context.Background()

	sw, err := createTestSwitchForDatabase(ctx, "is1a")
	if err != nil {
		t.Fatalf("createTestSwitchForDatabase: %v", err)
	}
	created, err := service.Create(ctx, "is1a", testCreateDatabaseParams(sw.ID.String()))
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
	// Update後も稼働設定(CommonSetting)が維持されていること
	if updated.DefaultUser != "testuser" {
		t.Errorf("DefaultUser = %q, want %q (must be preserved after Update)", updated.DefaultUser, "testuser")
	}
	if updated.ServicePort != 3306 {
		t.Errorf("ServicePort = %d, want 3306 (must be preserved after Update)", updated.ServicePort)
	}
}

func TestDatabaseService_UpdateSettings(t *testing.T) {
	service := newTestDatabaseService(t)
	ctx := context.Background()

	sw, err := createTestSwitchForDatabase(ctx, "is1a")
	if err != nil {
		t.Fatalf("createTestSwitchForDatabase: %v", err)
	}
	created, err := service.Create(ctx, "is1a", testCreateDatabaseParams(sw.ID.String()))
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	updated, err := service.UpdateSettings(ctx, "is1a", created.ID, DatabaseSettingsParams{
		DefaultUser:            "newuser",
		UserPassword:           "NewPassword01",
		ServicePort:            5432,
		MonitoringSuiteEnabled: true,
	})
	if err != nil {
		t.Fatalf("UpdateSettings: %v", err)
	}
	if updated.DefaultUser != "newuser" {
		t.Errorf("DefaultUser = %q, want %q", updated.DefaultUser, "newuser")
	}
	if updated.ServicePort != 5432 {
		t.Errorf("ServicePort = %d, want 5432", updated.ServicePort)
	}
	if !updated.MonitoringSuiteEnabled {
		t.Error("MonitoringSuiteEnabled = false, want true")
	}
	// UpdateSettings後も名前・説明が維持されていること
	if updated.Name != "test-db" {
		t.Errorf("Name = %q, want %q (must be preserved after UpdateSettings)", updated.Name, "test-db")
	}
}

func TestDatabaseService_UpdateSettings_PreservesPasswordWhenBlank(t *testing.T) {
	service := newTestDatabaseService(t)
	ctx := context.Background()

	sw, err := createTestSwitchForDatabase(ctx, "is1a")
	if err != nil {
		t.Fatalf("createTestSwitchForDatabase: %v", err)
	}
	created, err := service.Create(ctx, "is1a", testCreateDatabaseParams(sw.ID.String()))
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	// UserPassword/ReplicaPasswordを空欄で送っても既存のCommonSettingを維持できることを、
	// fakeドライバのReadが元のUserPasswordを返し続ける(=UpdateSettingsで上書きされていない)ことで確認する
	if _, err := service.UpdateSettings(ctx, "is1a", created.ID, DatabaseSettingsParams{
		DefaultUser: "testuser",
		ServicePort: 3306,
	}); err != nil {
		t.Fatalf("UpdateSettings: %v", err)
	}

	dbOp := iaas.NewDatabaseOp(nil)
	got, err := dbOp.Read(ctx, "is1a", types.StringID(created.ID))
	if err != nil {
		t.Fatalf("Read: %v", err)
	}
	if got.CommonSetting.UserPassword != "TestPassword01" {
		t.Errorf("CommonSetting.UserPassword = %q, want %q (must be preserved when blank)", got.CommonSetting.UserPassword, "TestPassword01")
	}
}

func TestDatabaseService_GetAndSetParameter(t *testing.T) {
	service := newTestDatabaseService(t)
	ctx := context.Background()

	sw, err := createTestSwitchForDatabase(ctx, "is1a")
	if err != nil {
		t.Fatalf("createTestSwitchForDatabase: %v", err)
	}
	created, err := service.Create(ctx, "is1a", testCreateDatabaseParams(sw.ID.String()))
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	param, err := service.GetParameter(ctx, "is1a", created.ID)
	if err != nil {
		t.Fatalf("GetParameter: %v", err)
	}
	if len(param.Meta) == 0 {
		t.Error("Meta is empty, want at least one parameter definition")
	}

	if err := service.SetParameter(ctx, "is1a", created.ID, map[string]any{
		"MariaDB/server.cnf/mysqld/max_connections": 50,
	}); err != nil {
		t.Fatalf("SetParameter: %v", err)
	}

	param, err = service.GetParameter(ctx, "is1a", created.ID)
	if err != nil {
		t.Fatalf("GetParameter after SetParameter: %v", err)
	}
	if len(param.Settings) != 1 {
		t.Fatalf("Settings = %+v, want 1 entry", param.Settings)
	}
	if param.Settings["MariaDB/server.cnf/mysqld/max_connections"] != float64(50) {
		t.Errorf("Settings[max_connections] = %v, want 50", param.Settings["MariaDB/server.cnf/mysqld/max_connections"])
	}

	// nilを送るとリセットされる
	if err := service.SetParameter(ctx, "is1a", created.ID, map[string]any{
		"MariaDB/server.cnf/mysqld/max_connections": nil,
	}); err != nil {
		t.Fatalf("SetParameter (reset): %v", err)
	}
	param, err = service.GetParameter(ctx, "is1a", created.ID)
	if err != nil {
		t.Fatalf("GetParameter after reset: %v", err)
	}
	if len(param.Settings) != 0 {
		t.Errorf("Settings = %+v, want empty after reset", param.Settings)
	}
}

func TestDatabaseService_Delete(t *testing.T) {
	service := newTestDatabaseService(t)
	ctx := context.Background()

	sw, err := createTestSwitchForDatabase(ctx, "is1a")
	if err != nil {
		t.Fatalf("createTestSwitchForDatabase: %v", err)
	}
	created, err := service.Create(ctx, "is1a", testCreateDatabaseParams(sw.ID.String()))
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
