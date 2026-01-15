package main

import (
	"context"
	"fmt"

	"sakpilot/internal/apprun"
	"sakpilot/internal/sakura"

	"github.com/sacloud/iaas-api-go"
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

func (a *App) GetAppRunApplicationVersion(profileName, applicationID string, version int) (*apprun.AppVersionDetailInfo, error) {
	service, err := apprun.NewService(profileName)
	if err != nil {
		return nil, err
	}
	return service.GetApplicationVersion(a.ctx, applicationID, version)
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
