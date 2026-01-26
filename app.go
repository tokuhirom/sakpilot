package main

import (
	"context"
	"fmt"

	"sakpilot/internal/apprun"
	"sakpilot/internal/apprunshared"
	"sakpilot/internal/kms"
	"sakpilot/internal/sakura"

	"github.com/sacloud/iaas-api-go"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
	ctx context.Context
}

func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

func (a *App) GetZones() []sakura.ZoneInfo {
	return sakura.GetZones()
}

// Profile management
func (a *App) GetProfiles() ([]sakura.ProfileInfo, error) {
	return sakura.ListProfiles()
}

func (a *App) GetDefaultProfile() string {
	profiles, err := sakura.ListProfiles()
	if err != nil {
		return "default"
	}
	for _, p := range profiles {
		if p.IsCurrent {
			return p.Name
		}
	}
	if len(profiles) > 0 {
		return profiles[0].Name
	}
	return "default"
}

// CreateProfile creates a new profile with the given credentials
func (a *App) CreateProfile(name, accessToken, accessTokenSecret, zone string) error {
	return sakura.CreateProfile(name, accessToken, accessTokenSecret, zone)
}

// DeleteProfile deletes the profile with the given name
func (a *App) DeleteProfile(name string) error {
	return sakura.DeleteProfile(name)
}

// UpdateProfile updates an existing profile with the given credentials
// If newName is different from oldName, the profile will be renamed
func (a *App) UpdateProfile(oldName, newName, accessToken, accessTokenSecret, zone string) error {
	return sakura.UpdateProfile(oldName, newName, accessToken, accessTokenSecret, zone)
}

// GetProfileCredentials returns the credentials for the given profile
func (a *App) GetProfileCredentials(name string) (*sakura.ProfileCredentials, error) {
	return sakura.GetProfileCredentials(name)
}

// SetCurrentProfile sets the current profile name
func (a *App) SetCurrentProfile(name string) error {
	return sakura.SetCurrentProfile(name)
}

// ValidateCredentials validates the given credentials by making an API call
func (a *App) ValidateCredentials(accessToken, accessTokenSecret string) error {
	return sakura.ValidateCredentials(accessToken, accessTokenSecret)
}

func (a *App) GetDefaultZone(profileName string) string {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return "is1a"
	}
	return client.DefaultZone()
}

// AuthInfo represents the current authentication status
type AuthInfo struct {
	AccountID   string `json:"accountId"`
	AccountName string `json:"accountName"`
	MemberCode  string `json:"memberCode"`
}

// GetAuthInfo returns the current authentication info for debugging
func (a *App) GetAuthInfo(profileName string) (*AuthInfo, error) {
	fmt.Printf("Getting auth info for profile %s\n", profileName)
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	status, err := iaas.NewAuthStatusOp(client.Caller()).Read(a.ctx)
	if err != nil {
		return nil, err
	}
	fmt.Printf("Got auth status: ProfileName=%s, AccountID=%s, AccountName=%s, MemberCode=%s\n",
		profileName, status.AccountID.String(), status.AccountName, status.MemberCode)
	return &AuthInfo{
		AccountID:   status.AccountID.String(),
		AccountName: status.AccountName,
		MemberCode:  status.MemberCode,
	}, nil
}

// Zone-specific resources
func (a *App) GetServers(profileName, zone string) ([]sakura.ServerInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewServerService(client)
	return service.List(a.ctx, zone)
}

func (a *App) PowerOnServer(profileName, zone, serverID string) error {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return err
	}
	service := sakura.NewServerService(client)
	return service.PowerOn(a.ctx, zone, serverID)
}

func (a *App) PowerOffServer(profileName, zone, serverID string) error {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return err
	}
	service := sakura.NewServerService(client)
	return service.PowerOff(a.ctx, zone, serverID)
}

func (a *App) ForceStopServer(profileName, zone, serverID string) error {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return err
	}
	service := sakura.NewServerService(client)
	return service.ForceStop(a.ctx, zone, serverID)
}

func (a *App) GetServerStatus(profileName, zone, serverID string) (string, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return "", err
	}
	service := sakura.NewServerService(client)
	return service.GetStatus(a.ctx, zone, serverID)
}

// Global resources (zone-independent)
func (a *App) GetDNSList(profileName string) ([]sakura.DNSInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewGlobalService(client)
	return service.ListDNS(a.ctx)
}

func (a *App) GetCertificates(profileName string) ([]sakura.CertificateInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewGlobalService(client)
	return service.ListCertificates(a.ctx)
}

func (a *App) GetSimpleMonitors(profileName string) ([]sakura.SimpleMonitorInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewGlobalService(client)
	return service.ListSimpleMonitors(a.ctx)
}

func (a *App) GetGSLBList(profileName string) ([]sakura.GSLBInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewGlobalService(client)
	return service.ListGSLB(a.ctx)
}

func (a *App) GetContainerRegistries(profileName string) ([]sakura.ContainerRegistryInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewGlobalService(client)
	return service.ListContainerRegistries(a.ctx)
}

func (a *App) GetContainerRegistryUsers(profileName, registryId string) ([]sakura.ContainerRegistryUserInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewGlobalService(client)
	return service.ListContainerRegistryUsers(a.ctx, registryId)
}

// GSLB Detail
func (a *App) GetGSLBDetail(profileName, gslbId string) (*sakura.GSLBInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewGlobalService(client)
	return service.GetGSLB(a.ctx, gslbId)
}

// Switches
func (a *App) GetSwitches(profileName, zone string) ([]sakura.SwitchInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewSwitchService(client)
	return service.List(a.ctx, zone)
}

func (a *App) GetSwitchDetail(profileName, zone, switchId string) (*sakura.SwitchInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewSwitchService(client)
	return service.Get(a.ctx, zone, switchId)
}

// PacketFilters
func (a *App) GetPacketFilters(profileName, zone string) ([]sakura.PacketFilterInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewPacketFilterService(client)
	return service.List(a.ctx, zone)
}

func (a *App) GetPacketFilterDetail(profileName, zone, pfId string) (*sakura.PacketFilterInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewPacketFilterService(client)
	return service.Get(a.ctx, zone, pfId)
}

// Disks
func (a *App) GetDisks(profileName, zone string) ([]sakura.DiskInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewDiskService(client)
	return service.List(a.ctx, zone)
}

// Archives
func (a *App) GetArchives(profileName, zone string) ([]sakura.ArchiveInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewArchiveService(client)
	return service.List(a.ctx, zone)
}

// Databases
func (a *App) GetDatabases(profileName, zone string) ([]sakura.DatabaseInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewDatabaseService(client)
	return service.List(a.ctx, zone)
}

// DNS Detail
func (a *App) GetDNSDetail(profileName, dnsId string) (*sakura.DNSInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewGlobalService(client)
	return service.GetDNS(a.ctx, dnsId)
}

// Monitoring Suite
func (a *App) GetMSLogs(profileName string) ([]sakura.MSLogInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewMonitoringService(client)
	return service.ListLogs(a.ctx)
}

func (a *App) GetMSMetrics(profileName string) ([]sakura.MSMetricInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewMonitoringService(client)
	return service.ListMetrics(a.ctx)
}

func (a *App) GetMSTraces(profileName string) ([]sakura.MSTraceInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewMonitoringService(client)
	return service.ListTraces(a.ctx)
}

func (a *App) GetMSMetricsStorageDetail(profileName, storageID string) (*sakura.MSMetricsStorageDetail, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewMonitoringService(client)
	return service.GetMetricsStorageDetail(a.ctx, storageID)
}

func (a *App) GetMSMetricsAccessKeys(profileName, storageID string) ([]sakura.MSMetricsAccessKey, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewMonitoringService(client)
	return service.ListMetricsAccessKeys(a.ctx, storageID)
}

func (a *App) QueryMSPrometheusLabels(profileName, storageID string) ([]sakura.PrometheusLabel, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewMonitoringService(client)

	// Get storage detail to get endpoint
	detail, err := service.GetMetricsStorageDetail(a.ctx, storageID)
	if err != nil {
		return nil, err
	}

	// Get access keys to get token
	keys, err := service.ListMetricsAccessKeys(a.ctx, storageID)
	if err != nil {
		return nil, err
	}

	if len(keys) == 0 {
		return nil, fmt.Errorf("no access keys found for storage %s", storageID)
	}

	// Use the first access key
	token := keys[0].Token

	return service.QueryPrometheusLabels(a.ctx, detail.Endpoint, token)
}

func (a *App) QueryMSPrometheusRange(profileName, storageID, query string, start, end int64, step string) (*sakura.PrometheusQueryRangeResponse, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewMonitoringService(client)

	// Get storage detail to get endpoint
	detail, err := service.GetMetricsStorageDetail(a.ctx, storageID)
	if err != nil {
		return nil, err
	}

	// Get access keys to get token
	keys, err := service.ListMetricsAccessKeys(a.ctx, storageID)
	if err != nil {
		return nil, err
	}

	if len(keys) == 0 {
		return nil, fmt.Errorf("no access keys found for storage %s", storageID)
	}

	// Use the first access key
	token := keys[0].Token

	return service.QueryPrometheusRange(a.ctx, detail.Endpoint, token, sakura.PrometheusQueryRangeParams{
		Query: query,
		Start: start,
		End:   end,
		Step:  step,
	})
}

func (a *App) QueryMSPrometheusPublishers(profileName, storageID string) ([]string, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewMonitoringService(client)

	// Get storage detail to get endpoint
	detail, err := service.GetMetricsStorageDetail(a.ctx, storageID)
	if err != nil {
		return nil, err
	}

	// Get access keys to get token
	keys, err := service.ListMetricsAccessKeys(a.ctx, storageID)
	if err != nil {
		return nil, err
	}

	if len(keys) == 0 {
		return nil, fmt.Errorf("no access keys found for storage %s", storageID)
	}

	// Use the first access key
	token := keys[0].Token

	return service.QueryPrometheusPublishers(a.ctx, detail.Endpoint, token)
}

func (a *App) QueryMSPrometheusMetricsByPublisher(profileName, storageID, publisher string) ([]string, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewMonitoringService(client)

	// Get storage detail to get endpoint
	detail, err := service.GetMetricsStorageDetail(a.ctx, storageID)
	if err != nil {
		return nil, err
	}

	// Get access keys to get token
	keys, err := service.ListMetricsAccessKeys(a.ctx, storageID)
	if err != nil {
		return nil, err
	}

	if len(keys) == 0 {
		return nil, fmt.Errorf("no access keys found for storage %s", storageID)
	}

	// Use the first access key
	token := keys[0].Token

	return service.QueryPrometheusMetricsByPublisher(a.ctx, detail.Endpoint, token, publisher)
}

// AppRun Dedicated API
func (a *App) GetAppRunClusters(profileName string) ([]apprun.ClusterInfo, error) {
	service, err := apprun.NewService(profileName)
	if err != nil {
		return nil, err
	}
	return service.ListClusters(a.ctx)
}

func (a *App) GetAppRunApplications(profileName, clusterID string) ([]apprun.AppInfo, error) {
	service, err := apprun.NewService(profileName)
	if err != nil {
		return nil, err
	}
	return service.ListApplications(a.ctx, clusterID)
}

func (a *App) GetAppRunApplicationVersions(profileName, applicationID string) ([]apprun.AppVersionInfo, error) {
	service, err := apprun.NewService(profileName)
	if err != nil {
		return nil, err
	}
	return service.ListApplicationVersions(a.ctx, applicationID)
}

func (a *App) GetAppRunASGs(profileName, clusterID string) ([]apprun.ASGInfo, error) {
	service, err := apprun.NewService(profileName)
	if err != nil {
		return nil, err
	}
	return service.ListAutoScalingGroups(a.ctx, clusterID)
}

func (a *App) GetAppRunLoadBalancers(profileName, clusterID, asgID string) ([]apprun.LBInfo, error) {
	service, err := apprun.NewService(profileName)
	if err != nil {
		return nil, err
	}
	return service.ListLoadBalancers(a.ctx, clusterID, asgID)
}

func (a *App) GetAppRunWorkerNodes(profileName, clusterID, asgID string) ([]apprun.WorkerNodeInfo, error) {
	service, err := apprun.NewService(profileName)
	if err != nil {
		return nil, err
	}
	return service.ListWorkerNodes(a.ctx, clusterID, asgID)
}

func (a *App) GetAppRunLBNodes(profileName, clusterID, asgID, lbID string) ([]apprun.LBNodeInfo, error) {
	service, err := apprun.NewService(profileName)
	if err != nil {
		return nil, err
	}
	return service.ListLoadBalancerNodes(a.ctx, clusterID, asgID, lbID)
}

func (a *App) SetAppRunActiveVersion(profileName, applicationID string, version int) error {
	service, err := apprun.NewService(profileName)
	if err != nil {
		return err
	}
	return service.SetActiveVersion(a.ctx, applicationID, version)
}

func (a *App) ClearAppRunActiveVersion(profileName, applicationID string) error {
	service, err := apprun.NewService(profileName)
	if err != nil {
		return err
	}
	return service.ClearActiveVersion(a.ctx, applicationID)
}

func (a *App) GetAppRunApplicationVersion(profileName, applicationID string, version int) (*apprun.AppVersionDetailInfo, error) {
	service, err := apprun.NewService(profileName)
	if err != nil {
		return nil, err
	}
	return service.GetApplicationVersion(a.ctx, applicationID, version)
}

// AppRun Shared API
func (a *App) GetAppRunSharedApplications(profileName string) ([]apprunshared.AppInfo, error) {
	service, err := apprunshared.NewService(profileName)
	if err != nil {
		return nil, err
	}
	return service.ListApplications(a.ctx)
}

func (a *App) GetAppRunSharedApplication(profileName, appID string) (*apprunshared.AppDetailInfo, error) {
	service, err := apprunshared.NewService(profileName)
	if err != nil {
		return nil, err
	}
	return service.GetApplication(a.ctx, appID)
}

func (a *App) GetAppRunSharedApplicationStatus(profileName, appID string) (string, error) {
	service, err := apprunshared.NewService(profileName)
	if err != nil {
		return "", err
	}
	return service.GetApplicationStatus(a.ctx, appID)
}

func (a *App) GetAppRunSharedVersions(profileName, appID string) ([]apprunshared.VersionInfo, error) {
	service, err := apprunshared.NewService(profileName)
	if err != nil {
		return nil, err
	}
	return service.ListVersions(a.ctx, appID)
}

func (a *App) GetAppRunSharedTraffics(profileName, appID string) ([]apprunshared.TrafficInfo, error) {
	service, err := apprunshared.NewService(profileName)
	if err != nil {
		return nil, err
	}
	return service.ListTraffics(a.ctx, appID)
}

func (a *App) HasAppRunSharedUser(profileName string) (bool, error) {
	service, err := apprunshared.NewService(profileName)
	if err != nil {
		return false, err
	}
	return service.HasUser(a.ctx)
}

// Bills
func (a *App) GetBills(profileName, accountID string) ([]sakura.BillInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewBillService(client)
	return service.ListByContract(a.ctx, accountID)
}

func (a *App) GetBillDetails(profileName, memberCode, billID string) ([]sakura.BillDetailInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewBillService(client)
	return service.GetDetails(a.ctx, memberCode, billID)
}

// Object Storage
func (a *App) GetObjectStorageSites(profileName string) ([]sakura.SiteInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewObjectStorageService(client)
	return service.ListSites(a.ctx)
}

func (a *App) GetObjectStorageBuckets(profileName, siteID, accessKey, secretKey string) ([]sakura.BucketInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewObjectStorageService(client)
	return service.ListBuckets(a.ctx, siteID, accessKey, secretKey)
}

func (a *App) GetObjectStorageAccessKeys(profileName, siteID string) ([]sakura.AccessKeyInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewObjectStorageService(client)
	return service.ListAccessKeys(a.ctx, siteID)
}

// Object Storage Secret Key management (Keychain)
func (a *App) SaveObjectStorageSecretKey(siteID, accessKeyID, secretKey string) error {
	return sakura.SaveObjectStorageSecret(siteID, accessKeyID, secretKey)
}

func (a *App) GetObjectStorageSecretKey(siteID, accessKeyID string) (string, error) {
	return sakura.GetObjectStorageSecret(siteID, accessKeyID)
}

func (a *App) DeleteObjectStorageSecretKey(siteID, accessKeyID string) error {
	return sakura.DeleteObjectStorageSecret(siteID, accessKeyID)
}

func (a *App) HasObjectStorageSecretKey(siteID, accessKeyID string) bool {
	return sakura.HasObjectStorageSecret(siteID, accessKeyID)
}

func (a *App) ListObjectStorageObjects(endpoint, accessKey, secretKey, bucketName, prefix, continuationToken string, maxKeys int32) (*sakura.ListObjectsResult, error) {
	return sakura.ListObjects(a.ctx, endpoint, accessKey, secretKey, bucketName, prefix, continuationToken, maxKeys)
}

func (a *App) DownloadObjectStorageObject(endpoint, accessKey, secretKey, bucketName, key, defaultFileName string) error {
	savePath, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		DefaultFilename: defaultFileName,
		Title:           "オブジェクトを保存",
	})
	if err != nil {
		return err
	}
	if savePath == "" {
		return fmt.Errorf("cancelled")
	}
	return sakura.DownloadObject(a.ctx, endpoint, accessKey, secretKey, bucketName, key, savePath)
}

// Container Registry Secret Key management (Keychain)
func (a *App) SaveContainerRegistrySecret(registryID, userName, password string) error {
	return sakura.SaveContainerRegistrySecret(registryID, userName, password)
}

func (a *App) GetContainerRegistrySecret(registryID, userName string) (string, error) {
	return sakura.GetContainerRegistrySecret(registryID, userName)
}

func (a *App) DeleteContainerRegistrySecret(registryID, userName string) error {
	return sakura.DeleteContainerRegistrySecret(registryID, userName)
}

func (a *App) HasContainerRegistrySecret(registryID, userName string) bool {
	return sakura.HasContainerRegistrySecret(registryID, userName)
}

// Container Registry Image management
func (a *App) ListContainerRegistryImages(fqdn, userName, password string) ([]sakura.RegistryImage, error) {
	return sakura.ListRegistryImages(a.ctx, fqdn, userName, password)
}

func (a *App) GetContainerRegistryImageTags(fqdn, userName, password, imageName string) ([]sakura.RegistryTag, error) {
	return sakura.GetImageTags(a.ctx, fqdn, userName, password, imageName)
}

// Enhanced Database
func (a *App) GetEnhancedDBs(profileName string) ([]sakura.EnhancedDBInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewEnhancedDBService(client)
	return service.List(a.ctx)
}

// KMS
func (a *App) GetKMSKeys(profileName string) ([]kms.KeyInfo, error) {
	service, err := kms.NewService(profileName)
	if err != nil {
		return nil, err
	}
	return service.ListKeys(a.ctx)
}

// ProxyLB (Enhanced Load Balancer)
func (a *App) GetProxyLBs(profileName string) ([]sakura.ProxyLBInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewProxyLBService(client)
	return service.List(a.ctx)
}

func (a *App) GetProxyLBDetail(profileName, proxyLBId string) (*sakura.ProxyLBInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewProxyLBService(client)
	return service.Get(a.ctx, proxyLBId)
}

func (a *App) GetProxyLBHealth(profileName, proxyLBId string) (*sakura.ProxyLBHealthInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewProxyLBService(client)
	return service.GetHealth(a.ctx, proxyLBId)
}
