package sakura

import (
	"context"
	"fmt"

	"github.com/google/go-containerregistry/pkg/authn"
	"github.com/google/go-containerregistry/pkg/name"
	"github.com/google/go-containerregistry/pkg/v1/remote"
)

type RegistryImage struct {
	Name string `json:"name"`
}

type RegistryTag struct {
	Name   string `json:"name"`
	Size   int64  `json:"size"`
	Digest string `json:"digest"`
}

// getAuthOption returns the authentication option for registry access
func getAuthOption(username, password string) remote.Option {
	if username == "" || password == "" {
		return remote.WithAuth(authn.Anonymous)
	}
	return remote.WithAuth(authn.FromConfig(authn.AuthConfig{
		Username: username,
		Password: password,
	}))
}

// ListRegistryImages lists all images in the registry using go-containerregistry
func ListRegistryImages(ctx context.Context, fqdn, username, password string) ([]RegistryImage, error) {
	reg, err := name.NewRegistry(fqdn)
	if err != nil {
		return nil, fmt.Errorf("invalid registry: %w", err)
	}

	authOpt := getAuthOption(username, password)

	// Use Catalog to get all repositories with pagination handled automatically
	repos, err := remote.Catalog(ctx, reg, authOpt)
	if err != nil {
		return nil, fmt.Errorf("failed to list repositories: %w", err)
	}

	images := make([]RegistryImage, 0, len(repos))
	for _, repoName := range repos {
		images = append(images, RegistryImage{Name: repoName})
	}
	return images, nil
}

// GetImageTags lists all tags for a given image and retrieves their sizes
func GetImageTags(ctx context.Context, fqdn, username, password, imageName string) ([]RegistryTag, error) {
	repo, err := name.NewRepository(fmt.Sprintf("%s/%s", fqdn, imageName))
	if err != nil {
		return nil, fmt.Errorf("invalid repository: %w", err)
	}

	authOpt := getAuthOption(username, password)

	// List all tags
	tagNames, err := remote.List(repo, authOpt)
	if err != nil {
		return nil, fmt.Errorf("failed to list tags: %w", err)
	}

	tags := make([]RegistryTag, 0, len(tagNames))
	for _, tagName := range tagNames {
		tag, err := getTagInfo(ctx, repo, tagName, authOpt)
		if err != nil {
			// If we can't get tag info, still include it with zero size
			tags = append(tags, RegistryTag{Name: tagName, Size: 0, Digest: ""})
			continue
		}
		tags = append(tags, *tag)
	}

	return tags, nil
}

func getTagInfo(ctx context.Context, repo name.Repository, tagName string, authOpt remote.Option) (*RegistryTag, error) {
	ref, err := name.NewTag(fmt.Sprintf("%s:%s", repo.Name(), tagName))
	if err != nil {
		return nil, err
	}

	desc, err := remote.Get(ref, authOpt)
	if err != nil {
		return nil, err
	}

	// Get the image to calculate total size
	img, err := desc.Image()
	if err != nil {
		// If we can't get as image (might be index), just use manifest size
		return &RegistryTag{
			Name:   tagName,
			Size:   desc.Size,
			Digest: desc.Digest.String(),
		}, nil
	}

	// Calculate total size from layers
	layers, err := img.Layers()
	if err != nil {
		return &RegistryTag{
			Name:   tagName,
			Size:   desc.Size,
			Digest: desc.Digest.String(),
		}, nil
	}

	var totalSize int64
	for _, layer := range layers {
		size, err := layer.Size()
		if err == nil {
			totalSize += size
		}
	}

	// Add config size
	configFile, err := img.RawConfigFile()
	if err == nil {
		totalSize += int64(len(configFile))
	}

	return &RegistryTag{
		Name:   tagName,
		Size:   totalSize,
		Digest: desc.Digest.String(),
	}, nil
}
