package iam

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/google/uuid"
	sdkiam "github.com/sacloud/sacloud-sdk-go/api/iam"
	iamfolder "github.com/sacloud/sacloud-sdk-go/api/iam/apis/folder"
	iamgroup "github.com/sacloud/sacloud-sdk-go/api/iam/apis/group"
	iamproject "github.com/sacloud/sacloud-sdk-go/api/iam/apis/project"
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

// ProjectInfo IAMプロジェクト情報
type ProjectInfo struct {
	ID             int    `json:"id"`
	Code           string `json:"code"`
	Name           string `json:"name"`
	Description    string `json:"description"`
	Status         string `json:"status"`
	ParentFolderID int    `json:"parentFolderId"` // 0の場合は組織ルート直下(フォルダに属さない)
	CreatedAt      string `json:"createdAt"`
	UpdatedAt      string `json:"updatedAt"`
}

// FolderInfo IAMフォルダ情報
type FolderInfo struct {
	ID          int    `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	ParentID    int    `json:"parentId"` // 0の場合は組織ルート直下(親フォルダなし)
	CreatedAt   string `json:"createdAt"`
	UpdatedAt   string `json:"updatedAt"`
}

// OrganizationInfo IAM組織情報
type OrganizationInfo struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

// PolicyPrincipalInfo ポリシーバインディングの対象(ユーザー/グループ/サービスプリンシパル等)
type PolicyPrincipalInfo struct {
	Type string `json:"type"`
	ID   int    `json:"id"`
}

// PolicyBindingInfo ロールとプリンシパルの紐付け(IAMポリシー/IDポリシー共通のDTO)
type PolicyBindingInfo struct {
	RoleID     string                `json:"roleId"`
	Principals []PolicyPrincipalInfo `json:"principals"`
}

// Service IAM API サービス。User/Group/IAMRole/IDRoleは読み取りのみ、ServicePrincipalはキー管理まで含めて公開する
type Service struct {
	userOp             sdkiam.UserAPI
	groupOp            sdkiam.GroupAPI
	iamRoleOp          sdkiam.IAMRoleAPI
	idRoleOp           sdkiam.IDRoleAPI
	servicePrincipalOp sdkiam.ServicePrincipalAPI
	projectOp          sdkiam.ProjectAPI
	folderOp           sdkiam.FolderAPI
	organizationOp     sdkiam.OrganizationAPI
	iamPolicyOp        sdkiam.IAMPolicyAPI
	idPolicyOp         sdkiam.IDPolicyAPI
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
		projectOp:          sdkiam.NewProjectOp(client),
		folderOp:           sdkiam.NewFolderOp(client),
		organizationOp:     sdkiam.NewOrganizationOp(client),
		iamPolicyOp:        sdkiam.NewIAMPolicyOp(client),
		idPolicyOp:         sdkiam.NewIDPolicyOp(client),
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

// ListProjects プロジェクト一覧を取得
func (s *Service) ListProjects(ctx context.Context) ([]ProjectInfo, error) {
	res, err := s.projectOp.List(ctx, iamproject.ListParams{})
	if err != nil {
		return nil, err
	}

	result := make([]ProjectInfo, 0, len(res.Items))
	for _, p := range res.Items {
		result = append(result, *toProjectInfo(&p))
	}
	return result, nil
}

// GetProject プロジェクトの詳細を取得
func (s *Service) GetProject(ctx context.Context, id int) (*ProjectInfo, error) {
	p, err := s.projectOp.Read(ctx, id)
	if err != nil {
		return nil, err
	}
	return toProjectInfo(p), nil
}

// CreateProject プロジェクトを新規作成する。parentFolderIDが0の場合は組織ルート直下に作成する
func (s *Service) CreateProject(ctx context.Context, code, name, description string, parentFolderID int) (*ProjectInfo, error) {
	params := iamproject.CreateParams{Code: code, Name: name, Description: description}
	if parentFolderID != 0 {
		params.ParentFolderID = &parentFolderID
	}
	p, err := s.projectOp.Create(ctx, params)
	if err != nil {
		return nil, err
	}
	return toProjectInfo(p), nil
}

// UpdateProject プロジェクトの名前・説明を更新する
func (s *Service) UpdateProject(ctx context.Context, id int, name, description string) (*ProjectInfo, error) {
	p, err := s.projectOp.Update(ctx, id, name, description)
	if err != nil {
		return nil, err
	}
	return toProjectInfo(p), nil
}

// DeleteProject プロジェクトを削除する
func (s *Service) DeleteProject(ctx context.Context, id int) error {
	return s.projectOp.Delete(ctx, id)
}

// MoveProjects プロジェクトを別のフォルダへ移動する。parentFolderIDが0の場合は組織ルート直下へ移動する
func (s *Service) MoveProjects(ctx context.Context, ids []int, parentFolderID int) error {
	var parent *int
	if parentFolderID != 0 {
		parent = &parentFolderID
	}
	return s.projectOp.Move(ctx, ids, parent)
}

// ListFolders フォルダ一覧を取得
func (s *Service) ListFolders(ctx context.Context) ([]FolderInfo, error) {
	res, err := s.folderOp.List(ctx, iamfolder.ListParams{})
	if err != nil {
		return nil, err
	}

	result := make([]FolderInfo, 0, len(res.Items))
	for _, f := range res.Items {
		result = append(result, *toFolderInfo(&f))
	}
	return result, nil
}

// GetFolder フォルダの詳細を取得
func (s *Service) GetFolder(ctx context.Context, id int) (*FolderInfo, error) {
	f, err := s.folderOp.Read(ctx, id)
	if err != nil {
		return nil, err
	}
	return toFolderInfo(f), nil
}

// CreateFolder フォルダを新規作成する。parentIDが0の場合は組織ルート直下に作成する
func (s *Service) CreateFolder(ctx context.Context, name, description string, parentID int) (*FolderInfo, error) {
	params := iamfolder.CreateParams{Name: name, Description: &description}
	if parentID != 0 {
		params.ParentID = &parentID
	}
	f, err := s.folderOp.Create(ctx, params)
	if err != nil {
		return nil, err
	}
	return toFolderInfo(f), nil
}

// UpdateFolder フォルダの名前・説明を更新する
func (s *Service) UpdateFolder(ctx context.Context, id int, name, description string) (*FolderInfo, error) {
	f, err := s.folderOp.Update(ctx, id, name, &description)
	if err != nil {
		return nil, err
	}
	return toFolderInfo(f), nil
}

// DeleteFolder フォルダを削除する
func (s *Service) DeleteFolder(ctx context.Context, id int) error {
	return s.folderOp.Delete(ctx, id)
}

// MoveFolders フォルダを別のフォルダの子へ移動する。parentIDが0の場合は組織ルート直下へ移動する
func (s *Service) MoveFolders(ctx context.Context, ids []int, parentID int) error {
	var parent *int
	if parentID != 0 {
		parent = &parentID
	}
	return s.folderOp.Move(ctx, ids, parent)
}

// GetOrganization 組織情報を取得
func (s *Service) GetOrganization(ctx context.Context) (*OrganizationInfo, error) {
	o, err := s.organizationOp.Read(ctx)
	if err != nil {
		return nil, err
	}
	return toOrganizationInfo(o), nil
}

// UpdateOrganization 組織名を更新する
func (s *Service) UpdateOrganization(ctx context.Context, name string) (*OrganizationInfo, error) {
	o, err := s.organizationOp.Update(ctx, name)
	if err != nil {
		return nil, err
	}
	return toOrganizationInfo(o), nil
}

// GetIAMOrganizationPolicy 組織スコープのIAMポリシーバインディングを取得する
func (s *Service) GetIAMOrganizationPolicy(ctx context.Context) ([]PolicyBindingInfo, error) {
	bindings, err := s.iamPolicyOp.ReadOrganizationPolicy(ctx)
	if err != nil {
		return nil, err
	}
	return toIAMPolicyBindingInfos(bindings), nil
}

// UpdateIAMOrganizationPolicy 組織スコープのIAMポリシーバインディングを全量置換する
func (s *Service) UpdateIAMOrganizationPolicy(ctx context.Context, bindings []PolicyBindingInfo) ([]PolicyBindingInfo, error) {
	res, err := s.iamPolicyOp.UpdateOrganizationPolicy(ctx, toIAMPolicies(bindings))
	if err != nil {
		return nil, err
	}
	return toIAMPolicyBindingInfos(res), nil
}

// GetIAMProjectPolicy プロジェクトスコープのIAMポリシーバインディングを取得する
func (s *Service) GetIAMProjectPolicy(ctx context.Context, projectID int) ([]PolicyBindingInfo, error) {
	bindings, err := s.iamPolicyOp.ReadProjectPolicy(ctx, projectID)
	if err != nil {
		return nil, err
	}
	return toIAMPolicyBindingInfos(bindings), nil
}

// UpdateIAMProjectPolicy プロジェクトスコープのIAMポリシーバインディングを全量置換する
func (s *Service) UpdateIAMProjectPolicy(ctx context.Context, projectID int, bindings []PolicyBindingInfo) ([]PolicyBindingInfo, error) {
	res, err := s.iamPolicyOp.UpdateProjectPolicy(ctx, projectID, toIAMPolicies(bindings))
	if err != nil {
		return nil, err
	}
	return toIAMPolicyBindingInfos(res), nil
}

// GetIAMFolderPolicy フォルダスコープのIAMポリシーバインディングを取得する
func (s *Service) GetIAMFolderPolicy(ctx context.Context, folderID int) ([]PolicyBindingInfo, error) {
	bindings, err := s.iamPolicyOp.ReadFolderPolicy(ctx, folderID)
	if err != nil {
		return nil, err
	}
	return toIAMPolicyBindingInfos(bindings), nil
}

// UpdateIAMFolderPolicy フォルダスコープのIAMポリシーバインディングを全量置換する
func (s *Service) UpdateIAMFolderPolicy(ctx context.Context, folderID int, bindings []PolicyBindingInfo) ([]PolicyBindingInfo, error) {
	res, err := s.iamPolicyOp.UpdateFolderPolicy(ctx, folderID, toIAMPolicies(bindings))
	if err != nil {
		return nil, err
	}
	return toIAMPolicyBindingInfos(res), nil
}

// GetIDOrganizationPolicy 組織スコープのIDポリシーバインディング(旧ロール体系)を取得する
func (s *Service) GetIDOrganizationPolicy(ctx context.Context) ([]PolicyBindingInfo, error) {
	bindings, err := s.idPolicyOp.ReadOrganizationIdPolicy(ctx)
	if err != nil {
		return nil, err
	}
	return toIDPolicyBindingInfos(bindings), nil
}

// UpdateIDOrganizationPolicy 組織スコープのIDポリシーバインディング(旧ロール体系)を全量置換する
func (s *Service) UpdateIDOrganizationPolicy(ctx context.Context, bindings []PolicyBindingInfo) ([]PolicyBindingInfo, error) {
	res, err := s.idPolicyOp.UpdateOrganizationIdPolicy(ctx, toIDPolicies(bindings))
	if err != nil {
		return nil, err
	}
	return toIDPolicyBindingInfos(res), nil
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

// toProjectInfo v1.Project を ProjectInfo に変換
func toProjectInfo(p *v1.Project) *ProjectInfo {
	parentFolderID := 0
	if !p.ParentFolderID.IsNull() {
		parentFolderID = p.ParentFolderID.Value
	}
	return &ProjectInfo{
		ID:             p.ID,
		Code:           p.Code,
		Name:           p.Name,
		Description:    p.Description,
		Status:         string(p.Status),
		ParentFolderID: parentFolderID,
		CreatedAt:      p.CreatedAt,
		UpdatedAt:      p.UpdatedAt,
	}
}

// toFolderInfo v1.Folder を FolderInfo に変換
func toFolderInfo(f *v1.Folder) *FolderInfo {
	parentID := 0
	if !f.ParentID.IsNull() {
		parentID = f.ParentID.Value
	}
	return &FolderInfo{
		ID:          f.ID,
		Name:        f.Name,
		Description: f.Description,
		ParentID:    parentID,
		CreatedAt:   f.CreatedAt,
		UpdatedAt:   f.UpdatedAt,
	}
}

// toOrganizationInfo v1.Organization を OrganizationInfo に変換
func toOrganizationInfo(o *v1.Organization) *OrganizationInfo {
	return &OrganizationInfo{
		ID:   o.ID.Or(0),
		Name: o.Name,
	}
}

// toPrincipalInfos v1.Principal のスライスを PolicyPrincipalInfo のスライスに変換
func toPrincipalInfos(principals []v1.Principal) []PolicyPrincipalInfo {
	result := make([]PolicyPrincipalInfo, 0, len(principals))
	for _, p := range principals {
		result = append(result, PolicyPrincipalInfo{
			Type: p.Type.Value,
			ID:   p.ID.Value,
		})
	}
	return result
}

// toPrincipals PolicyPrincipalInfo のスライスを v1.Principal のスライスに変換
func toPrincipals(principals []PolicyPrincipalInfo) []v1.Principal {
	result := make([]v1.Principal, 0, len(principals))
	for _, p := range principals {
		result = append(result, v1.Principal{
			Type: v1.NewOptString(p.Type),
			ID:   v1.NewOptInt(p.ID),
		})
	}
	return result
}

// toIAMPolicyBindingInfos v1.IamPolicy のスライスを PolicyBindingInfo のスライスに変換
func toIAMPolicyBindingInfos(bindings []v1.IamPolicy) []PolicyBindingInfo {
	result := make([]PolicyBindingInfo, 0, len(bindings))
	for _, b := range bindings {
		result = append(result, PolicyBindingInfo{
			RoleID:     b.Role.Value.ID.Value,
			Principals: toPrincipalInfos(b.Principals),
		})
	}
	return result
}

// toIAMPolicies PolicyBindingInfo のスライスを v1.IamPolicy のスライスに変換
func toIAMPolicies(bindings []PolicyBindingInfo) []v1.IamPolicy {
	result := make([]v1.IamPolicy, 0, len(bindings))
	for _, b := range bindings {
		result = append(result, v1.IamPolicy{
			Role: v1.NewOptIamPolicyRole(v1.IamPolicyRole{
				Type: v1.NewOptIamPolicyRoleType(v1.IamPolicyRoleTypePreset),
				ID:   v1.NewOptString(b.RoleID),
			}),
			Principals: toPrincipals(b.Principals),
		})
	}
	return result
}

// toIDPolicyBindingInfos v1.IdPolicy のスライスを PolicyBindingInfo のスライスに変換
func toIDPolicyBindingInfos(bindings []v1.IdPolicy) []PolicyBindingInfo {
	result := make([]PolicyBindingInfo, 0, len(bindings))
	for _, b := range bindings {
		result = append(result, PolicyBindingInfo{
			RoleID:     b.Role.Value.ID.Value,
			Principals: toPrincipalInfos(b.Principals),
		})
	}
	return result
}

// toIDPolicies PolicyBindingInfo のスライスを v1.IdPolicy のスライスに変換
func toIDPolicies(bindings []PolicyBindingInfo) []v1.IdPolicy {
	result := make([]v1.IdPolicy, 0, len(bindings))
	for _, b := range bindings {
		result = append(result, v1.IdPolicy{
			Role: v1.NewOptIdPolicyRole(v1.IdPolicyRole{
				Type: v1.NewOptIdPolicyRoleType(v1.IdPolicyRoleTypePreset),
				ID:   v1.NewOptString(b.RoleID),
			}),
			Principals: toPrincipals(b.Principals),
		})
	}
	return result
}
