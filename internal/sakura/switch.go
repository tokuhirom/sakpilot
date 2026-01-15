package sakura

import (
	"context"

	"github.com/sacloud/iaas-api-go"
	"github.com/sacloud/iaas-api-go/types"
)

type SwitchInfo struct {
	ID             string            `json:"id"`
	Name           string            `json:"name"`
	Description    string            `json:"description"`
	ServerCount    int               `json:"serverCount"`
	NetworkMaskLen int               `json:"networkMaskLen"`
	DefaultRoute   string            `json:"defaultRoute"`
	Scope          string            `json:"scope"`
	Subnets        []SwitchSubnetInfo `json:"subnets,omitempty"`
}

type SwitchSubnetInfo struct {
	ID             string `json:"id"`
	NetworkAddress string `json:"networkAddress"`
	NetworkMaskLen int    `json:"networkMaskLen"`
	DefaultRoute   string `json:"defaultRoute"`
	NextHop        string `json:"nextHop"`
	StaticRoute    string `json:"staticRoute"`
}

type SwitchService struct {
	client *Client
}

func NewSwitchService(client *Client) *SwitchService {
	return &SwitchService{client: client}
}

func (s *SwitchService) List(ctx context.Context, zone string) ([]SwitchInfo, error) {
	swOp := iaas.NewSwitchOp(s.client.Caller())
	result, err := swOp.Find(ctx, zone, &iaas.FindCondition{})
	if err != nil {
		return nil, err
	}

	list := make([]SwitchInfo, 0, len(result.Switches))
	for _, sw := range result.Switches {
		list = append(list, SwitchInfo{
			ID:             sw.ID.String(),
			Name:           sw.Name,
			Description:    sw.Description,
			ServerCount:    sw.ServerCount,
			NetworkMaskLen: sw.NetworkMaskLen,
			DefaultRoute:   sw.DefaultRoute,
			Scope:          string(sw.Scope),
		})
	}
	return list, nil
}

func (s *SwitchService) Get(ctx context.Context, zone string, id string) (*SwitchInfo, error) {
	swOp := iaas.NewSwitchOp(s.client.Caller())
	sw, err := swOp.Read(ctx, zone, types.StringID(id))
	if err != nil {
		return nil, err
	}

	subnets := make([]SwitchSubnetInfo, 0, len(sw.Subnets))
	for _, subnet := range sw.Subnets {
		subnets = append(subnets, SwitchSubnetInfo{
			ID:             subnet.ID.String(),
			NetworkAddress: subnet.NetworkAddress,
			NetworkMaskLen: subnet.NetworkMaskLen,
			DefaultRoute:   subnet.DefaultRoute,
			NextHop:        subnet.NextHop,
			StaticRoute:    subnet.StaticRoute,
		})
	}

	return &SwitchInfo{
		ID:             sw.ID.String(),
		Name:           sw.Name,
		Description:    sw.Description,
		ServerCount:    sw.ServerCount,
		NetworkMaskLen: sw.NetworkMaskLen,
		DefaultRoute:   sw.DefaultRoute,
		Scope:          string(sw.Scope),
		Subnets:        subnets,
	}, nil
}
