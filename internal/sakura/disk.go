package sakura

import (
	"context"
	"time"

	"github.com/sacloud/iaas-api-go"
)

type DiskInfo struct {
	ID           string   `json:"id"`
	Name         string   `json:"name"`
	Description  string   `json:"description"`
	Zone         string   `json:"zone"`
	SizeGB       int      `json:"sizeGb"`
	DiskPlanName string   `json:"diskPlanName"`
	Connection   string   `json:"connection"`
	ServerID     string   `json:"serverId"`
	ServerName   string   `json:"serverName"`
	Tags         []string `json:"tags"`
	CreatedAt    string   `json:"createdAt"`
}

type DiskService struct {
	client *Client
}

func NewDiskService(client *Client) *DiskService {
	return &DiskService{client: client}
}

func (s *DiskService) List(ctx context.Context, zone string) ([]DiskInfo, error) {
	diskOp := iaas.NewDiskOp(s.client.Caller())
	result, err := diskOp.Find(ctx, zone, &iaas.FindCondition{})
	if err != nil {
		return nil, err
	}

	disks := make([]DiskInfo, 0, len(result.Disks))
	for _, d := range result.Disks {
		disks = append(disks, DiskInfo{
			ID:           d.ID.String(),
			Name:         d.Name,
			Description:  d.Description,
			Zone:         zone,
			SizeGB:       d.SizeMB / 1024,
			DiskPlanName: d.DiskPlanName,
			Connection:   string(d.Connection),
			ServerID:     d.ServerID.String(),
			ServerName:   d.ServerName,
			Tags:         d.Tags,
			CreatedAt:    d.CreatedAt.Format(time.RFC3339),
		})
	}
	return disks, nil
}
