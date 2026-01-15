package sakura

import (
	"fmt"

	"github.com/zalando/go-keyring"
)

const (
	keyringService = "sakpilot"
)

// SaveObjectStorageSecret saves the secret key for an Object Storage access key
func SaveObjectStorageSecret(siteID, accessKeyID, secretKey string) error {
	account := fmt.Sprintf("objectstorage/%s/%s", siteID, accessKeyID)
	return keyring.Set(keyringService, account, secretKey)
}

// GetObjectStorageSecret retrieves the secret key for an Object Storage access key
func GetObjectStorageSecret(siteID, accessKeyID string) (string, error) {
	account := fmt.Sprintf("objectstorage/%s/%s", siteID, accessKeyID)
	return keyring.Get(keyringService, account)
}

// DeleteObjectStorageSecret removes the secret key for an Object Storage access key
func DeleteObjectStorageSecret(siteID, accessKeyID string) error {
	account := fmt.Sprintf("objectstorage/%s/%s", siteID, accessKeyID)
	return keyring.Delete(keyringService, account)
}

// HasObjectStorageSecret checks if a secret key exists for an Object Storage access key
func HasObjectStorageSecret(siteID, accessKeyID string) bool {
	_, err := GetObjectStorageSecret(siteID, accessKeyID)
	return err == nil
}

// SaveContainerRegistrySecret saves the password for a Container Registry user
func SaveContainerRegistrySecret(registryID, userName, password string) error {
	account := fmt.Sprintf("containerregistry/%s/%s", registryID, userName)
	return keyring.Set(keyringService, account, password)
}

// GetContainerRegistrySecret retrieves the password for a Container Registry user
func GetContainerRegistrySecret(registryID, userName string) (string, error) {
	account := fmt.Sprintf("containerregistry/%s/%s", registryID, userName)
	return keyring.Get(keyringService, account)
}

// DeleteContainerRegistrySecret removes the password for a Container Registry user
func DeleteContainerRegistrySecret(registryID, userName string) error {
	account := fmt.Sprintf("containerregistry/%s/%s", registryID, userName)
	return keyring.Delete(keyringService, account)
}

// HasContainerRegistrySecret checks if a password exists for a Container Registry user
func HasContainerRegistrySecret(registryID, userName string) bool {
	_, err := GetContainerRegistrySecret(registryID, userName)
	return err == nil
}
