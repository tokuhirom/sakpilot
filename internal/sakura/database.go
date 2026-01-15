package sakura

import (
	"context"

	"github.com/sacloud/iaas-api-go"
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
