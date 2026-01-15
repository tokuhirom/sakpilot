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
