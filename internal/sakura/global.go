package sakura

import (
	"context"

	"github.com/sacloud/sacloud-sdk-go/api/iaas"
	"github.com/sacloud/sacloud-sdk-go/api/iaas/types"
)

type DNSRecord struct {
	Name  string `json:"name"`
	Type  string `json:"type"`
	RData string `json:"rdata"`
	TTL   int    `json:"ttl"`
}

type DNSInfo struct {
	ID          string      `json:"id"`
	Name        string      `json:"name"`
	Description string      `json:"description"`
	Zone        string      `json:"zone"`
	Records     []DNSRecord `json:"records"`
}

type CertificateInfo struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	CommonName  string `json:"commonName"`
}

type SimpleMonitorInfo struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Target      string `json:"target"`
	Enabled     bool   `json:"enabled"`
}

type SimpleMonitorHealthCheckInfo struct {
	Protocol       string `json:"protocol"`
	Port           string `json:"port"`
	Path           string `json:"path"`
	Status         string `json:"status"`
	Host           string `json:"host"`
	ContainsString string `json:"containsString"`
}

type SimpleMonitorDetailInfo struct {
	ID                 string                        `json:"id"`
	Name               string                        `json:"name"`
	Description        string                        `json:"description"`
	Target             string                        `json:"target"`
	Enabled            bool                          `json:"enabled"`
	Availability       string                        `json:"availability"`
	DelayLoop          int                           `json:"delayLoop"`
	MaxCheckAttempts   int                           `json:"maxCheckAttempts"`
	RetryInterval      int                           `json:"retryInterval"`
	Timeout            int                           `json:"timeout"`
	NotifyEmailEnabled bool                          `json:"notifyEmailEnabled"`
	NotifySlackEnabled bool                          `json:"notifySlackEnabled"`
	HealthCheck        *SimpleMonitorHealthCheckInfo `json:"healthCheck,omitempty"`
}

type GSLBServerInfo struct {
	IPAddress string `json:"ipAddress"`
	Enabled   bool   `json:"enabled"`
	Weight    int    `json:"weight"`
}

type GSLBHealthCheckInfo struct {
	Protocol     string `json:"protocol"`
	HostHeader   string `json:"hostHeader"`
	Path         string `json:"path"`
	ResponseCode int    `json:"responseCode"`
	Port         int    `json:"port"`
}

type GSLBInfo struct {
	ID          string               `json:"id"`
	Name        string               `json:"name"`
	Description string               `json:"description"`
	FQDN        string               `json:"fqdn"`
	SorryServer string               `json:"sorryServer"`
	Servers     []GSLBServerInfo     `json:"servers"`
	HealthCheck *GSLBHealthCheckInfo `json:"healthCheck,omitempty"`
	DelayLoop   int                  `json:"delayLoop"`
	Weighted    bool                 `json:"weighted"`
}

type ContainerRegistryInfo struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	Description   string `json:"description"`
	FQDN          string `json:"fqdn"`
	AccessLevel   string `json:"accessLevel"`
	VirtualDomain string `json:"virtualDomain"`
}

type ContainerRegistryUserInfo struct {
	UserName   string `json:"userName"`
	Permission string `json:"permission"`
}

type GlobalService struct {
	client *Client
}

func NewGlobalService(client *Client) *GlobalService {
	return &GlobalService{client: client}
}

func toDNSInfo(d *iaas.DNS) *DNSInfo {
	records := make([]DNSRecord, 0, len(d.Records))
	for _, r := range d.Records {
		records = append(records, DNSRecord{
			Name:  r.Name,
			Type:  string(r.Type),
			RData: r.RData,
			TTL:   r.TTL,
		})
	}
	return &DNSInfo{
		ID:          d.ID.String(),
		Name:        d.Name,
		Description: d.Description,
		Zone:        d.DNSZone,
		Records:     records,
	}
}

func (s *GlobalService) ListDNS(ctx context.Context) ([]DNSInfo, error) {
	dnsOp := iaas.NewDNSOp(s.client.Caller())
	result, err := dnsOp.Find(ctx, &iaas.FindCondition{})
	if err != nil {
		return nil, err
	}

	list := make([]DNSInfo, 0, len(result.DNS))
	for _, d := range result.DNS {
		list = append(list, *toDNSInfo(d))
	}
	return list, nil
}

func (s *GlobalService) GetDNS(ctx context.Context, id string) (*DNSInfo, error) {
	dnsOp := iaas.NewDNSOp(s.client.Caller())
	d, err := dnsOp.Read(ctx, types.StringID(id))
	if err != nil {
		return nil, err
	}
	return toDNSInfo(d), nil
}

// CreateDNS はDNSゾーンを新規作成する。ゾーン名(name)はNSレコードが割り当てられる
// ドメイン名そのもの(例: example.com)を指定する。
func (s *GlobalService) CreateDNS(ctx context.Context, name, description string) (*DNSInfo, error) {
	dnsOp := iaas.NewDNSOp(s.client.Caller())
	d, err := dnsOp.Create(ctx, &iaas.DNSCreateRequest{
		Name:        name,
		Description: description,
	})
	if err != nil {
		return nil, err
	}
	return toDNSInfo(d), nil
}

// UpdateDNS はDNSゾーンの説明を更新する。Recordsは既存のものを維持したまま送信する
// (Update APIはSettingsも含むリクエスト構造のため、空で送るとレコードが失われる)。
func (s *GlobalService) UpdateDNS(ctx context.Context, id, description string) (*DNSInfo, error) {
	dnsOp := iaas.NewDNSOp(s.client.Caller())
	current, err := dnsOp.Read(ctx, types.StringID(id))
	if err != nil {
		return nil, err
	}
	d, err := dnsOp.Update(ctx, types.StringID(id), &iaas.DNSUpdateRequest{
		Description: description,
		Records:     current.Records,
	})
	if err != nil {
		return nil, err
	}
	return toDNSInfo(d), nil
}

// UpdateDNSRecords はDNSゾーンのリソースレコードを一括更新する(全置き換え)。
func (s *GlobalService) UpdateDNSRecords(ctx context.Context, id string, records []DNSRecord) (*DNSInfo, error) {
	dnsOp := iaas.NewDNSOp(s.client.Caller())
	current, err := dnsOp.Read(ctx, types.StringID(id))
	if err != nil {
		return nil, err
	}

	sdkRecords := make(iaas.DNSRecords, 0, len(records))
	for _, r := range records {
		sdkRecords = append(sdkRecords, &iaas.DNSRecord{
			Name:  r.Name,
			Type:  types.EDNSRecordType(r.Type),
			RData: r.RData,
			TTL:   r.TTL,
		})
	}

	d, err := dnsOp.UpdateSettings(ctx, types.StringID(id), &iaas.DNSUpdateSettingsRequest{
		Records:      sdkRecords,
		SettingsHash: current.SettingsHash,
	})
	if err != nil {
		return nil, err
	}
	return toDNSInfo(d), nil
}

func (s *GlobalService) DeleteDNS(ctx context.Context, id string) error {
	dnsOp := iaas.NewDNSOp(s.client.Caller())
	return dnsOp.Delete(ctx, types.StringID(id))
}

func (s *GlobalService) ListCertificates(ctx context.Context) ([]CertificateInfo, error) {
	certOp := iaas.NewCertificateAuthorityOp(s.client.Caller())
	result, err := certOp.Find(ctx, &iaas.FindCondition{})
	if err != nil {
		return nil, err
	}

	list := make([]CertificateInfo, 0, len(result.CertificateAuthorities))
	for _, c := range result.CertificateAuthorities {
		list = append(list, CertificateInfo{
			ID:          c.ID.String(),
			Name:        c.Name,
			Description: c.Description,
			CommonName:  c.CommonName,
		})
	}
	return list, nil
}

func (s *GlobalService) ListSimpleMonitors(ctx context.Context) ([]SimpleMonitorInfo, error) {
	smOp := iaas.NewSimpleMonitorOp(s.client.Caller())
	result, err := smOp.Find(ctx, &iaas.FindCondition{})
	if err != nil {
		return nil, err
	}

	list := make([]SimpleMonitorInfo, 0, len(result.SimpleMonitors))
	for _, m := range result.SimpleMonitors {
		list = append(list, SimpleMonitorInfo{
			ID:          m.ID.String(),
			Name:        m.Name,
			Description: m.Description,
			Target:      m.Target,
			Enabled:     m.Enabled.Bool(),
		})
	}
	return list, nil
}

func (s *GlobalService) GetSimpleMonitor(ctx context.Context, id string) (*SimpleMonitorDetailInfo, error) {
	smOp := iaas.NewSimpleMonitorOp(s.client.Caller())
	m, err := smOp.Read(ctx, types.StringID(id))
	if err != nil {
		return nil, err
	}

	detail := &SimpleMonitorDetailInfo{
		ID:                 m.ID.String(),
		Name:               m.Name,
		Description:        m.Description,
		Target:             m.Target,
		Enabled:            m.Enabled.Bool(),
		Availability:       string(m.Availability),
		DelayLoop:          m.DelayLoop,
		MaxCheckAttempts:   m.MaxCheckAttempts,
		RetryInterval:      m.RetryInterval,
		Timeout:            m.Timeout,
		NotifyEmailEnabled: m.NotifyEmailEnabled.Bool(),
		NotifySlackEnabled: m.NotifySlackEnabled.Bool(),
	}

	if m.HealthCheck != nil {
		detail.HealthCheck = &SimpleMonitorHealthCheckInfo{
			Protocol:       string(m.HealthCheck.Protocol),
			Port:           m.HealthCheck.Port.String(),
			Path:           m.HealthCheck.Path,
			Status:         m.HealthCheck.Status.String(),
			Host:           m.HealthCheck.Host,
			ContainsString: m.HealthCheck.ContainsString,
		}
	}

	return detail, nil
}

func (s *GlobalService) DeleteSimpleMonitor(ctx context.Context, id string) error {
	smOp := iaas.NewSimpleMonitorOp(s.client.Caller())
	return smOp.Delete(ctx, types.StringID(id))
}

func (s *GlobalService) ListGSLB(ctx context.Context) ([]GSLBInfo, error) {
	gslbOp := iaas.NewGSLBOp(s.client.Caller())
	result, err := gslbOp.Find(ctx, &iaas.FindCondition{})
	if err != nil {
		return nil, err
	}

	list := make([]GSLBInfo, 0, len(result.GSLBs))
	for _, g := range result.GSLBs {
		servers := make([]GSLBServerInfo, 0, len(g.DestinationServers))
		for _, srv := range g.DestinationServers {
			servers = append(servers, GSLBServerInfo{
				IPAddress: srv.IPAddress,
				Enabled:   srv.Enabled.Bool(),
				Weight:    int(srv.Weight),
			})
		}

		var healthCheck *GSLBHealthCheckInfo
		if g.HealthCheck != nil {
			healthCheck = &GSLBHealthCheckInfo{
				Protocol:     string(g.HealthCheck.Protocol),
				HostHeader:   g.HealthCheck.HostHeader,
				Path:         g.HealthCheck.Path,
				ResponseCode: int(g.HealthCheck.ResponseCode),
				Port:         int(g.HealthCheck.Port),
			}
		}

		list = append(list, GSLBInfo{
			ID:          g.ID.String(),
			Name:        g.Name,
			Description: g.Description,
			FQDN:        g.FQDN,
			SorryServer: g.SorryServer,
			Servers:     servers,
			HealthCheck: healthCheck,
			DelayLoop:   g.DelayLoop,
			Weighted:    g.Weighted.Bool(),
		})
	}
	return list, nil
}

func (s *GlobalService) GetGSLB(ctx context.Context, id string) (*GSLBInfo, error) {
	gslbOp := iaas.NewGSLBOp(s.client.Caller())
	g, err := gslbOp.Read(ctx, types.StringID(id))
	if err != nil {
		return nil, err
	}

	servers := make([]GSLBServerInfo, 0, len(g.DestinationServers))
	for _, srv := range g.DestinationServers {
		servers = append(servers, GSLBServerInfo{
			IPAddress: srv.IPAddress,
			Enabled:   srv.Enabled.Bool(),
			Weight:    int(srv.Weight),
		})
	}

	var healthCheck *GSLBHealthCheckInfo
	if g.HealthCheck != nil {
		healthCheck = &GSLBHealthCheckInfo{
			Protocol:     string(g.HealthCheck.Protocol),
			HostHeader:   g.HealthCheck.HostHeader,
			Path:         g.HealthCheck.Path,
			ResponseCode: int(g.HealthCheck.ResponseCode),
			Port:         int(g.HealthCheck.Port),
		}
	}

	return &GSLBInfo{
		ID:          g.ID.String(),
		Name:        g.Name,
		Description: g.Description,
		FQDN:        g.FQDN,
		SorryServer: g.SorryServer,
		Servers:     servers,
		HealthCheck: healthCheck,
		DelayLoop:   g.DelayLoop,
		Weighted:    g.Weighted.Bool(),
	}, nil
}

func (s *GlobalService) DeleteGSLB(ctx context.Context, id string) error {
	gslbOp := iaas.NewGSLBOp(s.client.Caller())
	return gslbOp.Delete(ctx, types.StringID(id))
}

func (s *GlobalService) ListContainerRegistries(ctx context.Context) ([]ContainerRegistryInfo, error) {
	crOp := iaas.NewContainerRegistryOp(s.client.Caller())
	result, err := crOp.Find(ctx, &iaas.FindCondition{})
	if err != nil {
		return nil, err
	}

	list := make([]ContainerRegistryInfo, 0, len(result.ContainerRegistries))
	for _, cr := range result.ContainerRegistries {
		list = append(list, ContainerRegistryInfo{
			ID:            cr.ID.String(),
			Name:          cr.Name,
			Description:   cr.Description,
			FQDN:          cr.FQDN,
			AccessLevel:   string(cr.AccessLevel),
			VirtualDomain: cr.VirtualDomain,
		})
	}
	return list, nil
}

func (s *GlobalService) ListContainerRegistryUsers(ctx context.Context, id string) ([]ContainerRegistryUserInfo, error) {
	crOp := iaas.NewContainerRegistryOp(s.client.Caller())
	result, err := crOp.ListUsers(ctx, types.StringID(id))
	if err != nil {
		return nil, err
	}

	list := make([]ContainerRegistryUserInfo, 0, len(result.Users))
	for _, u := range result.Users {
		list = append(list, ContainerRegistryUserInfo{
			UserName:   u.UserName,
			Permission: string(u.Permission),
		})
	}
	return list, nil
}

func (s *GlobalService) DeleteContainerRegistry(ctx context.Context, id string) error {
	crOp := iaas.NewContainerRegistryOp(s.client.Caller())
	return crOp.Delete(ctx, types.StringID(id))
}
