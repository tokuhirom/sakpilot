package sakura

import (
	"context"

	"github.com/sacloud/sacloud-sdk-go/api/iaas"
	"github.com/sacloud/sacloud-sdk-go/api/iaas/types"
)

type DatabaseInfo struct {
	ID             string   `json:"id"`
	Name           string   `json:"name"`
	Description    string   `json:"description"`
	Zone           string   `json:"zone"`
	Status         string   `json:"status"`
	IPAddresses    []string `json:"ipAddresses"`
	Tags           []string `json:"tags"`
	CreatedAt      string   `json:"createdAt"`
	PlanID         string   `json:"planId"`
	DefaultRoute   string   `json:"defaultRoute"`
	NetworkMaskLen int      `json:"networkMaskLen"`
}

type DatabaseService struct {
	client *Client
}

func NewDatabaseService(client *Client) *DatabaseService {
	return &DatabaseService{client: client}
}

func (s *DatabaseService) List(ctx context.Context, zone string) ([]DatabaseInfo, error) {
	dbOp := iaas.NewDatabaseOp(s.client.Caller())
	result, err := dbOp.Find(ctx, zone, &iaas.FindCondition{})
	if err != nil {
		return nil, err
	}

	databases := make([]DatabaseInfo, 0, len(result.Databases))
	for _, db := range result.Databases {
		databases = append(databases, DatabaseInfo{
			ID:             db.ID.String(),
			Name:           db.Name,
			Description:    db.Description,
			Zone:           zone,
			Status:         string(db.InstanceStatus),
			IPAddresses:    db.IPAddresses,
			Tags:           db.Tags,
			CreatedAt:      db.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
			PlanID:         db.PlanID.String(),
			DefaultRoute:   db.DefaultRoute,
			NetworkMaskLen: db.NetworkMaskLen,
		})
	}
	return databases, nil
}

func (s *DatabaseService) PowerOn(ctx context.Context, zone string, databaseID string) error {
	dbOp := iaas.NewDatabaseOp(s.client.Caller())
	id := types.StringID(databaseID)
	return dbOp.Boot(ctx, zone, id)
}

func (s *DatabaseService) PowerOff(ctx context.Context, zone string, databaseID string) error {
	dbOp := iaas.NewDatabaseOp(s.client.Caller())
	id := types.StringID(databaseID)
	return dbOp.Shutdown(ctx, zone, id, &iaas.ShutdownOption{Force: false})
}

func (s *DatabaseService) ForceStop(ctx context.Context, zone string, databaseID string) error {
	dbOp := iaas.NewDatabaseOp(s.client.Caller())
	id := types.StringID(databaseID)
	return dbOp.Shutdown(ctx, zone, id, &iaas.ShutdownOption{Force: true})
}

func (s *DatabaseService) Reset(ctx context.Context, zone string, databaseID string) error {
	dbOp := iaas.NewDatabaseOp(s.client.Caller())
	id := types.StringID(databaseID)
	return dbOp.Reset(ctx, zone, id)
}

func (s *DatabaseService) Delete(ctx context.Context, zone string, databaseID string) error {
	dbOp := iaas.NewDatabaseOp(s.client.Caller())
	id := types.StringID(databaseID)
	return dbOp.Delete(ctx, zone, id)
}

func (s *DatabaseService) GetStatus(ctx context.Context, zone string, databaseID string) (string, error) {
	dbOp := iaas.NewDatabaseOp(s.client.Caller())
	id := types.StringID(databaseID)
	db, err := dbOp.Read(ctx, zone, id)
	if err != nil {
		return "", err
	}
	return string(db.InstanceStatus), nil
}
