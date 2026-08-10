package eventbus

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"

	"context"
	"encoding/json"

	sdkeventbus "github.com/sacloud/sacloud-sdk-go/api/eventbus"
	v1 "github.com/sacloud/sacloud-sdk-go/api/eventbus/apis/v1"
	"github.com/sacloud/sacloud-sdk-go/common/saclient"
)

const timeFormat = "2006-01-02T15:04:05Z07:00"

// TriggerConditionInfo トリガー発火条件。Opは"eq"(完全一致)または"in"(いずれかに一致)
type TriggerConditionInfo struct {
	Key    string   `json:"key"`
	Op     string   `json:"op"`
	Values []string `json:"values"`
}

// TriggerInfo イベントトリガー情報
type TriggerInfo struct {
	ID                     string                 `json:"id"`
	Name                   string                 `json:"name"`
	Description            string                 `json:"description"`
	Source                 string                 `json:"source"`
	Types                  []string               `json:"types"`
	Conditions             []TriggerConditionInfo `json:"conditions"`
	ProcessConfigurationID string                 `json:"processConfigurationId"`
	Tags                   []string               `json:"tags"`
	CreatedAt              string                 `json:"createdAt"`
	ModifiedAt             string                 `json:"modifiedAt"`
}

// ScheduleInfo イベントスケジュール情報。RecurringStep/RecurringUnit/Crontabはどちらか一方の指定を想定
type ScheduleInfo struct {
	ID                     string   `json:"id"`
	Name                   string   `json:"name"`
	Description            string   `json:"description"`
	ProcessConfigurationID string   `json:"processConfigurationId"`
	RecurringStep          int      `json:"recurringStep"`
	RecurringUnit          string   `json:"recurringUnit"`
	Crontab                string   `json:"crontab"`
	StartsAt               string   `json:"startsAt"`
	Tags                   []string `json:"tags"`
	CreatedAt              string   `json:"createdAt"`
	ModifiedAt             string   `json:"modifiedAt"`
}

// ProcessConfigurationInfo イベント実行設定(処理内容)情報。Destinationは"simplenotification"/"simplemq"/"autoscale"
type ProcessConfigurationInfo struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Destination string   `json:"destination"`
	Parameters  string   `json:"parameters"`
	Tags        []string `json:"tags"`
	CreatedAt   string   `json:"createdAt"`
	ModifiedAt  string   `json:"modifiedAt"`
}

// Service eventbus API サービス
type Service struct {
	triggerOp              sdkeventbus.TriggerAPI
	scheduleOp             sdkeventbus.ScheduleAPI
	processConfigurationOp sdkeventbus.ProcessConfigurationAPI
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
		return nil, fmt.Errorf("failed to configure eventbus client: %w", err)
	}

	client, err := sdkeventbus.NewClient(&sc)
	if err != nil {
		return nil, fmt.Errorf("failed to create eventbus client: %w", err)
	}

	return &Service{
		triggerOp:              sdkeventbus.NewTriggerOp(client),
		scheduleOp:             sdkeventbus.NewScheduleOp(client),
		processConfigurationOp: sdkeventbus.NewProcessConfigurationOp(client),
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

// ListTriggers トリガー一覧を取得。sacloud-sdk-go/api/eventbusのProvider.Classクエリ注入
// ミドルウェアが実際にはリクエストに反映されず(docs/upstream-issues.md参照)、List APIは
// Trigger/Schedule/ProcessConfigurationを区別せず全件返すため、Settingsの型で明示的に絞り込む
func (s *Service) ListTriggers(ctx context.Context) ([]TriggerInfo, error) {
	items, err := s.triggerOp.List(ctx)
	if err != nil {
		return nil, err
	}
	result := make([]TriggerInfo, 0, len(items))
	for _, item := range items {
		if !item.Settings.IsTriggerSettings() {
			continue
		}
		result = append(result, *toTriggerInfo(&item))
	}
	return result, nil
}

// GetTrigger トリガーの詳細を取得
func (s *Service) GetTrigger(ctx context.Context, id string) (*TriggerInfo, error) {
	item, err := s.triggerOp.Read(ctx, id)
	if err != nil {
		return nil, err
	}
	return toTriggerInfo(item), nil
}

// CreateTrigger トリガーを新規作成する
func (s *Service) CreateTrigger(ctx context.Context, name, description, source string, types []string, conditions []TriggerConditionInfo, processConfigurationID string, tags []string) (*TriggerInfo, error) {
	req := v1.CreateCommonServiceItemRequest{
		CommonServiceItem: v1.CreateCommonServiceItemRequestCommonServiceItem{
			Name:        name,
			Description: v1.NewOptNilString(description),
			Settings:    v1.NewTriggerSettingsSettings(toTriggerSettings(source, types, conditions, processConfigurationID)),
			Tags:        tags,
		},
	}
	item, err := s.triggerOp.Create(ctx, req)
	if err != nil {
		return nil, err
	}
	return toTriggerInfo(item), nil
}

// UpdateTrigger トリガーを更新する
func (s *Service) UpdateTrigger(ctx context.Context, id, name, description, source string, types []string, conditions []TriggerConditionInfo, processConfigurationID string, tags []string) (*TriggerInfo, error) {
	req := v1.UpdateCommonServiceItemRequest{
		CommonServiceItem: v1.UpdateCommonServiceItemRequestCommonServiceItem{
			Name:        v1.NewOptString(name),
			Description: v1.NewOptNilString(description),
			Settings:    v1.NewOptSettings(v1.NewTriggerSettingsSettings(toTriggerSettings(source, types, conditions, processConfigurationID))),
			Tags:        tags,
		},
	}
	item, err := s.triggerOp.Update(ctx, id, req)
	if err != nil {
		return nil, err
	}
	return toTriggerInfo(item), nil
}

// DeleteTrigger トリガーを削除
func (s *Service) DeleteTrigger(ctx context.Context, id string) error {
	return s.triggerOp.Delete(ctx, id)
}

// ListSchedules スケジュール一覧を取得
func (s *Service) ListSchedules(ctx context.Context) ([]ScheduleInfo, error) {
	items, err := s.scheduleOp.List(ctx)
	if err != nil {
		return nil, err
	}
	result := make([]ScheduleInfo, 0, len(items))
	for _, item := range items {
		if !item.Settings.IsScheduleSettings() {
			continue
		}
		result = append(result, *toScheduleInfo(&item))
	}
	return result, nil
}

// GetSchedule スケジュールの詳細を取得
func (s *Service) GetSchedule(ctx context.Context, id string) (*ScheduleInfo, error) {
	item, err := s.scheduleOp.Read(ctx, id)
	if err != nil {
		return nil, err
	}
	return toScheduleInfo(item), nil
}

// CreateSchedule スケジュールを新規作成する。startsAtMillisはエポックミリ秒。recurringUnit/crontabはどちらか一方を指定する(空文字は未指定)
func (s *Service) CreateSchedule(ctx context.Context, name, description, processConfigurationID string, recurringStep int, recurringUnit, crontab string, startsAtMillis int64, tags []string) (*ScheduleInfo, error) {
	req := v1.CreateCommonServiceItemRequest{
		CommonServiceItem: v1.CreateCommonServiceItemRequestCommonServiceItem{
			Name:        name,
			Description: v1.NewOptNilString(description),
			Settings:    v1.NewScheduleSettingsSettings(toScheduleSettings(processConfigurationID, recurringStep, recurringUnit, crontab, startsAtMillis)),
			Tags:        tags,
		},
	}
	item, err := s.scheduleOp.Create(ctx, req)
	if err != nil {
		return nil, err
	}
	return toScheduleInfo(item), nil
}

// UpdateSchedule スケジュールを更新する
func (s *Service) UpdateSchedule(ctx context.Context, id, name, description, processConfigurationID string, recurringStep int, recurringUnit, crontab string, startsAtMillis int64, tags []string) (*ScheduleInfo, error) {
	req := v1.UpdateCommonServiceItemRequest{
		CommonServiceItem: v1.UpdateCommonServiceItemRequestCommonServiceItem{
			Name:        v1.NewOptString(name),
			Description: v1.NewOptNilString(description),
			Settings:    v1.NewOptSettings(v1.NewScheduleSettingsSettings(toScheduleSettings(processConfigurationID, recurringStep, recurringUnit, crontab, startsAtMillis))),
			Tags:        tags,
		},
	}
	item, err := s.scheduleOp.Update(ctx, id, req)
	if err != nil {
		return nil, err
	}
	return toScheduleInfo(item), nil
}

// DeleteSchedule スケジュールを削除
func (s *Service) DeleteSchedule(ctx context.Context, id string) error {
	return s.scheduleOp.Delete(ctx, id)
}

// ListProcessConfigurations 実行設定一覧を取得
func (s *Service) ListProcessConfigurations(ctx context.Context) ([]ProcessConfigurationInfo, error) {
	items, err := s.processConfigurationOp.List(ctx)
	if err != nil {
		return nil, err
	}
	result := make([]ProcessConfigurationInfo, 0, len(items))
	for _, item := range items {
		if !item.Settings.IsProcessConfigurationSettings() {
			continue
		}
		result = append(result, *toProcessConfigurationInfo(&item))
	}
	return result, nil
}

// GetProcessConfiguration 実行設定の詳細を取得
func (s *Service) GetProcessConfiguration(ctx context.Context, id string) (*ProcessConfigurationInfo, error) {
	item, err := s.processConfigurationOp.Read(ctx, id)
	if err != nil {
		return nil, err
	}
	return toProcessConfigurationInfo(item), nil
}

// CreateProcessConfiguration 実行設定を新規作成する。destinationは"simplenotification"/"simplemq"/"autoscale"、parametersはJSON文字列
func (s *Service) CreateProcessConfiguration(ctx context.Context, name, description, destination, parameters string, tags []string) (*ProcessConfigurationInfo, error) {
	req := v1.CreateCommonServiceItemRequest{
		CommonServiceItem: v1.CreateCommonServiceItemRequestCommonServiceItem{
			Name:        name,
			Description: v1.NewOptNilString(description),
			Settings: v1.NewProcessConfigurationSettingsSettings(v1.ProcessConfigurationSettings{
				Destination: v1.ProcessConfigurationSettingsDestination(destination),
				Parameters:  parameters,
			}),
			Tags: tags,
		},
	}
	item, err := s.processConfigurationOp.Create(ctx, req)
	if err != nil {
		return nil, err
	}
	return toProcessConfigurationInfo(item), nil
}

// UpdateProcessConfiguration 実行設定を更新する
func (s *Service) UpdateProcessConfiguration(ctx context.Context, id, name, description, destination, parameters string, tags []string) (*ProcessConfigurationInfo, error) {
	req := v1.UpdateCommonServiceItemRequest{
		CommonServiceItem: v1.UpdateCommonServiceItemRequestCommonServiceItem{
			Name:        v1.NewOptString(name),
			Description: v1.NewOptNilString(description),
			Settings: v1.NewOptSettings(v1.NewProcessConfigurationSettingsSettings(v1.ProcessConfigurationSettings{
				Destination: v1.ProcessConfigurationSettingsDestination(destination),
				Parameters:  parameters,
			})),
			Tags: tags,
		},
	}
	item, err := s.processConfigurationOp.Update(ctx, id, req)
	if err != nil {
		return nil, err
	}
	return toProcessConfigurationInfo(item), nil
}

// UpdateProcessConfigurationSacloudAPISecret 実行設定にさくらのクラウドAPIキーのシークレットを設定する(destination=autoscale用)
func (s *Service) UpdateProcessConfigurationSacloudAPISecret(ctx context.Context, id, accessToken, accessTokenSecret string) error {
	return s.processConfigurationOp.UpdateSecret(ctx, id, v1.SetSecretRequest{
		Secret: v1.NewSacloudAPISecretSetSecretRequestSecret(v1.SacloudAPISecret{
			AccessToken:       accessToken,
			AccessTokenSecret: accessTokenSecret,
		}),
	})
}

// UpdateProcessConfigurationSimpleMQSecret 実行設定にSimpleMQのAPIキーのシークレットを設定する(destination=simplemq用)
func (s *Service) UpdateProcessConfigurationSimpleMQSecret(ctx context.Context, id, apiKey string) error {
	return s.processConfigurationOp.UpdateSecret(ctx, id, v1.SetSecretRequest{
		Secret: v1.NewSimpleMQSecretSetSecretRequestSecret(v1.SimpleMQSecret{
			APIKey: apiKey,
		}),
	})
}

// DeleteProcessConfiguration 実行設定を削除
func (s *Service) DeleteProcessConfiguration(ctx context.Context, id string) error {
	return s.processConfigurationOp.Delete(ctx, id)
}

func toTriggerSettings(source string, types []string, conditions []TriggerConditionInfo, processConfigurationID string) v1.TriggerSettings {
	settings := v1.TriggerSettings{
		Source:                 source,
		Types:                  v1.NewOptNilStringArray(types),
		ProcessConfigurationID: processConfigurationID,
	}
	if len(conditions) > 0 {
		items := make([]v1.TriggerSettingsConditionsItem, 0, len(conditions))
		for _, c := range conditions {
			switch c.Op {
			case "in":
				items = append(items, v1.NewTriggerConditionInTriggerSettingsConditionsItem(v1.TriggerConditionIn{
					Key: c.Key, Op: v1.TriggerConditionInOpIn, Values: c.Values,
				}))
			default:
				items = append(items, v1.NewTriggerConditionEqTriggerSettingsConditionsItem(v1.TriggerConditionEq{
					Key: c.Key, Op: v1.TriggerConditionEqOpEq, Values: c.Values,
				}))
			}
		}
		settings.Conditions = v1.NewOptNilTriggerSettingsConditionsItemArray(items)
	}
	return settings
}

func toScheduleSettings(processConfigurationID string, recurringStep int, recurringUnit, crontab string, startsAtMillis int64) v1.ScheduleSettings {
	settings := v1.ScheduleSettings{
		ProcessConfigurationID: processConfigurationID,
		StartsAt:               v1.NewInt64ScheduleSettingsStartsAt(startsAtMillis),
	}
	if crontab != "" {
		settings.Crontab = v1.NewOptString(crontab)
	} else {
		settings.RecurringStep = v1.NewOptInt(recurringStep)
		settings.RecurringUnit = v1.NewOptScheduleSettingsRecurringUnit(v1.ScheduleSettingsRecurringUnit(recurringUnit))
	}
	return settings
}

func toTriggerInfo(item *v1.CommonServiceItem) *TriggerInfo {
	settings, _ := item.Settings.GetTriggerSettings()
	types, _ := settings.Types.Get()
	var conditions []TriggerConditionInfo
	if items, ok := settings.Conditions.Get(); ok {
		conditions = make([]TriggerConditionInfo, 0, len(items))
		for _, c := range items {
			if eq, ok := c.GetTriggerConditionEq(); ok {
				conditions = append(conditions, TriggerConditionInfo{Key: eq.Key, Op: string(eq.Op), Values: eq.Values})
			} else if in, ok := c.GetTriggerConditionIn(); ok {
				conditions = append(conditions, TriggerConditionInfo{Key: in.Key, Op: string(in.Op), Values: in.Values})
			}
		}
	}
	return &TriggerInfo{
		ID:                     item.ID,
		Name:                   item.Name,
		Description:            item.Description.Or(""),
		Source:                 settings.Source,
		Types:                  types,
		Conditions:             conditions,
		ProcessConfigurationID: settings.ProcessConfigurationID,
		Tags:                   item.Tags,
		CreatedAt:              item.CreatedAt.Format(timeFormat),
		ModifiedAt:             item.ModifiedAt.Format(timeFormat),
	}
}

func toScheduleInfo(item *v1.CommonServiceItem) *ScheduleInfo {
	settings, _ := item.Settings.GetScheduleSettings()
	return &ScheduleInfo{
		ID:                     item.ID,
		Name:                   item.Name,
		Description:            item.Description.Or(""),
		ProcessConfigurationID: settings.ProcessConfigurationID,
		RecurringStep:          settings.RecurringStep.Or(0),
		RecurringUnit:          string(settings.RecurringUnit.Or("")),
		Crontab:                settings.Crontab.Or(""),
		StartsAt:               startsAtString(settings.StartsAt),
		Tags:                   item.Tags,
		CreatedAt:              item.CreatedAt.Format(timeFormat),
		ModifiedAt:             item.ModifiedAt.Format(timeFormat),
	}
}

func toProcessConfigurationInfo(item *v1.CommonServiceItem) *ProcessConfigurationInfo {
	settings, _ := item.Settings.GetProcessConfigurationSettings()
	return &ProcessConfigurationInfo{
		ID:          item.ID,
		Name:        item.Name,
		Description: item.Description.Or(""),
		Destination: string(settings.Destination),
		Parameters:  settings.Parameters,
		Tags:        item.Tags,
		CreatedAt:   item.CreatedAt.Format(timeFormat),
		ModifiedAt:  item.ModifiedAt.Format(timeFormat),
	}
}

func startsAtString(s v1.ScheduleSettingsStartsAt) string {
	if v, ok := s.GetInt64(); ok {
		return strconv.FormatInt(v, 10)
	}
	if v, ok := s.GetString(); ok {
		return v
	}
	return ""
}
