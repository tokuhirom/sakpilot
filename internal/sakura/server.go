package sakura

import (
	"context"
	"fmt"

	"github.com/sacloud/iaas-api-go"
	"github.com/sacloud/iaas-api-go/types"
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
	CreatedAt   string   `json:"createdAt"`
}

type ServerService struct {
	client *Client
}

func NewServerService(client *Client) *ServerService {
	return &ServerService{client: client}
}

func (s *ServerService) List(ctx context.Context, zone string) ([]ServerInfo, error) {
	caller := s.client.Caller()
	println("ServerService.List: zone=", zone, "caller=", fmt.Sprintf("%p", caller))
	serverOp := iaas.NewServerOp(caller)

	result, err := serverOp.Find(ctx, zone, &iaas.FindCondition{})
	if err != nil {
		println("ServerService.List: error=", err.Error())
		return nil, err
	}
	println("ServerService.List: found", len(result.Servers), "servers")
	for i, srv := range result.Servers {
		println("  server", i, ":", srv.Name, "id=", srv.ID.String())
	}

	servers := make([]ServerInfo, 0, len(result.Servers))
	for _, srv := range result.Servers {
		ips := make([]string, 0)
		for _, iface := range srv.Interfaces {
			if iface.IPAddress != "" {
				ips = append(ips, iface.IPAddress)
			}
		}

		servers = append(servers, ServerInfo{
			ID:          srv.ID.String(),
			Name:        srv.Name,
			Description: srv.Description,
			Zone:        zone,
			CPU:         srv.CPU,
			Memory:      srv.GetMemoryGB(),
			Status:      string(srv.InstanceStatus),
			IPAddresses: ips,
			Tags:        srv.Tags,
			CreatedAt:   srv.CreatedAt.String(),
		})
	}
	return servers, nil
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

func (s *ServerService) ForceStop(ctx context.Context, zone string, serverID string) error {
	serverOp := iaas.NewServerOp(s.client.Caller())
	id := types.StringID(serverID)
	return serverOp.Shutdown(ctx, zone, id, &iaas.ShutdownOption{Force: true})
}
