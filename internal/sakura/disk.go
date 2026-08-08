package sakura

import (
	"context"
	"time"

	"github.com/sacloud/sacloud-sdk-go/api/iaas"
	"github.com/sacloud/sacloud-sdk-go/api/iaas/types"
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
		disks = append(disks, *diskFromSDK(zone, d))
	}
	return disks, nil
}

func (s *DiskService) Delete(ctx context.Context, zone string, diskID string) error {
	diskOp := iaas.NewDiskOp(s.client.Caller())
	return diskOp.Delete(ctx, zone, types.StringID(diskID))
}

func (s *DiskService) Get(ctx context.Context, zone string, diskID string) (*DiskInfo, error) {
	diskOp := iaas.NewDiskOp(s.client.Caller())
	d, err := diskOp.Read(ctx, zone, types.StringID(diskID))
	if err != nil {
		return nil, err
	}
	return diskFromSDK(zone, d), nil
}

// Create はディスクを作成する。diskPlan は "ssd"/"hdd"、connection は "virtio"/"ide"。
// sourceArchiveID/serverID は未指定なら空文字を渡す。
func (s *DiskService) Create(ctx context.Context, zone string, name string, description string, tags []string, sizeGB int, diskPlan string, connection string, sourceArchiveID string, serverID string) (*DiskInfo, error) {
	diskOp := iaas.NewDiskOp(s.client.Caller())
	req := &iaas.DiskCreateRequest{
		Name:        name,
		Description: description,
		Tags:        tags,
		SizeMB:      sizeGB * 1024,
		DiskPlanID:  types.DiskPlanIDMap[diskPlan],
		Connection:  types.DiskConnectionMap[connection],
	}
	if sourceArchiveID != "" {
		req.SourceArchiveID = types.StringID(sourceArchiveID)
	}
	if serverID != "" {
		req.ServerID = types.StringID(serverID)
	}

	d, err := diskOp.Create(ctx, zone, req, nil, types.ID(0))
	if err != nil {
		return nil, err
	}
	return diskFromSDK(zone, d), nil
}

func (s *DiskService) Update(ctx context.Context, zone string, diskID string, name string, description string, tags []string) (*DiskInfo, error) {
	diskOp := iaas.NewDiskOp(s.client.Caller())
	d, err := diskOp.Update(ctx, zone, types.StringID(diskID), &iaas.DiskUpdateRequest{
		Name:        name,
		Description: description,
		Tags:        tags,
	})
	if err != nil {
		return nil, err
	}
	return diskFromSDK(zone, d), nil
}

func (s *DiskService) ConnectToServer(ctx context.Context, zone string, diskID string, serverID string) error {
	diskOp := iaas.NewDiskOp(s.client.Caller())
	return diskOp.ConnectToServer(ctx, zone, types.StringID(diskID), types.StringID(serverID))
}

func (s *DiskService) DisconnectFromServer(ctx context.Context, zone string, diskID string) error {
	diskOp := iaas.NewDiskOp(s.client.Caller())
	return diskOp.DisconnectFromServer(ctx, zone, types.StringID(diskID))
}

func diskFromSDK(zone string, d *iaas.Disk) *DiskInfo {
	return &DiskInfo{
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
	}
}
