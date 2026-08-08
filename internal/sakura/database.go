package sakura

import (
	"context"
	"time"

	"github.com/sacloud/sacloud-sdk-go/api/iaas"
	"github.com/sacloud/sacloud-sdk-go/api/iaas/types"
)

type DatabaseInfo struct {
	ID                     string   `json:"id"`
	Name                   string   `json:"name"`
	Description            string   `json:"description"`
	Zone                   string   `json:"zone"`
	Status                 string   `json:"status"`
	Availability           string   `json:"availability"`
	IPAddresses            []string `json:"ipAddresses"`
	Tags                   []string `json:"tags"`
	CreatedAt              string   `json:"createdAt"`
	PlanID                 string   `json:"planId"`
	SwitchID               string   `json:"switchId"`
	DefaultRoute           string   `json:"defaultRoute"`
	NetworkMaskLen         int      `json:"networkMaskLen"`
	RDBMSType              string   `json:"rdbmsType"`
	RDBMSVersion           string   `json:"rdbmsVersion"`
	RDBMSRevision          string   `json:"rdbmsRevision"`
	DefaultUser            string   `json:"defaultUser"`
	ServicePort            int      `json:"servicePort"`
	ReplicaUser            string   `json:"replicaUser"`
	SourceNetwork          []string `json:"sourceNetwork"`
	MonitoringSuiteEnabled bool     `json:"monitoringSuiteEnabled"`
}

type DatabaseService struct {
	client *Client
}

func NewDatabaseService(client *Client) *DatabaseService {
	return &DatabaseService{client: client}
}

func databaseInfoFromSDK(zone string, db *iaas.Database) DatabaseInfo {
	info := DatabaseInfo{
		ID:             db.ID.String(),
		Name:           db.Name,
		Description:    db.Description,
		Zone:           zone,
		Status:         string(db.InstanceStatus),
		Availability:   string(db.Availability),
		IPAddresses:    db.IPAddresses,
		Tags:           db.Tags,
		CreatedAt:      db.CreatedAt.Format(time.RFC3339),
		PlanID:         db.PlanID.String(),
		SwitchID:       db.SwitchID.String(),
		DefaultRoute:   db.DefaultRoute,
		NetworkMaskLen: db.NetworkMaskLen,
	}
	if db.Conf != nil {
		info.RDBMSType = db.Conf.DatabaseName
		info.RDBMSVersion = db.Conf.DatabaseVersion
		info.RDBMSRevision = db.Conf.DatabaseRevision
	}
	if db.CommonSetting != nil {
		info.DefaultUser = db.CommonSetting.DefaultUser
		info.ServicePort = db.CommonSetting.ServicePort
		info.ReplicaUser = db.CommonSetting.ReplicaUser
		info.SourceNetwork = db.CommonSetting.SourceNetwork
	}
	if db.MonitoringSuite != nil {
		info.MonitoringSuiteEnabled = db.MonitoringSuite.Enabled
	}
	return info
}

func (s *DatabaseService) List(ctx context.Context, zone string) ([]DatabaseInfo, error) {
	dbOp := iaas.NewDatabaseOp(s.client.Caller())
	result, err := dbOp.Find(ctx, zone, &iaas.FindCondition{})
	if err != nil {
		return nil, err
	}

	databases := make([]DatabaseInfo, 0, len(result.Databases))
	for _, db := range result.Databases {
		databases = append(databases, databaseInfoFromSDK(zone, db))
	}
	return databases, nil
}

func (s *DatabaseService) Get(ctx context.Context, zone string, databaseID string) (*DatabaseInfo, error) {
	dbOp := iaas.NewDatabaseOp(s.client.Caller())
	db, err := dbOp.Read(ctx, zone, types.StringID(databaseID))
	if err != nil {
		return nil, err
	}
	info := databaseInfoFromSDK(zone, db)
	return &info, nil
}

// CreateDatabaseParams はデータベースアプライアンス作成時のパラメータ。
// 冗長化構成(Proxyプラン)やマスター/スレーブのレプリケーション設定は対象外とし、非冗長化の単体構成のみサポートする。
type CreateDatabaseParams struct {
	Name                   string
	Description            string
	Tags                   []string
	Plan                   string // "10g"/"30g"/"90g"/"240g"/"500g"/"1t" (types.DatabasePlanStrings参照)
	SwitchID               string
	IPAddress              string
	NetworkMaskLen         int
	DefaultRoute           string
	RDBMSType              string // "mariadb"/"postgres"
	DefaultUser            string
	UserPassword           string
	ReplicaUser            string
	ReplicaPassword        string
	ServicePort            int
	SourceNetwork          []string
	MonitoringSuiteEnabled bool
}

func (s *DatabaseService) Create(ctx context.Context, zone string, params CreateDatabaseParams) (*DatabaseInfo, error) {
	dbOp := iaas.NewDatabaseOp(s.client.Caller())

	rdbmsType := types.RDBMSTypesMariaDB.String()
	if params.RDBMSType == "postgres" {
		rdbmsType = types.RDBMSTypesPostgreSQL.String()
	}

	db, err := dbOp.Create(ctx, zone, &iaas.DatabaseCreateRequest{
		PlanID:         types.DatabasePlanIDMap[params.Plan],
		SwitchID:       types.StringID(params.SwitchID),
		IPAddresses:    []string{params.IPAddress},
		NetworkMaskLen: params.NetworkMaskLen,
		DefaultRoute:   params.DefaultRoute,
		Name:           params.Name,
		Description:    params.Description,
		Tags:           params.Tags,
		Conf: &iaas.DatabaseRemarkDBConfCommon{
			DatabaseName: rdbmsType,
			DefaultUser:  params.DefaultUser,
			UserPassword: params.UserPassword,
		},
		CommonSetting: &iaas.DatabaseSettingCommon{
			ServicePort:     params.ServicePort,
			SourceNetwork:   params.SourceNetwork,
			DefaultUser:     params.DefaultUser,
			UserPassword:    params.UserPassword,
			ReplicaUser:     params.ReplicaUser,
			ReplicaPassword: params.ReplicaPassword,
		},
		MonitoringSuite: &iaas.MonitoringSuite{
			Enabled: params.MonitoringSuiteEnabled,
		},
	})
	if err != nil {
		return nil, err
	}
	info := databaseInfoFromSDK(zone, db)
	return &info, nil
}

// Update は名前・説明・タグを更新する。稼働設定(CommonSetting等)は既存のものを維持したまま送信する
// (Update APIはSettingsも含むリクエスト構造のため、空で送ると設定が失われる)。
func (s *DatabaseService) Update(ctx context.Context, zone string, databaseID string, name string, description string, tags []string) (*DatabaseInfo, error) {
	dbOp := iaas.NewDatabaseOp(s.client.Caller())
	id := types.StringID(databaseID)
	current, err := dbOp.Read(ctx, zone, id)
	if err != nil {
		return nil, err
	}
	db, err := dbOp.Update(ctx, zone, id, &iaas.DatabaseUpdateRequest{
		Name:               name,
		Description:        description,
		Tags:               tags,
		CommonSetting:      current.CommonSetting,
		BackupSetting:      current.BackupSetting,
		Backupv2Setting:    backupv2FromView(current.Backupv2Setting),
		ReplicationSetting: current.ReplicationSetting,
		InterfaceSettings:  current.InterfaceSettings,
		MonitoringSuite:    current.MonitoringSuite,
		SettingsHash:       current.SettingsHash,
	})
	if err != nil {
		return nil, err
	}
	info := databaseInfoFromSDK(zone, db)
	return &info, nil
}

// DatabaseSettingsParams はデータベースの稼働設定(接続ユーザー・ポート・監視)更新パラメータ。
type DatabaseSettingsParams struct {
	DefaultUser            string
	UserPassword           string
	ReplicaUser            string
	ReplicaPassword        string
	ServicePort            int
	SourceNetwork          []string
	MonitoringSuiteEnabled bool
}

// UpdateSettings はデータベースの稼働設定(接続ユーザー・ポート・監視)を更新する。名前・説明は変更しない。
func (s *DatabaseService) UpdateSettings(ctx context.Context, zone string, databaseID string, params DatabaseSettingsParams) (*DatabaseInfo, error) {
	dbOp := iaas.NewDatabaseOp(s.client.Caller())
	id := types.StringID(databaseID)
	current, err := dbOp.Read(ctx, zone, id)
	if err != nil {
		return nil, err
	}
	// パスワードが空欄の場合は「変更しない」とみなし、既存の値を維持する
	userPassword := params.UserPassword
	replicaPassword := params.ReplicaPassword
	if current.CommonSetting != nil {
		if userPassword == "" {
			userPassword = current.CommonSetting.UserPassword
		}
		if replicaPassword == "" {
			replicaPassword = current.CommonSetting.ReplicaPassword
		}
	}
	db, err := dbOp.UpdateSettings(ctx, zone, id, &iaas.DatabaseUpdateSettingsRequest{
		CommonSetting: &iaas.DatabaseSettingCommon{
			ServicePort:     params.ServicePort,
			SourceNetwork:   params.SourceNetwork,
			DefaultUser:     params.DefaultUser,
			UserPassword:    userPassword,
			ReplicaUser:     params.ReplicaUser,
			ReplicaPassword: replicaPassword,
		},
		BackupSetting:      current.BackupSetting,
		Backupv2Setting:    backupv2FromView(current.Backupv2Setting),
		ReplicationSetting: current.ReplicationSetting,
		InterfaceSettings:  current.InterfaceSettings,
		MonitoringSuite: &iaas.MonitoringSuite{
			Enabled: params.MonitoringSuiteEnabled,
		},
		SettingsHash: current.SettingsHash,
	})
	if err != nil {
		return nil, err
	}
	info := databaseInfoFromSDK(zone, db)
	return &info, nil
}

func backupv2FromView(v *iaas.DatabaseSettingBackupv2View) *iaas.DatabaseSettingBackupv2 {
	if v == nil {
		return nil
	}
	return &iaas.DatabaseSettingBackupv2{
		Rotate:    v.Rotate,
		Time:      v.Time,
		DayOfWeek: v.DayOfWeek,
		Connect:   v.Connect,
	}
}

// DatabaseParameterInfo はDBパラメータグループの現在値と設定可能な項目一覧。
type DatabaseParameterInfo struct {
	Settings map[string]any              `json:"settings"`
	Meta     []DatabaseParameterMetaInfo `json:"meta"`
}

type DatabaseParameterMetaInfo struct {
	Type    string  `json:"type"`
	Name    string  `json:"name"`
	Label   string  `json:"label"`
	Text    string  `json:"text"`
	Example string  `json:"example"`
	Min     float64 `json:"min"`
	Max     float64 `json:"max"`
	MaxLen  int     `json:"maxLen"`
	Reboot  string  `json:"reboot"`
}

func (s *DatabaseService) GetParameter(ctx context.Context, zone string, databaseID string) (*DatabaseParameterInfo, error) {
	dbOp := iaas.NewDatabaseOp(s.client.Caller())
	param, err := dbOp.GetParameter(ctx, zone, types.StringID(databaseID))
	if err != nil {
		return nil, err
	}

	meta := make([]DatabaseParameterMetaInfo, 0, len(param.MetaInfo))
	for _, m := range param.MetaInfo {
		meta = append(meta, DatabaseParameterMetaInfo{
			Type:    m.Type,
			Name:    m.Name,
			Label:   m.Label,
			Text:    m.Text,
			Example: m.Example,
			Min:     m.Min,
			Max:     m.Max,
			MaxLen:  m.MaxLen,
			Reboot:  m.Reboot,
		})
	}
	return &DatabaseParameterInfo{
		Settings: param.Settings,
		Meta:     meta,
	}, nil
}

// SetParameter はDBパラメータを設定する。値にnilを指定するとそのキーの設定をリセットする。
func (s *DatabaseService) SetParameter(ctx context.Context, zone string, databaseID string, params map[string]any) error {
	dbOp := iaas.NewDatabaseOp(s.client.Caller())
	return dbOp.SetParameter(ctx, zone, types.StringID(databaseID), params)
}

func (s *DatabaseService) PowerOn(ctx context.Context, zone string, databaseID string) error {
	dbOp := iaas.NewDatabaseOp(s.client.Caller())
	id := types.StringID(databaseID)
	return dbOp.Boot(ctx, zone, id)
}

func (s *DatabaseService) PowerOff(ctx context.Context, zone string, databaseID string) error {
	dbOp := iaas.NewDatabaseOp(s.client.Caller())
	id := types.StringID(databaseID)
	return dbOp.Shutdown(ctx, zone, id, &iaas.ShutdownOption{Force: false})
}

func (s *DatabaseService) ForceStop(ctx context.Context, zone string, databaseID string) error {
	dbOp := iaas.NewDatabaseOp(s.client.Caller())
	id := types.StringID(databaseID)
	return dbOp.Shutdown(ctx, zone, id, &iaas.ShutdownOption{Force: true})
}

func (s *DatabaseService) Reset(ctx context.Context, zone string, databaseID string) error {
	dbOp := iaas.NewDatabaseOp(s.client.Caller())
	id := types.StringID(databaseID)
	return dbOp.Reset(ctx, zone, id)
}

func (s *DatabaseService) Delete(ctx context.Context, zone string, databaseID string) error {
	dbOp := iaas.NewDatabaseOp(s.client.Caller())
	id := types.StringID(databaseID)
	return dbOp.Delete(ctx, zone, id)
}

func (s *DatabaseService) GetStatus(ctx context.Context, zone string, databaseID string) (string, error) {
	dbOp := iaas.NewDatabaseOp(s.client.Caller())
	id := types.StringID(databaseID)
	db, err := dbOp.Read(ctx, zone, id)
	if err != nil {
		return "", err
	}
	return string(db.InstanceStatus), nil
}
