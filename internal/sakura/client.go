package sakura

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/sacloud/sacloud-sdk-go/api/iaas"
	"github.com/sacloud/sacloud-sdk-go/common/saclient"
)

type Client struct {
	caller            iaas.APICaller
	accessToken       string
	accessTokenSecret string
	profileName       string
	defaultZone       string
}

type ProfileInfo struct {
	Name              string `json:"name"`
	IsCurrent         bool   `json:"isCurrent"`
	DefaultZone       string `json:"defaultZone"`
	AccessTokenPrefix string `json:"accessTokenPrefix"`
}

type profileConfig struct {
	AccessToken       string `json:"AccessToken"`
	AccessTokenSecret string `json:"AccessTokenSecret"`
	Zone              string `json:"Zone"`
}

func NewClientFromProfile(profileName string) (*Client, error) {
	cfg, err := loadProfileConfig(profileName)
	if err != nil {
		return nil, fmt.Errorf("failed to load profile %s: %w", profileName, err)
	}

	tokenPrefix := cfg.AccessToken
	if len(tokenPrefix) > 8 {
		tokenPrefix = tokenPrefix[:8]
	}
	println("NewClientFromProfile:", profileName, "token prefix:", tokenPrefix)

	// クライアントを作成(HTTPアクセスログ出力用のミドルウェアを追加するため、
	// deprecatedなiaas.NewClientではなくsaclient.Client経由で構築する)
	sa := &saclient.Client{}
	if err := sa.SetEnviron([]string{
		"SAKURACLOUD_ACCESS_TOKEN=" + cfg.AccessToken,
		"SAKURACLOUD_ACCESS_TOKEN_SECRET=" + cfg.AccessTokenSecret,
	}); err != nil {
		return nil, err
	}
	if err := sa.SetWith(saclient.WithMiddleware(httpAccessLogMiddleware)); err != nil {
		return nil, err
	}
	caller := iaas.NewClientFromSaclient(sa)
	op := iaas.NewAuthStatusOp(caller)
	read, err := op.Read(context.Background())
	if err != nil {
		return nil, err
	}
	fmt.Printf("status, profileName=%s, accessTokenPrefix=%s..., accountName=%s, memberCode=%s, authMethod=%s\n",
		profileName,
		tokenPrefix,
		read.AccountName,
		read.MemberCode,
		read.AuthMethod)

	return &Client{
		caller:            caller,
		accessToken:       cfg.AccessToken,
		accessTokenSecret: cfg.AccessTokenSecret,
		profileName:       profileName,
		defaultZone:       cfg.Zone,
	}, nil
}

func loadProfileConfig(profileName string) (*profileConfig, error) {
	usacloudDir := getUsacloudDir()
	configPath := filepath.Join(usacloudDir, profileName, "config.json")
	data, err := os.ReadFile(configPath)
	if err != nil {
		return nil, err
	}
	var cfg profileConfig
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, err
	}
	tokenPrefix := cfg.AccessToken
	if len(tokenPrefix) > 8 {
		tokenPrefix = tokenPrefix[:8]
	}
	fmt.Printf("Loading profile %s, accessTokenPrefix=%s...\n", profileName, tokenPrefix)
	return &cfg, nil
}

// httpAccessLogMiddleware はSakura Cloud APIへのHTTPリクエストのアクセス履歴を
// wailsのログ(標準出力)に出力する。Authorizationヘッダやボディは機密情報(トークン等)を
// 含み得るため出力せず、メソッド・パス・ステータスコード・所要時間のみ記録する。
func httpAccessLogMiddleware(req *http.Request, pull func() (saclient.Middleware, bool)) (*http.Response, error) {
	next, ok := pull()
	if !ok {
		return nil, fmt.Errorf("sakura: no next middleware to pull")
	}

	start := time.Now()
	resp, err := next(req, pull)
	elapsed := time.Since(start).Round(time.Millisecond)

	if err != nil {
		log.Printf("[sakura-api] %s %s -> error: %v (%s)", req.Method, req.URL.Path, err, elapsed)
		return resp, err
	}

	status := 0
	if resp != nil {
		status = resp.StatusCode
	}
	log.Printf("[sakura-api] %s %s -> %d (%s)", req.Method, req.URL.Path, status, elapsed)

	return resp, err
}

func (c *Client) Caller() iaas.APICaller {
	return c.caller
}

func (c *Client) ProfileName() string {
	return c.profileName
}

func (c *Client) DefaultZone() string {
	if c.defaultZone == "" {
		return "is1a"
	}
	return c.defaultZone
}

func (c *Client) Credentials() (string, string) {
	return c.accessToken, c.accessTokenSecret
}

func ListProfiles() ([]ProfileInfo, error) {
	usacloudDir := getUsacloudDir()
	entries, err := os.ReadDir(usacloudDir)
	if err != nil {
		return nil, err
	}

	currentProfile := getCurrentProfileName()
	profiles := make([]ProfileInfo, 0)

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		name := entry.Name()
		if strings.HasPrefix(name, ".") {
			continue
		}
		configPath := filepath.Join(usacloudDir, name, "config.json")
		if _, err := os.Stat(configPath); err == nil {
			cfg, _ := loadProfileConfig(name)
			defaultZone := ""
			accessTokenPrefix := ""
			if cfg != nil {
				defaultZone = cfg.Zone
				if len(cfg.AccessToken) >= 8 {
					accessTokenPrefix = cfg.AccessToken[:8]
				} else if len(cfg.AccessToken) > 0 {
					accessTokenPrefix = cfg.AccessToken
				}
			}
			profiles = append(profiles, ProfileInfo{
				Name:              name,
				IsCurrent:         name == currentProfile,
				DefaultZone:       defaultZone,
				AccessTokenPrefix: accessTokenPrefix,
			})
		}
	}
	return profiles, nil
}

func getCurrentProfileName() string {
	usacloudDir := getUsacloudDir()
	currentFile := filepath.Join(usacloudDir, "current")
	data, err := os.ReadFile(currentFile)
	if err != nil {
		return "default"
	}
	return strings.TrimSpace(string(data))
}

func getUsacloudDir() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".usacloud")
}
