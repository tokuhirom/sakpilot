package kms

import (
	"context"
	"fmt"
	"time"

	client "github.com/sacloud/api-client-go"
	kms "github.com/sacloud/kms-api-go"
	v1 "github.com/sacloud/kms-api-go/apis/v1"
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

// NewService プロファイル名から Service を作成
func NewService(profileName string) (*Service, error) {
	v1Client, err := kms.NewClient(
		client.WithProfile(profileName),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create kms client: %w", err)
	}

	return &Service{
		keyOp: kms.NewKeyOp(v1Client),
	}, nil
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
		if k.LatestVersion.Set {
			latestVersion = k.LatestVersion.Value
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
