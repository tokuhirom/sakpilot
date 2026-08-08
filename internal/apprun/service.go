package apprun

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/google/uuid"
	apprundedicated "github.com/sacloud/sacloud-sdk-go/api/apprun-dedicated"
	"github.com/sacloud/sacloud-sdk-go/api/apprun-dedicated/apis/autoscalinggroup"
	"github.com/sacloud/sacloud-sdk-go/api/apprun-dedicated/apis/certificate"
	"github.com/sacloud/sacloud-sdk-go/api/apprun-dedicated/apis/cluster"
	"github.com/sacloud/sacloud-sdk-go/api/apprun-dedicated/apis/loadbalancer"
	v1 "github.com/sacloud/sacloud-sdk-go/api/apprun-dedicated/apis/v1"
	"github.com/sacloud/sacloud-sdk-go/api/apprun-dedicated/apis/version"
	"github.com/sacloud/sacloud-sdk-go/common/saclient"
)

// profileConfig usacloud プロファイルの設定
type profileConfig struct {
	AccessToken       string `json:"AccessToken"`
	AccessTokenSecret string `json:"AccessTokenSecret"`
}

// Service AppRun Dedicated API サービス
type Service struct {
	client *v1.Client
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

	var sc saclient.Client
	env := append(os.Environ(),
		"SAKURA_ACCESS_TOKEN="+cfg.AccessToken,
		"SAKURA_ACCESS_TOKEN_SECRET="+cfg.AccessTokenSecret,
	)
	if err := sc.SetEnviron(env); err != nil {
		return nil, fmt.Errorf("failed to configure apprun-dedicated client: %w", err)
	}

	client, err := apprundedicated.NewClient(&sc)
	if err != nil {
		return nil, fmt.Errorf("failed to create apprun-dedicated client: %w", err)
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

// CreateHealthCheckParams ヘルスチェック作成パラメータ
type CreateHealthCheckParams struct {
	Path            string `json:"path"`
	IntervalSeconds int32  `json:"intervalSeconds"`
	TimeoutSeconds  int32  `json:"timeoutSeconds"`
}

// CreateExposedPortParams 公開ポート作成パラメータ
type CreateExposedPortParams struct {
	TargetPort       int32                    `json:"targetPort"`
	LoadBalancerPort *int32                   `json:"loadBalancerPort,omitempty"`
	UseLetsEncrypt   bool                     `json:"useLetsEncrypt"`
	Host             []string                 `json:"host,omitempty"`
	HealthCheck      *CreateHealthCheckParams `json:"healthCheck,omitempty"`
}

// CreateEnvVarParams 環境変数作成パラメータ
type CreateEnvVarParams struct {
	Key    string  `json:"key"`
	Value  *string `json:"value,omitempty"`
	Secret bool    `json:"secret"`
}

// CreateAppVersionParams アプリケーションバージョン作成パラメータ（デプロイ）
type CreateAppVersionParams struct {
	CPU               int64                     `json:"cpu"`
	Memory            int64                     `json:"memory"`
	ScalingMode       string                    `json:"scalingMode"` // "manual" or "cpu"
	FixedScale        *int32                    `json:"fixedScale,omitempty"`
	MinScale          *int32                    `json:"minScale,omitempty"`
	MaxScale          *int32                    `json:"maxScale,omitempty"`
	ScaleInThreshold  *int32                    `json:"scaleInThreshold,omitempty"`
	ScaleOutThreshold *int32                    `json:"scaleOutThreshold,omitempty"`
	Image             string                    `json:"image"`
	Cmd               []string                  `json:"cmd,omitempty"`
	RegistryUsername  *string                   `json:"registryUsername,omitempty"`
	RegistryPassword  *string                   `json:"registryPassword,omitempty"`
	ExposedPorts      []CreateExposedPortParams `json:"exposedPorts,omitempty"`
	EnvVars           []CreateEnvVarParams      `json:"envVars,omitempty"`
}

// ASGInfo Auto Scaling Group 情報
type ASGInfo struct {
	ID              string         `json:"id"`
	Name            string         `json:"name"`
	Zone            string         `json:"zone"`
	MinNodes        int            `json:"minNodes"`
	MaxNodes        int            `json:"maxNodes"`
	WorkerNodeCount int            `json:"workerNodeCount"`
	Interfaces      []ASGInterface `json:"interfaces"`
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
	ID         string                `json:"id"`
	Status     string                `json:"status"`
	Draining   bool                  `json:"draining"`
	Interfaces []WorkerNodeInterface `json:"interfaces"`
}

// WorkerNodeInterface ワーカーノードのインターフェース
type WorkerNodeInterface struct {
	Index     int      `json:"index"`
	Addresses []string `json:"addresses"`
}

// LBNodeInfo ロードバランサーノード情報
type LBNodeInfo struct {
	ID         string            `json:"id"`
	Status     string            `json:"status"`
	Interfaces []LBNodeInterface `json:"interfaces"`
}

// LBNodeInterface LBノードのインターフェース
type LBNodeInterface struct {
	Index     int      `json:"index"`
	Addresses []string `json:"addresses"`
}

// CreateClusterPortParams クラスタ作成時の待ち受けポート設定
type CreateClusterPortParams struct {
	Port     int32  `json:"port"`
	Protocol string `json:"protocol"` // "http", "https", "tcp"
}

// CreateClusterParams クラスタ作成パラメータ
type CreateClusterParams struct {
	Name               string                    `json:"name"`
	LetsEncryptEmail   *string                   `json:"letsEncryptEmail,omitempty"`
	Ports              []CreateClusterPortParams `json:"ports"`
	ServicePrincipalID string                    `json:"servicePrincipalID"`
}

// CreateCluster クラスタを作成
func (s *Service) CreateCluster(ctx context.Context, params CreateClusterParams) (*ClusterInfo, error) {
	ports := make([]v1.CreateLoadBalancerPort, 0, len(params.Ports))
	for _, p := range params.Ports {
		ports = append(ports, v1.CreateLoadBalancerPort{
			Port:     uint16(p.Port),
			Protocol: v1.CreateLoadBalancerPortProtocol(p.Protocol),
		})
	}

	clusterOp := apprundedicated.NewClusterOp(s.client)
	created, err := clusterOp.Create(ctx, cluster.CreateParams{
		Name:               params.Name,
		LetsEncryptEmail:   params.LetsEncryptEmail,
		Ports:              ports,
		ServicePrincipalID: params.ServicePrincipalID,
	})
	if err != nil {
		return nil, err
	}

	return &ClusterInfo{
		ID:   uuid.UUID(created.GetClusterID()).String(),
		Name: params.Name,
	}, nil
}

// ListClusters クラスタ一覧を取得
func (s *Service) ListClusters(ctx context.Context) ([]ClusterInfo, error) {
	clusterOp := apprundedicated.NewClusterOp(s.client)
	list, _, err := clusterOp.List(ctx, 30, nil) // 最小値は5、最大30
	if err != nil {
		return nil, err
	}

	clusters := make([]ClusterInfo, 0, len(list))
	for _, c := range list {
		clusters = append(clusters, ClusterInfo{
			ID:   uuid.UUID(c.ClusterID).String(),
			Name: c.Name,
		})
	}
	return clusters, nil
}

// ListApplications アプリケーション一覧を取得
func (s *Service) ListApplications(ctx context.Context, clusterID string) ([]AppInfo, error) {
	var filterClusterID *v1.ClusterID
	if clusterID != "" {
		id, err := uuid.Parse(clusterID)
		if err != nil {
			return nil, err
		}
		cid := v1.ClusterID(id)
		filterClusterID = &cid
	}

	applicationOp := apprundedicated.NewApplicationOp(s.client)
	list, _, err := applicationOp.List(ctx, 30, nil) // 最小1、最大30
	if err != nil {
		return nil, err
	}

	apps := make([]AppInfo, 0, len(list))
	for _, a := range list {
		if filterClusterID != nil && a.ClusterID != *filterClusterID {
			continue
		}
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

	versionOp := apprundedicated.NewVersionOp(s.client, v1.ApplicationID(appID))
	list, _, err := versionOp.List(ctx, 30, nil) // 最小1、最大30
	if err != nil {
		return nil, err
	}

	versions := make([]AppVersionInfo, 0, len(list))
	for _, v := range list {
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

	versionOp := apprundedicated.NewVersionOp(s.client, v1.ApplicationID(appID))
	v, err := versionOp.Read(ctx, v1.ApplicationVersionNumber(version))
	if err != nil {
		return nil, err
	}

	createdAt := time.Unix(int64(v.Created), 0).Format("2006-01-02 15:04:05")

	exposedPorts := make([]ExposedPortInfo, 0, len(v.ExposedPorts))
	for _, p := range v.ExposedPorts {
		lbPort := 0
		if p.LoadBalancerPort != nil {
			lbPort = int(*p.LoadBalancerPort)
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

	envVars := make([]EnvVarInfo, 0, len(v.EnvVars))
	for _, e := range v.EnvVars {
		value := ""
		if e.Value != nil {
			value = *e.Value
		}
		envVars = append(envVars, EnvVarInfo{
			Key:    e.Key,
			Value:  value,
			Secret: e.Secret,
		})
	}

	return &AppVersionDetailInfo{
		Version:           int(v.Version),
		CPU:               int(v.CPU),
		Memory:            int(v.Memory),
		ScalingMode:       string(v.ScalingMode),
		FixedScale:        int32OrZero(v.FixedScale),
		MinScale:          int32OrZero(v.MinScale),
		MaxScale:          int32OrZero(v.MaxScale),
		ScaleInThreshold:  int32OrZero(v.ScaleInThreshold),
		ScaleOutThreshold: int32OrZero(v.ScaleOutThreshold),
		Image:             v.Image,
		Cmd:               v.Cmd,
		ActiveNodeCount:   int(v.ActiveNodeCount),
		CreatedAt:         createdAt,
		ExposedPorts:      exposedPorts,
		Env:               envVars,
	}, nil
}

func int32OrZero(p *int32) int {
	if p == nil {
		return 0
	}
	return int(*p)
}

// CreateApplicationVersion アプリケーションの新しいバージョンを作成（デプロイ）
func (s *Service) CreateApplicationVersion(ctx context.Context, applicationID string, params CreateAppVersionParams) (*AppVersionInfo, error) {
	appID, err := uuid.Parse(applicationID)
	if err != nil {
		return nil, err
	}

	scalingMode := v1.ScalingModeManual
	if params.ScalingMode == string(v1.ScalingModeCPU) {
		scalingMode = v1.ScalingModeCPU
	}

	exposedPorts := make([]version.ExposedPort, 0, len(params.ExposedPorts))
	for _, p := range params.ExposedPorts {
		var healthCheck *v1.HealthCheck
		if p.HealthCheck != nil {
			healthCheck = &v1.HealthCheck{
				Path:            p.HealthCheck.Path,
				IntervalSeconds: p.HealthCheck.IntervalSeconds,
				TimeoutSeconds:  p.HealthCheck.TimeoutSeconds,
			}
		}
		var lbPort *v1.Port
		if p.LoadBalancerPort != nil {
			port := v1.Port(*p.LoadBalancerPort)
			lbPort = &port
		}
		exposedPorts = append(exposedPorts, version.ExposedPort{
			TargetPort:       v1.Port(p.TargetPort),
			LoadBalancerPort: lbPort,
			UseLetsEncrypt:   p.UseLetsEncrypt,
			Host:             p.Host,
			HealthCheck:      healthCheck,
		})
	}

	envVars := make([]version.EnvironmentVariable, 0, len(params.EnvVars))
	for _, e := range params.EnvVars {
		envVars = append(envVars, version.EnvironmentVariable{
			Key:    e.Key,
			Value:  e.Value,
			Secret: e.Secret,
		})
	}

	registryPasswordAction := v1.RegistryPasswordActionKeep
	if params.RegistryPassword != nil && *params.RegistryPassword != "" {
		registryPasswordAction = v1.RegistryPasswordActionNew
	}

	versionOp := apprundedicated.NewVersionOp(s.client, v1.ApplicationID(appID))
	ver, err := versionOp.Create(ctx, version.CreateParams{
		CPU:                    params.CPU,
		Memory:                 params.Memory,
		ScalingMode:            scalingMode,
		FixedScale:             params.FixedScale,
		MinScale:               params.MinScale,
		MaxScale:               params.MaxScale,
		ScaleInThreshold:       params.ScaleInThreshold,
		ScaleOutThreshold:      params.ScaleOutThreshold,
		Image:                  params.Image,
		Cmd:                    params.Cmd,
		RegistryUsername:       params.RegistryUsername,
		RegistryPassword:       params.RegistryPassword,
		RegistryPasswordAction: registryPasswordAction,
		ExposedPorts:           exposedPorts,
		EnvVars:                envVars,
	})
	if err != nil {
		return nil, err
	}

	// Create レスポンスはバージョン番号のみを返すため、詳細を取得して補完する
	detail, err := versionOp.Read(ctx, ver.Version)
	if err != nil {
		return nil, err
	}

	createdAt := time.Unix(int64(detail.Created), 0).Format("2006-01-02 15:04:05")
	return &AppVersionInfo{
		Version:         int(detail.Version),
		Image:           detail.Image,
		ActiveNodeCount: int(detail.ActiveNodeCount),
		CreatedAt:       createdAt,
	}, nil
}

// DeleteApplicationVersion アプリケーションバージョンを削除
func (s *Service) DeleteApplicationVersion(ctx context.Context, applicationID string, version int) error {
	appID, err := uuid.Parse(applicationID)
	if err != nil {
		return err
	}

	versionOp := apprundedicated.NewVersionOp(s.client, v1.ApplicationID(appID))
	return versionOp.Delete(ctx, v1.ApplicationVersionNumber(version))
}

// SetActiveVersion アプリケーションのアクティブバージョンを設定
func (s *Service) SetActiveVersion(ctx context.Context, applicationID string, version int) error {
	appID, err := uuid.Parse(applicationID)
	if err != nil {
		return err
	}

	toVersion := int32(version)
	applicationOp := apprundedicated.NewApplicationOp(s.client)
	return applicationOp.Update(ctx, v1.ApplicationID(appID), &toVersion)
}

// ClearActiveVersion アプリケーションのアクティブバージョンをクリア（nullに設定）
func (s *Service) ClearActiveVersion(ctx context.Context, applicationID string) error {
	appID, err := uuid.Parse(applicationID)
	if err != nil {
		return err
	}

	applicationOp := apprundedicated.NewApplicationOp(s.client)
	return applicationOp.Update(ctx, v1.ApplicationID(appID), nil)
}

// CreateApplication アプリケーションを作成
func (s *Service) CreateApplication(ctx context.Context, name, clusterID string) (*AppInfo, error) {
	cID, err := uuid.Parse(clusterID)
	if err != nil {
		return nil, err
	}

	applicationOp := apprundedicated.NewApplicationOp(s.client)
	created, err := applicationOp.Create(ctx, name, v1.ClusterID(cID))
	if err != nil {
		return nil, err
	}

	return &AppInfo{
		ID:        uuid.UUID(created.GetApplicationID()).String(),
		ClusterID: clusterID,
		Name:      name,
	}, nil
}

// UpdateWorkerNodeDraining ワーカーノードのdraining状態を更新
func (s *Service) UpdateWorkerNodeDraining(ctx context.Context, clusterID, asgID, workerNodeID string, draining bool) error {
	cID, err := uuid.Parse(clusterID)
	if err != nil {
		return err
	}
	aID, err := uuid.Parse(asgID)
	if err != nil {
		return err
	}
	wID, err := uuid.Parse(workerNodeID)
	if err != nil {
		return err
	}

	workerNodeOp := apprundedicated.NewWorkerNodeOp(s.client, v1.ClusterID(cID), v1.AutoScalingGroupID(aID))
	return workerNodeOp.Update(ctx, v1.WorkerNodeID(wID), draining)
}

// DeleteCluster クラスタを削除
func (s *Service) DeleteCluster(ctx context.Context, clusterID string) error {
	cID, err := uuid.Parse(clusterID)
	if err != nil {
		return err
	}

	clusterOp := apprundedicated.NewClusterOp(s.client)
	return clusterOp.Delete(ctx, v1.ClusterID(cID))
}

// DeleteApplication アプリケーションを削除
func (s *Service) DeleteApplication(ctx context.Context, applicationID string) error {
	appID, err := uuid.Parse(applicationID)
	if err != nil {
		return err
	}

	applicationOp := apprundedicated.NewApplicationOp(s.client)
	return applicationOp.Delete(ctx, v1.ApplicationID(appID))
}

// DeleteAutoScalingGroup ASGを削除
func (s *Service) DeleteAutoScalingGroup(ctx context.Context, clusterID, asgID string) error {
	cID, err := uuid.Parse(clusterID)
	if err != nil {
		return err
	}
	aID, err := uuid.Parse(asgID)
	if err != nil {
		return err
	}

	asgOp := apprundedicated.NewAutoScalingGroupOp(s.client, v1.ClusterID(cID))
	return asgOp.Delete(ctx, v1.AutoScalingGroupID(aID))
}

// DeleteLoadBalancer ロードバランサーを削除
func (s *Service) DeleteLoadBalancer(ctx context.Context, clusterID, asgID, lbID string) error {
	cID, err := uuid.Parse(clusterID)
	if err != nil {
		return err
	}
	aID, err := uuid.Parse(asgID)
	if err != nil {
		return err
	}
	loadBalancerID, err := uuid.Parse(lbID)
	if err != nil {
		return err
	}

	lbOp := apprundedicated.NewLoadBalancerOp(s.client, v1.ClusterID(cID), v1.AutoScalingGroupID(aID))
	return lbOp.Delete(ctx, v1.LoadBalancerID(loadBalancerID))
}

// CreateIPRangeParams ASGインターフェースのIPプール範囲
type CreateIPRangeParams struct {
	Start string `json:"start"`
	End   string `json:"end"`
}

// CreateASGInterfaceParams ASG作成時のインターフェース設定
type CreateASGInterfaceParams struct {
	InterfaceIndex int16                 `json:"interfaceIndex"`
	Upstream       string                `json:"upstream"`
	IPPool         []CreateIPRangeParams `json:"ipPool,omitempty"`
	NetmaskLen     *int16                `json:"netmaskLen,omitempty"`
	DefaultGateway *string               `json:"defaultGateway,omitempty"`
	PacketFilterID *string               `json:"packetFilterID,omitempty"`
	ConnectsToLB   bool                  `json:"connectsToLB"`
}

// CreateASGParams ASG作成パラメータ
type CreateASGParams struct {
	Name                   string                     `json:"name"`
	Zone                   string                     `json:"zone"`
	NameServers            []string                   `json:"nameServers"`
	WorkerServiceClassPath string                     `json:"workerServiceClassPath"`
	MinNodes               int32                      `json:"minNodes"`
	MaxNodes               int32                      `json:"maxNodes"`
	Interfaces             []CreateASGInterfaceParams `json:"interfaces"`
}

// CreateAutoScalingGroup ASGを作成
func (s *Service) CreateAutoScalingGroup(ctx context.Context, clusterID string, params CreateASGParams) (*ASGInfo, error) {
	cID, err := uuid.Parse(clusterID)
	if err != nil {
		return nil, err
	}

	nameServers := make([]v1.IPv4, 0, len(params.NameServers))
	for _, ns := range params.NameServers {
		nameServers = append(nameServers, v1.IPv4(ns))
	}

	interfaces := make([]autoscalinggroup.NodeInterface, 0, len(params.Interfaces))
	for _, iface := range params.Interfaces {
		ipPool := make([]v1.IpRange, 0, len(iface.IPPool))
		for _, r := range iface.IPPool {
			ipPool = append(ipPool, v1.IpRange{Start: v1.IPv4(r.Start), End: v1.IPv4(r.End)})
		}
		interfaces = append(interfaces, autoscalinggroup.NodeInterface{
			InterfaceIndex: iface.InterfaceIndex,
			Upstream:       iface.Upstream,
			IpPool:         ipPool,
			NetmaskLen:     iface.NetmaskLen,
			DefaultGateway: iface.DefaultGateway,
			PacketFilterID: iface.PacketFilterID,
			ConnectsToLB:   iface.ConnectsToLB,
		})
	}

	asgOp := apprundedicated.NewAutoScalingGroupOp(s.client, v1.ClusterID(cID))
	created, err := asgOp.Create(ctx, autoscalinggroup.CreateParams{
		Name:                   params.Name,
		Zone:                   params.Zone,
		NameServers:            nameServers,
		WorkerServiceClassPath: params.WorkerServiceClassPath,
		MinNodes:               params.MinNodes,
		MaxNodes:               params.MaxNodes,
		Interfaces:             interfaces,
	})
	if err != nil {
		return nil, err
	}

	return &ASGInfo{
		ID:       uuid.UUID(created.GetAutoScalingGroupID()).String(),
		Name:     params.Name,
		Zone:     params.Zone,
		MinNodes: int(params.MinNodes),
		MaxNodes: int(params.MaxNodes),
	}, nil
}

// ListAutoScalingGroups ASG 一覧を取得
func (s *Service) ListAutoScalingGroups(ctx context.Context, clusterID string) ([]ASGInfo, error) {
	cID, err := uuid.Parse(clusterID)
	if err != nil {
		return nil, err
	}

	asgOp := apprundedicated.NewAutoScalingGroupOp(s.client, v1.ClusterID(cID))
	list, _, err := asgOp.List(ctx, 30, nil) // 最小1、最大30
	if err != nil {
		fmt.Printf("[AppRun] ListAutoScalingGroups error: %v\n", err)
		return nil, err
	}

	asgs := make([]ASGInfo, 0, len(list))
	for _, a := range list {
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

// CreateLBInterfaceParams LB作成時のインターフェース設定
type CreateLBInterfaceParams struct {
	InterfaceIndex  int16                 `json:"interfaceIndex"`
	Upstream        string                `json:"upstream"`
	IPPool          []CreateIPRangeParams `json:"ipPool,omitempty"`
	NetmaskLen      *int16                `json:"netmaskLen,omitempty"`
	DefaultGateway  *string               `json:"defaultGateway,omitempty"`
	Vip             *string               `json:"vip,omitempty"`
	VirtualRouterID *int16                `json:"virtualRouterID,omitempty"`
	PacketFilterID  *string               `json:"packetFilterID,omitempty"`
}

// CreateLBParams LB作成パラメータ
type CreateLBParams struct {
	Name             string                    `json:"name"`
	ServiceClassPath string                    `json:"serviceClassPath"`
	NameServers      []string                  `json:"nameServers"`
	Interfaces       []CreateLBInterfaceParams `json:"interfaces"`
}

// CreateLoadBalancer ロードバランサーを作成
func (s *Service) CreateLoadBalancer(ctx context.Context, clusterID, asgID string, params CreateLBParams) (*LBInfo, error) {
	cID, err := uuid.Parse(clusterID)
	if err != nil {
		return nil, err
	}
	aID, err := uuid.Parse(asgID)
	if err != nil {
		return nil, err
	}

	nameServers := make([]v1.IPv4, 0, len(params.NameServers))
	for _, ns := range params.NameServers {
		nameServers = append(nameServers, v1.IPv4(ns))
	}

	interfaces := make([]loadbalancer.LoadBalancerInterface, 0, len(params.Interfaces))
	for _, iface := range params.Interfaces {
		ipPool := make([]v1.IpRange, 0, len(iface.IPPool))
		for _, r := range iface.IPPool {
			ipPool = append(ipPool, v1.IpRange{Start: v1.IPv4(r.Start), End: v1.IPv4(r.End)})
		}
		interfaces = append(interfaces, loadbalancer.LoadBalancerInterface{
			InterfaceIndex:  iface.InterfaceIndex,
			Upstream:        iface.Upstream,
			IpPool:          ipPool,
			NetmaskLen:      iface.NetmaskLen,
			DefaultGateway:  iface.DefaultGateway,
			Vip:             iface.Vip,
			VirtualRouterID: iface.VirtualRouterID,
			PacketFilterID:  iface.PacketFilterID,
		})
	}

	lbOp := apprundedicated.NewLoadBalancerOp(s.client, v1.ClusterID(cID), v1.AutoScalingGroupID(aID))
	created, err := lbOp.Create(ctx, loadbalancer.CreateParams{
		Name:             params.Name,
		ServiceClassPath: params.ServiceClassPath,
		NameServers:      nameServers,
		Interfaces:       interfaces,
	})
	if err != nil {
		return nil, err
	}

	return &LBInfo{
		ID:               uuid.UUID(created.GetLoadBalancerID()).String(),
		Name:             params.Name,
		ServiceClassPath: params.ServiceClassPath,
	}, nil
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

	lbOp := apprundedicated.NewLoadBalancerOp(s.client, v1.ClusterID(cID), v1.AutoScalingGroupID(aID))
	list, _, err := lbOp.List(ctx, 30, nil) // 最小2、最大30
	if err != nil {
		return nil, err
	}

	lbs := make([]LBInfo, 0, len(list))
	for _, lb := range list {
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

	workerNodeOp := apprundedicated.NewWorkerNodeOp(s.client, v1.ClusterID(cID), v1.AutoScalingGroupID(aID))
	list, _, err := workerNodeOp.List(ctx, 100, nil) // 最小2、最大100
	if err != nil {
		return nil, err
	}

	nodes := make([]WorkerNodeInfo, 0, len(list))
	for _, n := range list {
		interfaces := make([]WorkerNodeInterface, 0, len(n.NetworkInterfaces))
		for _, iface := range n.NetworkInterfaces {
			interfaces = append(interfaces, WorkerNodeInterface{
				Index:     int(iface.InterfaceIndex),
				Addresses: iface.Addresses,
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

	lbOp := apprundedicated.NewLoadBalancerOp(s.client, v1.ClusterID(cID), v1.AutoScalingGroupID(aID))
	list, err := lbOp.ListNodes(ctx, v1.LoadBalancerID(loadBalancerID), 30, nil) // 最小2、最大30
	if err != nil {
		return nil, err
	}

	nodes := make([]LBNodeInfo, 0, len(list))
	for _, n := range list {
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

// CertificateInfo クラスタの証明書情報
type CertificateInfo struct {
	ID                      string   `json:"id"`
	Name                    string   `json:"name"`
	CommonName              string   `json:"commonName"`
	SubjectAlternativeNames []string `json:"subjectAlternativeNames"`
	NotBefore               string   `json:"notBefore"`
	NotAfter                string   `json:"notAfter"`
	Created                 string   `json:"created"`
}

// CreateCertificateParams 証明書の作成・更新パラメータ
type CreateCertificateParams struct {
	Name                       string  `json:"name"`
	CertificatePEM             string  `json:"certificatePem"`
	PrivateKeyPEM              string  `json:"privateKeyPem"`
	IntermediateCertificatePEM *string `json:"intermediateCertificatePem,omitempty"`
}

func toCertificateInfo(id string, c v1.ReadCertificate) CertificateInfo {
	unixOrEmpty := func(sec int) string {
		if sec == 0 {
			return ""
		}
		return time.Unix(int64(sec), 0).Format("2006-01-02 15:04:05")
	}
	return CertificateInfo{
		ID:                      id,
		Name:                    c.Name,
		CommonName:              c.CommonName,
		SubjectAlternativeNames: c.SubjectAlternativeNames,
		NotBefore:               unixOrEmpty(c.NotBeforeSec),
		NotAfter:                unixOrEmpty(c.NotAfterSec),
		Created:                 unixOrEmpty(c.Created),
	}
}

// ListCertificates クラスタの証明書一覧を取得
func (s *Service) ListCertificates(ctx context.Context, clusterID string) ([]CertificateInfo, error) {
	cID, err := uuid.Parse(clusterID)
	if err != nil {
		return nil, err
	}

	certOp := apprundedicated.NewCertificateOp(s.client, v1.ClusterID(cID))
	list, _, err := certOp.List(ctx, 30, nil) // 最小1、最大30
	if err != nil {
		return nil, err
	}

	certs := make([]CertificateInfo, 0, len(list))
	for _, c := range list {
		certs = append(certs, toCertificateInfo(uuid.UUID(c.GetCertificateID()).String(), c))
	}
	return certs, nil
}

// CreateCertificate クラスタに証明書を作成
func (s *Service) CreateCertificate(ctx context.Context, clusterID string, params CreateCertificateParams) (*CertificateInfo, error) {
	cID, err := uuid.Parse(clusterID)
	if err != nil {
		return nil, err
	}

	certOp := apprundedicated.NewCertificateOp(s.client, v1.ClusterID(cID))
	created, err := certOp.Create(ctx, certificate.CreateParams{
		Name:                       params.Name,
		CertificatePEM:             params.CertificatePEM,
		PrivateKeyPEM:              params.PrivateKeyPEM,
		IntermediateCertificatePEM: params.IntermediateCertificatePEM,
	})
	if err != nil {
		return nil, err
	}

	cert, err := certOp.Read(ctx, created.GetCertificateID())
	if err != nil {
		return nil, err
	}

	info := toCertificateInfo(uuid.UUID(created.GetCertificateID()).String(), *cert)
	return &info, nil
}

// UpdateCertificate クラスタの証明書を更新(全項目を再送信する必要がある)
func (s *Service) UpdateCertificate(ctx context.Context, clusterID, certificateID string, params CreateCertificateParams) error {
	cID, err := uuid.Parse(clusterID)
	if err != nil {
		return err
	}
	certID, err := uuid.Parse(certificateID)
	if err != nil {
		return err
	}

	certOp := apprundedicated.NewCertificateOp(s.client, v1.ClusterID(cID))
	return certOp.Update(ctx, v1.CertificateID(certID), certificate.UpdateParams{
		Name:                       params.Name,
		CertificatePEM:             params.CertificatePEM,
		PrivateKeyPEM:              params.PrivateKeyPEM,
		IntermediateCertificatePEM: params.IntermediateCertificatePEM,
	})
}

// DeleteCertificate クラスタの証明書を削除
func (s *Service) DeleteCertificate(ctx context.Context, clusterID, certificateID string) error {
	cID, err := uuid.Parse(clusterID)
	if err != nil {
		return err
	}
	certID, err := uuid.Parse(certificateID)
	if err != nil {
		return err
	}

	certOp := apprundedicated.NewCertificateOp(s.client, v1.ClusterID(cID))
	return certOp.Delete(ctx, v1.CertificateID(certID))
}
