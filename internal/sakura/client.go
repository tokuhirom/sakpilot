package sakura

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/sacloud/iaas-api-go"
)

type Client struct {
	caller            iaas.APICaller
	accessToken       string
	accessTokenSecret string
	profileName       string
	defaultZone       string
}

type ProfileInfo struct {
	Name        string `json:"name"`
	IsCurrent   bool   `json:"isCurrent"`
	DefaultZone string `json:"defaultZone"`
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

	println("NewClientFromProfile:", profileName, "token prefix:", cfg.AccessToken[:8])

	// クライアントを作成
	//nolint:staticcheck // deprecated but works, migration to saclient is complex
	caller := iaas.NewClient(cfg.AccessToken, cfg.AccessTokenSecret)
	op := iaas.NewAuthStatusOp(caller)
	read, err := op.Read(context.Background())
	if err != nil {
		return nil, err
	}
	fmt.Printf("status, profileName=%s, accessToken=%s, accountName=%s, memberCode=%s, authMethod=%s\n",
		profileName,
		cfg.AccessToken,
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
	fmt.Printf("Loading profile %s, accessToken=%s\n", profileName, cfg.AccessToken)
	return &cfg, nil
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
			if cfg != nil {
				defaultZone = cfg.Zone
			}
			profiles = append(profiles, ProfileInfo{
				Name:        name,
				IsCurrent:   name == currentProfile,
				DefaultZone: defaultZone,
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
