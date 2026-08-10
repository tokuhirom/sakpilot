package apigw

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	"encoding/json"

	"github.com/google/uuid"
	sdkapigw "github.com/sacloud/sacloud-sdk-go/api/apigw"
	v1 "github.com/sacloud/sacloud-sdk-go/api/apigw/apis/v1"
	"github.com/sacloud/sacloud-sdk-go/common/saclient"
)

const timeFormat = "2006-01-02T15:04:05Z07:00"

// GroupInfo APIゲートウェイのグループ情報。Routeの認可(ACL)対象として利用する
type GroupInfo struct {
	ID        string   `json:"id"`
	Name      string   `json:"name"`
	Tags      []string `json:"tags"`
	CreatedAt string   `json:"createdAt"`
	UpdatedAt string   `json:"updatedAt"`
}

// CertificateInfo APIゲートウェイの証明書情報。RSA/ECDSAのいずれか一方または両方を保持する。
// 証明書本体/秘密鍵は書き込み専用でAPIレスポンスにはエコーバックされないため、RsaCert/RsaKey/EcdsaCert/EcdsaKeyは常に空文字列になる(ExpiredAtのみ参照可能)
type CertificateInfo struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	RsaCert        string `json:"rsaCert"`
	RsaKey         string `json:"rsaKey"`
	RsaExpiredAt   string `json:"rsaExpiredAt"`
	EcdsaCert      string `json:"ecdsaCert"`
	EcdsaKey       string `json:"ecdsaKey"`
	EcdsaExpiredAt string `json:"ecdsaExpiredAt"`
	CreatedAt      string `json:"createdAt"`
	UpdatedAt      string `json:"updatedAt"`
}

// DomainInfo APIゲートウェイのドメイン情報
type DomainInfo struct {
	ID              string `json:"id"`
	DomainName      string `json:"domainName"`
	CertificateID   string `json:"certificateId"`
	CertificateName string `json:"certificateName"`
	CreatedAt       string `json:"createdAt"`
	UpdatedAt       string `json:"updatedAt"`
}

// PlanInfo APIゲートウェイのサブスクリプションプラン情報
type PlanInfo struct {
	ID                string `json:"id"`
	Name              string `json:"name"`
	Price             string `json:"price"`
	Description       string `json:"description"`
	MaxServices       int    `json:"maxServices"`
	MaxRequests       int    `json:"maxRequests"`
	MaxRequestsUnit   string `json:"maxRequestsUnit"`
	OverageUnitPrice  string `json:"overageUnitPrice"`
	OverageUnitAmount int    `json:"overageUnitAmount"`
}

// SubscriptionInfo APIゲートウェイのサブスクリプション(プラン契約)情報
type SubscriptionInfo struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	PlanID         string `json:"planId"`
	PlanName       string `json:"planName"`
	ResourceID     string `json:"resourceId"`
	MonthlyRequest int    `json:"monthlyRequest"`
	ServiceID      string `json:"serviceId"`
	ServiceName    string `json:"serviceName"`
	CreatedAt      string `json:"createdAt"`
	UpdatedAt      string `json:"updatedAt"`
}

// ServiceInfo APIゲートウェイのService(バックエンド接続先)情報
type ServiceInfo struct {
	ID               string   `json:"id"`
	Name             string   `json:"name"`
	Tags             []string `json:"tags"`
	Protocol         string   `json:"protocol"`
	Host             string   `json:"host"`
	Path             string   `json:"path"`
	Port             int      `json:"port"`
	Retries          int      `json:"retries"`
	ConnectTimeout   int      `json:"connectTimeout"`
	WriteTimeout     int      `json:"writeTimeout"`
	ReadTimeout      int      `json:"readTimeout"`
	Authentication   string   `json:"authentication"`
	RouteHost        string   `json:"routeHost"`
	SubscriptionID   string   `json:"subscriptionId"`
	SubscriptionName string   `json:"subscriptionName"`
	CreatedAt        string   `json:"createdAt"`
	UpdatedAt        string   `json:"updatedAt"`
}

// RouteInfo APIゲートウェイのRoute(Serviceに対する公開経路)情報
type RouteInfo struct {
	ID                      string   `json:"id"`
	ServiceID               string   `json:"serviceId"`
	Name                    string   `json:"name"`
	Tags                    []string `json:"tags"`
	Protocols               string   `json:"protocols"`
	Path                    string   `json:"path"`
	Host                    string   `json:"host"`
	Hosts                   []string `json:"hosts"`
	Methods                 []string `json:"methods"`
	HttpsRedirectStatusCode int      `json:"httpsRedirectStatusCode"`
	RegexPriority           int      `json:"regexPriority"`
	StripPath               bool     `json:"stripPath"`
	PreserveHost            bool     `json:"preserveHost"`
	CreatedAt               string   `json:"createdAt"`
	UpdatedAt               string   `json:"updatedAt"`
}

// UserInfo APIゲートウェイのUser(Basic認証等の利用者)情報
type UserInfo struct {
	ID         string   `json:"id"`
	Name       string   `json:"name"`
	CustomID   string   `json:"customId"`
	Tags       []string `json:"tags"`
	GroupIDs   []string `json:"groupIds"`
	GroupNames []string `json:"groupNames"`
	CreatedAt  string   `json:"createdAt"`
	UpdatedAt  string   `json:"updatedAt"`
}

// UserGroupAssignmentInfo Userから見た1グループの所属状況
type UserGroupAssignmentInfo struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	IsAssigned bool   `json:"isAssigned"`
}

// Service apigw API サービス
type Service struct {
	client         *v1.Client
	groupOp        sdkapigw.GroupAPI
	certificateOp  sdkapigw.CertificateAPI
	domainOp       sdkapigw.DomainAPI
	serviceOp      sdkapigw.ServiceAPI
	subscriptionOp sdkapigw.SubscriptionAPI
	userOp         sdkapigw.UserAPI
}

// profileConfig usacloud プロファイルの設定
type profileConfig struct {
	AccessToken       string `json:"AccessToken"`
	AccessTokenSecret string `json:"AccessTokenSecret"`
}

// NewService プロファイル名から Service を作成
func NewService(profileName string) (*Service, error) {
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
		return nil, fmt.Errorf("failed to configure apigw client: %w", err)
	}

	client, err := sdkapigw.NewClient(&sc)
	if err != nil {
		return nil, fmt.Errorf("failed to create apigw client: %w", err)
	}

	return &Service{
		client:         client,
		groupOp:        sdkapigw.NewGroupOp(client),
		certificateOp:  sdkapigw.NewCertificateOp(client),
		domainOp:       sdkapigw.NewDomainOp(client),
		serviceOp:      sdkapigw.NewServiceOp(client),
		subscriptionOp: sdkapigw.NewSubscriptionOp(client),
		userOp:         sdkapigw.NewUserOp(client),
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

func (s *Service) routeOp(serviceID uuid.UUID) sdkapigw.RouteAPI {
	return sdkapigw.NewRouteOp(s.client, serviceID)
}

// --- Group ---

func (s *Service) ListGroups(ctx context.Context) ([]GroupInfo, error) {
	items, err := s.groupOp.List(ctx)
	if err != nil {
		return nil, err
	}
	result := make([]GroupInfo, 0, len(items))
	for _, item := range items {
		result = append(result, *toGroupInfo(&item))
	}
	return result, nil
}

func (s *Service) GetGroup(ctx context.Context, id string) (*GroupInfo, error) {
	uid, err := uuid.Parse(id)
	if err != nil {
		return nil, err
	}
	item, err := s.groupOp.Read(ctx, uid)
	if err != nil {
		return nil, err
	}
	return toGroupInfo(item), nil
}

func (s *Service) CreateGroup(ctx context.Context, name string, tags []string) (*GroupInfo, error) {
	item, err := s.groupOp.Create(ctx, &v1.Group{
		Name: v1.NewOptName(v1.Name(name)),
		Tags: tags,
	})
	if err != nil {
		return nil, err
	}
	return toGroupInfo(item), nil
}

func (s *Service) UpdateGroup(ctx context.Context, id, name string, tags []string) error {
	uid, err := uuid.Parse(id)
	if err != nil {
		return err
	}
	return s.groupOp.Update(ctx, &v1.Group{
		Name: v1.NewOptName(v1.Name(name)),
		Tags: tags,
	}, uid)
}

func (s *Service) DeleteGroup(ctx context.Context, id string) error {
	uid, err := uuid.Parse(id)
	if err != nil {
		return err
	}
	return s.groupOp.Delete(ctx, uid)
}

func toGroupInfo(item *v1.Group) *GroupInfo {
	return &GroupInfo{
		ID:        item.ID.Value.String(),
		Name:      string(item.Name.Value),
		Tags:      item.Tags,
		CreatedAt: formatOptDateTime(item.CreatedAt),
		UpdatedAt: formatOptDateTime(item.UpdatedAt),
	}
}

// --- Certificate ---

func (s *Service) ListCertificates(ctx context.Context) ([]CertificateInfo, error) {
	items, err := s.certificateOp.List(ctx)
	if err != nil {
		return nil, err
	}
	result := make([]CertificateInfo, 0, len(items))
	for _, item := range items {
		result = append(result, *toCertificateInfo(&item))
	}
	return result, nil
}

func (s *Service) CreateCertificate(ctx context.Context, name, rsaCert, rsaKey, ecdsaCert, ecdsaKey string) (*CertificateInfo, error) {
	req := &v1.Certificate{Name: v1.NewOptName(v1.Name(name))}
	if rsaCert != "" || rsaKey != "" {
		req.Rsa = v1.NewOptCertificateDetails(v1.CertificateDetails{
			Cert: v1.NewOptString(rsaCert),
			Key:  v1.NewOptString(rsaKey),
		})
	}
	if ecdsaCert != "" || ecdsaKey != "" {
		req.Ecdsa = v1.NewOptCertificateDetails(v1.CertificateDetails{
			Cert: v1.NewOptString(ecdsaCert),
			Key:  v1.NewOptString(ecdsaKey),
		})
	}
	item, err := s.certificateOp.Create(ctx, req)
	if err != nil {
		return nil, err
	}
	return toCertificateInfo(item), nil
}

func (s *Service) UpdateCertificate(ctx context.Context, id, name, rsaCert, rsaKey, ecdsaCert, ecdsaKey string) error {
	uid, err := uuid.Parse(id)
	if err != nil {
		return err
	}
	req := &v1.Certificate{Name: v1.NewOptName(v1.Name(name))}
	if rsaCert != "" || rsaKey != "" {
		req.Rsa = v1.NewOptCertificateDetails(v1.CertificateDetails{
			Cert: v1.NewOptString(rsaCert),
			Key:  v1.NewOptString(rsaKey),
		})
	}
	if ecdsaCert != "" || ecdsaKey != "" {
		req.Ecdsa = v1.NewOptCertificateDetails(v1.CertificateDetails{
			Cert: v1.NewOptString(ecdsaCert),
			Key:  v1.NewOptString(ecdsaKey),
		})
	}
	return s.certificateOp.Update(ctx, req, uid)
}

func (s *Service) DeleteCertificate(ctx context.Context, id string) error {
	uid, err := uuid.Parse(id)
	if err != nil {
		return err
	}
	return s.certificateOp.Delete(ctx, uid)
}

func toCertificateInfo(item *v1.Certificate) *CertificateInfo {
	info := &CertificateInfo{
		ID:        item.ID.Value.String(),
		Name:      string(item.Name.Value),
		CreatedAt: formatOptDateTime(item.CreatedAt),
		UpdatedAt: formatOptDateTime(item.UpdatedAt),
	}
	if rsa, ok := item.Rsa.Get(); ok {
		info.RsaCert = rsa.Cert.Value
		info.RsaKey = rsa.Key.Value
		info.RsaExpiredAt = formatOptDateTime(rsa.ExpiredAt)
	}
	if ecdsa, ok := item.Ecdsa.Get(); ok {
		info.EcdsaCert = ecdsa.Cert.Value
		info.EcdsaKey = ecdsa.Key.Value
		info.EcdsaExpiredAt = formatOptDateTime(ecdsa.ExpiredAt)
	}
	return info
}

// --- Domain ---

func (s *Service) ListDomains(ctx context.Context) ([]DomainInfo, error) {
	items, err := s.domainOp.List(ctx)
	if err != nil {
		return nil, err
	}
	result := make([]DomainInfo, 0, len(items))
	for _, item := range items {
		result = append(result, *toDomainInfo(&item))
	}
	return result, nil
}

func (s *Service) CreateDomain(ctx context.Context, domainName, certificateID string) (*DomainInfo, error) {
	req := &v1.Domain{DomainName: domainName}
	if certificateID != "" {
		uid, err := uuid.Parse(certificateID)
		if err != nil {
			return nil, err
		}
		req.CertificateId = v1.NewOptUUID(uid)
	}
	item, err := s.domainOp.Create(ctx, req)
	if err != nil {
		return nil, err
	}
	return toDomainInfo(item), nil
}

func (s *Service) UpdateDomain(ctx context.Context, id, certificateID string) error {
	uid, err := uuid.Parse(id)
	if err != nil {
		return err
	}
	req := &v1.DomainPUT{}
	if certificateID != "" {
		certUID, err := uuid.Parse(certificateID)
		if err != nil {
			return err
		}
		req.CertificateId = v1.NewOptUUID(certUID)
	}
	return s.domainOp.Update(ctx, req, uid)
}

func (s *Service) DeleteDomain(ctx context.Context, id string) error {
	uid, err := uuid.Parse(id)
	if err != nil {
		return err
	}
	return s.domainOp.Delete(ctx, uid)
}

func toDomainInfo(item *v1.Domain) *DomainInfo {
	return &DomainInfo{
		ID:              item.ID.Value.String(),
		DomainName:      item.DomainName,
		CertificateID:   uuidOrEmpty(item.CertificateId),
		CertificateName: item.CertificateName.Value,
	}
}

// --- Plan / Subscription ---

func (s *Service) ListPlans(ctx context.Context) ([]PlanInfo, error) {
	items, err := s.subscriptionOp.ListPlans(ctx)
	if err != nil {
		return nil, err
	}
	result := make([]PlanInfo, 0, len(items))
	for _, item := range items {
		overageUnitPrice := ""
		overageUnitAmount := 0
		if overage, ok := item.Overage.Get(); ok {
			overageUnitPrice = overage.UnitPrice.Value
			overageUnitAmount = overage.UnitRequests.Value
		}
		result = append(result, PlanInfo{
			ID:                item.ID.Value.String(),
			Name:              item.Name.Value,
			Price:             item.Price.Value,
			Description:       item.Description.Value,
			MaxServices:       item.MaxServices.Value,
			MaxRequests:       item.MaxRequests.Value,
			MaxRequestsUnit:   string(item.MaxRequestsUnit.Value),
			OverageUnitPrice:  overageUnitPrice,
			OverageUnitAmount: overageUnitAmount,
		})
	}
	return result, nil
}

// ListSubscriptions サブスクリプション一覧を取得する。一覧APIのレスポンスにはプラン名が
// 含まれない(SubscriptionDetailResponseと異なりSubscriptionはPlanIdのみ保持)ため、
// ListPlansの結果と突き合わせてPlanNameを補完する
func (s *Service) ListSubscriptions(ctx context.Context) ([]SubscriptionInfo, error) {
	items, err := s.subscriptionOp.List(ctx)
	if err != nil {
		return nil, err
	}
	plans, err := s.subscriptionOp.ListPlans(ctx)
	if err != nil {
		return nil, err
	}
	planNames := make(map[string]string, len(plans))
	for _, p := range plans {
		planNames[uuidOrEmpty(p.ID)] = p.Name.Value
	}
	result := make([]SubscriptionInfo, 0, len(items))
	for _, item := range items {
		info := *toSubscriptionInfo(&item)
		info.PlanName = planNames[info.PlanID]
		result = append(result, info)
	}
	return result, nil
}

func (s *Service) GetSubscription(ctx context.Context, id string) (*SubscriptionInfo, error) {
	uid, err := uuid.Parse(id)
	if err != nil {
		return nil, err
	}
	item, err := s.subscriptionOp.Read(ctx, uid)
	if err != nil {
		return nil, err
	}
	info := &SubscriptionInfo{
		ID:             item.ID.Value.String(),
		Name:           string(item.Name.Value),
		ResourceID:     fmt.Sprintf("%d", item.ResourceId.Value),
		MonthlyRequest: item.MonthlyRequest.Value,
		CreatedAt:      formatOptDateTime(item.CreatedAt),
		UpdatedAt:      formatOptDateTime(item.UpdatedAt),
	}
	if plan, ok := item.Plan.Get(); ok {
		info.PlanID = uuidOrEmpty(plan.PlanID)
		info.PlanName = plan.PlanName.Value
	}
	if svc, ok := item.Service.Get(); ok {
		info.ServiceID = svc.ID.String()
		info.ServiceName = svc.Name
	}
	return info, nil
}

// CreateSubscription プランに新規契約する。API仕様上Subscribeは作成物を返さないため、契約後に一覧から名前で検索して返す
func (s *Service) CreateSubscription(ctx context.Context, planID, name string) (*SubscriptionInfo, error) {
	uid, err := uuid.Parse(planID)
	if err != nil {
		return nil, err
	}
	if err := s.subscriptionOp.Create(ctx, uid, name); err != nil {
		return nil, err
	}
	items, err := s.subscriptionOp.List(ctx)
	if err != nil {
		return nil, err
	}
	for i := len(items) - 1; i >= 0; i-- {
		if string(items[i].Name.Value) == name {
			return toSubscriptionInfo(&items[i]), nil
		}
	}
	return nil, fmt.Errorf("subscription %q was created but could not be found in the list", name)
}

func (s *Service) UpdateSubscription(ctx context.Context, id, name string) error {
	uid, err := uuid.Parse(id)
	if err != nil {
		return err
	}
	return s.subscriptionOp.Update(ctx, uid, name)
}

func (s *Service) DeleteSubscription(ctx context.Context, id string) error {
	uid, err := uuid.Parse(id)
	if err != nil {
		return err
	}
	return s.subscriptionOp.Delete(ctx, uid)
}

func toSubscriptionInfo(item *v1.Subscription) *SubscriptionInfo {
	info := &SubscriptionInfo{
		ID:             item.ID.Value.String(),
		Name:           string(item.Name.Value),
		PlanID:         uuidOrEmpty(item.PlanId),
		ResourceID:     fmt.Sprintf("%d", item.ResourceId.Value),
		MonthlyRequest: item.MonthlyRequest.Value,
	}
	if svc, ok := item.Service.Get(); ok {
		info.ServiceID = svc.ID.String()
		info.ServiceName = svc.Name
	}
	return info
}

// --- Service ---

func (s *Service) ListServices(ctx context.Context) ([]ServiceInfo, error) {
	items, err := s.serviceOp.List(ctx)
	if err != nil {
		return nil, err
	}
	result := make([]ServiceInfo, 0, len(items))
	for _, item := range items {
		result = append(result, *toServiceInfo(&item))
	}
	return result, nil
}

func (s *Service) GetService(ctx context.Context, id string) (*ServiceInfo, error) {
	uid, err := uuid.Parse(id)
	if err != nil {
		return nil, err
	}
	item, err := s.serviceOp.Read(ctx, uid)
	if err != nil {
		return nil, err
	}
	return toServiceInfo(item), nil
}

// CreateService Serviceを新規作成する。subscriptionIdは事前にSubscribeしたサブスクリプションのIDを指定する
func (s *Service) CreateService(ctx context.Context, name, protocol, host, path string, port, retries, connectTimeout, writeTimeout, readTimeout int, subscriptionID string) (*ServiceInfo, error) {
	subUID, err := uuid.Parse(subscriptionID)
	if err != nil {
		return nil, err
	}
	req := &v1.ServiceDetailRequest{
		Name:           v1.Name(name),
		Protocol:       v1.ServiceDetailRequestProtocol(protocol),
		Host:           host,
		Path:           v1.NewOptString(path),
		Port:           v1.NewOptInt(port),
		Retries:        v1.NewOptInt(retries),
		ConnectTimeout: v1.NewOptInt(connectTimeout),
		WriteTimeout:   v1.NewOptInt(writeTimeout),
		ReadTimeout:    v1.NewOptInt(readTimeout),
		Subscription:   v1.ServiceSubscriptionRequest{ID: subUID},
	}
	created, err := s.serviceOp.Create(ctx, req)
	if err != nil {
		return nil, err
	}
	id, ok := created.ID.Get()
	if !ok {
		return nil, fmt.Errorf("apigw: service created without an id")
	}
	return s.GetService(ctx, id.String())
}

func (s *Service) UpdateService(ctx context.Context, id, name, protocol, host, path string, port, retries, connectTimeout, writeTimeout, readTimeout int) error {
	uid, err := uuid.Parse(id)
	if err != nil {
		return err
	}
	req := &v1.ServiceDetail{
		Name:           v1.Name(name),
		Protocol:       v1.ServiceDetailProtocol(protocol),
		Host:           host,
		Path:           v1.NewOptString(path),
		Port:           v1.NewOptInt(port),
		Retries:        v1.NewOptInt(retries),
		ConnectTimeout: v1.NewOptInt(connectTimeout),
		WriteTimeout:   v1.NewOptInt(writeTimeout),
		ReadTimeout:    v1.NewOptInt(readTimeout),
	}
	return s.serviceOp.Update(ctx, req, uid)
}

func (s *Service) DeleteService(ctx context.Context, id string) error {
	uid, err := uuid.Parse(id)
	if err != nil {
		return err
	}
	return s.serviceOp.Delete(ctx, uid)
}

func toServiceInfo(item *v1.ServiceDetailResponse) *ServiceInfo {
	info := &ServiceInfo{
		ID:             item.ID.Value.String(),
		Name:           string(item.Name),
		Tags:           item.Tags,
		Protocol:       string(item.Protocol),
		Host:           item.Host,
		Path:           item.Path.Value,
		Port:           item.Port.Value,
		Retries:        item.Retries.Value,
		ConnectTimeout: item.ConnectTimeout.Value,
		WriteTimeout:   item.WriteTimeout.Value,
		ReadTimeout:    item.ReadTimeout.Value,
		Authentication: string(item.Authentication.Value),
		RouteHost:      item.RouteHost.Value,
		CreatedAt:      formatOptDateTime(item.CreatedAt),
		UpdatedAt:      formatOptDateTime(item.UpdatedAt),
	}
	info.SubscriptionID = item.Subscription.ID.String()
	info.SubscriptionName = item.Subscription.Name
	return info
}

// --- Route ---

func (s *Service) ListRoutes(ctx context.Context, serviceID string) ([]RouteInfo, error) {
	svcUID, err := uuid.Parse(serviceID)
	if err != nil {
		return nil, err
	}
	items, err := s.routeOp(svcUID).List(ctx)
	if err != nil {
		return nil, err
	}
	result := make([]RouteInfo, 0, len(items))
	for _, item := range items {
		result = append(result, *toRouteInfoFromRoute(&item))
	}
	return result, nil
}

func (s *Service) GetRoute(ctx context.Context, serviceID, id string) (*RouteInfo, error) {
	svcUID, err := uuid.Parse(serviceID)
	if err != nil {
		return nil, err
	}
	uid, err := uuid.Parse(id)
	if err != nil {
		return nil, err
	}
	item, err := s.routeOp(svcUID).Read(ctx, uid)
	if err != nil {
		return nil, err
	}
	return toRouteInfo(item), nil
}

func (s *Service) CreateRoute(ctx context.Context, serviceID, name, protocols, path string, hosts, methods []string, httpsRedirectStatusCode, regexPriority int, stripPath, preserveHost bool, tags []string) (*RouteInfo, error) {
	svcUID, err := uuid.Parse(serviceID)
	if err != nil {
		return nil, err
	}
	req := toRouteDetailRequest(name, protocols, path, hosts, methods, httpsRedirectStatusCode, regexPriority, stripPath, preserveHost, tags)
	item, err := s.routeOp(svcUID).Create(ctx, req)
	if err != nil {
		return nil, err
	}
	return toRouteInfo(item), nil
}

func (s *Service) UpdateRoute(ctx context.Context, serviceID, id, name, protocols, path string, hosts, methods []string, httpsRedirectStatusCode, regexPriority int, stripPath, preserveHost bool, tags []string) error {
	svcUID, err := uuid.Parse(serviceID)
	if err != nil {
		return err
	}
	uid, err := uuid.Parse(id)
	if err != nil {
		return err
	}
	req := toRouteDetailRequest(name, protocols, path, hosts, methods, httpsRedirectStatusCode, regexPriority, stripPath, preserveHost, tags)
	return s.routeOp(svcUID).Update(ctx, req, uid)
}

func (s *Service) DeleteRoute(ctx context.Context, serviceID, id string) error {
	svcUID, err := uuid.Parse(serviceID)
	if err != nil {
		return err
	}
	uid, err := uuid.Parse(id)
	if err != nil {
		return err
	}
	return s.routeOp(svcUID).Delete(ctx, uid)
}

func toRouteDetailRequest(name, protocols, path string, hosts, methods []string, httpsRedirectStatusCode, regexPriority int, stripPath, preserveHost bool, tags []string) *v1.RouteDetail {
	req := &v1.RouteDetail{
		Name:          v1.NewOptName(v1.Name(name)),
		Tags:          tags,
		Path:          v1.NewOptString(path),
		Hosts:         hosts,
		StripPath:     v1.NewOptBool(stripPath),
		PreserveHost:  v1.NewOptBool(preserveHost),
		RegexPriority: v1.NewOptInt(regexPriority),
	}
	if protocols != "" {
		req.Protocols = v1.NewOptRouteDetailProtocols(v1.RouteDetailProtocols(protocols))
	}
	if len(methods) > 0 {
		req.Methods = make([]v1.HTTPMethod, 0, len(methods))
		for _, m := range methods {
			req.Methods = append(req.Methods, v1.HTTPMethod(m))
		}
	}
	if httpsRedirectStatusCode != 0 {
		req.HttpsRedirectStatusCode = v1.NewOptRouteDetailHttpsRedirectStatusCode(v1.RouteDetailHttpsRedirectStatusCode(httpsRedirectStatusCode))
	}
	return req
}

func toRouteInfo(item *v1.RouteDetail) *RouteInfo {
	methods := make([]string, 0, len(item.Methods))
	for _, m := range item.Methods {
		methods = append(methods, string(m))
	}
	return &RouteInfo{
		ID:                      item.ID.Value.String(),
		ServiceID:               uuidOrEmpty(item.ServiceId),
		Name:                    string(item.Name.Value),
		Tags:                    item.Tags,
		Protocols:               string(item.Protocols.Value),
		Path:                    item.Path.Value,
		Host:                    item.Host.Value,
		Hosts:                   item.Hosts,
		Methods:                 methods,
		HttpsRedirectStatusCode: int(item.HttpsRedirectStatusCode.Value),
		RegexPriority:           item.RegexPriority.Value,
		StripPath:               item.StripPath.Value,
		PreserveHost:            item.PreserveHost.Value,
		CreatedAt:               formatOptDateTime(item.CreatedAt),
		UpdatedAt:               formatOptDateTime(item.UpdatedAt),
	}
}

func toRouteInfoFromRoute(item *v1.Route) *RouteInfo {
	methods := make([]string, 0, len(item.Methods))
	for _, m := range item.Methods {
		methods = append(methods, string(m))
	}
	return &RouteInfo{
		ID:                      item.ID.Value.String(),
		ServiceID:               uuidOrEmpty(item.ServiceId),
		Name:                    string(item.Name.Value),
		Tags:                    item.Tags,
		Protocols:               string(item.Protocols.Value),
		Path:                    item.Path.Value,
		Host:                    item.Host.Value,
		Hosts:                   item.Hosts,
		Methods:                 methods,
		HttpsRedirectStatusCode: int(item.HttpsRedirectStatusCode.Value),
		RegexPriority:           item.RegexPriority.Value,
		StripPath:               item.StripPath.Value,
		PreserveHost:            item.PreserveHost.Value,
		CreatedAt:               formatOptDateTime(item.CreatedAt),
		UpdatedAt:               formatOptDateTime(item.UpdatedAt),
	}
}

// --- User ---

func (s *Service) ListUsers(ctx context.Context) ([]UserInfo, error) {
	items, err := s.userOp.List(ctx)
	if err != nil {
		return nil, err
	}
	result := make([]UserInfo, 0, len(items))
	for _, item := range items {
		result = append(result, *toUserInfoFromUser(&item))
	}
	return result, nil
}

func (s *Service) GetUser(ctx context.Context, id string) (*UserInfo, error) {
	uid, err := uuid.Parse(id)
	if err != nil {
		return nil, err
	}
	item, err := s.userOp.Read(ctx, uid)
	if err != nil {
		return nil, err
	}
	return toUserInfo(item), nil
}

// CreateUser Userを新規作成する。グループ所属はAPI仕様上作成時には設定できず、
// 作成後にSetUserGroup(ListUserGroups/UserExtra相当)で個別に割り当てる
func (s *Service) CreateUser(ctx context.Context, name, customID string, tags []string) (*UserInfo, error) {
	item, err := s.userOp.Create(ctx, &v1.UserDetail{
		Name:     v1.Name(name),
		CustomID: v1.NewOptString(customID),
		Tags:     tags,
	})
	if err != nil {
		return nil, err
	}
	return toUserInfo(item), nil
}

func (s *Service) UpdateUser(ctx context.Context, id, name, customID string, tags []string) error {
	uid, err := uuid.Parse(id)
	if err != nil {
		return err
	}
	return s.userOp.Update(ctx, &v1.UserDetail{
		Name:     v1.Name(name),
		CustomID: v1.NewOptString(customID),
		Tags:     tags,
	}, uid)
}

func (s *Service) DeleteUser(ctx context.Context, id string) error {
	uid, err := uuid.Parse(id)
	if err != nil {
		return err
	}
	return s.userOp.Delete(ctx, uid)
}

// ListUserGroups Userに対する全グループの所属状況を取得する
func (s *Service) ListUserGroups(ctx context.Context, userID string) ([]UserGroupAssignmentInfo, error) {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return nil, err
	}
	items, err := sdkapigw.NewUserExtraOp(s.client, uid).ListGroup(ctx)
	if err != nil {
		return nil, err
	}
	result := make([]UserGroupAssignmentInfo, 0, len(items))
	for _, item := range items {
		result = append(result, UserGroupAssignmentInfo{
			ID:         item.ID.String(),
			Name:       string(item.Name),
			IsAssigned: item.IsAssigned,
		})
	}
	return result, nil
}

// SetUserGroup UserのGroupへの所属を割り当て/解除する
func (s *Service) SetUserGroup(ctx context.Context, userID, groupID string, isAssigned bool) error {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return err
	}
	return sdkapigw.NewUserExtraOp(s.client, uid).UpdateGroup(ctx, groupID, isAssigned)
}

func toUserInfo(item *v1.UserDetail) *UserInfo {
	groupIDs := make([]string, 0, len(item.Groups))
	groupNames := make([]string, 0, len(item.Groups))
	for _, g := range item.Groups {
		groupIDs = append(groupIDs, uuidOrEmpty(g.ID))
		groupNames = append(groupNames, string(g.Name.Value))
	}
	return &UserInfo{
		ID:         item.ID.Value.String(),
		Name:       string(item.Name),
		CustomID:   item.CustomID.Value,
		Tags:       item.Tags,
		GroupIDs:   groupIDs,
		GroupNames: groupNames,
		CreatedAt:  formatOptDateTime(item.CreatedAt),
		UpdatedAt:  formatOptDateTime(item.UpdatedAt),
	}
}

func toUserInfoFromUser(item *v1.User) *UserInfo {
	groupIDs := make([]string, 0, len(item.Groups))
	groupNames := make([]string, 0, len(item.Groups))
	for _, g := range item.Groups {
		groupIDs = append(groupIDs, uuidOrEmpty(g.ID))
		groupNames = append(groupNames, string(g.Name.Value))
	}
	return &UserInfo{
		ID:         item.ID.Value.String(),
		Name:       string(item.Name),
		CustomID:   item.CustomID.Value,
		Tags:       item.Tags,
		GroupIDs:   groupIDs,
		GroupNames: groupNames,
		CreatedAt:  formatOptDateTime(item.CreatedAt),
		UpdatedAt:  formatOptDateTime(item.UpdatedAt),
	}
}

func formatOptDateTime(t v1.OptDateTime) string {
	v, ok := t.Get()
	if !ok {
		return ""
	}
	return v.Format(timeFormat)
}

func uuidOrEmpty(u v1.OptUUID) string {
	v, ok := u.Get()
	if !ok {
		return ""
	}
	return v.String()
}
