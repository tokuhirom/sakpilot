package simplemq

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	sdksimplemq "github.com/sacloud/sacloud-sdk-go/api/simplemq"
	"github.com/sacloud/sacloud-sdk-go/api/simplemq/apis/v1/message"
	"github.com/sacloud/sacloud-sdk-go/api/simplemq/apis/v1/queue"
	"github.com/sacloud/sacloud-sdk-go/common/saclient"
)

// QueueInfo Queue情報
type QueueInfo struct {
	ID                       string   `json:"id"`
	Name                     string   `json:"name"`
	Description              string   `json:"description"`
	VisibilityTimeoutSeconds int      `json:"visibilityTimeoutSeconds"`
	ExpireSeconds            int      `json:"expireSeconds"`
	Tags                     []string `json:"tags"`
	CreatedAt                string   `json:"createdAt"`
	ModifiedAt               string   `json:"modifiedAt"`
}

// MessageInfo Message情報
type MessageInfo struct {
	ID                  string `json:"id"`
	Content             string `json:"content"`
	CreatedAt           int64  `json:"createdAt"`
	UpdatedAt           int64  `json:"updatedAt"`
	ExpiresAt           int64  `json:"expiresAt"`
	AcquiredAt          int64  `json:"acquiredAt"`
	VisibilityTimeoutAt int64  `json:"visibilityTimeoutAt"`
}

// Service simplemq API サービス
type Service struct {
	saClient saclient.ClientAPI
	queueOp  sdksimplemq.QueueAPI
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
		return nil, fmt.Errorf("failed to configure simplemq client: %w", err)
	}

	queueClient, err := sdksimplemq.NewQueueClient(&sc)
	if err != nil {
		return nil, fmt.Errorf("failed to create simplemq queue client: %w", err)
	}

	return &Service{
		saClient: &sc,
		queueOp:  sdksimplemq.NewQueueOp(queueClient),
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

// ListQueues Queue一覧を取得
func (s *Service) ListQueues(ctx context.Context) ([]QueueInfo, error) {
	queues, err := s.queueOp.List(ctx)
	if err != nil {
		return nil, err
	}

	result := make([]QueueInfo, 0, len(queues))
	for _, q := range queues {
		result = append(result, *toQueueInfo(&q))
	}
	return result, nil
}

// GetQueue Queueの詳細を取得
func (s *Service) GetQueue(ctx context.Context, id string) (*QueueInfo, error) {
	q, err := s.queueOp.Read(ctx, id)
	if err != nil {
		return nil, err
	}
	return toQueueInfo(q), nil
}

// CreateQueue Queueを新規作成する
func (s *Service) CreateQueue(ctx context.Context, name, description string, tags []string) (*QueueInfo, error) {
	req := queue.CreateQueueRequest{
		CommonServiceItem: queue.CreateQueueRequestCommonServiceItem{
			Name: queue.QueueName(name),
			Tags: tags,
		},
	}
	if description != "" {
		req.CommonServiceItem.Description = queue.NewOptString(description)
	}
	created, err := s.queueOp.Create(ctx, req)
	if err != nil {
		return nil, err
	}
	return toQueueInfo(created), nil
}

// ConfigQueue Queueの説明・可視性タイムアウト・メッセージ保持期間・タグを更新する
func (s *Service) ConfigQueue(ctx context.Context, id, description string, visibilityTimeoutSeconds, expireSeconds int, tags []string) (*QueueInfo, error) {
	req := queue.ConfigQueueRequest{
		CommonServiceItem: queue.ConfigQueueRequestCommonServiceItem{
			Settings: queue.Settings{
				VisibilityTimeoutSeconds: queue.VisibilityTimeoutSeconds(visibilityTimeoutSeconds),
				ExpireSeconds:            queue.ExpireSeconds(expireSeconds),
			},
			Tags: tags,
		},
	}
	if description != "" {
		req.CommonServiceItem.Description = queue.NewOptString(description)
	}
	updated, err := s.queueOp.Config(ctx, id, req)
	if err != nil {
		return nil, err
	}
	return toQueueInfo(updated), nil
}

// DeleteQueue Queueを削除
func (s *Service) DeleteQueue(ctx context.Context, id string) error {
	return s.queueOp.Delete(ctx, id)
}

// CountMessages Queue内のメッセージ数を取得
func (s *Service) CountMessages(ctx context.Context, id string) (int, error) {
	return s.queueOp.CountMessages(ctx, id)
}

// RotateAPIKey QueueのメッセージAPI用キーを再発行する。メッセージ送受信にはこのキーが必須で、以降取得する手段はないため呼び出し元でその場で保持・表示すること
func (s *Service) RotateAPIKey(ctx context.Context, id string) (string, error) {
	return s.queueOp.RotateAPIKey(ctx, id)
}

// ClearMessages Queue内の全メッセージを削除
func (s *Service) ClearMessages(ctx context.Context, id string) error {
	return s.queueOp.ClearMessages(ctx, id)
}

// SendMessage Queueにメッセージを送信する。apiKeyはRotateAPIKeyで発行したメッセージAPI用キー。
// contentはAPI仕様上base64エンコードされたASCII文字列である必要があるため、ここでエンコードして送信する
func (s *Service) SendMessage(ctx context.Context, queueName, apiKey, content string) (*MessageInfo, error) {
	messageOp, err := s.newMessageOp(queueName, apiKey)
	if err != nil {
		return nil, err
	}
	sent, err := messageOp.Send(ctx, base64.StdEncoding.EncodeToString([]byte(content)))
	if err != nil {
		return nil, err
	}
	return &MessageInfo{
		ID:        string(sent.ID),
		Content:   content,
		CreatedAt: sent.CreatedAt,
		UpdatedAt: sent.UpdatedAt,
		ExpiresAt: sent.ExpiresAt,
	}, nil
}

// ReceiveMessages Queueからメッセージを受信する
func (s *Service) ReceiveMessages(ctx context.Context, queueName, apiKey string) ([]MessageInfo, error) {
	messageOp, err := s.newMessageOp(queueName, apiKey)
	if err != nil {
		return nil, err
	}
	messages, err := messageOp.Receive(ctx)
	if err != nil {
		return nil, err
	}
	result := make([]MessageInfo, 0, len(messages))
	for _, m := range messages {
		result = append(result, *toMessageInfo(&m))
	}
	return result, nil
}

// ExtendMessageTimeout 受信済みメッセージの可視性タイムアウトを延長する
func (s *Service) ExtendMessageTimeout(ctx context.Context, queueName, apiKey, messageID string) (*MessageInfo, error) {
	messageOp, err := s.newMessageOp(queueName, apiKey)
	if err != nil {
		return nil, err
	}
	m, err := messageOp.ExtendTimeout(ctx, messageID)
	if err != nil {
		return nil, err
	}
	return toMessageInfo(m), nil
}

// DeleteMessage 処理済みメッセージを削除する
func (s *Service) DeleteMessage(ctx context.Context, queueName, apiKey, messageID string) error {
	messageOp, err := s.newMessageOp(queueName, apiKey)
	if err != nil {
		return err
	}
	return messageOp.Delete(ctx, messageID)
}

func (s *Service) newMessageOp(queueName, apiKey string) (sdksimplemq.MessageAPI, error) {
	messageClient, err := sdksimplemq.NewMessageClient(apiKey, s.saClient)
	if err != nil {
		return nil, fmt.Errorf("failed to create simplemq message client: %w", err)
	}
	return sdksimplemq.NewMessageOp(messageClient, queueName), nil
}

// toQueueInfo queue.CommonServiceItem を QueueInfo に変換
func toQueueInfo(q *queue.CommonServiceItem) *QueueInfo {
	id := q.ID.String
	if q.ID.IsInt() {
		id = fmt.Sprintf("%d", q.ID.Int)
	}
	return &QueueInfo{
		ID:                       id,
		Name:                     q.Name,
		Description:              q.Description.Or(""),
		VisibilityTimeoutSeconds: int(q.Settings.VisibilityTimeoutSeconds),
		ExpireSeconds:            int(q.Settings.ExpireSeconds),
		Tags:                     q.Tags,
		CreatedAt:                q.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		ModifiedAt:               q.ModifiedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
}

// toMessageInfo message.Message を MessageInfo に変換する。ContentはSendMessageでbase64エンコードして送信しているため、ここでデコードする
func toMessageInfo(m *message.Message) *MessageInfo {
	content := string(m.Content)
	if decoded, err := base64.StdEncoding.DecodeString(content); err == nil {
		content = string(decoded)
	}
	return &MessageInfo{
		ID:                  string(m.ID),
		Content:             content,
		CreatedAt:           m.CreatedAt,
		UpdatedAt:           m.UpdatedAt,
		ExpiresAt:           m.ExpiresAt,
		AcquiredAt:          m.AcquiredAt,
		VisibilityTimeoutAt: m.VisibilityTimeoutAt,
	}
}
