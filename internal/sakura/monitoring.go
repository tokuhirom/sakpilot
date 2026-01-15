package sakura

import (
	"context"
	"fmt"

	client "github.com/sacloud/api-client-go"
	ms "github.com/sacloud/monitoring-suite-api-go"
	v1 "github.com/sacloud/monitoring-suite-api-go/apis/v1"
)

type MonitoringService struct {
	client *Client
}

func NewMonitoringService(client *Client) *MonitoringService {
	return &MonitoringService{client: client}
}

func (s *MonitoringService) getMSClient() (*v1.Client, error) {
	token, secret := s.client.Credentials()
	return ms.NewClient(
		func(p *client.ClientParams) {
			if p.Options == nil {
				p.Options = &client.Options{}
			}
			p.Options.AccessToken = token
			p.Options.AccessTokenSecret = secret
		},
	)
}

type MSRoutingInfo struct {
	ID   string `json:"id"`
	UID  string `json:"uid"`
	Name string `json:"name"`
}

type MSLogInfo struct {
	ID          string          `json:"id"`
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Routings    []MSRoutingInfo `json:"routings"`
}

type MSMetricInfo struct {
	ID          string          `json:"id"`
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Routings    []MSRoutingInfo `json:"routings"`
}

type MSTraceInfo struct {
	ID          string          `json:"id"`
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Routings    []MSRoutingInfo `json:"routings"`
}

func (s *MonitoringService) ListLogs(ctx context.Context) ([]MSLogInfo, error) {
	c, err := s.getMSClient()
	if err != nil {
		return nil, err
	}

	// ストレージ一覧
	res, err := c.LogsStoragesList(ctx, v1.LogsStoragesListParams{})
	if err != nil {
		return nil, err
	}

	// ルーティング一覧も取得してマッピングする
	routingsRes, err := c.LogsRoutingsList(ctx, v1.LogsRoutingsListParams{})
	if err != nil {
		// ルーティングが取れなくてもストレージ一覧は出す
		routingsRes = &v1.PaginatedLogRoutingList{}
	}

	routingMap := make(map[int64][]MSRoutingInfo)
	for _, r := range routingsRes.Results {
		info := MSRoutingInfo{
			ID:   fmt.Sprintf("%d", r.ID),
			UID:  r.UID.String(),
			Name: fmt.Sprintf("%s (%s)", r.PublisherCode.Value, r.Variant),
		}
		routingMap[r.LogStorage.ID] = append(routingMap[r.LogStorage.ID], info)
	}

	list := make([]MSLogInfo, 0, len(res.Results))
	for _, l := range res.Results {
		list = append(list, MSLogInfo{
			ID:          fmt.Sprintf("%d", l.ID),
			Name:        l.Name.Value,
			Description: l.Description.Value,
			Routings:    routingMap[l.ID],
		})
	}
	return list, nil
}

func (s *MonitoringService) ListMetrics(ctx context.Context) ([]MSMetricInfo, error) {
	c, err := s.getMSClient()
	if err != nil {
		return nil, err
	}

	// ストレージ一覧
	res, err := c.MetricsStoragesList(ctx, v1.MetricsStoragesListParams{})
	if err != nil {
		return nil, err
	}

	// ルーティング一覧
	routingsRes, err := c.MetricsRoutingsList(ctx, v1.MetricsRoutingsListParams{})
	if err != nil {
		routingsRes = &v1.PaginatedMetricsRoutingList{}
	}

	routingMap := make(map[int64][]MSRoutingInfo)
	for _, r := range routingsRes.Results {
		info := MSRoutingInfo{
			ID:   fmt.Sprintf("%d", r.ID),
			UID:  r.UID.String(),
			Name: fmt.Sprintf("%s (%s)", r.PublisherCode.Value, r.Variant),
		}
		routingMap[r.MetricsStorage.ID] = append(routingMap[r.MetricsStorage.ID], info)
	}

	list := make([]MSMetricInfo, 0, len(res.Results))
	for _, m := range res.Results {
		list = append(list, MSMetricInfo{
			ID:          fmt.Sprintf("%d", m.ID),
			Name:        m.Name.Value,
			Description: m.Description.Value,
			Routings:    routingMap[m.ID],
		})
	}
	return list, nil
}

func (s *MonitoringService) ListTraces(ctx context.Context) ([]MSTraceInfo, error) {
	c, err := s.getMSClient()
	if err != nil {
		return nil, err
	}
	res, err := c.TracesStoragesList(ctx, v1.TracesStoragesListParams{})
	if err != nil {
		return nil, err
	}

	list := make([]MSTraceInfo, 0, len(res.Results))
	for _, t := range res.Results {
		list = append(list, MSTraceInfo{
			ID:          fmt.Sprintf("%d", t.ID),
			Name:        t.Name.Value,
			Description: t.Description.Value,
			Routings:    nil, // Traces don't have routings in this API yet
		})
	}
	return list, nil
}
