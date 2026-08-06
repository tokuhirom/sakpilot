package sakura

import (
	"context"
	"testing"

	mockms "github.com/sacloud/sakumock/monitoringsuite"
)

func TestMonitoringService_ListLogsMetricsTraces_Empty(t *testing.T) {
	srv := mockms.NewTestServer(mockms.Config{})
	defer srv.Close()

	t.Setenv("SAKURA_ENDPOINTS_MONITORING_SUITE", srv.TestURL())

	client := &Client{accessToken: "dummy", accessTokenSecret: "dummy"}
	service := NewMonitoringService(client)

	ctx := context.Background()

	logs, err := service.ListLogs(ctx)
	if err != nil {
		t.Fatalf("ListLogs: %v", err)
	}
	if len(logs) != 0 {
		t.Errorf("got %d logs, want 0: %+v", len(logs), logs)
	}

	metrics, err := service.ListMetrics(ctx)
	if err != nil {
		t.Fatalf("ListMetrics: %v", err)
	}
	if len(metrics) != 0 {
		t.Errorf("got %d metrics, want 0: %+v", len(metrics), metrics)
	}

	traces, err := service.ListTraces(ctx)
	if err != nil {
		t.Fatalf("ListTraces: %v", err)
	}
	if len(traces) != 0 {
		t.Errorf("got %d traces, want 0: %+v", len(traces), traces)
	}
}
