package sakura

import (
	"bufio"
	"compress/gzip"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	objectstorage "github.com/sacloud/sacloud-sdk-go/api/object-storage"
	v2 "github.com/sacloud/sacloud-sdk-go/api/object-storage/apis/v2"
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

// AccessKeyCreated holds the result of creating an access key. Secret is only
// ever populated here - subsequent reads of the key always return an empty
// secret, so callers must persist it immediately (see keyring.go).
type AccessKeyCreated struct {
	ID        string `json:"id"`
	Secret    string `json:"secret"`
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

// AccountInfo describes the Object Storage account for a site.
type AccountInfo struct {
	SiteID    string `json:"siteId"`
	Code      string `json:"code"`
	CreatedAt string `json:"createdAt"`
}

// BucketControlInfo grants a permission read/write access to one bucket.
type BucketControlInfo struct {
	BucketName string `json:"bucketName"`
	CanRead    bool   `json:"canRead"`
	CanWrite   bool   `json:"canWrite"`
}

// PermissionInfo is a named set of per-bucket access controls that access
// keys can be issued against, independent of the account-level access keys.
type PermissionInfo struct {
	ID             string              `json:"id"`
	SiteID         string              `json:"siteId"`
	DisplayName    string              `json:"displayName"`
	BucketControls []BucketControlInfo `json:"bucketControls"`
	CreatedAt      string              `json:"createdAt"`
}

// PermissionAccessKeyInfo is an access key issued against a Permission.
type PermissionAccessKeyInfo struct {
	ID           string `json:"id"`
	PermissionID string `json:"permissionId"`
	SiteID       string `json:"siteId"`
	CreatedAt    string `json:"createdAt"`
}

// PermissionAccessKeyCreated holds the result of creating a permission access
// key. Secret is only ever populated here, same as AccessKeyCreated.
type PermissionAccessKeyCreated struct {
	ID        string `json:"id"`
	Secret    string `json:"secret"`
	CreatedAt string `json:"createdAt"`
}

// BucketEncryptionInfo describes a bucket's server-side encryption setting.
type BucketEncryptionInfo struct {
	Enabled      bool   `json:"enabled"`
	KMSKeyID     string `json:"kmsKeyId"`
	ConfiguredAt string `json:"configuredAt"`
}

// BucketReplicationInfo describes a bucket's cross-bucket replication setting.
type BucketReplicationInfo struct {
	Enabled        bool   `json:"enabled"`
	DestBucketName string `json:"destBucketName"`
	DestClusterID  string `json:"destClusterId"`
	ConfigStatus   string `json:"configStatus"`
	CreatedAt      string `json:"createdAt"`
}

// BucketQuotaInfo describes the quota applied to a bucket.
type BucketQuotaInfo struct {
	NumObjectsPerBucket int     `json:"numObjectsPerBucket"`
	AmountGibPerBucket  float32 `json:"amountGibPerBucket"`
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
	env := append(os.Environ(),
		"SAKURA_ACCESS_TOKEN="+s.token,
		"SAKURA_ACCESS_TOKEN_SECRET="+s.secret,
	)
	if err := sc.SetEnviron(env); err != nil {
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

// formatOptTime renders an optional v2.CreatedAt as RFC3339, or "" if unset/zero.
func formatOptTime(v v2.OptCreatedAt) string {
	t, ok := v.Get()
	if !ok {
		return ""
	}
	tt := time.Time(t)
	if tt.IsZero() {
		return ""
	}
	return tt.Format(time.RFC3339)
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

	// SAKURA_OBJECT_STORAGE_S3_ENDPOINT_OVERRIDEは、sakumockのdemo/E2E環境向けの
	// 開発用フックである。sakumockのcontrol planeは本番向けの固定S3エンドポイント
	// (s3.xxx.objectstorage.sakurastorage.jp)しか返さないため、ローカルのversitygw
	// (S3互換data plane)へ向けさせるにはこの上書きが必要になる(e2e_server.goのdemo経路
	// でのみ設定される。実運用のSakura Cloud API接続では未設定のため影響しない)。
	endpointOverride := os.Getenv("SAKURA_OBJECT_STORAGE_S3_ENDPOINT_OVERRIDE")

	result := make([]SiteInfo, 0, len(sites))
	for _, site := range sites {
		endpoint := site.S3Endpoint.Or("")
		if endpointOverride != "" {
			endpoint = endpointOverride
		}
		result = append(result, SiteInfo{
			ID:          site.ID.Or(""),
			DisplayName: site.DisplayNameJa.Or(""),
			Endpoint:    endpoint,
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
		result = append(result, AccessKeyInfo{
			ID:        string(key.ID.Or("")),
			SiteID:    siteID,
			CreatedAt: formatOptTime(key.CreatedAt),
		})
	}
	return result, nil
}

// CreateAccessKey creates a new Object Storage access key for the site's
// account, creating the account first if it doesn't exist yet.
func (s *ObjectStorageService) CreateAccessKey(ctx context.Context, siteID string) (*AccessKeyCreated, error) {
	siteClient, err := s.siteClient(siteID)
	if err != nil {
		return nil, err
	}
	accountOp := objectstorage.NewAccountOp(siteClient)

	if _, err := accountOp.Read(ctx); err != nil {
		// Account doesn't exist yet - create it. If this also fails, the
		// error surfaces below via CreateAccessKey instead.
		_, _ = accountOp.Create(ctx)
	}

	key, err := accountOp.CreateAccessKey(ctx)
	if err != nil {
		return nil, err
	}

	return &AccessKeyCreated{
		ID:        string(key.ID.Or("")),
		Secret:    string(key.Secret.Or("")),
		CreatedAt: formatOptTime(key.CreatedAt),
	}, nil
}

// DeleteAccessKey deletes an Object Storage access key.
func (s *ObjectStorageService) DeleteAccessKey(ctx context.Context, siteID, keyID string) error {
	siteClient, err := s.siteClient(siteID)
	if err != nil {
		return err
	}
	accountOp := objectstorage.NewAccountOp(siteClient)
	return accountOp.DeleteAccessKey(ctx, keyID)
}

// ReadAccount fetches the Object Storage account for the given site.
func (s *ObjectStorageService) ReadAccount(ctx context.Context, siteID string) (*AccountInfo, error) {
	siteClient, err := s.siteClient(siteID)
	if err != nil {
		return nil, err
	}
	accountOp := objectstorage.NewAccountOp(siteClient)
	account, err := accountOp.Read(ctx)
	if err != nil {
		return nil, err
	}
	return &AccountInfo{
		SiteID:    siteID,
		Code:      string(account.Code.Or("")),
		CreatedAt: formatOptTime(account.CreatedAt),
	}, nil
}

// DeleteAccount deletes the Object Storage account for the given site,
// along with its access keys. Buckets must be removed first.
func (s *ObjectStorageService) DeleteAccount(ctx context.Context, siteID string) error {
	siteClient, err := s.siteClient(siteID)
	if err != nil {
		return err
	}
	accountOp := objectstorage.NewAccountOp(siteClient)
	return accountOp.Delete(ctx)
}

// CreateBucket creates a new bucket on the given site. plan is only
// meaningful for the "arc02" archive site; pass an empty string otherwise.
func (s *ObjectStorageService) CreateBucket(ctx context.Context, siteID, bucketName, plan string) error {
	fedClient, err := s.fedClient()
	if err != nil {
		return err
	}
	siteClient, err := s.siteClient(siteID)
	if err != nil {
		return err
	}
	bucketOp := objectstorage.NewBucketOp(fedClient, siteClient)
	_, err = bucketOp.Create(ctx, &objectstorage.BucketCreateParams{
		Bucket: bucketName,
		SiteId: siteID,
		Plan:   plan,
	})
	return err
}

// DeleteBucket deletes a bucket on the given site.
func (s *ObjectStorageService) DeleteBucket(ctx context.Context, siteID, bucketName string) error {
	fedClient, err := s.fedClient()
	if err != nil {
		return err
	}
	siteClient, err := s.siteClient(siteID)
	if err != nil {
		return err
	}
	bucketOp := objectstorage.NewBucketOp(fedClient, siteClient)
	return bucketOp.Delete(ctx, bucketName)
}

func (s *ObjectStorageService) bucketExtraOp(siteID, bucketName string) (objectstorage.BucketExtraAPI, error) {
	fedClient, err := s.fedClient()
	if err != nil {
		return nil, err
	}
	siteClient, err := s.siteClient(siteID)
	if err != nil {
		return nil, err
	}
	return objectstorage.NewBucketExtraOp(siteClient, fedClient, bucketName), nil
}

// ReadBucketEncryption returns the bucket's encryption setting. If
// encryption has never been configured, it returns Enabled: false rather
// than an error.
func (s *ObjectStorageService) ReadBucketEncryption(ctx context.Context, siteID, bucketName string) (*BucketEncryptionInfo, error) {
	op, err := s.bucketExtraOp(siteID, bucketName)
	if err != nil {
		return nil, err
	}
	enc, err := op.ReadEncryption(ctx)
	if err != nil {
		if saclient.IsNotFoundError(err) {
			return &BucketEncryptionInfo{Enabled: false}, nil
		}
		return nil, err
	}
	return &BucketEncryptionInfo{
		Enabled:      true,
		KMSKeyID:     string(enc.KmsKeyID.Or("")),
		ConfiguredAt: formatOptTime(enc.ConfiguredAt),
	}, nil
}

// EnableBucketEncryption turns on server-side encryption for the bucket
// using the given KMS key.
func (s *ObjectStorageService) EnableBucketEncryption(ctx context.Context, siteID, bucketName, kmsKeyID string) error {
	op, err := s.bucketExtraOp(siteID, bucketName)
	if err != nil {
		return err
	}
	return op.EnableEncryption(ctx, kmsKeyID)
}

// DisableBucketEncryption turns off server-side encryption for the bucket.
func (s *ObjectStorageService) DisableBucketEncryption(ctx context.Context, siteID, bucketName string) error {
	op, err := s.bucketExtraOp(siteID, bucketName)
	if err != nil {
		return err
	}
	return op.DisableEncryption(ctx)
}

// ReadBucketReplication returns the bucket's replication setting. If
// replication has never been configured, it returns Enabled: false rather
// than an error.
func (s *ObjectStorageService) ReadBucketReplication(ctx context.Context, siteID, bucketName string) (*BucketReplicationInfo, error) {
	op, err := s.bucketExtraOp(siteID, bucketName)
	if err != nil {
		return nil, err
	}
	repl, err := op.ReadReplication(ctx)
	if err != nil {
		if saclient.IsNotFoundError(err) {
			return &BucketReplicationInfo{Enabled: false}, nil
		}
		return nil, err
	}
	return replicationInfo(repl), nil
}

// EnableBucketReplication turns on cross-bucket replication from this
// bucket to targetBucket.
func (s *ObjectStorageService) EnableBucketReplication(ctx context.Context, siteID, bucketName, targetBucket string) (*BucketReplicationInfo, error) {
	op, err := s.bucketExtraOp(siteID, bucketName)
	if err != nil {
		return nil, err
	}
	repl, err := op.EnableReplication(ctx, targetBucket)
	if err != nil {
		return nil, err
	}
	return replicationInfo(repl), nil
}

// DisableBucketReplication turns off replication for the bucket.
func (s *ObjectStorageService) DisableBucketReplication(ctx context.Context, siteID, bucketName string) error {
	op, err := s.bucketExtraOp(siteID, bucketName)
	if err != nil {
		return err
	}
	return op.DisableReplication(ctx)
}

func replicationInfo(repl *v2.ModelReplication) *BucketReplicationInfo {
	return &BucketReplicationInfo{
		Enabled:        true,
		DestBucketName: repl.DestBucket.Name.Or(""),
		DestClusterID:  repl.DestBucket.ClusterID.Or(""),
		ConfigStatus:   string(repl.ConfigStatus),
		CreatedAt:      repl.CreatedAt.Format(time.RFC3339),
	}
}

// ReadBucketQuota returns the quota applied to the bucket.
func (s *ObjectStorageService) ReadBucketQuota(ctx context.Context, siteID, bucketName string) (*BucketQuotaInfo, error) {
	op, err := s.bucketExtraOp(siteID, bucketName)
	if err != nil {
		return nil, err
	}
	quota, err := op.ReadQuota(ctx)
	if err != nil {
		return nil, err
	}
	return &BucketQuotaInfo{
		NumObjectsPerBucket: quota.NumObjectsPerBucket.Or(0),
		AmountGibPerBucket:  quota.AmountGibPerBucket.Or(0),
	}, nil
}

// permissionOp returns a PermissionsAPI client for the given site. This is a
// separate, permission-scoped access-key mechanism alongside the
// account-level access keys managed by ListAccessKeys/CreateAccessKey.
func (s *ObjectStorageService) permissionOp(siteID string) (objectstorage.PermissionsAPI, error) {
	siteClient, err := s.siteClient(siteID)
	if err != nil {
		return nil, err
	}
	return objectstorage.NewPermissionOp(siteClient), nil
}

func bucketControlsInfo(controls v2.BucketControls) []BucketControlInfo {
	result := make([]BucketControlInfo, 0, len(controls))
	for _, c := range controls {
		result = append(result, BucketControlInfo{
			BucketName: string(c.BucketName.Or("")),
			CanRead:    bool(c.CanRead.Or(false)),
			CanWrite:   bool(c.CanWrite.Or(false)),
		})
	}
	return result
}

func toBucketControls(controls []BucketControlInfo) v2.BucketControls {
	result := make(v2.BucketControls, 0, len(controls))
	for _, c := range controls {
		result = append(result, v2.BucketControlsItem{
			BucketName: v2.NewOptBucketName(v2.BucketName(c.BucketName)),
			CanRead:    v2.NewOptCanRead(v2.CanRead(c.CanRead)),
			CanWrite:   v2.NewOptCanWrite(v2.CanWrite(c.CanWrite)),
		})
	}
	return result
}

func permissionInfo(siteID string, p *v2.PermissionData) *PermissionInfo {
	return &PermissionInfo{
		ID:             strconv.FormatInt(int64(p.ID.Or(0)), 10),
		SiteID:         siteID,
		DisplayName:    string(p.DisplayName.Or("")),
		BucketControls: bucketControlsInfo(p.BucketControls),
		CreatedAt:      formatOptTime(p.CreatedAt),
	}
}

// ListPermissions lists the site's Permissions (named, reusable sets of
// per-bucket access controls that access keys can be issued against).
func (s *ObjectStorageService) ListPermissions(ctx context.Context, siteID string) ([]PermissionInfo, error) {
	op, err := s.permissionOp(siteID)
	if err != nil {
		return nil, err
	}
	items, err := op.List(ctx)
	if err != nil {
		return nil, err
	}
	result := make([]PermissionInfo, 0, len(items))
	for _, item := range items {
		result = append(result, PermissionInfo{
			ID:             strconv.FormatInt(int64(item.ID.Or(0)), 10),
			SiteID:         siteID,
			DisplayName:    string(item.DisplayName.Or("")),
			BucketControls: bucketControlsInfo(item.BucketControls),
			CreatedAt:      formatOptTime(item.CreatedAt),
		})
	}
	return result, nil
}

// CreatePermission creates a new Permission with the given per-bucket
// access controls.
func (s *ObjectStorageService) CreatePermission(ctx context.Context, siteID, displayName string, controls []BucketControlInfo) (*PermissionInfo, error) {
	op, err := s.permissionOp(siteID)
	if err != nil {
		return nil, err
	}
	p, err := op.Create(ctx, displayName, toBucketControls(controls))
	if err != nil {
		return nil, err
	}
	return permissionInfo(siteID, p), nil
}

// UpdatePermission replaces a Permission's display name and per-bucket
// access controls.
func (s *ObjectStorageService) UpdatePermission(ctx context.Context, siteID, permissionID, displayName string, controls []BucketControlInfo) (*PermissionInfo, error) {
	op, err := s.permissionOp(siteID)
	if err != nil {
		return nil, err
	}
	p, err := op.Update(ctx, permissionID, displayName, toBucketControls(controls))
	if err != nil {
		return nil, err
	}
	return permissionInfo(siteID, p), nil
}

// DeletePermission deletes a Permission, along with its access keys.
func (s *ObjectStorageService) DeletePermission(ctx context.Context, siteID, permissionID string) error {
	op, err := s.permissionOp(siteID)
	if err != nil {
		return err
	}
	return op.Delete(ctx, permissionID)
}

// ListPermissionAccessKeys lists the access keys issued against a Permission.
func (s *ObjectStorageService) ListPermissionAccessKeys(ctx context.Context, siteID, permissionID string) ([]PermissionAccessKeyInfo, error) {
	op, err := s.permissionOp(siteID)
	if err != nil {
		return nil, err
	}
	keys, err := op.ListAccessKeys(ctx, permissionID)
	if err != nil {
		return nil, err
	}
	result := make([]PermissionAccessKeyInfo, 0, len(keys))
	for _, key := range keys {
		result = append(result, PermissionAccessKeyInfo{
			ID:           string(key.ID.Or("")),
			PermissionID: permissionID,
			SiteID:       siteID,
			CreatedAt:    formatOptTime(key.CreatedAt),
		})
	}
	return result, nil
}

// CreatePermissionAccessKey issues a new access key scoped to a Permission.
func (s *ObjectStorageService) CreatePermissionAccessKey(ctx context.Context, siteID, permissionID string) (*PermissionAccessKeyCreated, error) {
	op, err := s.permissionOp(siteID)
	if err != nil {
		return nil, err
	}
	key, err := op.CreateAccessKey(ctx, permissionID)
	if err != nil {
		return nil, err
	}
	return &PermissionAccessKeyCreated{
		ID:        string(key.ID.Or("")),
		Secret:    string(key.Secret.Or("")),
		CreatedAt: formatOptTime(key.CreatedAt),
	}, nil
}

// DeletePermissionAccessKey deletes an access key issued against a Permission.
func (s *ObjectStorageService) DeletePermissionAccessKey(ctx context.Context, siteID, permissionID, accessKeyID string) error {
	op, err := s.permissionOp(siteID)
	if err != nil {
		return err
	}
	return op.DeleteAccessKey(ctx, permissionID, accessKeyID)
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

// newS3Client builds an S3 client for a Sakura Cloud Object Storage
// endpoint, which is path-style and doesn't care about the AWS region.
func newS3Client(endpoint, accessKey, secretKey string) *s3.Client {
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

	return s3.NewFromConfig(cfg, func(o *s3.Options) {
		o.BaseEndpoint = aws.String(endpoint)
		o.UsePathStyle = true // Required for S3-compatible services
	})
}

// ListObjects lists objects in a bucket using S3 API
func ListObjects(ctx context.Context, endpoint, accessKey, secretKey, bucketName, prefix, continuationToken string, maxKeys int32) (*ListObjectsResult, error) {
	client := newS3Client(endpoint, accessKey, secretKey)

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
	client := newS3Client(endpoint, accessKey, secretKey)

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

// UploadObject uploads a local file to a bucket using the S3 API.
func UploadObject(ctx context.Context, endpoint, accessKey, secretKey, bucketName, key, localPath string) error {
	client := newS3Client(endpoint, accessKey, secretKey)

	file, err := os.Open(localPath)
	if err != nil {
		return err
	}
	defer func() { _ = file.Close() }()

	_, err = client.PutObject(ctx, &s3.PutObjectInput{
		Bucket: aws.String(bucketName),
		Key:    aws.String(key),
		Body:   file,
	})
	return err
}

// DeleteObject deletes an object from a bucket using the S3 API.
func DeleteObject(ctx context.Context, endpoint, accessKey, secretKey, bucketName, key string) error {
	client := newS3Client(endpoint, accessKey, secretKey)

	_, err := client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(bucketName),
		Key:    aws.String(key),
	})
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
	client := newS3Client(endpoint, accessKey, secretKey)

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

	client := newS3Client(endpoint, accessKey, secretKey)

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
