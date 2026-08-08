//go:build e2e

// E2Eテスト用エントリポイント。`go run -tags e2e .` で起動する。
//
// Wailsのwebviewの代わりに、Appのバインドメソッドを HTTP JSON-RPC
// (POST /rpc/{Method}、引数はJSON配列) として公開し、frontend/dist を静的配信する。
// index.html には /e2e-shim.js を注入し、window.go.main.App.* の呼び出しを
// /rpc/ へのfetchに変換する(生成バインディングは無変更で動く)。
//
// クラウドAPIはすべてモック:
//   - IaaS: SDK同梱のfakeドライバ (api/iaas/fake) にプロセス内で切り替え
//   - KMS: sakumock のテストサーバーを起動し SAKURA_ENDPOINTS_KMS で差し替え
//
// HOMEは一時ディレクトリに差し替えて ~/.usacloud/e2e プロファイルを偽装し、
// OSキーチェーンは go-keyring のモックに差し替える(ヘッドレスCI対応)。
package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"time"

	"github.com/sacloud/sacloud-sdk-go/api/iaas"
	"github.com/sacloud/sacloud-sdk-go/api/iaas/fake"
	"github.com/sacloud/sacloud-sdk-go/api/iaas/types"
	sdkkms "github.com/sacloud/sacloud-sdk-go/api/kms"
	kmsv1 "github.com/sacloud/sacloud-sdk-go/api/kms/apis/v1"
	"github.com/sacloud/sacloud-sdk-go/common/saclient"
	mockkms "github.com/sacloud/sakumock/kms"
	"github.com/zalando/go-keyring"
)

const (
	e2eProfileName = "e2e"
	e2eAccessToken = "e2e-dummy-token"
	e2eSecretToken = "e2e-dummy-secret"
	e2eZone        = "is1a"
)

func main() {
	addr := flag.String("addr", "127.0.0.1:34199", "listen address")
	dist := flag.String("dist", "frontend/dist", "path to built frontend assets")
	flag.Parse()

	if err := runE2EServer(*addr, *dist); err != nil {
		log.Fatal(err)
	}
}

func runE2EServer(addr, dist string) error {
	indexHTML, err := loadIndexWithShim(dist)
	if err != nil {
		return fmt.Errorf("frontend assets not found (run `cd frontend && npm run build` first): %w", err)
	}

	if err := setupFakeHome(); err != nil {
		return err
	}
	keyring.MockInit()

	fake.SwitchFactoryFuncToFake()
	seedServers()
	if err := seedDNS(); err != nil {
		return fmt.Errorf("failed to seed DNS zones: %w", err)
	}
	if err := seedPacketFilters(); err != nil {
		return fmt.Errorf("failed to seed packet filters: %w", err)
	}
	if err := seedSimpleMonitors(); err != nil {
		return fmt.Errorf("failed to seed simple monitors: %w", err)
	}
	if err := seedGSLBs(); err != nil {
		return fmt.Errorf("failed to seed GSLBs: %w", err)
	}
	if err := seedContainerRegistries(); err != nil {
		return fmt.Errorf("failed to seed container registries: %w", err)
	}

	kmsSrv := mockkms.NewTestServer(mockkms.Config{})
	if err := os.Setenv("SAKURA_ENDPOINTS_KMS", kmsSrv.TestURL()); err != nil {
		return err
	}
	if err := seedKMSKeys(); err != nil {
		return fmt.Errorf("failed to seed KMS keys: %w", err)
	}

	app := NewApp()
	app.startup(context.Background())

	mux := http.NewServeMux()
	mux.HandleFunc("/rpc/", rpcHandler(app))
	mux.HandleFunc("/e2e-shim.js", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/javascript")
		_, _ = w.Write([]byte(e2eShimJS))
	})
	mux.Handle("/assets/", http.FileServer(http.Dir(dist)))
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" && r.URL.Path != "/index.html" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = w.Write(indexHTML)
	})

	log.Printf("sakpilot e2e server listening on http://%s", addr)
	return http.ListenAndServe(addr, mux)
}

// setupFakeHome はHOMEを一時ディレクトリに差し替え、usacloud互換の
// E2E用プロファイルを偽装する。実環境の ~/.usacloud には一切触れない。
func setupFakeHome() error {
	home, err := os.MkdirTemp("", "sakpilot-e2e-home-")
	if err != nil {
		return err
	}
	if err := os.Setenv("HOME", home); err != nil {
		return err
	}

	profileDir := filepath.Join(home, ".usacloud", e2eProfileName)
	if err := os.MkdirAll(profileDir, 0o755); err != nil {
		return err
	}
	cfg, err := json.Marshal(map[string]string{
		"AccessToken":       e2eAccessToken,
		"AccessTokenSecret": e2eSecretToken,
		"Zone":              e2eZone,
	})
	if err != nil {
		return err
	}
	if err := os.WriteFile(filepath.Join(profileDir, "config.json"), cfg, 0o600); err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(home, ".usacloud", "current"), []byte(e2eProfileName+"\n"), 0o600)
}

// seedServers はIaaS fakeドライバのデータストアにE2Eシナリオ用のサーバーを投入する。
// fakeのServer.Deleteは紐づくInterfaceも削除するため、Interfaceは
// IDを付与したうえでInterfaceストア側にも実体を登録しておく必要がある。
func seedServers() {
	fake.InitDataStore()
	now := time.Now()

	type seed struct {
		id     types.ID
		name   string
		desc   string
		cpu    int
		memGB  int
		status types.EServerInstanceStatus
		ip     string
	}
	seeds := []seed{
		{900000000001, "e2e-web-1", "E2E: 起動中サーバー(電源操作シナリオ用)", 2, 4, types.ServerInstanceStatuses.Up, "192.0.2.1"},
		{900000000002, "e2e-doomed-1", "E2E: 削除シナリオ用サーバー", 1, 2, types.ServerInstanceStatuses.Down, "192.0.2.2"},
	}
	for i, s := range seeds {
		ifaceID := types.ID(910000000001 + i)
		fake.DataStore.Put(fake.ResourceInterface, e2eZone, ifaceID, &iaas.Interface{
			ID:        ifaceID,
			IPAddress: s.ip,
			ServerID:  s.id,
			CreatedAt: now,
		})
		fake.DataStore.Put(fake.ResourceServer, e2eZone, s.id, &iaas.Server{
			ID:             s.id,
			Name:           s.name,
			Description:    s.desc,
			CPU:            s.cpu,
			MemoryMB:       s.memGB * 1024,
			InstanceStatus: s.status,
			Availability:   types.Availabilities.Available,
			Tags:           types.Tags{"env:e2e"},
			Interfaces:     []*iaas.InterfaceView{{ID: ifaceID, IPAddress: s.ip}},
			CreatedAt:      now,
		})
	}
}

// seedDNS はIaaS fakeドライバのデータストアにE2Eシナリオ用のDNSゾーンを投入する。
// fakeのDNSOpは実APIと同じCreate/Update/UpdateSettings/Deleteを備えているため、
// Op経由でシードすることでフロントエンドの操作パスをそのまま検証できる。
func seedDNS() error {
	ctx := context.Background()
	dnsOp := iaas.NewDNSOp(nil)

	if _, err := dnsOp.Create(ctx, &iaas.DNSCreateRequest{
		Name:        "e2e-example.com",
		Description: "E2E: レコード操作シナリオ用",
		Records: iaas.DNSRecords{
			{Name: "www", Type: types.DNSRecordTypes.A, RData: "192.0.2.10", TTL: 3600},
		},
	}); err != nil {
		return err
	}
	if _, err := dnsOp.Create(ctx, &iaas.DNSCreateRequest{
		Name:        "e2e-doomed.com",
		Description: "E2E: 削除シナリオ用",
	}); err != nil {
		return err
	}
	return nil
}

// seedPacketFilters はIaaS fakeドライバのデータストアにE2Eシナリオ用のパケットフィルターを投入する。
func seedPacketFilters() error {
	ctx := context.Background()
	pfOp := iaas.NewPacketFilterOp(nil)

	if _, err := pfOp.Create(ctx, e2eZone, &iaas.PacketFilterCreateRequest{
		Name:        "e2e-web-filter",
		Description: "E2E: ルール操作シナリオ用",
		Expression: []*iaas.PacketFilterExpression{
			{
				Protocol:        types.Protocols.TCP,
				DestinationPort: "80",
				Action:          types.Actions.Allow,
				Description:     "HTTP",
			},
		},
	}); err != nil {
		return err
	}
	if _, err := pfOp.Create(ctx, e2eZone, &iaas.PacketFilterCreateRequest{
		Name:        "e2e-doomed-filter",
		Description: "E2E: 削除シナリオ用",
	}); err != nil {
		return err
	}
	return nil
}

// seedSimpleMonitors はIaaS fakeドライバのデータストアにE2Eシナリオ用のシンプル監視を投入する。
func seedSimpleMonitors() error {
	ctx := context.Background()
	smOp := iaas.NewSimpleMonitorOp(nil)

	if _, err := smOp.Create(ctx, &iaas.SimpleMonitorCreateRequest{
		Target:      "e2e-monitor-target.example.com",
		Description: "E2E: 設定編集シナリオ用",
		DelayLoop:   60,
		Enabled:     true,
		HealthCheck: &iaas.SimpleMonitorHealthCheck{
			Protocol: types.SimpleMonitorProtocols.Ping,
		},
	}); err != nil {
		return err
	}
	if _, err := smOp.Create(ctx, &iaas.SimpleMonitorCreateRequest{
		Target:      "e2e-doomed-monitor.example.com",
		Description: "E2E: 削除シナリオ用",
		DelayLoop:   60,
		Enabled:     true,
		HealthCheck: &iaas.SimpleMonitorHealthCheck{
			Protocol: types.SimpleMonitorProtocols.Ping,
		},
	}); err != nil {
		return err
	}
	return nil
}

// seedGSLBs はIaaS fakeドライバのデータストアにE2Eシナリオ用のGSLBを投入する。
func seedGSLBs() error {
	ctx := context.Background()
	gslbOp := iaas.NewGSLBOp(nil)

	if _, err := gslbOp.Create(ctx, &iaas.GSLBCreateRequest{
		Name:        "e2e-gslb-target",
		Description: "E2E: 設定編集シナリオ用",
		DelayLoop:   10,
		HealthCheck: &iaas.GSLBHealthCheck{
			Protocol: types.GSLBHealthCheckProtocols.Ping,
		},
		DestinationServers: iaas.GSLBServers{
			{IPAddress: "192.0.2.10", Enabled: types.StringFlag(true), Weight: types.StringNumber(1)},
		},
	}); err != nil {
		return err
	}
	if _, err := gslbOp.Create(ctx, &iaas.GSLBCreateRequest{
		Name:        "e2e-doomed-gslb",
		Description: "E2E: 削除シナリオ用",
		DelayLoop:   10,
		HealthCheck: &iaas.GSLBHealthCheck{
			Protocol: types.GSLBHealthCheckProtocols.Ping,
		},
	}); err != nil {
		return err
	}
	return nil
}

// seedContainerRegistries はIaaS fakeドライバのデータストアにE2Eシナリオ用のコンテナレジストリを投入する。
func seedContainerRegistries() error {
	ctx := context.Background()
	crOp := iaas.NewContainerRegistryOp(nil)

	if _, err := crOp.Create(ctx, &iaas.ContainerRegistryCreateRequest{
		Name:        "e2e-registry-target",
		Description: "E2E: ユーザー管理シナリオ用",
		AccessLevel: types.ContainerRegistryAccessLevels.None,
	}); err != nil {
		return err
	}
	if _, err := crOp.Create(ctx, &iaas.ContainerRegistryCreateRequest{
		Name:        "e2e-doomed-registry",
		Description: "E2E: 削除シナリオ用",
		AccessLevel: types.ContainerRegistryAccessLevels.None,
	}); err != nil {
		return err
	}
	return nil
}

// seedKMSKeys はsakumockのKMSサーバーにE2Eシナリオ用のキーを投入する。
func seedKMSKeys() error {
	var sc saclient.Client
	env := append(os.Environ(),
		"SAKURA_ACCESS_TOKEN="+e2eAccessToken,
		"SAKURA_ACCESS_TOKEN_SECRET="+e2eSecretToken,
	)
	if err := sc.SetEnviron(env); err != nil {
		return err
	}
	client, err := sdkkms.NewClient(&sc)
	if err != nil {
		return err
	}
	keyOp := sdkkms.NewKeyOp(client)

	for _, name := range []string{"e2e-key-1", "e2e-doomed-key"} {
		if _, err := keyOp.Create(context.Background(), kmsv1.CreateKey{
			Name:      name,
			KeyOrigin: kmsv1.KeyOriginEnumGenerated,
			Tags:      []string{"env:e2e"},
		}); err != nil {
			return err
		}
	}
	return nil
}

// rpcHandler はAppのバインドメソッドをリフレクションで呼び出すHTTPハンドラを返す。
// Wailsのバインディング呼び出し規約と同じく、引数はJSON配列で受け取り、
// エラーは非2xx+メッセージ文字列(シム側でrejectに変換)、戻り値はJSONで返す。
func rpcHandler(app *App) http.HandlerFunc {
	appValue := reflect.ValueOf(app)
	errType := reflect.TypeOf((*error)(nil)).Elem()

	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "POST only", http.StatusMethodNotAllowed)
			return
		}
		name := strings.TrimPrefix(r.URL.Path, "/rpc/")
		method := appValue.MethodByName(name)
		if !method.IsValid() {
			http.Error(w, "unknown method: "+name, http.StatusNotFound)
			return
		}

		var rawArgs []json.RawMessage
		if err := json.NewDecoder(r.Body).Decode(&rawArgs); err != nil {
			http.Error(w, "invalid request body: "+err.Error(), http.StatusBadRequest)
			return
		}
		mt := method.Type()
		if len(rawArgs) != mt.NumIn() {
			http.Error(w, fmt.Sprintf("%s: got %d args, want %d", name, len(rawArgs), mt.NumIn()), http.StatusBadRequest)
			return
		}
		in := make([]reflect.Value, mt.NumIn())
		for i := range in {
			ptr := reflect.New(mt.In(i))
			if err := json.Unmarshal(rawArgs[i], ptr.Interface()); err != nil {
				http.Error(w, fmt.Sprintf("%s: invalid arg %d: %v", name, i, err), http.StatusBadRequest)
				return
			}
			in[i] = ptr.Elem()
		}

		out := method.Call(in)
		var result any
		for _, v := range out {
			if v.Type().Implements(errType) {
				if !v.IsNil() {
					log.Printf("[rpc] %s -> error: %v", name, v.Interface())
					http.Error(w, v.Interface().(error).Error(), http.StatusInternalServerError)
					return
				}
				continue
			}
			result = v.Interface()
		}
		log.Printf("[rpc] %s -> ok", name)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(result)
	}
}

func loadIndexWithShim(dist string) ([]byte, error) {
	data, err := os.ReadFile(filepath.Join(dist, "index.html"))
	if err != nil {
		return nil, err
	}
	html := strings.Replace(string(data), "<head>",
		`<head><script src="/e2e-shim.js"></script>`, 1)
	return []byte(html), nil
}

// e2eShimJS はwindow.go.main.App.*をHTTP JSON-RPCに変換するシム。
// Wailsと同じく、エラー時はメッセージ文字列でrejectする。
const e2eShimJS = `(() => {
  const call = (method) => (...args) =>
    fetch('/rpc/' + method, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    }).then(async (res) => {
      const text = await res.text();
      if (!res.ok) throw text.trim();
      return text ? JSON.parse(text) : null;
    });
  window.go = { main: { App: new Proxy({}, { get: (_t, prop) => call(String(prop)) }) } };
  window.runtime = {
    BrowserOpenURL: () => {},
    EventsOn: () => () => {},
    EventsOff: () => {},
    EventsEmit: () => {},
    Quit: () => {},
  };
})();
`
