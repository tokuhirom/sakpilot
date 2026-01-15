package sakura

import (
	"context"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
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

type ObjectInfo struct {
	Key          string `json:"key"`
	Size         int64  `json:"size"`
	LastModified string `json:"lastModified"`
	StorageClass string `json:"storageClass"`
}

type ListObjectsResult struct {
	Objects      []ObjectInfo `json:"objects"`
	Prefixes     []string     `json:"prefixes"`
	IsTruncated  bool         `json:"isTruncated"`
	NextToken    string       `json:"nextToken"`
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

// ListObjects lists objects in a bucket using S3 API
func ListObjects(ctx context.Context, endpoint, accessKey, secretKey, bucketName, prefix, continuationToken string, maxKeys int32) (*ListObjectsResult, error) {
	// Create S3 client with custom endpoint
	cfg := aws.Config{
		Region: "jp-north-1", // Sakura Cloud region (doesn't really matter for object storage)
		Credentials: credentials.NewStaticCredentialsProvider(
			accessKey,
			secretKey,
			"",
		),
	}

	client := s3.NewFromConfig(cfg, func(o *s3.Options) {
		o.BaseEndpoint = aws.String(endpoint)
		o.UsePathStyle = true // Required for S3-compatible services
	})

	input := &s3.ListObjectsV2Input{
		Bucket:    aws.String(bucketName),
		Delimiter: aws.String("/"),
	}
	if prefix != "" {
		input.Prefix = aws.String(prefix)
	}
	if continuationToken != "" {
		input.ContinuationToken = aws.String(continuationToken)
	}
	if maxKeys > 0 {
		input.MaxKeys = aws.Int32(maxKeys)
	}

	output, err := client.ListObjectsV2(ctx, input)
	if err != nil {
		return nil, err
	}

	objects := make([]ObjectInfo, 0, len(output.Contents))
	for _, obj := range output.Contents {
		lastModified := ""
		if obj.LastModified != nil {
			lastModified = obj.LastModified.Format(time.RFC3339)
		}
		storageClass := ""
		if obj.StorageClass != "" {
			storageClass = string(obj.StorageClass)
		}
		objects = append(objects, ObjectInfo{
			Key:          aws.ToString(obj.Key),
			Size:         aws.ToInt64(obj.Size),
			LastModified: lastModified,
			StorageClass: storageClass,
		})
	}

	prefixes := make([]string, 0, len(output.CommonPrefixes))
	for _, p := range output.CommonPrefixes {
		prefixes = append(prefixes, aws.ToString(p.Prefix))
	}

	nextToken := ""
	if output.NextContinuationToken != nil {
		nextToken = *output.NextContinuationToken
	}

	return &ListObjectsResult{
		Objects:     objects,
		Prefixes:    prefixes,
		IsTruncated: aws.ToBool(output.IsTruncated),
		NextToken:   nextToken,
	}, nil
}
