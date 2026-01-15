package sakura

import (
	"context"
	"time"

	objectstorage "github.com/sacloud/object-storage-api-go"
	ossbucket "github.com/sacloud/object-storage-service-go/bucket"
)

type ObjectStorageService struct {
	client     *objectstorage.Client
	ossClient  *objectstorage.Client
}

type SiteInfo struct {
	ID          string `json:"id"`
	DisplayName string `json:"displayName"`
	Endpoint    string `json:"endpoint"`
}

type BucketInfo struct {
	Name         string `json:"name"`
	SiteID       string `json:"siteId"`
	CreationDate string `json:"creationDate"`
}

type AccessKeyInfo struct {
	ID        string `json:"id"`
	SiteID    string `json:"siteId"`
	CreatedAt string `json:"createdAt"`
}

func NewObjectStorageService(c *Client) *ObjectStorageService {
	token, secret := c.Credentials()
	osClient := &objectstorage.Client{
		Token:  token,
		Secret: secret,
	}
	return &ObjectStorageService{
		client:    osClient,
		ossClient: osClient,
	}
}

func (s *ObjectStorageService) ListSites(ctx context.Context) ([]SiteInfo, error) {
	siteOp := objectstorage.NewSiteOp(s.client)
	sites, err := siteOp.List(ctx)
	if err != nil {
		return nil, err
	}

	result := make([]SiteInfo, 0, len(sites))
	for _, site := range sites {
		result = append(result, SiteInfo{
			ID:          site.Id,
			DisplayName: site.DisplayNameJa,
			Endpoint:    site.S3Endpoint,
		})
	}
	return result, nil
}

func (s *ObjectStorageService) ListAccessKeys(ctx context.Context, siteID string) ([]AccessKeyInfo, error) {
	accountOp := objectstorage.NewAccountOp(s.client)
	keys, err := accountOp.ListAccessKeys(ctx, siteID)
	if err != nil {
		return nil, err
	}

	result := make([]AccessKeyInfo, 0, len(keys))
	for _, key := range keys {
		createdAt := ""
		t := time.Time(key.CreatedAt)
		if !t.IsZero() {
			createdAt = t.Format(time.RFC3339)
		}
		result = append(result, AccessKeyInfo{
			ID:        string(key.Id),
			SiteID:    siteID,
			CreatedAt: createdAt,
		})
	}
	return result, nil
}

// ListBuckets requires Object Storage access key (not API token)
// accessKey and secretKey are Object Storage specific credentials
func (s *ObjectStorageService) ListBuckets(ctx context.Context, siteID, accessKey, secretKey string) ([]BucketInfo, error) {
	bucketSvc := ossbucket.New(s.ossClient)
	req := &ossbucket.FindRequest{
		SiteId:    siteID,
		AccessKey: accessKey,
		SecretKey: secretKey,
	}
	buckets, err := bucketSvc.FindWithContext(ctx, req)
	if err != nil {
		return nil, err
	}

	result := make([]BucketInfo, 0, len(buckets))
	for _, bucket := range buckets {
		creationDate := ""
		if bucket.CreationDate != nil {
			creationDate = bucket.CreationDate.Format("2006-01-02T15:04:05Z07:00")
		}
		result = append(result, BucketInfo{
			Name:         bucket.Name,
			SiteID:       siteID,
			CreationDate: creationDate,
		})
	}
	return result, nil
}
