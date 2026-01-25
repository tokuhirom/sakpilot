package sakura

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

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

// MSMetricsStorageDetail represents detailed information about a metrics storage
type MSMetricsStorageDetail struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Endpoint    string `json:"endpoint"`
}

// MSMetricsAccessKey represents an access key for metrics storage
type MSMetricsAccessKey struct {
	ID          string `json:"id"`
	UID         string `json:"uid"`
	Token       string `json:"token"`
	Description string `json:"description"`
}

// PrometheusLabel represents a Prometheus label value
type PrometheusLabel struct {
	Name string `json:"name"`
}

// PrometheusQueryRangeParams represents parameters for query_range API
type PrometheusQueryRangeParams struct {
	Query string `json:"query"`
	Start int64  `json:"start"` // Unix timestamp
	End   int64  `json:"end"`   // Unix timestamp
	Step  string `json:"step"`  // Duration string like "15s"
}

// PrometheusMatrixResult represents a single time series result
type PrometheusMatrixResult struct {
	Metric map[string]string `json:"metric"`
	Values [][]interface{}   `json:"values"` // [[timestamp, value], ...]
}

// PrometheusQueryRangeData represents the data field in query_range response
type PrometheusQueryRangeData struct {
	ResultType string                   `json:"resultType"`
	Result     []PrometheusMatrixResult `json:"result"`
}

// PrometheusQueryRangeResponse represents the response from query_range
type PrometheusQueryRangeResponse struct {
	Status string                    `json:"status"`
	Data   PrometheusQueryRangeData `json:"data"`
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
			ID:   fmt.Sprintf("%d", r.ID), //nolint:staticcheck // ID is deprecated but still functional
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
			ID:   fmt.Sprintf("%d", r.ID), //nolint:staticcheck // ID is deprecated but still functional
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

// GetMetricsStorageDetail retrieves detailed information about a metrics storage
func (s *MonitoringService) GetMetricsStorageDetail(ctx context.Context, storageID string) (*MSMetricsStorageDetail, error) {
	c, err := s.getMSClient()
	if err != nil {
		return nil, err
	}

	id, err := strconv.ParseInt(storageID, 10, 64)
	if err != nil {
		return nil, fmt.Errorf("invalid storage ID: %w", err)
	}

	res, err := c.MetricsStoragesRetrieve(ctx, v1.MetricsStoragesRetrieveParams{
		ResourceID: id,
	})
	if err != nil {
		return nil, err
	}

	return &MSMetricsStorageDetail{
		ID:          fmt.Sprintf("%d", res.ID),
		Name:        res.Name.Value,
		Description: res.Description.Value,
		Endpoint:    res.Endpoints.Address,
	}, nil
}

// ListMetricsAccessKeys retrieves all access keys for a metrics storage
func (s *MonitoringService) ListMetricsAccessKeys(ctx context.Context, storageID string) ([]MSMetricsAccessKey, error) {
	c, err := s.getMSClient()
	if err != nil {
		return nil, err
	}

	id, err := strconv.ParseInt(storageID, 10, 64)
	if err != nil {
		return nil, fmt.Errorf("invalid storage ID: %w", err)
	}

	res, err := c.MetricsStoragesKeysList(ctx, v1.MetricsStoragesKeysListParams{
		MetricsResourceID: id,
	})
	if err != nil {
		return nil, err
	}

	keys := make([]MSMetricsAccessKey, 0, len(res.Results))
	for _, k := range res.Results {
		keys = append(keys, MSMetricsAccessKey{
			ID:          fmt.Sprintf("%d", k.ID), //nolint:staticcheck // ID is deprecated but still functional
			UID:         k.UID.String(),
			Token:       k.Token,
			Description: k.Description.Value,
		})
	}
	return keys, nil
}

// QueryPrometheusLabels queries Prometheus API to get all metric names
func (s *MonitoringService) QueryPrometheusLabels(ctx context.Context, endpoint, token string) ([]PrometheusLabel, error) {
	log.Printf("QueryPrometheusLabels: original endpoint=%s", endpoint)
	// Ensure endpoint has https:// prefix
	if !strings.HasPrefix(endpoint, "https://") && !strings.HasPrefix(endpoint, "http://") {
		endpoint = "https://" + endpoint
	}
	// Query __name__ label to get all metric names
	url := fmt.Sprintf("%s/prometheus/api/v1/label/__name__/values", endpoint)
	log.Printf("QueryPrometheusLabels: url=%s", url)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Add authorization header with Bearer token
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
	req.Header.Set("Accept", "application/json")

	client := &http.Client{
		Timeout: 30 * time.Second,
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to query Prometheus: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("Prometheus API returned status %d: %s", resp.StatusCode, string(body))
	}

	var result struct {
		Status string   `json:"status"`
		Data   []string `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	if result.Status != "success" {
		return nil, fmt.Errorf("Prometheus query failed with status: %s", result.Status)
	}

	labels := make([]PrometheusLabel, 0, len(result.Data))
	for _, name := range result.Data {
		labels = append(labels, PrometheusLabel{
			Name: name,
		})
	}

	return labels, nil
}

// QueryPrometheusRange queries Prometheus API to get time series data
func (s *MonitoringService) QueryPrometheusRange(ctx context.Context, endpoint, token string, params PrometheusQueryRangeParams) (*PrometheusQueryRangeResponse, error) {
	// Ensure endpoint has https:// prefix
	if !strings.HasPrefix(endpoint, "https://") && !strings.HasPrefix(endpoint, "http://") {
		endpoint = "https://" + endpoint
	}
	url := fmt.Sprintf("%s/prometheus/api/v1/query_range?query=%s&start=%d&end=%d&step=%s",
		endpoint,
		params.Query,
		params.Start,
		params.End,
		params.Step,
	)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
	req.Header.Set("Accept", "application/json")

	client := &http.Client{
		Timeout: 30 * time.Second,
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to query Prometheus: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("Prometheus API returned status %d: %s", resp.StatusCode, string(body))
	}

	var result PrometheusQueryRangeResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	if result.Status != "success" {
		return nil, fmt.Errorf("Prometheus query failed with status: %s", result.Status)
	}

	return &result, nil
}
