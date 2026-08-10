package secretmanager

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/sacloud/sacloud-sdk-go/api/secretmanager"
	v1 "github.com/sacloud/sacloud-sdk-go/api/secretmanager/apis/v1"
	"github.com/sacloud/sacloud-sdk-go/common/saclient"
)

// VaultInfo Vault情報
type VaultInfo struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	KmsKeyID    string   `json:"kmsKeyId"`
	Tags        []string `json:"tags"`
	CreatedAt   string   `json:"createdAt"`
	ModifiedAt  string   `json:"modifiedAt"`
}

// SecretInfo Secret情報(値は含まない)
type SecretInfo struct {
	Name          string `json:"name"`
	LatestVersion int    `json:"latestVersion"`
}

// SecretValue Unveilで取得したSecretの値
type SecretValue struct {
	Name    string `json:"name"`
	Version int    `json:"version"`
	Value   string `json:"value"`
}

// Service secretmanager API サービス
type Service struct {
	client  *v1.Client
	vaultOp secretmanager.VaultAPI
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
		return nil, fmt.Errorf("failed to configure secretmanager client: %w", err)
	}

	client, err := secretmanager.NewClient(&sc)
	if err != nil {
		return nil, fmt.Errorf("failed to create secretmanager client: %w", err)
	}

	return &Service{
		client:  client,
		vaultOp: secretmanager.NewVaultOp(client),
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

// ListVaults Vault一覧を取得
func (s *Service) ListVaults(ctx context.Context) ([]VaultInfo, error) {
	vaults, err := s.vaultOp.List(ctx)
	if err != nil {
		return nil, err
	}

	result := make([]VaultInfo, 0, len(vaults))
	for _, v := range vaults {
		result = append(result, *toVaultInfo(&v))
	}
	return result, nil
}

// GetVault Vaultの詳細を取得
func (s *Service) GetVault(ctx context.Context, id string) (*VaultInfo, error) {
	v, err := s.vaultOp.Read(ctx, id)
	if err != nil {
		return nil, err
	}
	return toVaultInfo(v), nil
}

// CreateVault Vaultを新規作成する
func (s *Service) CreateVault(ctx context.Context, name, description, kmsKeyID string, tags []string) (*VaultInfo, error) {
	req := v1.CreateVault{
		Name:     name,
		KmsKeyID: kmsKeyID,
		Tags:     tags,
	}
	if description != "" {
		req.Description = v1.NewOptString(description)
	}
	created, err := s.vaultOp.Create(ctx, req)
	if err != nil {
		return nil, err
	}
	return s.GetVault(ctx, created.ID)
}

// UpdateVault Vaultの名前・説明・タグを更新する。KmsKeyID(暗号化キー)は不変のため事前Readで現在値を引き継ぐ
func (s *Service) UpdateVault(ctx context.Context, id, name, description string, tags []string) (*VaultInfo, error) {
	current, err := s.vaultOp.Read(ctx, id)
	if err != nil {
		return nil, err
	}
	req := v1.Vault{
		Name:     name,
		KmsKeyID: current.KmsKeyID,
		Tags:     tags,
	}
	if description != "" {
		req.Description = v1.NewOptString(description)
	}
	updated, err := s.vaultOp.Update(ctx, id, req)
	if err != nil {
		return nil, err
	}
	return toVaultInfo(updated), nil
}

// DeleteVault Vaultを削除
func (s *Service) DeleteVault(ctx context.Context, id string) error {
	return s.vaultOp.Delete(ctx, id)
}

// ListSecrets 指定Vault内のSecret一覧を取得(値は含まない)
func (s *Service) ListSecrets(ctx context.Context, vaultID string) ([]SecretInfo, error) {
	secretOp := secretmanager.NewSecretOp(s.client, vaultID)
	secrets, err := secretOp.List(ctx)
	if err != nil {
		return nil, err
	}

	result := make([]SecretInfo, 0, len(secrets))
	for _, sec := range secrets {
		result = append(result, SecretInfo{Name: sec.Name, LatestVersion: sec.LatestVersion})
	}
	return result, nil
}

// SetSecret Secretを作成/更新する(同名のSecretが既に存在する場合は新しいバージョンとして追加される)
func (s *Service) SetSecret(ctx context.Context, vaultID, name, value string) (*SecretInfo, error) {
	secretOp := secretmanager.NewSecretOp(s.client, vaultID)
	created, err := secretOp.Create(ctx, v1.CreateSecret{Name: name, Value: value})
	if err != nil {
		return nil, err
	}
	return &SecretInfo{Name: created.Name, LatestVersion: created.LatestVersion}, nil
}

// DeleteSecret Secretを削除(全バージョン削除)
func (s *Service) DeleteSecret(ctx context.Context, vaultID, name string) error {
	secretOp := secretmanager.NewSecretOp(s.client, vaultID)
	return secretOp.Delete(ctx, v1.DeleteSecret{Name: name})
}

// UnveilSecret Secretの値を取得する。versionが0以下の場合は最新バージョンを取得する
func (s *Service) UnveilSecret(ctx context.Context, vaultID, name string, version int) (*SecretValue, error) {
	secretOp := secretmanager.NewSecretOp(s.client, vaultID)
	req := v1.Unveil{Name: name}
	if version > 0 {
		req.Version = v1.NewOptNilInt(version)
	}
	res, err := secretOp.Unveil(ctx, req)
	if err != nil {
		return nil, err
	}
	resolvedVersion, _ := res.Version.Get()
	return &SecretValue{Name: res.Name, Version: resolvedVersion, Value: res.Value}, nil
}

// toVaultInfo v1.Vault を VaultInfo に変換
func toVaultInfo(v *v1.Vault) *VaultInfo {
	return &VaultInfo{
		ID:          v.ID,
		Name:        v.Name,
		Description: v.Description.Or(""),
		KmsKeyID:    v.KmsKeyID,
		Tags:        v.Tags,
		CreatedAt:   parseDateTime(v.CreatedAt).Format(time.RFC3339),
		ModifiedAt:  parseDateTime(v.ModifiedAt).Format(time.RFC3339),
	}
}

// parseDateTime v1.DateTimeを time.Time に変換
func parseDateTime(dt v1.DateTime) time.Time {
	t, err := time.Parse(time.RFC3339, string(dt))
	if err != nil {
		return time.Time{}
	}
	return t
}
