package apprunshared

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/sacloud/sacloud-sdk-go/api/apprun"
	v1 "github.com/sacloud/sacloud-sdk-go/api/apprun/apis/v1"
	"github.com/sacloud/sacloud-sdk-go/common/saclient"
)

// profileConfig usacloud プロファイルの設定
type profileConfig struct {
	AccessToken       string `json:"AccessToken"`
	AccessTokenSecret string `json:"AccessTokenSecret"`
}

// Service AppRun共用型 API サービス
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
	fmt.Printf("[AppRunShared] NewService: profile=%s, token_prefix=%s...\n", profileName, tokenPrefix)

	var sc saclient.Client
	env := append(os.Environ(),
		"SAKURA_ACCESS_TOKEN="+cfg.AccessToken,
		"SAKURA_ACCESS_TOKEN_SECRET="+cfg.AccessTokenSecret,
	)
	if err := sc.SetEnviron(env); err != nil {
		return nil, fmt.Errorf("failed to configure apprun-shared client: %w", err)
	}

	client, err := apprun.NewClient(&sc)
	if err != nil {
		return nil, fmt.Errorf("failed to create apprun-shared client: %w", err)
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

// AppInfo アプリケーション情報
type AppInfo struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Status    string `json:"status"`
	PublicURL string `json:"publicUrl"`
	CreatedAt string `json:"createdAt"`
}

// VersionInfo バージョン情報
type VersionInfo struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Status    string `json:"status"`
	CreatedAt string `json:"createdAt"`
}

// ComponentInfo コンポーネント情報
type ComponentInfo struct {
	Name      string `json:"name"`
	Image     string `json:"image"`
	MaxCPU    string `json:"maxCpu"`
	MaxMemory string `json:"maxMemory"`
}

// AppDetailInfo アプリケーション詳細情報
type AppDetailInfo struct {
	ID             string          `json:"id"`
	Name           string          `json:"name"`
	Status         string          `json:"status"`
	PublicURL      string          `json:"publicUrl"`
	Port           int             `json:"port"`
	MinScale       int             `json:"minScale"`
	MaxScale       int             `json:"maxScale"`
	TimeoutSeconds int             `json:"timeoutSeconds"`
	CreatedAt      string          `json:"createdAt"`
	Components     []ComponentInfo `json:"components"`
}

// TrafficInfo トラフィック情報
type TrafficInfo struct {
	VersionName     string `json:"versionName"`
	IsLatestVersion bool   `json:"isLatestVersion"`
	Percent         int    `json:"percent"`
}

// ListApplications アプリケーション一覧を取得
func (s *Service) ListApplications(ctx context.Context) ([]AppInfo, error) {
	fmt.Printf("[AppRunShared] ListApplications: calling API...\n")
	applicationOp := apprun.NewApplicationOp(s.client)
	result, err := applicationOp.List(ctx, nil)
	if err != nil {
		fmt.Printf("[AppRunShared] ListApplications: error=%v\n", err)
		return nil, err
	}

	apps := make([]AppInfo, 0, len(result.Data))
	for _, a := range result.Data {
		apps = append(apps, AppInfo{
			ID:        a.ID,
			Name:      a.Name,
			Status:    string(a.Status),
			PublicURL: a.PublicURL,
			CreatedAt: a.CreatedAt.Format("2006-01-02 15:04:05"),
		})
	}

	fmt.Printf("[AppRunShared] ListApplications: got %d applications\n", len(apps))
	return apps, nil
}

// GetApplication アプリケーション詳細を取得
func (s *Service) GetApplication(ctx context.Context, appID string) (*AppDetailInfo, error) {
	fmt.Printf("[AppRunShared] GetApplication: id=%s\n", appID)
	applicationOp := apprun.NewApplicationOp(s.client)
	a, err := applicationOp.Read(ctx, appID)
	if err != nil {
		fmt.Printf("[AppRunShared] GetApplication: error=%v\n", err)
		return nil, err
	}

	components := make([]ComponentInfo, 0, len(a.Components))
	for _, c := range a.Components {
		image := ""
		if registry, ok := c.DeploySource.ContainerRegistry.Get(); ok {
			image = registry.Image
		}
		components = append(components, ComponentInfo{
			Name:      c.Name,
			Image:     image,
			MaxCPU:    c.MaxCPU,
			MaxMemory: c.MaxMemory,
		})
	}

	return &AppDetailInfo{
		ID:             a.ID,
		Name:           a.Name,
		Status:         string(a.Status),
		PublicURL:      a.PublicURL,
		Port:           a.Port,
		MinScale:       a.MinScale,
		MaxScale:       a.MaxScale,
		TimeoutSeconds: a.TimeoutSeconds,
		CreatedAt:      a.CreatedAt.Format("2006-01-02 15:04:05"),
		Components:     components,
	}, nil
}

// GetApplicationStatus アプリケーションのステータスを取得
func (s *Service) GetApplicationStatus(ctx context.Context, appID string) (string, error) {
	fmt.Printf("[AppRunShared] GetApplicationStatus: id=%s\n", appID)
	applicationOp := apprun.NewApplicationOp(s.client)
	status, err := applicationOp.ReadStatus(ctx, appID)
	if err != nil {
		fmt.Printf("[AppRunShared] GetApplicationStatus: error=%v\n", err)
		return "", err
	}

	return string(status.Status), nil
}

// ListVersions バージョン一覧を取得
func (s *Service) ListVersions(ctx context.Context, appID string) ([]VersionInfo, error) {
	fmt.Printf("[AppRunShared] ListVersions: appID=%s\n", appID)
	versionOp := apprun.NewVersionOp(s.client)
	result, err := versionOp.List(ctx, appID, nil)
	if err != nil {
		fmt.Printf("[AppRunShared] ListVersions: error=%v\n", err)
		return nil, err
	}

	versions := make([]VersionInfo, 0, len(result.Data))
	for _, v := range result.Data {
		versions = append(versions, VersionInfo{
			ID:        v.ID,
			Name:      v.Name,
			Status:    string(v.Status),
			CreatedAt: v.CreatedAt.Format("2006-01-02 15:04:05"),
		})
	}

	fmt.Printf("[AppRunShared] ListVersions: got %d versions\n", len(versions))
	return versions, nil
}

// ListTraffics トラフィック分散情報を取得
func (s *Service) ListTraffics(ctx context.Context, appID string) ([]TrafficInfo, error) {
	fmt.Printf("[AppRunShared] ListTraffics: appID=%s\n", appID)
	trafficOp := apprun.NewTrafficOp(s.client)
	result, err := trafficOp.List(ctx, appID)
	if err != nil {
		fmt.Printf("[AppRunShared] ListTraffics: error=%v\n", err)
		return nil, err
	}

	traffics := make([]TrafficInfo, 0, len(result.Data))
	for _, t := range result.Data {
		traffics = append(traffics, TrafficInfo{
			VersionName:     t.VersionName,
			IsLatestVersion: t.IsLatestVersion,
			Percent:         t.Percent,
		})
	}

	fmt.Printf("[AppRunShared] ListTraffics: got %d traffic entries\n", len(traffics))
	return traffics, nil
}

// CreateEnvVarParams コンポーネントに渡す環境変数
type CreateEnvVarParams struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

// CreateApplicationParams アプリケーション作成パラメータ
type CreateApplicationParams struct {
	Name                   string               `json:"name"`
	Port                   int                  `json:"port"`
	MinScale               int                  `json:"minScale"`
	MaxScale               int                  `json:"maxScale"`
	TimeoutSeconds         int                  `json:"timeoutSeconds"`
	ScaleTargetConcurrency *int                 `json:"scaleTargetConcurrency,omitempty"`
	ComponentName          string               `json:"componentName"`
	Image                  string               `json:"image"`
	MaxCPU                 string               `json:"maxCpu"`
	MaxMemory              string               `json:"maxMemory"`
	RegistryServer         *string              `json:"registryServer,omitempty"`
	RegistryUsername       *string              `json:"registryUsername,omitempty"`
	RegistryPassword       *string              `json:"registryPassword,omitempty"`
	ProbePath              *string              `json:"probePath,omitempty"`
	ProbePort              *int                 `json:"probePort,omitempty"`
	EnvVars                []CreateEnvVarParams `json:"envVars,omitempty"`
}

// UpdateApplicationParams アプリケーション更新パラメータ（スケール・タイムアウト設定）
type UpdateApplicationParams struct {
	TimeoutSeconds         *int `json:"timeoutSeconds,omitempty"`
	Port                   *int `json:"port,omitempty"`
	MinScale               *int `json:"minScale,omitempty"`
	MaxScale               *int `json:"maxScale,omitempty"`
	ScaleTargetConcurrency *int `json:"scaleTargetConcurrency,omitempty"`
}

// CreateApplication アプリケーションを作成
func (s *Service) CreateApplication(ctx context.Context, params CreateApplicationParams) (*AppDetailInfo, error) {
	fmt.Printf("[AppRunShared] CreateApplication: name=%s\n", params.Name)
	applicationOp := apprun.NewApplicationOp(s.client)

	registry := v1.PostApplicationBodyComponentsItemDeploySourceContainerRegistry{
		Image: params.Image,
	}
	if params.RegistryServer != nil {
		registry.Server = v1.NewOptNilString(*params.RegistryServer)
	}
	if params.RegistryUsername != nil {
		registry.Username = v1.NewOptNilString(*params.RegistryUsername)
	}
	if params.RegistryPassword != nil {
		registry.Password = v1.NewOptNilString(*params.RegistryPassword)
	}

	component := v1.PostApplicationBodyComponentsItem{
		Name:      params.ComponentName,
		MaxCPU:    v1.PostApplicationBodyComponentsItemMaxCPU(params.MaxCPU),
		MaxMemory: v1.PostApplicationBodyComponentsItemMaxMemory(params.MaxMemory),
		DeploySource: v1.PostApplicationBodyComponentsItemDeploySource{
			ContainerRegistry: v1.NewOptPostApplicationBodyComponentsItemDeploySourceContainerRegistry(registry),
		},
	}

	if len(params.EnvVars) > 0 {
		envItems := make([]v1.PostApplicationBodyComponentsItemEnvItem, 0, len(params.EnvVars))
		for _, e := range params.EnvVars {
			envItems = append(envItems, v1.PostApplicationBodyComponentsItemEnvItem{
				Key:   v1.NewOptString(e.Key),
				Value: v1.NewOptString(e.Value),
			})
		}
		component.Env = v1.NewOptNilPostApplicationBodyComponentsItemEnvItemArray(envItems)
	}

	if params.ProbePath != nil {
		port := 80
		if params.ProbePort != nil {
			port = *params.ProbePort
		}
		component.Probe = v1.NewOptNilPostApplicationBodyComponentsItemProbe(v1.PostApplicationBodyComponentsItemProbe{
			HTTPGet: v1.NewOptNilPostApplicationBodyComponentsItemProbeHTTPGet(
				v1.PostApplicationBodyComponentsItemProbeHTTPGet{
					Path: *params.ProbePath,
					Port: port,
				},
			),
		})
	}

	body := &v1.PostApplicationBody{
		Name:           params.Name,
		TimeoutSeconds: params.TimeoutSeconds,
		Port:           params.Port,
		MinScale:       params.MinScale,
		MaxScale:       params.MaxScale,
		Components:     []v1.PostApplicationBodyComponentsItem{component},
	}
	if params.ScaleTargetConcurrency != nil {
		body.ScaleTargetConcurrency = v1.NewOptInt(*params.ScaleTargetConcurrency)
	}

	created, err := applicationOp.Create(ctx, body)
	if err != nil {
		fmt.Printf("[AppRunShared] CreateApplication: error=%v\n", err)
		return nil, err
	}

	return s.GetApplication(ctx, created.ID)
}

// UpdateApplication アプリケーションのスケール・タイムアウト設定を更新
func (s *Service) UpdateApplication(ctx context.Context, appID string, params UpdateApplicationParams) (*AppDetailInfo, error) {
	fmt.Printf("[AppRunShared] UpdateApplication: id=%s\n", appID)
	applicationOp := apprun.NewApplicationOp(s.client)

	body := &v1.PatchApplicationBody{}
	if params.TimeoutSeconds != nil {
		body.TimeoutSeconds = v1.NewOptInt(*params.TimeoutSeconds)
	}
	if params.Port != nil {
		body.Port = v1.NewOptInt(*params.Port)
	}
	if params.MinScale != nil {
		body.MinScale = v1.NewOptInt(*params.MinScale)
	}
	if params.MaxScale != nil {
		body.MaxScale = v1.NewOptInt(*params.MaxScale)
	}
	if params.ScaleTargetConcurrency != nil {
		body.ScaleTargetConcurrency = v1.NewOptInt(*params.ScaleTargetConcurrency)
	}

	if _, err := applicationOp.Update(ctx, appID, body); err != nil {
		fmt.Printf("[AppRunShared] UpdateApplication: error=%v\n", err)
		return nil, err
	}

	return s.GetApplication(ctx, appID)
}

// HasUser ユーザーが存在するか確認
func (s *Service) HasUser(ctx context.Context) (bool, error) {
	fmt.Printf("[AppRunShared] HasUser: checking...\n")
	userOp := apprun.NewUserOp(s.client)
	_, err := userOp.Read(ctx)
	if err != nil {
		if saclient.IsNotFoundError(err) {
			return false, nil
		}
		fmt.Printf("[AppRunShared] HasUser: error=%v\n", err)
		return false, err
	}

	return true, nil
}
