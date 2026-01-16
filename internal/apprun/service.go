package apprun

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/google/uuid"
	ht "github.com/ogen-go/ogen/http"
)

// loggingClient wraps http.Client to log request/response
type loggingClient struct {
	client ht.Client
}

func (l *loggingClient) Do(req *http.Request) (*http.Response, error) {
	fmt.Printf("[AppRun HTTP] %s %s\n", req.Method, req.URL.String())

	resp, err := l.client.Do(req)
	if err != nil {
		fmt.Printf("[AppRun HTTP] error: %v\n", err)
		return nil, err
	}

	// レスポンスボディを読み取ってログに出力
	body, err := io.ReadAll(resp.Body)
	_ = resp.Body.Close()
	if err != nil {
		fmt.Printf("[AppRun HTTP] failed to read body: %v\n", err)
		return nil, err
	}

	fmt.Printf("[AppRun HTTP] status=%d, body=%s\n", resp.StatusCode, string(body))

	// ボディを再構築して返す
	resp.Body = io.NopCloser(bytes.NewReader(body))
	return resp, nil
}

const apiURL = "https://secure.sakura.ad.jp/cloud/api/apprun-dedicated/1.0"

// profileConfig usacloud プロファイルの設定
type profileConfig struct {
	AccessToken       string `json:"AccessToken"`
	AccessTokenSecret string `json:"AccessTokenSecret"`
}

// authSource SecuritySource の実装
type authSource struct {
	token  string
	secret string
}

func (a *authSource) BasicAuth(ctx context.Context, operationName OperationName) (BasicAuth, error) {
	return BasicAuth{
		Username: a.token,
		Password: a.secret,
	}, nil
}

// Service AppRun API サービス
type Service struct {
	client *Client
}

// NewService プロファイル名から Service を作成
func NewService(profileName string) (*Service, error) {
	cfg, err := loadProfileConfig(profileName)
	if err != nil {
		return nil, fmt.Errorf("failed to load profile %s: %w", profileName, err)
	}

	// アクセストークンのログ出力（先頭8文字のみ）
	tokenPrefix := cfg.AccessToken
	if len(tokenPrefix) > 8 {
		tokenPrefix = tokenPrefix[:8]
	}
	fmt.Printf("[AppRun] NewService: profile=%s, token_prefix=%s...\n", profileName, tokenPrefix)

	auth := &authSource{
		token:  cfg.AccessToken,
		secret: cfg.AccessTokenSecret,
	}

	// ログ出力するHTTPクライアントを使用
	httpClient := &loggingClient{client: http.DefaultClient}
	client, err := NewClient(apiURL, auth, WithClient(httpClient))
	if err != nil {
		return nil, fmt.Errorf("failed to create apprun client: %w", err)
	}

	return &Service{client: client}, nil
}

func loadProfileConfig(profileName string) (*profileConfig, error) {
	home, _ := os.UserHomeDir()
	configPath := filepath.Join(home, ".usacloud", profileName, "config.json")
	data, err := os.ReadFile(configPath)
	if err != nil {
		return nil, err
	}
	var cfg profileConfig
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, err
	}
	return &cfg, nil
}

// ClusterInfo クラスタ情報
type ClusterInfo struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// AppInfo アプリケーション情報
type AppInfo struct {
	ID            string `json:"id"`
	ClusterID     string `json:"clusterId"`
	Name          string `json:"name"`
	ActiveVersion int    `json:"activeVersion"`
}

// AppVersionInfo アプリケーションバージョン情報
type AppVersionInfo struct {
	Version         int    `json:"version"`
	Image           string `json:"image"`
	ActiveNodeCount int    `json:"activeNodeCount"`
	CreatedAt       string `json:"createdAt"`
}

// ExposedPortInfo 公開ポート情報
type ExposedPortInfo struct {
	TargetPort       int    `json:"targetPort"`
	LoadBalancerPort int    `json:"loadBalancerPort"`
	UseLetsEncrypt   bool   `json:"useLetsEncrypt"`
	Hosts            string `json:"hosts"`
}

// EnvVarInfo 環境変数情報
type EnvVarInfo struct {
	Key    string `json:"key"`
	Value  string `json:"value"`
	Secret bool   `json:"secret"`
}

// AppVersionDetailInfo アプリケーションバージョン詳細情報
type AppVersionDetailInfo struct {
	Version           int               `json:"version"`
	CPU               int               `json:"cpu"`
	Memory            int               `json:"memory"`
	ScalingMode       string            `json:"scalingMode"`
	FixedScale        int               `json:"fixedScale"`
	MinScale          int               `json:"minScale"`
	MaxScale          int               `json:"maxScale"`
	ScaleInThreshold  int               `json:"scaleInThreshold"`
	ScaleOutThreshold int               `json:"scaleOutThreshold"`
	Image             string            `json:"image"`
	Cmd               []string          `json:"cmd"`
	ActiveNodeCount   int               `json:"activeNodeCount"`
	CreatedAt         string            `json:"createdAt"`
	ExposedPorts      []ExposedPortInfo `json:"exposedPorts"`
	Env               []EnvVarInfo      `json:"env"`
}

// ASGInfo Auto Scaling Group 情報
type ASGInfo struct {
	ID              string          `json:"id"`
	Name            string          `json:"name"`
	Zone            string          `json:"zone"`
	MinNodes        int             `json:"minNodes"`
	MaxNodes        int             `json:"maxNodes"`
	WorkerNodeCount int             `json:"workerNodeCount"`
	Interfaces      []ASGInterface  `json:"interfaces"`
}

// ASGInterface ASGのインターフェース情報
type ASGInterface struct {
	Index    int    `json:"index"`
	Upstream string `json:"upstream"`
}

// LBInfo ロードバランサー情報
type LBInfo struct {
	ID               string `json:"id"`
	Name             string `json:"name"`
	ServiceClassPath string `json:"serviceClassPath"`
}

// WorkerNodeInfo ワーカーノード情報
type WorkerNodeInfo struct {
	ID         string              `json:"id"`
	Status     string              `json:"status"`
	Draining   bool                `json:"draining"`
	Interfaces []WorkerNodeInterface `json:"interfaces"`
}

// WorkerNodeInterface ワーカーノードのインターフェース
type WorkerNodeInterface struct {
	Index     int      `json:"index"`
	Addresses []string `json:"addresses"`
}

// LBNodeInfo ロードバランサーノード情報
type LBNodeInfo struct {
	ID         string              `json:"id"`
	Status     string              `json:"status"`
	Interfaces []LBNodeInterface   `json:"interfaces"`
}

// LBNodeInterface LBノードのインターフェース
type LBNodeInterface struct {
	Index     int      `json:"index"`
	Addresses []string `json:"addresses"`
}

// ListClusters クラスタ一覧を取得
func (s *Service) ListClusters(ctx context.Context) ([]ClusterInfo, error) {
	fmt.Printf("[AppRun] ListClusters: calling API...\n")
	resp, err := s.client.ListClusters(ctx, ListClustersParams{
		MaxItems: 30, // 最小値は5、最大30
	})
	if err != nil {
		fmt.Printf("[AppRun] ListClusters: error=%v\n", err)
		return nil, err
	}

	fmt.Printf("[AppRun] ListClusters: got %d clusters\n", len(resp.Clusters))
	clusters := make([]ClusterInfo, 0, len(resp.Clusters))
	for _, c := range resp.Clusters {
		fmt.Printf("[AppRun] ListClusters: cluster id=%s, name=%s\n", uuid.UUID(c.ClusterID).String(), c.Name)
		clusters = append(clusters, ClusterInfo{
			ID:   uuid.UUID(c.ClusterID).String(),
			Name: c.Name,
		})
	}
	return clusters, nil
}

// ListApplications アプリケーション一覧を取得
func (s *Service) ListApplications(ctx context.Context, clusterID string) ([]AppInfo, error) {
	params := ListApplicationsParams{
		MaxItems: 30, // 最小1、最大30
	}
	if clusterID != "" {
		id, err := uuid.Parse(clusterID)
		if err != nil {
			return nil, err
		}
		params.ClusterID.SetTo(ClusterID(id))
	}

	resp, err := s.client.ListApplications(ctx, params)
	if err != nil {
		return nil, err
	}

	apps := make([]AppInfo, 0, len(resp.Applications))
	for _, a := range resp.Applications {
		activeVersion := 0
		if !a.ActiveVersion.Null {
			activeVersion = int(a.ActiveVersion.Value)
		}
		apps = append(apps, AppInfo{
			ID:            uuid.UUID(a.ApplicationID).String(),
			ClusterID:     uuid.UUID(a.ClusterID).String(),
			Name:          a.Name,
			ActiveVersion: activeVersion,
		})
	}
	return apps, nil
}

// ListApplicationVersions アプリケーションバージョン一覧を取得
func (s *Service) ListApplicationVersions(ctx context.Context, applicationID string) ([]AppVersionInfo, error) {
	appID, err := uuid.Parse(applicationID)
	if err != nil {
		return nil, err
	}

	resp, err := s.client.ListApplicationVersions(ctx, ListApplicationVersionsParams{
		ApplicationID: ApplicationID(appID),
		MaxItems:      30, // 最小1、最大30
	})
	if err != nil {
		return nil, err
	}

	versions := make([]AppVersionInfo, 0, len(resp.Versions))
	for _, v := range resp.Versions {
		// Unix timestamp を日時文字列に変換
		createdAt := time.Unix(int64(v.Created), 0).Format("2006-01-02 15:04:05")
		versions = append(versions, AppVersionInfo{
			Version:         int(v.Version),
			Image:           v.Image,
			ActiveNodeCount: int(v.ActiveNodeCount),
			CreatedAt:       createdAt,
		})
	}
	return versions, nil
}

// GetApplicationVersion アプリケーションバージョン詳細を取得
func (s *Service) GetApplicationVersion(ctx context.Context, applicationID string, version int) (*AppVersionDetailInfo, error) {
	appID, err := uuid.Parse(applicationID)
	if err != nil {
		return nil, err
	}

	resp, err := s.client.GetApplicationVersion(ctx, GetApplicationVersionParams{
		ApplicationID: ApplicationID(appID),
		Version:       ApplicationVersionNumber(version),
	})
	if err != nil {
		return nil, err
	}

	v := resp.ApplicationVersion
	createdAt := time.Unix(int64(v.Created), 0).Format("2006-01-02 15:04:05")

	exposedPorts := make([]ExposedPortInfo, 0, len(v.ExposedPorts))
	for _, p := range v.ExposedPorts {
		lbPort := 0
		if !p.LoadBalancerPort.Null {
			lbPort = int(p.LoadBalancerPort.Value)
		}
		hosts := ""
		if len(p.Host) > 0 {
			hosts = fmt.Sprintf("%v", p.Host)
		}
		exposedPorts = append(exposedPorts, ExposedPortInfo{
			TargetPort:       int(p.TargetPort),
			LoadBalancerPort: lbPort,
			UseLetsEncrypt:   p.UseLetsEncrypt,
			Hosts:            hosts,
		})
	}

	envVars := make([]EnvVarInfo, 0, len(v.Env))
	for _, e := range v.Env {
		envVars = append(envVars, EnvVarInfo{
			Key:    e.Key,
			Value:  e.Value.Value,
			Secret: e.Secret,
		})
	}

	return &AppVersionDetailInfo{
		Version:           int(v.Version),
		CPU:               int(v.CPU),
		Memory:            int(v.Memory),
		ScalingMode:       string(v.ScalingMode),
		FixedScale:        int(v.FixedScale.Value),
		MinScale:          int(v.MinScale.Value),
		MaxScale:          int(v.MaxScale.Value),
		ScaleInThreshold:  int(v.ScaleInThreshold.Value),
		ScaleOutThreshold: int(v.ScaleOutThreshold.Value),
		Image:             v.Image,
		Cmd:               v.Cmd,
		ActiveNodeCount:   int(v.ActiveNodeCount),
		CreatedAt:         createdAt,
		ExposedPorts:      exposedPorts,
		Env:               envVars,
	}, nil
}

// SetActiveVersion アプリケーションのアクティブバージョンを設定
func (s *Service) SetActiveVersion(ctx context.Context, applicationID string, version int) error {
	appID, err := uuid.Parse(applicationID)
	if err != nil {
		return err
	}

	req := &UpdateApplication{}
	req.ActiveVersion.SetTo(int32(version))

	return s.client.UpdateApplication(ctx, req, UpdateApplicationParams{
		ApplicationID: ApplicationID(appID),
	})
}

// ListAutoScalingGroups ASG 一覧を取得
func (s *Service) ListAutoScalingGroups(ctx context.Context, clusterID string) ([]ASGInfo, error) {
	cID, err := uuid.Parse(clusterID)
	if err != nil {
		return nil, err
	}

	resp, err := s.client.ListAutoScalingGroups(ctx, ListAutoScalingGroupsParams{
		ClusterID: ClusterID(cID),
		MaxItems:  30, // 最小1、最大30
	})
	if err != nil {
		return nil, err
	}

	asgs := make([]ASGInfo, 0, len(resp.AutoScalingGroups))
	for _, a := range resp.AutoScalingGroups {
		interfaces := make([]ASGInterface, 0, len(a.Interfaces))
		for _, iface := range a.Interfaces {
			interfaces = append(interfaces, ASGInterface{
				Index:    int(iface.InterfaceIndex),
				Upstream: iface.Upstream,
			})
		}
		asgs = append(asgs, ASGInfo{
			ID:              uuid.UUID(a.AutoScalingGroupID).String(),
			Name:            a.Name,
			Zone:            a.Zone,
			MinNodes:        int(a.MinNodes),
			MaxNodes:        int(a.MaxNodes),
			WorkerNodeCount: int(a.WorkerNodeCount),
			Interfaces:      interfaces,
		})
	}
	return asgs, nil
}

// ListLoadBalancers ロードバランサー一覧を取得
func (s *Service) ListLoadBalancers(ctx context.Context, clusterID, asgID string) ([]LBInfo, error) {
	cID, err := uuid.Parse(clusterID)
	if err != nil {
		return nil, err
	}
	aID, err := uuid.Parse(asgID)
	if err != nil {
		return nil, err
	}

	resp, err := s.client.ListLoadBalancers(ctx, ListLoadBalancersParams{
		ClusterID:          ClusterID(cID),
		AutoScalingGroupID: AutoScalingGroupID(aID),
		MaxItems:           30, // 最小2、最大30
	})
	if err != nil {
		return nil, err
	}

	lbs := make([]LBInfo, 0, len(resp.LoadBalancers))
	for _, lb := range resp.LoadBalancers {
		lbs = append(lbs, LBInfo{
			ID:               uuid.UUID(lb.LoadBalancerID).String(),
			Name:             lb.Name,
			ServiceClassPath: lb.ServiceClassPath,
		})
	}
	return lbs, nil
}

// ListWorkerNodes ワーカーノード一覧を取得
func (s *Service) ListWorkerNodes(ctx context.Context, clusterID, asgID string) ([]WorkerNodeInfo, error) {
	cID, err := uuid.Parse(clusterID)
	if err != nil {
		return nil, err
	}
	aID, err := uuid.Parse(asgID)
	if err != nil {
		return nil, err
	}

	resp, err := s.client.ListWorkerNodes(ctx, ListWorkerNodesParams{
		ClusterID:          ClusterID(cID),
		AutoScalingGroupID: AutoScalingGroupID(aID),
		MaxItems:           100, // 最小2、最大100
	})
	if err != nil {
		return nil, err
	}

	nodes := make([]WorkerNodeInfo, 0, len(resp.WorkerNodes))
	for _, n := range resp.WorkerNodes {
		interfaces := make([]WorkerNodeInterface, 0, len(n.NetworkInterfaces))
		for _, iface := range n.NetworkInterfaces {
			addrs := make([]string, 0, len(iface.Addresses))
			for _, addr := range iface.Addresses {
				addrs = append(addrs, addr.Address)
			}
			interfaces = append(interfaces, WorkerNodeInterface{
				Index:     int(iface.InterfaceIndex),
				Addresses: addrs,
			})
		}
		nodes = append(nodes, WorkerNodeInfo{
			ID:         uuid.UUID(n.WorkerNodeID).String(),
			Status:     string(n.Status),
			Draining:   n.Draining,
			Interfaces: interfaces,
		})
	}
	return nodes, nil
}

// ListLoadBalancerNodes ロードバランサーノード一覧を取得
func (s *Service) ListLoadBalancerNodes(ctx context.Context, clusterID, asgID, lbID string) ([]LBNodeInfo, error) {
	cID, err := uuid.Parse(clusterID)
	if err != nil {
		return nil, err
	}
	aID, err := uuid.Parse(asgID)
	if err != nil {
		return nil, err
	}
	loadBalancerID, err := uuid.Parse(lbID)
	if err != nil {
		return nil, err
	}

	resp, err := s.client.ListLoadBalancerNodes(ctx, ListLoadBalancerNodesParams{
		ClusterID:          ClusterID(cID),
		AutoScalingGroupID: AutoScalingGroupID(aID),
		LoadBalancerID:     LoadBalancerID(loadBalancerID),
		MaxItems:           30, // 最小2、最大30
	})
	if err != nil {
		return nil, err
	}

	nodes := make([]LBNodeInfo, 0, len(resp.LoadBalancerNodes))
	for _, n := range resp.LoadBalancerNodes {
		interfaces := make([]LBNodeInterface, 0, len(n.Interfaces))
		for _, iface := range n.Interfaces {
			addrs := make([]string, 0, len(iface.Addresses))
			for _, addr := range iface.Addresses {
				addrs = append(addrs, addr.Address)
			}
			interfaces = append(interfaces, LBNodeInterface{
				Index:     int(iface.InterfaceIndex),
				Addresses: addrs,
			})
		}
		nodes = append(nodes, LBNodeInfo{
			ID:         uuid.UUID(n.LoadBalancerNodeID).String(),
			Status:     string(n.Status),
			Interfaces: interfaces,
		})
	}
	return nodes, nil
}
