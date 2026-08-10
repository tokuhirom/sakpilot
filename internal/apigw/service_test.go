package apigw_test

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"math/big"
	"testing"
	"time"

	mockapigw "github.com/sacloud/sakumock/apigw"

	"sakpilot/internal/apigw"
)

// generateTestCertPEM returns a self-signed certificate and its private key as PEM,
// since sakumock validates the pair with tls.X509KeyPair (not just PEM framing).
func generateTestCertPEM(t *testing.T) (certPEM, keyPEM string) {
	t.Helper()

	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("GenerateKey: %v", err)
	}
	template := &x509.Certificate{
		SerialNumber: big.NewInt(1),
		Subject:      pkix.Name{CommonName: "test.example.com"},
		NotBefore:    time.Unix(0, 0),
		NotAfter:     time.Unix(0, 0).AddDate(100, 0, 0),
	}
	der, err := x509.CreateCertificate(rand.Reader, template, template, &key.PublicKey, key)
	if err != nil {
		t.Fatalf("CreateCertificate: %v", err)
	}
	cert := string(pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der}))
	priv := string(pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(key)}))
	return cert, priv
}

func newTestService(t *testing.T, endpoint string) *apigw.Service {
	t.Helper()

	t.Setenv("SAKURA_ACCESS_TOKEN", "dummy")
	t.Setenv("SAKURA_ACCESS_TOKEN_SECRET", "dummy")
	t.Setenv("SAKURA_ENDPOINTS_APIGW", endpoint)

	profileName := writeUsacloudProfile(t, "dummy", "dummy")

	service, err := apigw.NewService(profileName)
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}
	return service
}

func TestService_GroupCRUD(t *testing.T) {
	srv := mockapigw.NewTestServer(mockapigw.Config{})
	defer srv.Close()

	service := newTestService(t, srv.TestURL())
	ctx := context.Background()

	created, err := service.CreateGroup(ctx, "test-group", []string{"env:test"})
	if err != nil {
		t.Fatalf("CreateGroup: %v", err)
	}
	if created.Name != "test-group" {
		t.Errorf("Name = %q, want %q", created.Name, "test-group")
	}
	if created.ID == "" {
		t.Error("ID is empty")
	}

	list, err := service.ListGroups(ctx)
	if err != nil {
		t.Fatalf("ListGroups: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("got %d groups, want 1: %+v", len(list), list)
	}

	got, err := service.GetGroup(ctx, created.ID)
	if err != nil {
		t.Fatalf("GetGroup: %v", err)
	}
	if got.Name != "test-group" {
		t.Errorf("Name = %q, want %q", got.Name, "test-group")
	}

	if err := service.UpdateGroup(ctx, created.ID, "updated-group", []string{"env:prod"}); err != nil {
		t.Fatalf("UpdateGroup: %v", err)
	}
	updated, err := service.GetGroup(ctx, created.ID)
	if err != nil {
		t.Fatalf("GetGroup after update: %v", err)
	}
	if updated.Name != "updated-group" {
		t.Errorf("Name = %q, want %q", updated.Name, "updated-group")
	}

	if err := service.DeleteGroup(ctx, created.ID); err != nil {
		t.Fatalf("DeleteGroup: %v", err)
	}

	list, err = service.ListGroups(ctx)
	if err != nil {
		t.Fatalf("ListGroups after delete: %v", err)
	}
	if len(list) != 0 {
		t.Fatalf("got %d groups after delete, want 0: %+v", len(list), list)
	}
}

func TestService_CertificateCRUD(t *testing.T) {
	srv := mockapigw.NewTestServer(mockapigw.Config{})
	defer srv.Close()

	service := newTestService(t, srv.TestURL())
	ctx := context.Background()

	certPEM, keyPEM := generateTestCertPEM(t)
	created, err := service.CreateCertificate(ctx, "test-cert", certPEM, keyPEM, "", "")
	if err != nil {
		t.Fatalf("CreateCertificate: %v", err)
	}
	if created.Name != "test-cert" {
		t.Errorf("Name = %q, want %q", created.Name, "test-cert")
	}
	// APIの仕様上、証明書/秘密鍵は書き込み専用でレスポンスにはエコーバックされない(有効期限のみ確認可能)
	if created.RsaExpiredAt == "" {
		t.Error("RsaExpiredAt is empty")
	}

	list, err := service.ListCertificates(ctx)
	if err != nil {
		t.Fatalf("ListCertificates: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("got %d certificates, want 1: %+v", len(list), list)
	}

	certPEM2, keyPEM2 := generateTestCertPEM(t)
	if err := service.UpdateCertificate(ctx, created.ID, "updated-cert", certPEM2, keyPEM2, "", ""); err != nil {
		t.Fatalf("UpdateCertificate: %v", err)
	}

	list, err = service.ListCertificates(ctx)
	if err != nil {
		t.Fatalf("ListCertificates after update: %v", err)
	}
	if list[0].Name != "updated-cert" {
		t.Errorf("Name = %q, want %q", list[0].Name, "updated-cert")
	}

	if err := service.DeleteCertificate(ctx, created.ID); err != nil {
		t.Fatalf("DeleteCertificate: %v", err)
	}

	list, err = service.ListCertificates(ctx)
	if err != nil {
		t.Fatalf("ListCertificates after delete: %v", err)
	}
	if len(list) != 0 {
		t.Fatalf("got %d certificates after delete, want 0: %+v", len(list), list)
	}
}

func TestService_DomainCRUD(t *testing.T) {
	srv := mockapigw.NewTestServer(mockapigw.Config{})
	defer srv.Close()

	service := newTestService(t, srv.TestURL())
	ctx := context.Background()

	domainCertPEM, domainKeyPEM := generateTestCertPEM(t)
	cert, err := service.CreateCertificate(ctx, "test-cert", domainCertPEM, domainKeyPEM, "", "")
	if err != nil {
		t.Fatalf("CreateCertificate: %v", err)
	}

	created, err := service.CreateDomain(ctx, "example.test", "")
	if err != nil {
		t.Fatalf("CreateDomain: %v", err)
	}
	if created.DomainName != "example.test" {
		t.Errorf("DomainName = %q, want %q", created.DomainName, "example.test")
	}

	list, err := service.ListDomains(ctx)
	if err != nil {
		t.Fatalf("ListDomains: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("got %d domains, want 1: %+v", len(list), list)
	}

	if err := service.UpdateDomain(ctx, created.ID, cert.ID); err != nil {
		t.Fatalf("UpdateDomain: %v", err)
	}

	list, err = service.ListDomains(ctx)
	if err != nil {
		t.Fatalf("ListDomains after update: %v", err)
	}
	if list[0].CertificateID != cert.ID {
		t.Errorf("CertificateID = %q, want %q", list[0].CertificateID, cert.ID)
	}

	if err := service.DeleteDomain(ctx, created.ID); err != nil {
		t.Fatalf("DeleteDomain: %v", err)
	}

	list, err = service.ListDomains(ctx)
	if err != nil {
		t.Fatalf("ListDomains after delete: %v", err)
	}
	if len(list) != 0 {
		t.Fatalf("got %d domains after delete, want 0: %+v", len(list), list)
	}
}

func TestService_UserCRUD(t *testing.T) {
	srv := mockapigw.NewTestServer(mockapigw.Config{})
	defer srv.Close()

	service := newTestService(t, srv.TestURL())
	ctx := context.Background()

	group, err := service.CreateGroup(ctx, "test-group", nil)
	if err != nil {
		t.Fatalf("CreateGroup: %v", err)
	}

	created, err := service.CreateUser(ctx, "test-user", "custom-1", []string{"env:test"})
	if err != nil {
		t.Fatalf("CreateUser: %v", err)
	}
	if created.Name != "test-user" {
		t.Errorf("Name = %q, want %q", created.Name, "test-user")
	}

	if err := service.SetUserGroup(ctx, created.ID, group.ID, true); err != nil {
		t.Fatalf("SetUserGroup: %v", err)
	}
	groupAssignments, err := service.ListUserGroups(ctx, created.ID)
	if err != nil {
		t.Fatalf("ListUserGroups: %v", err)
	}
	found := false
	for _, g := range groupAssignments {
		if g.ID == group.ID {
			found = true
			if !g.IsAssigned {
				t.Errorf("group %s IsAssigned = false, want true", g.ID)
			}
		}
	}
	if !found {
		t.Errorf("group %s not found in ListUserGroups result: %+v", group.ID, groupAssignments)
	}

	list, err := service.ListUsers(ctx)
	if err != nil {
		t.Fatalf("ListUsers: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("got %d users, want 1: %+v", len(list), list)
	}

	got, err := service.GetUser(ctx, created.ID)
	if err != nil {
		t.Fatalf("GetUser: %v", err)
	}
	if got.Name != "test-user" {
		t.Errorf("Name = %q, want %q", got.Name, "test-user")
	}

	if err := service.UpdateUser(ctx, created.ID, "updated-user", "custom-2", []string{"env:prod"}); err != nil {
		t.Fatalf("UpdateUser: %v", err)
	}
	updated, err := service.GetUser(ctx, created.ID)
	if err != nil {
		t.Fatalf("GetUser after update: %v", err)
	}
	if updated.Name != "updated-user" {
		t.Errorf("Name = %q, want %q", updated.Name, "updated-user")
	}
	if updated.CustomID != "custom-2" {
		t.Errorf("CustomID = %q, want %q", updated.CustomID, "custom-2")
	}

	if err := service.DeleteUser(ctx, created.ID); err != nil {
		t.Fatalf("DeleteUser: %v", err)
	}

	list, err = service.ListUsers(ctx)
	if err != nil {
		t.Fatalf("ListUsers after delete: %v", err)
	}
	if len(list) != 0 {
		t.Fatalf("got %d users after delete, want 0: %+v", len(list), list)
	}
}

func TestService_SubscriptionAndServiceAndRouteCRUD(t *testing.T) {
	srv := mockapigw.NewTestServer(mockapigw.Config{})
	defer srv.Close()

	service := newTestService(t, srv.TestURL())
	ctx := context.Background()

	plans, err := service.ListPlans(ctx)
	if err != nil {
		t.Fatalf("ListPlans: %v", err)
	}
	if len(plans) == 0 {
		t.Fatal("ListPlans returned no plans")
	}
	plan := plans[0]

	sub, err := service.CreateSubscription(ctx, plan.ID, "test-subscription")
	if err != nil {
		t.Fatalf("CreateSubscription: %v", err)
	}
	if sub.Name != "test-subscription" {
		t.Errorf("Name = %q, want %q", sub.Name, "test-subscription")
	}
	if sub.PlanID != plan.ID {
		t.Errorf("PlanID = %q, want %q", sub.PlanID, plan.ID)
	}

	subs, err := service.ListSubscriptions(ctx)
	if err != nil {
		t.Fatalf("ListSubscriptions: %v", err)
	}
	if len(subs) != 1 {
		t.Fatalf("got %d subscriptions, want 1: %+v", len(subs), subs)
	}

	gotSub, err := service.GetSubscription(ctx, sub.ID)
	if err != nil {
		t.Fatalf("GetSubscription: %v", err)
	}
	if gotSub.PlanName != plan.Name {
		t.Errorf("PlanName = %q, want %q", gotSub.PlanName, plan.Name)
	}

	if err := service.UpdateSubscription(ctx, sub.ID, "updated-subscription"); err != nil {
		t.Fatalf("UpdateSubscription: %v", err)
	}

	// --- Service ---
	createdSvc, err := service.CreateService(ctx, "test-service", "http", "backend.example.test", "/", 80, 3, 5, 5, 5, sub.ID)
	if err != nil {
		t.Fatalf("CreateService: %v", err)
	}
	if createdSvc.Name != "test-service" {
		t.Errorf("Name = %q, want %q", createdSvc.Name, "test-service")
	}
	if createdSvc.SubscriptionID != sub.ID {
		t.Errorf("SubscriptionID = %q, want %q", createdSvc.SubscriptionID, sub.ID)
	}

	svcList, err := service.ListServices(ctx)
	if err != nil {
		t.Fatalf("ListServices: %v", err)
	}
	if len(svcList) != 1 {
		t.Fatalf("got %d services, want 1: %+v", len(svcList), svcList)
	}

	gotSvc, err := service.GetService(ctx, createdSvc.ID)
	if err != nil {
		t.Fatalf("GetService: %v", err)
	}
	if gotSvc.Host != "backend.example.test" {
		t.Errorf("Host = %q, want %q", gotSvc.Host, "backend.example.test")
	}

	if err := service.UpdateService(ctx, createdSvc.ID, "updated-service", "https", "backend2.example.test", "/api", 443, 3, 5, 5, 5); err != nil {
		t.Fatalf("UpdateService: %v", err)
	}
	gotSvc, err = service.GetService(ctx, createdSvc.ID)
	if err != nil {
		t.Fatalf("GetService after update: %v", err)
	}
	if gotSvc.Host != "backend2.example.test" {
		t.Errorf("Host = %q, want %q", gotSvc.Host, "backend2.example.test")
	}

	// --- Route ---
	createdRoute, err := service.CreateRoute(ctx, createdSvc.ID, "test-route", "http,https", "/foo", nil, []string{"GET", "POST"}, 0, 0, true, false, []string{"env:test"})
	if err != nil {
		t.Fatalf("CreateRoute: %v", err)
	}
	if createdRoute.Name != "test-route" {
		t.Errorf("Name = %q, want %q", createdRoute.Name, "test-route")
	}
	if len(createdRoute.Methods) != 2 {
		t.Errorf("Methods = %v, want 2 items", createdRoute.Methods)
	}

	routeList, err := service.ListRoutes(ctx, createdSvc.ID)
	if err != nil {
		t.Fatalf("ListRoutes: %v", err)
	}
	if len(routeList) != 1 {
		t.Fatalf("got %d routes, want 1: %+v", len(routeList), routeList)
	}

	gotRoute, err := service.GetRoute(ctx, createdSvc.ID, createdRoute.ID)
	if err != nil {
		t.Fatalf("GetRoute: %v", err)
	}
	if gotRoute.Path != "/foo" {
		t.Errorf("Path = %q, want %q", gotRoute.Path, "/foo")
	}

	if err := service.UpdateRoute(ctx, createdSvc.ID, createdRoute.ID, "updated-route", "https", "/bar", nil, []string{"GET"}, 301, 1, false, true, []string{"env:prod"}); err != nil {
		t.Fatalf("UpdateRoute: %v", err)
	}
	gotRoute, err = service.GetRoute(ctx, createdSvc.ID, createdRoute.ID)
	if err != nil {
		t.Fatalf("GetRoute after update: %v", err)
	}
	if gotRoute.Path != "/bar" {
		t.Errorf("Path = %q, want %q", gotRoute.Path, "/bar")
	}
	if gotRoute.HttpsRedirectStatusCode != 301 {
		t.Errorf("HttpsRedirectStatusCode = %d, want 301", gotRoute.HttpsRedirectStatusCode)
	}

	if err := service.DeleteRoute(ctx, createdSvc.ID, createdRoute.ID); err != nil {
		t.Fatalf("DeleteRoute: %v", err)
	}
	routeList, err = service.ListRoutes(ctx, createdSvc.ID)
	if err != nil {
		t.Fatalf("ListRoutes after delete: %v", err)
	}
	if len(routeList) != 0 {
		t.Fatalf("got %d routes after delete, want 0: %+v", len(routeList), routeList)
	}

	if err := service.DeleteService(ctx, createdSvc.ID); err != nil {
		t.Fatalf("DeleteService: %v", err)
	}
	svcList, err = service.ListServices(ctx)
	if err != nil {
		t.Fatalf("ListServices after delete: %v", err)
	}
	if len(svcList) != 0 {
		t.Fatalf("got %d services after delete, want 0: %+v", len(svcList), svcList)
	}

	if err := service.DeleteSubscription(ctx, sub.ID); err != nil {
		t.Fatalf("DeleteSubscription: %v", err)
	}
	subs, err = service.ListSubscriptions(ctx)
	if err != nil {
		t.Fatalf("ListSubscriptions after delete: %v", err)
	}
	if len(subs) != 0 {
		t.Fatalf("got %d subscriptions after delete, want 0: %+v", len(subs), subs)
	}
}
