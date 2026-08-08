package sakura

import (
	"context"
	"fmt"
	"time"

	"github.com/sacloud/sacloud-sdk-go/api/iaas"
	"github.com/sacloud/sacloud-sdk-go/api/iaas/types"
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
		archives = append(archives, *archiveInfoFromSDK(a))
	}
	return archives, nil
}

func (s *ArchiveService) Delete(ctx context.Context, zone string, archiveID string) error {
	archiveOp := iaas.NewArchiveOp(s.client.Caller())
	return archiveOp.Delete(ctx, zone, types.StringID(archiveID))
}

type FTPServerInfo struct {
	HostName  string `json:"hostName"`
	IPAddress string `json:"ipAddress"`
	User      string `json:"user"`
	Password  string `json:"password"`
}

func ftpServerInfoFromSDK(ftp *iaas.FTPServer) *FTPServerInfo {
	if ftp == nil {
		return nil
	}
	return &FTPServerInfo{
		HostName:  ftp.HostName,
		IPAddress: ftp.IPAddress,
		User:      ftp.User,
		Password:  ftp.Password,
	}
}

func archiveInfoFromSDK(a *iaas.Archive) *ArchiveInfo {
	return &ArchiveInfo{
		ID:           a.ID.String(),
		Name:         a.Name,
		Description:  a.Description,
		SizeGB:       a.SizeMB / 1024,
		Scope:        string(a.Scope),
		Availability: string(a.Availability),
		Tags:         a.Tags,
		CreatedAt:    a.CreatedAt.Format(time.RFC3339),
	}
}

// Create はディスクまたは既存アーカイブをコピー元としてアーカイブを作成する。
// sourceDiskID/sourceArchiveID はどちらか一方のみ指定する（両方空ならエラー）。
func (s *ArchiveService) Create(ctx context.Context, zone string, name string, description string, tags []string, sourceDiskID string, sourceArchiveID string) (*ArchiveInfo, error) {
	archiveOp := iaas.NewArchiveOp(s.client.Caller())
	req := &iaas.ArchiveCreateRequest{
		Name:        name,
		Description: description,
		Tags:        tags,
	}
	if sourceDiskID != "" {
		req.SourceDiskID = types.StringID(sourceDiskID)
	}
	if sourceArchiveID != "" {
		req.SourceArchiveID = types.StringID(sourceArchiveID)
	}

	a, err := archiveOp.Create(ctx, zone, req)
	if err != nil {
		return nil, err
	}
	return archiveInfoFromSDK(a), nil
}

type ArchiveWithFTP struct {
	Archive   ArchiveInfo   `json:"archive"`
	FTPServer FTPServerInfo `json:"ftpServer"`
}

// CreateBlank はコピー元を持たない空のアーカイブを作成し、アップロード用のFTP接続情報を返す。
func (s *ArchiveService) CreateBlank(ctx context.Context, zone string, name string, description string, tags []string, sizeGB int) (*ArchiveWithFTP, error) {
	archiveOp := iaas.NewArchiveOp(s.client.Caller())
	req := &iaas.ArchiveCreateBlankRequest{
		Name:        name,
		Description: description,
		Tags:        tags,
	}
	req.SetSizeGB(sizeGB)

	a, ftp, err := archiveOp.CreateBlank(ctx, zone, req)
	if err != nil {
		return nil, err
	}
	return &ArchiveWithFTP{Archive: *archiveInfoFromSDK(a), FTPServer: *ftpServerInfoFromSDK(ftp)}, nil
}

// OpenFTP はアーカイブへのFTPアップロードを開始し、接続情報を返す。
func (s *ArchiveService) OpenFTP(ctx context.Context, zone string, archiveID string, changePassword bool) (*FTPServerInfo, error) {
	archiveOp := iaas.NewArchiveOp(s.client.Caller())
	ftp, err := archiveOp.OpenFTP(ctx, zone, types.StringID(archiveID), &iaas.OpenFTPRequest{ChangePassword: changePassword})
	if err != nil {
		return nil, err
	}
	return ftpServerInfoFromSDK(ftp), nil
}

// CloseFTP はアーカイブへのFTPアップロードを終了する。
func (s *ArchiveService) CloseFTP(ctx context.Context, zone string, archiveID string) error {
	archiveOp := iaas.NewArchiveOp(s.client.Caller())
	return archiveOp.CloseFTP(ctx, zone, types.StringID(archiveID))
}

// Share はアーカイブを他ユーザーへ共有するための共有キーを発行する。
func (s *ArchiveService) Share(ctx context.Context, zone string, archiveID string) (string, error) {
	archiveOp := iaas.NewArchiveOp(s.client.Caller())
	info, err := archiveOp.Share(ctx, zone, types.StringID(archiveID))
	if err != nil {
		return "", err
	}
	return info.SharedKey.String(), nil
}

// CreateFromShared は他ユーザーから共有された共有キーを使い、指定ゾーンにアーカイブを複製する。
func (s *ArchiveService) CreateFromShared(ctx context.Context, destZone string, sharedKey string, name string, description string, tags []string) (*ArchiveInfo, error) {
	key := types.ArchiveShareKey(sharedKey)
	if !key.ValidFormat() {
		return nil, fmt.Errorf("共有キーの形式が不正です")
	}
	destZoneID, ok := types.ZoneIDs[destZone]
	if !ok {
		return nil, fmt.Errorf("不明なゾーンです: %s", destZone)
	}

	archiveOp := iaas.NewArchiveOp(s.client.Caller())
	a, err := archiveOp.CreateFromShared(ctx, key.Zone(), key.SourceArchiveID(), destZoneID, &iaas.ArchiveCreateRequestFromShared{
		Name:            name,
		Description:     description,
		Tags:            tags,
		SourceSharedKey: key,
	})
	if err != nil {
		return nil, err
	}
	return archiveInfoFromSDK(a), nil
}
