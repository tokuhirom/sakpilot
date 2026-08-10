package secretmanager_test

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

// writeUsacloudProfile creates a throwaway ~/.usacloud/<name>/config.json
// under a temp HOME, mirroring how secretmanager.NewService(profileName)
// resolves credentials in production. Returns the profile name to pass to
// NewService.
func writeUsacloudProfile(t *testing.T, accessToken, accessTokenSecret string) string {
	t.Helper()

	home := t.TempDir()
	t.Setenv("HOME", home)

	const profileName = "test-profile"
	dir := filepath.Join(home, ".usacloud", profileName)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}

	data, err := json.Marshal(map[string]string{
		"AccessToken":       accessToken,
		"AccessTokenSecret": accessTokenSecret,
	})
	if err != nil {
		t.Fatalf("Marshal: %v", err)
	}
	if err := os.WriteFile(filepath.Join(dir, "config.json"), data, 0o600); err != nil {
		t.Fatalf("WriteFile: %v", err)
	}

	return profileName
}
