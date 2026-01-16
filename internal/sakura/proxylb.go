package sakura

import (
	"context"

	"github.com/sacloud/iaas-api-go"
	"github.com/sacloud/iaas-api-go/types"
)

type ProxyLBInfo struct {
	ID               string               `json:"id"`
	Name             string               `json:"name"`
	Description      string               `json:"description"`
	Tags             []string             `json:"tags"`
	Plan             string               `json:"plan"`
	Region           string               `json:"region"`
	FQDN             string               `json:"fqdn"`
	VirtualIPAddress string               `json:"virtualIPAddress"`
	ProxyNetworks    []string             `json:"proxyNetworks"`
	UseVIPFailover   bool                 `json:"useVIPFailover"`
	BindPorts        []ProxyLBBindPortInfo `json:"bindPorts"`
	Servers          []ProxyLBServerInfo   `json:"servers"`
	CreatedAt        string               `json:"createdAt"`
	ModifiedAt       string               `json:"modifiedAt"`
}

type ProxyLBBindPortInfo struct {
	Port            int    `json:"port"`
	ProxyMode       string `json:"proxyMode"`
	RedirectToHTTPS bool   `json:"redirectToHttps"`
	SupportHTTP2    bool   `json:"supportHttp2"`
}

type ProxyLBServerInfo struct {
	IPAddress   string `json:"ipAddress"`
	Port        int    `json:"port"`
	ServerGroup string `json:"serverGroup"`
	Enabled     bool   `json:"enabled"`
}

type ProxyLBHealthInfo struct {
	ActiveConn int                        `json:"activeConn"`
	CPS        float64                    `json:"cps"`
	CurrentVIP string                     `json:"currentVip"`
	Servers    []ProxyLBServerStatusInfo  `json:"servers"`
}

type ProxyLBServerStatusInfo struct {
	IPAddress  string  `json:"ipAddress"`
	Port       int     `json:"port"`
	Status     string  `json:"status"`
	ActiveConn int     `json:"activeConn"`
	CPS        float64 `json:"cps"`
}

type ProxyLBService struct {
	client *Client
}

func NewProxyLBService(client *Client) *ProxyLBService {
	return &ProxyLBService{client: client}
}

func (s *ProxyLBService) List(ctx context.Context) ([]ProxyLBInfo, error) {
	op := iaas.NewProxyLBOp(s.client.Caller())
	result, err := op.Find(ctx, &iaas.FindCondition{})
	if err != nil {
		return nil, err
	}

	proxyLBs := make([]ProxyLBInfo, 0, len(result.ProxyLBs))
	for _, p := range result.ProxyLBs {
		proxyLBs = append(proxyLBs, convertProxyLB(p))
	}
	return proxyLBs, nil
}

func (s *ProxyLBService) Get(ctx context.Context, id string) (*ProxyLBInfo, error) {
	op := iaas.NewProxyLBOp(s.client.Caller())
	proxyLBID := types.StringID(id)
	result, err := op.Read(ctx, proxyLBID)
	if err != nil {
		return nil, err
	}

	info := convertProxyLB(result)
	return &info, nil
}

func (s *ProxyLBService) GetHealth(ctx context.Context, id string) (*ProxyLBHealthInfo, error) {
	op := iaas.NewProxyLBOp(s.client.Caller())
	proxyLBID := types.StringID(id)
	health, err := op.HealthStatus(ctx, proxyLBID)
	if err != nil {
		return nil, err
	}

	servers := make([]ProxyLBServerStatusInfo, 0, len(health.Servers))
	for _, srv := range health.Servers {
		servers = append(servers, ProxyLBServerStatusInfo{
			IPAddress:  srv.IPAddress,
			Port:       int(srv.Port),
			Status:     string(srv.Status),
			ActiveConn: int(srv.ActiveConn),
			CPS:        float64(srv.CPS),
		})
	}

	return &ProxyLBHealthInfo{
		ActiveConn: health.ActiveConn,
		CPS:        health.CPS,
		CurrentVIP: health.CurrentVIP,
		Servers:    servers,
	}, nil
}

func convertProxyLB(p *iaas.ProxyLB) ProxyLBInfo {
	bindPorts := make([]ProxyLBBindPortInfo, 0, len(p.BindPorts))
	for _, bp := range p.BindPorts {
		bindPorts = append(bindPorts, ProxyLBBindPortInfo{
			Port:            bp.Port,
			ProxyMode:       string(bp.ProxyMode),
			RedirectToHTTPS: bp.RedirectToHTTPS,
			SupportHTTP2:    bp.SupportHTTP2,
		})
	}

	servers := make([]ProxyLBServerInfo, 0, len(p.Servers))
	for _, srv := range p.Servers {
		servers = append(servers, ProxyLBServerInfo{
			IPAddress:   srv.IPAddress,
			Port:        srv.Port,
			ServerGroup: srv.ServerGroup,
			Enabled:     srv.Enabled,
		})
	}

	return ProxyLBInfo{
		ID:               p.ID.String(),
		Name:             p.Name,
		Description:      p.Description,
		Tags:             p.Tags,
		Plan:             p.Plan.String(),
		Region:           p.Region.String(),
		FQDN:             p.FQDN,
		VirtualIPAddress: p.VirtualIPAddress,
		ProxyNetworks:    p.ProxyNetworks,
		UseVIPFailover:   p.UseVIPFailover,
		BindPorts:        bindPorts,
		Servers:          servers,
		CreatedAt:        p.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		ModifiedAt:       p.ModifiedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
}
