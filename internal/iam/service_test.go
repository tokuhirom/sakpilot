package iam_test

import (
	"context"
	"testing"

	sdkiam "github.com/sacloud/sacloud-sdk-go/api/iam"
	iamuser "github.com/sacloud/sacloud-sdk-go/api/iam/apis/user"
	"github.com/sacloud/sacloud-sdk-go/common/saclient"
	mockiam "github.com/sacloud/sakumock/iam"

	"sakpilot/internal/iam"
)

// newTestSaclient builds a saclient.Client pointed at the sakumock IAM test
// server, mirroring how internal/iam.Service authenticates in production.
func newTestSaclient(t *testing.T, endpoint string) *saclient.Client {
	t.Helper()
	var sc saclient.Client
	if err := sc.SetEnviron([]string{
		"SAKURA_ACCESS_TOKEN=dummy",
		"SAKURA_ACCESS_TOKEN_SECRET=dummy",
		"SAKURA_ENDPOINTS_IAM=" + endpoint,
	}); err != nil {
		t.Fatalf("SetEnviron: %v", err)
	}
	return &sc
}

func TestService_ListUsers(t *testing.T) {
	srv := mockiam.NewTestServer(mockiam.Config{})
	defer srv.Close()

	sc := newTestSaclient(t, srv.TestURL())
	rawClient, err := sdkiam.NewClient(sc)
	if err != nil {
		t.Fatalf("sdkiam.NewClient: %v", err)
	}
	userOp := sdkiam.NewUserOp(rawClient)
	email := "test-user@example.com"
	created, err := userOp.Create(context.Background(), iamuser.CreateParams{
		Name:        "test-user",
		Password:    "Password12345!",
		Code:        "test-code",
		Description: "a test user",
		Email:       &email,
	})
	if err != nil {
		t.Fatalf("seed Create: %v", err)
	}

	profileName := writeUsacloudProfile(t, "dummy", "dummy")
	t.Setenv("SAKURA_ENDPOINTS_IAM", srv.TestURL())

	service, err := iam.NewService(profileName)
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}

	users, err := service.ListUsers(context.Background())
	if err != nil {
		t.Fatalf("ListUsers: %v", err)
	}
	if len(users) != 1 {
		t.Fatalf("got %d users, want 1: %+v", len(users), users)
	}

	got := users[0]
	if got.ID != created.ID {
		t.Errorf("ID = %d, want %d", got.ID, created.ID)
	}
	if got.Name != "test-user" {
		t.Errorf("Name = %q, want %q", got.Name, "test-user")
	}
	if got.Code != "test-code" {
		t.Errorf("Code = %q, want %q", got.Code, "test-code")
	}
	if got.Description != "a test user" {
		t.Errorf("Description = %q, want %q", got.Description, "a test user")
	}
}

func TestService_GetUser(t *testing.T) {
	srv := mockiam.NewTestServer(mockiam.Config{})
	defer srv.Close()

	sc := newTestSaclient(t, srv.TestURL())
	rawClient, err := sdkiam.NewClient(sc)
	if err != nil {
		t.Fatalf("sdkiam.NewClient: %v", err)
	}
	userOp := sdkiam.NewUserOp(rawClient)
	created, err := userOp.Create(context.Background(), iamuser.CreateParams{
		Name:     "test-user",
		Password: "Password12345!",
		Code:     "test-code",
	})
	if err != nil {
		t.Fatalf("seed Create: %v", err)
	}

	profileName := writeUsacloudProfile(t, "dummy", "dummy")
	t.Setenv("SAKURA_ENDPOINTS_IAM", srv.TestURL())

	service, err := iam.NewService(profileName)
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}

	got, err := service.GetUser(context.Background(), created.ID)
	if err != nil {
		t.Fatalf("GetUser: %v", err)
	}
	if got.ID != created.ID {
		t.Errorf("ID = %d, want %d", got.ID, created.ID)
	}
	if got.Name != "test-user" {
		t.Errorf("Name = %q, want %q", got.Name, "test-user")
	}
}

func TestService_ListGroups(t *testing.T) {
	srv := mockiam.NewTestServer(mockiam.Config{})
	defer srv.Close()

	sc := newTestSaclient(t, srv.TestURL())
	rawClient, err := sdkiam.NewClient(sc)
	if err != nil {
		t.Fatalf("sdkiam.NewClient: %v", err)
	}
	groupOp := sdkiam.NewGroupOp(rawClient)
	created, err := groupOp.Create(context.Background(), "test-group", "a test group")
	if err != nil {
		t.Fatalf("seed Create: %v", err)
	}

	profileName := writeUsacloudProfile(t, "dummy", "dummy")
	t.Setenv("SAKURA_ENDPOINTS_IAM", srv.TestURL())

	service, err := iam.NewService(profileName)
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}

	groups, err := service.ListGroups(context.Background())
	if err != nil {
		t.Fatalf("ListGroups: %v", err)
	}
	if len(groups) != 1 {
		t.Fatalf("got %d groups, want 1: %+v", len(groups), groups)
	}
	if groups[0].ID != created.ID || groups[0].Name != "test-group" {
		t.Errorf("groups[0] = %+v, want ID=%d Name=test-group", groups[0], created.ID)
	}
}

func TestService_GetGroup(t *testing.T) {
	srv := mockiam.NewTestServer(mockiam.Config{})
	defer srv.Close()

	sc := newTestSaclient(t, srv.TestURL())
	rawClient, err := sdkiam.NewClient(sc)
	if err != nil {
		t.Fatalf("sdkiam.NewClient: %v", err)
	}
	groupOp := sdkiam.NewGroupOp(rawClient)
	created, err := groupOp.Create(context.Background(), "test-group", "a test group")
	if err != nil {
		t.Fatalf("seed Create: %v", err)
	}

	profileName := writeUsacloudProfile(t, "dummy", "dummy")
	t.Setenv("SAKURA_ENDPOINTS_IAM", srv.TestURL())

	service, err := iam.NewService(profileName)
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}

	got, err := service.GetGroup(context.Background(), created.ID)
	if err != nil {
		t.Fatalf("GetGroup: %v", err)
	}
	if got.ID != created.ID || got.Name != "test-group" {
		t.Errorf("got = %+v, want ID=%d Name=test-group", got, created.ID)
	}
}

func TestService_ListIAMRoles(t *testing.T) {
	srv := mockiam.NewTestServer(mockiam.Config{})
	defer srv.Close()

	profileName := writeUsacloudProfile(t, "dummy", "dummy")
	t.Setenv("SAKURA_ENDPOINTS_IAM", srv.TestURL())

	service, err := iam.NewService(profileName)
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}

	roles, err := service.ListIAMRoles(context.Background())
	if err != nil {
		t.Fatalf("ListIAMRoles: %v", err)
	}
	if len(roles) == 0 {
		t.Fatal("got 0 IAM roles, want the sakumock-seeded defaults")
	}
	found := false
	for _, r := range roles {
		if r.ID == "owner" {
			found = true
			if r.LowestGrantableResource != "project" {
				t.Errorf("owner LowestGrantableResource = %q, want %q", r.LowestGrantableResource, "project")
			}
		}
	}
	if !found {
		t.Errorf("owner role not found in %+v", roles)
	}
}

func TestService_ListIDRoles(t *testing.T) {
	srv := mockiam.NewTestServer(mockiam.Config{})
	defer srv.Close()

	profileName := writeUsacloudProfile(t, "dummy", "dummy")
	t.Setenv("SAKURA_ENDPOINTS_IAM", srv.TestURL())

	service, err := iam.NewService(profileName)
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}

	roles, err := service.ListIDRoles(context.Background())
	if err != nil {
		t.Fatalf("ListIDRoles: %v", err)
	}
	if len(roles) == 0 {
		t.Fatal("got 0 ID roles, want the sakumock-seeded defaults")
	}
	found := false
	for _, r := range roles {
		if r.ID == "admin" {
			found = true
		}
	}
	if !found {
		t.Errorf("admin role not found in %+v", roles)
	}
}

func TestService_ServicePrincipal_CRUD(t *testing.T) {
	srv := mockiam.NewTestServer(mockiam.Config{})
	defer srv.Close()

	profileName := writeUsacloudProfile(t, "dummy", "dummy")
	t.Setenv("SAKURA_ENDPOINTS_IAM", srv.TestURL())

	service, err := iam.NewService(profileName)
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}

	created, err := service.CreateServicePrincipal(context.Background(), 1, "test-sp", "a test service principal")
	if err != nil {
		t.Fatalf("CreateServicePrincipal: %v", err)
	}
	if created.ProjectID != 1 || created.Name != "test-sp" || created.Description != "a test service principal" {
		t.Errorf("created = %+v, want ProjectID=1 Name=test-sp Description=%q", created, "a test service principal")
	}

	list, err := service.ListServicePrincipals(context.Background())
	if err != nil {
		t.Fatalf("ListServicePrincipals: %v", err)
	}
	if len(list) != 1 || list[0].ID != created.ID {
		t.Fatalf("list = %+v, want 1 item with ID=%d", list, created.ID)
	}

	got, err := service.GetServicePrincipal(context.Background(), created.ID)
	if err != nil {
		t.Fatalf("GetServicePrincipal: %v", err)
	}
	if got.ID != created.ID || got.Name != "test-sp" {
		t.Errorf("got = %+v, want ID=%d Name=test-sp", got, created.ID)
	}

	updated, err := service.UpdateServicePrincipal(context.Background(), created.ID, "renamed-sp", "updated description")
	if err != nil {
		t.Fatalf("UpdateServicePrincipal: %v", err)
	}
	if updated.Name != "renamed-sp" || updated.Description != "updated description" {
		t.Errorf("updated = %+v, want Name=renamed-sp Description=%q", updated, "updated description")
	}

	if err := service.DeleteServicePrincipal(context.Background(), created.ID); err != nil {
		t.Fatalf("DeleteServicePrincipal: %v", err)
	}

	list, err = service.ListServicePrincipals(context.Background())
	if err != nil {
		t.Fatalf("ListServicePrincipals after delete: %v", err)
	}
	if len(list) != 0 {
		t.Fatalf("list after delete = %+v, want empty", list)
	}
}

func TestService_ServicePrincipal_KeyLifecycle(t *testing.T) {
	srv := mockiam.NewTestServer(mockiam.Config{})
	defer srv.Close()

	profileName := writeUsacloudProfile(t, "dummy", "dummy")
	t.Setenv("SAKURA_ENDPOINTS_IAM", srv.TestURL())

	service, err := iam.NewService(profileName)
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}

	sp, err := service.CreateServicePrincipal(context.Background(), 1, "test-sp", "")
	if err != nil {
		t.Fatalf("CreateServicePrincipal: %v", err)
	}

	keys, err := service.ListServicePrincipalKeys(context.Background(), sp.ID)
	if err != nil {
		t.Fatalf("ListServicePrincipalKeys: %v", err)
	}
	if len(keys) != 0 {
		t.Fatalf("keys = %+v, want empty before upload", keys)
	}

	uploaded, err := service.UploadServicePrincipalKey(context.Background(), sp.ID, "-----BEGIN PUBLIC KEY-----test-----END PUBLIC KEY-----")
	if err != nil {
		t.Fatalf("UploadServicePrincipalKey: %v", err)
	}
	if uploaded.Status != "enabled" {
		t.Errorf("uploaded.Status = %q, want enabled", uploaded.Status)
	}

	keys, err = service.ListServicePrincipalKeys(context.Background(), sp.ID)
	if err != nil {
		t.Fatalf("ListServicePrincipalKeys after upload: %v", err)
	}
	if len(keys) != 1 || keys[0].ID != uploaded.ID {
		t.Fatalf("keys = %+v, want 1 item with ID=%s", keys, uploaded.ID)
	}

	disabled, err := service.DisableServicePrincipalKey(context.Background(), sp.ID, uploaded.ID)
	if err != nil {
		t.Fatalf("DisableServicePrincipalKey: %v", err)
	}
	if disabled.Status != "disabled" {
		t.Errorf("disabled.Status = %q, want disabled", disabled.Status)
	}

	enabled, err := service.EnableServicePrincipalKey(context.Background(), sp.ID, uploaded.ID)
	if err != nil {
		t.Fatalf("EnableServicePrincipalKey: %v", err)
	}
	if enabled.Status != "enabled" {
		t.Errorf("enabled.Status = %q, want enabled", enabled.Status)
	}

	if err := service.DeleteServicePrincipalKey(context.Background(), sp.ID, uploaded.ID); err != nil {
		t.Fatalf("DeleteServicePrincipalKey: %v", err)
	}

	keys, err = service.ListServicePrincipalKeys(context.Background(), sp.ID)
	if err != nil {
		t.Fatalf("ListServicePrincipalKeys after delete: %v", err)
	}
	if len(keys) != 0 {
		t.Fatalf("keys after delete = %+v, want empty", keys)
	}
}

func TestService_Folder_CRUD(t *testing.T) {
	srv := mockiam.NewTestServer(mockiam.Config{})
	defer srv.Close()

	profileName := writeUsacloudProfile(t, "dummy", "dummy")
	t.Setenv("SAKURA_ENDPOINTS_IAM", srv.TestURL())

	service, err := iam.NewService(profileName)
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}

	created, err := service.CreateFolder(context.Background(), "test-folder", "a test folder", 0)
	if err != nil {
		t.Fatalf("CreateFolder: %v", err)
	}
	if created.Name != "test-folder" || created.Description != "a test folder" || created.ParentID != 0 {
		t.Errorf("created = %+v, want Name=test-folder Description=%q ParentID=0", created, "a test folder")
	}

	child, err := service.CreateFolder(context.Background(), "child-folder", "", created.ID)
	if err != nil {
		t.Fatalf("CreateFolder(child): %v", err)
	}
	if child.ParentID != created.ID {
		t.Errorf("child.ParentID = %d, want %d", child.ParentID, created.ID)
	}

	list, err := service.ListFolders(context.Background())
	if err != nil {
		t.Fatalf("ListFolders: %v", err)
	}
	if len(list) != 2 {
		t.Fatalf("list = %+v, want 2 items", list)
	}

	got, err := service.GetFolder(context.Background(), created.ID)
	if err != nil {
		t.Fatalf("GetFolder: %v", err)
	}
	if got.ID != created.ID || got.Name != "test-folder" {
		t.Errorf("got = %+v, want ID=%d Name=test-folder", got, created.ID)
	}

	updated, err := service.UpdateFolder(context.Background(), created.ID, "renamed-folder", "updated description")
	if err != nil {
		t.Fatalf("UpdateFolder: %v", err)
	}
	if updated.Name != "renamed-folder" || updated.Description != "updated description" {
		t.Errorf("updated = %+v, want Name=renamed-folder Description=%q", updated, "updated description")
	}

	if err := service.MoveFolders(context.Background(), []int{child.ID}, 0); err != nil {
		t.Fatalf("MoveFolders: %v", err)
	}
	moved, err := service.GetFolder(context.Background(), child.ID)
	if err != nil {
		t.Fatalf("GetFolder(child) after move: %v", err)
	}
	if moved.ParentID != 0 {
		t.Errorf("moved.ParentID = %d, want 0", moved.ParentID)
	}

	if err := service.DeleteFolder(context.Background(), child.ID); err != nil {
		t.Fatalf("DeleteFolder(child): %v", err)
	}
	if err := service.DeleteFolder(context.Background(), created.ID); err != nil {
		t.Fatalf("DeleteFolder: %v", err)
	}

	list, err = service.ListFolders(context.Background())
	if err != nil {
		t.Fatalf("ListFolders after delete: %v", err)
	}
	if len(list) != 0 {
		t.Fatalf("list after delete = %+v, want empty", list)
	}
}

func TestService_Project_CRUD(t *testing.T) {
	srv := mockiam.NewTestServer(mockiam.Config{})
	defer srv.Close()

	profileName := writeUsacloudProfile(t, "dummy", "dummy")
	t.Setenv("SAKURA_ENDPOINTS_IAM", srv.TestURL())

	service, err := iam.NewService(profileName)
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}

	folder, err := service.CreateFolder(context.Background(), "test-folder", "", 0)
	if err != nil {
		t.Fatalf("CreateFolder: %v", err)
	}

	created, err := service.CreateProject(context.Background(), "test-code", "test-project", "a test project", 0)
	if err != nil {
		t.Fatalf("CreateProject: %v", err)
	}
	if created.Code != "test-code" || created.Name != "test-project" || created.Description != "a test project" || created.ParentFolderID != 0 {
		t.Errorf("created = %+v, want Code=test-code Name=test-project Description=%q ParentFolderID=0", created, "a test project")
	}

	list, err := service.ListProjects(context.Background())
	if err != nil {
		t.Fatalf("ListProjects: %v", err)
	}
	if len(list) != 1 || list[0].ID != created.ID {
		t.Fatalf("list = %+v, want 1 item with ID=%d", list, created.ID)
	}

	got, err := service.GetProject(context.Background(), created.ID)
	if err != nil {
		t.Fatalf("GetProject: %v", err)
	}
	if got.ID != created.ID || got.Name != "test-project" {
		t.Errorf("got = %+v, want ID=%d Name=test-project", got, created.ID)
	}

	updated, err := service.UpdateProject(context.Background(), created.ID, "renamed-project", "updated description")
	if err != nil {
		t.Fatalf("UpdateProject: %v", err)
	}
	if updated.Name != "renamed-project" || updated.Description != "updated description" {
		t.Errorf("updated = %+v, want Name=renamed-project Description=%q", updated, "updated description")
	}

	if err := service.MoveProjects(context.Background(), []int{created.ID}, folder.ID); err != nil {
		t.Fatalf("MoveProjects: %v", err)
	}
	moved, err := service.GetProject(context.Background(), created.ID)
	if err != nil {
		t.Fatalf("GetProject after move: %v", err)
	}
	if moved.ParentFolderID != folder.ID {
		t.Errorf("moved.ParentFolderID = %d, want %d", moved.ParentFolderID, folder.ID)
	}

	if err := service.DeleteProject(context.Background(), created.ID); err != nil {
		t.Fatalf("DeleteProject: %v", err)
	}

	list, err = service.ListProjects(context.Background())
	if err != nil {
		t.Fatalf("ListProjects after delete: %v", err)
	}
	if len(list) != 0 {
		t.Fatalf("list after delete = %+v, want empty", list)
	}
}

func TestService_Organization_ReadUpdate(t *testing.T) {
	srv := mockiam.NewTestServer(mockiam.Config{})
	defer srv.Close()

	profileName := writeUsacloudProfile(t, "dummy", "dummy")
	t.Setenv("SAKURA_ENDPOINTS_IAM", srv.TestURL())

	service, err := iam.NewService(profileName)
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}

	got, err := service.GetOrganization(context.Background())
	if err != nil {
		t.Fatalf("GetOrganization: %v", err)
	}
	if got.Name == "" {
		t.Errorf("got.Name is empty, want sakumock-seeded default name")
	}

	updated, err := service.UpdateOrganization(context.Background(), "renamed-organization")
	if err != nil {
		t.Fatalf("UpdateOrganization: %v", err)
	}
	if updated.Name != "renamed-organization" {
		t.Errorf("updated.Name = %q, want renamed-organization", updated.Name)
	}
}

func TestService_IAMPolicy_Organization(t *testing.T) {
	srv := mockiam.NewTestServer(mockiam.Config{})
	defer srv.Close()

	profileName := writeUsacloudProfile(t, "dummy", "dummy")
	t.Setenv("SAKURA_ENDPOINTS_IAM", srv.TestURL())

	service, err := iam.NewService(profileName)
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}

	empty, err := service.GetIAMOrganizationPolicy(context.Background())
	if err != nil {
		t.Fatalf("GetIAMOrganizationPolicy: %v", err)
	}
	if len(empty) != 0 {
		t.Fatalf("empty = %+v, want no bindings initially", empty)
	}

	bindings := []iam.PolicyBindingInfo{
		{RoleID: "owner", Principals: []iam.PolicyPrincipalInfo{{Type: "user", ID: 1}, {Type: "group", ID: 2}}},
	}
	updated, err := service.UpdateIAMOrganizationPolicy(context.Background(), bindings)
	if err != nil {
		t.Fatalf("UpdateIAMOrganizationPolicy: %v", err)
	}
	if len(updated) != 1 || updated[0].RoleID != "owner" || len(updated[0].Principals) != 2 {
		t.Fatalf("updated = %+v, want 1 binding for role=owner with 2 principals", updated)
	}

	got, err := service.GetIAMOrganizationPolicy(context.Background())
	if err != nil {
		t.Fatalf("GetIAMOrganizationPolicy after update: %v", err)
	}
	if len(got) != 1 || got[0].RoleID != "owner" {
		t.Fatalf("got = %+v, want 1 binding for role=owner", got)
	}

	cleared, err := service.UpdateIAMOrganizationPolicy(context.Background(), nil)
	if err != nil {
		t.Fatalf("UpdateIAMOrganizationPolicy(clear): %v", err)
	}
	if len(cleared) != 0 {
		t.Fatalf("cleared = %+v, want no bindings", cleared)
	}
}

func TestService_IAMPolicy_ProjectAndFolder(t *testing.T) {
	srv := mockiam.NewTestServer(mockiam.Config{})
	defer srv.Close()

	profileName := writeUsacloudProfile(t, "dummy", "dummy")
	t.Setenv("SAKURA_ENDPOINTS_IAM", srv.TestURL())

	service, err := iam.NewService(profileName)
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}

	folder, err := service.CreateFolder(context.Background(), "policy-folder", "", 0)
	if err != nil {
		t.Fatalf("CreateFolder: %v", err)
	}
	project, err := service.CreateProject(context.Background(), "policy-project", "policy-project", "", 0)
	if err != nil {
		t.Fatalf("CreateProject: %v", err)
	}

	bindings := []iam.PolicyBindingInfo{
		{RoleID: "owner", Principals: []iam.PolicyPrincipalInfo{{Type: "user", ID: 1}}},
	}

	updatedProject, err := service.UpdateIAMProjectPolicy(context.Background(), project.ID, bindings)
	if err != nil {
		t.Fatalf("UpdateIAMProjectPolicy: %v", err)
	}
	if len(updatedProject) != 1 || updatedProject[0].RoleID != "owner" {
		t.Fatalf("updatedProject = %+v, want 1 binding for role=owner", updatedProject)
	}

	gotProject, err := service.GetIAMProjectPolicy(context.Background(), project.ID)
	if err != nil {
		t.Fatalf("GetIAMProjectPolicy: %v", err)
	}
	if len(gotProject) != 1 || gotProject[0].RoleID != "owner" {
		t.Fatalf("gotProject = %+v, want 1 binding for role=owner", gotProject)
	}

	updatedFolder, err := service.UpdateIAMFolderPolicy(context.Background(), folder.ID, bindings)
	if err != nil {
		t.Fatalf("UpdateIAMFolderPolicy: %v", err)
	}
	if len(updatedFolder) != 1 || updatedFolder[0].RoleID != "owner" {
		t.Fatalf("updatedFolder = %+v, want 1 binding for role=owner", updatedFolder)
	}

	gotFolder, err := service.GetIAMFolderPolicy(context.Background(), folder.ID)
	if err != nil {
		t.Fatalf("GetIAMFolderPolicy: %v", err)
	}
	if len(gotFolder) != 1 || gotFolder[0].RoleID != "owner" {
		t.Fatalf("gotFolder = %+v, want 1 binding for role=owner", gotFolder)
	}
}

func TestService_IDPolicy_Organization(t *testing.T) {
	srv := mockiam.NewTestServer(mockiam.Config{})
	defer srv.Close()

	profileName := writeUsacloudProfile(t, "dummy", "dummy")
	t.Setenv("SAKURA_ENDPOINTS_IAM", srv.TestURL())

	service, err := iam.NewService(profileName)
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}

	bindings := []iam.PolicyBindingInfo{
		{RoleID: "admin", Principals: []iam.PolicyPrincipalInfo{{Type: "user", ID: 1}}},
	}
	updated, err := service.UpdateIDOrganizationPolicy(context.Background(), bindings)
	if err != nil {
		t.Fatalf("UpdateIDOrganizationPolicy: %v", err)
	}
	if len(updated) != 1 || updated[0].RoleID != "admin" {
		t.Fatalf("updated = %+v, want 1 binding for role=admin", updated)
	}

	got, err := service.GetIDOrganizationPolicy(context.Background())
	if err != nil {
		t.Fatalf("GetIDOrganizationPolicy: %v", err)
	}
	if len(got) != 1 || got[0].RoleID != "admin" {
		t.Fatalf("got = %+v, want 1 binding for role=admin", got)
	}
}

func TestService_SSOProfile_CRUD(t *testing.T) {
	srv := mockiam.NewTestServer(mockiam.Config{})
	defer srv.Close()

	profileName := writeUsacloudProfile(t, "dummy", "dummy")
	t.Setenv("SAKURA_ENDPOINTS_IAM", srv.TestURL())

	service, err := iam.NewService(profileName)
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}

	created, err := service.CreateSSOProfile(context.Background(), "test-sso", "a test sso profile",
		"https://idp.example.com/metadata", "https://idp.example.com/sso", "https://idp.example.com/slo",
		"-----BEGIN CERTIFICATE-----test-----END CERTIFICATE-----")
	if err != nil {
		t.Fatalf("CreateSSOProfile: %v", err)
	}
	if created.Name != "test-sso" || created.Description != "a test sso profile" || created.Assigned {
		t.Errorf("created = %+v, want Name=test-sso Description=%q Assigned=false", created, "a test sso profile")
	}

	list, err := service.ListSSOProfiles(context.Background())
	if err != nil {
		t.Fatalf("ListSSOProfiles: %v", err)
	}
	if len(list) != 1 || list[0].ID != created.ID {
		t.Fatalf("list = %+v, want 1 item with ID=%d", list, created.ID)
	}

	got, err := service.GetSSOProfile(context.Background(), created.ID)
	if err != nil {
		t.Fatalf("GetSSOProfile: %v", err)
	}
	if got.ID != created.ID || got.Name != "test-sso" {
		t.Errorf("got = %+v, want ID=%d Name=test-sso", got, created.ID)
	}

	updated, err := service.UpdateSSOProfile(context.Background(), created.ID, "renamed-sso", "updated description",
		"https://idp.example.com/metadata2", "https://idp.example.com/sso2", "https://idp.example.com/slo2",
		"-----BEGIN CERTIFICATE-----updated-----END CERTIFICATE-----")
	if err != nil {
		t.Fatalf("UpdateSSOProfile: %v", err)
	}
	if updated.Name != "renamed-sso" || updated.Description != "updated description" {
		t.Errorf("updated = %+v, want Name=renamed-sso Description=%q", updated, "updated description")
	}

	linked, err := service.LinkSSOProfile(context.Background(), created.ID)
	if err != nil {
		t.Fatalf("LinkSSOProfile: %v", err)
	}
	if !linked.Assigned {
		t.Errorf("linked.Assigned = false, want true")
	}

	unlinked, err := service.UnlinkSSOProfile(context.Background(), created.ID)
	if err != nil {
		t.Fatalf("UnlinkSSOProfile: %v", err)
	}
	if unlinked.Assigned {
		t.Errorf("unlinked.Assigned = true, want false")
	}

	if err := service.DeleteSSOProfile(context.Background(), created.ID); err != nil {
		t.Fatalf("DeleteSSOProfile: %v", err)
	}

	list, err = service.ListSSOProfiles(context.Background())
	if err != nil {
		t.Fatalf("ListSSOProfiles after delete: %v", err)
	}
	if len(list) != 0 {
		t.Fatalf("list after delete = %+v, want empty", list)
	}
}

func TestService_ScimConfiguration_CRUD(t *testing.T) {
	srv := mockiam.NewTestServer(mockiam.Config{})
	defer srv.Close()

	profileName := writeUsacloudProfile(t, "dummy", "dummy")
	t.Setenv("SAKURA_ENDPOINTS_IAM", srv.TestURL())

	service, err := iam.NewService(profileName)
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}

	created, err := service.CreateScimConfiguration(context.Background(), "test-scim")
	if err != nil {
		t.Fatalf("CreateScimConfiguration: %v", err)
	}
	if created.Name != "test-scim" || created.SecretToken == "" {
		t.Errorf("created = %+v, want Name=test-scim and a non-empty SecretToken", created)
	}

	list, err := service.ListScimConfigurations(context.Background())
	if err != nil {
		t.Fatalf("ListScimConfigurations: %v", err)
	}
	if len(list) != 1 || list[0].ID != created.ID {
		t.Fatalf("list = %+v, want 1 item with ID=%s", list, created.ID)
	}

	got, err := service.GetScimConfiguration(context.Background(), created.ID)
	if err != nil {
		t.Fatalf("GetScimConfiguration: %v", err)
	}
	if got.ID != created.ID || got.Name != "test-scim" {
		t.Errorf("got = %+v, want ID=%s Name=test-scim", got, created.ID)
	}

	updated, err := service.UpdateScimConfiguration(context.Background(), created.ID, "renamed-scim")
	if err != nil {
		t.Fatalf("UpdateScimConfiguration: %v", err)
	}
	if updated.Name != "renamed-scim" {
		t.Errorf("updated.Name = %q, want renamed-scim", updated.Name)
	}

	regenerated, err := service.RegenerateScimConfigurationToken(context.Background(), created.ID)
	if err != nil {
		t.Fatalf("RegenerateScimConfigurationToken: %v", err)
	}
	if regenerated == "" || regenerated == created.SecretToken {
		t.Errorf("regenerated = %q, want a non-empty token different from the initial one %q", regenerated, created.SecretToken)
	}

	if err := service.DeleteScimConfiguration(context.Background(), created.ID); err != nil {
		t.Fatalf("DeleteScimConfiguration: %v", err)
	}

	list, err = service.ListScimConfigurations(context.Background())
	if err != nil {
		t.Fatalf("ListScimConfigurations after delete: %v", err)
	}
	if len(list) != 0 {
		t.Fatalf("list after delete = %+v, want empty", list)
	}
}

func TestService_ServicePolicy(t *testing.T) {
	srv := mockiam.NewTestServer(mockiam.Config{})
	defer srv.Close()

	profileName := writeUsacloudProfile(t, "dummy", "dummy")
	t.Setenv("SAKURA_ENDPOINTS_IAM", srv.TestURL())

	service, err := iam.NewService(profileName)
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}

	// sakumockの/service-policy-statusはSDKが期待するフィールド名で状態を返さないため
	// デコードに失敗し、IsServicePolicyEnabledはフォールバックとしてfalseを返す
	// (docs/upstream-issues.md参照)。Enable/Disable自体はエラーにならないことを確認する
	if err := service.EnableServicePolicy(context.Background()); err != nil {
		t.Fatalf("EnableServicePolicy: %v", err)
	}
	enabled, err := service.IsServicePolicyEnabled(context.Background())
	if err != nil {
		t.Fatalf("IsServicePolicyEnabled: %v", err)
	}
	if enabled {
		t.Errorf("enabled = true, want false (sakumock does not persist service policy status)")
	}

	if err := service.DisableServicePolicy(context.Background()); err != nil {
		t.Fatalf("DisableServicePolicy: %v", err)
	}

	// sakumockの/service-policy-rule-templatesはページネーション付きオブジェクトではなく
	// 素の配列を返すためデコードに失敗し、ListServicePolicyRuleTemplatesはフォールバックとして
	// 空スライスを返す(docs/upstream-issues.md参照)。エラーにならないことのみ確認する
	templates, err := service.ListServicePolicyRuleTemplates(context.Background())
	if err != nil {
		t.Fatalf("ListServicePolicyRuleTemplates: %v", err)
	}
	if templates == nil {
		t.Errorf("templates = nil, want non-nil (possibly empty) slice")
	}
}
