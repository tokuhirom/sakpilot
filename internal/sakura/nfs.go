package sakura

import (
	"context"
	"fmt"

	"github.com/sacloud/sacloud-sdk-go/api/iaas"
	"github.com/sacloud/sacloud-sdk-go/api/iaas/helper/query"
	"github.com/sacloud/sacloud-sdk-go/api/iaas/types"
)

type NFSInfo struct {
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
	SwitchName     string   `json:"switchName"`
}

type NFSService struct {
	client *Client
}

func NewNFSService(client *Client) *NFSService {
	return &NFSService{client: client}
}

func (s *NFSService) List(ctx context.Context, zone string) ([]NFSInfo, error) {
	nfsOp := iaas.NewNFSOp(s.client.Caller())
	result, err := nfsOp.Find(ctx, zone, &iaas.FindCondition{})
	if err != nil {
		return nil, err
	}

	nfsList := make([]NFSInfo, 0, len(result.NFS))
	for _, n := range result.NFS {
		nfsList = append(nfsList, *nfsFromSDK(zone, n))
	}
	return nfsList, nil
}

func (s *NFSService) Get(ctx context.Context, zone string, nfsID string) (*NFSInfo, error) {
	nfsOp := iaas.NewNFSOp(s.client.Caller())
	n, err := nfsOp.Read(ctx, zone, types.StringID(nfsID))
	if err != nil {
		return nil, err
	}
	return nfsFromSDK(zone, n), nil
}

// NFSCreateParams はNFS作成時のパラメータ。PlanClass は "hdd"/"ssd"(types.NFSPlanStrings参照)、
// SizeGB は選択したPlanClassで利用可能なサイズ(HDD: 100/500/1024/2048/4096/8192/12288、SSD: 20/100/500/1024/2048/4096)。
type NFSCreateParams struct {
	Name           string
	Description    string
	Tags           []string
	SwitchID       string
	IPAddress      string
	NetworkMaskLen int
	DefaultRoute   string
	PlanClass      string
	SizeGB         int
}

func (s *NFSService) Create(ctx context.Context, zone string, params NFSCreateParams) (*NFSInfo, error) {
	diskPlanID, ok := types.NFSPlanIDMap[params.PlanClass]
	if !ok {
		return nil, fmt.Errorf("invalid NFS plan class: %s", params.PlanClass)
	}

	noteOp := iaas.NewNoteOp(s.client.Caller())
	planID, err := query.FindNFSPlanID(ctx, noteOp, zone, diskPlanID, types.ENFSSize(params.SizeGB))
	if err != nil {
		return nil, err
	}
	if planID.IsEmpty() {
		return nil, fmt.Errorf("NFS plan not found for class=%s size=%dGB", params.PlanClass, params.SizeGB)
	}

	nfsOp := iaas.NewNFSOp(s.client.Caller())
	n, err := nfsOp.Create(ctx, zone, &iaas.NFSCreateRequest{
		SwitchID:       types.StringID(params.SwitchID),
		PlanID:         planID,
		IPAddresses:    []string{params.IPAddress},
		NetworkMaskLen: params.NetworkMaskLen,
		DefaultRoute:   params.DefaultRoute,
		Name:           params.Name,
		Description:    params.Description,
		Tags:           params.Tags,
	})
	if err != nil {
		return nil, err
	}
	return nfsFromSDK(zone, n), nil
}

func (s *NFSService) Update(ctx context.Context, zone string, nfsID string, name string, description string, tags []string) (*NFSInfo, error) {
	nfsOp := iaas.NewNFSOp(s.client.Caller())
	n, err := nfsOp.Update(ctx, zone, types.StringID(nfsID), &iaas.NFSUpdateRequest{
		Name:        name,
		Description: description,
		Tags:        tags,
	})
	if err != nil {
		return nil, err
	}
	return nfsFromSDK(zone, n), nil
}

func (s *NFSService) PowerOn(ctx context.Context, zone string, nfsID string) error {
	nfsOp := iaas.NewNFSOp(s.client.Caller())
	id := types.StringID(nfsID)
	return nfsOp.Boot(ctx, zone, id)
}

func (s *NFSService) PowerOff(ctx context.Context, zone string, nfsID string) error {
	nfsOp := iaas.NewNFSOp(s.client.Caller())
	id := types.StringID(nfsID)
	return nfsOp.Shutdown(ctx, zone, id, &iaas.ShutdownOption{Force: false})
}

func (s *NFSService) ForceStop(ctx context.Context, zone string, nfsID string) error {
	nfsOp := iaas.NewNFSOp(s.client.Caller())
	id := types.StringID(nfsID)
	return nfsOp.Shutdown(ctx, zone, id, &iaas.ShutdownOption{Force: true})
}

func (s *NFSService) Reset(ctx context.Context, zone string, nfsID string) error {
	nfsOp := iaas.NewNFSOp(s.client.Caller())
	id := types.StringID(nfsID)
	return nfsOp.Reset(ctx, zone, id)
}

func (s *NFSService) Delete(ctx context.Context, zone string, nfsID string) error {
	nfsOp := iaas.NewNFSOp(s.client.Caller())
	id := types.StringID(nfsID)
	return nfsOp.Delete(ctx, zone, id)
}

func (s *NFSService) GetStatus(ctx context.Context, zone string, nfsID string) (string, error) {
	nfsOp := iaas.NewNFSOp(s.client.Caller())
	id := types.StringID(nfsID)
	n, err := nfsOp.Read(ctx, zone, id)
	if err != nil {
		return "", err
	}
	return string(n.InstanceStatus), nil
}

func nfsFromSDK(zone string, n *iaas.NFS) *NFSInfo {
	return &NFSInfo{
		ID:             n.ID.String(),
		Name:           n.Name,
		Description:    n.Description,
		Zone:           zone,
		Status:         string(n.InstanceStatus),
		IPAddresses:    n.IPAddresses,
		Tags:           n.Tags,
		CreatedAt:      n.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		PlanID:         n.PlanID.String(),
		DefaultRoute:   n.DefaultRoute,
		NetworkMaskLen: n.NetworkMaskLen,
		SwitchName:     n.SwitchName,
	}
}
