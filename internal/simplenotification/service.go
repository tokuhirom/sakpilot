package simplenotification

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	sdksimplenotification "github.com/sacloud/sacloud-sdk-go/api/simple-notification"
	v1 "github.com/sacloud/sacloud-sdk-go/api/simple-notification/apis/v1"
	"github.com/sacloud/sacloud-sdk-go/common/saclient"
)

const timeFormat = "2006-01-02T15:04:05Z07:00"

// DestinationInfo 通知送信先情報
type DestinationInfo struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Type        string   `json:"type"` // email or webhook
	Value       string   `json:"value"`
	Tags        []string `json:"tags"`
	CreatedAt   string   `json:"createdAt"`
	ModifiedAt  string   `json:"modifiedAt"`
}

// GroupInfo 通知グループ情報
type GroupInfo struct {
	ID           string   `json:"id"`
	Name         string   `json:"name"`
	Description  string   `json:"description"`
	Destinations []string `json:"destinations"`
	Tags         []string `json:"tags"`
	CreatedAt    string   `json:"createdAt"`
	ModifiedAt   string   `json:"modifiedAt"`
}

// MatchLabel ルーティングのマッチラベル(キー・バリュー)
type MatchLabel struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

// RoutingInfo 通知ルーティング情報
type RoutingInfo struct {
	ID            string       `json:"id"`
	Name          string       `json:"name"`
	Description   string       `json:"description"`
	SourceID      string       `json:"sourceId"`
	TargetGroupID string       `json:"targetGroupId"`
	MatchLabels   []MatchLabel `json:"matchLabels"`
	PriorityRank  int          `json:"priorityRank"`
	Tags          []string     `json:"tags"`
	CreatedAt     string       `json:"createdAt"`
	ModifiedAt    string       `json:"modifiedAt"`
}

// Service simple-notification API サービス
type Service struct {
	destinationOp sdksimplenotification.DestinationAPI
	groupOp       sdksimplenotification.GroupAPI
	routingOp     sdksimplenotification.RoutingAPI
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
		return nil, fmt.Errorf("failed to configure simple-notification client: %w", err)
	}

	client, err := sdksimplenotification.NewClient(&sc)
	if err != nil {
		return nil, fmt.Errorf("failed to create simple-notification client: %w", err)
	}

	return &Service{
		destinationOp: sdksimplenotification.NewDestinationOp(client),
		groupOp:       sdksimplenotification.NewGroupOp(client),
		routingOp:     sdksimplenotification.NewRoutingOp(client),
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

// ListDestinations 送信先一覧を取得
func (s *Service) ListDestinations(ctx context.Context) ([]DestinationInfo, error) {
	resp, err := s.destinationOp.List(ctx)
	if err != nil {
		return nil, err
	}
	result := make([]DestinationInfo, 0, len(resp.CommonServiceItems))
	for _, item := range resp.CommonServiceItems {
		result = append(result, *toDestinationInfo(&item))
	}
	return result, nil
}

// GetDestination 送信先の詳細を取得
func (s *Service) GetDestination(ctx context.Context, id string) (*DestinationInfo, error) {
	resp, err := s.destinationOp.Read(ctx, id)
	if err != nil {
		return nil, err
	}
	return toDestinationInfo(&resp.CommonServiceItem), nil
}

// CreateDestination 送信先を新規作成する。destTypeは"email"または"webhook"
func (s *Service) CreateDestination(ctx context.Context, name, description, destType, value string, tags []string) (*DestinationInfo, error) {
	req := v1.PostCommonServiceItemRequest{
		CommonServiceItem: v1.PostCommonServiceItemRequestCommonServiceItem{
			Name:        name,
			Description: description,
			Tags:        tags,
			Icon:        v1.NilCommonServiceItemIcon{Null: true},
			Settings:    destinationSettings(destType, value),
		},
	}
	created, err := s.destinationOp.Create(ctx, req)
	if err != nil {
		return nil, err
	}
	return toDestinationInfo(&created.CommonServiceItem), nil
}

// UpdateDestination 送信先の名前・説明・タグ・設定を更新する
func (s *Service) UpdateDestination(ctx context.Context, id, name, description, destType, value string, tags []string) (*DestinationInfo, error) {
	req := v1.PutCommonServiceItemRequest{
		CommonServiceItem: v1.PutCommonServiceItemRequestCommonServiceItem{
			Name:        name,
			Description: description,
			Tags:        tags,
			Icon:        v1.NilCommonServiceItemIcon{Null: true},
			Settings:    v1.NewOptCommonServiceItemSettings(destinationSettings(destType, value)),
		},
	}
	updated, err := s.destinationOp.Update(ctx, id, req)
	if err != nil {
		return nil, err
	}
	return toDestinationInfo(&updated.CommonServiceItem), nil
}

// DeleteDestination 送信先を削除
func (s *Service) DeleteDestination(ctx context.Context, id string) error {
	return s.destinationOp.Delete(ctx, id)
}

// ListGroups グループ一覧を取得
func (s *Service) ListGroups(ctx context.Context) ([]GroupInfo, error) {
	resp, err := s.groupOp.List(ctx)
	if err != nil {
		return nil, err
	}
	result := make([]GroupInfo, 0, len(resp.CommonServiceItems))
	for _, item := range resp.CommonServiceItems {
		result = append(result, *toGroupInfo(&item))
	}
	return result, nil
}

// GetGroup グループの詳細を取得
func (s *Service) GetGroup(ctx context.Context, id string) (*GroupInfo, error) {
	resp, err := s.groupOp.Read(ctx, id)
	if err != nil {
		return nil, err
	}
	return toGroupInfo(&resp.CommonServiceItem), nil
}

// CreateGroup グループを新規作成する
func (s *Service) CreateGroup(ctx context.Context, name, description string, destinationIDs, tags []string) (*GroupInfo, error) {
	req := v1.PostCommonServiceItemRequest{
		CommonServiceItem: v1.PostCommonServiceItemRequestCommonServiceItem{
			Name:        name,
			Description: description,
			Tags:        tags,
			Icon:        v1.NilCommonServiceItemIcon{Null: true},
			Settings:    groupSettings(destinationIDs),
		},
	}
	created, err := s.groupOp.Create(ctx, req)
	if err != nil {
		return nil, err
	}
	return toGroupInfo(&created.CommonServiceItem), nil
}

// UpdateGroup グループの名前・説明・タグ・送信先一覧を更新する
func (s *Service) UpdateGroup(ctx context.Context, id, name, description string, destinationIDs, tags []string) (*GroupInfo, error) {
	req := v1.PutCommonServiceItemRequest{
		CommonServiceItem: v1.PutCommonServiceItemRequestCommonServiceItem{
			Name:        name,
			Description: description,
			Tags:        tags,
			Icon:        v1.NilCommonServiceItemIcon{Null: true},
			Settings:    v1.NewOptCommonServiceItemSettings(groupSettings(destinationIDs)),
		},
	}
	updated, err := s.groupOp.Update(ctx, id, req)
	if err != nil {
		return nil, err
	}
	return toGroupInfo(&updated.CommonServiceItem), nil
}

// DeleteGroup グループを削除
func (s *Service) DeleteGroup(ctx context.Context, id string) error {
	return s.groupOp.Delete(ctx, id)
}

// SendGroupMessage グループ宛にテスト通知メッセージを送信する
func (s *Service) SendGroupMessage(ctx context.Context, id, message string) (bool, error) {
	resp, err := s.groupOp.SendMessage(ctx, id, v1.SendNotificationMessageRequest{Message: message})
	if err != nil {
		return false, err
	}
	return resp.IsOk, nil
}

// ListRoutings ルーティング一覧を取得
func (s *Service) ListRoutings(ctx context.Context) ([]RoutingInfo, error) {
	resp, err := s.routingOp.List(ctx)
	if err != nil {
		return nil, err
	}
	result := make([]RoutingInfo, 0, len(resp.CommonServiceItems))
	for _, item := range resp.CommonServiceItems {
		result = append(result, *toRoutingInfo(&item))
	}
	return result, nil
}

// GetRouting ルーティングの詳細を取得
func (s *Service) GetRouting(ctx context.Context, id string) (*RoutingInfo, error) {
	resp, err := s.routingOp.Read(ctx, id)
	if err != nil {
		return nil, err
	}
	return toRoutingInfo(&resp.CommonServiceItem), nil
}

// CreateRouting ルーティングを新規作成する
func (s *Service) CreateRouting(ctx context.Context, name, description, sourceID, targetGroupID string, matchLabels []MatchLabel, priorityRank int, tags []string) (*RoutingInfo, error) {
	req := v1.PostCommonServiceItemRequest{
		CommonServiceItem: v1.PostCommonServiceItemRequestCommonServiceItem{
			Name:        name,
			Description: description,
			Tags:        tags,
			Icon:        v1.NilCommonServiceItemIcon{Null: true},
			Settings:    routingSettings(sourceID, targetGroupID, matchLabels, priorityRank),
		},
	}
	created, err := s.routingOp.Create(ctx, req)
	if err != nil {
		return nil, err
	}
	return toRoutingInfo(&created.CommonServiceItem), nil
}

// UpdateRouting ルーティングの名前・説明・タグ・設定を更新する。PriorityRankはAPI側で決定されるため更新対象に含まれない(変更にはReorder APIが必要)
func (s *Service) UpdateRouting(ctx context.Context, id, name, description, sourceID, targetGroupID string, matchLabels []MatchLabel, priorityRank int, tags []string) (*RoutingInfo, error) {
	req := v1.PutCommonServiceItemRequest{
		CommonServiceItem: v1.PutCommonServiceItemRequestCommonServiceItem{
			Name:        name,
			Description: description,
			Tags:        tags,
			Icon:        v1.NilCommonServiceItemIcon{Null: true},
			Settings:    v1.NewOptCommonServiceItemSettings(routingSettings(sourceID, targetGroupID, matchLabels, priorityRank)),
		},
	}
	updated, err := s.routingOp.Update(ctx, id, req)
	if err != nil {
		return nil, err
	}
	return toRoutingInfo(&updated.CommonServiceItem), nil
}

// DeleteRouting ルーティングを削除
func (s *Service) DeleteRouting(ctx context.Context, id string) error {
	return s.routingOp.Delete(ctx, id)
}

func destinationSettings(destType, value string) v1.CommonServiceItemSettings {
	return v1.CommonServiceItemSettings{
		Type: v1.DestinationSettingsCommonServiceItemSettings,
		DestinationSettings: v1.DestinationSettings{
			Type:  v1.DestinationSettingsType(destType),
			Value: value,
		},
	}
}

func groupSettings(destinationIDs []string) v1.CommonServiceItemSettings {
	return v1.CommonServiceItemSettings{
		Type: v1.GroupSettingsCommonServiceItemSettings,
		GroupSettings: v1.GroupSettings{
			Destinations: destinationIDs,
		},
	}
}

func routingSettings(sourceID, targetGroupID string, matchLabels []MatchLabel, priorityRank int) v1.CommonServiceItemSettings {
	items := make([]v1.RoutingSettingsMatchLabelsItem, 0, len(matchLabels))
	for _, l := range matchLabels {
		items = append(items, v1.RoutingSettingsMatchLabelsItem{Name: l.Name, Value: l.Value})
	}
	return v1.CommonServiceItemSettings{
		Type: v1.RoutingSettingsCommonServiceItemSettings,
		RoutingSettings: v1.RoutingSettings{
			MatchLabels:   items,
			SourceID:      sourceID,
			TargetGroupID: targetGroupID,
			PriorityRank:  priorityRank,
		},
	}
}

func toDestinationInfo(item *v1.CommonServiceItem) *DestinationInfo {
	settings, _ := item.Settings.GetDestinationSettings()
	return &DestinationInfo{
		ID:          item.ID,
		Name:        item.Name,
		Description: item.Description,
		Type:        string(settings.Type),
		Value:       settings.Value,
		Tags:        item.Tags,
		CreatedAt:   item.CreatedAt.Format(timeFormat),
		ModifiedAt:  item.ModifiedAt.Format(timeFormat),
	}
}

func toGroupInfo(item *v1.CommonServiceItem) *GroupInfo {
	settings, _ := item.Settings.GetGroupSettings()
	return &GroupInfo{
		ID:           item.ID,
		Name:         item.Name,
		Description:  item.Description,
		Destinations: settings.Destinations,
		Tags:         item.Tags,
		CreatedAt:    item.CreatedAt.Format(timeFormat),
		ModifiedAt:   item.ModifiedAt.Format(timeFormat),
	}
}

func toRoutingInfo(item *v1.CommonServiceItem) *RoutingInfo {
	settings, _ := item.Settings.GetRoutingSettings()
	labels := make([]MatchLabel, 0, len(settings.MatchLabels))
	for _, l := range settings.MatchLabels {
		labels = append(labels, MatchLabel{Name: l.Name, Value: l.Value})
	}
	return &RoutingInfo{
		ID:            item.ID,
		Name:          item.Name,
		Description:   item.Description,
		SourceID:      settings.SourceID,
		TargetGroupID: settings.TargetGroupID,
		MatchLabels:   labels,
		PriorityRank:  settings.PriorityRank,
		Tags:          item.Tags,
		CreatedAt:     item.CreatedAt.Format(timeFormat),
		ModifiedAt:    item.ModifiedAt.Format(timeFormat),
	}
}
