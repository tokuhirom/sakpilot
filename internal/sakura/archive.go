package sakura

import (
	"context"
	"time"

	"github.com/sacloud/iaas-api-go"
	"github.com/sacloud/iaas-api-go/types"
)

type ArchiveInfo struct {
	ID           string   `json:"id"`
	Name         string   `json:"name"`
	Description  string   `json:"description"`
	SizeGB       int      `json:"sizeGb"`
	Scope        string   `json:"scope"`
	Availability string   `json:"availability"`
	Tags         []string `json:"tags"`
	CreatedAt    string   `json:"createdAt"`
}

type ArchiveService struct {
	client *Client
}

func NewArchiveService(client *Client) *ArchiveService {
	return &ArchiveService{client: client}
}

func (s *ArchiveService) List(ctx context.Context, zone string) ([]ArchiveInfo, error) {
	archiveOp := iaas.NewArchiveOp(s.client.Caller())
	result, err := archiveOp.Find(ctx, zone, &iaas.FindCondition{})
	if err != nil {
		return nil, err
	}

	archives := make([]ArchiveInfo, 0)
	for _, a := range result.Archives {
		// ユーザースコープのアーカイブのみ表示（パブリックアーカイブは除外）
		if a.Scope != types.Scopes.User {
			continue
		}
		archives = append(archives, ArchiveInfo{
			ID:           a.ID.String(),
			Name:         a.Name,
			Description:  a.Description,
			SizeGB:       a.SizeMB / 1024,
			Scope:        string(a.Scope),
			Availability: string(a.Availability),
			Tags:         a.Tags,
			CreatedAt:    a.CreatedAt.Format(time.RFC3339),
		})
	}
	return archives, nil
}
