package sakura

var Zones = []string{
	"is1a", // 石狩第1ゾーン
	"is1b", // 石狩第2ゾーン
	"tk1a", // 東京第1ゾーン
	"tk1b", // 東京第2ゾーン
	"tk1v", // サンドボックス
}

type ZoneInfo struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

func GetZones() []ZoneInfo {
	return []ZoneInfo{
		{ID: "is1a", Name: "石狩第1ゾーン"},
		{ID: "is1b", Name: "石狩第2ゾーン"},
		{ID: "tk1a", Name: "東京第1ゾーン"},
		{ID: "tk1b", Name: "東京第2ゾーン"},
		{ID: "tk1v", Name: "サンドボックス"},
	}
}
