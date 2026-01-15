package sakura

import (
	"context"

	"github.com/sacloud/iaas-api-go"
	"github.com/sacloud/iaas-api-go/types"
)

type PacketFilterInfo struct {
	ID          string                   `json:"id"`
	Name        string                   `json:"name"`
	Description string                   `json:"description"`
	Rules       []PacketFilterRuleInfo   `json:"rules,omitempty"`
}

type PacketFilterRuleInfo struct {
	Protocol        string `json:"protocol"`
	SourceNetwork   string `json:"sourceNetwork"`
	SourcePort      string `json:"sourcePort"`
	DestinationPort string `json:"destinationPort"`
	Action          string `json:"action"`
	Description     string `json:"description"`
}

type PacketFilterService struct {
	client *Client
}

func NewPacketFilterService(client *Client) *PacketFilterService {
	return &PacketFilterService{client: client}
}

func (s *PacketFilterService) List(ctx context.Context, zone string) ([]PacketFilterInfo, error) {
	pfOp := iaas.NewPacketFilterOp(s.client.Caller())
	result, err := pfOp.Find(ctx, zone, &iaas.FindCondition{})
	if err != nil {
		return nil, err
	}

	list := make([]PacketFilterInfo, 0, len(result.PacketFilters))
	for _, pf := range result.PacketFilters {
		list = append(list, PacketFilterInfo{
			ID:          pf.ID.String(),
			Name:        pf.Name,
			Description: pf.Description,
		})
	}
	return list, nil
}

func (s *PacketFilterService) Get(ctx context.Context, zone string, id string) (*PacketFilterInfo, error) {
	pfOp := iaas.NewPacketFilterOp(s.client.Caller())
	pf, err := pfOp.Read(ctx, zone, types.StringID(id))
	if err != nil {
		return nil, err
	}

	rules := make([]PacketFilterRuleInfo, 0, len(pf.Expression))
	for _, expr := range pf.Expression {
		rules = append(rules, PacketFilterRuleInfo{
			Protocol:        string(expr.Protocol),
			SourceNetwork:   string(expr.SourceNetwork),
			SourcePort:      string(expr.SourcePort),
			DestinationPort: string(expr.DestinationPort),
			Action:          string(expr.Action),
			Description:     expr.Description,
		})
	}

	return &PacketFilterInfo{
		ID:          pf.ID.String(),
		Name:        pf.Name,
		Description: pf.Description,
		Rules:       rules,
	}, nil
}
