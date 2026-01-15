package main

import (
	"context"
	"fmt"

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

func (a *App) GetDatabases(profileName, zone string) ([]sakura.DatabaseInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewDatabaseService(client)
	return service.List(a.ctx, zone)
}

func (a *App) GetDisks(profileName, zone string) ([]sakura.DiskInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewDiskService(client)
	return service.List(a.ctx, zone)
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

func (a *App) GetDNSDetail(profileName, id string) (*sakura.DNSInfo, error) {
	client, err := sakura.NewClientFromProfile(profileName)
	if err != nil {
		return nil, err
	}
	service := sakura.NewGlobalService(client)
	return service.GetDNS(a.ctx, id)
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
