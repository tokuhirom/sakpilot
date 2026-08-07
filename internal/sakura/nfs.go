package sakura

import (
	"context"

	"github.com/sacloud/sacloud-sdk-go/api/iaas"
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
		nfsList = append(nfsList, NFSInfo{
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
		})
	}
	return nfsList, nil
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
