package kms

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	kms "github.com/sacloud/sacloud-sdk-go/api/kms"
	v1 "github.com/sacloud/sacloud-sdk-go/api/kms/apis/v1"
	"github.com/sacloud/sacloud-sdk-go/common/saclient"
)

// KeyInfo KMSキー情報
type KeyInfo struct {
	ID            string   `json:"id"`
	Name          string   `json:"name"`
	Description   string   `json:"description"`
	Status        string   `json:"status"`
	KeyOrigin     string   `json:"keyOrigin"`
	LatestVersion int      `json:"latestVersion"`
	Tags          []string `json:"tags"`
	CreatedAt     string   `json:"createdAt"`
}

// Service KMS API サービス
type Service struct {
	keyOp kms.KeyAPI
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
		return nil, fmt.Errorf("failed to configure kms client: %w", err)
	}

	v1Client, err := kms.NewClient(&sc)
	if err != nil {
		return nil, fmt.Errorf("failed to create kms client: %w", err)
	}

	return &Service{
		keyOp: kms.NewKeyOp(v1Client),
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

// ListKeys KMSキー一覧を取得
func (s *Service) ListKeys(ctx context.Context) ([]KeyInfo, error) {
	keys, err := s.keyOp.List(ctx)
	if err != nil {
		return nil, err
	}

	result := make([]KeyInfo, 0, len(keys))
	for _, k := range keys {
		result = append(result, *toKeyInfo(&k))
	}
	return result, nil
}

// GetKey KMSキーの詳細を取得
func (s *Service) GetKey(ctx context.Context, id string) (*KeyInfo, error) {
	k, err := s.keyOp.Read(ctx, id)
	if err != nil {
		return nil, err
	}
	return toKeyInfo(k), nil
}

// DeleteKey KMSキーを削除
func (s *Service) DeleteKey(ctx context.Context, id string) error {
	return s.keyOp.Delete(ctx, id)
}

// CreateKey KMSキーを新規作成する。keyOriginは"generated"(自動生成)または"imported"(既存キーのインポート、plainKeyが必須)
func (s *Service) CreateKey(ctx context.Context, name string, description string, keyOrigin string, plainKey string, tags []string) (*KeyInfo, error) {
	req := v1.CreateKey{
		Name:      name,
		KeyOrigin: v1.KeyOriginEnum(keyOrigin),
		Tags:      tags,
	}
	if description != "" {
		req.Description = v1.NewOptString(description)
	}
	if plainKey != "" {
		req.PlainKey = v1.NewOptString(plainKey)
	}
	created, err := s.keyOp.Create(ctx, req)
	if err != nil {
		return nil, err
	}
	return s.GetKey(ctx, created.ID)
}

// UpdateKey KMSキーの名前・説明・タグを更新する。KeyOrigin(生成元)は不変のため事前Readで現在値を引き継ぐ
func (s *Service) UpdateKey(ctx context.Context, id string, name string, description string, tags []string) (*KeyInfo, error) {
	current, err := s.keyOp.Read(ctx, id)
	if err != nil {
		return nil, err
	}
	updated, err := s.keyOp.Update(ctx, id, v1.Key{
		Name:        name,
		Description: description,
		KeyOrigin:   current.KeyOrigin,
		Status:      current.Status,
		Tags:        tags,
	})
	if err != nil {
		return nil, err
	}
	return toKeyInfo(updated), nil
}

// RotateKey KMSキーをローテーションし、更新後の情報を返す
func (s *Service) RotateKey(ctx context.Context, id string) (*KeyInfo, error) {
	k, err := s.keyOp.Rotate(ctx, id)
	if err != nil {
		return nil, err
	}
	return toKeyInfo(k), nil
}

// ChangeKeyStatus KMSキーのステータスを変更する（active/restricted/suspended）
func (s *Service) ChangeKeyStatus(ctx context.Context, id string, status string) error {
	return s.keyOp.ChangeStatus(ctx, id, v1.ChangeKeyStatusStatus(status))
}

// toKeyInfo v1.Key を KeyInfo に変換
func toKeyInfo(k *v1.Key) *KeyInfo {
	latestVersion := 0
	if v, ok := k.LatestVersion.Get(); ok {
		latestVersion = v
	}
	createdAt := parseDateTime(k.CreatedAt).Format("2006-01-02T15:04:05Z07:00")
	return &KeyInfo{
		ID:            k.ID,
		Name:          k.Name,
		Description:   k.Description,
		Status:        string(k.Status),
		KeyOrigin:     string(k.KeyOrigin),
		LatestVersion: latestVersion,
		Tags:          k.Tags,
		CreatedAt:     createdAt,
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
