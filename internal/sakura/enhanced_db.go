package sakura

import (
	"context"

	"github.com/sacloud/iaas-api-go"
)

type EnhancedDBInfo struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Description  string `json:"description"`
	Tags         []string `json:"tags"`
	DatabaseName string `json:"databaseName"`
	DatabaseType string `json:"databaseType"`
	Region       string `json:"region"`
	HostName     string `json:"hostName"`
	Port         int    `json:"port"`
	CreatedAt    string `json:"createdAt"`
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
		dbs = append(dbs, EnhancedDBInfo{
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
		})
	}
	return dbs, nil
}
