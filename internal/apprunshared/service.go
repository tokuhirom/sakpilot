package apprunshared

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"

	v1 "github.com/sacloud/apprun-api-go/apis/v1"
)

const apiURL = "https://secure.sakura.ad.jp/cloud/api/apprun/1.0/apprun/api"

// profileConfig usacloud プロファイルの設定
type profileConfig struct {
	AccessToken       string `json:"AccessToken"`
	AccessTokenSecret string `json:"AccessTokenSecret"`
}

// Service AppRun共用型 API サービス
type Service struct {
	client *v1.ClientWithResponses
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

	client, err := v1.NewClientWithResponses(
		apiURL,
		v1.WithHTTPClient(http.DefaultClient),
		v1.WithRequestEditorFn(v1.AppRunAuthInterceptor(cfg.AccessToken, cfg.AccessTokenSecret)),
	)
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
	resp, err := s.client.ListApplicationsWithResponse(ctx, nil)
	if err != nil {
		fmt.Printf("[AppRunShared] ListApplications: error=%v\n", err)
		return nil, err
	}

	if resp.StatusCode() != http.StatusOK {
		fmt.Printf("[AppRunShared] ListApplications: status=%d\n", resp.StatusCode())
		return nil, fmt.Errorf("failed to list applications: status=%d", resp.StatusCode())
	}

	if resp.JSON200 == nil {
		return []AppInfo{}, nil
	}

	data := resp.JSON200.Data
	apps := make([]AppInfo, 0, len(data))
	for _, a := range data {
		apps = append(apps, AppInfo{
			ID:        a.Id,
			Name:      a.Name,
			Status:    string(a.Status),
			PublicURL: a.PublicUrl,
			CreatedAt: a.CreatedAt.Format("2006-01-02 15:04:05"),
		})
	}

	fmt.Printf("[AppRunShared] ListApplications: got %d applications\n", len(apps))
	return apps, nil
}

// GetApplication アプリケーション詳細を取得
func (s *Service) GetApplication(ctx context.Context, appID string) (*AppDetailInfo, error) {
	fmt.Printf("[AppRunShared] GetApplication: id=%s\n", appID)
	resp, err := s.client.GetApplicationWithResponse(ctx, appID)
	if err != nil {
		fmt.Printf("[AppRunShared] GetApplication: error=%v\n", err)
		return nil, err
	}

	if resp.StatusCode() != http.StatusOK {
		fmt.Printf("[AppRunShared] GetApplication: status=%d\n", resp.StatusCode())
		return nil, fmt.Errorf("failed to get application: status=%d", resp.StatusCode())
	}

	if resp.JSON200 == nil {
		return nil, fmt.Errorf("application not found")
	}

	a := resp.JSON200

	components := make([]ComponentInfo, 0, len(a.Components))
	for _, c := range a.Components {
		image := ""
		if c.DeploySource.ContainerRegistry != nil {
			image = c.DeploySource.ContainerRegistry.Image
		}
		components = append(components, ComponentInfo{
			Name:      c.Name,
			Image:     image,
			MaxCPU:    c.MaxCpu,
			MaxMemory: c.MaxMemory,
		})
	}

	return &AppDetailInfo{
		ID:             a.Id,
		Name:           a.Name,
		Status:         string(a.Status),
		PublicURL:      a.PublicUrl,
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
	resp, err := s.client.GetApplicationStatusWithResponse(ctx, appID)
	if err != nil {
		fmt.Printf("[AppRunShared] GetApplicationStatus: error=%v\n", err)
		return "", err
	}

	if resp.StatusCode() != http.StatusOK {
		fmt.Printf("[AppRunShared] GetApplicationStatus: status=%d\n", resp.StatusCode())
		return "", fmt.Errorf("failed to get application status: status=%d", resp.StatusCode())
	}

	if resp.JSON200 == nil {
		return "", nil
	}

	return string(resp.JSON200.Status), nil
}

// ListVersions バージョン一覧を取得
func (s *Service) ListVersions(ctx context.Context, appID string) ([]VersionInfo, error) {
	fmt.Printf("[AppRunShared] ListVersions: appID=%s\n", appID)
	resp, err := s.client.ListApplicationVersionsWithResponse(ctx, appID, nil)
	if err != nil {
		fmt.Printf("[AppRunShared] ListVersions: error=%v\n", err)
		return nil, err
	}

	if resp.StatusCode() != http.StatusOK {
		fmt.Printf("[AppRunShared] ListVersions: status=%d\n", resp.StatusCode())
		return nil, fmt.Errorf("failed to list versions: status=%d", resp.StatusCode())
	}

	if resp.JSON200 == nil {
		return []VersionInfo{}, nil
	}

	data := resp.JSON200.Data
	versions := make([]VersionInfo, 0, len(data))
	for _, v := range data {
		versions = append(versions, VersionInfo{
			ID:        v.Id,
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
	resp, err := s.client.ListApplicationTrafficsWithResponse(ctx, appID)
	if err != nil {
		fmt.Printf("[AppRunShared] ListTraffics: error=%v\n", err)
		return nil, err
	}

	if resp.StatusCode() != http.StatusOK {
		fmt.Printf("[AppRunShared] ListTraffics: status=%d\n", resp.StatusCode())
		return nil, fmt.Errorf("failed to list traffics: status=%d", resp.StatusCode())
	}

	if resp.JSON200 == nil {
		return []TrafficInfo{}, nil
	}

	data := resp.JSON200.Data
	traffics := make([]TrafficInfo, 0, len(data))
	for _, t := range data {
		info := TrafficInfo{}

		// Try to get as TrafficWithVersionName first
		if vn, err := t.AsTrafficWithVersionName(); err == nil {
			info.VersionName = vn.VersionName
			info.Percent = vn.Percent
		} else if lv, err := t.AsTrafficWithLatestVersion(); err == nil {
			info.IsLatestVersion = lv.IsLatestVersion
			info.Percent = lv.Percent
		}

		traffics = append(traffics, info)
	}

	fmt.Printf("[AppRunShared] ListTraffics: got %d traffic entries\n", len(traffics))
	return traffics, nil
}

// HasUser ユーザーが存在するか確認
func (s *Service) HasUser(ctx context.Context) (bool, error) {
	fmt.Printf("[AppRunShared] HasUser: checking...\n")
	resp, err := s.client.GetUserWithResponse(ctx)
	if err != nil {
		fmt.Printf("[AppRunShared] HasUser: error=%v\n", err)
		return false, err
	}

	if resp.StatusCode() == http.StatusOK {
		return true, nil
	}
	if resp.StatusCode() == http.StatusNotFound {
		return false, nil
	}

	return false, fmt.Errorf("failed to check user: status=%d", resp.StatusCode())
}
