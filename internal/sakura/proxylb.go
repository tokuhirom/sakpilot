package sakura

import (
	"context"
	"time"

	"github.com/sacloud/sacloud-sdk-go/api/iaas"
	"github.com/sacloud/sacloud-sdk-go/api/iaas/types"
)

type ProxyLBInfo struct {
	ID               string                `json:"id"`
	Name             string                `json:"name"`
	Description      string                `json:"description"`
	Tags             []string              `json:"tags"`
	Plan             string                `json:"plan"`
	Region           string                `json:"region"`
	FQDN             string                `json:"fqdn"`
	VirtualIPAddress string                `json:"virtualIPAddress"`
	ProxyNetworks    []string              `json:"proxyNetworks"`
	UseVIPFailover   bool                  `json:"useVIPFailover"`
	BindPorts        []ProxyLBBindPortInfo `json:"bindPorts"`
	Servers          []ProxyLBServerInfo   `json:"servers"`
	CreatedAt        string                `json:"createdAt"`
	ModifiedAt       string                `json:"modifiedAt"`
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
	ActiveConn int                       `json:"activeConn"`
	CPS        float64                   `json:"cps"`
	CurrentVIP string                    `json:"currentVip"`
	Servers    []ProxyLBServerStatusInfo `json:"servers"`
}

type ProxyLBServerStatusInfo struct {
	IPAddress  string  `json:"ipAddress"`
	Port       int     `json:"port"`
	Status     string  `json:"status"`
	ActiveConn int     `json:"activeConn"`
	CPS        float64 `json:"cps"`
}

// ProxyLBCertInfo is the read-side representation of a certificate.
// PrivateKey is intentionally omitted; the API does not need to round-trip it to the UI.
type ProxyLBCertInfo struct {
	ServerCertificate       string `json:"serverCertificate"`
	IntermediateCertificate string `json:"intermediateCertificate"`
	CertificateEndDate      string `json:"certificateEndDate"`
	CertificateCommonName   string `json:"certificateCommonName"`
	CertificateAltNames     string `json:"certificateAltNames"`
}

type ProxyLBCertificatesInfo struct {
	PrimaryCert     *ProxyLBCertInfo  `json:"primaryCert"`
	AdditionalCerts []ProxyLBCertInfo `json:"additionalCerts"`
}

type ProxyLBCertInput struct {
	ServerCertificate       string `json:"serverCertificate"`
	IntermediateCertificate string `json:"intermediateCertificate"`
	PrivateKey              string `json:"privateKey"`
}

type ProxyLBSetCertificatesInput struct {
	PrimaryCert     ProxyLBCertInput   `json:"primaryCert"`
	AdditionalCerts []ProxyLBCertInput `json:"additionalCerts"`
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

func (s *ProxyLBService) Delete(ctx context.Context, id string) error {
	op := iaas.NewProxyLBOp(s.client.Caller())
	return op.Delete(ctx, types.StringID(id))
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

func (s *ProxyLBService) GetCertificates(ctx context.Context, id string) (*ProxyLBCertificatesInfo, error) {
	op := iaas.NewProxyLBOp(s.client.Caller())
	certs, err := op.GetCertificates(ctx, types.StringID(id))
	if err != nil {
		if iaas.IsNotFoundError(err) {
			return nil, nil
		}
		return nil, err
	}
	return convertProxyLBCertificates(certs), nil
}

func (s *ProxyLBService) SetCertificates(ctx context.Context, id string, input *ProxyLBSetCertificatesInput) (*ProxyLBCertificatesInfo, error) {
	op := iaas.NewProxyLBOp(s.client.Caller())

	param := &iaas.ProxyLBSetCertificatesRequest{
		PrimaryCerts: &iaas.ProxyLBPrimaryCert{
			ServerCertificate:       input.PrimaryCert.ServerCertificate,
			IntermediateCertificate: input.PrimaryCert.IntermediateCertificate,
			PrivateKey:              input.PrimaryCert.PrivateKey,
		},
	}
	for _, ac := range input.AdditionalCerts {
		param.AdditionalCerts = append(param.AdditionalCerts, &iaas.ProxyLBAdditionalCert{
			ServerCertificate:       ac.ServerCertificate,
			IntermediateCertificate: ac.IntermediateCertificate,
			PrivateKey:              ac.PrivateKey,
		})
	}

	certs, err := op.SetCertificates(ctx, types.StringID(id), param)
	if err != nil {
		return nil, err
	}
	return convertProxyLBCertificates(certs), nil
}

func (s *ProxyLBService) DeleteCertificates(ctx context.Context, id string) error {
	op := iaas.NewProxyLBOp(s.client.Caller())
	return op.DeleteCertificates(ctx, types.StringID(id))
}

func (s *ProxyLBService) RenewLetsEncryptCert(ctx context.Context, id string) error {
	op := iaas.NewProxyLBOp(s.client.Caller())
	return op.RenewLetsEncryptCert(ctx, types.StringID(id))
}

func formatCertEndDate(t time.Time) string {
	if t.IsZero() {
		return ""
	}
	return t.Format("2006-01-02T15:04:05Z07:00")
}

func convertProxyLBCert(c interface {
	GetServerCertificate() string
	GetIntermediateCertificate() string
	GetCertificateEndDate() time.Time
	GetCertificateCommonName() string
	GetCertificateAltNames() string
}) ProxyLBCertInfo {
	return ProxyLBCertInfo{
		ServerCertificate:       c.GetServerCertificate(),
		IntermediateCertificate: c.GetIntermediateCertificate(),
		CertificateEndDate:      formatCertEndDate(c.GetCertificateEndDate()),
		CertificateCommonName:   c.GetCertificateCommonName(),
		CertificateAltNames:     c.GetCertificateAltNames(),
	}
}

func convertProxyLBCertificates(c *iaas.ProxyLBCertificates) *ProxyLBCertificatesInfo {
	if c == nil {
		return nil
	}

	info := &ProxyLBCertificatesInfo{}
	if c.PrimaryCert != nil {
		cert := convertProxyLBCert(c.PrimaryCert)
		info.PrimaryCert = &cert
	}
	for _, ac := range c.AdditionalCerts {
		info.AdditionalCerts = append(info.AdditionalCerts, convertProxyLBCert(ac))
	}
	return info
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
