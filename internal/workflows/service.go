package workflows

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	sdkworkflows "github.com/sacloud/sacloud-sdk-go/api/workflows"
	v1 "github.com/sacloud/sacloud-sdk-go/api/workflows/apis/v1"
	"github.com/sacloud/sacloud-sdk-go/common/saclient"
)

const timeFormat = "2006-01-02T15:04:05Z07:00"

// WorkflowInfo ワークフロー情報
type WorkflowInfo struct {
	ID                 string   `json:"id"`
	Name               string   `json:"name"`
	Description        string   `json:"description"`
	Runbook            string   `json:"runbook"`
	Publish            bool     `json:"publish"`
	Logging            bool     `json:"logging"`
	ConcurrencyMode    string   `json:"concurrencyMode"`
	ServicePrincipalID string   `json:"servicePrincipalId"`
	Tags               []string `json:"tags"`
	CreatedAt          string   `json:"createdAt"`
	UpdatedAt          string   `json:"updatedAt"`
}

// RevisionInfo ワークフローリビジョン情報
type RevisionInfo struct {
	RevisionID    int    `json:"revisionId"`
	WorkflowID    string `json:"workflowId"`
	RevisionAlias string `json:"revisionAlias"`
	Runbook       string `json:"runbook"`
	CreatedAt     string `json:"createdAt"`
	UpdatedAt     string `json:"updatedAt"`
}

// ExecutionInfo ワークフロー実行情報
type ExecutionInfo struct {
	ExecutionID   string `json:"executionId"`
	Name          string `json:"name"`
	WorkflowID    string `json:"workflowId"`
	Status        string `json:"status"`
	Revision      int    `json:"revision"`
	RevisionAlias string `json:"revisionAlias"`
	Args          string `json:"args"`
	StepCount     int    `json:"stepCount"`
	Result        string `json:"result"`
	Error         string `json:"error"`
	CreatedAt     string `json:"createdAt"`
	UpdatedAt     string `json:"updatedAt"`
	RunAt         string `json:"runAt"`
	FailedAt      string `json:"failedAt"`
	SucceededAt   string `json:"succeededAt"`
	CanceledAt    string `json:"canceledAt"`
}

// ExecutionHistoryInfo 実行履歴(ステップ単位のイベント)情報
type ExecutionHistoryInfo struct {
	JobID      string `json:"jobId"`
	ThreadID   string `json:"threadId"`
	Type       string `json:"type"`
	CreatedAt  string `json:"createdAt"`
	Meta       string `json:"meta"`
	StackTrace string `json:"stackTrace"`
	Variables  string `json:"variables"`
}

// PlanInfo サブスクリプションプラン情報
type PlanInfo struct {
	ID                  int    `json:"id"`
	Name                string `json:"name"`
	Grade               int    `json:"grade"`
	ServiceClassPath    string `json:"serviceClassPath"`
	BasePrice           int    `json:"basePrice"`
	IncludedSteps       int    `json:"includedSteps"`
	OverageStepUnit     int    `json:"overageStepUnit"`
	OveragePricePerUnit int    `json:"overagePricePerUnit"`
}

// SubscriptionInfo サブスクリプション契約状況
type SubscriptionInfo struct {
	Subscribed   bool   `json:"subscribed"`
	PlanID       int    `json:"planId"`
	PlanName     string `json:"planName"`
	ActivateFrom string `json:"activateFrom"`
}

// Service workflows API サービス
type Service struct {
	workflowOp     sdkworkflows.WorkflowAPI
	executionOp    sdkworkflows.ExecutionAPI
	revisionOp     sdkworkflows.RevisionAPI
	subscriptionOp sdkworkflows.SubscriptionAPI
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
		return nil, fmt.Errorf("failed to configure workflows client: %w", err)
	}

	client, err := sdkworkflows.NewClient(&sc)
	if err != nil {
		return nil, fmt.Errorf("failed to create workflows client: %w", err)
	}

	return &Service{
		workflowOp:     sdkworkflows.NewWorkflowOp(client),
		executionOp:    sdkworkflows.NewExecutionOp(client),
		revisionOp:     sdkworkflows.NewRevisionOp(client),
		subscriptionOp: sdkworkflows.NewSubscriptionOp(client),
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

// ListWorkflows ワークフロー一覧を取得
func (s *Service) ListWorkflows(ctx context.Context) ([]WorkflowInfo, error) {
	resp, err := s.workflowOp.List(ctx, v1.ListWorkflowParams{})
	if err != nil {
		return nil, err
	}
	result := make([]WorkflowInfo, 0, len(resp.Workflows))
	for _, w := range resp.Workflows {
		concurrencyMode, _ := w.ConcurrencyMode.Get()
		servicePrincipalID, _ := w.ServicePrincipalId.Get()
		result = append(result, WorkflowInfo{
			ID:                 w.ID,
			Name:               w.Name,
			Description:        w.Description.Or(""),
			Publish:            w.Publish,
			Logging:            w.Logging,
			ConcurrencyMode:    string(concurrencyMode),
			ServicePrincipalID: servicePrincipalID.String,
			Tags:               listWorkflowTagNames(w.Tags),
			CreatedAt:          w.CreatedAt.Format(timeFormat),
			UpdatedAt:          w.UpdatedAt.Format(timeFormat),
		})
	}
	return result, nil
}

// GetWorkflow ワークフローの詳細を取得
func (s *Service) GetWorkflow(ctx context.Context, id string) (*WorkflowInfo, error) {
	w, err := s.workflowOp.Read(ctx, id)
	if err != nil {
		return nil, err
	}
	concurrencyMode, _ := w.ConcurrencyMode.Get()
	servicePrincipalID, _ := w.ServicePrincipalId.Get()
	return &WorkflowInfo{
		ID:                 w.ID,
		Name:               w.Name,
		Description:        w.Description.Or(""),
		Publish:            w.Publish,
		Logging:            w.Logging,
		ConcurrencyMode:    string(concurrencyMode),
		ServicePrincipalID: servicePrincipalID.String,
		Tags:               tagNames(w.Tags),
		CreatedAt:          w.CreatedAt.Format(timeFormat),
		UpdatedAt:          w.UpdatedAt.Format(timeFormat),
	}, nil
}

// CreateWorkflow ワークフローを新規作成する。concurrencyModeは"parallel"/"lock"/"queue"のいずれか(空文字はAPI既定値)
func (s *Service) CreateWorkflow(ctx context.Context, name, description, runbook string, publish, logging bool, concurrencyMode string, tags []string) (*WorkflowInfo, error) {
	req := v1.CreateWorkflowReq{
		Name:    name,
		Runbook: runbook,
		Publish: publish,
		Logging: logging,
		Tags:    toCreateWorkflowReqTags(tags),
	}
	if description != "" {
		req.Description = v1.NewOptString(description)
	}
	if concurrencyMode != "" {
		req.ConcurrencyMode = v1.NewOptCreateWorkflowReqConcurrencyMode(v1.CreateWorkflowReqConcurrencyMode(concurrencyMode))
	}
	created, err := s.workflowOp.Create(ctx, req)
	if err != nil {
		return nil, err
	}
	return s.GetWorkflow(ctx, created.ID)
}

// UpdateWorkflow ワークフローの基本情報を更新する
func (s *Service) UpdateWorkflow(ctx context.Context, id, name, description string, publish, logging bool, concurrencyMode string, tags []string) (*WorkflowInfo, error) {
	req := v1.UpdateWorkflowReq{
		Name:        v1.NewOptString(name),
		Description: v1.NewOptString(description),
		Publish:     v1.NewOptBool(publish),
		Logging:     v1.NewOptBool(logging),
		Tags:        toUpdateWorkflowReqTags(tags),
	}
	if concurrencyMode != "" {
		req.ConcurrencyMode = v1.NewOptUpdateWorkflowReqConcurrencyMode(v1.UpdateWorkflowReqConcurrencyMode(concurrencyMode))
	}
	if _, err := s.workflowOp.Update(ctx, id, req); err != nil {
		return nil, err
	}
	return s.GetWorkflow(ctx, id)
}

// DeleteWorkflow ワークフローを削除
func (s *Service) DeleteWorkflow(ctx context.Context, id string) error {
	return s.workflowOp.Delete(ctx, id)
}

// ListRevisions リビジョン一覧を取得
func (s *Service) ListRevisions(ctx context.Context, workflowID string) ([]RevisionInfo, error) {
	resp, err := s.revisionOp.List(ctx, v1.ListWorkflowRevisionsParams{ID: workflowID})
	if err != nil {
		return nil, err
	}
	result := make([]RevisionInfo, 0, len(resp.Revisions))
	for _, r := range resp.Revisions {
		result = append(result, RevisionInfo{
			RevisionID:    r.RevisionId,
			WorkflowID:    r.WorkflowId,
			RevisionAlias: r.RevisionAlias.Or(""),
			Runbook:       r.Runbook,
			CreatedAt:     r.CreatedAt.Format(timeFormat),
			UpdatedAt:     r.UpdatedAt.Format(timeFormat),
		})
	}
	return result, nil
}

// CreateRevision 新規リビジョンを作成する
func (s *Service) CreateRevision(ctx context.Context, workflowID, runbook, revisionAlias string) (*RevisionInfo, error) {
	req := v1.CreateWorkflowRevisionReq{Runbook: runbook}
	if revisionAlias != "" {
		req.RevisionAlias = v1.NewOptString(revisionAlias)
	}
	r, err := s.revisionOp.Create(ctx, workflowID, req)
	if err != nil {
		return nil, err
	}
	return &RevisionInfo{
		RevisionID:    r.RevisionId,
		WorkflowID:    r.WorkflowId,
		RevisionAlias: r.RevisionAlias.Or(""),
		Runbook:       r.Runbook,
		CreatedAt:     r.CreatedAt.Format(timeFormat),
		UpdatedAt:     r.UpdatedAt.Format(timeFormat),
	}, nil
}

// UpdateRevisionAlias リビジョンのAliasを更新する
func (s *Service) UpdateRevisionAlias(ctx context.Context, workflowID string, revisionNumber int, revisionAlias string) (*RevisionInfo, error) {
	r, err := s.revisionOp.UpdateAlias(ctx, workflowID, revisionNumber, v1.UpdateWorkflowRevisionAliasReq{RevisionAlias: revisionAlias})
	if err != nil {
		return nil, err
	}
	return &RevisionInfo{
		RevisionID:    r.RevisionId,
		WorkflowID:    r.WorkflowId,
		RevisionAlias: r.RevisionAlias.Or(""),
		Runbook:       r.Runbook,
		CreatedAt:     r.CreatedAt.Format(timeFormat),
		UpdatedAt:     r.UpdatedAt.Format(timeFormat),
	}, nil
}

// DeleteRevisionAlias リビジョンのAliasを削除する
func (s *Service) DeleteRevisionAlias(ctx context.Context, workflowID string, revisionNumber int) error {
	return s.revisionOp.DeleteAlias(ctx, workflowID, revisionNumber)
}

// ListExecutions 実行一覧を取得
func (s *Service) ListExecutions(ctx context.Context, workflowID string) ([]ExecutionInfo, error) {
	resp, err := s.executionOp.List(ctx, v1.ListExecutionParams{ID: workflowID})
	if err != nil {
		return nil, err
	}
	result := make([]ExecutionInfo, 0, len(resp.Executions))
	for _, e := range resp.Executions {
		result = append(result, ExecutionInfo{
			ExecutionID:   e.ExecutionId,
			Name:          e.Name,
			WorkflowID:    e.Workflow.ID,
			Status:        string(e.Status),
			Revision:      e.Revision,
			RevisionAlias: e.RevisionAlias,
			Args:          e.Args,
			StepCount:     e.StepCount,
			Result:        e.Result,
			Error:         e.Error,
			CreatedAt:     e.CreatedAt.Format(timeFormat),
			UpdatedAt:     e.UpdatedAt.Format(timeFormat),
			RunAt:         formatOptDateTime(e.RunAt),
			FailedAt:      formatOptDateTime(e.FailedAt),
			SucceededAt:   formatOptDateTime(e.SucceededAt),
			CanceledAt:    formatOptDateTime(e.CanceledAt),
		})
	}
	return result, nil
}

// GetExecution 実行の詳細を取得
func (s *Service) GetExecution(ctx context.Context, workflowID, executionID string) (*ExecutionInfo, error) {
	e, err := s.executionOp.Read(ctx, workflowID, executionID)
	if err != nil {
		return nil, err
	}
	return &ExecutionInfo{
		ExecutionID:   e.ExecutionId,
		Name:          e.Name,
		WorkflowID:    e.Workflow.ID,
		Status:        string(e.Status),
		Revision:      e.Revision,
		RevisionAlias: e.RevisionAlias,
		Args:          e.Args,
		StepCount:     e.StepCount,
		Result:        e.Result,
		Error:         e.Error,
		CreatedAt:     e.CreatedAt.Format(timeFormat),
		UpdatedAt:     e.UpdatedAt.Format(timeFormat),
		RunAt:         formatOptDateTime(e.RunAt),
		FailedAt:      formatOptDateTime(e.FailedAt),
		SucceededAt:   formatOptDateTime(e.SucceededAt),
		CanceledAt:    formatOptDateTime(e.CanceledAt),
	}, nil
}

// CreateExecution ワークフローの実行を作成する。revisionNumberが0の場合はRevisionIdを指定しない(revisionAliasまたはAPI既定の最新リビジョンが使われる)
func (s *Service) CreateExecution(ctx context.Context, workflowID string, revisionNumber int, revisionAlias, args, name string) (*ExecutionInfo, error) {
	req := v1.CreateExecutionReq{}
	if revisionNumber > 0 {
		req.RevisionId = v1.NewOptInt(revisionNumber)
	}
	if revisionAlias != "" {
		req.RevisionAlias = v1.NewOptString(revisionAlias)
	}
	if args != "" {
		req.Args = v1.NewOptString(args)
	}
	if name != "" {
		req.Name = v1.NewOptString(name)
	}
	created, err := s.executionOp.Create(ctx, workflowID, v1.OptCreateExecutionReq{Set: true, Value: req})
	if err != nil {
		return nil, err
	}
	return s.GetExecution(ctx, workflowID, created.ExecutionId)
}

// CancelExecution 実行のキャンセルを要求する
func (s *Service) CancelExecution(ctx context.Context, workflowID, executionID string) (*ExecutionInfo, error) {
	if _, err := s.executionOp.Cancel(ctx, workflowID, executionID); err != nil {
		return nil, err
	}
	return s.GetExecution(ctx, workflowID, executionID)
}

// DeleteExecution 実行記録を削除
func (s *Service) DeleteExecution(ctx context.Context, workflowID, executionID string) error {
	return s.executionOp.Delete(ctx, workflowID, executionID)
}

// ListExecutionHistory 実行のステップ単位イベント履歴を取得
func (s *Service) ListExecutionHistory(ctx context.Context, workflowID, executionID string) ([]ExecutionHistoryInfo, error) {
	resp, err := s.executionOp.ListHistory(ctx, v1.ListExecutionHistoryParams{ID: workflowID, ExecutionId: executionID})
	if err != nil {
		return nil, err
	}
	result := make([]ExecutionHistoryInfo, 0, len(resp.Histories))
	for _, h := range resp.Histories {
		result = append(result, ExecutionHistoryInfo{
			JobID:      h.JobId,
			ThreadID:   h.ThreadId,
			Type:       string(h.Type),
			CreatedAt:  h.CreatedAt.Format(timeFormat),
			Meta:       h.Meta,
			StackTrace: h.StackTrace,
			Variables:  h.Variables,
		})
	}
	return result, nil
}

// ListPlans サブスクリプションプラン一覧を取得
func (s *Service) ListPlans(ctx context.Context) ([]PlanInfo, error) {
	resp, err := s.subscriptionOp.ListPlans(ctx)
	if err != nil {
		return nil, err
	}
	result := make([]PlanInfo, 0, len(resp.Plans))
	for _, p := range resp.Plans {
		result = append(result, PlanInfo{
			ID:                  p.ID,
			Name:                p.Name,
			Grade:               p.Grade,
			ServiceClassPath:    p.ServiceClassPath,
			BasePrice:           p.BasePrice,
			IncludedSteps:       p.IncludedSteps,
			OverageStepUnit:     p.OverageStepUnit,
			OveragePricePerUnit: p.OveragePricePerUnit,
		})
	}
	return result, nil
}

// GetSubscription サブスクリプションの契約状況を取得
func (s *Service) GetSubscription(ctx context.Context) (*SubscriptionInfo, error) {
	resp, err := s.subscriptionOp.Read(ctx)
	if err != nil {
		// 未契約時、sakumockはOpenAPI仕様上non-nullableな"MonthAppliedPlan"にnullを
		// 返すためSDKのデコードに失敗する(docs/upstream-issues.md参照)。この場合は
		// CurrentPlanも常にnullで未契約状態であることが確定しているため、そのまま
		// 未契約として扱う
		if strings.Contains(err.Error(), "MonthAppliedPlan") {
			return &SubscriptionInfo{Subscribed: false}, nil
		}
		return nil, err
	}
	current, ok := resp.CurrentPlan.Get()
	if !ok {
		return &SubscriptionInfo{Subscribed: false}, nil
	}
	return &SubscriptionInfo{
		Subscribed:   true,
		PlanID:       current.PlanId,
		PlanName:     current.PlanName,
		ActivateFrom: current.ActivateFrom.Format(timeFormat),
	}, nil
}

// CreateSubscription プランを契約する
func (s *Service) CreateSubscription(ctx context.Context, planID int) error {
	return s.subscriptionOp.Create(ctx, v1.CreateSubscriptionReq{PlanId: planID})
}

// DeleteSubscription 契約を解約する
func (s *Service) DeleteSubscription(ctx context.Context) error {
	return s.subscriptionOp.Delete(ctx)
}

func tagNames(tags []v1.GetWorkflowOKWorkflowTagsItem) []string {
	result := make([]string, 0, len(tags))
	for _, t := range tags {
		result = append(result, t.Name)
	}
	return result
}

func listWorkflowTagNames(tags []v1.ListWorkflowOKWorkflowsItemTagsItem) []string {
	result := make([]string, 0, len(tags))
	for _, t := range tags {
		result = append(result, t.Name)
	}
	return result
}

func toCreateWorkflowReqTags(tags []string) []v1.CreateWorkflowReqTagsItem {
	result := make([]v1.CreateWorkflowReqTagsItem, 0, len(tags))
	for _, t := range tags {
		result = append(result, v1.CreateWorkflowReqTagsItem{Name: t})
	}
	return result
}

func toUpdateWorkflowReqTags(tags []string) []v1.UpdateWorkflowReqTagsItem {
	result := make([]v1.UpdateWorkflowReqTagsItem, 0, len(tags))
	for _, t := range tags {
		result = append(result, v1.UpdateWorkflowReqTagsItem{Name: t})
	}
	return result
}

func formatOptDateTime(t v1.OptDateTime) string {
	v, ok := t.Get()
	if !ok {
		return ""
	}
	return v.Format(timeFormat)
}
