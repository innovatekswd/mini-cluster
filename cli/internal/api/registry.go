package api

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"path/filepath"
	"time"
)

// Package represents a published package in the registry
type Package struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Version     string    `json:"version"`
	Description string    `json:"description"`
	Author      string    `json:"author"`
	Tags        string    `json:"tags"`
	Manifest    string    `json:"manifest"`
	FilePath    string    `json:"filePath"`
	FileSize    int64     `json:"fileSize"`
	Checksum    string    `json:"checksum"`
	IsPublic    bool      `json:"isPublic"`
	Downloads   int       `json:"downloads"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

// PackageInstall represents an installation record
type PackageInstall struct {
	ID          string     `json:"id"`
	PackageID   string     `json:"packageId"`
	PackageName string     `json:"packageName"`
	Version     string     `json:"version"`
	ServiceID   string     `json:"serviceId"`
	Status      string     `json:"status"`
	Error       string     `json:"error"`
	InstalledAt *time.Time `json:"installedAt"`
	RemovedAt   *time.Time `json:"removedAt"`
	CreatedAt   time.Time  `json:"createdAt"`
}

// ListPackages returns all packages in the registry
func (c *Client) ListPackages(ctx context.Context, name, tag string) ([]Package, error) {
	path := "/api/registry/packages"
	sep := "?"
	if name != "" {
		path += sep + "name=" + name
		sep = "&"
	}
	if tag != "" {
		path += sep + "tag=" + tag
	}
	var result []Package
	if err := c.Get(ctx, path, &result); err != nil {
		return nil, err
	}
	return result, nil
}

// ListVersions returns all versions for a package name
func (c *Client) ListVersions(ctx context.Context, name string) ([]Package, error) {
	var result []Package
	if err := c.Get(ctx, "/api/registry/packages/"+name, &result); err != nil {
		return nil, err
	}
	return result, nil
}

// GetPackage returns details of a specific package version
func (c *Client) GetPackage(ctx context.Context, name, version string) (*Package, error) {
	var result Package
	if err := c.Get(ctx, fmt.Sprintf("/api/registry/packages/%s/%s", name, version), &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// PublishPackage uploads a .mcpkg file to the registry
func (c *Client) PublishPackage(ctx context.Context, name, version, description, author, tags, manifest string, fileReader io.Reader, fileName string) (*Package, error) {
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	part, err := writer.CreateFormFile("package", filepath.Base(fileName))
	if err != nil {
		return nil, err
	}
	if _, err := io.Copy(part, fileReader); err != nil {
		return nil, err
	}

	for field, val := range map[string]string{
		"name": name, "version": version, "description": description,
		"author": author, "tags": tags, "manifest": manifest,
	} {
		if err := writer.WriteField(field, val); err != nil {
			return nil, err
		}
	}
	writer.Close()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/api/registry/packages", body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())
	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return nil, parseAPIError(resp.StatusCode, respBody)
	}

	var result Package
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// UnpublishPackage removes a package version from the registry
func (c *Client) UnpublishPackage(ctx context.Context, name, version string) error {
	return c.Delete(ctx, fmt.Sprintf("/api/registry/packages/%s/%s", name, version))
}

// SearchPackages lists packages filtered by a search query (server-side name/tag match)
func (c *Client) SearchPackages(ctx context.Context, query string) ([]Package, error) {
	return c.ListPackages(ctx, "", query)
}

// ComponentSummary describes a single component of a package
type ComponentSummary struct {
	Name        string   `json:"name"`
	Type        string   `json:"type"`
	Image       string   `json:"image,omitempty"`
	Command     string   `json:"command,omitempty"`
	DependsOn   []string `json:"dependsOn,omitempty"`
	RequiredEnv []string `json:"requiredEnv,omitempty"`
}

// GetComponents returns the component summaries for a package version
func (c *Client) GetComponents(ctx context.Context, name, version string) ([]ComponentSummary, error) {
	if version == "" {
		version = "latest"
	}
	var result []ComponentSummary
	if err := c.Get(ctx, fmt.Sprintf("/api/registry/packages/%s/%s/components", name, version), &result); err != nil {
		return nil, err
	}
	return result, nil
}

// GetManifest returns the raw manifest JSON string for a package version
func (c *Client) GetManifest(ctx context.Context, name, version string) (string, error) {
	if version == "" {
		version = "latest"
	}
	// The endpoint returns raw JSON; decode as map to re-marshal prettily
	var raw map[string]interface{}
	if err := c.Get(ctx, fmt.Sprintf("/api/registry/packages/%s/%s/manifest", name, version), &raw); err != nil {
		return "", err
	}
	b, _ := json.MarshalIndent(raw, "", "  ")
	return string(b), nil
}

// ListInstalls returns all package installations on this node
func (c *Client) ListInstalls(ctx context.Context) ([]PackageInstall, error) {
	var result []PackageInstall
	if err := c.Get(ctx, "/api/registry/installs", &result); err != nil {
		return nil, err
	}
	return result, nil
}

// InstallPackage installs a package by name (and optional version)
func (c *Client) InstallPackage(ctx context.Context, name, version string, env map[string]string, autoStart bool) (*PackageInstall, error) {
	body := map[string]interface{}{
		"name":      name,
		"version":   version,
		"env":       env,
		"autoStart": autoStart,
	}
	var result PackageInstall
	if err := c.Post(ctx, "/api/registry/install", body, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// RemoveInstall removes an installation record
func (c *Client) RemoveInstall(ctx context.Context, id string) error {
	return c.Delete(ctx, "/api/registry/installs/"+id)
}
