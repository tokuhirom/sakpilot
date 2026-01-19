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
func UpdateProfile(name, accessToken, accessTokenSecret, zone string) error {
	op := saclient.NewProfileOp(os.Environ())

	profile := &saclient.Profile{
		Name: name,
		Attributes: map[string]any{
			"AccessToken":       accessToken,
			"AccessTokenSecret": accessTokenSecret,
			"Zone":              zone,
		},
	}
	_, err := op.Update(profile)
	return err
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
