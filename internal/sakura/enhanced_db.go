package sakura

import (
	"context"

	"github.com/sacloud/sacloud-sdk-go/api/iaas"
	"github.com/sacloud/sacloud-sdk-go/api/iaas/types"
)

type EnhancedDBInfo struct {
	ID           string   `json:"id"`
	Name         string   `json:"name"`
	Description  string   `json:"description"`
	Tags         []string `json:"tags"`
	DatabaseName string   `json:"databaseName"`
	DatabaseType string   `json:"databaseType"`
	Region       string   `json:"region"`
	HostName     string   `json:"hostName"`
	Port         int      `json:"port"`
	CreatedAt    string   `json:"createdAt"`
}

type EnhancedDBService struct {
	client *Client
}

func NewEnhancedDBService(client *Client) *EnhancedDBService {
	return &EnhancedDBService{client: client}
}

func (s *EnhancedDBService) List(ctx context.Context) ([]EnhancedDBInfo, error) {
	op := iaas.NewEnhancedDBOp(s.client.Caller())
	result, err := op.Find(ctx, &iaas.FindCondition{})
	if err != nil {
		return nil, err
	}

	dbs := make([]EnhancedDBInfo, 0, len(result.EnhancedDBs))
	for _, db := range result.EnhancedDBs {
		dbs = append(dbs, *toEnhancedDBInfo(db))
	}
	return dbs, nil
}

func (s *EnhancedDBService) Get(ctx context.Context, id string) (*EnhancedDBInfo, error) {
	op := iaas.NewEnhancedDBOp(s.client.Caller())
	db, err := op.Read(ctx, types.StringID(id))
	if err != nil {
		return nil, err
	}
	return toEnhancedDBInfo(db), nil
}

func (s *EnhancedDBService) Delete(ctx context.Context, id string) error {
	op := iaas.NewEnhancedDBOp(s.client.Caller())
	return op.Delete(ctx, types.StringID(id))
}

// Create はエンハンスドDBを新規作成する。databaseTypeは"tidb"または"mariadb"。
func (s *EnhancedDBService) Create(ctx context.Context, name, description string, tags []string, databaseName, databaseType, region string) (*EnhancedDBInfo, error) {
	op := iaas.NewEnhancedDBOp(s.client.Caller())
	db, err := op.Create(ctx, &iaas.EnhancedDBCreateRequest{
		Name:         name,
		Description:  description,
		Tags:         tags,
		DatabaseName: databaseName,
		DatabaseType: types.EnhancedDBType(databaseType),
		Region:       types.EnhancedDBRegion(region),
	})
	if err != nil {
		return nil, err
	}
	return toEnhancedDBInfo(db), nil
}

// Update は名前・説明・タグを更新する。SettingsHashによる楽観ロックが必要なため事前Readする。
func (s *EnhancedDBService) Update(ctx context.Context, id, name, description string, tags []string) (*EnhancedDBInfo, error) {
	op := iaas.NewEnhancedDBOp(s.client.Caller())
	current, err := op.Read(ctx, types.StringID(id))
	if err != nil {
		return nil, err
	}
	db, err := op.Update(ctx, types.StringID(id), &iaas.EnhancedDBUpdateRequest{
		Name:         name,
		Description:  description,
		Tags:         tags,
		SettingsHash: current.SettingsHash,
	})
	if err != nil {
		return nil, err
	}
	return toEnhancedDBInfo(db), nil
}

// SetPassword は管理パスワードを再設定する。
func (s *EnhancedDBService) SetPassword(ctx context.Context, id, password string) error {
	op := iaas.NewEnhancedDBOp(s.client.Caller())
	return op.SetPassword(ctx, types.StringID(id), &iaas.EnhancedDBSetPasswordRequest{
		Password: password,
	})
}

func toEnhancedDBInfo(db *iaas.EnhancedDB) *EnhancedDBInfo {
	return &EnhancedDBInfo{
		ID:           db.ID.String(),
		Name:         db.Name,
		Description:  db.Description,
		Tags:         db.Tags,
		DatabaseName: db.DatabaseName,
		DatabaseType: string(db.DatabaseType),
		Region:       string(db.Region),
		HostName:     db.HostName,
		Port:         db.Port,
		CreatedAt:    db.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
}
