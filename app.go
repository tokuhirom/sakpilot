package main

import (
	"context"
	"fmt"
	"path/filepath"

	"sakpilot/internal/apprun"
	"sakpilot/internal/apprunshared"
	"sakpilot/internal/iam"
	"sakpilot/internal/kms"
	"sakpilot/internal/sakura"
	"sakpilot/internal/secretmanager"

	"github.com/sacloud/sacloud-sdk-go/api/iaas"
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

func (a *App) DeleteServer(profileName, zone, serverID string) error {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return err
	}
	service := sakura.NewServerService(client)
	return service.Delete(a.ctx, zone, serverID)
}

func (a *App) ResetServer(profileName, zone, serverID string) error {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return err
	}
	service := sakura.NewServerService(client)
	return service.Reset(a.ctx, zone, serverID)
}

func (a *App) GetServerStatus(profileName, zone, serverID string) (string, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return "", err
	}
	service := sakura.NewServerService(client)
	return service.GetStatus(a.ctx, zone, serverID)
}

func (a *App) GetServerDetail(profileName, zone, serverID string) (*sakura.ServerInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewServerService(client)
	return service.Get(a.ctx, zone, serverID)
}

func (a *App) ChangeServerPlan(profileName, zone, serverID string, cpu, memoryGB int) (*sakura.ServerInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewServerService(client)
	return service.ChangePlan(a.ctx, zone, serverID, cpu, memoryGB)
}

func (a *App) GetCDROMs(profileName, zone string) ([]sakura.CDROMInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewCDROMService(client)
	return service.List(a.ctx, zone)
}

func (a *App) InsertServerCDROM(profileName, zone, serverID, cdromID string) error {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return err
	}
	service := sakura.NewServerService(client)
	return service.InsertCDROM(a.ctx, zone, serverID, cdromID)
}

func (a *App) EjectServerCDROM(profileName, zone, serverID string) error {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return err
	}
	service := sakura.NewServerService(client)
	return service.EjectCDROM(a.ctx, zone, serverID)
}

func (a *App) SendServerKey(profileName, zone, serverID, key string) error {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return err
	}
	service := sakura.NewServerService(client)
	return service.SendKey(a.ctx, zone, serverID, key)
}

func (a *App) SendServerNMI(profileName, zone, serverID string) error {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return err
	}
	service := sakura.NewServerService(client)
	return service.SendNMI(a.ctx, zone, serverID)
}

func (a *App) GetServerVNCProxy(profileName, zone, serverID string) (*sakura.VNCProxyInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewServerService(client)
	return service.GetVNCProxy(a.ctx, zone, serverID)
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

func (a *App) DeleteSimpleMonitor(profileName, monitorId string) error {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return err
	}
	service := sakura.NewGlobalService(client)
	return service.DeleteSimpleMonitor(a.ctx, monitorId)
}

func (a *App) GetSimpleMonitorDetail(profileName, monitorId string) (*sakura.SimpleMonitorDetailInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewGlobalService(client)
	return service.GetSimpleMonitor(a.ctx, monitorId)
}

func (a *App) CreateSimpleMonitor(profileName, target, description string, settings sakura.SimpleMonitorSettingsInput) (*sakura.SimpleMonitorDetailInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewGlobalService(client)
	return service.CreateSimpleMonitor(a.ctx, target, description, settings)
}

func (a *App) UpdateSimpleMonitor(profileName, monitorId, description string) (*sakura.SimpleMonitorDetailInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewGlobalService(client)
	return service.UpdateSimpleMonitor(a.ctx, monitorId, description)
}

func (a *App) UpdateSimpleMonitorSettings(profileName, monitorId string, settings sakura.SimpleMonitorSettingsInput) (*sakura.SimpleMonitorDetailInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewGlobalService(client)
	return service.UpdateSimpleMonitorSettings(a.ctx, monitorId, settings)
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

func (a *App) DeleteContainerRegistry(profileName, registryId string) error {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return err
	}
	service := sakura.NewGlobalService(client)
	return service.DeleteContainerRegistry(a.ctx, registryId)
}

func (a *App) CreateContainerRegistry(profileName, name, description, accessLevel, virtualDomain string) (*sakura.ContainerRegistryInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewGlobalService(client)
	return service.CreateContainerRegistry(a.ctx, name, description, accessLevel, virtualDomain)
}

func (a *App) UpdateContainerRegistry(profileName, registryId, name, description, accessLevel, virtualDomain string) (*sakura.ContainerRegistryInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewGlobalService(client)
	return service.UpdateContainerRegistry(a.ctx, registryId, name, description, accessLevel, virtualDomain)
}

func (a *App) AddContainerRegistryUser(profileName, registryId, userName, password, permission string) error {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return err
	}
	service := sakura.NewGlobalService(client)
	return service.AddContainerRegistryUser(a.ctx, registryId, userName, password, permission)
}

func (a *App) UpdateContainerRegistryUser(profileName, registryId, userName, password, permission string) error {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return err
	}
	service := sakura.NewGlobalService(client)
	return service.UpdateContainerRegistryUser(a.ctx, registryId, userName, password, permission)
}

func (a *App) DeleteContainerRegistryUser(profileName, registryId, userName string) error {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return err
	}
	service := sakura.NewGlobalService(client)
	return service.DeleteContainerRegistryUser(a.ctx, registryId, userName)
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

func (a *App) DeleteGSLB(profileName, gslbId string) error {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return err
	}
	service := sakura.NewGlobalService(client)
	return service.DeleteGSLB(a.ctx, gslbId)
}

func (a *App) CreateGSLB(profileName, name, description string, settings sakura.GSLBSettingsInput) (*sakura.GSLBInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewGlobalService(client)
	return service.CreateGSLB(a.ctx, name, description, settings)
}

func (a *App) UpdateGSLB(profileName, gslbId, name, description string) (*sakura.GSLBInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewGlobalService(client)
	return service.UpdateGSLB(a.ctx, gslbId, name, description)
}

func (a *App) UpdateGSLBSettings(profileName, gslbId string, settings sakura.GSLBSettingsInput) (*sakura.GSLBInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewGlobalService(client)
	return service.UpdateGSLBSettings(a.ctx, gslbId, settings)
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

func (a *App) DeleteSwitch(profileName, zone, switchId string) error {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return err
	}
	service := sakura.NewSwitchService(client)
	return service.Delete(a.ctx, zone, switchId)
}

func (a *App) CreateSwitch(profileName, zone, name, description string, networkMaskLen int, defaultRoute string) (*sakura.SwitchInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewSwitchService(client)
	return service.Create(a.ctx, zone, name, description, networkMaskLen, defaultRoute)
}

func (a *App) UpdateSwitch(profileName, zone, switchId, name, description string, networkMaskLen int, defaultRoute string) (*sakura.SwitchInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewSwitchService(client)
	return service.Update(a.ctx, zone, switchId, name, description, networkMaskLen, defaultRoute)
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

func (a *App) DeletePacketFilter(profileName, zone, pfId string) error {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return err
	}
	service := sakura.NewPacketFilterService(client)
	return service.Delete(a.ctx, zone, pfId)
}

func (a *App) CreatePacketFilter(profileName, zone, name, description string, rules []sakura.PacketFilterRuleInfo) (*sakura.PacketFilterInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewPacketFilterService(client)
	return service.Create(a.ctx, zone, name, description, rules)
}

func (a *App) UpdatePacketFilter(profileName, zone, pfId, name, description string, rules []sakura.PacketFilterRuleInfo) (*sakura.PacketFilterInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewPacketFilterService(client)
	return service.Update(a.ctx, zone, pfId, name, description, rules)
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

func (a *App) DeleteDisk(profileName, zone, diskID string) error {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return err
	}
	service := sakura.NewDiskService(client)
	return service.Delete(a.ctx, zone, diskID)
}

func (a *App) GetDiskDetail(profileName, zone, diskID string) (*sakura.DiskInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewDiskService(client)
	return service.Get(a.ctx, zone, diskID)
}

func (a *App) CreateDisk(profileName, zone, name, description string, tags []string, sizeGB int, diskPlan, connection, sourceArchiveID, serverID string) (*sakura.DiskInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewDiskService(client)
	return service.Create(a.ctx, zone, name, description, tags, sizeGB, diskPlan, connection, sourceArchiveID, serverID)
}

func (a *App) UpdateDisk(profileName, zone, diskID, name, description string, tags []string) (*sakura.DiskInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewDiskService(client)
	return service.Update(a.ctx, zone, diskID, name, description, tags)
}

func (a *App) ConnectDiskToServer(profileName, zone, diskID, serverID string) error {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return err
	}
	service := sakura.NewDiskService(client)
	return service.ConnectToServer(a.ctx, zone, diskID, serverID)
}

func (a *App) DisconnectDiskFromServer(profileName, zone, diskID string) error {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return err
	}
	service := sakura.NewDiskService(client)
	return service.DisconnectFromServer(a.ctx, zone, diskID)
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

func (a *App) DeleteArchive(profileName, zone, archiveID string) error {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return err
	}
	service := sakura.NewArchiveService(client)
	return service.Delete(a.ctx, zone, archiveID)
}

func (a *App) CreateArchive(profileName, zone, name, description string, tags []string, sourceDiskID, sourceArchiveID string) (*sakura.ArchiveInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewArchiveService(client)
	return service.Create(a.ctx, zone, name, description, tags, sourceDiskID, sourceArchiveID)
}

func (a *App) CreateBlankArchive(profileName, zone, name, description string, tags []string, sizeGB int) (*sakura.ArchiveWithFTP, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewArchiveService(client)
	return service.CreateBlank(a.ctx, zone, name, description, tags, sizeGB)
}

func (a *App) OpenArchiveFTP(profileName, zone, archiveID string, changePassword bool) (*sakura.FTPServerInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewArchiveService(client)
	return service.OpenFTP(a.ctx, zone, archiveID, changePassword)
}

func (a *App) CloseArchiveFTP(profileName, zone, archiveID string) error {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return err
	}
	service := sakura.NewArchiveService(client)
	return service.CloseFTP(a.ctx, zone, archiveID)
}

func (a *App) ShareArchive(profileName, zone, archiveID string) (string, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return "", err
	}
	service := sakura.NewArchiveService(client)
	return service.Share(a.ctx, zone, archiveID)
}

func (a *App) CreateArchiveFromShared(profileName, destZone, sharedKey, name, description string, tags []string) (*sakura.ArchiveInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewArchiveService(client)
	return service.CreateFromShared(a.ctx, destZone, sharedKey, name, description, tags)
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

func (a *App) GetDatabaseDetail(profileName, zone, databaseID string) (*sakura.DatabaseInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewDatabaseService(client)
	return service.Get(a.ctx, zone, databaseID)
}

func (a *App) CreateDatabase(profileName, zone string, params sakura.CreateDatabaseParams) (*sakura.DatabaseInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewDatabaseService(client)
	return service.Create(a.ctx, zone, params)
}

func (a *App) UpdateDatabase(profileName, zone, databaseID, name, description string, tags []string) (*sakura.DatabaseInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewDatabaseService(client)
	return service.Update(a.ctx, zone, databaseID, name, description, tags)
}

func (a *App) UpdateDatabaseSettings(profileName, zone, databaseID string, params sakura.DatabaseSettingsParams) (*sakura.DatabaseInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewDatabaseService(client)
	return service.UpdateSettings(a.ctx, zone, databaseID, params)
}

func (a *App) GetDatabaseParameter(profileName, zone, databaseID string) (*sakura.DatabaseParameterInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewDatabaseService(client)
	return service.GetParameter(a.ctx, zone, databaseID)
}

func (a *App) SetDatabaseParameter(profileName, zone, databaseID string, params map[string]any) error {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return err
	}
	service := sakura.NewDatabaseService(client)
	return service.SetParameter(a.ctx, zone, databaseID, params)
}

func (a *App) PowerOnDatabase(profileName, zone, databaseID string) error {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return err
	}
	service := sakura.NewDatabaseService(client)
	return service.PowerOn(a.ctx, zone, databaseID)
}

func (a *App) PowerOffDatabase(profileName, zone, databaseID string) error {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return err
	}
	service := sakura.NewDatabaseService(client)
	return service.PowerOff(a.ctx, zone, databaseID)
}

func (a *App) ForceStopDatabase(profileName, zone, databaseID string) error {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return err
	}
	service := sakura.NewDatabaseService(client)
	return service.ForceStop(a.ctx, zone, databaseID)
}

func (a *App) ResetDatabase(profileName, zone, databaseID string) error {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return err
	}
	service := sakura.NewDatabaseService(client)
	return service.Reset(a.ctx, zone, databaseID)
}

func (a *App) DeleteDatabase(profileName, zone, databaseID string) error {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return err
	}
	service := sakura.NewDatabaseService(client)
	return service.Delete(a.ctx, zone, databaseID)
}

func (a *App) GetDatabaseStatus(profileName, zone, databaseID string) (string, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return "", err
	}
	service := sakura.NewDatabaseService(client)
	return service.GetStatus(a.ctx, zone, databaseID)
}

// NFS
func (a *App) GetNFSList(profileName, zone string) ([]sakura.NFSInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewNFSService(client)
	return service.List(a.ctx, zone)
}

func (a *App) PowerOnNFS(profileName, zone, nfsID string) error {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return err
	}
	service := sakura.NewNFSService(client)
	return service.PowerOn(a.ctx, zone, nfsID)
}

func (a *App) PowerOffNFS(profileName, zone, nfsID string) error {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return err
	}
	service := sakura.NewNFSService(client)
	return service.PowerOff(a.ctx, zone, nfsID)
}

func (a *App) ForceStopNFS(profileName, zone, nfsID string) error {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return err
	}
	service := sakura.NewNFSService(client)
	return service.ForceStop(a.ctx, zone, nfsID)
}

func (a *App) DeleteNFS(profileName, zone, nfsID string) error {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return err
	}
	service := sakura.NewNFSService(client)
	return service.Delete(a.ctx, zone, nfsID)
}

func (a *App) ResetNFS(profileName, zone, nfsID string) error {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return err
	}
	service := sakura.NewNFSService(client)
	return service.Reset(a.ctx, zone, nfsID)
}

func (a *App) GetNFSStatus(profileName, zone, nfsID string) (string, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return "", err
	}
	service := sakura.NewNFSService(client)
	return service.GetStatus(a.ctx, zone, nfsID)
}

func (a *App) GetNFSDetail(profileName, zone, nfsID string) (*sakura.NFSInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewNFSService(client)
	return service.Get(a.ctx, zone, nfsID)
}

func (a *App) CreateNFS(profileName, zone string, params sakura.NFSCreateParams) (*sakura.NFSInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewNFSService(client)
	return service.Create(a.ctx, zone, params)
}

func (a *App) UpdateNFS(profileName, zone, nfsID, name, description string, tags []string) (*sakura.NFSInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewNFSService(client)
	return service.Update(a.ctx, zone, nfsID, name, description, tags)
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

func (a *App) DeleteDNS(profileName, dnsId string) error {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return err
	}
	service := sakura.NewGlobalService(client)
	return service.DeleteDNS(a.ctx, dnsId)
}

func (a *App) CreateDNS(profileName, name, description string) (*sakura.DNSInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewGlobalService(client)
	return service.CreateDNS(a.ctx, name, description)
}

func (a *App) UpdateDNS(profileName, dnsId, description string) (*sakura.DNSInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewGlobalService(client)
	return service.UpdateDNS(a.ctx, dnsId, description)
}

func (a *App) UpdateDNSRecords(profileName, dnsId string, records []sakura.DNSRecord) (*sakura.DNSInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewGlobalService(client)
	return service.UpdateDNSRecords(a.ctx, dnsId, records)
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

func (a *App) CreateMSLogsStorage(profileName, name, description string) (*sakura.MSLogInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewMonitoringService(client)
	return service.CreateLogsStorage(a.ctx, name, description)
}

func (a *App) UpdateMSLogsStorage(profileName, storageID, name, description string) (*sakura.MSLogInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewMonitoringService(client)
	return service.UpdateLogsStorage(a.ctx, storageID, name, description)
}

func (a *App) DeleteMSLogsStorage(profileName, storageID string) error {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return err
	}
	service := sakura.NewMonitoringService(client)
	return service.DeleteLogsStorage(a.ctx, storageID)
}

func (a *App) CreateMSMetricsStorage(profileName, name, description string) (*sakura.MSMetricInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewMonitoringService(client)
	return service.CreateMetricsStorage(a.ctx, name, description)
}

func (a *App) UpdateMSMetricsStorage(profileName, storageID, name, description string) (*sakura.MSMetricInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewMonitoringService(client)
	return service.UpdateMetricsStorage(a.ctx, storageID, name, description)
}

func (a *App) DeleteMSMetricsStorage(profileName, storageID string) error {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return err
	}
	service := sakura.NewMonitoringService(client)
	return service.DeleteMetricsStorage(a.ctx, storageID)
}

func (a *App) CreateMSTracesStorage(profileName, name, description string) (*sakura.MSTraceInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewMonitoringService(client)
	return service.CreateTracesStorage(a.ctx, name, description)
}

func (a *App) UpdateMSTracesStorage(profileName, storageID, name, description string) (*sakura.MSTraceInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewMonitoringService(client)
	return service.UpdateTracesStorage(a.ctx, storageID, name, description)
}

func (a *App) DeleteMSTracesStorage(profileName, storageID string) error {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return err
	}
	service := sakura.NewMonitoringService(client)
	return service.DeleteTracesStorage(a.ctx, storageID)
}

func (a *App) CreateMSMetricsAccessKey(profileName, storageID, description string) (*sakura.MSMetricsAccessKeyCreated, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewMonitoringService(client)
	return service.CreateMetricsAccessKey(a.ctx, storageID, description)
}

func (a *App) DeleteMSMetricsAccessKey(profileName, storageID, uid string) error {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return err
	}
	service := sakura.NewMonitoringService(client)
	return service.DeleteMetricsAccessKey(a.ctx, storageID, uid)
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

func (a *App) QueryMSPrometheusMetricsByPublisher(profileName, storageID, publisher string) ([]sakura.MetricInfo, error) {
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

func (a *App) QueryMSPrometheusMetricsWithoutPublisher(profileName, storageID string) ([]string, error) {
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

	return service.QueryPrometheusMetricsWithoutPublisher(a.ctx, detail.Endpoint, token)
}

// AppRun Dedicated API
func (a *App) GetAppRunClusters(profileName string) ([]apprun.ClusterInfo, error) {
	service, err := apprun.NewService(profileName)
	if err != nil {
		return nil, err
	}
	return service.ListClusters(a.ctx)
}

func (a *App) CreateAppRunCluster(profileName string, params apprun.CreateClusterParams) (*apprun.ClusterInfo, error) {
	service, err := apprun.NewService(profileName)
	if err != nil {
		return nil, err
	}
	return service.CreateCluster(a.ctx, params)
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

func (a *App) CreateAppRunASG(profileName, clusterID string, params apprun.CreateASGParams) (*apprun.ASGInfo, error) {
	service, err := apprun.NewService(profileName)
	if err != nil {
		return nil, err
	}
	return service.CreateAutoScalingGroup(a.ctx, clusterID, params)
}

func (a *App) GetAppRunLoadBalancers(profileName, clusterID, asgID string) ([]apprun.LBInfo, error) {
	service, err := apprun.NewService(profileName)
	if err != nil {
		return nil, err
	}
	return service.ListLoadBalancers(a.ctx, clusterID, asgID)
}

func (a *App) CreateAppRunLoadBalancer(profileName, clusterID, asgID string, params apprun.CreateLBParams) (*apprun.LBInfo, error) {
	service, err := apprun.NewService(profileName)
	if err != nil {
		return nil, err
	}
	return service.CreateLoadBalancer(a.ctx, clusterID, asgID, params)
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

func (a *App) CreateAppRunApplicationVersion(profileName, applicationID string, params apprun.CreateAppVersionParams) (*apprun.AppVersionInfo, error) {
	service, err := apprun.NewService(profileName)
	if err != nil {
		return nil, err
	}
	return service.CreateApplicationVersion(a.ctx, applicationID, params)
}

func (a *App) DeleteAppRunApplicationVersion(profileName, applicationID string, version int) error {
	service, err := apprun.NewService(profileName)
	if err != nil {
		return err
	}
	return service.DeleteApplicationVersion(a.ctx, applicationID, version)
}

func (a *App) CreateAppRunApplication(profileName, clusterID, name string) (*apprun.AppInfo, error) {
	service, err := apprun.NewService(profileName)
	if err != nil {
		return nil, err
	}
	return service.CreateApplication(a.ctx, name, clusterID)
}

func (a *App) UpdateAppRunWorkerNodeDraining(profileName, clusterID, asgID, workerNodeID string, draining bool) error {
	service, err := apprun.NewService(profileName)
	if err != nil {
		return err
	}
	return service.UpdateWorkerNodeDraining(a.ctx, clusterID, asgID, workerNodeID, draining)
}

func (a *App) GetAppRunCertificates(profileName, clusterID string) ([]apprun.CertificateInfo, error) {
	service, err := apprun.NewService(profileName)
	if err != nil {
		return nil, err
	}
	return service.ListCertificates(a.ctx, clusterID)
}

func (a *App) CreateAppRunCertificate(profileName, clusterID string, params apprun.CreateCertificateParams) (*apprun.CertificateInfo, error) {
	service, err := apprun.NewService(profileName)
	if err != nil {
		return nil, err
	}
	return service.CreateCertificate(a.ctx, clusterID, params)
}

func (a *App) UpdateAppRunCertificate(profileName, clusterID, certificateID string, params apprun.CreateCertificateParams) error {
	service, err := apprun.NewService(profileName)
	if err != nil {
		return err
	}
	return service.UpdateCertificate(a.ctx, clusterID, certificateID, params)
}

func (a *App) DeleteAppRunCertificate(profileName, clusterID, certificateID string) error {
	service, err := apprun.NewService(profileName)
	if err != nil {
		return err
	}
	return service.DeleteCertificate(a.ctx, clusterID, certificateID)
}

func (a *App) DeleteAppRunCluster(profileName, clusterID string) error {
	service, err := apprun.NewService(profileName)
	if err != nil {
		return err
	}
	return service.DeleteCluster(a.ctx, clusterID)
}

func (a *App) DeleteAppRunApplication(profileName, applicationID string) error {
	service, err := apprun.NewService(profileName)
	if err != nil {
		return err
	}
	return service.DeleteApplication(a.ctx, applicationID)
}

func (a *App) DeleteAppRunASG(profileName, clusterID, asgID string) error {
	service, err := apprun.NewService(profileName)
	if err != nil {
		return err
	}
	return service.DeleteAutoScalingGroup(a.ctx, clusterID, asgID)
}

func (a *App) DeleteAppRunLoadBalancer(profileName, clusterID, asgID, lbID string) error {
	service, err := apprun.NewService(profileName)
	if err != nil {
		return err
	}
	return service.DeleteLoadBalancer(a.ctx, clusterID, asgID, lbID)
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

func (a *App) CreateAppRunSharedApplication(profileName string, params apprunshared.CreateApplicationParams) (*apprunshared.AppDetailInfo, error) {
	service, err := apprunshared.NewService(profileName)
	if err != nil {
		return nil, err
	}
	return service.CreateApplication(a.ctx, params)
}

func (a *App) UpdateAppRunSharedApplication(profileName, appID string, params apprunshared.UpdateApplicationParams) (*apprunshared.AppDetailInfo, error) {
	service, err := apprunshared.NewService(profileName)
	if err != nil {
		return nil, err
	}
	return service.UpdateApplication(a.ctx, appID, params)
}

func (a *App) HasAppRunSharedUser(profileName string) (bool, error) {
	service, err := apprunshared.NewService(profileName)
	if err != nil {
		return false, err
	}
	return service.HasUser(a.ctx)
}

func (a *App) DeleteAppRunSharedApplication(profileName, appID string) error {
	service, err := apprunshared.NewService(profileName)
	if err != nil {
		return err
	}
	return service.DeleteApplication(a.ctx, appID)
}

func (a *App) DeleteAppRunSharedVersion(profileName, appID, versionID string) error {
	service, err := apprunshared.NewService(profileName)
	if err != nil {
		return err
	}
	return service.DeleteVersion(a.ctx, appID, versionID)
}

func (a *App) UpdateAppRunSharedTraffics(profileName, appID string, params []apprunshared.UpdateTrafficParams) ([]apprunshared.TrafficInfo, error) {
	service, err := apprunshared.NewService(profileName)
	if err != nil {
		return nil, err
	}
	return service.UpdateTraffics(a.ctx, appID, params)
}

func (a *App) CreateAppRunSharedUser(profileName string) error {
	service, err := apprunshared.NewService(profileName)
	if err != nil {
		return err
	}
	return service.CreateUser(a.ctx)
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

func (a *App) GetBillsByYear(profileName, accountID string, year int) ([]sakura.BillInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewBillService(client)
	return service.ListByContractYear(a.ctx, accountID, year)
}

func (a *App) GetBillsByYearMonth(profileName, accountID string, year, month int) ([]sakura.BillInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewBillService(client)
	return service.ListByContractYearMonth(a.ctx, accountID, year, month)
}

func (a *App) DownloadBillDetailsCSV(profileName, memberCode, billID, defaultFileName string) error {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return err
	}
	savePath, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		DefaultFilename: defaultFileName,
		Title:           "請求明細CSVを保存",
	})
	if err != nil {
		return err
	}
	if savePath == "" {
		return fmt.Errorf("cancelled")
	}
	service := sakura.NewBillService(client)
	return service.DownloadDetailsCSV(a.ctx, memberCode, billID, savePath)
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

func (a *App) CreateObjectStorageAccessKey(profileName, siteID string) (*sakura.AccessKeyCreated, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewObjectStorageService(client)
	return service.CreateAccessKey(a.ctx, siteID)
}

func (a *App) DeleteObjectStorageAccessKey(profileName, siteID, keyID string) error {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return err
	}
	service := sakura.NewObjectStorageService(client)
	return service.DeleteAccessKey(a.ctx, siteID, keyID)
}

func (a *App) CreateObjectStorageBucket(profileName, siteID, bucketName, plan string) error {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return err
	}
	service := sakura.NewObjectStorageService(client)
	return service.CreateBucket(a.ctx, siteID, bucketName, plan)
}

func (a *App) DeleteObjectStorageBucket(profileName, siteID, bucketName string) error {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return err
	}
	service := sakura.NewObjectStorageService(client)
	return service.DeleteBucket(a.ctx, siteID, bucketName)
}

func (a *App) GetObjectStorageAccount(profileName, siteID string) (*sakura.AccountInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewObjectStorageService(client)
	return service.ReadAccount(a.ctx, siteID)
}

func (a *App) DeleteObjectStorageAccount(profileName, siteID string) error {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return err
	}
	service := sakura.NewObjectStorageService(client)
	return service.DeleteAccount(a.ctx, siteID)
}

func (a *App) GetObjectStorageBucketEncryption(profileName, siteID, bucketName string) (*sakura.BucketEncryptionInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewObjectStorageService(client)
	return service.ReadBucketEncryption(a.ctx, siteID, bucketName)
}

func (a *App) EnableObjectStorageBucketEncryption(profileName, siteID, bucketName, kmsKeyID string) error {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return err
	}
	service := sakura.NewObjectStorageService(client)
	return service.EnableBucketEncryption(a.ctx, siteID, bucketName, kmsKeyID)
}

func (a *App) DisableObjectStorageBucketEncryption(profileName, siteID, bucketName string) error {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return err
	}
	service := sakura.NewObjectStorageService(client)
	return service.DisableBucketEncryption(a.ctx, siteID, bucketName)
}

func (a *App) GetObjectStorageBucketReplication(profileName, siteID, bucketName string) (*sakura.BucketReplicationInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewObjectStorageService(client)
	return service.ReadBucketReplication(a.ctx, siteID, bucketName)
}

func (a *App) EnableObjectStorageBucketReplication(profileName, siteID, bucketName, targetBucket string) (*sakura.BucketReplicationInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewObjectStorageService(client)
	return service.EnableBucketReplication(a.ctx, siteID, bucketName, targetBucket)
}

func (a *App) DisableObjectStorageBucketReplication(profileName, siteID, bucketName string) error {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return err
	}
	service := sakura.NewObjectStorageService(client)
	return service.DisableBucketReplication(a.ctx, siteID, bucketName)
}

func (a *App) GetObjectStorageBucketQuota(profileName, siteID, bucketName string) (*sakura.BucketQuotaInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewObjectStorageService(client)
	return service.ReadBucketQuota(a.ctx, siteID, bucketName)
}

func (a *App) GetObjectStoragePermissions(profileName, siteID string) ([]sakura.PermissionInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewObjectStorageService(client)
	return service.ListPermissions(a.ctx, siteID)
}

func (a *App) CreateObjectStoragePermission(profileName, siteID, displayName string, controls []sakura.BucketControlInfo) (*sakura.PermissionInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewObjectStorageService(client)
	return service.CreatePermission(a.ctx, siteID, displayName, controls)
}

func (a *App) UpdateObjectStoragePermission(profileName, siteID, permissionID, displayName string, controls []sakura.BucketControlInfo) (*sakura.PermissionInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewObjectStorageService(client)
	return service.UpdatePermission(a.ctx, siteID, permissionID, displayName, controls)
}

func (a *App) DeleteObjectStoragePermission(profileName, siteID, permissionID string) error {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return err
	}
	service := sakura.NewObjectStorageService(client)
	return service.DeletePermission(a.ctx, siteID, permissionID)
}

func (a *App) GetObjectStoragePermissionAccessKeys(profileName, siteID, permissionID string) ([]sakura.PermissionAccessKeyInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewObjectStorageService(client)
	return service.ListPermissionAccessKeys(a.ctx, siteID, permissionID)
}

func (a *App) CreateObjectStoragePermissionAccessKey(profileName, siteID, permissionID string) (*sakura.PermissionAccessKeyCreated, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewObjectStorageService(client)
	return service.CreatePermissionAccessKey(a.ctx, siteID, permissionID)
}

func (a *App) DeleteObjectStoragePermissionAccessKey(profileName, siteID, permissionID, accessKeyID string) error {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return err
	}
	service := sakura.NewObjectStorageService(client)
	return service.DeletePermissionAccessKey(a.ctx, siteID, permissionID, accessKeyID)
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

func (a *App) UploadObjectStorageObject(endpoint, accessKey, secretKey, bucketName, prefix string) error {
	localPath, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "アップロードするファイルを選択",
	})
	if err != nil {
		return err
	}
	if localPath == "" {
		return fmt.Errorf("cancelled")
	}
	key := prefix + filepath.Base(localPath)
	return sakura.UploadObject(a.ctx, endpoint, accessKey, secretKey, bucketName, key, localPath)
}

func (a *App) DeleteObjectStorageObject(endpoint, accessKey, secretKey, bucketName, key string) error {
	return sakura.DeleteObject(a.ctx, endpoint, accessKey, secretKey, bucketName, key)
}

func (a *App) PreviewGzipJSONL(endpoint, accessKey, secretKey, bucketName, key string, maxLines int) (*sakura.PreviewResult, error) {
	return sakura.PreviewGzipJSONL(a.ctx, endpoint, accessKey, secretKey, bucketName, key, maxLines)
}

func (a *App) PreviewText(endpoint, accessKey, secretKey, bucketName, key string, maxBytes int64) (*sakura.TextPreviewResult, error) {
	return sakura.PreviewText(a.ctx, endpoint, accessKey, secretKey, bucketName, key, maxBytes)
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

func (a *App) GetEnhancedDB(profileName, enhancedDBId string) (*sakura.EnhancedDBInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewEnhancedDBService(client)
	return service.Get(a.ctx, enhancedDBId)
}

func (a *App) DeleteEnhancedDB(profileName, enhancedDBId string) error {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return err
	}
	service := sakura.NewEnhancedDBService(client)
	return service.Delete(a.ctx, enhancedDBId)
}

func (a *App) CreateEnhancedDB(profileName, name, description string, tags []string, databaseName, databaseType, region string) (*sakura.EnhancedDBInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewEnhancedDBService(client)
	return service.Create(a.ctx, name, description, tags, databaseName, databaseType, region)
}

func (a *App) UpdateEnhancedDB(profileName, enhancedDBId, name, description string, tags []string) (*sakura.EnhancedDBInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewEnhancedDBService(client)
	return service.Update(a.ctx, enhancedDBId, name, description, tags)
}

func (a *App) SetEnhancedDBPassword(profileName, enhancedDBId, password string) error {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return err
	}
	service := sakura.NewEnhancedDBService(client)
	return service.SetPassword(a.ctx, enhancedDBId, password)
}

// KMS
func (a *App) GetKMSKeys(profileName string) ([]kms.KeyInfo, error) {
	service, err := kms.NewService(profileName)
	if err != nil {
		return nil, err
	}
	return service.ListKeys(a.ctx)
}

func (a *App) DeleteKMSKey(profileName, keyId string) error {
	service, err := kms.NewService(profileName)
	if err != nil {
		return err
	}
	return service.DeleteKey(a.ctx, keyId)
}

func (a *App) GetKMSKey(profileName, keyId string) (*kms.KeyInfo, error) {
	service, err := kms.NewService(profileName)
	if err != nil {
		return nil, err
	}
	return service.GetKey(a.ctx, keyId)
}

func (a *App) RotateKMSKey(profileName, keyId string) (*kms.KeyInfo, error) {
	service, err := kms.NewService(profileName)
	if err != nil {
		return nil, err
	}
	return service.RotateKey(a.ctx, keyId)
}

func (a *App) ChangeKMSKeyStatus(profileName, keyId, status string) error {
	service, err := kms.NewService(profileName)
	if err != nil {
		return err
	}
	return service.ChangeKeyStatus(a.ctx, keyId, status)
}

func (a *App) CreateKMSKey(profileName, name, description, keyOrigin, plainKey string, tags []string) (*kms.KeyInfo, error) {
	service, err := kms.NewService(profileName)
	if err != nil {
		return nil, err
	}
	return service.CreateKey(a.ctx, name, description, keyOrigin, plainKey, tags)
}

func (a *App) UpdateKMSKey(profileName, keyId, name, description string, tags []string) (*kms.KeyInfo, error) {
	service, err := kms.NewService(profileName)
	if err != nil {
		return nil, err
	}
	return service.UpdateKey(a.ctx, keyId, name, description, tags)
}

// Secret Manager
func (a *App) GetSecretManagerVaults(profileName string) ([]secretmanager.VaultInfo, error) {
	service, err := secretmanager.NewService(profileName)
	if err != nil {
		return nil, err
	}
	return service.ListVaults(a.ctx)
}

func (a *App) GetSecretManagerVault(profileName, vaultId string) (*secretmanager.VaultInfo, error) {
	service, err := secretmanager.NewService(profileName)
	if err != nil {
		return nil, err
	}
	return service.GetVault(a.ctx, vaultId)
}

func (a *App) CreateSecretManagerVault(profileName, name, description, kmsKeyId string, tags []string) (*secretmanager.VaultInfo, error) {
	service, err := secretmanager.NewService(profileName)
	if err != nil {
		return nil, err
	}
	return service.CreateVault(a.ctx, name, description, kmsKeyId, tags)
}

func (a *App) UpdateSecretManagerVault(profileName, vaultId, name, description string, tags []string) (*secretmanager.VaultInfo, error) {
	service, err := secretmanager.NewService(profileName)
	if err != nil {
		return nil, err
	}
	return service.UpdateVault(a.ctx, vaultId, name, description, tags)
}

func (a *App) DeleteSecretManagerVault(profileName, vaultId string) error {
	service, err := secretmanager.NewService(profileName)
	if err != nil {
		return err
	}
	return service.DeleteVault(a.ctx, vaultId)
}

func (a *App) GetSecretManagerSecrets(profileName, vaultId string) ([]secretmanager.SecretInfo, error) {
	service, err := secretmanager.NewService(profileName)
	if err != nil {
		return nil, err
	}
	return service.ListSecrets(a.ctx, vaultId)
}

func (a *App) SetSecretManagerSecret(profileName, vaultId, name, value string) (*secretmanager.SecretInfo, error) {
	service, err := secretmanager.NewService(profileName)
	if err != nil {
		return nil, err
	}
	return service.SetSecret(a.ctx, vaultId, name, value)
}

func (a *App) DeleteSecretManagerSecret(profileName, vaultId, name string) error {
	service, err := secretmanager.NewService(profileName)
	if err != nil {
		return err
	}
	return service.DeleteSecret(a.ctx, vaultId, name)
}

func (a *App) UnveilSecretManagerSecret(profileName, vaultId, name string, version int) (*secretmanager.SecretValue, error) {
	service, err := secretmanager.NewService(profileName)
	if err != nil {
		return nil, err
	}
	return service.UnveilSecret(a.ctx, vaultId, name, version)
}

// IAM(現状はUser/Group/IAMロール/IDロールの読み取りのみ公開。書き込み系は今後のPLAN.md対応で追加予定)
func (a *App) GetIAMUsers(profileName string) ([]iam.UserInfo, error) {
	service, err := iam.NewService(profileName)
	if err != nil {
		return nil, err
	}
	return service.ListUsers(a.ctx)
}

func (a *App) GetIAMUser(profileName string, userId int) (*iam.UserInfo, error) {
	service, err := iam.NewService(profileName)
	if err != nil {
		return nil, err
	}
	return service.GetUser(a.ctx, userId)
}

func (a *App) GetIAMGroups(profileName string) ([]iam.GroupInfo, error) {
	service, err := iam.NewService(profileName)
	if err != nil {
		return nil, err
	}
	return service.ListGroups(a.ctx)
}

func (a *App) GetIAMGroup(profileName string, groupId int) (*iam.GroupInfo, error) {
	service, err := iam.NewService(profileName)
	if err != nil {
		return nil, err
	}
	return service.GetGroup(a.ctx, groupId)
}

func (a *App) GetIAMRoles(profileName string) ([]iam.IAMRoleInfo, error) {
	service, err := iam.NewService(profileName)
	if err != nil {
		return nil, err
	}
	return service.ListIAMRoles(a.ctx)
}

func (a *App) GetIAMIDRoles(profileName string) ([]iam.IDRoleInfo, error) {
	service, err := iam.NewService(profileName)
	if err != nil {
		return nil, err
	}
	return service.ListIDRoles(a.ctx)
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

func (a *App) DeleteProxyLB(profileName, proxyLBId string) error {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return err
	}
	service := sakura.NewProxyLBService(client)
	return service.Delete(a.ctx, proxyLBId)
}

func (a *App) GetProxyLBCertificates(profileName, proxyLBId string) (*sakura.ProxyLBCertificatesInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewProxyLBService(client)
	return service.GetCertificates(a.ctx, proxyLBId)
}

func (a *App) SetProxyLBCertificates(profileName, proxyLBId string, input sakura.ProxyLBSetCertificatesInput) (*sakura.ProxyLBCertificatesInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewProxyLBService(client)
	return service.SetCertificates(a.ctx, proxyLBId, &input)
}

func (a *App) DeleteProxyLBCertificates(profileName, proxyLBId string) error {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return err
	}
	service := sakura.NewProxyLBService(client)
	return service.DeleteCertificates(a.ctx, proxyLBId)
}

func (a *App) RenewProxyLBLetsEncryptCert(profileName, proxyLBId string) error {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return err
	}
	service := sakura.NewProxyLBService(client)
	return service.RenewLetsEncryptCert(a.ctx, proxyLBId)
}

func (a *App) CreateProxyLB(profileName string, input sakura.ProxyLBCreateInput) (*sakura.ProxyLBInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewProxyLBService(client)
	return service.Create(a.ctx, input)
}

func (a *App) UpdateProxyLB(profileName, proxyLBId, name, description string) (*sakura.ProxyLBInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewProxyLBService(client)
	return service.Update(a.ctx, proxyLBId, name, description)
}

func (a *App) UpdateProxyLBSettings(profileName, proxyLBId string, input sakura.ProxyLBSettingsInput) (*sakura.ProxyLBInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewProxyLBService(client)
	return service.UpdateSettings(a.ctx, proxyLBId, input)
}

func (a *App) ChangeProxyLBPlan(profileName, proxyLBId string, cps int) (*sakura.ProxyLBInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewProxyLBService(client)
	return service.ChangePlan(a.ctx, proxyLBId, cps)
}

func (a *App) GetProxyLBMonitorConnection(profileName, proxyLBId string, start, end int64) ([]sakura.ProxyLBConnectionValueInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewProxyLBService(client)
	return service.MonitorConnection(a.ctx, proxyLBId, start, end)
}
