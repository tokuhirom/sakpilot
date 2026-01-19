package sakura

import (
	"context"
	"os"

	"github.com/sacloud/iaas-api-go"
	"github.com/sacloud/saclient-go"
)

// CreateProfile creates a new profile with the given credentials
func CreateProfile(name, accessToken, accessTokenSecret, zone string) error {
	op := saclient.NewProfileOp(os.Environ())

	profile := &saclient.Profile{
		Name: name,
		Attributes: map[string]any{
			"AccessToken":       accessToken,
			"AccessTokenSecret": accessTokenSecret,
			"Zone":              zone,
		},
	}
	return op.Create(profile)
}

// DeleteProfile deletes the profile with the given name
func DeleteProfile(name string) error {
	op := saclient.NewProfileOp(os.Environ())
	return op.Delete(name)
}

// UpdateProfile updates an existing profile with the given credentials
// If newName is different from oldName, the profile will be renamed
func UpdateProfile(oldName, newName, accessToken, accessTokenSecret, zone string) error {
	op := saclient.NewProfileOp(os.Environ())

	if oldName != newName {
		// Rename: create new profile and delete old one
		newProfile := &saclient.Profile{
			Name: newName,
			Attributes: map[string]any{
				"AccessToken":       accessToken,
				"AccessTokenSecret": accessTokenSecret,
				"Zone":              zone,
			},
		}
		if err := op.Create(newProfile); err != nil {
			return err
		}

		// Update current profile if needed
		currentName, _ := op.GetCurrentName()
		if currentName == oldName {
			if err := op.SetCurrentName(newName); err != nil {
				return err
			}
		}

		// Delete old profile
		return op.Delete(oldName)
	}

	// Same name: just update
	profile := &saclient.Profile{
		Name: oldName,
		Attributes: map[string]any{
			"AccessToken":       accessToken,
			"AccessTokenSecret": accessTokenSecret,
			"Zone":              zone,
		},
	}
	_, err := op.Update(profile)
	return err
}

// ProfileCredentials contains the credentials for a profile
type ProfileCredentials struct {
	AccessToken       string `json:"accessToken"`
	AccessTokenSecret string `json:"accessTokenSecret"`
	Zone              string `json:"zone"`
}

// GetProfileCredentials returns the credentials for the given profile
func GetProfileCredentials(name string) (*ProfileCredentials, error) {
	cfg, err := loadProfileConfig(name)
	if err != nil {
		return nil, err
	}
	return &ProfileCredentials{
		AccessToken:       cfg.AccessToken,
		AccessTokenSecret: cfg.AccessTokenSecret,
		Zone:              cfg.Zone,
	}, nil
}

// SetCurrentProfile sets the current profile name
func SetCurrentProfile(name string) error {
	op := saclient.NewProfileOp(os.Environ())
	return op.SetCurrentName(name)
}

// ValidateCredentials validates the given credentials by making an API call
func ValidateCredentials(accessToken, accessTokenSecret string) error {
	//nolint:staticcheck // deprecated but works, migration to saclient is complex
	caller := iaas.NewClient(accessToken, accessTokenSecret)
	op := iaas.NewAuthStatusOp(caller)
	_, err := op.Read(context.Background())
	return err
}
