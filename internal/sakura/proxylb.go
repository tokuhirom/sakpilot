package sakura

import (
	"context"
	"time"

	"github.com/sacloud/sacloud-sdk-go/api/iaas"
	"github.com/sacloud/sacloud-sdk-go/api/iaas/types"
)

type ProxyLBInfo struct {
	ID               string                  `json:"id"`
	Name             string                  `json:"name"`
	Description      string                  `json:"description"`
	Tags             []string                `json:"tags"`
	Plan             string                  `json:"plan"`
	Region           string                  `json:"region"`
	FQDN             string                  `json:"fqdn"`
	VirtualIPAddress string                  `json:"virtualIPAddress"`
	ProxyNetworks    []string                `json:"proxyNetworks"`
	UseVIPFailover   bool                    `json:"useVIPFailover"`
	HealthCheck      *ProxyLBHealthCheckInfo `json:"healthCheck"`
	SorryServer      *ProxyLBSorryServerInfo `json:"sorryServer"`
	BindPorts        []ProxyLBBindPortInfo   `json:"bindPorts"`
	Servers          []ProxyLBServerInfo     `json:"servers"`
	CreatedAt        string                  `json:"createdAt"`
	ModifiedAt       string                  `json:"modifiedAt"`
}

type ProxyLBHealthCheckInfo struct {
	Protocol  string `json:"protocol"`
	Path      string `json:"path"`
	Host      string `json:"host"`
	DelayLoop int    `json:"delayLoop"`
}

type ProxyLBSorryServerInfo struct {
	IPAddress string `json:"ipAddress"`
	Port      int    `json:"port"`
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

type ProxyLBCreateInput struct {
	Name           string `json:"name"`
	Description    string `json:"description"`
	Plan           int    `json:"plan"`
	Region         string `json:"region"`
	UseVIPFailover bool   `json:"useVipFailover"`
}

type ProxyLBHealthCheckInput struct {
	Protocol  string `json:"protocol"`
	Path      string `json:"path"`
	Host      string `json:"host"`
	DelayLoop int    `json:"delayLoop"`
}

type ProxyLBSorryServerInput struct {
	IPAddress string `json:"ipAddress"`
	Port      int    `json:"port"`
}

type ProxyLBBindPortInput struct {
	ProxyMode       string `json:"proxyMode"`
	Port            int    `json:"port"`
	RedirectToHTTPS bool   `json:"redirectToHttps"`
	SupportHTTP2    bool   `json:"supportHttp2"`
}

type ProxyLBServerInput struct {
	IPAddress   string `json:"ipAddress"`
	Port        int    `json:"port"`
	ServerGroup string `json:"serverGroup"`
	Enabled     bool   `json:"enabled"`
}

type ProxyLBSettingsInput struct {
	HealthCheck ProxyLBHealthCheckInput  `json:"healthCheck"`
	SorryServer *ProxyLBSorryServerInput `json:"sorryServer"`
	BindPorts   []ProxyLBBindPortInput   `json:"bindPorts"`
	Servers     []ProxyLBServerInput     `json:"servers"`
}

// ProxyLBConnectionValueInfo is a single point of the connection activity time series.
type ProxyLBConnectionValueInfo struct {
	Time              string  `json:"time"`
	ActiveConnections float64 `json:"activeConnections"`
	ConnectionsPerSec float64 `json:"connectionsPerSec"`
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

// Create はELBを新規作成する。待ち受けポート・実サーバー等の詳細設定は作成後、UpdateSettingsで行う。
func (s *ProxyLBService) Create(ctx context.Context, input ProxyLBCreateInput) (*ProxyLBInfo, error) {
	op := iaas.NewProxyLBOp(s.client.Caller())
	result, err := op.Create(ctx, &iaas.ProxyLBCreateRequest{
		Name:           input.Name,
		Description:    input.Description,
		Plan:           types.EProxyLBPlan(input.Plan),
		Region:         types.EProxyLBRegion(input.Region),
		UseVIPFailover: input.UseVIPFailover,
	})
	if err != nil {
		return nil, err
	}
	info := convertProxyLB(result)
	return &info, nil
}

// Update はELBの名前・説明を更新する。監視設定は既存のものを維持したまま送信する
// (Update APIはSettingsも含むリクエスト構造のため、空で送ると設定が失われる)。
func (s *ProxyLBService) Update(ctx context.Context, id, name, description string) (*ProxyLBInfo, error) {
	op := iaas.NewProxyLBOp(s.client.Caller())
	proxyLBID := types.StringID(id)
	current, err := op.Read(ctx, proxyLBID)
	if err != nil {
		return nil, err
	}
	result, err := op.Update(ctx, proxyLBID, &iaas.ProxyLBUpdateRequest{
		Name:                 name,
		Description:          description,
		Tags:                 current.Tags,
		IconID:               current.IconID,
		HealthCheck:          current.HealthCheck,
		SorryServer:          current.SorryServer,
		BindPorts:            current.BindPorts,
		Servers:              current.Servers,
		Rules:                current.Rules,
		LetsEncrypt:          current.LetsEncrypt,
		StickySession:        current.StickySession,
		Timeout:              current.Timeout,
		Gzip:                 current.Gzip,
		BackendHttpKeepAlive: current.BackendHttpKeepAlive,
		MonitoringSuiteLog:   current.MonitoringSuiteLog,
		ProxyProtocol:        current.ProxyProtocol,
		Syslog:               current.Syslog,
		OriginGuard:          current.OriginGuard,
		StrictRule:           current.StrictRule,
		SettingsHash:         current.SettingsHash,
	})
	if err != nil {
		return nil, err
	}
	info := convertProxyLB(result)
	return &info, nil
}

// UpdateSettings はELBのヘルスチェック・Sorry Server・待ち受けポート・実サーバーを更新する。名前・説明は変更しない。
func (s *ProxyLBService) UpdateSettings(ctx context.Context, id string, input ProxyLBSettingsInput) (*ProxyLBInfo, error) {
	op := iaas.NewProxyLBOp(s.client.Caller())
	proxyLBID := types.StringID(id)
	current, err := op.Read(ctx, proxyLBID)
	if err != nil {
		return nil, err
	}

	var sorryServer *iaas.ProxyLBSorryServer
	if input.SorryServer != nil && input.SorryServer.IPAddress != "" {
		sorryServer = &iaas.ProxyLBSorryServer{
			IPAddress: input.SorryServer.IPAddress,
			Port:      input.SorryServer.Port,
		}
	}

	bindPorts := make([]*iaas.ProxyLBBindPort, 0, len(input.BindPorts))
	for _, bp := range input.BindPorts {
		bindPorts = append(bindPorts, &iaas.ProxyLBBindPort{
			ProxyMode:       types.EProxyLBProxyMode(bp.ProxyMode),
			Port:            bp.Port,
			RedirectToHTTPS: bp.RedirectToHTTPS,
			SupportHTTP2:    bp.SupportHTTP2,
		})
	}

	servers := make([]*iaas.ProxyLBServer, 0, len(input.Servers))
	for _, srv := range input.Servers {
		servers = append(servers, &iaas.ProxyLBServer{
			IPAddress:   srv.IPAddress,
			Port:        srv.Port,
			ServerGroup: srv.ServerGroup,
			Enabled:     srv.Enabled,
		})
	}

	result, err := op.UpdateSettings(ctx, proxyLBID, &iaas.ProxyLBUpdateSettingsRequest{
		HealthCheck: &iaas.ProxyLBHealthCheck{
			Protocol:  types.EProxyLBHealthCheckProtocol(input.HealthCheck.Protocol),
			Path:      input.HealthCheck.Path,
			Host:      input.HealthCheck.Host,
			DelayLoop: input.HealthCheck.DelayLoop,
		},
		SorryServer:          sorryServer,
		BindPorts:            bindPorts,
		Servers:              servers,
		Rules:                current.Rules,
		LetsEncrypt:          current.LetsEncrypt,
		StickySession:        current.StickySession,
		Timeout:              current.Timeout,
		Gzip:                 current.Gzip,
		BackendHttpKeepAlive: current.BackendHttpKeepAlive,
		MonitoringSuiteLog:   current.MonitoringSuiteLog,
		ProxyProtocol:        current.ProxyProtocol,
		Syslog:               current.Syslog,
		OriginGuard:          current.OriginGuard,
		StrictRule:           current.StrictRule,
		SettingsHash:         current.SettingsHash,
	})
	if err != nil {
		return nil, err
	}
	info := convertProxyLB(result)
	return &info, nil
}

// ChangePlan はELBのプラン(CPS)を変更する。リージョン(スタンダード/Anycast)は現在の値を引き継ぐ。
func (s *ProxyLBService) ChangePlan(ctx context.Context, id string, cps int) (*ProxyLBInfo, error) {
	op := iaas.NewProxyLBOp(s.client.Caller())
	proxyLBID := types.StringID(id)
	current, err := op.Read(ctx, proxyLBID)
	if err != nil {
		return nil, err
	}

	result, err := op.ChangePlan(ctx, proxyLBID, &iaas.ProxyLBChangePlanRequest{
		ServiceClass: types.ProxyLBServiceClass(types.EProxyLBPlan(cps), current.Region),
	})
	if err != nil {
		return nil, err
	}
	info := convertProxyLB(result)
	return &info, nil
}

// MonitorConnection はELBのアクティブコネクション数・秒間接続数のトラフィックグラフ用データを取得する。
func (s *ProxyLBService) MonitorConnection(ctx context.Context, id string, start, end int64) ([]ProxyLBConnectionValueInfo, error) {
	op := iaas.NewProxyLBOp(s.client.Caller())
	activity, err := op.MonitorConnection(ctx, types.StringID(id), &iaas.MonitorCondition{
		Start: time.Unix(start, 0),
		End:   time.Unix(end, 0),
	})
	if err != nil {
		return nil, err
	}
	if activity == nil {
		return nil, nil
	}

	values := make([]ProxyLBConnectionValueInfo, 0, len(activity.Values))
	for _, v := range activity.Values {
		values = append(values, ProxyLBConnectionValueInfo{
			Time:              v.Time.Format("2006-01-02T15:04:05Z07:00"),
			ActiveConnections: v.ActiveConnections,
			ConnectionsPerSec: v.ConnectionsPerSec,
		})
	}
	return values, nil
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

	var healthCheck *ProxyLBHealthCheckInfo
	if p.HealthCheck != nil {
		healthCheck = &ProxyLBHealthCheckInfo{
			Protocol:  string(p.HealthCheck.Protocol),
			Path:      p.HealthCheck.Path,
			Host:      p.HealthCheck.Host,
			DelayLoop: p.HealthCheck.DelayLoop,
		}
	}

	var sorryServer *ProxyLBSorryServerInfo
	if p.SorryServer != nil {
		sorryServer = &ProxyLBSorryServerInfo{
			IPAddress: p.SorryServer.IPAddress,
			Port:      p.SorryServer.Port,
		}
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
		HealthCheck:      healthCheck,
		SorryServer:      sorryServer,
		BindPorts:        bindPorts,
		Servers:          servers,
		CreatedAt:        p.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		ModifiedAt:       p.ModifiedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
}
