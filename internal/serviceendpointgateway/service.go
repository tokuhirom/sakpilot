package serviceendpointgateway

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"path"
	"path/filepath"

	seg "github.com/sacloud/sacloud-sdk-go/api/service-endpoint-gateway"
	v1 "github.com/sacloud/sacloud-sdk-go/api/service-endpoint-gateway/apis/v1"
	"github.com/sacloud/sacloud-sdk-go/common/saclient"
)

// serviceKey/defaultZoneRootURL は sacloud-sdk-go/api/service-endpoint-gateway の client.go を踏襲した値。
// 同SDKのNewClient()はZoneが設定されているとSAKURA_ENDPOINTS_SERVICE_ENDPOINT_GATEWAYによる
// エンドポイント上書きを無視してしまう(Zoneが常に優先される)ため、ここでは優先順位を
// 「明示的なエンドポイント上書き→Zoneベースの既定URL」の順に直して自前で組み立てる
// (docs/upstream-issues.md参照)。
const (
	segServiceKey      = "service_endpoint_gateway"
	segDefaultZoneRoot = "https://secure.sakura.ad.jp/cloud/zone/"
)

func buildEndpoint(sc *saclient.Client, zone string) (string, error) {
	cfg, err := sc.EndpointConfig()
	if err != nil {
		return "", fmt.Errorf("failed to load endpoint configuration: %w", err)
	}
	if ep, ok := cfg.Endpoints[segServiceKey]; ok && ep != "" {
		return ep, nil
	}

	u, err := url.Parse(segDefaultZoneRoot)
	if err != nil {
		return "", err
	}
	u.Path = path.Join(u.Path, zone, "api", "cloud", "1.1")
	return u.String() + "/", nil
}

// ApplianceInfo はサービスエンドポイントゲートウェイの情報。
type ApplianceInfo struct {
	ID              string               `json:"id"`
	Availability    string               `json:"availability"`
	PowerStatus     string               `json:"powerStatus"`
	Generation      int                  `json:"generation"`
	SwitchID        string               `json:"switchId"`
	SwitchName      string               `json:"switchName"`
	Interfaces      []InterfaceInfo      `json:"interfaces"`
	EnabledServices []EnabledServiceInfo `json:"enabledServices"`
	MonitoringSuite bool                 `json:"monitoringSuite"`
	DNSForwarding   DNSForwardingInfo    `json:"dnsForwarding"`
	SettingsHash    string               `json:"settingsHash"`
	CreatedAt       string               `json:"createdAt"`
}

// InterfaceInfo はサービスエンドポイントゲートウェイのNIC情報。
type InterfaceInfo struct {
	IPAddress     string `json:"ipAddress"`
	UserIPAddress string `json:"userIpAddress"`
}

// EnabledServiceInfo は接続先マネージドサービスの設定。
type EnabledServiceInfo struct {
	Type      string   `json:"type"`
	Endpoints []string `json:"endpoints"`
	Mode      string   `json:"mode"`
}

// DNSForwardingInfo はDNSプライベートホストゾーン連携の設定。
type DNSForwardingInfo struct {
	Enabled           bool   `json:"enabled"`
	PrivateHostedZone string `json:"privateHostedZone"`
	UpstreamDNS1      string `json:"upstreamDNS1"`
	UpstreamDNS2      string `json:"upstreamDNS2"`
}

// CreateParams はサービスエンドポイントゲートウェイの作成パラメータ。
// ServerIPAddresses/NetworkMaskLenは作成時にしか指定できず、API応答から取得することはできない(書き込み専用)。
type CreateParams struct {
	SwitchID          string
	NetworkMaskLen    int
	ServerIPAddresses []string
}

// UpdateParams はサービスエンドポイントゲートウェイの設定更新パラメータ。
// 更新後は別途Applyを呼び出さないと反映されない。
type UpdateParams struct {
	EnabledServices []EnabledServiceInfo `json:"enabledServices"`
	MonitoringSuite bool                 `json:"monitoringSuite"`
	DNSForwarding   DNSForwardingInfo    `json:"dnsForwarding"`
}

// Service サービスエンドポイントゲートウェイAPIサービス。
type Service struct {
	segOp seg.ServiceEndpointGatewayAPI
}

type profileConfig struct {
	AccessToken       string `json:"AccessToken"`
	AccessTokenSecret string `json:"AccessTokenSecret"`
}

// NewService プロファイル名・ゾーン名からServiceを作成する。
// サービスエンドポイントゲートウェイはゾーン依存リソースのため、他のグローバルリソース系サービスと異なりゾーンを受け取る。
func NewService(profileName, zone string) (*Service, error) {
	cfg, err := loadProfileConfig(profileName)
	if err != nil {
		return nil, fmt.Errorf("failed to load profile %s: %w", profileName, err)
	}

	var sc saclient.Client
	env := append(os.Environ(),
		"SAKURA_ACCESS_TOKEN="+cfg.AccessToken,
		"SAKURA_ACCESS_TOKEN_SECRET="+cfg.AccessTokenSecret,
	)
	if err := sc.SetEnviron(env); err != nil {
		return nil, fmt.Errorf("failed to configure service-endpoint-gateway client: %w", err)
	}

	endpoint, err := buildEndpoint(&sc, zone)
	if err != nil {
		return nil, err
	}

	v1Client, err := seg.NewClientWithAPIRootURL(&sc, endpoint)
	if err != nil {
		return nil, fmt.Errorf("failed to create service-endpoint-gateway client: %w", err)
	}

	return &Service{
		segOp: seg.NewServiceEndpointGatewayOp(v1Client),
	}, nil
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

// List サービスエンドポイントゲートウェイ一覧を取得する。
func (s *Service) List(ctx context.Context) ([]ApplianceInfo, error) {
	res, err := s.segOp.List(ctx)
	if err != nil {
		return nil, err
	}
	result := make([]ApplianceInfo, 0, len(res.Appliances))
	for _, a := range res.Appliances {
		result = append(result, *toApplianceInfo(&a))
	}
	return result, nil
}

// Get サービスエンドポイントゲートウェイの詳細を取得する。
func (s *Service) Get(ctx context.Context, id string) (*ApplianceInfo, error) {
	res, err := s.segOp.Read(ctx, id)
	if err != nil {
		return nil, err
	}
	return toApplianceInfo(&res.Appliance), nil
}

// Create サービスエンドポイントゲートウェイを作成する。
func (s *Service) Create(ctx context.Context, params CreateParams) (*ApplianceInfo, error) {
	servers := make([]v1.ModelsRemarkServerRemark, 0, len(params.ServerIPAddresses))
	for _, ip := range params.ServerIPAddresses {
		servers = append(servers, v1.ModelsRemarkServerRemark{IPAddress: ip})
	}

	res, err := s.segOp.Create(ctx, v1.ModelsApplianceApplianceCreateRequest{
		Appliance: v1.ModelsApplianceApplianceCreateBody{
			Remark: v1.ModelsRemarkApplianceCreateRemark{
				Switch:  v1.ModelsRemarkSwitchRemark{ID: params.SwitchID},
				Network: v1.ModelsRemarkNetworkRemark{NetworkMaskLen: int32(params.NetworkMaskLen)},
				Servers: servers,
			},
		},
	})
	if err != nil {
		return nil, err
	}
	return toApplianceInfo(&res.Appliance), nil
}

// Update サービスエンドポイントゲートウェイの設定を更新する。反映にはApplyの呼び出しが別途必要。
func (s *Service) Update(ctx context.Context, id string, params UpdateParams) (*ApplianceInfo, error) {
	enabledServices := make([]v1.ModelsSettingsEnabledService, 0, len(params.EnabledServices))
	for _, es := range params.EnabledServices {
		config := v1.ModelsSettingsServiceConfig{Endpoints: es.Endpoints}
		if es.Mode != "" {
			config.Mode = v1.NewOptModelsSettingsServiceConfigMode(v1.ModelsSettingsServiceConfigMode(es.Mode))
		}
		enabledServices = append(enabledServices, v1.ModelsSettingsEnabledService{
			Type:   v1.ModelsSettingsEnabledServiceType(es.Type),
			Config: config,
		})
	}

	monitoringSuiteEnabled := v1.ModelsSettingsMonitoringSuiteSettingsEnabledFalse
	if params.MonitoringSuite {
		monitoringSuiteEnabled = v1.ModelsSettingsMonitoringSuiteSettingsEnabledTrue
	}

	dnsForwardingEnabled := v1.ModelsSettingsDNSForwardingSettingsEnabledFalse
	if params.DNSForwarding.Enabled {
		dnsForwardingEnabled = v1.ModelsSettingsDNSForwardingSettingsEnabledTrue
	}

	res, err := s.segOp.Update(ctx, id, v1.ModelsApplianceApplianceUpdateRequest{
		Appliance: v1.ModelsApplianceApplianceUpdateBody{
			Settings: v1.ModelsSettingsApplianceSettings{
				ServiceEndpointGateway: v1.ModelsSettingsServiceEndpointGatewaySettings{
					EnabledServices: enabledServices,
					MonitoringSuite: v1.NewOptModelsSettingsMonitoringSuiteSettings(v1.ModelsSettingsMonitoringSuiteSettings{
						Enabled: monitoringSuiteEnabled,
					}),
					DNSForwarding: v1.NewOptModelsSettingsDNSForwardingSettings(v1.ModelsSettingsDNSForwardingSettings{
						Enabled:           dnsForwardingEnabled,
						PrivateHostedZone: optString(params.DNSForwarding.PrivateHostedZone),
						UpstreamDNS1:      optString(params.DNSForwarding.UpstreamDNS1),
						UpstreamDNS2:      optString(params.DNSForwarding.UpstreamDNS2),
					}),
				},
			},
		},
	})
	if err != nil {
		return nil, err
	}
	return toApplianceInfo(&res.Appliance), nil
}

// Apply 保留中の設定変更をサービスエンドポイントゲートウェイに反映する。
func (s *Service) Apply(ctx context.Context, id string) error {
	return s.segOp.Apply(ctx, id)
}

// Delete サービスエンドポイントゲートウェイを削除する。
func (s *Service) Delete(ctx context.Context, id string) error {
	return s.segOp.Delete(ctx, id)
}

// ReadInterface サービスエンドポイントゲートウェイのインターフェース情報を取得する。
func (s *Service) ReadInterface(ctx context.Context, applianceID, interfaceID string) (*InterfaceInfo, error) {
	res, err := s.segOp.ReadInterface(ctx, applianceID, interfaceID)
	if err != nil {
		return nil, err
	}
	return toInterfaceInfo(&res.Interface), nil
}

// ReadPowerStatus サービスエンドポイントゲートウェイの起動状態を取得する。
func (s *Service) ReadPowerStatus(ctx context.Context, id string) (string, error) {
	res, err := s.segOp.ReadPowerStatus(ctx, id)
	if err != nil {
		return "", err
	}
	return string(res.Instance.Status), nil
}

// PowerOn サービスエンドポイントゲートウェイを起動する。
func (s *Service) PowerOn(ctx context.Context, id string) error {
	_, err := s.segOp.PowerOn(ctx, id)
	return err
}

// Shutdown サービスエンドポイントゲートウェイを停止する。
func (s *Service) Shutdown(ctx context.Context, id string) error {
	return s.segOp.Shutdown(ctx, id)
}

// Reset サービスエンドポイントゲートウェイを再起動する。
func (s *Service) Reset(ctx context.Context, id string) error {
	return s.segOp.Reset(ctx, id)
}

func optString(v string) v1.OptString {
	if v == "" {
		return v1.OptString{}
	}
	return v1.NewOptString(v)
}

func toApplianceInfo(a *v1.ModelsApplianceAppliance) *ApplianceInfo {
	info := &ApplianceInfo{
		ID:           a.ID,
		Availability: string(a.Availability),
		Generation:   int(a.Generation),
		SwitchID:     a.Switch.ID,
		SwitchName:   a.Switch.Name,
		SettingsHash: a.SettingsHash.Or(""),
		CreatedAt:    a.CreatedAt,
	}

	if status, ok := a.Instance.Status.Get(); ok {
		info.PowerStatus = string(status)
	}

	info.Interfaces = make([]InterfaceInfo, 0, len(a.Interfaces))
	for _, iface := range a.Interfaces {
		info.Interfaces = append(info.Interfaces, InterfaceInfo{
			IPAddress:     iface.IPAddress.Or(""),
			UserIPAddress: iface.UserIPAddress.Or(""),
		})
	}

	if settings, ok := a.Settings.Get(); ok {
		segSettings := settings.ServiceEndpointGateway
		info.EnabledServices = make([]EnabledServiceInfo, 0, len(segSettings.EnabledServices))
		for _, es := range segSettings.EnabledServices {
			mode := ""
			if m, ok := es.Config.Mode.Get(); ok {
				mode = string(m)
			}
			info.EnabledServices = append(info.EnabledServices, EnabledServiceInfo{
				Type:      string(es.Type),
				Endpoints: es.Config.Endpoints,
				Mode:      mode,
			})
		}

		if ms, ok := segSettings.MonitoringSuite.Get(); ok {
			info.MonitoringSuite = ms.Enabled == v1.ModelsSettingsMonitoringSuiteSettingsEnabledTrue
		}

		if dns, ok := segSettings.DNSForwarding.Get(); ok {
			info.DNSForwarding = DNSForwardingInfo{
				Enabled:           dns.Enabled == v1.ModelsSettingsDNSForwardingSettingsEnabledTrue,
				PrivateHostedZone: dns.PrivateHostedZone.Value,
				UpstreamDNS1:      dns.UpstreamDNS1.Value,
				UpstreamDNS2:      dns.UpstreamDNS2.Value,
			}
		}
	}

	return info
}

func toInterfaceInfo(iface *v1.ModelsNetworkSimpleInterface) *InterfaceInfo {
	return &InterfaceInfo{
		IPAddress:     iface.IPAddress.Or(""),
		UserIPAddress: iface.UserIPAddress.Or(""),
	}
}
