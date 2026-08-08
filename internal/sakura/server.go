package sakura

import (
	"context"

	"github.com/sacloud/sacloud-sdk-go/api/iaas"
	"github.com/sacloud/sacloud-sdk-go/api/iaas/types"
)

type ServerInfo struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Zone        string   `json:"zone"`
	CPU         int      `json:"cpu"`
	Memory      int      `json:"memory"`
	Status      string   `json:"status"`
	IPAddresses []string `json:"ipAddresses"`
	Tags        []string `json:"tags"`
	CDROMID     string   `json:"cdromId"`
	CreatedAt   string   `json:"createdAt"`
}

type VNCProxyInfo struct {
	Status       string `json:"status"`
	Host         string `json:"host"`
	IOServerHost string `json:"ioServerHost"`
	Port         string `json:"port"`
	Password     string `json:"password"`
}

type ServerService struct {
	client *Client
}

func NewServerService(client *Client) *ServerService {
	return &ServerService{client: client}
}

func (s *ServerService) List(ctx context.Context, zone string) ([]ServerInfo, error) {
	serverOp := iaas.NewServerOp(s.client.Caller())

	result, err := serverOp.Find(ctx, zone, &iaas.FindCondition{})
	if err != nil {
		return nil, err
	}

	servers := make([]ServerInfo, 0, len(result.Servers))
	for _, srv := range result.Servers {
		servers = append(servers, *serverFromSDK(zone, srv))
	}
	return servers, nil
}

func (s *ServerService) Get(ctx context.Context, zone string, serverID string) (*ServerInfo, error) {
	serverOp := iaas.NewServerOp(s.client.Caller())
	srv, err := serverOp.Read(ctx, zone, types.StringID(serverID))
	if err != nil {
		return nil, err
	}
	return serverFromSDK(zone, srv), nil
}

func (s *ServerService) PowerOn(ctx context.Context, zone string, serverID string) error {
	serverOp := iaas.NewServerOp(s.client.Caller())
	id := types.StringID(serverID)
	return serverOp.Boot(ctx, zone, id)
}

func (s *ServerService) PowerOff(ctx context.Context, zone string, serverID string) error {
	serverOp := iaas.NewServerOp(s.client.Caller())
	id := types.StringID(serverID)
	return serverOp.Shutdown(ctx, zone, id, &iaas.ShutdownOption{Force: false})
}

func (s *ServerService) Delete(ctx context.Context, zone string, serverID string) error {
	serverOp := iaas.NewServerOp(s.client.Caller())
	id := types.StringID(serverID)
	return serverOp.Delete(ctx, zone, id)
}

func (s *ServerService) ForceStop(ctx context.Context, zone string, serverID string) error {
	serverOp := iaas.NewServerOp(s.client.Caller())
	id := types.StringID(serverID)
	return serverOp.Shutdown(ctx, zone, id, &iaas.ShutdownOption{Force: true})
}

func (s *ServerService) Reset(ctx context.Context, zone string, serverID string) error {
	serverOp := iaas.NewServerOp(s.client.Caller())
	id := types.StringID(serverID)
	return serverOp.Reset(ctx, zone, id)
}

func (s *ServerService) GetStatus(ctx context.Context, zone string, serverID string) (string, error) {
	serverOp := iaas.NewServerOp(s.client.Caller())
	id := types.StringID(serverID)
	srv, err := serverOp.Read(ctx, zone, id)
	if err != nil {
		return "", err
	}
	return string(srv.InstanceStatus), nil
}

// ChangePlan はサーバーのCPU/メモリプランを変更する。サーバーが停止していない場合はAPIエラーとなる。
// プラン変更はリソースの再作成として扱われるため、戻り値のServerInfo.IDは呼び出し前のserverIDと異なる値になる。
func (s *ServerService) ChangePlan(ctx context.Context, zone string, serverID string, cpu int, memoryGB int) (*ServerInfo, error) {
	serverOp := iaas.NewServerOp(s.client.Caller())
	id := types.StringID(serverID)
	srv, err := serverOp.ChangePlan(ctx, zone, id, &iaas.ServerChangePlanRequest{
		CPU:      cpu,
		MemoryMB: memoryGB * 1024,
	})
	if err != nil {
		return nil, err
	}
	return serverFromSDK(zone, srv), nil
}

// InsertCDROM はサーバーにCD-ROM(ISOイメージ)を挿入する。
func (s *ServerService) InsertCDROM(ctx context.Context, zone string, serverID string, cdromID string) error {
	serverOp := iaas.NewServerOp(s.client.Caller())
	id := types.StringID(serverID)
	return serverOp.InsertCDROM(ctx, zone, id, &iaas.InsertCDROMRequest{ID: types.StringID(cdromID)})
}

// EjectCDROM はサーバーに挿入されているCD-ROMを排出する。
func (s *ServerService) EjectCDROM(ctx context.Context, zone string, serverID string) error {
	serverOp := iaas.NewServerOp(s.client.Caller())
	id := types.StringID(serverID)
	srv, err := serverOp.Read(ctx, zone, id)
	if err != nil {
		return err
	}
	return serverOp.EjectCDROM(ctx, zone, id, &iaas.EjectCDROMRequest{ID: srv.CDROMID})
}

// SendKey はサーバーのコンソールにキー入力を送信する(例: "CTRL+ALT+DELETE", "F1", "ENTER")。
func (s *ServerService) SendKey(ctx context.Context, zone string, serverID string, key string) error {
	serverOp := iaas.NewServerOp(s.client.Caller())
	id := types.StringID(serverID)
	return serverOp.SendKey(ctx, zone, id, &iaas.SendKeyRequest{Key: key})
}

// SendNMI はサーバーにNMI(Non-Maskable Interrupt)を送信する。カーネルパニック等のデバッグ用途。
func (s *ServerService) SendNMI(ctx context.Context, zone string, serverID string) error {
	serverOp := iaas.NewServerOp(s.client.Caller())
	id := types.StringID(serverID)
	return serverOp.SendNMI(ctx, zone, id)
}

// GetVNCProxy はサーバーのVNC接続情報を取得する。有効期限が短いため取得の都度呼び出すこと。
func (s *ServerService) GetVNCProxy(ctx context.Context, zone string, serverID string) (*VNCProxyInfo, error) {
	serverOp := iaas.NewServerOp(s.client.Caller())
	id := types.StringID(serverID)
	info, err := serverOp.GetVNCProxy(ctx, zone, id)
	if err != nil {
		return nil, err
	}
	return &VNCProxyInfo{
		Status:       info.Status,
		Host:         info.Host,
		IOServerHost: info.IOServerHost,
		Port:         info.Port.String(),
		Password:     info.Password,
	}, nil
}

func serverFromSDK(zone string, srv *iaas.Server) *ServerInfo {
	ips := make([]string, 0)
	for _, iface := range srv.Interfaces {
		if iface.IPAddress != "" {
			ips = append(ips, iface.IPAddress)
		} else if iface.UserIPAddress != "" {
			ips = append(ips, iface.UserIPAddress)
		}
	}

	return &ServerInfo{
		ID:          srv.ID.String(),
		Name:        srv.Name,
		Description: srv.Description,
		Zone:        zone,
		CPU:         srv.CPU,
		Memory:      srv.GetMemoryGB(),
		Status:      string(srv.InstanceStatus),
		IPAddresses: ips,
		Tags:        srv.Tags,
		CDROMID:     srv.CDROMID.String(),
		CreatedAt:   srv.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
}
