package sakura

import (
	"context"

	"github.com/sacloud/iaas-api-go"
	"github.com/sacloud/iaas-api-go/types"
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

func (s *GlobalService) ListDNS(ctx context.Context) ([]DNSInfo, error) {
	dnsOp := iaas.NewDNSOp(s.client.Caller())
	result, err := dnsOp.Find(ctx, &iaas.FindCondition{})
	if err != nil {
		return nil, err
	}

	list := make([]DNSInfo, 0, len(result.DNS))
	for _, d := range result.DNS {
		records := make([]DNSRecord, 0, len(d.Records))
		for _, r := range d.Records {
			records = append(records, DNSRecord{
				Name:  r.Name,
				Type:  string(r.Type),
				RData: r.RData,
				TTL:   r.TTL,
			})
		}
		list = append(list, DNSInfo{
			ID:          d.ID.String(),
			Name:        d.Name,
			Description: d.Description,
			Zone:        d.DNSZone,
			Records:     records,
		})
	}
	return list, nil
}

func (s *GlobalService) GetDNS(ctx context.Context, id string) (*DNSInfo, error) {
	dnsOp := iaas.NewDNSOp(s.client.Caller())
	d, err := dnsOp.Read(ctx, types.StringID(id))
	if err != nil {
		return nil, err
	}

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
	}, nil
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
