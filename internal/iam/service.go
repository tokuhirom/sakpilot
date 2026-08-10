package iam

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/google/uuid"
	sdkiam "github.com/sacloud/sacloud-sdk-go/api/iam"
	iamgroup "github.com/sacloud/sacloud-sdk-go/api/iam/apis/group"
	iamserviceprincipal "github.com/sacloud/sacloud-sdk-go/api/iam/apis/serviceprincipal"
	iamuser "github.com/sacloud/sacloud-sdk-go/api/iam/apis/user"
	v1 "github.com/sacloud/sacloud-sdk-go/api/iam/apis/v1"
	"github.com/sacloud/sacloud-sdk-go/common/saclient"
)

// UserInfo IAMユーザー情報
type UserInfo struct {
	ID          int    `json:"id"`
	Name        string `json:"name"`
	Code        string `json:"code"`
	Status      string `json:"status"`
	Description string `json:"description"`
	Email       string `json:"email"`
	CreatedAt   string `json:"createdAt"`
	UpdatedAt   string `json:"updatedAt"`
}

// GroupInfo IAMグループ情報
type GroupInfo struct {
	ID          int    `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	CreatedAt   string `json:"createdAt"`
	UpdatedAt   string `json:"updatedAt"`
}

// IAMRoleInfo IAMロール定義(参照専用)
type IAMRoleInfo struct {
	ID                      string `json:"id"`
	Name                    string `json:"name"`
	Description             string `json:"description"`
	Category                string `json:"category"`
	LowestGrantableResource string `json:"lowestGrantableResource"`
}

// IDRoleInfo IDロール定義(参照専用、IAMロール導入以前からの旧ロール体系)
type IDRoleInfo struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

// ServicePrincipalInfo サービスプリンシパル情報
type ServicePrincipalInfo struct {
	ID          int    `json:"id"`
	ProjectID   int    `json:"projectId"`
	Name        string `json:"name"`
	Description string `json:"description"`
	CreatedAt   string `json:"createdAt"`
	UpdatedAt   string `json:"updatedAt"`
}

// ServicePrincipalKeyInfo サービスプリンシパルキー情報
type ServicePrincipalKeyInfo struct {
	ID           string `json:"id"`
	Kid          string `json:"kid"`
	Status       string `json:"status"`
	KeyOrigin    string `json:"keyOrigin"`
	PublicKey    string `json:"publicKey"`
	CreatedAt    string `json:"createdAt"`
	KeyExpiresAt string `json:"keyExpiresAt"`
}

// Service IAM API サービス。User/Group/IAMRole/IDRoleは読み取りのみ、ServicePrincipalはキー管理まで含めて公開する
type Service struct {
	userOp             sdkiam.UserAPI
	groupOp            sdkiam.GroupAPI
	iamRoleOp          sdkiam.IAMRoleAPI
	idRoleOp           sdkiam.IDRoleAPI
	servicePrincipalOp sdkiam.ServicePrincipalAPI
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
		return nil, fmt.Errorf("failed to configure iam client: %w", err)
	}

	client, err := sdkiam.NewClient(&sc)
	if err != nil {
		return nil, fmt.Errorf("failed to create iam client: %w", err)
	}

	return &Service{
		userOp:             sdkiam.NewUserOp(client),
		groupOp:            sdkiam.NewGroupOp(client),
		iamRoleOp:          sdkiam.NewIAMRoleOp(client),
		idRoleOp:           sdkiam.NewIDRoleOp(client),
		servicePrincipalOp: sdkiam.NewServicePrincipalOp(client),
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

// ListUsers ユーザー一覧を取得
func (s *Service) ListUsers(ctx context.Context) ([]UserInfo, error) {
	res, err := s.userOp.List(ctx, iamuser.ListParams{})
	if err != nil {
		return nil, err
	}

	result := make([]UserInfo, 0, len(res.Items))
	for _, u := range res.Items {
		result = append(result, *toUserInfo(&u))
	}
	return result, nil
}

// GetUser ユーザーの詳細を取得
func (s *Service) GetUser(ctx context.Context, id int) (*UserInfo, error) {
	u, err := s.userOp.Read(ctx, id)
	if err != nil {
		return nil, err
	}
	return toUserInfo(u), nil
}

// ListGroups グループ一覧を取得
func (s *Service) ListGroups(ctx context.Context) ([]GroupInfo, error) {
	res, err := s.groupOp.List(ctx, iamgroup.ListParams{})
	if err != nil {
		return nil, err
	}

	result := make([]GroupInfo, 0, len(res.Items))
	for _, g := range res.Items {
		result = append(result, *toGroupInfo(&g))
	}
	return result, nil
}

// GetGroup グループの詳細を取得
func (s *Service) GetGroup(ctx context.Context, id int) (*GroupInfo, error) {
	g, err := s.groupOp.Read(ctx, id)
	if err != nil {
		return nil, err
	}
	return toGroupInfo(g), nil
}

// ListIAMRoles IAMロール定義一覧を取得(参照専用)
func (s *Service) ListIAMRoles(ctx context.Context) ([]IAMRoleInfo, error) {
	res, err := s.iamRoleOp.List(ctx, nil, nil)
	if err != nil {
		return nil, err
	}

	result := make([]IAMRoleInfo, 0, len(res.Items))
	for _, r := range res.Items {
		result = append(result, IAMRoleInfo{
			ID:                      r.ID,
			Name:                    r.Name,
			Description:             r.Description,
			Category:                r.Category,
			LowestGrantableResource: string(r.LowestGrantableResource),
		})
	}
	return result, nil
}

// ListIDRoles IDロール定義一覧を取得(参照専用、旧ロール体系)
func (s *Service) ListIDRoles(ctx context.Context) ([]IDRoleInfo, error) {
	res, err := s.idRoleOp.List(ctx, nil, nil)
	if err != nil {
		return nil, err
	}

	result := make([]IDRoleInfo, 0, len(res.Items))
	for _, r := range res.Items {
		result = append(result, IDRoleInfo{
			ID:          r.ID,
			Name:        r.Name,
			Description: r.Description,
		})
	}
	return result, nil
}

// ListServicePrincipals サービスプリンシパル一覧を取得
func (s *Service) ListServicePrincipals(ctx context.Context) ([]ServicePrincipalInfo, error) {
	res, err := s.servicePrincipalOp.List(ctx, iamserviceprincipal.ListParams{})
	if err != nil {
		return nil, err
	}

	result := make([]ServicePrincipalInfo, 0, len(res.Items))
	for _, sp := range res.Items {
		result = append(result, *toServicePrincipalInfo(&sp))
	}
	return result, nil
}

// GetServicePrincipal サービスプリンシパルの詳細を取得
func (s *Service) GetServicePrincipal(ctx context.Context, id int) (*ServicePrincipalInfo, error) {
	sp, err := s.servicePrincipalOp.Read(ctx, id)
	if err != nil {
		return nil, err
	}
	return toServicePrincipalInfo(sp), nil
}

// CreateServicePrincipal サービスプリンシパルを新規作成する
func (s *Service) CreateServicePrincipal(ctx context.Context, projectID int, name, description string) (*ServicePrincipalInfo, error) {
	sp, err := s.servicePrincipalOp.Create(ctx, iamserviceprincipal.CreateParams{
		ProjectID:   projectID,
		Name:        name,
		Description: description,
	})
	if err != nil {
		return nil, err
	}
	return toServicePrincipalInfo(sp), nil
}

// UpdateServicePrincipal サービスプリンシパルの名前・説明を更新する
func (s *Service) UpdateServicePrincipal(ctx context.Context, id int, name, description string) (*ServicePrincipalInfo, error) {
	req := iamserviceprincipal.UpdateParams{Name: name}
	if description != "" {
		req.Description = v1.NewOptString(description)
	}
	sp, err := s.servicePrincipalOp.Update(ctx, id, req)
	if err != nil {
		return nil, err
	}
	return toServicePrincipalInfo(sp), nil
}

// DeleteServicePrincipal サービスプリンシパルを削除する
func (s *Service) DeleteServicePrincipal(ctx context.Context, id int) error {
	return s.servicePrincipalOp.Delete(ctx, id)
}

// ListServicePrincipalKeys サービスプリンシパルのキー一覧を取得
func (s *Service) ListServicePrincipalKeys(ctx context.Context, id int) ([]ServicePrincipalKeyInfo, error) {
	res, err := s.servicePrincipalOp.ListKeys(ctx, id, iamserviceprincipal.ListKeysParams{})
	if err != nil {
		return nil, err
	}

	result := make([]ServicePrincipalKeyInfo, 0, len(res.Items))
	for _, k := range res.Items {
		result = append(result, *toServicePrincipalKeyInfo(&k))
	}
	return result, nil
}

// UploadServicePrincipalKey サービスプリンシパルに公開鍵を登録する
func (s *Service) UploadServicePrincipalKey(ctx context.Context, id int, publicKey string) (*ServicePrincipalKeyInfo, error) {
	key, err := s.servicePrincipalOp.UploadKey(ctx, id, v1.ServiceprincipalKeyPublicKey(publicKey))
	if err != nil {
		return nil, err
	}
	return toServicePrincipalKeyInfo(key), nil
}

// EnableServicePrincipalKey サービスプリンシパルキーを有効化する
func (s *Service) EnableServicePrincipalKey(ctx context.Context, id int, keyID string) (*ServicePrincipalKeyInfo, error) {
	parsedKeyID, err := uuid.Parse(keyID)
	if err != nil {
		return nil, fmt.Errorf("invalid key id: %w", err)
	}
	key, err := s.servicePrincipalOp.EnableKey(ctx, id, parsedKeyID)
	if err != nil {
		return nil, err
	}
	return toServicePrincipalKeyInfo(key), nil
}

// DisableServicePrincipalKey サービスプリンシパルキーを無効化する
func (s *Service) DisableServicePrincipalKey(ctx context.Context, id int, keyID string) (*ServicePrincipalKeyInfo, error) {
	parsedKeyID, err := uuid.Parse(keyID)
	if err != nil {
		return nil, fmt.Errorf("invalid key id: %w", err)
	}
	key, err := s.servicePrincipalOp.DisableKey(ctx, id, parsedKeyID)
	if err != nil {
		return nil, err
	}
	return toServicePrincipalKeyInfo(key), nil
}

// DeleteServicePrincipalKey サービスプリンシパルキーを削除する
func (s *Service) DeleteServicePrincipalKey(ctx context.Context, id int, keyID string) error {
	parsedKeyID, err := uuid.Parse(keyID)
	if err != nil {
		return fmt.Errorf("invalid key id: %w", err)
	}
	return s.servicePrincipalOp.DeleteKey(ctx, id, parsedKeyID)
}

// toUserInfo v1.User を UserInfo に変換
func toUserInfo(u *v1.User) *UserInfo {
	return &UserInfo{
		ID:          u.ID,
		Name:        u.Name,
		Code:        u.Code,
		Status:      string(u.Status),
		Description: u.Description,
		Email:       u.Email,
		CreatedAt:   u.CreatedAt,
		UpdatedAt:   u.UpdatedAt,
	}
}

// toGroupInfo v1.Group を GroupInfo に変換
func toGroupInfo(g *v1.Group) *GroupInfo {
	return &GroupInfo{
		ID:          g.ID,
		Name:        g.Name,
		Description: g.Description,
		CreatedAt:   g.CreatedAt,
		UpdatedAt:   g.UpdatedAt,
	}
}

// toServicePrincipalInfo v1.ServicePrincipal を ServicePrincipalInfo に変換
func toServicePrincipalInfo(sp *v1.ServicePrincipal) *ServicePrincipalInfo {
	return &ServicePrincipalInfo{
		ID:          sp.ID,
		ProjectID:   sp.ProjectID,
		Name:        sp.Name,
		Description: sp.Description,
		CreatedAt:   sp.CreatedAt.Value,
		UpdatedAt:   sp.UpdatedAt.Value,
	}
}

// toServicePrincipalKeyInfo v1.ServicePrincipalKey を ServicePrincipalKeyInfo に変換
func toServicePrincipalKeyInfo(k *v1.ServicePrincipalKey) *ServicePrincipalKeyInfo {
	return &ServicePrincipalKeyInfo{
		ID:           k.ID.String(),
		Kid:          k.Kid,
		Status:       string(k.Status),
		KeyOrigin:    string(k.KeyOrigin),
		PublicKey:    string(k.PublicKey),
		CreatedAt:    k.CreatedAt,
		KeyExpiresAt: k.KeyExpiresAt.Value,
	}
}
