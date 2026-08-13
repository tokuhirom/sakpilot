// Package cloudhsm exposes CloudHSM operations (HSMパーティション本体、証明書クライアント、
// ピア、ソフトウェアライセンス)。CloudHSMは物理的にis1bゾーンにのみ存在するため、
// SDK(github.com/sacloud/sacloud-sdk-go/api/cloudhsm)はゾーンをis1b固定で扱う
// グローバルリソースであり、内部的にはKMSやSecretManagerと同様にプロファイルの
// APIキーのみで認証する(ユーザーが選択中のゾーンとは独立)。
package cloudhsm

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/sacloud/sacloud-sdk-go/api/cloudhsm"
	v1 "github.com/sacloud/sacloud-sdk-go/api/cloudhsm/apis/v1"
	"github.com/sacloud/sacloud-sdk-go/common/saclient"
)

// CloudHSMInfo CloudHSM(HSMパーティション)情報
type CloudHSMInfo struct {
	ID                 string   `json:"id"`
	Name               string   `json:"name"`
	Description        string   `json:"description"`
	Availability       string   `json:"availability"`
	Tags               []string `json:"tags"`
	Ipv4NetworkAddress string   `json:"ipv4NetworkAddress"`
	Ipv4PrefixLength   int      `json:"ipv4PrefixLength"`
	Ipv4Address        string   `json:"ipv4Address"`
	CreatedAt          string   `json:"createdAt"`
	ModifiedAt         string   `json:"modifiedAt"`
}

// ClientInfo CloudHSM接続クライアント(証明書ベース)情報
type ClientInfo struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Certificate  string `json:"certificate"`
	Availability string `json:"availability"`
	CreatedAt    string `json:"createdAt"`
	ModifiedAt   string `json:"modifiedAt"`
}

// PeerInfo CloudHSMピア(VPN対向ルーター)情報
type PeerInfo struct {
	ID     string   `json:"id"`
	Index  int      `json:"index"`
	Status string   `json:"status"`
	Routes []string `json:"routes"`
}

// LicenseInfo CloudHSMソフトウェアライセンス情報。HSM本体とは独立したトップレベルリソース
type LicenseInfo struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Tags        []string `json:"tags"`
	CreatedAt   string   `json:"createdAt"`
	ModifiedAt  string   `json:"modifiedAt"`
}

// Service CloudHSM API サービス
type Service struct {
	client    *v1.Client
	hsmOp     cloudhsm.CloudHSMAPI
	licenseOp cloudhsm.LicenseAPI
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
		return nil, fmt.Errorf("failed to configure cloudhsm client: %w", err)
	}

	client, err := cloudhsm.NewClient(&sc)
	if err != nil {
		return nil, fmt.Errorf("failed to create cloudhsm client: %w", err)
	}

	return &Service{
		client:    client,
		hsmOp:     cloudhsm.NewCloudHSMOp(client),
		licenseOp: cloudhsm.NewLicenseOp(client),
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

// ListCloudHSMs CloudHSM一覧を取得
func (s *Service) ListCloudHSMs(ctx context.Context) ([]CloudHSMInfo, error) {
	hsms, err := s.hsmOp.List(ctx)
	if err != nil {
		return nil, err
	}
	result := make([]CloudHSMInfo, 0, len(hsms))
	for _, h := range hsms {
		result = append(result, *toCloudHSMInfo(&h))
	}
	return result, nil
}

// GetCloudHSM CloudHSMの詳細を取得
func (s *Service) GetCloudHSM(ctx context.Context, id string) (*CloudHSMInfo, error) {
	h, err := s.hsmOp.Read(ctx, id)
	if err != nil {
		return nil, err
	}
	return toCloudHSMInfo(h), nil
}

// CreateCloudHSM CloudHSMを新規作成する
func (s *Service) CreateCloudHSM(ctx context.Context, name, description string, tags []string, ipv4NetworkAddress string, ipv4PrefixLength int) (*CloudHSMInfo, error) {
	params := cloudhsm.CloudHSMCreateParams{
		Name:               name,
		Tags:               tags,
		Ipv4NetworkAddress: ipv4NetworkAddress,
		Ipv4PrefixLength:   ipv4PrefixLength,
	}
	if description != "" {
		params.Description = &description
	}
	created, err := s.hsmOp.Create(ctx, params)
	if err != nil {
		return nil, err
	}
	return s.GetCloudHSM(ctx, created.ID)
}

// UpdateCloudHSM CloudHSMの名前・説明・タグを更新する。Ipv4NetworkAddress/Ipv4PrefixLength
// (サブネット定義)は実運用上不変のため事前Readで現在値を引き継ぐ
func (s *Service) UpdateCloudHSM(ctx context.Context, id, name, description string, tags []string) (*CloudHSMInfo, error) {
	current, err := s.hsmOp.Read(ctx, id)
	if err != nil {
		return nil, err
	}
	params := cloudhsm.CloudHSMUpdateParams{
		Name:               name,
		Tags:               tags,
		Ipv4NetworkAddress: current.Ipv4NetworkAddress,
		Ipv4PrefixLength:   current.Ipv4PrefixLength,
	}
	if description != "" {
		params.Description = &description
	}
	updated, err := s.hsmOp.Update(ctx, id, params)
	if err != nil {
		return nil, err
	}
	return toCloudHSMInfo(updated), nil
}

// DeleteCloudHSM CloudHSMを削除
func (s *Service) DeleteCloudHSM(ctx context.Context, id string) error {
	return s.hsmOp.Delete(ctx, id)
}

// clientOpFor 指定HSMに紐づくClientOpを生成する。HSMがAvailableでない場合はエラーになる
func (s *Service) clientOpFor(ctx context.Context, hsmID string) (cloudhsm.ClientAPI, error) {
	hsm, err := s.hsmOp.Read(ctx, hsmID)
	if err != nil {
		return nil, err
	}
	return cloudhsm.NewClientOp(s.client, hsm)
}

// peerOpFor 指定HSMに紐づくPeerOpを生成する。HSMがAvailableでない場合はエラーになる
func (s *Service) peerOpFor(ctx context.Context, hsmID string) (cloudhsm.PeerAPI, error) {
	hsm, err := s.hsmOp.Read(ctx, hsmID)
	if err != nil {
		return nil, err
	}
	return cloudhsm.NewPeerOp(s.client, hsm)
}

// ListClients 指定HSMの接続クライアント一覧を取得
func (s *Service) ListClients(ctx context.Context, hsmID string) ([]ClientInfo, error) {
	op, err := s.clientOpFor(ctx, hsmID)
	if err != nil {
		return nil, err
	}
	clients, err := op.List(ctx)
	if err != nil {
		return nil, err
	}
	result := make([]ClientInfo, 0, len(clients))
	for _, c := range clients {
		result = append(result, *toClientInfo(&c))
	}
	return result, nil
}

// CreateClient 指定HSMに接続クライアント(証明書)を新規作成する
func (s *Service) CreateClient(ctx context.Context, hsmID, name, certificate string) (*ClientInfo, error) {
	op, err := s.clientOpFor(ctx, hsmID)
	if err != nil {
		return nil, err
	}
	created, err := op.Create(ctx, cloudhsm.CloudHSMClientCreateParams{Name: name, Certificate: certificate})
	if err != nil {
		return nil, err
	}
	return toClientInfo(created), nil
}

// UpdateClient 接続クライアントの名前を更新する(証明書は不変)
func (s *Service) UpdateClient(ctx context.Context, hsmID, clientID, name string) (*ClientInfo, error) {
	op, err := s.clientOpFor(ctx, hsmID)
	if err != nil {
		return nil, err
	}
	updated, err := op.Update(ctx, clientID, cloudhsm.CloudHSMClientUpdateParams{Name: name})
	if err != nil {
		return nil, err
	}
	return toClientInfo(updated), nil
}

// DeleteClient 接続クライアントを削除
func (s *Service) DeleteClient(ctx context.Context, hsmID, clientID string) error {
	op, err := s.clientOpFor(ctx, hsmID)
	if err != nil {
		return err
	}
	return op.Delete(ctx, clientID)
}

// ListPeers 指定HSMのピア一覧を取得
func (s *Service) ListPeers(ctx context.Context, hsmID string) ([]PeerInfo, error) {
	op, err := s.peerOpFor(ctx, hsmID)
	if err != nil {
		return nil, err
	}
	peers, err := op.List(ctx)
	if err != nil {
		return nil, err
	}
	result := make([]PeerInfo, 0, len(peers))
	for _, p := range peers {
		result = append(result, *toPeerInfo(&p))
	}
	return result, nil
}

// CreatePeer 指定HSMにピア(対向ルーター)を新規作成する。PeerAPIはCreate後に
// 個々のピア情報を返さないため、作成後にListPeersで一覧を取り直すこと
func (s *Service) CreatePeer(ctx context.Context, hsmID, routerID, secretKey string) error {
	op, err := s.peerOpFor(ctx, hsmID)
	if err != nil {
		return err
	}
	return op.Create(ctx, cloudhsm.CloudHSMPeerCreateParams{RouterID: routerID, SecretKey: secretKey})
}

// DeletePeer ピアを削除
func (s *Service) DeletePeer(ctx context.Context, hsmID, peerID string) error {
	op, err := s.peerOpFor(ctx, hsmID)
	if err != nil {
		return err
	}
	return op.Delete(ctx, peerID)
}

// ListLicenses ソフトウェアライセンス一覧を取得
func (s *Service) ListLicenses(ctx context.Context) ([]LicenseInfo, error) {
	licenses, err := s.licenseOp.List(ctx)
	if err != nil {
		return nil, err
	}
	result := make([]LicenseInfo, 0, len(licenses))
	for _, l := range licenses {
		result = append(result, *toLicenseInfo(&l))
	}
	return result, nil
}

// GetLicense ソフトウェアライセンスの詳細を取得
func (s *Service) GetLicense(ctx context.Context, id string) (*LicenseInfo, error) {
	l, err := s.licenseOp.Read(ctx, id)
	if err != nil {
		return nil, err
	}
	return toLicenseInfo(l), nil
}

// CreateLicense ソフトウェアライセンスを新規作成する
func (s *Service) CreateLicense(ctx context.Context, name, description string, tags []string) (*LicenseInfo, error) {
	params := cloudhsm.CloudHSMSoftwareLicenseCreateParams{Name: name, Tags: tags}
	if description != "" {
		params.Description = &description
	}
	created, err := s.licenseOp.Create(ctx, params)
	if err != nil {
		return nil, err
	}
	if created == nil {
		return nil, fmt.Errorf("cloudhsm: license creation returned no data")
	}
	return s.GetLicense(ctx, created.ID)
}

// UpdateLicense ソフトウェアライセンスの名前・説明・タグを更新する
func (s *Service) UpdateLicense(ctx context.Context, id, name, description string, tags []string) (*LicenseInfo, error) {
	updated, err := s.licenseOp.Update(ctx, id, cloudhsm.CloudHSMSoftwareLicenseUpdateParams{
		Name:        name,
		Description: description,
		Tags:        tags,
	})
	if err != nil {
		return nil, err
	}
	return toLicenseInfo(updated), nil
}

// DeleteLicense ソフトウェアライセンスを削除
func (s *Service) DeleteLicense(ctx context.Context, id string) error {
	return s.licenseOp.Delete(ctx, id)
}

// toCloudHSMInfo v1.CloudHSM を CloudHSMInfo に変換
func toCloudHSMInfo(h *v1.CloudHSM) *CloudHSMInfo {
	return &CloudHSMInfo{
		ID:                 h.ID,
		Name:               h.Name,
		Description:        h.Description.Or(""),
		Availability:       string(h.Availability),
		Tags:               h.Tags,
		Ipv4NetworkAddress: h.Ipv4NetworkAddress,
		Ipv4PrefixLength:   h.Ipv4PrefixLength,
		Ipv4Address:        h.Ipv4Address,
		CreatedAt:          formatDateTime(h.CreatedAt),
		ModifiedAt:         formatDateTime(h.ModifiedAt),
	}
}

// toClientInfo v1.CloudHSMClient を ClientInfo に変換
func toClientInfo(c *v1.CloudHSMClient) *ClientInfo {
	return &ClientInfo{
		ID:           c.ID,
		Name:         c.Name,
		Certificate:  c.Certificate,
		Availability: string(c.Availability),
		CreatedAt:    formatDateTime(c.CreatedAt),
		ModifiedAt:   formatDateTime(c.ModifiedAt),
	}
}

// toPeerInfo v1.CloudHSMPeer を PeerInfo に変換
func toPeerInfo(p *v1.CloudHSMPeer) *PeerInfo {
	index := 0
	if v, ok := p.Index.Get(); ok {
		index = v
	}
	status := ""
	if v, ok := p.Status.Get(); ok {
		status = string(v)
	}
	return &PeerInfo{
		ID:     p.ID,
		Index:  index,
		Status: status,
		Routes: p.Routes,
	}
}

// toLicenseInfo v1.CloudHSMSoftwareLicense を LicenseInfo に変換
func toLicenseInfo(l *v1.CloudHSMSoftwareLicense) *LicenseInfo {
	return &LicenseInfo{
		ID:          l.ID,
		Name:        l.Name,
		Description: l.Description,
		Tags:        l.Tags,
		CreatedAt:   formatDateTime(l.CreatedAt),
		ModifiedAt:  formatDateTime(l.ModifiedAt),
	}
}

// formatDateTime v1.DateTime(RFC3339文字列)を正規化する。パース失敗時は元の値をそのまま返す
func formatDateTime(dt v1.DateTime) string {
	t, err := time.Parse(time.RFC3339, string(dt))
	if err != nil {
		return string(dt)
	}
	return t.Format(time.RFC3339)
}
