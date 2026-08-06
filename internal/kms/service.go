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
	if err := sc.SetEnviron([]string{
		"SAKURA_ACCESS_TOKEN=" + cfg.AccessToken,
		"SAKURA_ACCESS_TOKEN_SECRET=" + cfg.AccessTokenSecret,
	}); err != nil {
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
		latestVersion := 0
		if v, ok := k.LatestVersion.Get(); ok {
			latestVersion = v
		}
		createdAt := parseDateTime(k.CreatedAt).Format("2006-01-02T15:04:05Z07:00")
		result = append(result, KeyInfo{
			ID:            k.ID,
			Name:          k.Name,
			Description:   k.Description,
			Status:        string(k.Status),
			KeyOrigin:     string(k.KeyOrigin),
			LatestVersion: latestVersion,
			Tags:          k.Tags,
			CreatedAt:     createdAt,
		})
	}
	return result, nil
}

// parseDateTime v1.DateTimeを time.Time に変換
func parseDateTime(dt v1.DateTime) time.Time {
	t, err := time.Parse(time.RFC3339, string(dt))
	if err != nil {
		return time.Time{}
	}
	return t
}
