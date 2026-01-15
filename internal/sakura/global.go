package sakura

import (
	"context"

	"github.com/sacloud/iaas-api-go"
)

type DNSInfo struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Zone        string `json:"zone"`
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
		list = append(list, DNSInfo{
			ID:          d.ID.String(),
			Name:        d.Name,
			Description: d.Description,
			Zone:        d.DNSZone,
		})
	}
	return list, nil
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
