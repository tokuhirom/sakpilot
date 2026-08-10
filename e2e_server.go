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
	"os/signal"
	"path/filepath"
	"reflect"
	"runtime/coverage"
	"strings"
	"syscall"
	"time"

	sdkapprunshared "github.com/sacloud/sacloud-sdk-go/api/apprun"
	sdkapprundedicated "github.com/sacloud/sacloud-sdk-go/api/apprun-dedicated"
	dedicatedv1 "github.com/sacloud/sacloud-sdk-go/api/apprun-dedicated/apis/v1"
	"github.com/sacloud/sacloud-sdk-go/api/apprun-dedicated/apis/version"
	sharedv1 "github.com/sacloud/sacloud-sdk-go/api/apprun/apis/v1"
	"github.com/sacloud/sacloud-sdk-go/api/iaas"
	"github.com/sacloud/sacloud-sdk-go/api/iaas/fake"
	"github.com/sacloud/sacloud-sdk-go/api/iaas/types"
	sdkiam "github.com/sacloud/sacloud-sdk-go/api/iam"
	iamserviceprincipal "github.com/sacloud/sacloud-sdk-go/api/iam/apis/serviceprincipal"
	iamuser "github.com/sacloud/sacloud-sdk-go/api/iam/apis/user"
	sdkkms "github.com/sacloud/sacloud-sdk-go/api/kms"
	kmsv1 "github.com/sacloud/sacloud-sdk-go/api/kms/apis/v1"
	sdksecretmanager "github.com/sacloud/sacloud-sdk-go/api/secretmanager"
	secretmanagerv1 "github.com/sacloud/sacloud-sdk-go/api/secretmanager/apis/v1"
	sdksimplenotification "github.com/sacloud/sacloud-sdk-go/api/simple-notification"
	simplenotificationv1 "github.com/sacloud/sacloud-sdk-go/api/simple-notification/apis/v1"
	sdksimplemq "github.com/sacloud/sacloud-sdk-go/api/simplemq"
	simplemqqueue "github.com/sacloud/sacloud-sdk-go/api/simplemq/apis/v1/queue"
	"github.com/sacloud/sacloud-sdk-go/common/saclient"
	mockapprunshared "github.com/sacloud/sakumock/apprun"
	mockapprundedicated "github.com/sacloud/sakumock/apprundedicated"
	mockiam "github.com/sacloud/sakumock/iam"
	mockkms "github.com/sacloud/sakumock/kms"
	mockobjectstorage "github.com/sacloud/sakumock/objectstorage"
	mocksecretmanager "github.com/sacloud/sakumock/secretmanager"
	mocksimplemq "github.com/sacloud/sakumock/simplemq"
	mocksimplenotification "github.com/sacloud/sakumock/simplenotification"
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
	seedDatabases()
	seedNFS()
	if err := seedDisks(); err != nil {
		return fmt.Errorf("failed to seed disks: %w", err)
	}
	if err := seedSwitches(); err != nil {
		return fmt.Errorf("failed to seed switches: %w", err)
	}
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
	if err := seedProxyLBs(); err != nil {
		return fmt.Errorf("failed to seed ELB/ProxyLBs: %w", err)
	}
	if err := seedEnhancedDBs(); err != nil {
		return fmt.Errorf("failed to seed enhanced DBs: %w", err)
	}

	kmsSrv := mockkms.NewTestServer(mockkms.Config{})
	if err := os.Setenv("SAKURA_ENDPOINTS_KMS", kmsSrv.TestURL()); err != nil {
		return err
	}
	kmsKeyIDs, err := seedKMSKeys()
	if err != nil {
		return fmt.Errorf("failed to seed KMS keys: %w", err)
	}

	secretManagerSrv := mocksecretmanager.NewTestServer(mocksecretmanager.Config{})
	if err := os.Setenv("SAKURA_ENDPOINTS_SECRETMANAGER", secretManagerSrv.TestURL()); err != nil {
		return err
	}
	if err := seedSecretManagerVaults(kmsKeyIDs[0]); err != nil {
		return fmt.Errorf("failed to seed secret manager vaults: %w", err)
	}

	iamSrv := mockiam.NewTestServer(mockiam.Config{})
	if err := os.Setenv("SAKURA_ENDPOINTS_IAM", iamSrv.TestURL()); err != nil {
		return err
	}
	if err := seedIAM(); err != nil {
		return fmt.Errorf("failed to seed IAM users/groups: %w", err)
	}

	simpleMQSrv := mocksimplemq.NewTestServer(mocksimplemq.Config{})
	if err := os.Setenv("SAKURA_ENDPOINTS_SIMPLE_MQ_QUEUE", simpleMQSrv.TestURL()); err != nil {
		return err
	}
	if err := os.Setenv("SAKURA_ENDPOINTS_SIMPLE_MQ_MESSAGE", simpleMQSrv.TestURL()); err != nil {
		return err
	}
	if err := seedSimpleMQQueues(); err != nil {
		return fmt.Errorf("failed to seed SimpleMQ queues: %w", err)
	}

	simpleNotificationSrv := mocksimplenotification.NewTestServer(mocksimplenotification.Config{})
	if err := os.Setenv("SAKURA_ENDPOINTS_SIMPLE_NOTIFICATION", simpleNotificationSrv.TestURL()); err != nil {
		return err
	}
	if err := seedSimpleNotification(); err != nil {
		return fmt.Errorf("failed to seed Simple Notification resources: %w", err)
	}

	// ObjectStorageのS3互換データプレーン(オブジェクト一覧・ダウンロード)はsakumock側で
	// `--enable-data-plane`により提供可能だが、外部プロセス(versitygw、PATH上に別途
	// インストールが必要)への委譲であり、かつcontrol planeで発行したアクセスキーが
	// data plane側では検証されない設計のため、ここでは有効化せずバケット/アクセスキーの
	// 管理API(control plane)のみE2E対象とする。詳細は docs/upstream-issues.md 参照。
	objectStorageSrv := mockobjectstorage.NewTestServer(mockobjectstorage.Config{})
	if err := os.Setenv("SAKURA_ENDPOINTS_OBJECT_STORAGE", objectStorageSrv.TestURL()); err != nil {
		return err
	}

	apprunDedicatedSrv := mockapprundedicated.NewTestServer(mockapprundedicated.Config{})
	if err := os.Setenv("SAKURA_ENDPOINTS_APPRUN_DEDICATED", apprunDedicatedSrv.TestURL()); err != nil {
		return err
	}
	if err := seedAppRunDedicated(apprunDedicatedSrv.TestURL()); err != nil {
		return fmt.Errorf("failed to seed AppRun dedicated resources: %w", err)
	}

	apprunSharedSrv := mockapprunshared.NewTestServer(mockapprunshared.Config{})
	if err := os.Setenv("SAKURA_ENDPOINTS_APPRUN_SHARED", apprunSharedSrv.TestURL()); err != nil {
		return err
	}
	if err := seedAppRunShared(apprunSharedSrv.TestURL()); err != nil {
		return fmt.Errorf("failed to seed AppRun shared resources: %w", err)
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

	srv := &http.Server{Addr: addr, Handler: mux}

	// `go run -cover`でビルドされた場合、カウンタはプロセスの正常終了時にしか
	// 書き出されない。PlaywrightのwebServerはSIGTERM/SIGINTでこのプロセスを
	// 止めるため、シグナルを受けて明示的にカバレッジデータをフラッシュしてから
	// シャットダウンする(GOCOVERDIR未設定/非計装ビルド時はWriteXxxDirがエラーを
	// 返すだけなので無視してよい)。
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, os.Interrupt, syscall.SIGTERM)
	go func() {
		sig := <-sigCh
		log.Printf("received signal %v, shutting down", sig)
		if dir := os.Getenv("GOCOVERDIR"); dir != "" {
			if err := coverage.WriteMetaDir(dir); err != nil {
				log.Printf("coverage.WriteMetaDir: %v", err)
			}
			if err := coverage.WriteCountersDir(dir); err != nil {
				log.Printf("coverage.WriteCountersDir: %v", err)
			}
		}
		_ = srv.Close()
	}()

	log.Printf("sakpilot e2e server listening on http://%s", addr)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		return err
	}
	return nil
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
		{900000000003, "e2e-poweruser-1", "E2E: パワーユーザー機能シナリオ用サーバー", 1, 1, types.ServerInstanceStatuses.Down, "192.0.2.3"},
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

	fake.DataStore.Put(fake.ResourceCDROM, e2eZone, types.ID(900000000101), &iaas.CDROM{
		ID:           900000000101,
		Name:         "e2e-iso-1",
		Description:  "E2E: CD-ROM挿入シナリオ用ISOイメージ",
		SizeMB:       1024,
		Availability: types.Availabilities.Available,
		CreatedAt:    now,
	})
}

// seedAppRunDedicated はAppRun専有型(sakumock apprundedicated)にE2Eシナリオ用の
// クラスタ・アプリケーション・ASG・LB・バージョンを投入する。
func seedAppRunDedicated(endpoint string) error {
	ctx := context.Background()
	var sc saclient.Client
	if err := sc.SetEnviron(append(os.Environ(),
		"SAKURA_ACCESS_TOKEN="+e2eAccessToken,
		"SAKURA_ACCESS_TOKEN_SECRET="+e2eSecretToken,
		"SAKURA_ENDPOINTS_APPRUN_DEDICATED="+endpoint,
	)); err != nil {
		return err
	}
	client, err := sdkapprundedicated.NewClient(&sc)
	if err != nil {
		return err
	}

	ports := []dedicatedv1.CreateLoadBalancerPort{
		{Port: 443, Protocol: dedicatedv1.CreateLoadBalancerPortProtocolHTTPS},
	}

	cluster, err := client.CreateCluster(ctx, &dedicatedv1.CreateCluster{
		Name:               "e2e-cluster",
		ServicePrincipalID: "123456789012",
		Ports:              ports,
	})
	if err != nil {
		return err
	}
	clusterID := cluster.Cluster.GetClusterID()

	if _, err := client.CreateCluster(ctx, &dedicatedv1.CreateCluster{
		Name:               "e2e-doomed-cluster",
		ServicePrincipalID: "123456789012",
		Ports:              ports,
	}); err != nil {
		return err
	}

	app, err := client.CreateApplication(ctx, &dedicatedv1.CreateApplication{
		Name:      "e2e-app",
		ClusterID: clusterID,
	})
	if err != nil {
		return err
	}
	appID := app.Application.GetApplicationID()

	if _, err := client.CreateApplication(ctx, &dedicatedv1.CreateApplication{
		Name:      "e2e-doomed-app",
		ClusterID: clusterID,
	}); err != nil {
		return err
	}

	versionOp := sdkapprundedicated.NewVersionOp(client, appID)
	if _, err := versionOp.Create(ctx, version.CreateParams{
		Image:                  "nginx:latest",
		CPU:                    1000,
		Memory:                 512,
		ScalingMode:            dedicatedv1.ScalingModeManual,
		FixedScale:             saclient.Ptr(int32(1)),
		RegistryPasswordAction: dedicatedv1.RegistryPasswordActionKeep,
	}); err != nil {
		return err
	}

	nameServers := []dedicatedv1.IPv4{"210.188.224.10"}
	asgInterfaces := []dedicatedv1.AutoScalingGroupNodeInterface{
		{InterfaceIndex: 0, Upstream: "shared"},
	}

	asgResp, err := client.CreateAutoScalingGroup(ctx, &dedicatedv1.CreateAutoScalingGroup{
		Name:                   "e2e-asg",
		Zone:                   e2eZone,
		WorkerServiceClassPath: "cloud/apprun/dedicated/worker/1vcpu_2gb",
		MinNodes:               1,
		MaxNodes:               1,
		NameServers:            nameServers,
		Interfaces:             asgInterfaces,
	}, dedicatedv1.CreateAutoScalingGroupParams{ClusterID: clusterID})
	if err != nil {
		return err
	}
	asgID := asgResp.AutoScalingGroup.GetAutoScalingGroupID()

	if _, err := client.CreateAutoScalingGroup(ctx, &dedicatedv1.CreateAutoScalingGroup{
		Name:                   "e2e-doomed-asg",
		Zone:                   e2eZone,
		WorkerServiceClassPath: "cloud/apprun/dedicated/worker/1vcpu_2gb",
		MinNodes:               1,
		MaxNodes:               1,
		NameServers:            nameServers,
		Interfaces:             asgInterfaces,
	}, dedicatedv1.CreateAutoScalingGroupParams{ClusterID: clusterID}); err != nil {
		return err
	}

	lbInterfaces := []dedicatedv1.LoadBalancerInterface{
		{InterfaceIndex: 0, Upstream: "shared"},
	}
	if _, err := client.CreateLoadBalancer(ctx, &dedicatedv1.CreateLoadBalancer{
		Name:             "e2e-lb",
		ServiceClassPath: "cloud/apprun/dedicated/lb/1vcpu_2gb",
		NameServers:      nameServers,
		Interfaces:       lbInterfaces,
	}, dedicatedv1.CreateLoadBalancerParams{ClusterID: clusterID, AutoScalingGroupID: asgID}); err != nil {
		return err
	}
	if _, err := client.CreateLoadBalancer(ctx, &dedicatedv1.CreateLoadBalancer{
		Name:             "e2e-doomed-lb",
		ServiceClassPath: "cloud/apprun/dedicated/lb/1vcpu_2gb",
		NameServers:      nameServers,
		Interfaces:       lbInterfaces,
	}, dedicatedv1.CreateLoadBalancerParams{ClusterID: clusterID, AutoScalingGroupID: asgID}); err != nil {
		return err
	}

	return nil
}

// seedAppRunShared はAppRun共用型(sakumock apprun)にE2Eシナリオ用のユーザーと
// アプリケーションを投入する。
func seedAppRunShared(endpoint string) error {
	ctx := context.Background()
	var sc saclient.Client
	if err := sc.SetEnviron(append(os.Environ(),
		"SAKURA_ACCESS_TOKEN="+e2eAccessToken,
		"SAKURA_ACCESS_TOKEN_SECRET="+e2eSecretToken,
		"SAKURA_ENDPOINTS_APPRUN_SHARED="+endpoint,
	)); err != nil {
		return err
	}
	client, err := sdkapprunshared.NewClient(&sc)
	if err != nil {
		return err
	}

	if _, err := sdkapprunshared.NewUserOp(client).Create(ctx); err != nil {
		return err
	}

	components := []sharedv1.PostApplicationBodyComponentsItem{
		{
			Name:      "web",
			MaxCPU:    sharedv1.PostApplicationBodyComponentsItemMaxCPU05,
			MaxMemory: sharedv1.PostApplicationBodyComponentsItemMaxMemory1Gi,
			DeploySource: sharedv1.PostApplicationBodyComponentsItemDeploySource{
				ContainerRegistry: sharedv1.NewOptPostApplicationBodyComponentsItemDeploySourceContainerRegistry(
					sharedv1.PostApplicationBodyComponentsItemDeploySourceContainerRegistry{
						Image: "nginx:latest",
					},
				),
			},
		},
	}

	appOp := sdkapprunshared.NewApplicationOp(client)
	if _, err := appOp.Create(ctx, &sharedv1.PostApplicationBody{
		Name:           "e2e-shared-app",
		TimeoutSeconds: 60,
		Port:           8080,
		MinScale:       0,
		MaxScale:       1,
		Components:     components,
	}); err != nil {
		return err
	}

	return nil
}

// seedDatabases はIaaS fakeドライバのデータストアにE2Eシナリオ用のデータベースを投入する。
func seedDatabases() {
	now := time.Now()

	type seed struct {
		id     types.ID
		name   string
		desc   string
		status types.EServerInstanceStatus
	}
	seeds := []seed{
		{920000000001, "e2e-db-1", "E2E: 起動中データベース(電源操作シナリオ用)", types.ServerInstanceStatuses.Up},
		{920000000002, "e2e-doomed-db", "E2E: 削除シナリオ用データベース", types.ServerInstanceStatuses.Down},
	}
	for _, s := range seeds {
		fake.DataStore.Put(fake.ResourceDatabase, e2eZone, s.id, &iaas.Database{
			ID:             s.id,
			Name:           s.name,
			Description:    s.desc,
			Class:          "database",
			InstanceStatus: s.status,
			Availability:   types.Availabilities.Available,
			Tags:           types.Tags{"env:e2e"},
			CreatedAt:      now,
			// Conf/CommonSettingは実際のDB作成時には必ず設定される値のため、
			// fakeドライバのGetParameter(Conf.DatabaseNameを無条件参照する)がnilポインタ参照で
			// panicしないようにシードデータでも設定しておく。
			Conf: &iaas.DatabaseRemarkDBConfCommon{
				DatabaseName:    "MariaDB",
				DatabaseVersion: "10.11",
			},
			CommonSetting: &iaas.DatabaseSettingCommon{
				ServicePort: 3306,
				DefaultUser: "e2euser",
			},
		})
	}
}

// seedNFS はIaaS fakeドライバのデータストアにE2Eシナリオ用のNFSを投入する。
func seedNFS() {
	now := time.Now()

	type seed struct {
		id     types.ID
		name   string
		desc   string
		status types.EServerInstanceStatus
	}
	seeds := []seed{
		{930000000001, "e2e-nfs-1", "E2E: 起動中NFS(電源操作シナリオ用)", types.ServerInstanceStatuses.Up},
		{930000000002, "e2e-doomed-nfs", "E2E: 削除シナリオ用NFS", types.ServerInstanceStatuses.Down},
		{930000000003, "e2e-edit-nfs", "E2E: 編集シナリオ用NFS", types.ServerInstanceStatuses.Up},
	}
	for _, s := range seeds {
		fake.DataStore.Put(fake.ResourceNFS, e2eZone, s.id, &iaas.NFS{
			ID:             s.id,
			Name:           s.name,
			Description:    s.desc,
			Class:          "nfs",
			InstanceStatus: s.status,
			Availability:   types.Availabilities.Available,
			Tags:           types.Tags{"env:e2e"},
			CreatedAt:      now,
		})
	}
}

// seedDisks はIaaS fakeドライバのデータストアにE2Eシナリオ用のディスクを投入する。
// e2e-connected-disk は seedServers が投入する e2e-web-1(900000000001)に接続した状態にする。
func seedDisks() error {
	ctx := context.Background()
	diskOp := iaas.NewDiskOp(nil)

	if _, err := diskOp.Create(ctx, e2eZone, &iaas.DiskCreateRequest{
		Name:        "e2e-disk",
		Description: "E2E: 編集シナリオ用",
		SizeMB:      20 * 1024,
		DiskPlanID:  types.DiskPlans.SSD,
		Connection:  types.DiskConnections.VirtIO,
	}, nil, types.ID(0)); err != nil {
		return err
	}

	if _, err := diskOp.Create(ctx, e2eZone, &iaas.DiskCreateRequest{
		Name:        "e2e-unconnected-disk",
		Description: "E2E: 接続シナリオ用",
		SizeMB:      20 * 1024,
		DiskPlanID:  types.DiskPlans.SSD,
		Connection:  types.DiskConnections.VirtIO,
	}, nil, types.ID(0)); err != nil {
		return err
	}

	connected, err := diskOp.Create(ctx, e2eZone, &iaas.DiskCreateRequest{
		Name:        "e2e-connected-disk",
		Description: "E2E: 切断シナリオ用",
		SizeMB:      20 * 1024,
		DiskPlanID:  types.DiskPlans.SSD,
		Connection:  types.DiskConnections.VirtIO,
	}, nil, types.ID(0))
	if err != nil {
		return err
	}
	if err := diskOp.ConnectToServer(ctx, e2eZone, connected.ID, 900000000001); err != nil {
		return err
	}

	if _, err := diskOp.Create(ctx, e2eZone, &iaas.DiskCreateRequest{
		Name:        "e2e-doomed-disk",
		Description: "E2E: 削除シナリオ用",
		SizeMB:      20 * 1024,
		DiskPlanID:  types.DiskPlans.SSD,
		Connection:  types.DiskConnections.VirtIO,
	}, nil, types.ID(0)); err != nil {
		return err
	}
	return nil
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

// seedSwitches はIaaS fakeドライバのデータストアにE2Eシナリオ用のスイッチを投入する。
func seedSwitches() error {
	ctx := context.Background()
	swOp := iaas.NewSwitchOp(nil)

	if _, err := swOp.Create(ctx, e2eZone, &iaas.SwitchCreateRequest{
		Name:        "e2e-switch",
		Description: "E2E: 編集シナリオ用",
	}); err != nil {
		return err
	}
	if _, err := swOp.Create(ctx, e2eZone, &iaas.SwitchCreateRequest{
		Name:        "e2e-doomed-switch",
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
		Timeout:     10,
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
		Timeout:     10,
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

// seedProxyLBs はIaaS fakeドライバのデータストアにE2Eシナリオ用のELB(ProxyLB)を投入する。
func seedProxyLBs() error {
	ctx := context.Background()
	lbOp := iaas.NewProxyLBOp(nil)

	if _, err := lbOp.Create(ctx, &iaas.ProxyLBCreateRequest{
		Name:        "e2e-elb",
		Description: "E2E: 証明書管理シナリオ用",
		Plan:        types.ProxyLBPlans.CPS100,
		BindPorts: []*iaas.ProxyLBBindPort{
			{ProxyMode: types.ProxyLBProxyModes.HTTPS, Port: 443},
		},
		Servers: []*iaas.ProxyLBServer{
			{IPAddress: "192.0.2.30", Port: 80, Enabled: true},
		},
	}); err != nil {
		return err
	}

	if _, err := lbOp.Create(ctx, &iaas.ProxyLBCreateRequest{
		Name:        "e2e-doomed-elb",
		Description: "E2E: 削除シナリオ用",
		Plan:        types.ProxyLBPlans.CPS100,
	}); err != nil {
		return err
	}
	return nil
}

// seedEnhancedDBs はIaaS fakeドライバのデータストアにE2Eシナリオ用のエンハンスドDBを投入する。
func seedEnhancedDBs() error {
	ctx := context.Background()
	edbOp := iaas.NewEnhancedDBOp(nil)

	if _, err := edbOp.Create(ctx, &iaas.EnhancedDBCreateRequest{
		Name:         "e2e-enhanceddb-1",
		Description:  "E2E: 表示・パスワード再設定シナリオ用",
		DatabaseName: "e2edb1",
		DatabaseType: types.EnhancedDBTypesTiDB,
		Region:       types.EnhancedDBRegionsIs1,
	}); err != nil {
		return err
	}
	if _, err := edbOp.Create(ctx, &iaas.EnhancedDBCreateRequest{
		Name:         "e2e-doomed-enhanceddb",
		Description:  "E2E: 削除シナリオ用",
		DatabaseName: "e2edoomed",
		DatabaseType: types.EnhancedDBTypesTiDB,
		Region:       types.EnhancedDBRegionsIs1,
	}); err != nil {
		return err
	}
	if _, err := edbOp.Create(ctx, &iaas.EnhancedDBCreateRequest{
		Name:         "e2e-editable-enhanceddb",
		Description:  "E2E: 編集シナリオ用",
		DatabaseName: "e2eeditable",
		DatabaseType: types.EnhancedDBTypesMariaDB,
		Region:       types.EnhancedDBRegionsIs1,
	}); err != nil {
		return err
	}
	return nil
}

// seedKMSKeys はsakumockのKMSサーバーにE2Eシナリオ用のキーを投入する。
func seedKMSKeys() ([]string, error) {
	var sc saclient.Client
	env := append(os.Environ(),
		"SAKURA_ACCESS_TOKEN="+e2eAccessToken,
		"SAKURA_ACCESS_TOKEN_SECRET="+e2eSecretToken,
	)
	if err := sc.SetEnviron(env); err != nil {
		return nil, err
	}
	client, err := sdkkms.NewClient(&sc)
	if err != nil {
		return nil, err
	}
	keyOp := sdkkms.NewKeyOp(client)

	var ids []string
	for _, name := range []string{"e2e-key-1", "e2e-doomed-key", "e2e-editable-key"} {
		created, err := keyOp.Create(context.Background(), kmsv1.CreateKey{
			Name:      name,
			KeyOrigin: kmsv1.KeyOriginEnumGenerated,
			Tags:      []string{"env:e2e"},
		})
		if err != nil {
			return nil, err
		}
		ids = append(ids, created.ID)
	}
	return ids, nil
}

// seedSecretManagerVaults はsakumockのSecret Managerサーバーに
// E2Eシナリオ用のVaultとSecretを投入する。KmsKeyIDにはseedKMSKeysが
// 作成したKMSキーの1つを流用する(secretmanager自体はKmsKeyIDの実在性を
// 検証しないが、フロントのVault作成フォームがGetKMSKeysの結果と同じ値を
// 使う想定と揃えておく)。
func seedSecretManagerVaults(kmsKeyID string) error {
	var sc saclient.Client
	env := append(os.Environ(),
		"SAKURA_ACCESS_TOKEN="+e2eAccessToken,
		"SAKURA_ACCESS_TOKEN_SECRET="+e2eSecretToken,
	)
	if err := sc.SetEnviron(env); err != nil {
		return err
	}
	client, err := sdksecretmanager.NewClient(&sc)
	if err != nil {
		return err
	}
	vaultOp := sdksecretmanager.NewVaultOp(client)

	vault, err := vaultOp.Create(context.Background(), secretmanagerv1.CreateVault{
		Name:        "e2e-vault-1",
		Description: secretmanagerv1.NewOptString("E2E: シークレット表示/追加シナリオ用"),
		KmsKeyID:    kmsKeyID,
		Tags:        []string{"env:e2e"},
	})
	if err != nil {
		return err
	}
	secretOp := sdksecretmanager.NewSecretOp(client, vault.ID)
	if _, err := secretOp.Create(context.Background(), secretmanagerv1.CreateSecret{
		Name:  "e2e-secret",
		Value: "e2e-secret-value",
	}); err != nil {
		return err
	}

	for _, name := range []string{"e2e-doomed-vault", "e2e-editable-vault"} {
		if _, err := vaultOp.Create(context.Background(), secretmanagerv1.CreateVault{
			Name:     name,
			KmsKeyID: kmsKeyID,
			Tags:     []string{"env:e2e"},
		}); err != nil {
			return err
		}
	}
	return nil
}

// seedSimpleMQQueues はsakumockのSimpleMQサーバーにE2Eシナリオ用のQueueを投入する。
func seedSimpleMQQueues() error {
	var sc saclient.Client
	env := append(os.Environ(),
		"SAKURA_ACCESS_TOKEN="+e2eAccessToken,
		"SAKURA_ACCESS_TOKEN_SECRET="+e2eSecretToken,
	)
	if err := sc.SetEnviron(env); err != nil {
		return err
	}
	queueClient, err := sdksimplemq.NewQueueClient(&sc)
	if err != nil {
		return err
	}
	queueOp := sdksimplemq.NewQueueOp(queueClient)

	for _, name := range []string{"e2e-queue-1", "e2e-doomed-queue", "e2e-editable-queue"} {
		if _, err := queueOp.Create(context.Background(), simplemqqueue.CreateQueueRequest{
			CommonServiceItem: simplemqqueue.CreateQueueRequestCommonServiceItem{
				Name: simplemqqueue.QueueName(name),
				Tags: []string{"env:e2e"},
			},
		}); err != nil {
			return err
		}
	}
	return nil
}

// seedSimpleNotification はsakumockのSimple Notificationサーバーに
// E2Eシナリオ用の送信先・グループ・ルーティングを投入する。
func seedSimpleNotification() error {
	var sc saclient.Client
	env := append(os.Environ(),
		"SAKURA_ACCESS_TOKEN="+e2eAccessToken,
		"SAKURA_ACCESS_TOKEN_SECRET="+e2eSecretToken,
	)
	if err := sc.SetEnviron(env); err != nil {
		return err
	}
	client, err := sdksimplenotification.NewClient(&sc)
	if err != nil {
		return err
	}
	ctx := context.Background()

	destinationOp := sdksimplenotification.NewDestinationOp(client)
	newDestination := func(name string) (string, error) {
		created, err := destinationOp.Create(ctx, simplenotificationv1.PostCommonServiceItemRequest{
			CommonServiceItem: simplenotificationv1.PostCommonServiceItemRequestCommonServiceItem{
				Name:        name,
				Description: "E2E: SimpleNotification表示確認シナリオ用",
				Tags:        []string{"env:e2e"},
				Icon:        simplenotificationv1.NilCommonServiceItemIcon{Null: true},
				Settings: simplenotificationv1.CommonServiceItemSettings{
					Type: simplenotificationv1.DestinationSettingsCommonServiceItemSettings,
					DestinationSettings: simplenotificationv1.DestinationSettings{
						Type:  simplenotificationv1.DestinationSettingsTypeEmail,
						Value: "e2e-alert@example.com",
					},
				},
			},
		})
		if err != nil {
			return "", err
		}
		return created.CommonServiceItem.ID, nil
	}

	destID, err := newDestination("e2e-destination-1")
	if err != nil {
		return err
	}
	if _, err := newDestination("e2e-destination-doomed"); err != nil {
		return err
	}
	if _, err := newDestination("e2e-destination-editable"); err != nil {
		return err
	}

	groupOp := sdksimplenotification.NewGroupOp(client)
	newGroup := func(name string) (string, error) {
		created, err := groupOp.Create(ctx, simplenotificationv1.PostCommonServiceItemRequest{
			CommonServiceItem: simplenotificationv1.PostCommonServiceItemRequestCommonServiceItem{
				Name:        name,
				Description: "E2E: SimpleNotification表示確認シナリオ用",
				Tags:        []string{"env:e2e"},
				Icon:        simplenotificationv1.NilCommonServiceItemIcon{Null: true},
				Settings: simplenotificationv1.CommonServiceItemSettings{
					Type: simplenotificationv1.GroupSettingsCommonServiceItemSettings,
					GroupSettings: simplenotificationv1.GroupSettings{
						Destinations: []string{destID},
					},
				},
			},
		})
		if err != nil {
			return "", err
		}
		return created.CommonServiceItem.ID, nil
	}

	groupID, err := newGroup("e2e-group-1")
	if err != nil {
		return err
	}
	if _, err := newGroup("e2e-group-doomed"); err != nil {
		return err
	}
	if _, err := newGroup("e2e-group-editable"); err != nil {
		return err
	}

	routingOp := sdksimplenotification.NewRoutingOp(client)
	newRouting := func(name string) error {
		_, err := routingOp.Create(ctx, simplenotificationv1.PostCommonServiceItemRequest{
			CommonServiceItem: simplenotificationv1.PostCommonServiceItemRequestCommonServiceItem{
				Name:        name,
				Description: "E2E: SimpleNotification表示確認シナリオ用",
				Tags:        []string{"env:e2e"},
				Icon:        simplenotificationv1.NilCommonServiceItemIcon{Null: true},
				Settings: simplenotificationv1.CommonServiceItemSettings{
					Type: simplenotificationv1.RoutingSettingsCommonServiceItemSettings,
					RoutingSettings: simplenotificationv1.RoutingSettings{
						MatchLabels: []simplenotificationv1.RoutingSettingsMatchLabelsItem{
							{Name: "severity", Value: "critical"},
						},
						SourceID:      "101122334455",
						TargetGroupID: groupID,
						PriorityRank:  1,
					},
				},
			},
		})
		return err
	}

	if err := newRouting("e2e-routing-1"); err != nil {
		return err
	}
	if err := newRouting("e2e-routing-doomed"); err != nil {
		return err
	}
	if err := newRouting("e2e-routing-editable"); err != nil {
		return err
	}
	return nil
}

// seedIAM はsakumockのIAMサーバーにE2Eシナリオ用のユーザー・グループ・サービスプリンシパルを投入する。
// IAMロール/IDロールはsakumock側に固定の定義(owner/editor/viewer等)が
// 最初から用意されているため、ここでの投入は不要。
func seedIAM() error {
	var sc saclient.Client
	env := append(os.Environ(),
		"SAKURA_ACCESS_TOKEN="+e2eAccessToken,
		"SAKURA_ACCESS_TOKEN_SECRET="+e2eSecretToken,
	)
	if err := sc.SetEnviron(env); err != nil {
		return err
	}
	client, err := sdkiam.NewClient(&sc)
	if err != nil {
		return err
	}

	userOp := sdkiam.NewUserOp(client)
	email := "e2e-user-1@example.com"
	if _, err := userOp.Create(context.Background(), iamuser.CreateParams{
		Name:        "e2e-user-1",
		Password:    "E2ePassword123!",
		Code:        "e2euser001",
		Description: "E2E: IAM表示確認シナリオ用",
		Email:       &email,
	}); err != nil {
		return err
	}

	groupOp := sdkiam.NewGroupOp(client)
	if _, err := groupOp.Create(context.Background(), "e2e-group-1", "E2E: IAM表示確認シナリオ用"); err != nil {
		return err
	}

	servicePrincipalOp := sdkiam.NewServicePrincipalOp(client)
	sp, err := servicePrincipalOp.Create(context.Background(), iamserviceprincipal.CreateParams{
		ProjectID:   1,
		Name:        "e2e-service-principal-1",
		Description: "E2E: 表示/キー管理シナリオ用",
	})
	if err != nil {
		return err
	}
	if _, err := servicePrincipalOp.UploadKey(context.Background(), sp.ID, "-----BEGIN PUBLIC KEY-----e2e-seed-key-----END PUBLIC KEY-----"); err != nil {
		return err
	}

	for _, name := range []string{"e2e-service-principal-doomed", "e2e-service-principal-editable"} {
		if _, err := servicePrincipalOp.Create(context.Background(), iamserviceprincipal.CreateParams{
			ProjectID: 1,
			Name:      name,
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
