package sakura

import (
	"context"

	"github.com/sacloud/sacloud-sdk-go/api/iaas"
)

type CDROMInfo struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	SizeGB      int    `json:"sizeGb"`
}

type CDROMService struct {
	client *Client
}

func NewCDROMService(client *Client) *CDROMService {
	return &CDROMService{client: client}
}

// List はゾーン内で利用可能なCD-ROM(ISOイメージ)の一覧を返す。
func (s *CDROMService) List(ctx context.Context, zone string) ([]CDROMInfo, error) {
	cdromOp := iaas.NewCDROMOp(s.client.Caller())
	result, err := cdromOp.Find(ctx, zone, &iaas.FindCondition{})
	if err != nil {
		return nil, err
	}

	cdroms := make([]CDROMInfo, 0, len(result.CDROMs))
	for _, c := range result.CDROMs {
		cdroms = append(cdroms, CDROMInfo{
			ID:          c.ID.String(),
			Name:        c.Name,
			Description: c.Description,
			SizeGB:      c.SizeMB / 1024,
		})
	}
	return cdroms, nil
}
