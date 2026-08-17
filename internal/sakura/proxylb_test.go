package sakura

import (
	"context"
	"testing"

	"github.com/sacloud/sacloud-sdk-go/api/iaas"
	"github.com/sacloud/sacloud-sdk-go/api/iaas/fake"
	"github.com/sacloud/sacloud-sdk-go/api/iaas/types"
)

func newTestProxyLBService(t *testing.T) *ProxyLBService {
	t.Helper()
	fake.SwitchFactoryFuncToFake()
	fake.InitDataStore()
	return NewProxyLBService(&Client{})
}

func createTestProxyLB(ctx context.Context) (*iaas.ProxyLB, error) {
	op := iaas.NewProxyLBOp(nil)
	return op.Create(ctx, &iaas.ProxyLBCreateRequest{
		Name:   "test-proxylb",
		Plan:   types.ProxyLBPlans.CPS100,
		Region: types.ProxyLBRegions.IS1,
	})
}

func TestProxyLBService_ChangePlan(t *testing.T) {
	service := newTestProxyLBService(t)
	ctx := context.Background()

	created, err := createTestProxyLB(ctx)
	if err != nil {
		t.Fatalf("createTestProxyLB: %v", err)
	}

	updated, err := service.ChangePlan(ctx, created.ID.String(), int(types.ProxyLBPlans.CPS500))
	if err != nil {
		t.Fatalf("ChangePlan: %v", err)
	}
	if updated.Plan != types.ProxyLBPlans.CPS500.String() {
		t.Errorf("Plan = %q, want %q", updated.Plan, types.ProxyLBPlans.CPS500.String())
	}
}

func TestProxyLBService_SetCertificates(t *testing.T) {
	service := newTestProxyLBService(t)
	ctx := context.Background()

	created, err := createTestProxyLB(ctx)
	if err != nil {
		t.Fatalf("createTestProxyLB: %v", err)
	}

	certs, err := service.SetCertificates(ctx, created.ID.String(), &ProxyLBSetCertificatesInput{
		PrimaryCert: ProxyLBCertInput{
			ServerCertificate:       "dummy-server-cert",
			IntermediateCertificate: "dummy-intermediate-cert",
			PrivateKey:              "dummy-private-key",
		},
	})
	if err != nil {
		t.Fatalf("SetCertificates: %v", err)
	}
	if certs.PrimaryCert == nil {
		t.Fatal("SetCertificates: got nil PrimaryCert, want non-nil")
	}
}

func TestProxyLBService_MonitorConnection(t *testing.T) {
	service := newTestProxyLBService(t)
	ctx := context.Background()

	created, err := createTestProxyLB(ctx)
	if err != nil {
		t.Fatalf("createTestProxyLB: %v", err)
	}

	values, err := service.MonitorConnection(ctx, created.ID.String(), 0, 0)
	if err != nil {
		t.Fatalf("MonitorConnection: %v", err)
	}
	if values == nil {
		t.Error("MonitorConnection: got nil values, want non-nil (possibly empty) slice")
	}
}
