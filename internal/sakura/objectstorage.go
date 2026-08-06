package sakura

import (
	"bufio"
	"compress/gzip"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	objectstorage "github.com/sacloud/sacloud-sdk-go/api/object-storage"
	"github.com/sacloud/sacloud-sdk-go/common/saclient"
)

type ObjectStorageService struct {
	token  string
	secret string
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
	return &ObjectStorageService{
		token:  token,
		secret: secret,
	}
}

// saclientAPI builds a fresh saclient.Client authenticated with this
// service's Sakura Cloud API token/secret via the SAKURA_ACCESS_TOKEN{,_SECRET}
// environment convention (the only credential path reachable from outside
// the sacloud-sdk-go module, since the compat option types are internal).
func (s *ObjectStorageService) saclientAPI() (saclient.ClientAPI, error) {
	var sc saclient.Client
	if err := sc.SetEnviron([]string{
		"SAKURA_ACCESS_TOKEN=" + s.token,
		"SAKURA_ACCESS_TOKEN_SECRET=" + s.secret,
	}); err != nil {
		return nil, err
	}
	return &sc, nil
}

func (s *ObjectStorageService) fedClient() (*objectstorage.FedClient, error) {
	sc, err := s.saclientAPI()
	if err != nil {
		return nil, err
	}
	return objectstorage.NewFedClient(sc)
}

func (s *ObjectStorageService) siteClient(siteID string) (*objectstorage.SiteClient, error) {
	sc, err := s.saclientAPI()
	if err != nil {
		return nil, err
	}
	return objectstorage.NewSiteClient(sc, siteID)
}

func (s *ObjectStorageService) ListSites(ctx context.Context) ([]SiteInfo, error) {
	fedClient, err := s.fedClient()
	if err != nil {
		return nil, err
	}
	siteOp := objectstorage.NewSiteOp(fedClient)
	sites, err := siteOp.List(ctx)
	if err != nil {
		return nil, err
	}

	result := make([]SiteInfo, 0, len(sites))
	for _, site := range sites {
		result = append(result, SiteInfo{
			ID:          site.ID.Or(""),
			DisplayName: site.DisplayNameJa.Or(""),
			Endpoint:    site.S3Endpoint.Or(""),
		})
	}
	return result, nil
}

func (s *ObjectStorageService) ListAccessKeys(ctx context.Context, siteID string) ([]AccessKeyInfo, error) {
	siteClient, err := s.siteClient(siteID)
	if err != nil {
		return nil, err
	}
	accountOp := objectstorage.NewAccountOp(siteClient)
	keys, err := accountOp.ListAccessKeys(ctx)
	if err != nil {
		return nil, err
	}

	result := make([]AccessKeyInfo, 0, len(keys))
	for _, key := range keys {
		createdAt := ""
		if v, ok := key.CreatedAt.Get(); ok {
			t := time.Time(v)
			if !t.IsZero() {
				createdAt = t.Format(time.RFC3339)
			}
		}
		result = append(result, AccessKeyInfo{
			ID:        string(key.ID.Or("")),
			SiteID:    siteID,
			CreatedAt: createdAt,
		})
	}
	return result, nil
}

// ListBuckets requires Object Storage access key (not API token)
// accessKey and secretKey are Object Storage specific credentials
func (s *ObjectStorageService) ListBuckets(ctx context.Context, siteID, accessKey, secretKey string) ([]BucketInfo, error) {
	fedClient, err := s.fedClient()
	if err != nil {
		return nil, err
	}
	siteOp := objectstorage.NewSiteOp(fedClient)
	site, err := siteOp.Read(ctx, siteID)
	if err != nil {
		return nil, err
	}

	endpoint := site.S3Endpoint.Or("")
	if !strings.HasPrefix(endpoint, "https://") && !strings.HasPrefix(endpoint, "http://") {
		endpoint = "https://" + endpoint
	}

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

	output, err := client.ListBuckets(ctx, &s3.ListBucketsInput{})
	if err != nil {
		return nil, err
	}

	result := make([]BucketInfo, 0, len(output.Buckets))
	for _, bucket := range output.Buckets {
		creationDate := ""
		if bucket.CreationDate != nil {
			creationDate = bucket.CreationDate.Format("2006-01-02T15:04:05Z07:00")
		}
		result = append(result, BucketInfo{
			Name:         aws.ToString(bucket.Name),
			SiteID:       siteID,
			CreationDate: creationDate,
		})
	}
	return result, nil
}

// ListObjects lists objects in a bucket using S3 API
func ListObjects(ctx context.Context, endpoint, accessKey, secretKey, bucketName, prefix, continuationToken string, maxKeys int32) (*ListObjectsResult, error) {
	// Ensure endpoint has https:// prefix
	if !strings.HasPrefix(endpoint, "https://") && !strings.HasPrefix(endpoint, "http://") {
		endpoint = "https://" + endpoint
	}

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

// DownloadObject downloads an object from S3 and saves it to the specified path
func DownloadObject(ctx context.Context, endpoint, accessKey, secretKey, bucketName, key, savePath string) error {
	// Ensure endpoint has https:// prefix
	if !strings.HasPrefix(endpoint, "https://") && !strings.HasPrefix(endpoint, "http://") {
		endpoint = "https://" + endpoint
	}

	cfg := aws.Config{
		Region: "jp-north-1",
		Credentials: credentials.NewStaticCredentialsProvider(
			accessKey,
			secretKey,
			"",
		),
	}

	client := s3.NewFromConfig(cfg, func(o *s3.Options) {
		o.BaseEndpoint = aws.String(endpoint)
		o.UsePathStyle = true
	})

	output, err := client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(bucketName),
		Key:    aws.String(key),
	})
	if err != nil {
		return err
	}
	defer func() { _ = output.Body.Close() }()

	// Create the file
	file, err := os.Create(savePath)
	if err != nil {
		return err
	}
	defer func() { _ = file.Close() }()

	// Copy the data
	_, err = io.Copy(file, output.Body)
	return err
}

// PreviewResult represents the result of previewing a file
type PreviewResult struct {
	Lines     []json.RawMessage `json:"lines"`
	TotalRead int               `json:"totalRead"`
	Truncated bool              `json:"truncated"`
	Error     string            `json:"error,omitempty"`
}

// TextPreviewResult represents the result of previewing a text file
type TextPreviewResult struct {
	Content   string `json:"content"`
	TotalSize int64  `json:"totalSize"`
	ReadSize  int64  `json:"readSize"`
	Truncated bool   `json:"truncated"`
	Error     string `json:"error,omitempty"`
}

// PreviewGzipJSONL downloads and previews a gzipped JSONL file
// maxLines: maximum number of lines to return
func PreviewGzipJSONL(ctx context.Context, endpoint, accessKey, secretKey, bucketName, key string, maxLines int) (*PreviewResult, error) {
	// Ensure endpoint has https:// prefix
	if !strings.HasPrefix(endpoint, "https://") && !strings.HasPrefix(endpoint, "http://") {
		endpoint = "https://" + endpoint
	}

	cfg := aws.Config{
		Region: "jp-north-1",
		Credentials: credentials.NewStaticCredentialsProvider(
			accessKey,
			secretKey,
			"",
		),
	}

	client := s3.NewFromConfig(cfg, func(o *s3.Options) {
		o.BaseEndpoint = aws.String(endpoint)
		o.UsePathStyle = true
	})

	// Build GetObject input
	getInput := &s3.GetObjectInput{
		Bucket: aws.String(bucketName),
		Key:    aws.String(key),
	}

	output, err := client.GetObject(ctx, getInput)
	if err != nil {
		return nil, err
	}
	defer func() { _ = output.Body.Close() }()

	// Create gzip reader
	gzReader, err := gzip.NewReader(output.Body)
	if err != nil {
		return &PreviewResult{
			Error: "failed to create gzip reader: " + err.Error(),
		}, nil
	}
	defer func() { _ = gzReader.Close() }()

	// Read lines
	scanner := bufio.NewScanner(gzReader)
	// Increase buffer size for potentially long JSON lines
	scanner.Buffer(make([]byte, 1024*1024), 10*1024*1024)

	result := &PreviewResult{
		Lines: make([]json.RawMessage, 0, maxLines),
	}

	lineCount := 0
	for scanner.Scan() {
		if lineCount >= maxLines {
			result.Truncated = true
			break
		}

		line := scanner.Bytes()
		// Validate it's valid JSON
		if json.Valid(line) {
			// Make a copy since scanner reuses the buffer
			lineCopy := make([]byte, len(line))
			copy(lineCopy, line)
			result.Lines = append(result.Lines, json.RawMessage(lineCopy))
		}
		lineCount++
		result.TotalRead = lineCount
	}

	if err := scanner.Err(); err != nil {
		// If we got some lines, still return them with the error
		if len(result.Lines) > 0 {
			result.Error = "partial read: " + err.Error()
			result.Truncated = true
		} else {
			return nil, err
		}
	}

	return result, nil
}

// PreviewText downloads and previews a plain text file
// maxBytes: maximum number of bytes to read (default 1MB if 0)
func PreviewText(ctx context.Context, endpoint, accessKey, secretKey, bucketName, key string, maxBytes int64) (*TextPreviewResult, error) {
	if maxBytes <= 0 {
		maxBytes = 1024 * 1024 // 1MB default
	}

	// Ensure endpoint has https:// prefix
	if !strings.HasPrefix(endpoint, "https://") && !strings.HasPrefix(endpoint, "http://") {
		endpoint = "https://" + endpoint
	}

	cfg := aws.Config{
		Region: "jp-north-1",
		Credentials: credentials.NewStaticCredentialsProvider(
			accessKey,
			secretKey,
			"",
		),
	}

	client := s3.NewFromConfig(cfg, func(o *s3.Options) {
		o.BaseEndpoint = aws.String(endpoint)
		o.UsePathStyle = true
	})

	// First, get object metadata to know total size
	headOutput, err := client.HeadObject(ctx, &s3.HeadObjectInput{
		Bucket: aws.String(bucketName),
		Key:    aws.String(key),
	})
	if err != nil {
		return nil, err
	}

	totalSize := aws.ToInt64(headOutput.ContentLength)

	// Build GetObject input with range if file is larger than maxBytes
	getInput := &s3.GetObjectInput{
		Bucket: aws.String(bucketName),
		Key:    aws.String(key),
	}

	truncated := false
	if totalSize > maxBytes {
		// Only read first maxBytes
		getInput.Range = aws.String(fmt.Sprintf("bytes=0-%d", maxBytes-1))
		truncated = true
	}

	output, err := client.GetObject(ctx, getInput)
	if err != nil {
		return nil, err
	}
	defer func() { _ = output.Body.Close() }()

	// Read content
	content, err := io.ReadAll(io.LimitReader(output.Body, maxBytes))
	if err != nil {
		return &TextPreviewResult{
			Error:     "failed to read content: " + err.Error(),
			TotalSize: totalSize,
		}, nil
	}

	return &TextPreviewResult{
		Content:   string(content),
		TotalSize: totalSize,
		ReadSize:  int64(len(content)),
		Truncated: truncated,
	}, nil
}
